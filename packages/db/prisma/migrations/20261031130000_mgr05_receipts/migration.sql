BEGIN;
CREATE TYPE manager_payment_method AS ENUM('CASH','CARD','BANK_TRANSFER','ONLINE');
CREATE TYPE manager_payment_purpose AS ENUM('FIRST_PAYMENT','RENEWAL','OTHER');
ALTER TABLE payment_receipts
  ADD COLUMN method manager_payment_method,
  ADD COLUMN purpose manager_payment_purpose,
  ADD COLUMN received_at timestamptz(3),
  ADD COLUMN manager_note text,
  ADD COLUMN approval_requested_at timestamptz(3),
  ADD COLUMN rejected_at timestamptz(3),
  ADD COLUMN rejection_reason text,
  ADD COLUMN rejected_by_staff_id uuid REFERENCES staff_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT ck_mgr05_receipt_metadata CHECK((method IS NULL AND purpose IS NULL AND received_at IS NULL)
    OR (method IS NOT NULL AND purpose IS NOT NULL AND received_at IS NOT NULL AND received_at<=registered_at AND amount<1000000000000)),
  ADD CONSTRAINT ck_mgr05_receipt_text CHECK(length(manager_note)<=500 AND (method IS NULL OR length(external_reference)<=100)),
  ADD CONSTRAINT ck_mgr05_rejection CHECK((rejected_at IS NULL AND rejection_reason IS NULL AND rejected_by_staff_id IS NULL)
    OR (rejected_at IS NOT NULL AND rejection_reason IS NOT NULL AND length(trim(rejection_reason)) BETWEEN 3 AND 500 AND rejected_by_staff_id IS NOT NULL
      AND confirmed_by_director_at IS NULL AND approval_requested_at IS NULL));
-- Existing rows keep NULL metadata. No historic cash method, purpose, currency or timestamps are fabricated.
CREATE UNIQUE INDEX uq_mgr05_method_reference ON payment_receipts(method,external_reference);
CREATE INDEX idx_mgr05_receipt_page ON payment_receipts(student_id,created_at,id);
ALTER TABLE payment_distributions ADD COLUMN manager_prepared boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION t03_guard_payment() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF OLD.confirmed_by_director_at IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Confirmed payment is immutable',CONSTRAINT='ck_confirmed_payment_immutable';
    END IF;
    IF OLD.rejected_at IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Rejected receipt is immutable',CONSTRAINT='ck_mgr05_rejected_immutable';
    END IF;
    IF OLD.method IS NOT NULL AND (to_jsonb(NEW)-ARRAY['approval_requested_at','rejected_at','rejection_reason','rejected_by_staff_id',
      'confirmed_by_director_id','confirmed_by_director_at','confirmation_operation_id','updated_at']) IS DISTINCT FROM
      (to_jsonb(OLD)-ARRAY['approval_requested_at','rejected_at','rejection_reason','rejected_by_staff_id',
      'confirmed_by_director_id','confirmed_by_director_at','confirmation_operation_id','updated_at']) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Receipt creation fields are immutable',CONSTRAINT='ck_mgr05_receipt_snapshot';
    END IF;
    IF OLD.approval_requested_at IS NOT NULL AND NEW.approval_requested_at IS DISTINCT FROM OLD.approval_requested_at THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Approval request is immutable';
    END IF;
  END IF;
  IF NEW.confirmed_by_director_at IS NOT NULL THEN
    PERFORM public.t03_assert_director(NEW.confirmed_by_director_id,NEW.confirmed_by_director_at);
    IF NEW.confirmed_by_director_at<NEW.registered_at THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Invalid confirmation time'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE FUNCTION mgr05_distribution_origin() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.manager_prepared IS DISTINCT FROM OLD.manager_prepared THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Distribution origin is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_mgr05_distribution_origin BEFORE UPDATE ON payment_distributions FOR EACH ROW EXECUTE FUNCTION mgr05_distribution_origin();
GRANT INSERT(method,purpose,received_at,manager_note) ON payment_receipts TO online_school_runtime;
GRANT UPDATE(approval_requested_at,rejected_at,rejection_reason,rejected_by_staff_id,updated_at) ON payment_receipts TO online_school_runtime;
GRANT INSERT(manager_prepared) ON payment_distributions TO online_school_runtime;
COMMIT;

BEGIN;

ALTER TABLE refund_records
  ADD COLUMN request_id uuid REFERENCES manager_requests(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD COLUMN prepared_by_id uuid REFERENCES staff_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD COLUMN prepared_at timestamptz(3),
  ADD COLUMN version integer NOT NULL DEFAULT 1,
  ADD COLUMN calculation_snapshot jsonb,
  ADD COLUMN quote_revision text,
  ADD COLUMN approval_basis text,
  ADD COLUMN declined_by_id uuid REFERENCES staff_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD COLUMN declined_at timestamptz(3),
  ADD COLUMN decline_reason text,
  ADD CONSTRAINT ck_refund_requested_workflow CHECK (
    request_id IS NULL OR (
      num_nonnulls(prepared_by_id,prepared_at,calculation_snapshot,quote_revision)=4
      AND version>0 AND quote_revision ~ '^[a-f0-9]{64}$'
      AND calculated_amount=paid_unused_quantity*original_paid_unit_price
      AND num_nonnulls(declined_by_id,declined_at,decline_reason) IN (0,3)
      AND (declined_at IS NULL OR (approved_amount IS NULL AND declined_at>=prepared_at AND length(trim(decline_reason))>=5))
      AND ((approved_amount IS NULL AND approval_basis IS NULL) OR
        (approved_amount>0 AND approved_amount=calculated_amount AND approved_by_director_at>=prepared_at
          AND approval_basis IS NOT NULL AND length(trim(approval_basis))>=5))
      AND num_nonnulls(executed_amount,executed_at,execution_reference)=0
    )
  );
CREATE UNIQUE INDEX refund_records_request_id_key ON refund_records(request_id);

CREATE TYPE "RefundTransferKind" AS ENUM ('PAID','FAILED','RETURNED');
CREATE TYPE "RefundTransferStatus" AS ENUM ('REPORTED','VERIFIED','REJECTED');
CREATE TABLE refund_transfers (
  id uuid PRIMARY KEY,
  refund_id uuid NOT NULL REFERENCES refund_records(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  kind "RefundTransferKind" NOT NULL,
  status "RefundTransferStatus" NOT NULL DEFAULT 'REPORTED',
  amount decimal(20,4) NOT NULL,
  occurred_at timestamptz(3) NOT NULL,
  reference text NOT NULL,
  channel text NOT NULL,
  evidence text NOT NULL,
  original_transfer_id uuid REFERENCES refund_transfers(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  reported_by_id uuid NOT NULL REFERENCES staff_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  reported_at timestamptz(3) NOT NULL,
  reviewed_by_id uuid REFERENCES staff_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  reviewed_at timestamptz(3),
  review_reason text,
  source_operation_id uuid NOT NULL,
  review_operation_id uuid,
  CONSTRAINT ck_refund_transfer_report CHECK (
    amount>0 AND occurred_at<=reported_at AND length(trim(reference)) BETWEEN 1 AND 160 AND
    reference=trim(reference) AND channel ~ '^[A-Za-z][A-Za-z0-9_-]{1,39}$' AND
    evidence ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{4,159}$' AND
    (kind='RETURNED')=(original_transfer_id IS NOT NULL)
  ),
  CONSTRAINT ck_refund_transfer_review CHECK (
    (status='REPORTED' AND num_nonnulls(reviewed_by_id,reviewed_at,review_reason,review_operation_id)=0)
    OR (status<>'REPORTED' AND num_nonnulls(reviewed_by_id,reviewed_at,review_reason,review_operation_id)=4
      AND reviewed_at>=reported_at AND length(trim(review_reason)) BETWEEN 5 AND 500)
  )
);
CREATE UNIQUE INDEX refund_transfers_source_operation_id_key ON refund_transfers(source_operation_id);
CREATE UNIQUE INDEX refund_transfers_review_operation_id_key ON refund_transfers(review_operation_id);
CREATE UNIQUE INDEX uq_refund_transfer_active_reference ON refund_transfers(reference) WHERE status<>'REJECTED';
CREATE INDEX refund_transfers_refund_id_reported_at_idx ON refund_transfers(refund_id,reported_at);
CREATE INDEX refund_transfers_original_transfer_id_idx ON refund_transfers(original_transfer_id);

ALTER TABLE entitlement_adjustments ADD COLUMN refund_id uuid REFERENCES refund_records(id) ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE UNIQUE INDEX entitlement_adjustments_refund_id_grant_id_key ON entitlement_adjustments(refund_id,grant_id);

ALTER TABLE ledger_documents
  ADD COLUMN refund_approval_id uuid REFERENCES refund_records(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD COLUMN refund_transfer_id uuid REFERENCES refund_transfers(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  DROP CONSTRAINT ck_ledger_document_source,
  ADD CONSTRAINT ck_ledger_document_source CHECK (
    num_nonnulls(payment_id,refund_id,accrual_id,payout_id,correction_of_document_id,distribution_id,
      consumption_id,refund_approval_id,refund_transfer_id)=1 AND length(trim(basis))>0
  );
CREATE UNIQUE INDEX ledger_documents_refund_approval_id_key ON ledger_documents(refund_approval_id);
CREATE UNIQUE INDEX ledger_documents_refund_transfer_id_key ON ledger_documents(refund_transfer_id);

CREATE FUNCTION guard_requested_refund() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE case_row manager_requests; previously_refunded numeric;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF OLD.request_id IS DISTINCT FROM NEW.request_id OR OLD.subscription_id<>NEW.subscription_id THEN
      RAISE EXCEPTION 'Refund source is immutable' USING ERRCODE='23514';
    END IF;
    IF OLD.request_id IS NOT NULL AND (OLD.approved_amount IS NOT NULL OR OLD.declined_at IS NOT NULL) THEN
      RAISE EXCEPTION 'Refund decision is immutable' USING ERRCODE='23514';
    END IF;
  END IF;
  IF NEW.request_id IS NULL THEN
    IF current_user='online_school_runtime' THEN
      RAISE EXCEPTION 'Refund request required' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  SELECT * INTO case_row FROM manager_requests WHERE id=NEW.request_id FOR UPDATE;
  IF case_row.kind IS DISTINCT FROM 'REFUND' OR case_row.subscription_id IS DISTINCT FROM NEW.subscription_id
    OR NOT EXISTS (SELECT 1 FROM subscriptions s JOIN student_subject_enrollments e ON e.id=s.enrollment_id
      WHERE s.id=NEW.subscription_id AND e.student_id=case_row.student_id)
    OR case_row.status NOT IN ('PENDING','APPROVED')
    OR (NEW.approved_amount IS NOT NULL AND case_row.status<>'APPROVED') THEN
    RAISE EXCEPTION 'Matching eligible refund request required' USING ERRCODE='23514';
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.version<>1 OR NEW.approved_amount IS NOT NULL OR NEW.declined_at IS NOT NULL THEN
      RAISE EXCEPTION 'Refund must begin with a manager proposal' USING ERRCODE='23514';
    END IF;
  ELSIF NEW.approved_amount IS NOT NULL OR NEW.declined_at IS NOT NULL THEN
    IF (to_jsonb(NEW) - ARRAY['approved_amount','approved_by_director_id','approved_by_director_at',
      'approval_operation_id','approval_basis','declined_by_id','declined_at','decline_reason','updated_at'])
      IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['approved_amount','approved_by_director_id','approved_by_director_at',
      'approval_operation_id','approval_basis','declined_by_id','declined_at','decline_reason','updated_at']) THEN
      RAISE EXCEPTION 'Decision must preserve the reviewed proposal' USING ERRCODE='23514';
    END IF;
    IF NEW.declined_at IS NOT NULL THEN PERFORM t03_assert_director(NEW.declined_by_id,NEW.declined_at); END IF;
    IF NEW.approved_amount IS NOT NULL THEN
      SELECT coalesce(sum(CASE WHEN request_id IS NOT NULL THEN approved_amount ELSE executed_amount END),0)
      INTO previously_refunded FROM refund_records WHERE subscription_id=NEW.subscription_id AND id<>NEW.id;
      IF previously_refunded+NEW.approved_amount>t03_paid_at(NEW.subscription_id,NEW.approved_by_director_at) THEN
        RAISE EXCEPTION 'Refund exceeds the confirmed allocated amount' USING ERRCODE='23514';
      END IF;
    END IF;
    RETURN NEW;
  ELSIF NEW.version<>OLD.version+1 THEN
    RAISE EXCEPTION 'Refund proposal version must advance' USING ERRCODE='23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM staff_accounts s JOIN auth_accounts a ON a.id=s.account_id
    JOIN role_assignments ra ON ra.account_id=a.id JOIN roles r ON r.id=ra.role_id
    WHERE s.id=NEW.prepared_by_id AND r.code='MANAGER' AND ra.valid_from<=NEW.prepared_at
      AND (ra.valid_to IS NULL OR ra.valid_to>NEW.prepared_at)
      AND (s.deactivated_at IS NULL OR s.deactivated_at>NEW.prepared_at)
      AND (a.disabled_at IS NULL OR a.disabled_at>NEW.prepared_at)) THEN
    RAISE EXCEPTION 'Manager proposal required' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_requested_refund BEFORE INSERT OR UPDATE ON refund_records
  FOR EACH ROW EXECUTE FUNCTION guard_requested_refund();

CREATE FUNCTION guard_refund_retirement() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE refund refund_records; retired bigint;
BEGIN
  IF NEW.refund_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO refund FROM refund_records WHERE id=NEW.refund_id;
  SELECT coalesce(sum(-delta_quantity::bigint),0) INTO retired FROM entitlement_adjustments WHERE refund_id=refund.id;
  IF refund.request_id IS NULL OR refund.approved_amount IS NULL OR NEW.kind<>'GRANT_DELTA'
    OR NEW.delta_quantity>=0 OR NEW.original_consumption_id IS NOT NULL
    OR NEW.author_id IS DISTINCT FROM refund.approved_by_director_id
    OR NEW.effective_at IS DISTINCT FROM refund.approved_by_director_at
    OR retired-NEW.delta_quantity>refund.paid_unused_quantity
    OR NOT EXISTS(SELECT 1 FROM entitlement_grants g WHERE g.id=NEW.grant_id AND g.subscription_id=refund.subscription_id) THEN
    RAISE EXCEPTION 'Refund rights retirement must match the approved decision' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_refund_retirement BEFORE INSERT ON entitlement_adjustments
  FOR EACH ROW EXECUTE FUNCTION guard_refund_retirement();

CREATE FUNCTION guard_refund_transfer() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE refund refund_records; original refund_transfers; total numeric;
BEGIN
  SELECT * INTO refund FROM refund_records WHERE id=NEW.refund_id FOR UPDATE;
  IF refund.request_id IS NULL OR refund.approved_amount IS NULL OR NEW.occurred_at<refund.approved_by_director_at THEN
    RAISE EXCEPTION 'Approved refund required' USING ERRCODE='23514';
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'REPORTED' THEN RAISE EXCEPTION 'Transfer must first be reported' USING ERRCODE='23514'; END IF;
    IF NOT EXISTS (SELECT 1 FROM staff_accounts s JOIN auth_accounts a ON a.id=s.account_id
      JOIN role_assignments ra ON ra.account_id=a.id JOIN roles r ON r.id=ra.role_id
      WHERE s.id=NEW.reported_by_id AND r.code='MANAGER' AND ra.valid_from<=NEW.reported_at
        AND (ra.valid_to IS NULL OR ra.valid_to>NEW.reported_at)
        AND (s.deactivated_at IS NULL OR s.deactivated_at>NEW.reported_at)
        AND (a.disabled_at IS NULL OR a.disabled_at>NEW.reported_at)) THEN
      RAISE EXCEPTION 'Manager report required' USING ERRCODE='23514';
    END IF;
  ELSE
    IF OLD.status<>'REPORTED' OR NEW.status='REPORTED' OR
      (to_jsonb(NEW) - ARRAY['status','reviewed_by_id','reviewed_at','review_reason','review_operation_id'])
      IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','reviewed_by_id','reviewed_at','review_reason','review_operation_id']) THEN
      RAISE EXCEPTION 'Transfer report and review are immutable' USING ERRCODE='23514';
    END IF;
    PERFORM t03_assert_director(NEW.reviewed_by_id,NEW.reviewed_at);
    IF NEW.status='REJECTED' THEN RETURN NEW; END IF;
  END IF;
  IF NEW.kind='RETURNED' THEN
    SELECT * INTO original FROM refund_transfers WHERE id=NEW.original_transfer_id;
    SELECT coalesce(sum(amount),0) INTO total FROM refund_transfers
      WHERE original_transfer_id=original.id AND status='VERIFIED';
    IF original.refund_id IS DISTINCT FROM refund.id OR original.kind<>'PAID' OR original.status<>'VERIFIED'
      OR NEW.occurred_at<original.occurred_at OR (NEW.status='VERIFIED' AND total+NEW.amount>original.amount) THEN
      RAISE EXCEPTION 'Return must match a verified transfer and its outstanding amount' USING ERRCODE='23514';
    END IF;
  ELSIF NEW.kind='PAID' AND NEW.status='VERIFIED' THEN
    SELECT coalesce(sum(CASE kind WHEN 'PAID' THEN amount WHEN 'RETURNED' THEN -amount ELSE 0 END),0) INTO total
      FROM refund_transfers WHERE refund_id=refund.id AND status='VERIFIED';
    IF total+NEW.amount>refund.approved_amount THEN
      RAISE EXCEPTION 'Transfer exceeds approved amount' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_refund_transfer BEFORE INSERT OR UPDATE ON refund_transfers
  FOR EACH ROW EXECUTE FUNCTION guard_refund_transfer();

CREATE FUNCTION assert_refund_journal(source_id uuid, transfer boolean, expected_amount numeric, expected_currency text,
  debit "LedgerAccountType", credit "LedgerAccountType") RETURNS void LANGUAGE plpgsql AS $$
DECLARE line_count bigint; matching bigint;
BEGIN
  SELECT count(*),count(*) FILTER (WHERE l.amount=expected_amount AND l.currency=expected_currency
    AND ((l.direction='DEBIT' AND l.account_type=debit) OR (l.direction='CREDIT' AND l.account_type=credit)))
  INTO line_count,matching
  FROM ledger_documents d JOIN ledger_entries e ON e.document_id=d.id AND e.published_at IS NOT NULL
  JOIN ledger_lines l ON l.entry_id=e.id
  WHERE (transfer AND d.refund_transfer_id=source_id) OR (NOT transfer AND d.refund_approval_id=source_id);
  IF line_count<>2 OR matching<>2 THEN
    RAISE EXCEPTION 'Published refund journal pair required' USING ERRCODE='23514';
  END IF;
END $$;

CREATE FUNCTION check_approved_refund() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce((SELECT sum(-delta_quantity::bigint) FROM entitlement_adjustments WHERE refund_id=NEW.id),0)
    <>NEW.paid_unused_quantity THEN
    RAISE EXCEPTION 'Approved refund must retire its unused rights' USING ERRCODE='23514';
  END IF;
  PERFORM assert_refund_journal(NEW.id,false,NEW.approved_amount,NEW.currency,'CUSTOMER_ADVANCE','REFUND_PAYABLE');
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER trg_check_approved_refund AFTER UPDATE ON refund_records
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.request_id IS NOT NULL AND NEW.approved_amount IS NOT NULL)
  EXECUTE FUNCTION check_approved_refund();

CREATE FUNCTION check_refund_transfer_journal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE unit text;
BEGIN
  SELECT currency INTO unit FROM refund_records WHERE id=NEW.refund_id;
  IF NEW.kind='PAID' THEN
    PERFORM assert_refund_journal(NEW.id,true,NEW.amount,unit,'REFUND_PAYABLE','CASH');
  ELSE
    PERFORM assert_refund_journal(NEW.id,true,NEW.amount,unit,'CASH','REFUND_PAYABLE');
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER trg_check_refund_transfer_journal AFTER UPDATE ON refund_transfers
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.status='VERIFIED' AND NEW.kind<>'FAILED')
  EXECUTE FUNCTION check_refund_transfer_journal();

GRANT INSERT, UPDATE ON refund_records TO online_school_runtime;
GRANT SELECT, INSERT, UPDATE ON refund_transfers TO online_school_runtime;

COMMIT;

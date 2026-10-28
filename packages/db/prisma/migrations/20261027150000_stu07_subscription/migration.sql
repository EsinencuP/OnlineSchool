BEGIN;
-- Preserve superseded CRM freeze intervals; no fabricated historical backfill.
CREATE TABLE subscription_freeze_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL,
  frozen_from timestamptz(3) NOT NULL,
  frozen_until timestamptz(3) NOT NULL CHECK (frozen_until>frozen_from),
  replaced_at timestamptz(3) NOT NULL,
  created_at timestamptz(3) NOT NULL DEFAULT now(),
  updated_at timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT fk_stu07_freeze_subscription FOREIGN KEY(subscription_id) REFERENCES subscriptions(id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX subscription_freeze_history_subscription_id_replaced_at_idx ON subscription_freeze_history(subscription_id,replaced_at);
CREATE TRIGGER trg_stu07_freeze_immutable BEFORE UPDATE OR DELETE ON subscription_freeze_history FOR EACH ROW EXECUTE FUNCTION t03_immutable_record();
CREATE FUNCTION stu07_capture_freeze() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF OLD.frozen_from IS NOT NULL AND (NEW.frozen_from IS DISTINCT FROM OLD.frozen_from OR NEW.frozen_until IS DISTINCT FROM OLD.frozen_until) THEN
    INSERT INTO public.subscription_freeze_history(subscription_id,frozen_from,frozen_until,replaced_at)
      VALUES(OLD.id,OLD.frozen_from,OLD.frozen_until,clock_timestamp());
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION stu07_capture_freeze() FROM PUBLIC;
CREATE TRIGGER trg_stu07_capture_freeze AFTER UPDATE OF frozen_from,frozen_until ON subscriptions FOR EACH ROW EXECUTE FUNCTION stu07_capture_freeze();
REVOKE ALL ON subscription_freeze_history FROM PUBLIC,online_school_runtime;
GRANT SELECT ON subscription_freeze_history,sale_conditions,subscriptions,payment_receipts,payment_distributions,
  entitlement_grants,entitlement_consumptions,entitlement_adjustments,ledger_documents,ledger_entries TO online_school_runtime;
COMMIT;

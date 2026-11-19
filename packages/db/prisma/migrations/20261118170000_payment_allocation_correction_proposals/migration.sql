BEGIN;

CREATE TYPE public.allocation_correction_status AS ENUM ('PENDING','REJECTED','MANUAL_REVIEW');

CREATE TABLE public.payment_allocation_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_distribution_id uuid NOT NULL REFERENCES public.payment_distributions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  target_subscription_id uuid REFERENCES public.subscriptions(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  amount numeric(20,4) NOT NULL CHECK (amount>0),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 5 AND 500),
  proposed_by_id uuid NOT NULL REFERENCES public.staff_accounts(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  proposed_at timestamptz(3) NOT NULL,
  source_operation_id uuid NOT NULL UNIQUE,
  status public.allocation_correction_status NOT NULL DEFAULT 'PENDING',
  decided_by_id uuid REFERENCES public.staff_accounts(id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  decided_at timestamptz(3),
  decision_reason text,
  decision_operation_id uuid UNIQUE,
  CONSTRAINT ck_payment_allocation_correction_decision CHECK (
    (status='PENDING' AND num_nonnulls(decided_by_id,decided_at,decision_reason,decision_operation_id)=0)
    OR (status IN ('REJECTED','MANUAL_REVIEW') AND num_nonnulls(decided_by_id,decided_at,decision_reason,decision_operation_id)=4
      AND decided_at>=proposed_at AND length(btrim(decision_reason)) BETWEEN 5 AND 500))
);
CREATE INDEX payment_allocation_corrections_source_distribution_id_idx
  ON public.payment_allocation_corrections(source_distribution_id);
CREATE INDEX payment_allocation_corrections_status_id_idx ON public.payment_allocation_corrections(status,id);
CREATE UNIQUE INDEX uq_open_allocation_correction ON public.payment_allocation_corrections(source_distribution_id)
  WHERE status IN ('PENDING','MANUAL_REVIEW');

CREATE FUNCTION public.guard_payment_allocation_correction() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE original public.payment_distributions; target public.subscriptions;
BEGIN
  IF TG_OP='INSERT' THEN
    SELECT * INTO original FROM public.payment_distributions WHERE id=NEW.source_distribution_id FOR UPDATE;
    IF original.approved_at IS NULL OR original.approved_at>NEW.proposed_at OR NEW.amount>original.amount
      OR NEW.status<>'PENDING' OR NOT EXISTS (
        SELECT 1 FROM public.ledger_documents doc JOIN public.ledger_entries entry ON entry.document_id=doc.id
        WHERE doc.distribution_id=original.id AND entry.published_at<=NEW.proposed_at AND entry.effective_at<=NEW.proposed_at
          AND entry.reverses_entry_id IS NULL) THEN
      RAISE EXCEPTION 'A proposed correction needs an approved source allocation' USING ERRCODE='23514',
        CONSTRAINT='ck_payment_allocation_correction_source';
    END IF;
    IF NEW.target_subscription_id IS NOT NULL THEN
      SELECT * INTO target FROM public.subscriptions WHERE id=NEW.target_subscription_id;
      IF target.id IS NOT DISTINCT FROM original.subscription_id OR target.currency IS DISTINCT FROM original.currency THEN
        RAISE EXCEPTION 'Invalid replacement subscription' USING ERRCODE='23514', CONSTRAINT='ck_payment_allocation_correction_target';
      END IF;
    END IF;
  ELSE
    IF OLD.status<>'PENDING' OR NEW.status='PENDING'
      OR (to_jsonb(NEW)-ARRAY['status','decided_by_id','decided_at','decision_reason','decision_operation_id'])
        IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','decided_by_id','decided_at','decision_reason','decision_operation_id']) THEN
      RAISE EXCEPTION 'Correction proposal and its decision are immutable' USING ERRCODE='23514',
        CONSTRAINT='ck_payment_allocation_correction_immutable';
    END IF;
    PERFORM public.t03_assert_director(NEW.decided_by_id,NEW.decided_at);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_payment_allocation_correction BEFORE INSERT OR UPDATE ON public.payment_allocation_corrections
  FOR EACH ROW EXECUTE FUNCTION public.guard_payment_allocation_correction();
CREATE TRIGGER trg_payment_allocation_correction_no_delete BEFORE DELETE ON public.payment_allocation_corrections
  FOR EACH ROW EXECUTE FUNCTION public.t03_immutable_record();

REVOKE ALL ON public.payment_allocation_corrections FROM PUBLIC,online_school_runtime;
GRANT SELECT,INSERT ON public.payment_allocation_corrections TO online_school_runtime;
GRANT UPDATE(status,decided_by_id,decided_at,decision_reason,decision_operation_id)
  ON public.payment_allocation_corrections TO online_school_runtime;
REVOKE ALL ON FUNCTION public.guard_payment_allocation_correction() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_payment_allocation_correction() TO online_school_runtime;

COMMIT;

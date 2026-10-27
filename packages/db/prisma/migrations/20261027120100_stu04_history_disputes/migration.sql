BEGIN;
ALTER TABLE ledger_entries ADD COLUMN entitlement_balance_before numeric(20,0), ADD COLUMN entitlement_balance_after numeric(20,0);
ALTER TABLE ledger_entries ADD CONSTRAINT ck_entitlement_balance_snapshot CHECK (
  (entitlement_balance_before IS NULL AND entitlement_balance_after IS NULL)
  OR (entitlement_balance_before IS NOT NULL AND entitlement_balance_after IS NOT NULL
    AND entitlement_balance_before>=entitlement_balance_after AND entitlement_balance_after>=0)
);
-- Old published entries remain untouched. A missing historical snapshot stays null.
CREATE FUNCTION stu04_guard_entitlement_snapshot() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE qty integer; sub uuid; consumed_time timestamptz; actual_after numeric;
BEGIN
  IF TG_OP='UPDATE' AND OLD.entitlement_balance_before IS NOT NULL AND
    (NEW.entitlement_balance_before IS DISTINCT FROM OLD.entitlement_balance_before OR NEW.entitlement_balance_after IS DISTINCT FROM OLD.entitlement_balance_after) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Entitlement snapshot is immutable';
  END IF;
  IF NEW.entitlement_balance_before IS NOT NULL THEN
    SELECT c.quantity,c.subscription_id,c.consumed_at INTO qty,sub,consumed_time FROM public.ledger_documents d JOIN public.entitlement_consumptions c ON c.id=d.consumption_id WHERE d.id=NEW.document_id;
    IF qty IS NULL OR NEW.entitlement_balance_before-NEW.entitlement_balance_after<>qty THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Entitlement snapshot must match consumption';
    END IF;
    IF TG_OP='INSERT' THEN
      SELECT coalesce(sum(g.quantity
        +coalesce((SELECT sum(a.delta_quantity) FROM public.entitlement_adjustments a WHERE a.grant_id=g.id AND a.effective_at<=consumed_time),0)
        -coalesce((SELECT sum(c.quantity) FROM public.entitlement_consumptions c WHERE c.grant_id=g.id AND c.consumed_at<=consumed_time
          AND (c.cancelled_at IS NULL OR c.cancelled_at>consumed_time)),0)),0)
        INTO actual_after FROM public.entitlement_grants g WHERE g.subscription_id=sub AND g.granted_at<=consumed_time;
      IF NEW.entitlement_balance_after<>actual_after THEN
        RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Entitlement snapshot must match subscription rights';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER stu04_entitlement_snapshot BEFORE INSERT OR UPDATE ON ledger_entries FOR EACH ROW EXECUTE FUNCTION stu04_guard_entitlement_snapshot();

CREATE UNIQUE INDEX uq_open_attendance_dispute ON crm_tasks(student_id,lesson_id)
  WHERE type='ATTENDANCE_DISPUTE' AND status IN ('OPEN','IN_PROGRESS');
ALTER TABLE crm_tasks ADD CONSTRAINT ck_attendance_dispute_payload CHECK (
  type<>'ATTENDANCE_DISPUTE' OR (student_id IS NOT NULL AND lesson_id IS NOT NULL AND payload IS NOT NULL
    AND jsonb_typeof(payload)='object' AND payload ? 'description' AND jsonb_typeof(payload->'description')='string'
    AND length(btrim(payload->>'description')) BETWEEN 10 AND 1000)
);
CREATE FUNCTION stu04_guard_attendance_dispute() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE verify_eligibility boolean; t timestamptz;
BEGIN
  IF TG_OP='UPDATE' AND OLD.type='ATTENDANCE_DISPUTE' AND NEW.type<>OLD.type THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Attendance dispute type is immutable';
  END IF;
  IF NEW.type<>'ATTENDANCE_DISPUTE' THEN RETURN NEW; END IF;
  verify_eligibility=TG_OP='INSERT';
  IF TG_OP='UPDATE' THEN
    IF NEW.student_id IS DISTINCT FROM OLD.student_id OR NEW.lesson_id IS DISTINCT FROM OLD.lesson_id THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Attendance dispute address is immutable';
    END IF;
    verify_eligibility=OLD.type<>'ATTENDANCE_DISPUTE' OR (OLD.status NOT IN ('OPEN','IN_PROGRESS') AND NEW.status IN ('OPEN','IN_PROGRESS'));
  END IF;
  IF verify_eligibility THEN
    t=clock_timestamp();
    PERFORM l.id FROM public.lesson_occurrences l WHERE l.id=NEW.lesson_id FOR UPDATE;
    IF NOT EXISTS(SELECT 1 FROM public.lesson_occurrences l JOIN public.student_subject_enrollments e ON e.id=l.enrollment_id
      LEFT JOIN public.lesson_outcome_reports r ON r.id=l.confirmed_report_id AND r.lesson_occurrence_id=l.id
      WHERE l.id=NEW.lesson_id AND e.student_id=NEW.student_id AND l.scheduled_at<=t AND l.scheduled_at>=t-interval '720 hours'
        AND ((l.status='CONDUCTED' AND EXISTS(SELECT 1 FROM public.lesson_actual_outcomes o WHERE o.lesson_occurrence_id=l.id AND o.confirmed_at<=t))
          OR (l.status='CANCELLED' AND r.result='NOT_CONDUCTED' AND r.student_no_show AND r.reported_at<=t))
        AND EXISTS(SELECT 1 FROM public.entitlement_consumptions c JOIN public.subscriptions s ON s.id=c.subscription_id AND s.enrollment_id=e.id
          JOIN public.ledger_documents d ON d.consumption_id=c.id JOIN public.ledger_entries le ON le.document_id=d.id
          WHERE c.lesson_occurrence_id=l.id AND c.consumed_at<=t AND (c.cancelled_at IS NULL OR c.cancelled_at>t) AND le.published_at<=t)) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Attendance dispute requires a current deduction within 30 days';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER stu04_attendance_dispute BEFORE INSERT OR UPDATE ON crm_tasks FOR EACH ROW EXECUTE FUNCTION stu04_guard_attendance_dispute();
REVOKE ALL ON FUNCTION stu04_guard_entitlement_snapshot(),stu04_guard_attendance_dispute() FROM PUBLIC;
COMMIT;

BEGIN;

CREATE TABLE public.lesson_admission_starts (
  lesson_id uuid PRIMARY KEY REFERENCES public.lesson_occurrences(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  permission_id uuid NOT NULL REFERENCES public.temporary_access_permissions(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  admitted_at timestamptz(3) NOT NULL,
  source_operation_id uuid NOT NULL UNIQUE
);
CREATE INDEX lesson_admission_starts_permission_id_idx ON public.lesson_admission_starts(permission_id);
CREATE TRIGGER trg_lesson_admission_start_immutable BEFORE UPDATE OR DELETE ON public.lesson_admission_starts
  FOR EACH ROW EXECUTE FUNCTION public.t03_immutable_record();

-- A confirmed outcome and its original start occupy one place. Cancelled and resolved non-conducted starts free it.
CREATE FUNCTION public.t03_admission_slots_used(permission uuid, skip_lesson uuid, observed_at timestamptz)
RETURNS integer LANGUAGE sql STABLE SET search_path = pg_catalog, public AS $$
  SELECT count(*)::int FROM (
    SELECT outcome.lesson_occurrence_id AS lesson_id FROM public.lesson_actual_outcomes outcome
    WHERE outcome.temporary_access_permission_id=permission
      AND (observed_at IS NULL OR outcome.confirmed_at<=observed_at)
    UNION
    SELECT start.lesson_id FROM public.lesson_admission_starts start
    JOIN public.lesson_occurrences lesson ON lesson.id=start.lesson_id
    WHERE start.permission_id=permission AND (observed_at IS NULL OR start.admitted_at<=observed_at)
      AND (lesson.status='DISPUTED' OR (lesson.status IN ('SCHEDULED','STAR_PENDING') AND lesson.confirmed_report_id IS NULL))
  ) occupied WHERE occupied.lesson_id IS DISTINCT FROM skip_lesson
$$;

-- Take the same lock for a start and a retrospective confirmation without a start record.
CREATE FUNCTION public.t03_assert_admission_available(permission_id uuid, enrollment_id uuid, at_time timestamptz)
RETURNS void LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE permit public.temporary_access_permissions; sub public.subscriptions;
BEGIN
  SELECT * INTO permit FROM public.temporary_access_permissions WHERE id=permission_id FOR UPDATE;
  SELECT * INTO sub FROM public.subscriptions WHERE id=permit.subscription_id;
  IF permit.id IS NULL OR sub.enrollment_id IS DISTINCT FROM enrollment_id
    OR sub.valid_from>at_time OR sub.valid_to<=at_time
    OR coalesce(sub.frozen_from<=at_time AND sub.frozen_until>at_time,false)
    OR EXISTS (SELECT 1 FROM public.subscription_freeze_history h WHERE h.subscription_id=sub.id
      AND h.frozen_from<=at_time AND h.frozen_until>at_time)
    OR permit.approved_at>at_time OR permit.valid_from>at_time OR permit.valid_to<=at_time
    OR permit.revoked_at<=at_time OR public.t03_paid_at(sub.id,at_time)>=sub.full_price
    OR EXISTS (SELECT 1 FROM public.payment_distributions d JOIN public.payment_receipts r ON r.id=d.payment_id
      WHERE d.subscription_id=sub.id AND d.approved_at>permit.approved_at
        AND d.approved_at<=at_time AND r.confirmed_by_director_at<=at_time)
    OR public.t03_admission_slots_used(permit.id,NULL,NULL)>=permit.max_lessons THEN
    RAISE EXCEPTION 'Director admission is unavailable' USING ERRCODE='23514', CONSTRAINT='ck_outcome_admission';
  END IF;
END $$;

CREATE FUNCTION public.t03_guard_admission_start()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE lesson public.lesson_occurrences;
BEGIN
  SELECT * INTO lesson FROM public.lesson_occurrences WHERE id=NEW.lesson_id FOR UPDATE;
  IF lesson.kind IS DISTINCT FROM 'REGULAR' OR lesson.status NOT IN ('SCHEDULED','STAR_PENDING')
    OR lesson.confirmed_report_id IS NOT NULL OR lesson.actual_start_at IS DISTINCT FROM NEW.admitted_at
    OR NEW.admitted_at<lesson.scheduled_at OR NEW.admitted_at>=lesson.scheduled_end_at THEN
    RAISE EXCEPTION 'Admission requires a matching live lesson start' USING ERRCODE='23514', CONSTRAINT='ck_admission_lesson_start';
  END IF;
  PERFORM public.t03_assert_admission_available(NEW.permission_id,lesson.enrollment_id,NEW.admitted_at);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_lesson_admission_start BEFORE INSERT ON public.lesson_admission_starts
  FOR EACH ROW EXECUTE FUNCTION public.t03_guard_admission_start();

CREATE OR REPLACE FUNCTION public.t03_guard_outcome()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE lesson public.lesson_occurrences; admission_start public.lesson_admission_starts;
BEGIN
  SELECT * INTO lesson FROM public.lesson_occurrences WHERE id=NEW.lesson_occurrence_id FOR UPDATE;
  IF lesson.actual_start_at IS DISTINCT FROM NEW.actual_started_at OR lesson.actual_teacher_at_start_id IS DISTINCT FROM NEW.actual_teacher_id
    OR lesson.rate_at_start_snapshot IS DISTINCT FROM NEW.rate_snapshot OR lesson.points_at_start_snapshot IS DISTINCT FROM NEW.points_snapshot
    OR lesson.rate_basis_at_start IS DISTINCT FROM NEW.rate_basis OR lesson.rate_currency_at_start IS DISTINCT FROM NEW.currency THEN
    RAISE EXCEPTION 'Outcome must reuse the actual-start snapshot' USING ERRCODE='23514', CONSTRAINT='ck_outcome_start_snapshot';
  END IF;
  SELECT * INTO admission_start FROM public.lesson_admission_starts WHERE lesson_id=NEW.lesson_occurrence_id;
  IF FOUND THEN
    IF NEW.temporary_access_permission_id IS DISTINCT FROM admission_start.permission_id THEN
      RAISE EXCEPTION 'Outcome must reuse the admission at actual start' USING ERRCODE='23514', CONSTRAINT='ck_outcome_admission';
    END IF;
  ELSIF NEW.temporary_access_permission_id IS NOT NULL THEN
    PERFORM public.t03_assert_admission_available(NEW.temporary_access_permission_id,lesson.enrollment_id,NEW.actual_started_at);
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON public.lesson_admission_starts FROM PUBLIC, online_school_runtime;
GRANT SELECT,INSERT ON public.lesson_admission_starts TO online_school_runtime;
REVOKE ALL ON FUNCTION public.t03_admission_slots_used(uuid,uuid,timestamptz),
  public.t03_assert_admission_available(uuid,uuid,timestamptz),public.t03_guard_admission_start() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.t03_admission_slots_used(uuid,uuid,timestamptz),
  public.t03_assert_admission_available(uuid,uuid,timestamptz),public.t03_guard_admission_start() TO online_school_runtime;

COMMIT;

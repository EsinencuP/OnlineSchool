BEGIN;
ALTER TABLE lesson_occurrences
  ADD COLUMN manager_subscription_id uuid REFERENCES manager_subscriptions(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD COLUMN google_meet_link text,
  ADD COLUMN meet_link_overridden boolean NOT NULL DEFAULT false,
  ADD COLUMN student_reschedule_count integer NOT NULL DEFAULT 0,
  ADD COLUMN reschedule_history_verified boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT ck_mgr06_meet CHECK(google_meet_link IS NULL OR google_meet_link ~ '^https://meet[.]google[.]com/[a-z]{3}-[a-z]{4}-[a-z]{3}$'),
  ADD CONSTRAINT ck_mgr06_reschedule_count CHECK(student_reschedule_count>=0);
-- Existing lessons keep their IDs and assignment links. Historical student transfer counts are not guessed:
-- reschedule_history_verified=false requires a specific director exception before student rescheduling.
CREATE INDEX lesson_occurrences_manager_subscription_id_idx ON lesson_occurrences(manager_subscription_id);
CREATE TABLE schedule_change_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES lesson_occurrences(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  lesson_version integer NOT NULL CHECK(lesson_version>=1),
  request_hash varchar(64) NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
  payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
  requested_by_id uuid NOT NULL REFERENCES staff_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  approved_by_id uuid REFERENCES staff_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  approved_at timestamptz(3),consumed_at timestamptz(3),
  source_operation_id uuid NOT NULL UNIQUE,
  created_at timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT uq_mgr06_change_request UNIQUE(lesson_id,lesson_version,request_hash),
  CONSTRAINT ck_mgr06_director_approval CHECK((approved_by_id IS NULL)=(approved_at IS NULL) AND (consumed_at IS NULL OR (approved_at IS NOT NULL AND approved_at<=consumed_at)))
);
CREATE INDEX schedule_change_approvals_requested_by_id_created_at_idx ON schedule_change_approvals(requested_by_id,created_at);
CREATE FUNCTION mgr06_approval_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF (to_jsonb(OLD)-ARRAY['approved_by_id','approved_at','consumed_at']) IS DISTINCT FROM
       (to_jsonb(NEW)-ARRAY['approved_by_id','approved_at','consumed_at']) OR OLD.consumed_at IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Schedule exception snapshot is immutable';
    END IF;
    IF OLD.approved_at IS NOT NULL AND (NEW.approved_at IS DISTINCT FROM OLD.approved_at OR NEW.approved_by_id IS DISTINCT FROM OLD.approved_by_id) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Director decision is immutable';
    END IF;
  END IF;
  IF NEW.approved_at IS NOT NULL THEN
    PERFORM public.t03_assert_director(NEW.approved_by_id,NEW.approved_at);
    IF NOT EXISTS(SELECT 1 FROM public.lesson_occurrences l WHERE l.id=NEW.lesson_id AND l.version=NEW.lesson_version AND l.status IN ('SCHEDULED','STAR_PENDING') AND l.scheduled_at>=NEW.approved_at AND l.actual_start_at IS NULL) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Schedule exception is stale';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_mgr06_approval BEFORE INSERT OR UPDATE ON schedule_change_approvals FOR EACH ROW EXECUTE FUNCTION mgr06_approval_guard();
CREATE FUNCTION mgr06_lesson_subscription_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.manager_subscription_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.manager_subscriptions s WHERE s.id=NEW.manager_subscription_id AND s.enrollment_id=NEW.enrollment_id) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Lesson subscription scope mismatch';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_mgr06_lesson_subscription BEFORE INSERT OR UPDATE ON lesson_occurrences FOR EACH ROW EXECUTE FUNCTION mgr06_lesson_subscription_guard();
GRANT SELECT,INSERT ON schedule_change_approvals TO online_school_runtime;
GRANT UPDATE(approved_by_id,approved_at,consumed_at) ON schedule_change_approvals TO online_school_runtime;
GRANT INSERT(manager_subscription_id,google_meet_link,meet_link_overridden,student_reschedule_count,reschedule_history_verified),
  UPDATE(manager_subscription_id,google_meet_link,meet_link_overridden,student_reschedule_count,reschedule_history_verified) ON lesson_occurrences TO online_school_runtime;
COMMIT;

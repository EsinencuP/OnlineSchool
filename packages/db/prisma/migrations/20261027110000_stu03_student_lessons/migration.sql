BEGIN;
ALTER TYPE "CrmTaskType" ADD VALUE IF NOT EXISTS 'RESCHEDULE_REQUEST';
ALTER TABLE student_accounts ADD COLUMN timezone text NOT NULL DEFAULT 'Europe/Chisinau';
ALTER TABLE lesson_outcome_reports ADD COLUMN student_no_show boolean NOT NULL DEFAULT false;
ALTER TABLE lesson_outcome_reports ADD CONSTRAINT ck_student_no_show_result
  CHECK (NOT student_no_show OR result='NOT_CONDUCTED');
ALTER TABLE crm_tasks ADD COLUMN lesson_id uuid, ADD COLUMN payload jsonb;
ALTER TABLE crm_tasks ADD CONSTRAINT fk_crm_task_lesson FOREIGN KEY(lesson_id) REFERENCES lesson_occurrences(id) ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE INDEX crm_tasks_lesson_id_idx ON crm_tasks(lesson_id);
-- Cast to text avoids using a newly-added enum value before this migration commits.
ALTER TABLE crm_tasks ADD CONSTRAINT ck_reschedule_task_payload CHECK (
  type::text <> 'RESCHEDULE_REQUEST' OR
  (student_id IS NOT NULL AND lesson_id IS NOT NULL AND payload IS NOT NULL
    AND jsonb_typeof(payload)='object' AND payload ?& ARRAY['reason','preferredDate']
    AND jsonb_typeof(payload->'reason')='string' AND length(btrim(payload->>'reason')) BETWEEN 1 AND 500
    AND jsonb_typeof(payload->'preferredDate')='string' AND (payload->>'preferredDate') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
);

CREATE FUNCTION stu03_check_student_timezone() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=NEW.timezone) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Invalid student timezone';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER stu03_student_timezone BEFORE INSERT OR UPDATE OF timezone ON student_accounts
  FOR EACH ROW EXECUTE FUNCTION stu03_check_student_timezone();

CREATE FUNCTION stu03_check_reschedule_task() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.type::text='RESCHEDULE_REQUEST' THEN
    IF NOT EXISTS(SELECT 1 FROM public.lesson_occurrences l JOIN public.student_subject_enrollments e ON e.id=l.enrollment_id
      WHERE l.id=NEW.lesson_id AND e.student_id=NEW.student_id) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Reschedule task student/lesson mismatch';
    END IF;
    PERFORM (NEW.payload->>'preferredDate')::date;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER stu03_reschedule_task BEFORE INSERT OR UPDATE ON crm_tasks
  FOR EACH ROW EXECUTE FUNCTION stu03_check_reschedule_task();
REVOKE ALL ON FUNCTION stu03_check_student_timezone(),stu03_check_reschedule_task() FROM PUBLIC;

COMMIT;

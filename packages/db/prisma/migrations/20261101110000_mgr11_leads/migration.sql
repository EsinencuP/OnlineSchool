ALTER TYPE "CrmTaskType" ADD VALUE IF NOT EXISTS 'LEAD_FOLLOWUP';
ALTER TYPE "CrmTaskType" ADD VALUE IF NOT EXISTS 'ASSIGN_TEACHER';
ALTER TYPE student_notification_type ADD VALUE IF NOT EXISTS 'TRIAL_SCHEDULED';
BEGIN;
CREATE TYPE "LeadAudience" AS ENUM ('CHILD','ADULT');
CREATE TYPE "LeadLostReason" AS ENUM ('NOT_INTERESTED','PRICE','NO_CONTACT','COMPETITOR','SCHEDULE_MISMATCH','TRIAL_NO_SHOW','OTHER');
CREATE TYPE "LessonKind" AS ENUM ('REGULAR','TRIAL');
ALTER TABLE lesson_occurrences ADD COLUMN kind "LessonKind" NOT NULL DEFAULT 'REGULAR',ADD COLUMN trial_started_at timestamptz(3),ADD COLUMN trial_lead_id uuid;
ALTER TABLE leads ADD COLUMN audience "LeadAudience" NOT NULL DEFAULT 'ADULT',
 ADD COLUMN guardian_name text, ADD COLUMN subject_id uuid REFERENCES subjects(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 ADD COLUMN grade integer, ADD COLUMN age_years integer, ADD COLUMN level text, ADD COLUMN comment text,
 ADD COLUMN lost_reason "LeadLostReason", ADD COLUMN lost_comment text,
 ADD COLUMN trial_lesson_id uuid UNIQUE REFERENCES lesson_occurrences(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 ADD COLUMN version integer NOT NULL DEFAULT 1,
 ADD COLUMN stage_changed_at timestamptz(3) NOT NULL DEFAULT now(), ADD COLUMN converted_at timestamptz(3), ADD COLUMN archived_student_at timestamptz(3);
-- Existing intake rows are preserved. New writes must always have a contact.
ALTER TABLE leads ADD CONSTRAINT mgr11_lead_contact CHECK(phone IS NOT NULL OR email IS NOT NULL) NOT VALID;
ALTER TABLE leads ADD CONSTRAINT mgr11_lead_brief CHECK(
 (audience<>'CHILD' OR (guardian_name IS NOT NULL AND length(trim(guardian_name))>=2)) AND (grade IS NULL OR grade BETWEEN 1 AND 11)
 AND (age_years IS NULL OR age_years BETWEEN 3 AND 99) AND version>0);
CREATE TABLE lead_stage_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),lead_id uuid NOT NULL REFERENCES leads(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 from_stage "LeadStage",to_stage "LeadStage" NOT NULL,actor text NOT NULL CHECK(actor IN('MANAGER','SYSTEM')),
 reason text,created_at timestamptz(3) NOT NULL DEFAULT now());
CREATE INDEX lead_stage_events_lead_id_created_at_id_idx ON lead_stage_events(lead_id,created_at,id);
CREATE INDEX mgr11_lead_queue ON leads(stage,created_at,id);
CREATE INDEX idx_mgr11_trial_source ON lesson_occurrences(trial_lead_id,scheduled_at);
ALTER TABLE crm_tasks ADD COLUMN system_resolved boolean NOT NULL DEFAULT false;
ALTER TABLE crm_tasks DROP CONSTRAINT ck_task_resolution;
ALTER TABLE crm_tasks ADD CONSTRAINT ck_task_resolution CHECK(
 (status='RESOLVED' AND resolved_at IS NOT NULL AND (
   (resolved_by_staff_id IS NOT NULL AND NOT system_resolved) OR
   (resolved_by_staff_id IS NULL AND system_resolved AND lead_id IS NOT NULL AND type::text IN('LEAD_FOLLOWUP','ASSIGN_TEACHER'))
 )) OR (status<>'RESOLVED' AND resolved_at IS NULL AND resolved_by_staff_id IS NULL AND NOT system_resolved));
ALTER TABLE crm_tasks ADD CONSTRAINT mgr11_lead_task_payload CHECK(type::text NOT IN('LEAD_FOLLOWUP','ASSIGN_TEACHER') OR
 (lead_id IS NOT NULL AND payload IS NOT NULL AND jsonb_typeof(payload)='object' AND coalesce(payload->>'kind'=type::text,false) AND coalesce(payload->>'leadId'=lead_id::text,false)));
ALTER TABLE lesson_occurrences ADD CONSTRAINT lesson_occurrences_trial_lead_id_fkey FOREIGN KEY(trial_lead_id) REFERENCES leads(id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE lesson_occurrences ADD CONSTRAINT mgr11_trial_finance CHECK(kind<>'TRIAL' OR (manager_subscription_id IS NULL AND actual_start_at IS NULL));
ALTER TABLE lesson_occurrences ADD CONSTRAINT mgr11_trial_source CHECK((kind='TRIAL')=(trial_lead_id IS NOT NULL) AND (kind='TRIAL' OR trial_started_at IS NULL));
CREATE FUNCTION mgr11_lesson_kind_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.kind<>OLD.kind OR NEW.trial_lead_id IS DISTINCT FROM OLD.trial_lead_id OR (OLD.trial_started_at IS NOT NULL AND NEW.trial_started_at IS DISTINCT FROM OLD.trial_started_at) THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Lesson kind and trial facts are immutable';
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER mgr11_lesson_kind_guard BEFORE UPDATE ON lesson_occurrences FOR EACH ROW EXECUTE FUNCTION mgr11_lesson_kind_guard();
CREATE FUNCTION mgr11_lead_trial_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.trial_lesson_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.trial_lesson_id IS DISTINCT FROM OLD.trial_lesson_id OR NEW.subject_id IS DISTINCT FROM OLD.subject_id) AND NOT EXISTS(
  SELECT 1 FROM lesson_occurrences l JOIN student_subject_enrollments e ON e.id=l.enrollment_id
  JOIN lead_student_links link ON link.student_id=e.student_id AND link.lead_id=NEW.id AND link.unlinked_at IS NULL
  WHERE l.id=NEW.trial_lesson_id AND l.kind='TRIAL' AND l.trial_lead_id=NEW.id AND e.subject_id=NEW.subject_id
 ) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Lead trial linkage mismatch';END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER mgr11_lead_trial_guard BEFORE INSERT OR UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION mgr11_lead_trial_guard();
ALTER TABLE notification_dispatches ALTER COLUMN student_id DROP NOT NULL;
ALTER TABLE notification_dispatches ADD COLUMN lead_id uuid REFERENCES leads(id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE notification_dispatches ADD CONSTRAINT mgr11_recipient CHECK(
 (student_id IS NOT NULL AND lead_id IS NULL) OR
 (student_id IS NULL AND lead_id IS NOT NULL AND channel='EMAIL' AND source_id IS NULL));
CREATE FUNCTION mgr11_no_trial_consumption() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM lesson_occurrences WHERE id=NEW.lesson_occurrence_id AND kind='TRIAL') THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Trial lessons cannot consume paid rights';
 END IF;
 RETURN NEW;
END;$$;
CREATE TRIGGER mgr11_no_trial_consumption BEFORE INSERT OR UPDATE ON entitlement_consumptions FOR EACH ROW EXECUTE FUNCTION mgr11_no_trial_consumption();
GRANT SELECT,INSERT ON lead_stage_events TO online_school_runtime;
GRANT SELECT,INSERT,UPDATE ON leads TO online_school_runtime;
GRANT SELECT,INSERT ON lead_student_links TO online_school_runtime;
GRANT INSERT(lead_id) ON assigned_managers TO online_school_runtime;
GRANT UPDATE(archived_at) ON students TO online_school_runtime;
GRANT INSERT(system_resolved),UPDATE(system_resolved) ON crm_tasks TO online_school_runtime;
COMMIT;

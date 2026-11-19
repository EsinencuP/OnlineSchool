-- DEV-07/B: manual, journaled hand-over of a student or lead to another manager (director only).
-- Staff lifecycle: deactivating a manager or teacher is a director decision with a recorded reason.
BEGIN;
CREATE TABLE manager_handovers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      uuid,
  lead_id         uuid,
  from_manager_id uuid,
  to_manager_id   uuid NOT NULL,
  by_director_id  uuid NOT NULL,
  comment         text,
  moved_tasks     integer NOT NULL DEFAULT 0,
  handed_over_at  timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_handover_subject CHECK (num_nonnulls(student_id, lead_id) = 1),
  CONSTRAINT ck_handover_distinct CHECK (from_manager_id IS DISTINCT FROM to_manager_id),
  CONSTRAINT ck_handover_comment CHECK (comment IS NULL OR char_length(comment) BETWEEN 3 AND 500),
  CONSTRAINT ck_handover_moved CHECK (moved_tasks >= 0),
  CONSTRAINT manager_handovers_student_id_fkey FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT manager_handovers_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT manager_handovers_from_fkey FOREIGN KEY (from_manager_id) REFERENCES staff_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT manager_handovers_to_fkey FOREIGN KEY (to_manager_id) REFERENCES staff_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT manager_handovers_director_fkey FOREIGN KEY (by_director_id) REFERENCES staff_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX idx_handovers_student ON manager_handovers (student_id, handed_over_at) WHERE student_id IS NOT NULL;
CREATE INDEX idx_handovers_lead ON manager_handovers (lead_id, handed_over_at) WHERE lead_id IS NOT NULL;
CREATE INDEX idx_handovers_to ON manager_handovers (to_manager_id, handed_over_at);
CREATE TRIGGER trg_dir04_handover_history BEFORE UPDATE OR DELETE ON manager_handovers
  FOR EACH ROW EXECUTE FUNCTION t03_immutable_record();

CREATE TABLE staff_status_changes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id       uuid,
  teacher_id     uuid,
  action         text NOT NULL,
  reason         text NOT NULL,
  by_director_id uuid NOT NULL,
  changed_at     timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT ck_status_change_subject CHECK (num_nonnulls(staff_id, teacher_id) = 1),
  CONSTRAINT ck_status_change_action CHECK (action IN ('DEACTIVATED','REACTIVATED')),
  CONSTRAINT ck_status_change_reason CHECK (char_length(reason) BETWEEN 3 AND 500),
  CONSTRAINT staff_status_changes_staff_fkey FOREIGN KEY (staff_id) REFERENCES staff_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT staff_status_changes_teacher_fkey FOREIGN KEY (teacher_id) REFERENCES teacher_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT staff_status_changes_director_fkey FOREIGN KEY (by_director_id) REFERENCES staff_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX idx_status_changes_staff ON staff_status_changes (staff_id, changed_at) WHERE staff_id IS NOT NULL;
CREATE INDEX idx_status_changes_teacher ON staff_status_changes (teacher_id, changed_at) WHERE teacher_id IS NOT NULL;
CREATE TRIGGER trg_dir04_status_history BEFORE UPDATE OR DELETE ON staff_status_changes
  FOR EACH ROW EXECUTE FUNCTION t03_immutable_record();


-- A hand-over re-addresses an open task without claiming it: OPEN -> OPEN is allowed when only the assignee changes.
CREATE OR REPLACE FUNCTION mgr07_task_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $task_guard$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF OLD.status::text IN ('RESOLVED','REJECTED','CANCELLED') THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Closed CRM task is immutable'; END IF;
  IF NEW.version<>OLD.version+1 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='CRM task version must increment'; END IF;
  IF ROW(NEW.id,NEW.student_id,NEW.lesson_id,NEW.type,NEW.created_at,NEW.payload) IS DISTINCT FROM ROW(OLD.id,OLD.student_id,OLD.lesson_id,OLD.type,OLD.created_at,OLD.payload) THEN
   RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='CRM task source snapshot is immutable';
  END IF;
  IF OLD.original_consumption_id IS NOT NULL AND NEW.original_consumption_id IS DISTINCT FROM OLD.original_consumption_id THEN
   RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Dispute source is immutable';
  END IF;
  IF (OLD.status='OPEN' AND NEW.status<>'IN_PROGRESS'
      AND NOT (NEW.status='OPEN' AND NEW.assigned_manager_id IS DISTINCT FROM OLD.assigned_manager_id))
    OR OLD.status='IN_PROGRESS' AND NEW.status::text NOT IN ('IN_PROGRESS','RESOLVED','REJECTED') THEN
   RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Invalid CRM task transition';
  END IF;
 END IF;
 IF NEW.lesson_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.lesson_occurrences l JOIN public.student_subject_enrollments e ON e.id=l.enrollment_id WHERE l.id=NEW.lesson_id AND e.student_id=NEW.student_id) THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='CRM lesson scope mismatch';
 END IF;
 IF NEW.original_consumption_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.entitlement_consumptions c JOIN public.subscriptions s ON s.id=c.subscription_id JOIN public.student_subject_enrollments e ON e.id=s.enrollment_id WHERE c.id=NEW.original_consumption_id AND c.lesson_occurrence_id=NEW.lesson_id AND e.student_id=NEW.student_id AND NEW.type='ATTENDANCE_DISPUTE') THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Dispute source scope mismatch';
 END IF;
 IF NEW.ledger_publication_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.ledger_entries reversal JOIN public.ledger_entries original ON original.id=reversal.reverses_entry_id JOIN public.ledger_documents d ON d.id=original.document_id JOIN public.entitlement_consumptions c ON c.id=d.consumption_id WHERE reversal.id=NEW.ledger_publication_id AND reversal.published_at IS NOT NULL AND c.id=NEW.original_consumption_id AND c.cancelled_at IS NOT NULL) THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Published matching reversal required';
 END IF;
 RETURN NEW;
END $task_guard$;

REVOKE ALL ON manager_handovers, staff_status_changes FROM PUBLIC;
GRANT SELECT, INSERT ON manager_handovers, staff_status_changes TO online_school_runtime;
GRANT UPDATE (ended_at, updated_at) ON assigned_managers TO online_school_runtime;
GRANT UPDATE (deactivated_at, updated_at) ON teacher_accounts, staff_accounts TO online_school_runtime;
COMMIT;

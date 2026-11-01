-- Enum additions precede the transaction so new values are usable on PostgreSQL.
ALTER TYPE "CrmTaskStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "CrmTaskType" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_EXPIRING';
BEGIN;
ALTER TABLE crm_tasks
 ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK(version>=1),
 ADD COLUMN escalated_at timestamptz(3),
 ADD COLUMN decision jsonb,
 ADD COLUMN original_consumption_id uuid REFERENCES entitlement_consumptions(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 ADD COLUMN ledger_publication_id uuid UNIQUE REFERENCES ledger_entries(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 ADD COLUMN dispute_resolution_key text UNIQUE,
 ADD CONSTRAINT ck_mgr07_resolution_key CHECK(dispute_resolution_key IS NULL OR (type='ATTENDANCE_DISPUTE' AND dispute_resolution_key='dispute:'||id::text)),
 ADD CONSTRAINT ck_mgr07_resolution_publication CHECK(ledger_publication_id IS NULL OR (type='ATTENDANCE_DISPUTE' AND status='RESOLVED' AND original_consumption_id IS NOT NULL AND dispute_resolution_key IS NOT NULL));
CREATE INDEX idx_mgr07_task_queue ON crm_tasks(due_at,id);
-- Existing payloads, due dates, statuses and IDs are preserved. Legacy source references are not guessed.
CREATE FUNCTION mgr07_task_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
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
  IF OLD.status='OPEN' AND NEW.status<>'IN_PROGRESS' OR OLD.status='IN_PROGRESS' AND NEW.status::text NOT IN ('IN_PROGRESS','RESOLVED','REJECTED') THEN
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
END $$;
CREATE TRIGGER trg_mgr07_task BEFORE INSERT OR UPDATE ON crm_tasks FOR EACH ROW EXECUTE FUNCTION mgr07_task_guard();
GRANT INSERT(version,escalated_at,decision,original_consumption_id,ledger_publication_id,dispute_resolution_key),UPDATE(version,escalated_at,decision,original_consumption_id,ledger_publication_id,dispute_resolution_key) ON crm_tasks TO online_school_runtime;
COMMIT;

ALTER TYPE student_notification_type ADD VALUE IF NOT EXISTS 'LESSON_SCHEDULED';
ALTER TYPE student_notification_type ADD VALUE IF NOT EXISTS 'RESCHEDULE_DECLINED';
ALTER TYPE student_notification_type ADD VALUE IF NOT EXISTS 'DISPUTE_ACCEPTED';
ALTER TYPE student_notification_type ADD VALUE IF NOT EXISTS 'DISPUTE_REJECTED';
ALTER TYPE student_notification_type ADD VALUE IF NOT EXISTS 'MANUAL_MESSAGE';
BEGIN;
CREATE TYPE "NotificationChannel" AS ENUM('IN_APP','EMAIL');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM('QUEUED','SENT','FAILED');
ALTER TABLE students ADD COLUMN notification_locale text NOT NULL DEFAULT 'ru';
CREATE TABLE notification_dispatches(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),student_id uuid NOT NULL REFERENCES students(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 manager_id uuid REFERENCES staff_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 channel "NotificationChannel" NOT NULL,template_code student_notification_type NOT NULL,locale text NOT NULL DEFAULT 'ru',variables jsonb NOT NULL,
 dedupe_key text NOT NULL UNIQUE,status "NotificationDeliveryStatus" NOT NULL DEFAULT 'QUEUED',recipient_email text,subject text NOT NULL,body text NOT NULL,
 source_id uuid UNIQUE REFERENCES student_notification_sources(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,sent_at timestamptz(3),first_attempt_at timestamptz(3),failure_reason text,provider_reference text,
 CONSTRAINT ck_mgr08_dispatch CHECK(jsonb_typeof(variables)='object' AND length(dedupe_key) BETWEEN 1 AND 250 AND length(subject) BETWEEN 1 AND 150 AND length(body) BETWEEN 1 AND 2000
  AND locale IN('ru','en') AND (sent_at IS NOT NULL)=(status='SENT') AND (failure_reason IS NOT NULL)=(status='FAILED')
  AND (channel='EMAIL' OR recipient_email IS NULL) AND (channel='IN_APP' OR source_id IS NULL)
  AND (sent_at IS NULL OR sent_at>=created_at) AND (first_attempt_at IS NULL OR first_attempt_at>=created_at)
  AND (status='FAILED' OR channel='IN_APP' AND source_id IS NOT NULL OR channel='EMAIL' AND recipient_email IS NOT NULL))
);
CREATE INDEX idx_mgr08_dispatch_student ON notification_dispatches(student_id,created_at,id);
CREATE INDEX idx_mgr08_manual_rate ON notification_dispatches(manager_id,student_id,created_at);
-- Keep every old source guard. Only the added types and receipt-contact variant
-- use the new guard; allocation notices retain their original recipient checks.
DROP TRIGGER trg_stu10_source ON student_notification_sources;
CREATE TRIGGER trg_stu10_source BEFORE INSERT OR UPDATE ON student_notification_sources FOR EACH ROW
 WHEN(NEW.type::text NOT IN('LESSON_SCHEDULED','RESCHEDULE_DECLINED','DISPUTE_ACCEPTED','DISPUTE_REJECTED','MANUAL_MESSAGE') AND NOT(NEW.type::text='PAYMENT_CONFIRMED' AND NEW.payload ? 'receiptOnly')) EXECUTE FUNCTION stu10_guard_source();
CREATE FUNCTION mgr08_guard_source() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE valid boolean=false;keys text[];
BEGIN
 IF TG_OP='UPDATE' THEN
  IF (NEW.id,NEW.student_id,NEW.type,NEW.event_key,NEW.payload,NEW.occurred_at) IS DISTINCT FROM (OLD.id,OLD.student_id,OLD.type,OLD.event_key,OLD.payload,OLD.occurred_at)
   OR OLD.delivered_at IS NOT NULL OR NEW.delivered_at IS NULL OR NEW.delivered_at>clock_timestamp()
   OR NOT EXISTS(SELECT 1 FROM public.student_notifications n WHERE n.id=NEW.id AND n.student_id=NEW.student_id) THEN
   RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Notification source and receipt are immutable';
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.delivered_at IS NOT NULL OR NEW.occurred_at>clock_timestamp() THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Notification must reference a current fact';END IF;
 CASE NEW.type::text
 WHEN 'LESSON_SCHEDULED' THEN
  keys=ARRAY['lessonId'];
  SELECT EXISTS(SELECT 1 FROM public.lesson_occurrences l JOIN public.student_subject_enrollments e ON e.id=l.enrollment_id WHERE l.id=(NEW.payload->>'lessonId')::uuid AND e.student_id=NEW.student_id AND NEW.event_key='lesson:'||l.id::text||':'||l.version::text||':LESSON_SCHEDULED') INTO valid;
 WHEN 'MANUAL_MESSAGE' THEN
  keys=ARRAY['body'];
  SELECT EXISTS(SELECT 1 FROM public.assigned_managers a JOIN public.staff_accounts s ON s.id=a.manager_id WHERE a.student_id=NEW.student_id AND a.manager_id=split_part(NEW.event_key,':',2)::uuid AND a.assigned_at<=NEW.occurred_at AND (a.ended_at IS NULL OR a.ended_at>NEW.occurred_at) AND s.deactivated_at IS NULL AND NEW.event_key LIKE 'manual:%' AND split_part(NEW.event_key,':',3)=NEW.student_id::text) INTO valid;
 WHEN 'PAYMENT_CONFIRMED' THEN
  keys=ARRAY['paymentId','receiptOnly'];
  SELECT EXISTS(SELECT 1 FROM public.payment_receipts p WHERE p.id=(NEW.payload->>'paymentId')::uuid AND p.student_id=NEW.student_id AND p.confirmed_by_director_at<=NEW.occurred_at AND p.confirmed_by_director_id IS NOT NULL AND NEW.payload->>'receiptOnly'='true' AND NEW.event_key='receipt-confirmed:'||p.id::text) INTO valid;
 ELSE
  keys=ARRAY['taskId','lessonId'];
  SELECT EXISTS(SELECT 1 FROM public.crm_tasks t WHERE t.id=(NEW.payload->>'taskId')::uuid AND t.student_id=NEW.student_id AND t.lesson_id=(NEW.payload->>'lessonId')::uuid
   AND NEW.event_key='task:'||t.id::text||':'||NEW.type::text
   AND ((NEW.type::text='RESCHEDULE_DECLINED' AND t.type='RESCHEDULE_REQUEST' AND t.status::text='REJECTED')
    OR(NEW.type::text='DISPUTE_REJECTED' AND t.type='ATTENDANCE_DISPUTE' AND t.status::text='REJECTED')
    OR(NEW.type::text='DISPUTE_ACCEPTED' AND t.type='ATTENDANCE_DISPUTE' AND t.status::text='RESOLVED' AND t.ledger_publication_id IS NOT NULL))) INTO valid;
 END CASE;
 IF NOT coalesce(valid,false) OR NEW.payload-keys<>'{}'::jsonb OR NOT NEW.payload ?& keys
  OR EXISTS(SELECT 1 FROM jsonb_each(NEW.payload) kv WHERE jsonb_typeof(kv.value)<>'string') THEN
  RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Notification must reference its own public fact and exact variables';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_mgr08_source BEFORE INSERT OR UPDATE ON student_notification_sources FOR EACH ROW
 WHEN(NEW.type::text IN('LESSON_SCHEDULED','RESCHEDULE_DECLINED','DISPUTE_ACCEPTED','DISPUTE_REJECTED','MANUAL_MESSAGE') OR NEW.type::text='PAYMENT_CONFIRMED' AND NEW.payload ? 'receiptOnly') EXECUTE FUNCTION mgr08_guard_source();
CREATE FUNCTION mgr08_dispatch_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.status='SENT' OR NEW.sent_at IS NOT NULL OR NEW.first_attempt_at IS NOT NULL OR NEW.provider_reference IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Notification starts as a queued intent';END IF;
 ELSIF OLD.status<>'QUEUED' OR ROW(NEW.id,NEW.student_id,NEW.manager_id,NEW.channel,NEW.template_code,NEW.locale,NEW.variables,NEW.dedupe_key,NEW.recipient_email,NEW.subject,NEW.body,NEW.source_id,NEW.created_at) IS DISTINCT FROM ROW(OLD.id,OLD.student_id,OLD.manager_id,OLD.channel,OLD.template_code,OLD.locale,OLD.variables,OLD.dedupe_key,OLD.recipient_email,OLD.subject,OLD.body,OLD.source_id,OLD.created_at)
  OR OLD.first_attempt_at IS NOT NULL AND NEW.first_attempt_at IS DISTINCT FROM OLD.first_attempt_at THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Notification content and terminal result are immutable';
 END IF;
 IF NEW.source_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.student_notification_sources s WHERE s.id=NEW.source_id AND s.student_id=NEW.student_id AND s.type=NEW.template_code AND s.payload=NEW.variables) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Notification source scope mismatch';END IF;
 IF NEW.status='SENT' AND NEW.channel='IN_APP' AND NOT EXISTS(SELECT 1 FROM public.student_notifications n WHERE n.id=NEW.source_id AND n.student_id=NEW.student_id) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Inbox receipt required';END IF;
 IF NEW.status='SENT' AND NEW.channel='EMAIL' AND (NEW.first_attempt_at IS NULL OR NEW.provider_reference IS NULL) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Provider receipt required';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_mgr08_dispatch BEFORE INSERT OR UPDATE ON notification_dispatches FOR EACH ROW EXECUTE FUNCTION mgr08_dispatch_guard();
CREATE TRIGGER trg_mgr08_dispatch_no_delete BEFORE DELETE ON notification_dispatches FOR EACH ROW EXECUTE FUNCTION t03_immutable_record();
GRANT SELECT,INSERT,UPDATE ON notification_dispatches TO online_school_runtime;
REVOKE DELETE,TRUNCATE ON notification_dispatches FROM online_school_runtime;
GRANT UPDATE(notification_locale) ON students TO online_school_runtime;
COMMIT;

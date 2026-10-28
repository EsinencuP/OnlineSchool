BEGIN;
CREATE TYPE student_notification_type AS ENUM ('HOMEWORK_REVIEWED','HOMEWORK_NEEDS_REVISION','LESSON_RESCHEDULED','LESSON_CANCELLED','REPORT_READY','SUBSCRIPTION_EXPIRING','PAYMENT_CONFIRMED');
CREATE TABLE student_notification_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),student_id uuid NOT NULL,type student_notification_type NOT NULL,
  event_key text NOT NULL UNIQUE,payload jsonb NOT NULL,occurred_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,delivered_at timestamptz(3),
  CONSTRAINT student_notification_sources_student_id_fkey FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT student_notification_sources_id_student_id_key UNIQUE(id,student_id),
  CONSTRAINT ck_stu10_source CHECK(jsonb_typeof(payload)='object' AND length(event_key) BETWEEN 1 AND 250 AND (delivered_at IS NULL OR delivered_at>=occurred_at))
);
CREATE INDEX student_notification_sources_delivered_at_occurred_at_id_idx ON student_notification_sources(delivered_at,occurred_at,id);
CREATE INDEX idx_stu10_delivery_due ON student_notification_sources(occurred_at,id) WHERE delivered_at IS NULL;
CREATE TABLE student_notifications (
  id uuid PRIMARY KEY,student_id uuid NOT NULL,type student_notification_type NOT NULL,title text NOT NULL,body text NOT NULL,
  payload jsonb NOT NULL,created_at timestamptz(3) NOT NULL,read_at timestamptz(3),archived_at timestamptz(3),
  CONSTRAINT student_notifications_student_id_fkey FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT student_notifications_id_student_id_key UNIQUE(id,student_id),
  CONSTRAINT student_notifications_id_student_id_fkey FOREIGN KEY(id,student_id) REFERENCES student_notification_sources(id,student_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_stu10_notification CHECK(jsonb_typeof(payload)='object' AND length(title) BETWEEN 1 AND 200 AND length(body)<=2000
    AND (read_at IS NULL OR read_at>=created_at) AND (archived_at IS NULL OR archived_at>=created_at))
);
CREATE INDEX student_notifications_student_id_archived_at_created_at_id_idx ON student_notifications(student_id,archived_at,created_at,id);
CREATE INDEX idx_stu10_student_read ON student_notifications(student_id,read_at,archived_at,created_at);
CREATE INDEX idx_stu10_unread ON student_notifications(student_id,created_at) WHERE read_at IS NULL AND archived_at IS NULL;
CREATE INDEX idx_stu10_expiry ON subscriptions(valid_to,id) WHERE valid_to IS NOT NULL;

CREATE FUNCTION stu10_guard_source() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE valid boolean=false;keys text[];
BEGIN
  IF TG_OP='UPDATE' THEN
    IF (NEW.id,NEW.student_id,NEW.type,NEW.event_key,NEW.payload,NEW.occurred_at) IS DISTINCT FROM
       (OLD.id,OLD.student_id,OLD.type,OLD.event_key,OLD.payload,OLD.occurred_at) OR OLD.delivered_at IS NOT NULL OR NEW.delivered_at IS NULL
       OR NEW.delivered_at>clock_timestamp() OR NOT EXISTS(SELECT 1 FROM public.student_notifications n WHERE n.id=NEW.id AND n.student_id=NEW.student_id) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Notification event and delivery receipt are immutable';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.delivered_at IS NOT NULL OR NEW.occurred_at>clock_timestamp() THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Notification event must be a current committed fact';
  END IF;
  CASE NEW.type
  WHEN 'HOMEWORK_REVIEWED','HOMEWORK_NEEDS_REVISION' THEN
    keys=ARRAY['homeworkId','reviewId'];
    SELECT EXISTS(SELECT 1 FROM public.submission_reviews r JOIN public.homework_submissions s ON s.id=r.submission_id
      WHERE r.id=(NEW.payload->>'reviewId')::uuid AND s.delivery_id=(NEW.payload->>'homeworkId')::uuid AND s.student_id=NEW.student_id
      AND r.reviewed_at<=NEW.occurred_at AND NEW.event_key='review:'||r.id::text
      AND NEW.type::text=CASE WHEN r.result='ACCEPTED' THEN 'HOMEWORK_REVIEWED' ELSE 'HOMEWORK_NEEDS_REVISION' END) INTO valid;
  WHEN 'REPORT_READY' THEN
    keys=ARRAY['reportId'];
    SELECT EXISTS(SELECT 1 FROM public.education_reports r JOIN public.progress_checkpoints cp ON cp.id=r.checkpoint_id
      JOIN public.student_subject_enrollments e ON e.id=cp.enrollment_id WHERE r.id=(NEW.payload->>'reportId')::uuid
      AND e.student_id=NEW.student_id AND cp.type='LESSON_8' AND r.status='PUBLISHED' AND r.published_at<=NEW.occurred_at
      AND r.confirmed_lesson_count_snapshot=8 AND NEW.event_key='report:'||r.id::text) INTO valid;
  WHEN 'LESSON_RESCHEDULED','LESSON_CANCELLED' THEN
    keys=ARRAY['lessonId'];
    SELECT EXISTS(SELECT 1 FROM public.lesson_occurrences l JOIN public.student_subject_enrollments e ON e.id=l.enrollment_id
      WHERE l.id=(NEW.payload->>'lessonId')::uuid AND e.student_id=NEW.student_id
        AND NEW.event_key='lesson:'||l.id::text||':'||l.version::text||':'||NEW.type::text
        AND (NEW.type='LESSON_RESCHEDULED' OR l.status='CANCELLED')) INTO valid;
  WHEN 'PAYMENT_CONFIRMED' THEN
    keys=ARRAY['paymentId','distributionId','subscriptionId'];
    SELECT EXISTS(SELECT 1 FROM public.payment_distributions d JOIN public.payment_receipts p ON p.id=d.payment_id
      JOIN public.subscriptions s ON s.id=d.subscription_id JOIN public.student_subject_enrollments e ON e.id=s.enrollment_id
      WHERE d.id=(NEW.payload->>'distributionId')::uuid AND d.payment_id=(NEW.payload->>'paymentId')::uuid
      AND s.id=(NEW.payload->>'subscriptionId')::uuid AND e.student_id=NEW.student_id AND d.approved_at<=NEW.occurred_at
      AND d.approved_by_director_id IS NOT NULL AND p.confirmed_by_director_at<=NEW.occurred_at AND p.confirmed_by_director_id IS NOT NULL
      AND NEW.event_key='payment-allocation:'||d.id::text) INTO valid;
  WHEN 'SUBSCRIPTION_EXPIRING' THEN
    keys=ARRAY['subscriptionId','daysBefore','expiresAt'];
    IF jsonb_typeof(NEW.payload->'daysBefore') IS DISTINCT FROM 'number'
      OR (NEW.payload->>'expiresAt') !~ '^\d{4}-\d\d-\d\dT' THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Expiry event needs numeric threshold and ISO timestamp';
    END IF;
    SELECT EXISTS(SELECT 1 FROM public.subscriptions s JOIN public.student_subject_enrollments e ON e.id=s.enrollment_id
      JOIN public.student_accounts a ON a.student_id=e.student_id AND a.deactivated_at IS NULL
      WHERE s.id=(NEW.payload->>'subscriptionId')::uuid AND e.student_id=NEW.student_id AND s.valid_from<=NEW.occurred_at
        AND s.valid_to=(NEW.payload->>'expiresAt')::timestamptz AND s.valid_to>NEW.occurred_at
        AND (NEW.payload->>'daysBefore')::int IN(7,3)
        AND (s.valid_to AT TIME ZONE a.timezone)::date-(NEW.occurred_at AT TIME ZONE a.timezone)::date=(NEW.payload->>'daysBefore')::int
        AND NEW.event_key='subscription-expiry:'||s.id::text||':'||(extract(epoch FROM s.valid_to)*1000)::bigint::text||':'||(NEW.payload->>'daysBefore')) INTO valid;
  END CASE;
  IF NOT coalesce(valid,false) OR NEW.payload-keys<>'{}'::jsonb OR NOT NEW.payload ?& keys THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Notification event must reference its own public business fact';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_stu10_source BEFORE INSERT OR UPDATE ON student_notification_sources FOR EACH ROW EXECUTE FUNCTION stu10_guard_source();
CREATE TRIGGER trg_stu10_source_no_delete BEFORE DELETE ON student_notification_sources FOR EACH ROW EXECUTE FUNCTION t03_immutable_record();

CREATE FUNCTION stu10_guard_notification() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.read_at IS NOT NULL OR NEW.archived_at IS NOT NULL OR NOT EXISTS(SELECT 1 FROM public.student_notification_sources s
      WHERE s.id=NEW.id AND s.student_id=NEW.student_id AND s.type=NEW.type AND s.payload=NEW.payload AND s.occurred_at=NEW.created_at) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Inbox must derive from its canonical pupil event';
    END IF;
  ELSIF (NEW.id,NEW.student_id,NEW.type,NEW.title,NEW.body,NEW.payload,NEW.created_at) IS DISTINCT FROM
    (OLD.id,OLD.student_id,OLD.type,OLD.title,OLD.body,OLD.payload,OLD.created_at)
    OR (OLD.read_at IS NOT NULL AND NEW.read_at IS DISTINCT FROM OLD.read_at)
    OR (OLD.archived_at IS NOT NULL AND NEW.archived_at IS DISTINCT FROM OLD.archived_at)
    OR NEW.read_at>clock_timestamp() OR NEW.archived_at>clock_timestamp() THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Notification content, first read and archive are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_stu10_notification BEFORE INSERT OR UPDATE ON student_notifications FOR EACH ROW EXECUTE FUNCTION stu10_guard_notification();
CREATE TRIGGER trg_stu10_notification_no_delete BEFORE DELETE ON student_notifications FOR EACH ROW EXECUTE FUNCTION t03_immutable_record();

CREATE FUNCTION stu10_capture_education() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_TABLE_NAME='submission_reviews' THEN
    INSERT INTO public.student_notification_sources(student_id,type,event_key,payload,occurred_at)
      SELECT s.student_id,CASE WHEN NEW.result='ACCEPTED' THEN 'HOMEWORK_REVIEWED'::public.student_notification_type ELSE 'HOMEWORK_NEEDS_REVISION'::public.student_notification_type END,
      'review:'||NEW.id::text,jsonb_build_object('homeworkId',s.delivery_id,'reviewId',NEW.id),date_trunc('milliseconds',clock_timestamp())
      FROM public.homework_submissions s WHERE s.id=NEW.submission_id ON CONFLICT(event_key) DO NOTHING;
  ELSIF NEW.status='PUBLISHED' THEN
    INSERT INTO public.student_notification_sources(student_id,type,event_key,payload,occurred_at)
      SELECT e.student_id,'REPORT_READY','report:'||NEW.id::text,jsonb_build_object('reportId',NEW.id),date_trunc('milliseconds',clock_timestamp())
      FROM public.progress_checkpoints cp JOIN public.student_subject_enrollments e ON e.id=cp.enrollment_id
      WHERE cp.id=NEW.checkpoint_id ON CONFLICT(event_key) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_stu10_review AFTER INSERT ON submission_reviews FOR EACH ROW EXECUTE FUNCTION stu10_capture_education();
CREATE TRIGGER trg_stu10_report AFTER INSERT OR UPDATE OF status ON education_reports FOR EACH ROW EXECUTE FUNCTION stu10_capture_education();

CREATE FUNCTION stu10_capture_lesson() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE kind public.student_notification_type;
BEGIN
  IF NEW.status='CANCELLED' AND OLD.status IS DISTINCT FROM NEW.status THEN kind='LESSON_CANCELLED';
  ELSIF NEW.status<>'CANCELLED' AND (NEW.scheduled_at,NEW.scheduled_end_at) IS DISTINCT FROM (OLD.scheduled_at,OLD.scheduled_end_at) THEN kind='LESSON_RESCHEDULED';
  ELSE RETURN NEW; END IF;
  INSERT INTO public.student_notification_sources(student_id,type,event_key,payload,occurred_at)
    SELECT e.student_id,kind,'lesson:'||NEW.id::text||':'||NEW.version::text||':'||kind::text,jsonb_build_object('lessonId',NEW.id),date_trunc('milliseconds',clock_timestamp())
    FROM public.student_subject_enrollments e WHERE e.id=NEW.enrollment_id ON CONFLICT(event_key) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_stu10_lesson AFTER UPDATE OF status,scheduled_at,scheduled_end_at ON lesson_occurrences FOR EACH ROW EXECUTE FUNCTION stu10_capture_lesson();

CREATE FUNCTION stu10_queue_payment(payment uuid) RETURNS void LANGUAGE sql SET search_path=pg_catalog,public AS $$
  INSERT INTO public.student_notification_sources(student_id,type,event_key,payload,occurred_at)
    SELECT e.student_id,'PAYMENT_CONFIRMED','payment-allocation:'||d.id::text,
      jsonb_build_object('paymentId',p.id,'distributionId',d.id,'subscriptionId',s.id),date_trunc('milliseconds',clock_timestamp())
    FROM public.payment_distributions d JOIN public.payment_receipts p ON p.id=d.payment_id
    JOIN public.subscriptions s ON s.id=d.subscription_id JOIN public.student_subject_enrollments e ON e.id=s.enrollment_id
    WHERE p.id=payment AND p.confirmed_by_director_id IS NOT NULL AND p.confirmed_by_director_at<=clock_timestamp()
      AND d.approved_by_director_id IS NOT NULL AND d.approved_at<=clock_timestamp() ON CONFLICT(event_key) DO NOTHING;
$$;
CREATE FUNCTION stu10_capture_payment() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_TABLE_NAME='payment_receipts' THEN PERFORM public.stu10_queue_payment(NEW.id);
  ELSE PERFORM public.stu10_queue_payment(NEW.payment_id); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_stu10_payment AFTER INSERT OR UPDATE OF confirmed_by_director_at ON payment_receipts FOR EACH ROW EXECUTE FUNCTION stu10_capture_payment();
CREATE TRIGGER trg_stu10_allocation AFTER INSERT OR UPDATE OF approved_at ON payment_distributions FOR EACH ROW EXECUTE FUNCTION stu10_capture_payment();
GRANT SELECT,INSERT,UPDATE ON student_notification_sources,student_notifications TO online_school_runtime;
REVOKE DELETE,TRUNCATE ON student_notification_sources,student_notifications FROM online_school_runtime;
COMMIT;

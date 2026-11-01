ALTER TYPE student_notification_type ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_CREATED';
ALTER TYPE student_notification_type ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_RENEWED';
ALTER TYPE student_notification_type ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_FROZEN';
ALTER TYPE student_notification_type ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_UNFROZEN';
ALTER TYPE student_notification_type ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_EXPIRED';
BEGIN;
-- No historical price, right, payment or tariff duration is fabricated or rewritten.
ALTER TABLE sale_conditions ADD COLUMN duration_days integer CHECK(duration_days>0);
CREATE TYPE manager_subscription_status AS ENUM('ACTIVE','FROZEN','EXPIRED','CANCELLED');
CREATE TYPE manager_subscription_operation_type AS ENUM('CREATE','RENEW','FREEZE','UNFREEZE','EXPIRE');
CREATE TYPE manager_freeze_reason AS ENUM('ILLNESS','TRAVEL','FAMILY','OTHER');
CREATE TABLE manager_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES student_subject_enrollments(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  current_plan_id uuid NOT NULL REFERENCES sale_conditions(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  status manager_subscription_status NOT NULL DEFAULT 'ACTIVE',
  starts_at timestamptz(3) NOT NULL,ends_at timestamptz(3) NOT NULL,
  freeze_days_used integer NOT NULL DEFAULT 0 CHECK(freeze_days_used>=0),timezone text NOT NULL,
  created_at timestamptz(3) NOT NULL DEFAULT now(),updated_at timestamptz(3) NOT NULL DEFAULT now(),
  CHECK(ends_at>starts_at)
);
CREATE INDEX manager_subscriptions_enrollment_id_idx ON manager_subscriptions(enrollment_id);
CREATE INDEX idx_mgr04_subscription_expiry ON manager_subscriptions(status,ends_at,id);
CREATE UNIQUE INDEX uq_mgr04_active_enrollment ON manager_subscriptions(enrollment_id) WHERE status IN('ACTIVE','FROZEN');
CREATE TABLE manager_subscription_periods (
  financial_subscription_id uuid PRIMARY KEY REFERENCES subscriptions(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  manager_subscription_id uuid NOT NULL REFERENCES manager_subscriptions(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  created_at timestamptz(3) NOT NULL DEFAULT now()
);
CREATE INDEX manager_subscription_periods_manager_subscription_id_idx ON manager_subscription_periods(manager_subscription_id);
CREATE TABLE manager_subscription_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES manager_subscriptions(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  type manager_subscription_operation_type NOT NULL,
  distribution_id uuid REFERENCES payment_distributions(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ledger_publication_id uuid REFERENCES ledger_entries(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  payload jsonb NOT NULL,created_by_manager_id uuid REFERENCES staff_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  source_operation_id uuid NOT NULL,created_at timestamptz(3) NOT NULL DEFAULT now(),
  CHECK((type IN('CREATE','RENEW') AND distribution_id IS NOT NULL AND ledger_publication_id IS NOT NULL)
    OR (type NOT IN('CREATE','RENEW') AND distribution_id IS NULL AND ledger_publication_id IS NULL)),
  CHECK(created_by_manager_id IS NOT NULL OR type IN('UNFREEZE','EXPIRE'))
);
CREATE UNIQUE INDEX manager_subscription_operations_distribution_id_key ON manager_subscription_operations(distribution_id);
CREATE INDEX manager_subscription_operations_subscription_id_created_at_idx ON manager_subscription_operations(subscription_id,created_at);
CREATE TABLE subscription_freezes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES manager_subscriptions(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  starts_on date NOT NULL,ends_on date NOT NULL,actual_ends_on date,
  starts_at timestamptz(3) NOT NULL,ends_at timestamptz(3) NOT NULL,actual_ends_at timestamptz(3),
  reason manager_freeze_reason NOT NULL,comment text CHECK(length(comment)<=500),created_at timestamptz(3) NOT NULL DEFAULT now(),
  CHECK(ends_on>starts_on AND ends_at>starts_at),
  CHECK((actual_ends_on IS NULL AND actual_ends_at IS NULL) OR
    (actual_ends_on IS NOT NULL AND actual_ends_at IS NOT NULL AND actual_ends_on BETWEEN starts_on AND ends_on AND actual_ends_at BETWEEN starts_at AND ends_at))
);
CREATE INDEX subscription_freezes_subscription_id_starts_on_idx ON subscription_freezes(subscription_id,starts_on);
CREATE INDEX subscription_freezes_actual_ends_on_ends_on_idx ON subscription_freezes(actual_ends_on,ends_on);
CREATE UNIQUE INDEX uq_mgr04_open_freeze ON subscription_freezes(subscription_id) WHERE actual_ends_on IS NULL;
CREATE TRIGGER trg_mgr04_period_immutable BEFORE UPDATE OR DELETE ON manager_subscription_periods FOR EACH ROW EXECUTE FUNCTION t03_immutable_record();
CREATE TRIGGER trg_mgr04_operation_immutable BEFORE UPDATE OR DELETE ON manager_subscription_operations FOR EACH ROW EXECUTE FUNCTION t03_immutable_record();
CREATE FUNCTION mgr04_period_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.manager_subscriptions root JOIN public.subscriptions financial ON financial.enrollment_id=root.enrollment_id
    WHERE root.id=NEW.manager_subscription_id AND financial.id=NEW.financial_subscription_id) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Financial period must belong to the same enrollment';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_mgr04_period_guard BEFORE INSERT ON manager_subscription_periods FOR EACH ROW EXECUTE FUNCTION mgr04_period_guard();
CREATE FUNCTION mgr04_operation_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.type IN('CREATE','RENEW') AND NOT EXISTS(
    WITH RECURSIVE docs AS (
      SELECT d.id,d.correction_of_document_id,d.distribution_id FROM public.ledger_entries e JOIN public.ledger_documents d ON d.id=e.document_id
        WHERE e.id=NEW.ledger_publication_id AND e.published_at<=NEW.created_at AND e.effective_at<=NEW.created_at AND e.reverses_entry_id IS NULL
          AND NOT EXISTS(SELECT 1 FROM public.ledger_entries rev WHERE rev.reverses_entry_id=e.id AND rev.published_at<=NEW.created_at)
      UNION ALL SELECT parent.id,parent.correction_of_document_id,parent.distribution_id FROM public.ledger_documents parent
        JOIN docs child ON child.correction_of_document_id=parent.id
    ) SELECT 1 FROM docs JOIN public.payment_distributions d ON d.id=docs.distribution_id
      JOIN public.manager_subscription_periods p ON p.financial_subscription_id=d.subscription_id
      JOIN public.payment_receipts receipt ON receipt.id=d.payment_id
      WHERE d.id=NEW.distribution_id AND p.manager_subscription_id=NEW.subscription_id
        AND d.approved_at<=NEW.created_at AND receipt.confirmed_by_director_at<=NEW.created_at
  ) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Operation requires its own published approved distribution'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_mgr04_operation_guard BEFORE INSERT ON manager_subscription_operations FOR EACH ROW EXECUTE FUNCTION mgr04_operation_guard();
CREATE FUNCTION mgr04_root_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF ROW(NEW.id,NEW.enrollment_id,NEW.starts_at,NEW.timezone,NEW.created_at) IS DISTINCT FROM ROW(OLD.id,OLD.enrollment_id,OLD.starts_at,OLD.timezone,OLD.created_at)
    OR NEW.freeze_days_used<OLD.freeze_days_used THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Managed subscription identity and elapsed freeze history are immutable';
  END IF;
  IF NEW.status<>OLD.status AND NOT ((OLD.status='ACTIVE' AND NEW.status IN('FROZEN','EXPIRED'))
    OR (OLD.status='FROZEN' AND NEW.status='ACTIVE') OR (OLD.status='EXPIRED' AND NEW.status='ACTIVE')) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Invalid subscription transition';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_mgr04_root_guard BEFORE UPDATE ON manager_subscriptions FOR EACH ROW EXECUTE FUNCTION mgr04_root_guard();
CREATE FUNCTION mgr04_freeze_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Freeze history is immutable'; END IF;
  IF ROW(NEW.id,NEW.subscription_id,NEW.starts_on,NEW.ends_on,NEW.starts_at,NEW.ends_at,NEW.reason,NEW.comment,NEW.created_at)
    IS DISTINCT FROM ROW(OLD.id,OLD.subscription_id,OLD.starts_on,OLD.ends_on,OLD.starts_at,OLD.ends_at,OLD.reason,OLD.comment,OLD.created_at)
    OR OLD.actual_ends_on IS NOT NULL OR NEW.actual_ends_on IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Freeze can only be closed once';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_mgr04_freeze_guard BEFORE UPDATE OR DELETE ON subscription_freezes FOR EACH ROW EXECUTE FUNCTION mgr04_freeze_guard();
-- Keep STU-07 history, shortening an early-ended managed freeze to its actual end.
CREATE OR REPLACE FUNCTION stu07_capture_freeze() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE actual_until timestamptz;
BEGIN
  IF OLD.frozen_from IS NOT NULL AND (NEW.frozen_from IS DISTINCT FROM OLD.frozen_from OR NEW.frozen_until IS DISTINCT FROM OLD.frozen_until) THEN
    SELECT f.actual_ends_at INTO actual_until FROM public.manager_subscription_periods p JOIN public.subscription_freezes f ON f.subscription_id=p.manager_subscription_id
      WHERE p.financial_subscription_id=OLD.id AND f.starts_at=OLD.frozen_from ORDER BY f.created_at DESC,f.id DESC LIMIT 1;
    actual_until:=coalesce(actual_until,OLD.frozen_until);
    IF actual_until>OLD.frozen_from THEN
      INSERT INTO public.subscription_freeze_history(subscription_id,frozen_from,frozen_until,replaced_at)
        VALUES(OLD.id,OLD.frozen_from,least(actual_until,OLD.frozen_until),clock_timestamp());
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION stu07_capture_freeze() FROM PUBLIC;
REVOKE ALL ON manager_subscriptions,manager_subscription_periods,manager_subscription_operations,subscription_freezes FROM PUBLIC,online_school_runtime;
GRANT SELECT,INSERT ON manager_subscriptions,manager_subscription_periods,manager_subscription_operations,subscription_freezes TO online_school_runtime;
GRANT UPDATE(status,current_plan_id,ends_at,freeze_days_used,updated_at) ON manager_subscriptions TO online_school_runtime;
GRANT UPDATE(actual_ends_on,actual_ends_at) ON subscription_freezes TO online_school_runtime;
GRANT UPDATE(valid_to,frozen_from,frozen_until,updated_at) ON subscriptions TO online_school_runtime;
-- Retain every older notification-source invariant.
CREATE OR REPLACE FUNCTION stu10_guard_source() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
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
  WHEN 'SUBSCRIPTION_CREATED','SUBSCRIPTION_RENEWED','SUBSCRIPTION_FROZEN','SUBSCRIPTION_UNFROZEN','SUBSCRIPTION_EXPIRED' THEN
    keys=ARRAY['subscriptionId','operationId'];
    SELECT EXISTS(SELECT 1 FROM public.manager_subscription_operations op
      JOIN public.manager_subscriptions root ON root.id=op.subscription_id
      JOIN public.student_subject_enrollments en ON en.id=root.enrollment_id
      JOIN public.outbox_events event ON event.aggregate_id=root.id
      JOIN public.audit_events audit ON audit.id=event.audit_event_id
      WHERE op.id=(NEW.payload->>'operationId')::uuid AND op.subscription_id=(NEW.payload->>'subscriptionId')::uuid
        AND en.student_id=NEW.student_id AND event.payload->>'operationId'=op.id::text
        AND event.payload->>'subscriptionId'=root.id::text AND event.payload->>'studentId'=en.student_id::text
        AND event.created_at=NEW.occurred_at AND op.created_at=NEW.occurred_at
        AND NEW.event_key='manager-subscription:'||op.id::text
        AND event.topic=CASE op.type WHEN 'CREATE' THEN 'manager.subscription.created.v1' WHEN 'RENEW' THEN 'manager.subscription.renewed.v1'
          WHEN 'FREEZE' THEN 'manager.subscription.frozen.v1' WHEN 'UNFREEZE' THEN 'manager.subscription.unfrozen.v1' WHEN 'EXPIRE' THEN 'manager.subscription.expired.v1' END
        AND audit.action=NEW.type::text
        AND NEW.type::text=CASE op.type WHEN 'CREATE' THEN 'SUBSCRIPTION_CREATED' WHEN 'RENEW' THEN 'SUBSCRIPTION_RENEWED'
          WHEN 'FREEZE' THEN 'SUBSCRIPTION_FROZEN' WHEN 'UNFREEZE' THEN 'SUBSCRIPTION_UNFROZEN' WHEN 'EXPIRE' THEN 'SUBSCRIPTION_EXPIRED' END) INTO valid;
  WHEN 'ACCOUNT_CREATED' THEN
    keys=ARRAY['accountId','loginEmail'];
    SELECT EXISTS(SELECT 1 FROM public.student_accounts a
      JOIN public.outbox_events event ON event.aggregate_id=a.student_id
      JOIN public.audit_events audit ON audit.id=event.audit_event_id
      WHERE a.account_id=(NEW.payload->>'accountId')::uuid AND a.student_id=NEW.student_id
        AND a.activated_at<=NEW.occurred_at AND event.topic='manager.student.account-created.v1'
        AND event.payload->>'accountId'=NEW.payload->>'accountId'
        AND event.payload->>'loginEmail'=NEW.payload->>'loginEmail'
        AND event.created_at=NEW.occurred_at AND audit.action='STUDENT_ACCOUNT_CREATED'
        AND NEW.event_key='account-created:'||a.account_id::text) INTO valid;
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
COMMIT;

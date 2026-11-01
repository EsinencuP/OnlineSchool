ALTER TYPE student_notification_type ADD VALUE IF NOT EXISTS 'ACCOUNT_CREATED';
BEGIN;
ALTER TABLE student_accounts ADD COLUMN temporary_password_issued_at timestamptz(3),
  ADD COLUMN activation_distribution_id uuid REFERENCES payment_distributions(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD COLUMN temporary_password_expires_at timestamptz(3),
  ADD CONSTRAINT ck_mgr03_temporary_password CHECK(
    (temporary_password_issued_at IS NULL AND temporary_password_expires_at IS NULL)
    OR (temporary_password_issued_at IS NOT NULL AND temporary_password_expires_at=temporary_password_issued_at+interval '72 hours' AND must_change_password)
    OR (temporary_password_issued_at IS NOT NULL AND temporary_password_expires_at IS NULL AND NOT must_change_password));
CREATE INDEX idx_mgr03_activation_distribution ON student_accounts(activation_distribution_id);
CREATE FUNCTION mgr03_activation_distribution() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.activation_distribution_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM payment_distributions d JOIN subscriptions s ON s.id=d.subscription_id
    JOIN student_subject_enrollments e ON e.id=s.enrollment_id
    JOIN ledger_documents doc ON doc.distribution_id=d.id JOIN ledger_entries le ON le.document_id=doc.id
    WHERE d.id=NEW.activation_distribution_id AND d.subscription_id=NEW.activation_subscription_id
      AND d.payment_id=NEW.activation_payment_confirmation_id AND e.student_id=NEW.student_id
      AND d.approved_at<=NEW.activated_at AND le.published_at<=NEW.activated_at AND le.effective_at<=NEW.activated_at
  ) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Activation distribution must be published for this student'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_mgr03_activation_distribution BEFORE INSERT OR UPDATE OF activation_distribution_id,activation_subscription_id,
  activation_payment_confirmation_id,student_id,activated_at ON student_accounts FOR EACH ROW EXECUTE FUNCTION mgr03_activation_distribution();
-- The existing uq_student_active_account partial UNIQUE remains the sole active-account index.
-- A manager is the technical issuer. The recorded director is the original financial
-- approver, validated at that approval's timestamp. Legacy activation paths retain their check.
CREATE OR REPLACE FUNCTION check_student_activation_director() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE approval_at timestamptz;director_id uuid;
BEGIN
  IF NEW.activation_distribution_id IS NOT NULL THEN
    IF NEW.activation_basis='FULL_PAYMENT' THEN
      SELECT r.confirmed_by_director_at,r.confirmed_by_director_id INTO approval_at,director_id
        FROM payment_receipts r WHERE r.id=NEW.activation_payment_confirmation_id;
    ELSE
      SELECT p.approved_at,p.approved_by_director_id INTO approval_at,director_id
        FROM temporary_access_permissions p WHERE p.id=NEW.activation_director_admission_id;
    END IF;
    IF director_id IS DISTINCT FROM NEW.activation_confirmed_by_staff_id OR approval_at IS NULL OR approval_at>NEW.activated_at THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Activation must reuse its financial director approval';
    END IF;
  ELSE
    approval_at:=NEW.activated_at;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM staff_accounts staff JOIN auth_accounts account ON account.id=staff.account_id
    JOIN role_assignments assignment ON assignment.account_id=account.id JOIN roles role ON role.id=assignment.role_id
    WHERE staff.id=NEW.activation_confirmed_by_staff_id AND role.code='DIRECTOR'
      AND assignment.valid_from<=approval_at AND (assignment.valid_to IS NULL OR assignment.valid_to>approval_at)
      AND (staff.deactivated_at IS NULL OR staff.deactivated_at>approval_at)
      AND (account.disabled_at IS NULL OR account.disabled_at>approval_at)) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Student activation requires a director confirmation';
  END IF;
  RETURN NEW;
END $$;
GRANT INSERT(id,kind,login_id,password_hash,created_at,updated_at) ON auth_accounts TO online_school_runtime;
GRANT INSERT(id,account_id,role_id,assigned_by_staff_id,valid_from,created_at,updated_at) ON role_assignments TO online_school_runtime;
GRANT INSERT(id,student_id,account_id,account_kind,activation_basis,must_change_password,timezone,
  activation_subscription_id,activation_payment_confirmation_id,activation_director_admission_id,
  activation_distribution_id,
  activation_confirmed_by_staff_id,activated_at,temporary_password_issued_at,temporary_password_expires_at,created_at,updated_at)
  ON student_accounts TO online_school_runtime;
GRANT UPDATE(must_change_password,temporary_password_issued_at,temporary_password_expires_at,updated_at)
  ON student_accounts TO online_school_runtime;
-- Keep every STU-10 source invariant, adding the canonical account-created fact.
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

-- TASK-04: structural consistency. Runtime ACL, S3 adapters and worker commands follow separately.
ALTER TABLE homework_assignments ADD CONSTRAINT ck_homework_content CHECK (jsonb_typeof(content)='object' AND length(trim(title))>0);
ALTER TABLE homework_deliveries ADD CONSTRAINT ck_homework_due CHECK (due_at>=issued_at AND (cancelled_at IS NULL OR cancelled_at>=issued_at));
ALTER TABLE homework_submissions ADD CONSTRAINT ck_submission_content CHECK (version>0 AND jsonb_typeof(content)='object');
ALTER TABLE submission_reviews ADD CONSTRAINT ck_review_version CHECK (version>0);
ALTER TABLE skill_assessments ADD CONSTRAINT ck_skill_assessment_version CHECK (version>0 AND length(trim(basis))>0);
ALTER TABLE progress_checkpoints ADD CONSTRAINT ck_checkpoint_count CHECK (
  confirmed_lesson_count>0 AND ((type='LESSON_4' AND confirmed_lesson_count%4=0) OR (type='LESSON_8' AND confirmed_lesson_count%8=0))
  AND (completed_at IS NULL OR completed_at>=triggered_at));
ALTER TABLE education_reports
  ADD CONSTRAINT ck_report_version CHECK (version>0 AND period_end>period_start AND jsonb_typeof(content)='object'),
  ADD CONSTRAINT ck_report_publication CHECK (
    (status='DRAFT' AND published_at IS NULL AND published_by IS NULL)
    OR (status='GENERATED' AND generated_at IS NOT NULL AND published_at IS NULL AND published_by IS NULL)
    OR (status='PUBLISHED' AND generated_at IS NOT NULL AND published_at IS NOT NULL AND published_at>=generated_at AND published_by IS NOT NULL));

ALTER TABLE s3_objects
  ADD CONSTRAINT ck_s3_metadata CHECK (size>=0 AND length(trim(bucket))>0 AND length(trim(key))>0 AND key NOT LIKE '%://%' AND length(trim(content_type))>0),
  ADD CONSTRAINT ck_s3_hash CHECK (sha256 IS NULL OR sha256 ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT ck_s3_state CHECK (
    status IN ('PENDING','QUARANTINED','DELETED')
    OR (status='UPLOADED' AND uploaded_at IS NOT NULL)
    OR (status='VERIFIED' AND uploaded_at IS NOT NULL AND verified_at IS NOT NULL AND verified_at>=uploaded_at));
ALTER TABLE file_permissions
  ADD CONSTRAINT ck_file_permission_expiry CHECK (expires_at IS NULL OR expires_at>granted_at),
  ADD CONSTRAINT ck_file_permission_revocation CHECK (
    (revoked_at IS NULL AND revoked_by IS NULL) OR (revoked_at IS NOT NULL AND revoked_at>=granted_at AND revoked_by IS NOT NULL));

ALTER TABLE audit_events ADD CONSTRAINT ck_audit_actor CHECK (
  (actor_kind='ACCOUNT' AND actor_id IS NOT NULL AND system_actor_ref IS NULL)
  OR (actor_kind='SYSTEM' AND actor_id IS NULL AND system_actor_ref IS NOT NULL AND length(trim(system_actor_ref))>0)
  OR (actor_kind='ANONYMOUS' AND actor_id IS NULL AND system_actor_ref IS NULL));
ALTER TABLE audit_events ADD CONSTRAINT ck_audit_identity CHECK (length(trim(action))>0 AND length(trim(resource_type))>0 AND length(trim(event_key))>0);
ALTER TABLE idempotency_records
  ADD CONSTRAINT ck_idempotency_identity CHECK (length(trim(scope))>0 AND length(trim(key))>0 AND length(trim(command_type))>0),
  ADD CONSTRAINT ck_idempotency_ttl CHECK (expires_at>created_at),
  ADD CONSTRAINT ck_idempotency_hash CHECK (request_hash ~ '^[0-9a-f]{64}$' AND (result_hash IS NULL OR result_hash ~ '^[0-9a-f]{64}$')),
  ADD CONSTRAINT ck_idempotency_state CHECK (
    (status='IN_PROGRESS' AND completed_at IS NULL AND result_hash IS NULL AND result IS NULL)
    OR (status IN ('COMPLETED','FAILED') AND completed_at IS NOT NULL AND completed_at>=created_at AND result_hash IS NOT NULL));
ALTER TABLE outbox_events
  ADD CONSTRAINT ck_outbox_payload CHECK (jsonb_typeof(payload)='object' AND schema_version>0 AND length(trim(topic))>0 AND length(trim(event_key))>0),
  ADD CONSTRAINT ck_outbox_attempts CHECK (attempts>=0 AND (last_attempt_at IS NULL OR attempts>0)),
  ADD CONSTRAINT ck_outbox_lease CHECK (num_nonnulls(locked_by,locked_until) IN (0,2)),
  ADD CONSTRAINT ck_outbox_delivery CHECK (published_at IS NULL OR
    (attempts>0 AND last_attempt_at IS NOT NULL AND published_at>=last_attempt_at AND delivery_reference IS NOT NULL AND locked_by IS NULL AND locked_until IS NULL));
ALTER TABLE job_records
  ADD CONSTRAINT ck_job_payload CHECK (jsonb_typeof(payload)='object' AND length(trim(type))>0 AND length(trim(deduplication_key))>0),
  ADD CONSTRAINT ck_job_attempts CHECK (max_attempts>0 AND attempts>=0 AND attempts<=max_attempts),
  ADD CONSTRAINT ck_job_lease CHECK (num_nonnulls(locked_by,locked_until) IN (0,2) AND
    ((status='RUNNING' AND locked_by IS NOT NULL AND started_at IS NOT NULL AND locked_until>started_at) OR (status<>'RUNNING' AND locked_by IS NULL AND locked_until IS NULL))),
  ADD CONSTRAINT ck_job_finish CHECK (
    (status IN ('SUCCEEDED','FAILED','CANCELLED') AND finished_at IS NOT NULL AND (started_at IS NULL OR finished_at>=started_at))
    OR (status NOT IN ('SUCCEEDED','FAILED','CANCELLED') AND finished_at IS NULL));
ALTER TABLE job_attempts ADD CONSTRAINT ck_job_attempt_state CHECK (attempt_no>0 AND
  ((result='RUNNING' AND finished_at IS NULL) OR (result<>'RUNNING' AND finished_at IS NOT NULL AND finished_at>=started_at)));
ALTER TABLE recovery_states ADD CONSTRAINT ck_recovery_resolution CHECK (
  (status IN ('UNKNOWN','RECONCILING','MANUAL_REQUIRED') AND reconciled_at IS NULL)
  OR (status='CONFIRMED' AND ext_resource_id IS NOT NULL AND reconciled_at IS NOT NULL AND evidence_ref IS NOT NULL AND length(trim(evidence_ref))>0)
  OR (status='ABSENT' AND ext_resource_id IS NULL AND reconciled_at IS NOT NULL AND evidence_ref IS NOT NULL AND length(trim(evidence_ref))>0));
ALTER TABLE recovery_states ADD CONSTRAINT ck_recovery_attempt CHECK (attempt_no>0);

CREATE FUNCTION t04_education_context() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE assignment homework_assignments; delivery homework_deliveries; enrollment student_subject_enrollments;
  submission homework_submissions; skill skill_entries; checkpoint progress_checkpoints; outcome lesson_actual_outcomes;
  lesson lesson_occurrences; previous record; confirmed_count bigint;
BEGIN
  CASE TG_TABLE_NAME
  WHEN 'homework_assignments' THEN
    IF NEW.lesson_occurrence_id IS NOT NULL THEN
      SELECT * INTO lesson FROM lesson_occurrences WHERE id=NEW.lesson_occurrence_id;
      SELECT * INTO enrollment FROM student_subject_enrollments WHERE id=lesson.enrollment_id;
      IF enrollment.subject_id IS DISTINCT FROM NEW.subject_id THEN RAISE EXCEPTION 'Homework subject/lesson mismatch' USING ERRCODE='23514',CONSTRAINT='ck_education_context'; END IF;
    END IF;
  WHEN 'homework_deliveries' THEN
    SELECT * INTO assignment FROM homework_assignments WHERE id=NEW.assignment_id;
    SELECT * INTO enrollment FROM student_subject_enrollments WHERE id=NEW.enrollment_id;
    IF assignment.subject_id IS DISTINCT FROM enrollment.subject_id THEN RAISE EXCEPTION 'Homework delivery subject mismatch' USING ERRCODE='23514',CONSTRAINT='ck_education_context'; END IF;
  WHEN 'homework_submissions' THEN
    SELECT * INTO delivery FROM homework_deliveries WHERE id=NEW.delivery_id FOR UPDATE;
    SELECT * INTO enrollment FROM student_subject_enrollments WHERE id=delivery.enrollment_id;
    IF enrollment.student_id IS DISTINCT FROM NEW.student_id OR NEW.submitted_at<delivery.issued_at OR (delivery.cancelled_at IS NOT NULL AND delivery.cancelled_at<=NEW.submitted_at) THEN
      RAISE EXCEPTION 'Submission student/delivery mismatch' USING ERRCODE='23514',CONSTRAINT='ck_education_context';
    END IF;
    IF NEW.supersedes_submission_id IS NOT NULL THEN
      SELECT * INTO submission FROM homework_submissions WHERE id=NEW.supersedes_submission_id;
      IF submission.delivery_id IS DISTINCT FROM NEW.delivery_id OR submission.student_id IS DISTINCT FROM NEW.student_id OR submission.version>=NEW.version THEN
        RAISE EXCEPTION 'Invalid submission revision' USING ERRCODE='23514',CONSTRAINT='ck_submission_revision';
      END IF;
    END IF;
  WHEN 'submission_reviews' THEN
    SELECT * INTO submission FROM homework_submissions WHERE id=NEW.submission_id;
    IF NEW.reviewed_at<submission.submitted_at THEN RAISE EXCEPTION 'Review precedes submission' USING ERRCODE='23514'; END IF;
  WHEN 'skill_assessments' THEN
    SELECT * INTO skill FROM skill_entries WHERE id=NEW.skill_id;
    SELECT * INTO enrollment FROM student_subject_enrollments WHERE id=NEW.enrollment_id;
    IF skill.subject_id IS DISTINCT FROM enrollment.subject_id THEN RAISE EXCEPTION 'Assessment subject mismatch' USING ERRCODE='23514',CONSTRAINT='ck_education_context'; END IF;
    IF NEW.lesson_ref IS NOT NULL AND NOT EXISTS (SELECT 1 FROM lesson_occurrences WHERE id=NEW.lesson_ref AND enrollment_id=NEW.enrollment_id) THEN
      RAISE EXCEPTION 'Assessment lesson mismatch' USING ERRCODE='23514',CONSTRAINT='ck_education_context';
    END IF;
    IF NEW.supersedes_assessment_id IS NOT NULL AND NOT EXISTS
      (SELECT 1 FROM skill_assessments WHERE id=NEW.supersedes_assessment_id AND skill_id=NEW.skill_id AND enrollment_id=NEW.enrollment_id AND version<NEW.version) THEN
      RAISE EXCEPTION 'Invalid assessment revision' USING ERRCODE='23514';
    END IF;
  WHEN 'progress_checkpoints' THEN
    PERFORM 1 FROM student_subject_enrollments WHERE id=NEW.enrollment_id FOR UPDATE;
    SELECT * INTO outcome FROM lesson_actual_outcomes WHERE id=NEW.lesson_actual_outcome_id;
    SELECT * INTO lesson FROM lesson_occurrences WHERE id=outcome.lesson_occurrence_id;
    SELECT count(*) INTO confirmed_count FROM lesson_actual_outcomes o JOIN lesson_occurrences l ON l.id=o.lesson_occurrence_id
      WHERE l.enrollment_id=NEW.enrollment_id AND l.status='CONDUCTED' AND o.confirmed_at<=NEW.triggered_at;
    IF lesson.enrollment_id IS DISTINCT FROM NEW.enrollment_id OR lesson.status<>'CONDUCTED' OR outcome.confirmed_at>NEW.triggered_at OR NEW.confirmed_lesson_count>confirmed_count THEN
      RAISE EXCEPTION 'Checkpoint needs confirmed conducted lessons' USING ERRCODE='23514',CONSTRAINT='ck_checkpoint_confirmed_lessons';
    END IF;
  WHEN 'education_reports' THEN
    IF TG_OP='UPDATE' AND OLD.published_at IS NOT NULL THEN RAISE EXCEPTION 'Published report is immutable' USING ERRCODE='23514',CONSTRAINT='ck_published_report_immutable'; END IF;
    SELECT * INTO checkpoint FROM progress_checkpoints WHERE id=NEW.checkpoint_id;
    IF checkpoint.type IS DISTINCT FROM 'LESSON_8'::"CheckpointType" THEN
      RAISE EXCEPTION 'Report belongs to the 8-lesson checkpoint' USING ERRCODE='23514',CONSTRAINT='ck_report_checkpoint';
    END IF;
    IF NEW.supersedes_report_id IS NOT NULL AND NOT EXISTS
      (SELECT 1 FROM education_reports WHERE id=NEW.supersedes_report_id AND checkpoint_id=NEW.checkpoint_id AND version<NEW.version) THEN
      RAISE EXCEPTION 'Invalid report revision' USING ERRCODE='23514';
    END IF;
  END CASE;
  RETURN NEW;
END $$;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['homework_assignments','homework_deliveries','homework_submissions','submission_reviews','skill_assessments','progress_checkpoints','education_reports'] LOOP
    EXECUTE format('CREATE TRIGGER trg_t04_education BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION t04_education_context()',t);
  END LOOP;
END $$;

CREATE FUNCTION t04_guard_file_permission() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE object s3_objects;
BEGIN
  SELECT * INTO object FROM s3_objects WHERE id=NEW.s3_object_id FOR UPDATE;
  IF TG_OP='INSERT' AND (object.status IS DISTINCT FROM 'VERIFIED'::"S3ObjectStatus" OR NEW.revoked_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Read permission needs a verified object' USING ERRCODE='23514',CONSTRAINT='ck_file_verified_object';
  END IF;
  IF TG_OP='UPDATE' AND ((to_jsonb(NEW)-'revoked_at'-'revoked_by'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at'-'revoked_by'-'updated_at') OR OLD.revoked_at IS NOT NULL) THEN
    RAISE EXCEPTION 'File permission can only be revoked; issue a new grant' USING ERRCODE='23514',CONSTRAINT='ck_file_permission_immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t04_file_permission BEFORE INSERT OR UPDATE ON file_permissions FOR EACH ROW EXECUTE FUNCTION t04_guard_file_permission();

CREATE FUNCTION t04_guard_s3_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.bucket IS DISTINCT FROM OLD.bucket OR NEW.key IS DISTINCT FROM OLD.key OR NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by THEN
    RAISE EXCEPTION 'Object identity is immutable' USING ERRCODE='23514';
  END IF;
  IF OLD.verified_at IS NOT NULL AND (NEW.size IS DISTINCT FROM OLD.size OR NEW.sha256 IS DISTINCT FROM OLD.sha256 OR NEW.content_type IS DISTINCT FROM OLD.content_type) THEN
    RAISE EXCEPTION 'Verified object content needs a new object key' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t04_s3_identity BEFORE UPDATE ON s3_objects FOR EACH ROW EXECUTE FUNCTION t04_guard_s3_identity();

CREATE FUNCTION t04_guard_file_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.permission_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM file_permissions WHERE id=NEW.permission_id AND s3_object_id=NEW.s3_object_id) THEN
    RAISE EXCEPTION 'File audit permission/object mismatch' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t04_file_audit BEFORE INSERT ON file_audit_logs FOR EACH ROW EXECUTE FUNCTION t04_guard_file_audit();

CREATE FUNCTION t04_guard_idempotency() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.expires_at>clock_timestamp() THEN RAISE EXCEPTION 'Unexpired idempotency record cannot be removed' USING ERRCODE='23514',CONSTRAINT='ck_idempotency_not_expired'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status<>'IN_PROGRESS' OR NEW.scope<>OLD.scope OR NEW.key<>OLD.key OR NEW.command_type<>OLD.command_type OR NEW.request_hash<>OLD.request_hash OR NEW.expires_at<>OLD.expires_at THEN
    RAISE EXCEPTION 'Idempotency identity/result is immutable' USING ERRCODE='23514',CONSTRAINT='ck_idempotency_immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t04_idempotency BEFORE UPDATE OR DELETE ON idempotency_records FOR EACH ROW EXECUTE FUNCTION t04_guard_idempotency();

CREATE FUNCTION t04_guard_outbox() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE audit audit_events;
BEGIN
  IF TG_OP='INSERT' THEN
    SELECT * INTO audit FROM audit_events WHERE id=NEW.audit_event_id;
    IF audit.result IS DISTINCT FROM 'SUCCESS'::"AuditResult" OR audit.source_operation_id IS DISTINCT FROM NEW.source_operation_id THEN
      RAISE EXCEPTION 'Outbox needs matching successful audit' USING ERRCODE='23514',CONSTRAINT='ck_outbox_audit';
    END IF;
    IF NEW.published_at IS NOT NULL OR NEW.attempts<>0 THEN RAISE EXCEPTION 'Outbox starts undelivered' USING ERRCODE='23514'; END IF;
  ELSE
    IF OLD.published_at IS NOT NULL OR NEW.attempts<OLD.attempts OR
      (to_jsonb(NEW)-ARRAY['attempts','last_attempt_at','next_attempt_at','locked_by','locked_until','published_at','delivery_reference','last_error_code','updated_at']) IS DISTINCT FROM
      (to_jsonb(OLD)-ARRAY['attempts','last_attempt_at','next_attempt_at','locked_by','locked_until','published_at','delivery_reference','last_error_code','updated_at']) THEN
      RAISE EXCEPTION 'Outbox source/payload or delivered state is immutable' USING ERRCODE='23514',CONSTRAINT='ck_outbox_immutable';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t04_outbox BEFORE INSERT OR UPDATE ON outbox_events FOR EACH ROW EXECUTE FUNCTION t04_guard_outbox();

CREATE FUNCTION t04_guard_job() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE event outbox_events; recovery recovery_states;
BEGIN
  IF TG_OP='INSERT' AND (NEW.status<>'PENDING' OR NEW.attempts<>0) THEN
    RAISE EXCEPTION 'Jobs start pending with no attempted work' USING ERRCODE='23514';
  END IF;
  IF NEW.source_outbox_event_id IS NOT NULL THEN
    SELECT * INTO event FROM outbox_events WHERE id=NEW.source_outbox_event_id;
    IF event.source_operation_id IS DISTINCT FROM NEW.source_operation_id THEN RAISE EXCEPTION 'Job source mismatch' USING ERRCODE='23514'; END IF;
  END IF;
  IF TG_OP='UPDATE' THEN
    IF OLD.status IN ('SUCCEEDED','FAILED','CANCELLED') OR NEW.attempts<OLD.attempts OR
      (to_jsonb(NEW)-ARRAY['status','attempts','next_run_at','locked_by','locked_until','started_at','finished_at','last_error_code','updated_at']) IS DISTINCT FROM
      (to_jsonb(OLD)-ARRAY['status','attempts','next_run_at','locked_by','locked_until','started_at','finished_at','last_error_code','updated_at']) THEN
      RAISE EXCEPTION 'Job identity/policy or terminal state is immutable' USING ERRCODE='23514',CONSTRAINT='ck_job_immutable';
    END IF;
    IF NEW.retry_policy='RECONCILE_BEFORE_RETRY' AND OLD.attempts>0 AND
      ((NEW.status IN ('PENDING','RETRY_WAIT') AND NEW.status<>OLD.status)
       OR (NEW.status='RUNNING' AND (OLD.status<>'RUNNING' OR NEW.attempts>OLD.attempts))) THEN
      SELECT * INTO recovery FROM recovery_states WHERE job_id=NEW.id AND attempt_no=OLD.attempts FOR UPDATE;
      IF recovery.status IS DISTINCT FROM 'ABSENT'::"RecoveryStatus" THEN
        RAISE EXCEPTION 'Unknown external result requires reconciliation before retry' USING ERRCODE='23514',CONSTRAINT='ck_job_reconciliation_required';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t04_job BEFORE INSERT OR UPDATE ON job_records FOR EACH ROW EXECUTE FUNCTION t04_guard_job();

CREATE FUNCTION t04_guard_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE job job_records;
BEGIN
  SELECT * INTO job FROM job_records WHERE id=NEW.job_id FOR UPDATE;
  IF TG_OP='INSERT' THEN
    IF job.status IS DISTINCT FROM 'RUNNING'::"JobStatus" OR NEW.attempt_no>job.max_attempts OR NEW.attempt_no>job.attempts OR NEW.started_at>=job.locked_until THEN
      RAISE EXCEPTION 'Attempt needs a running leased job and reserved attempt number' USING ERRCODE='23514',CONSTRAINT='ck_job_attempt_lease';
    END IF;
  ELSIF OLD.finished_at IS NOT NULL OR NEW.job_id<>OLD.job_id OR NEW.attempt_no<>OLD.attempt_no OR NEW.started_at<>OLD.started_at THEN
    RAISE EXCEPTION 'Finished attempt/history is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t04_attempt BEFORE INSERT OR UPDATE ON job_attempts FOR EACH ROW EXECUTE FUNCTION t04_guard_attempt();

CREATE FUNCTION t04_guard_recovery() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM job_attempts WHERE job_id=NEW.job_id AND attempt_no=NEW.attempt_no) THEN
    RAISE EXCEPTION 'Recovery needs the original attempt' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND (OLD.status IN ('CONFIRMED','ABSENT') OR NEW.job_id<>OLD.job_id OR NEW.attempt_no<>OLD.attempt_no OR NEW.operation_key<>OLD.operation_key OR NEW.provider<>OLD.provider OR NEW.provider_request_id<>OLD.provider_request_id) THEN
    RAISE EXCEPTION 'Recovery identity or verified resolution is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_t04_recovery BEFORE INSERT OR UPDATE ON recovery_states FOR EACH ROW EXECUTE FUNCTION t04_guard_recovery();

-- Same append-only guard as the existing financial history. Retention/legal hold is a separate controlled process.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['audit_events','file_audit_logs','homework_submissions','submission_reviews','skill_assessments'] LOOP
    EXECUTE format('CREATE TRIGGER trg_t04_append_only BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION t03_immutable_record()',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['outbox_events','job_records','job_attempts','recovery_states','file_permissions','education_reports','homework_deliveries'] LOOP
    EXECUTE format('CREATE TRIGGER trg_t04_no_delete BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION t03_immutable_record()',t);
  END LOOP;
END $$;

GRANT SELECT,INSERT ON audit_events,file_audit_logs TO online_school_runtime;
REVOKE UPDATE,DELETE,TRUNCATE ON audit_events,file_audit_logs FROM online_school_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON idempotency_records TO online_school_runtime;
GRANT SELECT,INSERT,UPDATE ON outbox_events,job_records,job_attempts,recovery_states TO online_school_runtime;

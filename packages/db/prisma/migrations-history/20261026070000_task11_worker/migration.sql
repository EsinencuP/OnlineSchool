BEGIN;
-- TASK-11: additive outbox state and data-preserving recovery vocabulary migration.
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING','DELIVERED','DEAD');
ALTER TABLE outbox_events ADD COLUMN status "OutboxStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE outbox_events DISABLE TRIGGER trg_t04_outbox;
UPDATE outbox_events SET status='DELIVERED' WHERE published_at IS NOT NULL;
ALTER TABLE outbox_events ENABLE TRIGGER trg_t04_outbox;
ALTER TABLE outbox_events ADD CONSTRAINT ck_outbox_status CHECK (
  (status='DELIVERED' AND published_at IS NOT NULL) OR
  (status IN ('PENDING','DEAD') AND published_at IS NULL AND
    (status<>'DEAD' OR (locked_by IS NULL AND locked_until IS NULL AND last_error_code IS NOT NULL))));
CREATE INDEX outbox_events_status_next_attempt_at_idx ON outbox_events(status,next_attempt_at);

ALTER TABLE recovery_states DROP CONSTRAINT ck_recovery_resolution;
ALTER TABLE recovery_states ALTER COLUMN status DROP DEFAULT;
ALTER TYPE "RecoveryStatus" RENAME TO "RecoveryStatusLegacy";
CREATE TYPE "RecoveryStatus" AS ENUM ('PENDING','CONFIRMED','FAILED','NEEDS_MANUAL');
ALTER TABLE recovery_states ALTER COLUMN status TYPE "RecoveryStatus" USING
  (CASE status::text WHEN 'CONFIRMED' THEN 'CONFIRMED' WHEN 'ABSENT' THEN 'FAILED'
    WHEN 'MANUAL_REQUIRED' THEN 'NEEDS_MANUAL' ELSE 'PENDING' END)::"RecoveryStatus";
ALTER TABLE recovery_states ALTER COLUMN status SET DEFAULT 'PENDING';
DROP TYPE "RecoveryStatusLegacy";
ALTER TABLE recovery_states
  ADD COLUMN check_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN locked_by text,
  ADD COLUMN locked_until timestamptz(3),
  ADD CONSTRAINT ck_recovery_checks CHECK (check_attempts>=0),
  ADD CONSTRAINT ck_recovery_lease CHECK (num_nonnulls(locked_by,locked_until) IN (0,2) AND
    (status='PENDING' OR locked_by IS NULL)),
  ADD CONSTRAINT ck_recovery_resolution CHECK (
    (status IN ('PENDING','NEEDS_MANUAL') AND reconciled_at IS NULL)
    OR (status='CONFIRMED' AND ext_resource_id IS NOT NULL AND reconciled_at IS NOT NULL AND evidence_ref IS NOT NULL AND length(trim(evidence_ref))>0)
    OR (status='FAILED' AND ext_resource_id IS NULL AND reconciled_at IS NOT NULL AND evidence_ref IS NOT NULL AND length(trim(evidence_ref))>0));
CREATE INDEX recovery_states_status_next_check_at_idx ON recovery_states(status,next_check_at);

CREATE OR REPLACE FUNCTION t04_guard_outbox() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE audit audit_events;
BEGIN
  IF TG_OP='INSERT' THEN
    SELECT * INTO audit FROM audit_events WHERE id=NEW.audit_event_id;
    IF audit.result IS DISTINCT FROM 'SUCCESS'::"AuditResult" OR audit.source_operation_id IS DISTINCT FROM NEW.source_operation_id THEN
      RAISE EXCEPTION 'Outbox needs matching successful audit' USING ERRCODE='23514',CONSTRAINT='ck_outbox_audit';
    END IF;
    IF NEW.status<>'PENDING' OR NEW.published_at IS NOT NULL OR NEW.attempts<>0 THEN RAISE EXCEPTION 'Outbox starts undelivered' USING ERRCODE='23514'; END IF;
  ELSE
    IF OLD.status IN ('DELIVERED','DEAD') OR OLD.published_at IS NOT NULL OR NEW.attempts<OLD.attempts OR
      (to_jsonb(NEW)-ARRAY['status','attempts','last_attempt_at','next_attempt_at','locked_by','locked_until','published_at','delivery_reference','last_error_code','updated_at']) IS DISTINCT FROM
      (to_jsonb(OLD)-ARRAY['status','attempts','last_attempt_at','next_attempt_at','locked_by','locked_until','published_at','delivery_reference','last_error_code','updated_at']) THEN
      RAISE EXCEPTION 'Outbox source/payload or delivered state is immutable' USING ERRCODE='23514',CONSTRAINT='ck_outbox_immutable';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION t04_guard_job() RETURNS trigger LANGUAGE plpgsql AS $$
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
      IF recovery.status IS DISTINCT FROM 'FAILED'::"RecoveryStatus" THEN
        RAISE EXCEPTION 'Unknown external result requires reconciliation before retry' USING ERRCODE='23514',CONSTRAINT='ck_job_reconciliation_required';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION t04_guard_recovery() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM job_attempts WHERE job_id=NEW.job_id AND attempt_no=NEW.attempt_no) THEN
    RAISE EXCEPTION 'Recovery needs the original attempt' USING ERRCODE='23514';
  END IF;
  IF TG_OP='UPDATE' AND (OLD.status IN ('CONFIRMED','FAILED') OR NEW.check_attempts<OLD.check_attempts OR NEW.job_id<>OLD.job_id OR NEW.attempt_no<>OLD.attempt_no OR NEW.operation_key<>OLD.operation_key OR NEW.provider<>OLD.provider OR NEW.provider_request_id<>OLD.provider_request_id) THEN
    RAISE EXCEPTION 'Recovery identity or verified resolution is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

COMMIT;

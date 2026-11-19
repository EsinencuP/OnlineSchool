BEGIN;

CREATE TYPE "TeacherMeetOperationKind" AS ENUM ('CREATE','VERIFY','RECONCILE');
CREATE TYPE "TeacherMeetOperationState" AS ENUM ('QUEUED','DISPATCHING','SUCCEEDED','FAILED','UNKNOWN','RECONCILED','CLOSED_WITHOUT_SPACE');

CREATE TABLE teacher_meet_spaces (
  id uuid PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  teacher_id uuid NOT NULL REFERENCES teacher_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  google_subject text NOT NULL,
  resource_name text NOT NULL,
  meeting_uri text NOT NULL,
  published_at timestamptz(3) NOT NULL,
  last_verified_at timestamptz(3) NOT NULL,
  retired_at timestamptz(3),
  retired_by_id uuid REFERENCES staff_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  retirement_basis text,
  CONSTRAINT ck_teacher_meet_space CHECK (
    google_subject ~ '^[A-Za-z0-9_-]{1,255}$' AND resource_name ~ '^spaces/[A-Za-z0-9_-]{1,121}$'
    AND resource_name !~* '^spaces/[a-z]{3}-[a-z]{4}-[a-z]{3}$'
    AND meeting_uri ~ '^https://meet[.]google[.]com/[a-z]{3}-[a-z]{4}-[a-z]{3}$'
    AND last_verified_at>=published_at
    AND num_nonnulls(retired_at,retired_by_id,retirement_basis) IN (0,3)
    AND (retired_at IS NULL OR (retired_at>published_at AND length(trim(retirement_basis)) BETWEEN 5 AND 500))
  )
);
CREATE UNIQUE INDEX teacher_meet_spaces_resource_name_key ON teacher_meet_spaces(resource_name);
CREATE UNIQUE INDEX uq_teacher_meet_active_pair ON teacher_meet_spaces(student_id,teacher_id) WHERE retired_at IS NULL;
CREATE UNIQUE INDEX uq_teacher_meet_active_uri ON teacher_meet_spaces(meeting_uri) WHERE retired_at IS NULL;
CREATE INDEX teacher_meet_spaces_student_id_teacher_id_published_at_idx ON teacher_meet_spaces(student_id,teacher_id,published_at);

CREATE TABLE teacher_meet_operations (
  id uuid PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  teacher_id uuid NOT NULL REFERENCES teacher_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  assignment_id uuid NOT NULL REFERENCES teaching_assignments(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  grant_generation integer NOT NULL,
  google_subject text NOT NULL,
  kind "TeacherMeetOperationKind" NOT NULL,
  state "TeacherMeetOperationState" NOT NULL DEFAULT 'QUEUED',
  request_operation_id uuid NOT NULL,
  queued_at timestamptz(3) NOT NULL,
  dispatch_token text,
  finished_at timestamptz(3),
  diagnostic_code text,
  retry_at timestamptz(3),
  candidate_code text,
  resolves_operation_id uuid REFERENCES teacher_meet_operations(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  space_id uuid REFERENCES teacher_meet_spaces(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  closed_at timestamptz(3),
  closed_by_id uuid REFERENCES staff_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  closure_basis text,
  CONSTRAINT ck_teacher_meet_operation CHECK (
    grant_generation>0 AND google_subject ~ '^[A-Za-z0-9_-]{1,255}$'
    AND (kind='RECONCILE')=(candidate_code IS NOT NULL)
    AND (kind='RECONCILE')=(resolves_operation_id IS NOT NULL)
    AND (candidate_code IS NULL OR candidate_code ~ '^[a-z]{3}-[a-z]{4}-[a-z]{3}$')
    AND (kind<>'VERIFY' OR space_id IS NOT NULL)
    AND (state NOT IN ('SUCCEEDED','RECONCILED') OR space_id IS NOT NULL)
    AND (state NOT IN ('UNKNOWN','RECONCILED','CLOSED_WITHOUT_SPACE') OR kind='CREATE')
    AND (state='DISPATCHING')=(dispatch_token IS NOT NULL)
    AND (state IN ('QUEUED','DISPATCHING'))=(finished_at IS NULL)
    AND (finished_at IS NULL OR finished_at>=queued_at)
    AND (retry_at IS NULL OR (finished_at IS NOT NULL AND retry_at>=finished_at))
    AND (diagnostic_code IS NULL OR diagnostic_code ~ '^[A-Z][A-Z0-9_]{0,79}$')
    AND ((state='CLOSED_WITHOUT_SPACE' AND num_nonnulls(closed_at,closed_by_id,closure_basis)=3
        AND closed_at>=finished_at AND length(trim(closure_basis)) BETWEEN 5 AND 500)
      OR (state<>'CLOSED_WITHOUT_SPACE' AND num_nonnulls(closed_at,closed_by_id,closure_basis)=0))
  )
);
CREATE UNIQUE INDEX teacher_meet_operations_request_operation_id_key ON teacher_meet_operations(request_operation_id);
CREATE UNIQUE INDEX uq_teacher_meet_running_pair ON teacher_meet_operations(student_id,teacher_id) WHERE state IN ('QUEUED','DISPATCHING');
CREATE UNIQUE INDEX uq_teacher_meet_unknown_pair ON teacher_meet_operations(student_id,teacher_id) WHERE state='UNKNOWN';
CREATE INDEX teacher_meet_operations_student_id_teacher_id_queued_at_idx ON teacher_meet_operations(student_id,teacher_id,queued_at);
CREATE INDEX teacher_meet_operations_assignment_id_idx ON teacher_meet_operations(assignment_id);
CREATE INDEX teacher_meet_operations_resolves_operation_id_idx ON teacher_meet_operations(resolves_operation_id);
CREATE INDEX teacher_meet_operations_space_id_idx ON teacher_meet_operations(space_id);

CREATE FUNCTION guard_teacher_meet_operation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.state<>'QUEUED' OR NOT EXISTS(
      SELECT 1 FROM teaching_assignments a JOIN student_subject_enrollments e ON e.id=a.enrollment_id
      JOIN teacher_meet_oauth_grants g ON g.teacher_id=a.teacher_id
      WHERE a.id=NEW.assignment_id AND a.teacher_id=NEW.teacher_id AND e.student_id=NEW.student_id
        AND g.generation=NEW.grant_generation AND g.google_subject=NEW.google_subject
        AND g.disconnected_at IS NULL AND g.refresh_ciphertext IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'Meet operation does not match the assignment and grant' USING ERRCODE='23514';
    END IF;
    IF NEW.kind='RECONCILE' AND NOT EXISTS(
      SELECT 1 FROM teacher_meet_operations o WHERE o.id=NEW.resolves_operation_id
        AND o.teacher_id=NEW.teacher_id AND o.student_id=NEW.student_id AND o.google_subject=NEW.google_subject
        AND o.state='UNKNOWN'
    ) THEN
      RAISE EXCEPTION 'Meet reconciliation must refer to the unresolved pair' USING ERRCODE='23514';
    END IF;
  ELSE
    IF (to_jsonb(OLD)-ARRAY['state','dispatch_token','finished_at','diagnostic_code','retry_at','space_id','closed_at','closed_by_id','closure_basis'])
      IS DISTINCT FROM (to_jsonb(NEW)-ARRAY['state','dispatch_token','finished_at','diagnostic_code','retry_at','space_id','closed_at','closed_by_id','closure_basis'])
      OR (OLD.space_id IS NOT NULL AND OLD.space_id IS DISTINCT FROM NEW.space_id)
      OR NOT (
        (OLD.state='QUEUED' AND NEW.state IN ('DISPATCHING','FAILED')) OR
        (OLD.state='DISPATCHING' AND NEW.state IN ('FAILED','SUCCEEDED','UNKNOWN')) OR
        (OLD.state='DISPATCHING' AND NEW.state='DISPATCHING' AND OLD.kind<>'CREATE') OR
        (OLD.state='UNKNOWN' AND NEW.state IN ('RECONCILED','CLOSED_WITHOUT_SPACE'))
      ) THEN
      RAISE EXCEPTION 'Invalid Meet operation transition' USING ERRCODE='23514';
    END IF;
    IF NEW.state='CLOSED_WITHOUT_SPACE' THEN
      PERFORM t03_assert_director(NEW.closed_by_id,NEW.closed_at);
    END IF;
  END IF;
  IF NEW.space_id IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM teacher_meet_spaces s WHERE s.id=NEW.space_id
      AND s.teacher_id=NEW.teacher_id AND s.student_id=NEW.student_id AND s.google_subject=NEW.google_subject
  ) THEN
    RAISE EXCEPTION 'Meet operation and space pair differ' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_teacher_meet_operation BEFORE INSERT OR UPDATE ON teacher_meet_operations
  FOR EACH ROW EXECUTE FUNCTION guard_teacher_meet_operation();

CREATE FUNCTION guard_teacher_meet_space_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.retired_at IS NOT NULL OR NOT EXISTS(
      SELECT 1 FROM teacher_meet_oauth_grants g
      WHERE g.teacher_id=NEW.teacher_id AND g.google_subject=NEW.google_subject
        AND g.refresh_ciphertext IS NOT NULL AND g.disconnected_at IS NULL
    ) THEN
      RAISE EXCEPTION 'New Meet publication requires its connected teacher' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  IF (to_jsonb(OLD)-ARRAY['last_verified_at','retired_at','retired_by_id','retirement_basis']) IS DISTINCT FROM
    (to_jsonb(NEW)-ARRAY['last_verified_at','retired_at','retired_by_id','retirement_basis'])
    OR NEW.last_verified_at<OLD.last_verified_at OR
    (OLD.retired_at IS NOT NULL AND ROW(OLD.retired_at,OLD.retired_by_id,OLD.retirement_basis)
      IS DISTINCT FROM ROW(NEW.retired_at,NEW.retired_by_id,NEW.retirement_basis)) THEN
    RAISE EXCEPTION 'Published Meet space history is immutable' USING ERRCODE='23514';
  END IF;
  IF OLD.retired_at IS NULL AND NEW.retired_at IS NOT NULL THEN
    PERFORM t03_assert_director(NEW.retired_by_id,NEW.retired_at);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_teacher_meet_space_history BEFORE INSERT OR UPDATE ON teacher_meet_spaces
  FOR EACH ROW EXECUTE FUNCTION guard_teacher_meet_space_history();

CREATE FUNCTION check_teacher_meet_space_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM teacher_meet_operations o WHERE o.space_id=NEW.id AND o.state='SUCCEEDED'
      AND o.kind IN ('CREATE','RECONCILE')
  ) THEN
    RAISE EXCEPTION 'Meet publication requires a settled creation or recovery' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER trg_check_teacher_meet_space_source AFTER INSERT ON teacher_meet_spaces
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_teacher_meet_space_source();

CREATE TRIGGER stu02_meet_space_published AFTER INSERT OR UPDATE OF retired_at ON teacher_meet_spaces
  FOR EACH ROW EXECUTE FUNCTION stu02_invalidate_dashboard();

REVOKE ALL ON teacher_meet_spaces, teacher_meet_operations FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE ON teacher_meet_spaces, teacher_meet_operations TO online_school_runtime;

COMMIT;

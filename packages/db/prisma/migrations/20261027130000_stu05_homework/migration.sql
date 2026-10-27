BEGIN;
ALTER TABLE homework_deliveries ALTER COLUMN due_at DROP NOT NULL;
ALTER TABLE s3_objects ADD COLUMN file_name text;
CREATE TABLE homework_drafts (
  delivery_id uuid PRIMARY KEY REFERENCES homework_deliveries(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  content text NOT NULL CHECK (length(content)<=10000),
  expires_at timestamptz(3) NOT NULL,
  updated_at timestamptz(3) NOT NULL DEFAULT now()
);
CREATE INDEX homework_drafts_expires_at_idx ON homework_drafts(expires_at);
CREATE TABLE homework_uploads (
  file_id uuid PRIMARY KEY REFERENCES s3_objects(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  delivery_id uuid NOT NULL REFERENCES homework_deliveries(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  staging_key text NOT NULL,
  expires_at timestamptz(3) NOT NULL,
  confirmed_at timestamptz(3),
  CHECK (staging_key ~ '^homework/incoming/[0-9a-f-]{36}$')
);
CREATE UNIQUE INDEX homework_uploads_staging_key_key ON homework_uploads(staging_key);
CREATE INDEX homework_uploads_delivery_id_idx ON homework_uploads(delivery_id);
CREATE TABLE homework_submission_attachments (
  submission_id uuid NOT NULL REFERENCES homework_submissions(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  file_id uuid NOT NULL REFERENCES s3_objects(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  PRIMARY KEY (submission_id,file_id)
);
CREATE INDEX homework_submission_attachments_file_id_idx ON homework_submission_attachments(file_id);
CREATE TABLE homework_assignment_attachments (
  assignment_id uuid NOT NULL REFERENCES homework_assignments(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  file_id uuid NOT NULL REFERENCES s3_objects(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  PRIMARY KEY (assignment_id,file_id)
);
CREATE INDEX homework_assignment_attachments_file_id_idx ON homework_assignment_attachments(file_id);

CREATE FUNCTION stu05_guard_submission() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE previous public.homework_submissions%ROWTYPE; review_result public."HomeworkReviewResult";
BEGIN
  PERFORM 1 FROM public.homework_deliveries WHERE id=NEW.delivery_id FOR UPDATE;
  SELECT * INTO previous FROM public.homework_submissions WHERE delivery_id=NEW.delivery_id ORDER BY version DESC LIMIT 1;
  IF previous.id IS NULL THEN
    IF NEW.version<>1 OR NEW.supersedes_submission_id IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='First homework submission must be version 1';
    END IF;
  ELSE
    SELECT result INTO review_result FROM public.submission_reviews WHERE submission_id=previous.id ORDER BY version DESC LIMIT 1;
    IF review_result IS DISTINCT FROM 'NEEDS_REVISION'::public."HomeworkReviewResult" OR NEW.version<>previous.version+1
      OR NEW.supersedes_submission_id IS DISTINCT FROM previous.id OR NEW.submitted_at<previous.submitted_at THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Homework needs revision before the next version';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_stu05_submission BEFORE INSERT ON homework_submissions FOR EACH ROW EXECUTE FUNCTION stu05_guard_submission();

CREATE FUNCTION stu05_guard_upload() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE uploader uuid; owner_id uuid; object_status public."S3ObjectStatus"; object_key text; object_size bigint;
BEGIN
  IF TG_OP='UPDATE' AND (NEW.file_id IS DISTINCT FROM OLD.file_id OR NEW.delivery_id IS DISTINCT FROM OLD.delivery_id
    OR NEW.staging_key IS DISTINCT FROM OLD.staging_key OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
    OR (OLD.confirmed_at IS NOT NULL AND NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at)) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Homework upload identity is immutable';
  END IF;
  SELECT o.uploaded_by,o.status,o.key,o.size INTO uploader,object_status,object_key,object_size FROM public.s3_objects o WHERE o.id=NEW.file_id FOR UPDATE;
  SELECT sa.account_id INTO owner_id FROM public.homework_deliveries d
    JOIN public.student_subject_enrollments e ON e.id=d.enrollment_id
    JOIN public.student_accounts sa ON sa.student_id=e.student_id WHERE d.id=NEW.delivery_id;
  IF uploader IS DISTINCT FROM owner_id OR object_key IS DISTINCT FROM 'homework/final/'||NEW.file_id::text
    OR NEW.staging_key IS DISTINCT FROM 'homework/incoming/'||NEW.file_id::text OR object_size NOT BETWEEN 1 AND 52428800
    OR (NEW.confirmed_at IS NOT NULL AND object_status<>'VERIFIED') THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Homework upload must belong to the student and verified object';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_stu05_upload BEFORE INSERT OR UPDATE ON homework_uploads FOR EACH ROW EXECUTE FUNCTION stu05_guard_upload();

CREATE FUNCTION stu05_guard_attachment() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.homework_submissions h JOIN public.homework_uploads u ON u.delivery_id=h.delivery_id
    JOIN public.s3_objects o ON o.id=u.file_id JOIN public.student_accounts sa ON sa.student_id=h.student_id
    WHERE h.id=NEW.submission_id AND o.id=NEW.file_id AND u.confirmed_at IS NOT NULL
      AND o.status='VERIFIED' AND o.uploaded_by=sa.account_id
      -- Attachments are sealed in the very transaction that creates the immutable version.
      AND h.xmin::text::bigint=mod(pg_current_xact_id()::text::numeric,4294967296)::bigint
  ) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Attachment must be confirmed, owned and part of the new version'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_stu05_attachment BEFORE INSERT ON homework_submission_attachments FOR EACH ROW EXECUTE FUNCTION stu05_guard_attachment();
CREATE TRIGGER trg_stu05_attachment_immutable BEFORE UPDATE OR DELETE ON homework_submission_attachments FOR EACH ROW EXECUTE FUNCTION t03_immutable_record();

CREATE FUNCTION stu05_guard_file_metadata() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.homework_uploads WHERE file_id=OLD.id) AND
    (NEW.file_name IS DISTINCT FROM OLD.file_name OR NEW.size IS DISTINCT FROM OLD.size OR NEW.content_type IS DISTINCT FROM OLD.content_type) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Signed homework metadata is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_stu05_file_metadata BEFORE UPDATE ON s3_objects FOR EACH ROW EXECUTE FUNCTION stu05_guard_file_metadata();
-- Existing textual legacy rubric values are retained, never exposed as student grades.
-- New reviews have only result + comment. Existing append-only review/submission triggers remain in force.
CREATE FUNCTION stu05_no_grades() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE delivery uuid; latest uuid;
BEGIN
  IF NEW.grade IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Homework reviews use text comments and status only'; END IF;
  SELECT delivery_id INTO delivery FROM homework_submissions WHERE id=NEW.submission_id;
  PERFORM 1 FROM homework_deliveries WHERE id=delivery FOR UPDATE;
  SELECT id INTO latest FROM homework_submissions WHERE delivery_id=delivery ORDER BY version DESC LIMIT 1;
  IF NEW.submission_id IS DISTINCT FROM latest THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Only the latest submission can receive a new review';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_stu05_no_grades BEFORE INSERT ON submission_reviews FOR EACH ROW EXECUTE FUNCTION stu05_no_grades();
REVOKE ALL ON homework_drafts,homework_uploads,homework_submission_attachments,homework_assignment_attachments FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE ON homework_drafts,homework_uploads TO online_school_runtime;
GRANT SELECT,INSERT ON homework_submissions,homework_submission_attachments TO online_school_runtime;
-- Row locking needs UPDATE on at least one column, but assignment/ownership fields stay unwritable.
GRANT UPDATE(id) ON homework_deliveries TO online_school_runtime;
GRANT SELECT ON homework_assignment_attachments TO online_school_runtime;
GRANT SELECT,INSERT,UPDATE ON s3_objects TO online_school_runtime;
COMMIT;

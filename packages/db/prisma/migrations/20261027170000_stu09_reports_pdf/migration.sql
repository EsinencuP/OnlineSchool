BEGIN;
ALTER TABLE education_reports ADD COLUMN confirmed_lesson_count_snapshot integer,
  ADD CONSTRAINT ck_stu09_report_lesson_count CHECK(confirmed_lesson_count_snapshot IS NULL OR confirmed_lesson_count_snapshot=8);
CREATE TABLE education_report_reads (
  id uuid PRIMARY KEY,report_id uuid NOT NULL,student_id uuid NOT NULL,read_by uuid NOT NULL,
  read_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT education_report_reads_report_id_fkey FOREIGN KEY(report_id) REFERENCES education_reports(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT education_report_reads_student_id_fkey FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT education_report_reads_read_by_fkey FOREIGN KEY(read_by) REFERENCES auth_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT education_report_reads_report_id_student_id_key UNIQUE(report_id,student_id)
);
CREATE INDEX education_report_reads_student_id_read_at_idx ON education_report_reads(student_id,read_at);
CREATE TABLE pdf_export_jobs (
  id uuid PRIMARY KEY,student_id uuid NOT NULL,requested_by uuid NOT NULL,requested_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  time_zone text NOT NULL,selection jsonb NOT NULL,source_data jsonb,source_as_of timestamptz(3),
  ready_at timestamptz(3),expires_at timestamptz(3),bucket text,object_key text UNIQUE,size_bytes bigint,sha256 char(64),
  CONSTRAINT pdf_export_jobs_id_fkey FOREIGN KEY(id) REFERENCES job_records(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT pdf_export_jobs_student_id_fkey FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT pdf_export_jobs_requested_by_fkey FOREIGN KEY(requested_by) REFERENCES auth_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT ck_stu09_pdf_source CHECK(num_nonnulls(source_data,source_as_of) IN (0,2) AND (source_data IS NULL OR jsonb_typeof(source_data)='object')),
  CONSTRAINT ck_stu09_pdf_ready CHECK(num_nonnulls(ready_at,expires_at,bucket,object_key,size_bytes,sha256) IN (0,6)
    AND (ready_at IS NULL OR (source_as_of IS NOT NULL AND ready_at>=source_as_of AND expires_at=ready_at+interval '1 hour'
      AND size_bytes>0 AND size_bytes<=20971520 AND sha256~'^[a-f0-9]{64}$'))),
  CONSTRAINT ck_stu09_pdf_selection CHECK(jsonb_typeof(selection)='object')
);
CREATE INDEX pdf_export_jobs_student_id_requested_at_idx ON pdf_export_jobs(student_id,requested_at);
CREATE INDEX pdf_export_jobs_expires_at_idx ON pdf_export_jobs(expires_at);
CREATE INDEX idx_stu09_pdf_queue ON job_records(type,next_run_at,id) WHERE status IN ('PENDING','RETRY_WAIT','RUNNING');

CREATE FUNCTION stu09_guard_report_publication() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE student uuid;subject uuid;total integer;actor uuid;stamp timestamptz;key text;
BEGIN
  SELECT e.student_id,e.subject_id INTO student,subject FROM public.progress_checkpoints cp
    JOIN public.student_subject_enrollments e ON e.id=cp.enrollment_id WHERE cp.id=NEW.checkpoint_id AND cp.type='LESSON_8';
  actor=CASE WHEN NEW.status='PUBLISHED' THEN NEW.published_by ELSE NEW.author_id END;
  stamp=CASE WHEN NEW.status='PUBLISHED' THEN NEW.published_at ELSE NEW.created_at END;
  IF student IS NULL OR stamp IS NULL OR stamp>clock_timestamp() OR NOT EXISTS (
    SELECT 1 FROM public.teaching_assignments a JOIN public.student_subject_enrollments e ON e.id=a.enrollment_id
    JOIN public.teacher_accounts t ON t.id=a.teacher_id JOIN public.auth_accounts u ON u.id=t.account_id
    WHERE e.student_id=student AND e.subject_id=subject AND a.teacher_id=actor
      AND a.valid_from<=stamp AND (a.valid_to IS NULL OR a.valid_to>stamp) AND t.deactivated_at IS NULL AND u.disabled_at IS NULL
  ) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Educational report needs an assigned enabled teacher'; END IF;
  IF NEW.status='PUBLISHED' THEN
    IF NEW.author_id IS DISTINCT FROM NEW.published_by OR NEW.period_end>NEW.published_at OR NEW.created_at>NEW.published_at OR jsonb_typeof(NEW.content)<>'object' THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Published report must be its teacher public content';
    END IF;
    IF (NEW.content-ARRAY['achievements','growthAreas','recommendations','teacherSignature'])<>'{}'::jsonb THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Only public report fields may be published';
    END IF;
    FOREACH key IN ARRAY ARRAY['achievements','growthAreas','recommendations','teacherSignature'] LOOP
      IF jsonb_typeof(NEW.content->key) IS DISTINCT FROM 'string' OR length(NEW.content->>key)>20000 THEN
        RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Report public content must contain four bounded text fields';
      END IF;
    END LOOP;
    SELECT count(*) INTO total FROM public.lesson_actual_outcomes o JOIN public.lesson_occurrences l ON l.id=o.lesson_occurrence_id
      JOIN public.student_subject_enrollments e ON e.id=l.enrollment_id
      WHERE e.student_id=student AND e.subject_id=subject AND l.status='CONDUCTED' AND o.confirmed_at<=NEW.published_at
        AND o.actual_started_at>=NEW.period_start AND o.actual_started_at<=NEW.period_end;
    IF total<>8 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Educational report period must contain exactly eight confirmed conducted lessons'; END IF;
    NEW.confirmed_lesson_count_snapshot=total;
  ELSIF NEW.confirmed_lesson_count_snapshot IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Draft cannot carry a published lesson count';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_stu09_report_publication BEFORE INSERT OR UPDATE ON education_reports FOR EACH ROW EXECUTE FUNCTION stu09_guard_report_publication();

CREATE FUNCTION stu09_guard_report_read() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.education_reports r JOIN public.progress_checkpoints cp ON cp.id=r.checkpoint_id
    JOIN public.student_subject_enrollments e ON e.id=cp.enrollment_id
    JOIN public.student_accounts a ON a.student_id=e.student_id
    WHERE r.id=NEW.report_id AND r.status='PUBLISHED' AND r.published_at<=NEW.read_at AND cp.type='LESSON_8'
      AND e.student_id=NEW.student_id AND a.account_id=NEW.read_by AND a.deactivated_at IS NULL
  ) OR NEW.read_at>clock_timestamp() THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Report read must belong to its pupil and login';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_stu09_report_read_context BEFORE INSERT ON education_report_reads FOR EACH ROW EXECUTE FUNCTION stu09_guard_report_read();
CREATE TRIGGER trg_stu09_report_read_immutable BEFORE UPDATE OR DELETE ON education_report_reads FOR EACH ROW EXECUTE FUNCTION t03_immutable_record();

CREATE FUNCTION stu09_guard_pdf_job() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE job public.job_records;
BEGIN
  SELECT * INTO job FROM public.job_records WHERE id=NEW.id;
  IF TG_OP='INSERT' THEN
    IF job.type IS DISTINCT FROM 'student.education-pdf.generate.v1' OR job.payload->>'exportJobId' IS DISTINCT FROM NEW.id::text OR job.payload->>'schemaVersion' IS DISTINCT FROM '1' OR job.status<>'PENDING'
      OR NEW.source_data IS NOT NULL OR NEW.ready_at IS NOT NULL OR NEW.requested_at>clock_timestamp() OR NOT EXISTS (
        SELECT 1 FROM public.student_accounts a JOIN public.students s ON s.id=a.student_id JOIN public.auth_accounts u ON u.id=a.account_id
        WHERE a.student_id=NEW.student_id AND a.account_id=NEW.requested_by AND a.activated_at<=NEW.requested_at
          AND a.deactivated_at IS NULL AND s.archived_at IS NULL AND u.disabled_at IS NULL
      ) OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=NEW.time_zone) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='PDF job needs its original pupil, login and queued work';
    END IF;
  ELSE
    IF OLD.ready_at IS NOT NULL OR (NEW.id,NEW.student_id,NEW.requested_by,NEW.requested_at,NEW.time_zone,NEW.selection)
      IS DISTINCT FROM (OLD.id,OLD.student_id,OLD.requested_by,OLD.requested_at,OLD.time_zone,OLD.selection)
      OR (OLD.source_data IS NOT NULL AND (NEW.source_data,NEW.source_as_of) IS DISTINCT FROM (OLD.source_data,OLD.source_as_of)) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='PDF ownership, frozen source and published result are immutable';
    END IF;
    IF job.status<>'RUNNING' OR job.locked_by IS NULL OR job.locked_until IS NULL OR job.locked_until<=clock_timestamp()
      OR (NEW.source_as_of IS NOT NULL AND (NEW.source_as_of<NEW.requested_at OR NEW.source_as_of>clock_timestamp())) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='PDF work requires a live committed job lease';
    END IF;
    IF NEW.ready_at IS NOT NULL AND (NEW.ready_at>clock_timestamp() OR NEW.object_key IS DISTINCT FROM
      format('student-exports/%s/%s.pdf',NEW.id,job.locked_by)) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='PDF result must belong to the current fenced attempt';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_stu09_pdf_context BEFORE INSERT OR UPDATE ON pdf_export_jobs FOR EACH ROW EXECUTE FUNCTION stu09_guard_pdf_job();
CREATE TRIGGER trg_stu09_pdf_no_delete BEFORE DELETE ON pdf_export_jobs FOR EACH ROW EXECUTE FUNCTION t03_immutable_record();
CREATE FUNCTION stu09_pdf_commit_state() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE job public.job_records;exp public.pdf_export_jobs;
BEGIN
  SELECT * INTO job FROM public.job_records WHERE id=NEW.id;
  IF job.type='student.education-pdf.generate.v1' THEN
    SELECT * INTO exp FROM public.pdf_export_jobs WHERE id=job.id;
    IF exp.id IS NULL OR (job.status='SUCCEEDED') IS DISTINCT FROM (exp.ready_at IS NOT NULL) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='PDF publication and successful work must commit together';
    END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER trg_stu09_pdf_commit AFTER INSERT OR UPDATE ON pdf_export_jobs
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION stu09_pdf_commit_state();
CREATE CONSTRAINT TRIGGER trg_stu09_pdf_work_commit AFTER INSERT OR UPDATE ON job_records
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION stu09_pdf_commit_state();
GRANT SELECT,INSERT ON education_report_reads TO online_school_runtime;
REVOKE UPDATE,DELETE,TRUNCATE ON education_report_reads FROM online_school_runtime;
GRANT SELECT,INSERT,UPDATE ON pdf_export_jobs TO online_school_runtime;
REVOKE DELETE,TRUNCATE ON pdf_export_jobs FROM online_school_runtime;
COMMIT;

BEGIN;
-- FilePermission.subject_id remains the recipient AuthAccount. Educational context is separate.
ALTER TABLE file_permissions
  ADD COLUMN educational_subject_id uuid,
  ADD COLUMN lesson_occurrence_id uuid,
  ADD COLUMN lesson_title text,
  ADD CONSTRAINT fk_stu06_material_subject FOREIGN KEY (educational_subject_id) REFERENCES subjects(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT fk_stu06_material_lesson FOREIGN KEY (lesson_occurrence_id) REFERENCES lesson_occurrences(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT ck_stu06_material_title CHECK (lesson_title IS NULL OR (lesson_occurrence_id IS NOT NULL AND length(lesson_title) BETWEEN 1 AND 500));
CREATE INDEX idx_stu06_student_materials ON file_permissions(subject_id,subject_type,educational_subject_id,granted_at);
CREATE INDEX file_permissions_lesson_occurrence_id_idx ON file_permissions(lesson_occurrence_id);

CREATE FUNCTION stu06_guard_material_context() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE student uuid; lesson_student uuid; lesson_subject uuid;
BEGIN
  -- Contextless legacy grants stay intact. No invented subject/title or historical backfill.
  IF NEW.educational_subject_id IS NULL AND NEW.lesson_occurrence_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.subject_type<>'STUDENT' THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Student material context needs a student recipient';
  END IF;
  SELECT student_id INTO student FROM public.student_accounts WHERE account_id=NEW.subject_id;
  IF student IS NULL THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Material recipient has no student profile'; END IF;
  IF NEW.lesson_occurrence_id IS NOT NULL THEN
    SELECT e.student_id,e.subject_id INTO lesson_student,lesson_subject FROM public.lesson_occurrences l
      JOIN public.student_subject_enrollments e ON e.id=l.enrollment_id WHERE l.id=NEW.lesson_occurrence_id;
    IF lesson_student IS DISTINCT FROM student OR NEW.educational_subject_id IS DISTINCT FROM lesson_subject THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Material lesson must match the student and educational subject';
    END IF;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.student_subject_enrollments e JOIN public.teaching_assignments a ON a.enrollment_id=e.id
    JOIN public.teacher_accounts t ON t.id=a.teacher_id
    WHERE e.student_id=student AND e.subject_id=NEW.educational_subject_id AND t.account_id=NEW.granted_by
      AND e.valid_from<=NEW.granted_at AND (e.valid_to IS NULL OR e.valid_to>NEW.granted_at)
      AND a.valid_from<=NEW.granted_at AND (a.valid_to IS NULL OR a.valid_to>NEW.granted_at)
  ) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Material subject must be taught to this student by its grantor'; END IF;
  RETURN NEW;
END $$;
-- Existing immutable grant guard already allows only revocation updates; context cannot be reassigned.
CREATE TRIGGER trg_stu06_material_context BEFORE INSERT ON file_permissions FOR EACH ROW EXECUTE FUNCTION stu06_guard_material_context();
GRANT SELECT ON file_permissions,s3_objects,file_audit_logs TO online_school_runtime;
GRANT INSERT ON file_audit_logs TO online_school_runtime;
-- Row locks serialize URL issuance with revocation/quarantine. They do not change grant/object identity.
GRANT UPDATE(id) ON file_permissions,s3_objects TO online_school_runtime;
COMMIT;

BEGIN;
CREATE TYPE "StudentSkillStatus" AS ENUM ('NOT_STUDIED','FAMILIARIZING','PRACTICING','APPLYING');
CREATE TYPE "LearningGoalStatus" AS ENUM ('ACTIVE','ACHIEVED','PAUSED','ARCHIVED');
ALTER TABLE skill_entries ADD COLUMN category text NOT NULL DEFAULT '', ADD COLUMN student_id uuid,
  ADD CONSTRAINT "skill_entries_student_id_fkey" FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE skill_assessments ADD COLUMN public_comment text;
ALTER TABLE progress_checkpoints ADD COLUMN completed_by uuid, ADD COLUMN teacher_summary text,
  ADD CONSTRAINT "progress_checkpoints_completed_by_fkey" FOREIGN KEY(completed_by) REFERENCES teacher_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TABLE skill_audit_logs (
  id uuid PRIMARY KEY, assessment_id uuid NOT NULL UNIQUE, enrollment_id uuid NOT NULL,
  skill_id uuid NOT NULL, teacher_id uuid NOT NULL, changed_at timestamptz(3) NOT NULL,
  skill_name text NOT NULL, teacher_name text NOT NULL,
  from_status "StudentSkillStatus" NOT NULL, to_status "StudentSkillStatus" NOT NULL, public_comment text,
  CONSTRAINT "skill_audit_logs_assessment_id_fkey" FOREIGN KEY(assessment_id) REFERENCES skill_assessments(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "skill_audit_logs_enrollment_id_fkey" FOREIGN KEY(enrollment_id) REFERENCES student_subject_enrollments(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "skill_audit_logs_skill_id_fkey" FOREIGN KEY(skill_id) REFERENCES skill_entries(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "skill_audit_logs_teacher_id_fkey" FOREIGN KEY(teacher_id) REFERENCES teacher_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX skill_audit_logs_enrollment_id_skill_id_changed_at_id_idx ON skill_audit_logs(enrollment_id,skill_id,changed_at,id);
CREATE TABLE skill_snapshots (
  id uuid PRIMARY KEY, checkpoint_id uuid NOT NULL UNIQUE, enrollment_id uuid NOT NULL,
  subject_name text NOT NULL, created_at timestamptz(3) NOT NULL,
  lesson_number integer NOT NULL CHECK(lesson_number>0 AND lesson_number%4=0),
  skills jsonb NOT NULL CHECK(jsonb_typeof(skills)='array'), teacher_summary text,
  CONSTRAINT "skill_snapshots_checkpoint_id_fkey" FOREIGN KEY(checkpoint_id) REFERENCES progress_checkpoints(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "skill_snapshots_enrollment_id_fkey" FOREIGN KEY(enrollment_id) REFERENCES student_subject_enrollments(id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX skill_snapshots_enrollment_id_created_at_id_idx ON skill_snapshots(enrollment_id,created_at,id);
CREATE TABLE learning_goals (
  id uuid PRIMARY KEY, enrollment_id uuid NOT NULL, skill_id uuid, text text NOT NULL CHECK(length(trim(text)) BETWEEN 1 AND 4000),
  target_date date, status "LearningGoalStatus" NOT NULL DEFAULT 'ACTIVE',
  created_by uuid NOT NULL, updated_by uuid NOT NULL, created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "learning_goals_enrollment_id_fkey" FOREIGN KEY(enrollment_id) REFERENCES student_subject_enrollments(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "learning_goals_skill_id_fkey" FOREIGN KEY(skill_id) REFERENCES skill_entries(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "learning_goals_created_by_fkey" FOREIGN KEY(created_by) REFERENCES teacher_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "learning_goals_updated_by_fkey" FOREIGN KEY(updated_by) REFERENCES teacher_accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX learning_goals_enrollment_id_created_at_id_idx ON learning_goals(enrollment_id,created_at,id);
CREATE TABLE learning_goal_history (
  id uuid PRIMARY KEY, goal_id uuid NOT NULL, recorded_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  before jsonb, after jsonb NOT NULL,
  CONSTRAINT "learning_goal_history_goal_id_fkey" FOREIGN KEY(goal_id) REFERENCES learning_goals(id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE INDEX learning_goal_history_goal_id_recorded_at_idx ON learning_goal_history(goal_id,recorded_at);

CREATE FUNCTION stu08_skill_status(level text) RETURNS "StudentSkillStatus" LANGUAGE sql IMMUTABLE
SET search_path=pg_catalog,public AS $$
  SELECT CASE level WHEN 'INTRODUCING' THEN 'FAMILIARIZING' WHEN 'PRACTICING' THEN 'PRACTICING'
    WHEN 'APPLYING' THEN 'APPLYING' ELSE 'NOT_STUDIED' END::public."StudentSkillStatus"
$$;

-- Known historical facts only. Previous teacher names/public comments were not stored:
-- capture the current display name at migration, never expose internal basis as a comment.
INSERT INTO skill_audit_logs(id,assessment_id,enrollment_id,skill_id,teacher_id,changed_at,skill_name,teacher_name,from_status,to_status,public_comment)
SELECT a.id,a.id,a.enrollment_id,a.skill_id,a.assessed_by,a.assessed_at,sk.label,t.full_name,
  stu08_skill_status(lag(a.level::text) OVER (PARTITION BY e.student_id,a.skill_id ORDER BY a.assessed_at,a.version,a.id)),
  stu08_skill_status(a.level::text),a.public_comment
FROM skill_assessments a JOIN student_subject_enrollments e ON e.id=a.enrollment_id
JOIN skill_entries sk ON sk.id=a.skill_id JOIN teacher_accounts t ON t.id=a.assessed_by;

CREATE FUNCTION stu08_record_skill() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE enrollment public.student_subject_enrollments; sk public.skill_entries; previous public.skill_assessments;
BEGIN
  SELECT * INTO enrollment FROM public.student_subject_enrollments WHERE id=NEW.enrollment_id;
  -- Serialize a pupil's skill updates across old/new enrollments, not just a subscription.
  PERFORM 1 FROM public.students WHERE id=enrollment.student_id FOR UPDATE;
  SELECT * INTO sk FROM public.skill_entries WHERE id=NEW.skill_id;
  IF sk.subject_id IS DISTINCT FROM enrollment.subject_id OR (sk.student_id IS NOT NULL AND sk.student_id<>enrollment.student_id)
    OR NEW.assessed_at>clock_timestamp() OR NOT EXISTS (
      SELECT 1 FROM public.teaching_assignments a JOIN public.teacher_accounts t ON t.id=a.teacher_id
      JOIN public.auth_accounts u ON u.id=t.account_id
      WHERE a.enrollment_id=NEW.enrollment_id AND a.teacher_id=NEW.assessed_by
        AND a.valid_from<=NEW.assessed_at AND (a.valid_to IS NULL OR a.valid_to>NEW.assessed_at)
        AND t.deactivated_at IS NULL AND u.disabled_at IS NULL
    ) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Skill change needs its assigned teacher and owned context'; END IF;
  IF NEW.lesson_ref IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.lesson_occurrences l JOIN public.lesson_actual_outcomes o ON o.lesson_occurrence_id=l.id
    WHERE l.id=NEW.lesson_ref AND l.enrollment_id=NEW.enrollment_id AND l.status='CONDUCTED' AND o.confirmed_at<=NEW.assessed_at
  ) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Skill evidence lesson must be confirmed conducted'; END IF;
  SELECT a.* INTO previous FROM public.skill_assessments a JOIN public.student_subject_enrollments e ON e.id=a.enrollment_id
    WHERE a.id<>NEW.id AND a.skill_id=NEW.skill_id AND e.student_id=enrollment.student_id
    ORDER BY a.assessed_at DESC,a.version DESC,a.id DESC LIMIT 1;
  IF previous.id IS NOT NULL AND (NEW.assessed_at<=previous.assessed_at OR
    (previous.enrollment_id=NEW.enrollment_id AND NEW.supersedes_assessment_id IS DISTINCT FROM previous.id)) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Skill revision must follow the current assessment';
  END IF;
  INSERT INTO public.skill_audit_logs(id,assessment_id,enrollment_id,skill_id,teacher_id,changed_at,skill_name,teacher_name,from_status,to_status,public_comment)
  SELECT NEW.id,NEW.id,NEW.enrollment_id,NEW.skill_id,NEW.assessed_by,NEW.assessed_at,sk.label,t.full_name,
    public.stu08_skill_status(previous.level::text),public.stu08_skill_status(NEW.level::text),NEW.public_comment
  FROM public.teacher_accounts t WHERE t.id=NEW.assessed_by;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_stu08_skill_audit AFTER INSERT ON skill_assessments FOR EACH ROW EXECUTE FUNCTION stu08_record_skill();

CREATE FUNCTION stu08_guard_skill_identity() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF (NEW.id,NEW.subject_id,NEW.student_id) IS DISTINCT FROM (OLD.id,OLD.subject_id,OLD.student_id) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Skill subject and personal owner are immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_stu08_skill_identity BEFORE UPDATE ON skill_entries FOR EACH ROW EXECUTE FUNCTION stu08_guard_skill_identity();

-- Preserve the old 8-lesson report model, but count the subject across re-enrollments.
DROP TRIGGER trg_t04_education ON progress_checkpoints;
CREATE FUNCTION stu08_guard_checkpoint() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE enrollment public.student_subject_enrollments; total integer;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF OLD.completed_at IS NOT NULL OR (NEW.id,NEW.enrollment_id,NEW.type,NEW.confirmed_lesson_count,NEW.lesson_actual_outcome_id,NEW.triggered_at,NEW.source_operation_id)
      IS DISTINCT FROM (OLD.id,OLD.enrollment_id,OLD.type,OLD.confirmed_lesson_count,OLD.lesson_actual_outcome_id,OLD.triggered_at,OLD.source_operation_id) THEN
      RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Confirmed review and checkpoint identity are immutable';
    END IF;
  END IF;
  SELECT * INTO enrollment FROM public.student_subject_enrollments WHERE id=NEW.enrollment_id;
  PERFORM 1 FROM public.students WHERE id=enrollment.student_id FOR UPDATE;
  SELECT count(*) INTO total FROM public.lesson_actual_outcomes o JOIN public.lesson_occurrences l ON l.id=o.lesson_occurrence_id
    JOIN public.student_subject_enrollments e ON e.id=l.enrollment_id
    WHERE e.student_id=enrollment.student_id AND e.subject_id=enrollment.subject_id AND l.status='CONDUCTED' AND o.confirmed_at<=NEW.triggered_at;
  IF NEW.triggered_at>clock_timestamp() OR total<>NEW.confirmed_lesson_count OR NOT EXISTS (
    SELECT 1 FROM public.lesson_actual_outcomes o JOIN public.lesson_occurrences l ON l.id=o.lesson_occurrence_id
    WHERE o.id=NEW.lesson_actual_outcome_id AND l.enrollment_id=NEW.enrollment_id AND l.status='CONDUCTED' AND o.confirmed_at<=NEW.triggered_at
  ) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Checkpoint needs exact confirmed subject lesson count'; END IF;
  IF NEW.completed_at IS NOT NULL THEN
    IF NEW.completed_at<NEW.triggered_at OR NEW.completed_at>clock_timestamp() OR NOT EXISTS (
      SELECT 1 FROM public.teaching_assignments a JOIN public.teacher_accounts t ON t.id=a.teacher_id
      JOIN public.auth_accounts u ON u.id=t.account_id
      WHERE a.enrollment_id=NEW.enrollment_id AND a.teacher_id=NEW.completed_by AND a.valid_from<=NEW.completed_at
        AND (a.valid_to IS NULL OR a.valid_to>NEW.completed_at) AND t.deactivated_at IS NULL AND u.disabled_at IS NULL
    ) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Review confirmation needs assigned teacher'; END IF;
  ELSIF NEW.completed_by IS NOT NULL OR NEW.teacher_summary IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Unconfirmed review cannot publish a summary';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_stu08_checkpoint BEFORE INSERT OR UPDATE ON progress_checkpoints FOR EACH ROW EXECUTE FUNCTION stu08_guard_checkpoint();

CREATE FUNCTION stu08_freeze_snapshot() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE enrollment public.student_subject_enrollments;
BEGIN
  IF NEW.type<>'LESSON_4' OR NEW.completed_at IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO enrollment FROM public.student_subject_enrollments WHERE id=NEW.enrollment_id;
  INSERT INTO public.skill_snapshots(id,checkpoint_id,enrollment_id,subject_name,created_at,lesson_number,skills,teacher_summary)
  SELECT NEW.id,NEW.id,NEW.enrollment_id,s.name,NEW.completed_at,NEW.confirmed_lesson_count,
    coalesce((SELECT jsonb_agg(jsonb_build_object('skillName',sk.label,'status',public.stu08_skill_status(a.level::text),
      'teacherComment',a.public_comment) ORDER BY sk.category,sk.label,sk.id)
      FROM public.skill_entries sk LEFT JOIN LATERAL (
        SELECT sa.* FROM public.skill_assessments sa JOIN public.student_subject_enrollments e ON e.id=sa.enrollment_id
        WHERE sa.skill_id=sk.id AND e.student_id=enrollment.student_id AND e.subject_id=enrollment.subject_id AND sa.assessed_at<=NEW.completed_at
          AND (sa.lesson_ref IS NULL OR EXISTS (SELECT 1 FROM public.lesson_occurrences l JOIN public.lesson_actual_outcomes o ON o.lesson_occurrence_id=l.id
            WHERE l.id=sa.lesson_ref AND l.status='CONDUCTED' AND o.confirmed_at<=NEW.completed_at))
        ORDER BY sa.assessed_at DESC,sa.version DESC,sa.id DESC LIMIT 1
      ) a ON true WHERE sk.subject_id=s.id AND sk.archived_at IS NULL AND sk.created_at<=NEW.completed_at
        AND (sk.student_id IS NULL OR sk.student_id=enrollment.student_id)), '[]'::jsonb),NEW.teacher_summary
  FROM public.subjects s WHERE s.id=enrollment.subject_id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_stu08_snapshot AFTER INSERT OR UPDATE ON progress_checkpoints FOR EACH ROW EXECUTE FUNCTION stu08_freeze_snapshot();

CREATE FUNCTION stu08_guard_goal() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE enrollment public.student_subject_enrollments;
BEGIN
  SELECT * INTO enrollment FROM public.student_subject_enrollments WHERE id=NEW.enrollment_id;
  IF TG_OP='UPDATE' AND (NEW.id,NEW.enrollment_id,NEW.skill_id,NEW.created_by,NEW.created_at)
    IS DISTINCT FROM (OLD.id,OLD.enrollment_id,OLD.skill_id,OLD.created_by,OLD.created_at) THEN
    RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Goal identity is immutable';
  END IF;
  IF (TG_OP='INSERT' AND NEW.created_by<>NEW.updated_by) OR NEW.created_at>clock_timestamp() OR NOT EXISTS (
    SELECT 1 FROM public.teaching_assignments a JOIN public.teacher_accounts t ON t.id=a.teacher_id
    JOIN public.auth_accounts u ON u.id=t.account_id
    WHERE a.enrollment_id=NEW.enrollment_id AND a.teacher_id=NEW.updated_by AND a.valid_from<=clock_timestamp()
      AND (a.valid_to IS NULL OR a.valid_to>clock_timestamp()) AND t.deactivated_at IS NULL AND u.disabled_at IS NULL
  ) OR (NEW.skill_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.skill_entries sk WHERE sk.id=NEW.skill_id AND sk.subject_id=enrollment.subject_id
      AND (sk.student_id IS NULL OR sk.student_id=enrollment.student_id)
  )) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Goal needs assigned teacher and owned subject/skill'; END IF;
  NEW.updated_at=clock_timestamp();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_stu08_goal BEFORE INSERT OR UPDATE ON learning_goals FOR EACH ROW EXECUTE FUNCTION stu08_guard_goal();
CREATE FUNCTION stu08_record_goal() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  INSERT INTO public.learning_goal_history(id,goal_id,before,after)
    VALUES(gen_random_uuid(),NEW.id,CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,to_jsonb(NEW));
  RETURN NEW;
END $$;
CREATE TRIGGER trg_stu08_goal_history AFTER INSERT OR UPDATE ON learning_goals FOR EACH ROW EXECUTE FUNCTION stu08_record_goal();

CREATE TRIGGER trg_stu08_audit_immutable BEFORE UPDATE OR DELETE ON skill_audit_logs FOR EACH ROW EXECUTE FUNCTION t03_immutable_record();
CREATE TRIGGER trg_stu08_snapshot_immutable BEFORE UPDATE OR DELETE ON skill_snapshots FOR EACH ROW EXECUTE FUNCTION t03_immutable_record();
CREATE TRIGGER trg_stu08_goal_history_immutable BEFORE UPDATE OR DELETE ON learning_goal_history FOR EACH ROW EXECUTE FUNCTION t03_immutable_record();
CREATE TRIGGER trg_stu08_goal_no_delete BEFORE DELETE ON learning_goals FOR EACH ROW EXECUTE FUNCTION t03_immutable_record();
-- These three derived/history tables can only be written by their exact trigger paths.
REVOKE ALL ON FUNCTION stu08_record_skill(),stu08_freeze_snapshot(),stu08_record_goal() FROM PUBLIC;
GRANT SELECT ON skill_audit_logs,skill_snapshots,learning_goals,learning_goal_history TO online_school_runtime;
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON skill_audit_logs,skill_snapshots,learning_goal_history FROM online_school_runtime;
GRANT INSERT,UPDATE ON learning_goals TO online_school_runtime;
REVOKE DELETE,TRUNCATE ON learning_goals FROM online_school_runtime;
COMMIT;

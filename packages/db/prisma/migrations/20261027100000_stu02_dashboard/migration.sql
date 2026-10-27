BEGIN;
-- Reused by all occurrences of this teacher/student enrollment assignment.
ALTER TABLE teaching_assignments ADD COLUMN google_meet_link text;
ALTER TABLE teaching_assignments ADD CONSTRAINT ck_assignment_meet_link
  CHECK (google_meet_link IS NULL OR google_meet_link ~ '^https://meet[.]google[.]com/[a-z]{3}-[a-z]{4}-[a-z]{3}$');

CREATE TABLE student_dashboard_revisions (
  student_id uuid PRIMARY KEY,
  revision bigint NOT NULL DEFAULT 0 CHECK (revision >= 0),
  updated_at timestamptz(3) NOT NULL DEFAULT now(),
  CONSTRAINT fk_dashboard_revision_student FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE RESTRICT
);
REVOKE ALL ON student_dashboard_revisions FROM PUBLIC;
REVOKE ALL ON student_dashboard_revisions FROM online_school_runtime;
GRANT SELECT ON student_dashboard_revisions TO online_school_runtime;
-- Earlier infrastructure left educational tables unavailable to the runtime role.
-- Dashboard needs read access; no write/DDL privileges are added here.
GRANT SELECT ON homework_assignments,homework_deliveries,homework_submissions,submission_reviews,
  skill_entries,skill_assessments TO online_school_runtime;

-- Resolve OLD as well as NEW ownership: moving a record invalidates both students.
CREATE FUNCTION stu02_dashboard_students(tab text, d jsonb) RETURNS SETOF uuid
LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
  SELECT (d->>'student_id')::uuid WHERE d ? 'student_id'
  UNION
  SELECT e.student_id FROM public.student_subject_enrollments e WHERE e.id=(d->>'enrollment_id')::uuid
  UNION
  SELECT e.student_id FROM public.subscriptions s JOIN public.student_subject_enrollments e ON e.id=s.enrollment_id WHERE s.id=(d->>'subscription_id')::uuid
  UNION
  SELECT e.student_id FROM public.entitlement_grants g JOIN public.subscriptions s ON s.id=g.subscription_id JOIN public.student_subject_enrollments e ON e.id=s.enrollment_id
    WHERE tab='entitlement_adjustments' AND g.id=(d->>'grant_id')::uuid
  UNION
  SELECT e.student_id FROM public.homework_submissions hs JOIN public.homework_deliveries hd ON hd.id=hs.delivery_id JOIN public.student_subject_enrollments e ON e.id=hd.enrollment_id
    WHERE tab='submission_reviews' AND hs.id=(d->>'submission_id')::uuid
  UNION
  SELECT e.student_id FROM public.homework_deliveries hd JOIN public.student_subject_enrollments e ON e.id=hd.enrollment_id
    WHERE tab='homework_assignments' AND hd.assignment_id=(d->>'id')::uuid
  UNION
  SELECT e.student_id FROM public.student_subject_enrollments e WHERE
    (tab='skill_entries' AND e.subject_id=(d->>'subject_id')::uuid) OR (tab='subjects' AND e.subject_id=(d->>'id')::uuid)
  UNION
  SELECT e.student_id FROM public.teaching_assignments a JOIN public.student_subject_enrollments e ON e.id=a.enrollment_id
    WHERE tab='teacher_accounts' AND a.teacher_id=(d->>'id')::uuid
  UNION
  SELECT e.student_id FROM public.payment_distributions pd JOIN public.subscriptions s ON s.id=pd.subscription_id JOIN public.student_subject_enrollments e ON e.id=s.enrollment_id
    WHERE tab='payment_receipts' AND pd.payment_id=(d->>'id')::uuid
  UNION
  SELECT e.student_id FROM public.lesson_occurrences l JOIN public.student_subject_enrollments e ON e.id=l.enrollment_id
    WHERE tab='lesson_actual_outcomes' AND l.id=(d->>'lesson_occurrence_id')::uuid
$$;
REVOKE ALL ON FUNCTION stu02_dashboard_students(text,jsonb) FROM PUBLIC;

CREATE FUNCTION stu02_invalidate_dashboard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE before_row jsonb; after_row jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN before_row=to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN after_row=to_jsonb(NEW); END IF;
  INSERT INTO public.student_dashboard_revisions(student_id,revision,updated_at)
    SELECT student_id,1,clock_timestamp() FROM (
      SELECT public.stu02_dashboard_students(TG_TABLE_NAME,before_row) AS student_id
      UNION SELECT public.stu02_dashboard_students(TG_TABLE_NAME,after_row)
    ) affected WHERE student_id IS NOT NULL ORDER BY student_id
    ON CONFLICT(student_id) DO UPDATE SET revision=public.student_dashboard_revisions.revision+1,updated_at=clock_timestamp();
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION stu02_invalidate_dashboard() FROM PUBLIC;

DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['student_subject_enrollments','teaching_assignments','lesson_occurrences',
    'homework_assignments','homework_deliveries','homework_submissions','submission_reviews',
    'subscriptions','entitlement_grants','entitlement_consumptions','entitlement_adjustments',
    'temporary_access_permissions','payment_distributions','payment_receipts',
    'skill_entries','skill_assessments','subjects','teacher_accounts','lesson_actual_outcomes'] LOOP
    EXECUTE format('CREATE TRIGGER stu02_dashboard_changed AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION stu02_invalidate_dashboard()',tab);
  END LOOP;
END $$;
COMMIT;

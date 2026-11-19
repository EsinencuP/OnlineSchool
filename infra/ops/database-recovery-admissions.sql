WITH records(name, id, record) AS (
  SELECT 'lesson_admission_starts', r.lesson_id, to_jsonb(r) FROM public.lesson_admission_starts r
  UNION ALL
  SELECT 'temporary_access_permissions', r.id, to_jsonb(r) FROM public.temporary_access_permissions r
), fingerprints AS (
  SELECT dataset.name, count(r.id) AS rows,
    encode(sha256(convert_to(coalesce(string_agg(
      encode(sha256(convert_to(r.record::text,'UTF8')),'hex'), '' ORDER BY r.id),''),'UTF8')),'hex') AS digest
  FROM (VALUES ('lesson_admission_starts'), ('temporary_access_permissions')) AS dataset(name)
  LEFT JOIN records r ON r.name=dataset.name GROUP BY dataset.name
)
SELECT jsonb_build_object(
  'ADMISSION_CAPACITY_EXCEEDED', (SELECT count(*) FROM public.temporary_access_permissions p
    WHERE public.t03_admission_slots_used(p.id,NULL,NULL)>p.max_lessons),
  'ADMISSION_START_OUTCOME_MISMATCH', (SELECT count(*) FROM public.lesson_admission_starts h
    LEFT JOIN public.lesson_occurrences l ON l.id=h.lesson_id
    LEFT JOIN public.lesson_actual_outcomes o ON o.lesson_occurrence_id=h.lesson_id
    WHERE l.actual_start_at IS DISTINCT FROM h.admitted_at
      OR ((l.status='CONDUCTED' OR o.id IS NOT NULL) AND o.temporary_access_permission_id IS DISTINCT FROM h.permission_id))
) AS checks,
(SELECT jsonb_object_agg(name,jsonb_build_object('rows',rows,'digest',digest)) FROM fingerprints) AS datasets;

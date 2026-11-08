import { Prisma } from '@online-school/db';
import type { HistoryPage } from '../history/history.dto.js';

// A draft correction never hides the preceding published version. A published
// correction is a new immutable version and becomes unread independently.
export function publishedReportsCte(studentId: string, time: Date) {
  return Prisma.sql`WITH published_reports AS (
    SELECT r.*,cp.confirmed_lesson_count,e.subject_id,e.student_id,s.name AS subject_name,t.full_name AS teacher_name
    FROM education_reports r JOIN progress_checkpoints cp ON cp.id=r.checkpoint_id
    JOIN student_subject_enrollments e ON e.id=cp.enrollment_id
    JOIN subjects s ON s.id=e.subject_id JOIN teacher_accounts t ON t.id=r.author_id
    WHERE e.student_id=${studentId}::uuid AND cp.type='LESSON_8' AND r.status='PUBLISHED'
      AND r.published_at IS NOT NULL AND r.published_at<=${time}
      AND (r.confirmed_lesson_count_snapshot=8 OR (r.confirmed_lesson_count_snapshot IS NULL AND (
        SELECT count(*) FROM lesson_actual_outcomes o JOIN lesson_occurrences l ON l.id=o.lesson_occurrence_id
        JOIN student_subject_enrollments se ON se.id=l.enrollment_id
        WHERE se.student_id=e.student_id AND se.subject_id=e.subject_id AND l.status='CONDUCTED'
          AND o.confirmed_at<=r.published_at AND o.actual_started_at>=r.period_start AND o.actual_started_at<=r.period_end
      )=8))
      AND NOT EXISTS(SELECT 1 FROM education_reports newer WHERE newer.checkpoint_id=r.checkpoint_id
        AND newer.status='PUBLISHED' AND newer.published_at IS NOT NULL AND newer.published_at<=${time}
        AND newer.version>r.version)
  )`;
}
export const reportJson = Prisma.sql`jsonb_build_object('reportId',r.id,'subjectName',r.subject_name,
  'createdAt',r.created_at,'periodFrom',r.period_start,'periodTo',r.period_end,
  'lessonCount',8,'teacherName',r.teacher_name,'content',jsonb_build_object(
    'achievements',CASE WHEN jsonb_typeof(r.content->'achievements')='string' THEN r.content->>'achievements' ELSE '' END,
    'growthAreas',CASE WHEN jsonb_typeof(r.content->'growthAreas')='string' THEN r.content->>'growthAreas' ELSE '' END,
    'recommendations',CASE WHEN jsonb_typeof(r.content->'recommendations')='string' THEN r.content->>'recommendations' ELSE '' END,
    'teacherSignature',CASE WHEN jsonb_typeof(r.content->'teacherSignature')='string' THEN r.content->>'teacherSignature' ELSE '' END),
  'isNew',NOT EXISTS(SELECT 1 FROM education_report_reads rr WHERE rr.report_id=r.id AND rr.student_id=r.student_id))`;
export function studentReportsSql(studentId: string, query: HistoryPage, time: Date) {
  return Prisma.sql`${publishedReportsCte(studentId, time)}, page AS (
    SELECT * FROM published_reports ORDER BY created_at DESC,id DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}
  ) SELECT coalesce((SELECT jsonb_agg(${reportJson} ORDER BY r.created_at DESC,r.id DESC) FROM page r),'[]'::jsonb) AS items,
    (SELECT count(*)::int FROM published_reports) AS total`;
}

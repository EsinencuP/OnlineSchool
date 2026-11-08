import { Prisma } from '@online-school/db';
import type { HistoryPage } from '../history/history.dto.js';
import type { SkillAuditQuery, SkillSelection } from './skills.dto.js';

// Re-enrollment, teacher replacement and new subscriptions do not reset subject history.
const scope = (studentId: string, time: Date) => Prisma.sql`
  WITH owned_enrollments AS (
    SELECT e.* FROM student_subject_enrollments e
    WHERE e.student_id=${studentId}::uuid AND e.valid_from<=${time}
  ), owned_subjects AS (
    SELECT DISTINCT s.id,s.name FROM subjects s JOIN owned_enrollments e ON e.subject_id=s.id
  )`;
const status = (level: Prisma.Sql) => Prisma.sql`CASE ${level}::text
  WHEN 'INTRODUCING' THEN 'FAMILIARIZING' WHEN 'PRACTICING' THEN 'PRACTICING'
  WHEN 'APPLYING' THEN 'APPLYING' ELSE 'NOT_STUDIED' END`;

export function skillMapSql(studentId: string, query: SkillSelection, time: Date) {
  return Prisma.sql`${scope(studentId, time)}, selected AS (
    SELECT * FROM owned_subjects ${query.subjectId ? Prisma.sql`WHERE id=${query.subjectId}::uuid` : Prisma.empty}
  ), maps AS (
    SELECT s.id,s.name,jsonb_build_object(
      'subjectId',s.id,'subjectName',s.name,
      'totalSkills',jsonb_array_length(skills.data),'skills',skills.data,
      'learningGoals',(SELECT coalesce(jsonb_agg(jsonb_build_object(
        'goalId',g.id,'text',g.text,'targetDate',g.target_date,'isAchieved',g.status='ACHIEVED')
        ORDER BY g.created_at,g.id),'[]'::jsonb)
        FROM learning_goals g JOIN owned_enrollments e ON e.id=g.enrollment_id
        WHERE e.subject_id=s.id AND g.status<>'ARCHIVED' AND g.created_at<=${time}),
      'lastSnapshotAt',(SELECT max(ss.created_at) FROM skill_snapshots ss
        JOIN owned_enrollments e ON e.id=ss.enrollment_id WHERE e.subject_id=s.id AND ss.created_at<=${time}),
      'nextSnapshotIn',4-((SELECT count(*) FROM lesson_actual_outcomes o
        JOIN lesson_occurrences l ON l.id=o.lesson_occurrence_id JOIN owned_enrollments e ON e.id=l.enrollment_id
        WHERE e.subject_id=s.id AND l.status='CONDUCTED' AND o.confirmed_at<=${time}) % 4)
    ) AS data
    FROM selected s CROSS JOIN LATERAL (
      SELECT coalesce(jsonb_agg(jsonb_build_object('skillId',sk.id,'name',sk.label,'category',sk.category,
        'status',${status(Prisma.sql`a.level`)},'lastUpdatedAt',coalesce(a.assessed_at,sk.created_at),
        'lastUpdatedByTeacherName',coalesce(t.full_name,'')) ORDER BY sk.category,sk.label,sk.id),'[]'::jsonb) AS data
      FROM skill_entries sk LEFT JOIN LATERAL (
        SELECT sa.* FROM skill_assessments sa JOIN owned_enrollments e ON e.id=sa.enrollment_id
        WHERE sa.skill_id=sk.id AND e.subject_id=s.id AND sa.assessed_at<=${time}
          AND (sa.lesson_ref IS NULL OR EXISTS(SELECT 1 FROM lesson_actual_outcomes o
            JOIN lesson_occurrences l ON l.id=o.lesson_occurrence_id
            WHERE o.lesson_occurrence_id=sa.lesson_ref AND l.status='CONDUCTED' AND o.confirmed_at<=${time}))
        ORDER BY sa.assessed_at DESC,sa.version DESC,sa.id DESC LIMIT 1
      ) a ON true LEFT JOIN teacher_accounts t ON t.id=a.assessed_by
      WHERE sk.subject_id=s.id AND sk.archived_at IS NULL AND sk.created_at<=${time}
        AND (sk.student_id IS NULL OR sk.student_id=${studentId}::uuid)
    ) skills
  ) SELECT ${query.subjectId ? Prisma.sql`NOT EXISTS(SELECT 1 FROM selected)` : Prisma.sql`false`} AS forbidden,
    coalesce((SELECT jsonb_agg(data ORDER BY name,id) FROM maps),'[]'::jsonb) AS data`;
}
export function skillAuditSql(studentId: string, query: SkillAuditQuery, time: Date) {
  return Prisma.sql`${scope(studentId, time)}, visible_skill AS (
    SELECT sk.id FROM skill_entries sk JOIN owned_subjects s ON s.id=sk.subject_id
    WHERE sk.id=${query.skillId}::uuid AND (sk.student_id IS NULL OR sk.student_id=${studentId}::uuid)
      AND sk.created_at<=${time}
  ), history AS (
    SELECT a.id,a.changed_at,jsonb_build_object('auditId',a.id,'skillId',a.skill_id,
      'skillName',a.skill_name,'changedAt',a.changed_at,'fromStatus',a.from_status,'toStatus',a.to_status,
      'teacherName',a.teacher_name,'comment',a.public_comment) AS data
    FROM skill_audit_logs a JOIN owned_enrollments e ON e.id=a.enrollment_id
    JOIN skill_assessments sa ON sa.id=a.assessment_id
    JOIN visible_skill sk ON sk.id=a.skill_id WHERE a.changed_at<=${time}
      AND (sa.lesson_ref IS NULL OR EXISTS(SELECT 1 FROM lesson_actual_outcomes o
        JOIN lesson_occurrences l ON l.id=o.lesson_occurrence_id
        WHERE l.id=sa.lesson_ref AND l.status='CONDUCTED' AND o.confirmed_at<=${time}))
  ), page AS (SELECT * FROM history ORDER BY changed_at DESC,id DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize})
  SELECT NOT EXISTS(SELECT 1 FROM visible_skill) AS forbidden,
    jsonb_build_object('total',(SELECT count(*) FROM history),
      'items',coalesce((SELECT jsonb_agg(data ORDER BY changed_at DESC,id DESC) FROM page),'[]'::jsonb)) AS data`;
}
export function skillSnapshotsSql(studentId: string, query: HistoryPage, time: Date) {
  return Prisma.sql`${scope(studentId, time)}, history AS (
    SELECT ss.id,ss.created_at,jsonb_build_object('snapshotId',ss.id,'subjectName',ss.subject_name,
      'createdAt',ss.created_at,'lessonNumber',ss.lesson_number,'skills',ss.skills,
      'teacherSummary',ss.teacher_summary) AS data
    FROM skill_snapshots ss JOIN owned_enrollments e ON e.id=ss.enrollment_id
    WHERE ss.created_at<=${time}
  ), page AS (SELECT * FROM history ORDER BY created_at DESC,id DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize})
  SELECT false AS forbidden,jsonb_build_object('total',(SELECT count(*) FROM history),
    'items',coalesce((SELECT jsonb_agg(data ORDER BY created_at DESC,id DESC) FROM page),'[]'::jsonb)) AS data`;
}

import { Prisma } from '@online-school/db';
import { subscriptionSelectionSql } from '../../../student/subscription/subscription.sql.js';
import { studentCrmStatusSql } from '../students/student-status.sql.js';
import { upcomingLessonSql, hasMeetLinkSql } from '../schedule/schedule-read.spec.js';
import { taskVisibleSql, taskOverdueSql, taskPublicTypeSql } from '../tasks/task-read.spec.js';
import {
  managedSubscriptionTotalsSql,
  expiringSubscriptionSql,
} from '../../finance/manager-subscriptions/read-spec.js';
export const dashboardStudentsSql = (
  scope: Prisma.Sql,
  now: Date,
): Prisma.Sql => Prisma.sql`/* mgr09:students */ WITH statuses AS(
 SELECT ${studentCrmStatusSql(now)} AS status FROM students st
 LEFT JOIN LATERAL(${subscriptionSelectionSql(Prisma.sql`st.id`, {}, now, { startedOnly: true })} SELECT * FROM selected) sub ON true WHERE ${scope})
 SELECT count(*) FILTER(WHERE status='ACTIVE')::int AS active,count(*) FILTER(WHERE status='FROZEN')::int AS frozen,count(*) FILTER(WHERE status='LEAD')::int AS leads FROM statuses`;
export const dashboardLessonsSql = (
  scope: Prisma.Sql,
  now: Date,
  until: Date,
): Prisma.Sql => Prisma.sql`/* mgr09:lessons */ SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."startsAt",x."lessonId"),'[]'::jsonb) AS items FROM(
 SELECT l.id AS "lessonId",st.id AS "studentId",st.full_name AS "studentName",l.scheduled_at AS "startsAt",teacher.full_name AS "teacherName",${hasMeetLinkSql()} AS "hasMeetLink"
 FROM students st JOIN student_subject_enrollments e ON e.student_id=st.id JOIN lesson_occurrences l ON l.enrollment_id=e.id
 JOIN teacher_accounts teacher ON teacher.id=l.scheduled_teacher_id JOIN teaching_assignments a ON a.id=l.teaching_assignment_id
 WHERE ${scope} AND ${upcomingLessonSql(now, until)} ORDER BY l.scheduled_at,l.id LIMIT 10)x`;
export const dashboardTasksSql = (
  scope: Prisma.Sql,
  now: Date,
  leadScope: Prisma.Sql = Prisma.sql`false`,
): Prisma.Sql => Prisma.sql`/* mgr09:tasks */ WITH overdue AS(
 SELECT t.id AS "taskId",${taskPublicTypeSql()} AS type,st.full_name AS "studentName",t.due_at AS "dueAt"
 FROM students st JOIN crm_tasks t ON t.student_id=st.id WHERE t.lead_id IS NULL AND ${scope} AND ${taskVisibleSql()} AND ${taskOverdueSql(now)}
 UNION ALL SELECT t.id AS "taskId",t.type::text AS type,ld.full_name AS "studentName",t.due_at AS "dueAt" FROM leads ld JOIN crm_tasks t ON t.lead_id=ld.id
 WHERE ${leadScope} AND t.type::text IN('LEAD_FOLLOWUP','ASSIGN_TEACHER') AND ${taskOverdueSql(now)}), oldest AS(SELECT * FROM overdue ORDER BY "dueAt","taskId" LIMIT 5)
 SELECT (SELECT count(*)::int FROM overdue) AS count,coalesce((SELECT jsonb_agg(to_jsonb(oldest) ORDER BY "dueAt","taskId") FROM oldest),'[]'::jsonb) AS top`;
export const dashboardSubscriptionsSql = (
  scope: Prisma.Sql,
  now: Date,
  until: Date,
): Prisma.Sql => Prisma.sql`/* mgr09:subscriptions */ WITH candidates AS(
 SELECT ms.id,st.id AS student_id,st.full_name,ms.ends_at FROM students st JOIN student_subject_enrollments e ON e.student_id=st.id JOIN manager_subscriptions ms ON ms.enrollment_id=e.id
 WHERE ${scope} AND ${expiringSubscriptionSql(now, until)} ORDER BY ms.ends_at,ms.id LIMIT 10)
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x."endsAt",x."subscriptionId"),'[]'::jsonb) AS items FROM(
 SELECT ms.id AS "subscriptionId",ms.student_id AS "studentId",ms.full_name AS "studentName",ms.ends_at AS "endsAt",totals.remaining AS "remainingLessons"
 FROM candidates ms
 CROSS JOIN LATERAL(${managedSubscriptionTotalsSql(Prisma.sql`ms.id`, now)}) totals
 )x`;
// These aggregates each return one row, so combining them cannot multiply counts.
export const dashboardOverviewSql = (
  scope: Prisma.Sql,
  now: Date,
  until: Date,
  leadScope: Prisma.Sql = Prisma.sql`false`,
): Prisma.Sql => Prisma.sql`/* mgr09:overview */
 SELECT to_jsonb(students) AS students,lessons.items AS "upcomingLessons",jsonb_build_object('count',tasks.count,'top',tasks.top) AS "overdueTasks"
 FROM(${dashboardStudentsSql(scope, now)}) students CROSS JOIN(${dashboardLessonsSql(scope, now, until)}) lessons CROSS JOIN(${dashboardTasksSql(scope, now, leadScope)}) tasks`;

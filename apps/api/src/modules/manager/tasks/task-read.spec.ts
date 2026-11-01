import { Prisma } from '@online-school/db';
import { TASK_STORAGE_TYPES } from './contracts.js';
export const OPEN_TASK_STATUSES = ['OPEN', 'IN_PROGRESS'] as const;
export const taskPortfolioWhere = (
  portfolio: Prisma.StudentWhereInput,
): Prisma.CrmTaskWhereInput => ({
  type: { in: [...TASK_STORAGE_TYPES] },
  student: { is: portfolio },
});
export const taskOverdueWhere = (now: Date): Prisma.CrmTaskWhereInput => ({
  due_at: { lt: now },
  status: { in: [...OPEN_TASK_STATUSES] },
});
export const taskOpenSql = (): Prisma.Sql =>
  Prisma.sql`t.status::text IN (${Prisma.join([...OPEN_TASK_STATUSES])})`;
export const taskOverdueSql = (now: Date): Prisma.Sql =>
  Prisma.sql`${taskOpenSql()} AND t.due_at<${now}`;
// Same public row health rules as MGR07's projection. Invalid legacy payloads
// cannot inflate counters or expose a linked lesson from another pupil.
export const taskVisibleSql =
  (): Prisma.Sql => Prisma.sql`t.type::text IN (${Prisma.join([...TASK_STORAGE_TYPES])})
 AND (t.lesson_id IS NULL OR EXISTS(SELECT 1 FROM lesson_occurrences l JOIN student_subject_enrollments e ON e.id=l.enrollment_id WHERE l.id=t.lesson_id AND e.student_id=t.student_id))
 AND (t.type::text NOT IN('RESCHEDULE_REQUEST','ATTENDANCE_DISPUTE') OR t.lesson_id IS NOT NULL)
 AND (t.type::text<>'SUBSCRIPTION_EXPIRING' OR EXISTS(SELECT 1 FROM manager_subscriptions ms JOIN student_subject_enrollments e ON e.id=ms.enrollment_id
  WHERE ms.id=CASE WHEN t.payload->>'subscriptionId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN (t.payload->>'subscriptionId')::uuid ELSE NULL END AND e.student_id=t.student_id))`;
export const taskPublicTypeSql = (): Prisma.Sql =>
  Prisma.sql`CASE t.type::text WHEN 'ATTENDANCE_DISPUTE' THEN 'CHARGE_DISPUTE' WHEN 'MANUAL' THEN 'GENERAL' ELSE t.type::text END`;

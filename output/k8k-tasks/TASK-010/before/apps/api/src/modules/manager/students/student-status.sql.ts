import { Prisma } from '@online-school/db';
// Fixed aliases st/sub are shared by MGR02 and reporting; no money/learning joins.
export const studentCrmStatusSql = (
  now: Date,
): Prisma.Sql => Prisma.sql`CASE WHEN st.archived_at IS NOT NULL THEN 'ARCHIVED' WHEN sub.id IS NULL THEN 'LEAD'
 WHEN sub.valid_to<=${now} THEN 'EXPIRED' WHEN sub.frozen_from<=${now} AND sub.frozen_until>${now} THEN 'FROZEN' ELSE 'ACTIVE' END`;

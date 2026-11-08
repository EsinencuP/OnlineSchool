import { Prisma } from '@online-school/db';
import { addSchoolDays } from './time.js';
// Calendar days retain school wall time across DST; window is (now, until].
export const subscriptionExpiryUntil = (now: Date, days: number): Date =>
  addSchoolDays(now, days, process.env.SCHOOL_TIMEZONE ?? 'Europe/Chisinau');
export const expiringSubscriptionSql = (now: Date, until: Date): Prisma.Sql =>
  Prisma.sql`ms.status='ACTIVE' AND ms.ends_at>${now} AND ms.ends_at<=${until}`;
export const managedSubscriptionTotalsSql = (
  rootId: string | Prisma.Sql,
  now: Date,
): Prisma.Sql => Prisma.sql`
 SELECT coalesce(sum(s.lesson_count),0)::int AS total,coalesce(sum(b.remaining),0)::int AS remaining
 FROM manager_subscription_periods p JOIN subscriptions s ON s.id=p.financial_subscription_id
 CROSS JOIN LATERAL (SELECT coalesce(sum(g.quantity
 +coalesce((SELECT sum(a.delta_quantity) FROM entitlement_adjustments a WHERE a.grant_id=g.id AND a.effective_at<=${now}),0)
 -coalesce((SELECT sum(c.quantity) FROM entitlement_consumptions c WHERE c.grant_id=g.id AND c.consumed_at<=${now}
 AND (c.cancelled_at IS NULL OR c.cancelled_at>${now})),0)),0) AS remaining
 FROM entitlement_grants g WHERE g.subscription_id=s.id AND g.granted_at<=${now}) b
 WHERE p.manager_subscription_id=${rootId}::uuid`;

import { Prisma } from '@online-school/db';
import type { PrismaClient } from '@online-school/db';
import {
  NotificationService,
  archiveNotifications,
  notificationLock,
} from '@online-school/api/notifications';
import { dbNow } from './contracts.js';

export function subscriptionNotificationSql(now: Date): Prisma.Sql {
  // Returned by a tagged query below; explicit return type keeps package d.ts portable.
  return Prisma.sql`INSERT INTO student_notification_sources(student_id,type,event_key,payload,occurred_at)
    SELECT e.student_id,'SUBSCRIPTION_EXPIRING',
      'subscription-expiry:'||s.id::text||':'||(extract(epoch FROM s.valid_to)*1000)::bigint::text||':'||d.days::text,
      jsonb_build_object('subscriptionId',s.id,'daysBefore',d.days,'expiresAt',s.valid_to),${now}
    FROM subscriptions s JOIN student_subject_enrollments e ON e.id=s.enrollment_id
    JOIN student_accounts a ON a.student_id=e.student_id AND a.deactivated_at IS NULL
    JOIN auth_accounts u ON u.id=a.account_id AND u.disabled_at IS NULL
    JOIN students pupil ON pupil.id=e.student_id AND pupil.archived_at IS NULL
    CROSS JOIN LATERAL (SELECT (s.valid_to AT TIME ZONE a.timezone)::date-(${now}::timestamptz AT TIME ZONE a.timezone)::date AS days) d
    WHERE s.valid_from<=${now} AND s.valid_to>${now} AND s.valid_to<=${now}+interval '9 days' AND d.days IN(7,3)
      AND NOT EXISTS(SELECT 1 FROM student_notification_sources old WHERE old.event_key=
        'subscription-expiry:'||s.id::text||':'||(extract(epoch FROM s.valid_to)*1000)::bigint::text||':'||d.days::text)
    ORDER BY s.valid_to,s.id LIMIT 50 ON CONFLICT(event_key) DO NOTHING`;
}
export class StudentNotificationProjector {
  private stopped = false;
  private maintenanceAt = 0;
  constructor(
    private readonly db: PrismaClient,
    private readonly notifications: NotificationService,
  ) {}
  stop() {
    this.stopped = true;
  }
  async processDue(): Promise<number> {
    if (this.stopped) return 0;
    if (Date.now() - this.maintenanceAt >= 60000) {
      await this.db.$transaction(
        async (tx) => {
          const now = await dbNow(tx);
          await tx.$executeRaw(subscriptionNotificationSql(now));
          const pupils = await tx.$queryRaw<
            { student_id: string }[]
          >`SELECT DISTINCT student_id FROM student_notifications
          WHERE archived_at IS NULL AND created_at<=${new Date(+now - 90 * 86400000)} ORDER BY student_id LIMIT 50`;
          for (const pupil of pupils) {
            await notificationLock(tx, pupil.student_id);
            await archiveNotifications(tx, pupil.student_id, now);
          }
        },
        { timeout: 15000, maxWait: 5000 },
      );
      this.maintenanceAt = Date.now();
    }
    let delivered = 0;
    for (let i = 0; i < 20 && !this.stopped; i++) {
      const done = await this.db.$transaction(
        async (tx) => {
          const [source] = await tx.$queryRaw<
            { id: string }[]
          >`SELECT id FROM student_notification_sources
          WHERE delivered_at IS NULL AND occurred_at<=clock_timestamp() ORDER BY occurred_at,id FOR UPDATE SKIP LOCKED LIMIT 1`;
          if (!source) return false;
          await this.notifications.create(tx, source.id);
          await tx.studentNotificationSource.update({
            where: { id: source.id },
            data: { delivered_at: await dbNow(tx) },
          });
          return true;
        },
        { timeout: 15000, maxWait: 5000 },
      );
      if (!done) break;
      delivered++;
    }
    return delivered;
  }
}

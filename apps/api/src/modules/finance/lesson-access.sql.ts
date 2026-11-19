import { Prisma } from '@online-school/db';

// The caller correlates sub with the lesson's enrollment.
export function lessonSubscriptionWindowSql(time: Date): Prisma.Sql {
  return Prisma.sql`sub.valid_from<=${time} AND (sub.valid_to IS NULL OR sub.valid_to>${time})
    AND NOT coalesce(sub.frozen_from<=${time} AND sub.frozen_until>${time},false)
    AND NOT EXISTS (
      SELECT 1 FROM subscription_freeze_history history WHERE history.subscription_id=sub.id
        AND history.frozen_from<=${time} AND history.frozen_until>${time}
    )`;
}

// p is a director decision on the already scoped subscription. Callers apply the lesson limit.
export function directorAdmissionWindowSql(time: Date | Prisma.Sql): Prisma.Sql {
  return Prisma.sql`p.approved_at<=${time} AND p.valid_from<=${time} AND p.valid_to>${time}
    AND (p.revoked_at IS NULL OR p.revoked_at>${time})
    AND NOT EXISTS (
      SELECT 1 FROM payment_distributions d JOIN payment_receipts r ON r.id=d.payment_id
      WHERE d.subscription_id=p.subscription_id AND d.approved_at>p.approved_at
        AND d.approved_at<=${time} AND r.confirmed_by_director_at<=${time}
    )`;
}

// The last reserved place still permits the lesson already in progress.
export function inProgressDirectorAdmissionSql(time: Date | Prisma.Sql): Prisma.Sql {
  return Prisma.sql`EXISTS (
    SELECT 1 FROM lesson_admission_starts admission JOIN lesson_occurrences lesson ON lesson.id=admission.lesson_id
    WHERE admission.permission_id=p.id AND admission.admitted_at<=${time}
      AND lesson.status='SCHEDULED' AND lesson.confirmed_report_id IS NULL AND lesson.scheduled_end_at>${time}
  )`;
}

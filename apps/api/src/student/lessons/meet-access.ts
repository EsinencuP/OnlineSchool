import { Prisma } from '@online-school/db';
import {
  directorAdmissionWindowSql,
  lessonSubscriptionWindowSql,
} from '../../modules/finance/lesson-access.sql.js';
import { effectiveLessonMeetLinkSql } from '../../modules/schedule/meet-link.js';
import type { IStudentContext } from '../student-context.interface.js';
import type { StudentLessonStatus } from './lessons.dto.js';

export const MEET_EARLY_MS = 600_000;
export const MEET_LATE_MS = 3_600_000;
export const MEET_URL_PATTERN = '^https://meet[.]google[.]com/[a-z]{3}-[a-z]{4}-[a-z]{3}$';
const canonicalMeetUrl = new RegExp(MEET_URL_PATTERN);

export function studentMeetProjection(
  lesson: {
    scheduled_at: Date;
    student_status: StudentLessonStatus;
    google_meet_link: string | null;
  },
  student: Pick<IStudentContext, 'hasActiveAccess' | 'mustChangePassword'>,
  asOf: Date,
) {
  const elapsed = +asOf - +lesson.scheduled_at;
  const link = lesson.google_meet_link;
  const canJoin =
    student.hasActiveAccess &&
    !student.mustChangePassword &&
    lesson.student_status === 'SCHEDULED' &&
    elapsed >= -MEET_EARLY_MS &&
    elapsed <= MEET_LATE_MS &&
    Date.now() <= +lesson.scheduled_at + MEET_LATE_MS &&
    typeof link === 'string' &&
    link === link.trim() &&
    canonicalMeetUrl.test(link);
  return { canJoin, meetLink: canJoin ? link : null, meetAsOf: asOf.toISOString() };
}

// l, e, a, t and s are the same owned lesson, enrollment, assignment, teacher and subject in both reads.
export function scheduledLessonScopeSql(time: Date): Prisma.Sql {
  return Prisma.sql`e.status='ACTIVE' AND e.valid_from<=${time}
    AND e.valid_from<=l.scheduled_at
    AND (e.valid_to IS NULL OR e.valid_to>l.scheduled_at)
    AND a.enrollment_id=e.id AND a.teacher_id=t.id AND a.valid_from<=l.scheduled_at
    AND (a.valid_to IS NULL OR a.valid_to>l.scheduled_at)
    AND t.deactivated_at IS NULL AND s.archived_at IS NULL`;
}

export function studentMeetLinkSql(time: Date): Prisma.Sql {
  return Prisma.sql`CASE WHEN l.status='SCHEDULED' AND ${scheduledLessonScopeSql(time)}
    AND (e.valid_to IS NULL OR e.valid_to>${time}) AND a.valid_from<=${time}
    AND (a.valid_to IS NULL OR a.valid_to>${time}) AND EXISTS(
      SELECT 1 FROM subscriptions sub WHERE sub.enrollment_id=e.id
        AND ${lessonSubscriptionWindowSql(time)}
        AND ((t03_paid_at(sub.id,${time})>=sub.full_price AND EXISTS(
          SELECT 1 FROM entitlement_grants g WHERE g.subscription_id=sub.id AND g.granted_at<=${time}
            AND g.quantity+coalesce((SELECT sum(adj.delta_quantity) FROM entitlement_adjustments adj WHERE adj.grant_id=g.id AND adj.effective_at<=${time}),0)
              -coalesce((SELECT sum(c.quantity) FROM entitlement_consumptions c WHERE c.grant_id=g.id AND c.consumed_at<=${time}
                AND (c.cancelled_at IS NULL OR c.cancelled_at>${time})),0)>0))
          OR (t03_paid_at(sub.id,${time})<sub.full_price AND EXISTS(
            SELECT 1 FROM temporary_access_permissions p WHERE p.subscription_id=sub.id
              AND ${directorAdmissionWindowSql(time)}
              AND t03_admission_slots_used(p.id,l.id,${time})<p.max_lessons))))
    THEN ${effectiveLessonMeetLinkSql()} ELSE NULL END`;
}

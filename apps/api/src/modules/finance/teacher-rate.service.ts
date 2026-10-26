import { Injectable } from '@nestjs/common';
import type { Prisma, TeacherEngagement } from '@online-school/db';
import { domainError, fail } from '../../core/errors/domain-error.js';
import type { CriticalContext } from '../../core/http.js';
import { Decimal } from './finance-common.js';
import { FinanceAccess } from './finance-access.service.js';

export function addCalendarMonths(value: Date, months: number): Date {
  const date = new Date(value);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date;
}
export function restoredEngagements(periods: TeacherEngagement[], time: Date): TeacherEngagement[] {
  const ordered = periods
    .filter((p) => p.starts_at <= time)
    .sort((a, b) => +a.starts_at - +b.starts_at);
  const active = ordered.findLastIndex((p) => !p.ends_at || p.ends_at > time);
  if (active < 0) return [];
  const result = [ordered[active]!];
  for (let i = active - 1; i >= 0; i--) {
    const previous = ordered[i]!,
      next = result[0]!;
    if (!previous.ends_at || next.starts_at > addCalendarMonths(previous.ends_at, 6)) break;
    result.unshift(previous);
  }
  return result;
}
export function ordinaryRate(months: number, students: number) {
  if (
    !Number.isSafeInteger(months) ||
    !Number.isSafeInteger(students) ||
    months < 0 ||
    students < 0
  )
    return fail(domainError('INVALID_RATE_INPUT', 422));
  const tenurePoints = Math.min(6, Math.floor(months / 2)),
    studentPoints = Math.min(4, Math.floor(students / 2));
  const points = tenurePoints + studentPoints;
  return {
    points,
    tenurePoints,
    studentPoints,
    rate: new Decimal(points < 5 ? '200' : points < 10 ? '220' : '250'),
  };
}
@Injectable()
export class TeacherRateService {
  constructor(private readonly access: FinanceAccess) {}
  async quote(tx: Prisma.TransactionClient, teacherId: string, time: Date) {
    const engagements = restoredEngagements(
      await tx.teacherEngagement.findMany({
        where: { teacher_id: teacherId },
        orderBy: { starts_at: 'asc' },
      }),
      time,
    );
    if (!engagements.length) return fail(domainError('TEACHER_SERVICE_HISTORY_REQUIRED', 422));
    const eligibleMonths = await tx.teacherTenureCredit.count({
      where: { engagement_id: { in: engagements.map((e) => e.id) }, ends_on: { lte: time } },
    });
    const students = await tx.$queryRaw<{ total: bigint }[]>`
      SELECT count(DISTINCT en.student_id) AS total FROM teaching_assignments a JOIN student_subject_enrollments en ON en.id=a.enrollment_id
      WHERE a.teacher_id=${teacherId}::uuid AND a.valid_from<=${time} AND (a.valid_to IS NULL OR a.valid_to>${time}) AND en.valid_from<=${time} AND (en.valid_to IS NULL OR en.valid_to>${time})
      AND EXISTS(SELECT 1 FROM subscriptions s JOIN entitlement_grants g ON g.subscription_id=s.id WHERE s.enrollment_id=en.id AND s.valid_from<=${time} AND (s.valid_to IS NULL OR s.valid_to>${time}) AND g.granted_at<=${time}
        AND (en.status='ACTIVE' OR (en.status='PAUSED' AND s.frozen_from<=${time} AND s.frozen_until>${time}))
        AND t03_paid_at(s.id,${time})>=s.full_price
        AND g.quantity+coalesce((SELECT sum(delta_quantity) FROM entitlement_adjustments WHERE grant_id=g.id AND effective_at<=${time}),0)-coalesce((SELECT sum(quantity) FROM entitlement_consumptions WHERE grant_id=g.id AND consumed_at<=${time} AND (cancelled_at IS NULL OR cancelled_at>${time})),0)>0)`;
    const activeStudents = Number(students[0]!.total);
    const ordinary = ordinaryRate(eligibleMonths, activeStudents);
    const promise = await tx.teacherRatePromise.findFirst({
      where: {
        teacher_id: teacherId,
        valid_from: { lte: time },
        OR: [{ valid_to: null }, { valid_to: { gt: time } }],
      },
    });
    const rate = promise
      ? Decimal.max(ordinary.rate, promise.minimum_rate).add(promise.additive_rate)
      : ordinary.rate;
    return {
      ...ordinary,
      rate,
      basis: promise ? ('INDIVIDUAL_PROMISE' as const) : ('ORDINARY_POINTS' as const),
      currency: 'MDL',
      context: {
        eligibleMonths,
        activeStudents,
        engagementIds: engagements.map((e) => e.id),
        promiseId: promise?.id ?? null,
        asOf: time.toISOString(),
      },
    };
  }
  // Called by the Schedule actual-start command, never by a client supplying arbitrary KPI counts.
  async snapshotAtStart(
    ctx: CriticalContext,
    lessonId: string,
    actualTeacherId: string,
    time: Date,
  ) {
    await ctx.tx.$queryRaw`SELECT id FROM lesson_occurrences WHERE id=${lessonId}::uuid FOR UPDATE`;
    const lesson = await ctx.tx.lessonOccurrence.findUniqueOrThrow({ where: { id: lessonId } });
    const enrollment = await ctx.tx.studentSubjectEnrollment.findUniqueOrThrow({
      where: { id: lesson.enrollment_id },
    });
    if (
      ctx.actor.roles.includes('TEACHER') &&
      !ctx.actor.roles.some((r) => ['DIRECTOR', 'MANAGER'].includes(r))
    ) {
      const teacher = await ctx.tx.teacherAccount.findUnique({ where: { id: actualTeacherId } });
      if (
        !ctx.actor.mfaCompleted ||
        ctx.actor.recoveryOnly ||
        !teacher ||
        teacher.deactivated_at ||
        teacher.account_id !== ctx.actor.accountId ||
        lesson.scheduled_teacher_id !== teacher.id
      )
        return fail(domainError('FORBIDDEN', 403));
    } else await this.access.student(ctx, enrollment.student_id);
    if (lesson.actual_start_at) return lesson;
    if (!['SCHEDULED', 'STAR_PENDING'].includes(lesson.status))
      return fail(domainError('LESSON_CANNOT_START', 422));
    const assignment = await ctx.tx.teachingAssignment.findFirst({
      where: {
        teacher_id: actualTeacherId,
        enrollment_id: lesson.enrollment_id,
        valid_from: { lte: time },
        OR: [{ valid_to: null }, { valid_to: { gt: time } }],
      },
    });
    if (!assignment) return fail(domainError('ACTUAL_TEACHER_NOT_ASSIGNED', 422));
    const rate = await this.quote(ctx.tx, actualTeacherId, time);
    return ctx.tx.lessonOccurrence.update({
      where: { id: lessonId },
      data: {
        actual_start_at: time,
        actual_teacher_at_start_id: actualTeacherId,
        rate_at_start_snapshot: rate.rate,
        points_at_start_snapshot: rate.points,
        rate_basis_at_start: rate.basis,
        rate_currency_at_start: rate.currency,
        rate_context_snapshot: rate.context,
      },
    });
  }
}

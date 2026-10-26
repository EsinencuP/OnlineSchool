import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma, RecurringSlot } from '@online-school/db';
import type { CriticalContext } from '../../core/http.js';
import { domainError, fail } from '../../core/errors/domain-error.js';
import { object, string, uuid } from '../identity/input.js';
import { at, count, date } from '../finance/finance-common.js';
import { ScheduleAccess } from './schedule-access.service.js';
import { ScheduleEvents } from './schedule-events.service.js';
import { occurrences, timezone } from './recurrence.js';

export async function admission(
  tx: Prisma.TransactionClient,
  enrollment: string,
  time: Date,
  preferredPermissionId?: string,
) {
  const paid = await tx.$queryRaw<
    { ok: boolean }[]
  >`SELECT EXISTS(SELECT 1 FROM subscriptions s JOIN entitlement_grants g ON g.subscription_id=s.id WHERE s.enrollment_id=${enrollment}::uuid AND s.valid_from<=${time} AND (s.valid_to IS NULL OR s.valid_to>${time}) AND g.granted_at<=${time} AND t03_paid_at(s.id,${time})>=s.full_price AND g.quantity+coalesce((SELECT sum(delta_quantity) FROM entitlement_adjustments WHERE grant_id=g.id AND effective_at<=${time}),0)-coalesce((SELECT sum(quantity) FROM entitlement_consumptions WHERE grant_id=g.id AND consumed_at<=${time} AND (cancelled_at IS NULL OR cancelled_at>${time})),0)>0 AND NOT(coalesce(s.frozen_from<=${time} AND s.frozen_until>${time},false))) AS ok`;
  if (paid[0]!.ok) return { paid: true, permissionId: null };
  const permissions = await tx.$queryRaw<
    { id: string }[]
  >`SELECT p.id FROM temporary_access_permissions p JOIN subscriptions s ON s.id=p.subscription_id WHERE s.enrollment_id=${enrollment}::uuid AND (${preferredPermissionId ?? null}::uuid IS NULL OR p.id=${preferredPermissionId ?? null}::uuid) AND p.approved_at<=${time} AND p.valid_from<=${time} AND p.valid_to>${time} AND (p.revoked_at IS NULL OR p.revoked_at>${time}) AND (SELECT count(*) FROM lesson_actual_outcomes WHERE temporary_access_permission_id=p.id)<p.max_lessons ORDER BY p.valid_to,p.id LIMIT 1`;
  return { paid: false, permissionId: permissions[0]?.id ?? null };
}
@Injectable()
export class BookingService {
  constructor(
    private readonly access: ScheduleAccess,
    private readonly events: ScheduleEvents,
  ) {}
  async resources(
    ctx: CriticalContext,
    teacherId: string,
    start: Date,
    end: Date,
    exclude?: string,
  ) {
    if (end <= start || +end - +start > 480 * 60000)
      return fail(domainError('INVALID_LESSON_INTERVAL', 422));
    await ctx.tx.$queryRaw`SELECT id FROM teacher_accounts WHERE id=${teacherId}::uuid FOR UPDATE`;
    const rows = await ctx.tx.$queryRaw<
      { id: string }[]
    >`SELECT id FROM teacher_availabilities WHERE teacher_id=${teacherId}::uuid AND cancelled_at IS NULL AND starts_at<=${start} AND ends_at>=${end} ORDER BY id FOR UPDATE`;
    if (!rows.length) return fail(domainError('TEACHER_NOT_AVAILABLE', 409));
    const busy = await ctx.tx.lessonOccurrence.findFirst({
      where: {
        scheduled_teacher_id: teacherId,
        status: { not: 'CANCELLED' },
        scheduled_at: { lt: end },
        scheduled_end_at: { gt: start },
        ...(exclude ? { id: { not: exclude } } : {}),
      },
      select: { id: true },
    });
    if (busy)
      return fail({
        ...domainError('CALENDAR_CONFLICT', 409),
        details: { teacherId, startsAt: start.toISOString(), endsAt: end.toISOString() },
      });
  }
  async assignment(ctx: CriticalContext, id: string, start: Date, end: Date) {
    const a = await ctx.tx.teachingAssignment.findUnique({ where: { id: uuid(id) } });
    if (!a) return fail(domainError('NOT_FOUND', 404));
    const en = await this.access.enrollment(ctx, a.enrollment_id);
    const teacher = await ctx.tx.teacherAccount.findUnique({
      where: { id: a.teacher_id },
      include: { account: true },
    });
    if (
      !teacher ||
      teacher.deactivated_at ||
      teacher.account.disabled_at ||
      en.status !== 'ACTIVE' ||
      en.valid_from > start ||
      (en.valid_to && en.valid_to < end) ||
      a.valid_from > start ||
      (a.valid_to && a.valid_to < end)
    )
      return fail(domainError('ASSIGNMENT_INACTIVE', 422));
    return a;
  }
  async one(ctx: CriticalContext, body: unknown) {
    const input = object(body, ['teachingAssignmentId', 'startsAt', 'endsAt', 'status', 'basis']);
    const start = date(input.startsAt),
      end = date(input.endsAt),
      a = await this.assignment(ctx, uuid(input.teachingAssignmentId), start, end);
    string(input.basis, 5, 500);
    await this.resources(ctx, a.teacher_id, start, end);
    if (
      input.status !== undefined &&
      !['SCHEDULED', 'STAR_PENDING'].includes(input.status as string)
    )
      return fail(domainError('INVALID_LESSON_STATUS', 422));
    const allowed = await admission(ctx.tx, a.enrollment_id, start);
    const lesson = await ctx.tx.lessonOccurrence.create({
      data: {
        enrollment_id: a.enrollment_id,
        teaching_assignment_id: a.id,
        scheduled_teacher_id: a.teacher_id,
        original_scheduled_at: start,
        scheduled_at: start,
        scheduled_end_at: end,
        status:
          input.status === 'STAR_PENDING' || (!allowed.paid && !allowed.permissionId)
            ? 'STAR_PENDING'
            : 'SCHEDULED',
        source_operation_id: ctx.operationId,
      },
    });
    await this.events.change(ctx, lesson.id, {}, lesson, string(input.basis, 5, 500));
    await this.events.jobs(ctx, lesson);
    return lesson;
  }
  async createSlot(ctx: CriticalContext, body: unknown) {
    const input = object(body, [
      'teachingAssignmentId',
      'rule',
      'timezone',
      'activeFrom',
      'activeUntil',
      'durationMin',
      'basis',
    ]);
    const start = date(input.activeFrom),
      until = date(input.activeUntil),
      duration = count(input.durationMin, 1, 480);
    const a = await this.assignment(ctx, uuid(input.teachingAssignmentId), start, until);
    const rule = string(input.rule, 10, 100),
      zone = timezone(input.timezone);
    occurrences(rule, zone, start, until, duration);
    const slot = await ctx.tx.recurringSlot.create({
      data: {
        enrollment_id: a.enrollment_id,
        teaching_assignment_id: a.id,
        rule,
        timezone: zone,
        active_from: start,
        active_until: until,
        duration_min: duration,
        source_operation_id: ctx.operationId,
      },
    });
    await ctx.tx.slotChangeEvent.create({
      data: {
        slot_id: slot.id,
        author_id: ctx.actor.accountId,
        old_values: {},
        new_values: JSON.parse(JSON.stringify(slot)) as Prisma.InputJsonValue,
        reason: string(input.basis, 5, 500),
        effective_at: await at(ctx.tx),
        source_operation_id: randomUUID(),
      },
    });
    return { ...slot, occurrences: await this.generate(ctx, slot) };
  }
  async generate(ctx: CriticalContext, slot: RecurringSlot) {
    await ctx.tx.$queryRaw`SELECT id FROM recurring_slots WHERE id=${slot.id}::uuid FOR UPDATE`;
    if (!slot.active_until) return fail(domainError('EXPLICIT_GENERATION_END_REQUIRED', 422));
    const result = [];
    for (const o of occurrences(
      slot.rule,
      slot.timezone,
      slot.active_from,
      slot.active_until,
      slot.duration_min,
    )) {
      const existing = await ctx.tx.lessonOccurrence.findUnique({
        where: {
          recurring_slot_id_occurrence_date: {
            recurring_slot_id: slot.id,
            occurrence_date: o.date,
          },
        },
      });
      if (existing) {
        result.push(existing);
        continue;
      }
      const a = await this.assignment(ctx, slot.teaching_assignment_id, o.start, o.end);
      await this.resources(ctx, a.teacher_id, o.start, o.end);
      const allowed = await admission(ctx.tx, a.enrollment_id, o.start);
      const lesson = await ctx.tx.lessonOccurrence.create({
        data: {
          enrollment_id: slot.enrollment_id,
          teaching_assignment_id: a.id,
          recurring_slot_id: slot.id,
          scheduled_teacher_id: a.teacher_id,
          original_scheduled_at: o.start,
          occurrence_date: o.date,
          scheduled_at: o.start,
          scheduled_end_at: o.end,
          status: allowed.paid || allowed.permissionId ? 'SCHEDULED' : 'STAR_PENDING',
          source_operation_id: randomUUID(),
        },
      });
      await this.events.change(ctx, lesson.id, {}, lesson, 'Materialized explicit recurring slot');
      await this.events.jobs(ctx, lesson);
      result.push(lesson);
    }
    return result;
  }
  async generateById(ctx: CriticalContext, id: string, body: unknown) {
    object(body ?? {}, []);
    id = uuid(id);
    await ctx.tx.$queryRaw`SELECT id FROM recurring_slots WHERE id=${id}::uuid FOR UPDATE`;
    const slot = await ctx.tx.recurringSlot.findUnique({ where: { id } });
    if (!slot) return fail(domainError('NOT_FOUND', 404));
    await this.access.enrollment(ctx, slot.enrollment_id);
    return { id, occurrences: await this.generate(ctx, slot) };
  }
  async patchSlot(ctx: CriticalContext, id: string, body: unknown) {
    const input = object(body, [
      'rule',
      'timezone',
      'durationMin',
      'activeUntil',
      'effectiveFrom',
      'reason',
    ]);
    id = uuid(id);
    await ctx.tx.$queryRaw`SELECT id FROM recurring_slots WHERE id=${id}::uuid FOR UPDATE`;
    const old = await ctx.tx.recurringSlot.findUnique({ where: { id } });
    if (!old) return fail(domainError('NOT_FOUND', 404));
    await this.access.enrollment(ctx, old.enrollment_id);
    const effective = date(input.effectiveFrom),
      now = await at(ctx.tx);
    if (effective < now) return fail(domainError('TEMPLATE_CHANGES_FUTURE_ONLY', 422));
    const future = await ctx.tx.lessonOccurrence.findMany({
      where: {
        recurring_slot_id: id,
        scheduled_at: { gte: effective },
        status: { in: ['SCHEDULED', 'STAR_PENDING'] },
      },
      orderBy: { id: 'asc' },
    });
    for (const l of future) {
      if (
        l.version > 1 ||
        l.actual_start_at ||
        (await ctx.tx.lessonOutcomeReport.findFirst({ where: { lesson_occurrence_id: l.id } }))
      )
        return fail(domainError('SLOT_HAS_INDIVIDUAL_EXCEPTIONS', 409));
    }
    const updated = await ctx.tx.recurringSlot.update({
      where: { id },
      data: {
        active_from: effective,
        rule: input.rule === undefined ? old.rule : string(input.rule, 10, 100),
        timezone: input.timezone === undefined ? old.timezone : timezone(input.timezone),
        duration_min:
          input.durationMin === undefined ? old.duration_min : count(input.durationMin, 1, 480),
        active_until: input.activeUntil === undefined ? old.active_until : date(input.activeUntil),
        version: { increment: 1 },
      },
    });
    if (!updated.active_until || updated.active_until <= effective)
      return fail(domainError('INVALID_RECURRENCE', 422));
    const reason = string(input.reason, 5, 500);
    for (const l of future) {
      const cancelled = await ctx.tx.lessonOccurrence.update({
        where: { id: l.id },
        data: { status: 'CANCELLED', version: { increment: 1 } },
      });
      await this.events.change(ctx, l.id, l, cancelled, reason);
    }
    // Same calendar-day occurrences keep their IDs and original keys. Explicitly
    // cancelled individual exceptions are never resurrected by generation.
    const dates = occurrences(
      updated.rule,
      updated.timezone,
      effective,
      updated.active_until,
      updated.duration_min,
    );
    for (const o of dates) {
      const l = future.find((l) => l.occurrence_date?.getTime() === o.date.getTime());
      if (!l) continue;
      const a = await this.assignment(ctx, updated.teaching_assignment_id, o.start, o.end);
      await this.resources(ctx, a.teacher_id, o.start, o.end, l.id);
      const restored = await ctx.tx.lessonOccurrence.update({
        where: { id: l.id },
        data: { scheduled_at: o.start, scheduled_end_at: o.end, status: l.status },
      });
      await this.events.change(ctx, l.id, { status: 'CANCELLED' }, restored, reason);
      await this.events.jobs(ctx, restored);
    }
    await ctx.tx.slotChangeEvent.create({
      data: {
        slot_id: id,
        author_id: ctx.actor.accountId,
        old_values: JSON.parse(JSON.stringify(old)) as Prisma.InputJsonValue,
        new_values: JSON.parse(JSON.stringify(updated)) as Prisma.InputJsonValue,
        reason,
        effective_at: effective,
        source_operation_id: randomUUID(),
      },
    });
    return {
      ...updated,
      occurrences: await this.generate(ctx, { ...updated, active_from: effective }),
    };
  }
  async reschedule(ctx: CriticalContext, id: string, body: unknown) {
    const input = object(body, ['startsAt', 'endsAt', 'teachingAssignmentId', 'reason']);
    id = uuid(id);
    await ctx.tx.$queryRaw`SELECT id FROM lesson_occurrences WHERE id=${id}::uuid FOR UPDATE`;
    const old = await this.access.lesson(ctx, id);
    if (
      old.status === 'CANCELLED' ||
      old.status === 'DISPUTED' ||
      (old.actual_start_at !== null && old.status !== 'CONDUCTED') ||
      (old.status !== 'CONDUCTED' &&
        (await ctx.tx.lessonOutcomeReport.findFirst({ where: { lesson_occurrence_id: id } })))
    )
      return fail(domainError('LESSON_HAS_REPORTED_FACT', 409));
    const start = date(input.startsAt),
      end = date(input.endsAt),
      a = await this.assignment(
        ctx,
        input.teachingAssignmentId === undefined
          ? old.teaching_assignment_id
          : uuid(input.teachingAssignmentId),
        start,
        end,
      );
    if (a.enrollment_id !== old.enrollment_id) return fail(domainError('ASSIGNMENT_MISMATCH', 422));
    await this.resources(ctx, a.teacher_id, start, end, id);
    const updated = await ctx.tx.lessonOccurrence.update({
      where: { id },
      data: {
        scheduled_at: start,
        scheduled_end_at: end,
        teaching_assignment_id: a.id,
        scheduled_teacher_id: a.teacher_id,
        version: old.confirmed_report_id ? old.version : { increment: 1 },
      },
    });
    await this.events.change(ctx, id, old, updated, string(input.reason, 5, 500));
    if (['SCHEDULED', 'STAR_PENDING'].includes(updated.status))
      await this.events.jobs(ctx, updated);
    return updated;
  }
  async cancel(ctx: CriticalContext, id: string, body: unknown) {
    const input = object(body, ['reason']);
    id = uuid(id);
    await ctx.tx.$queryRaw`SELECT id FROM lesson_occurrences WHERE id=${id}::uuid FOR UPDATE`;
    const old = await this.access.lesson(ctx, id);
    if (
      !['SCHEDULED', 'STAR_PENDING'].includes(old.status) ||
      old.actual_start_at ||
      (await ctx.tx.lessonOutcomeReport.findFirst({ where: { lesson_occurrence_id: id } }))
    )
      return fail(domainError('LESSON_HAS_REPORTED_FACT', 409));
    const lesson = await ctx.tx.lessonOccurrence.update({
      where: { id },
      data: { status: 'CANCELLED', version: { increment: 1 } },
    });
    await this.events.change(ctx, id, old, lesson, string(input.reason, 5, 500));
    return lesson;
  }
}

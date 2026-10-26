import { Injectable } from '@nestjs/common';
import type { CriticalContext } from '../../core/http.js';
import { domainError, fail } from '../../core/errors/domain-error.js';
import { object, string, uuid } from '../identity/input.js';
import { at, date } from '../finance/finance-common.js';
import { ScheduleAccess } from './schedule-access.service.js';
import { ScheduleEvents } from './schedule-events.service.js';
import { timezone } from './recurrence.js';

@Injectable()
export class ScheduleRegistry {
  constructor(
    private readonly access: ScheduleAccess,
    private readonly events: ScheduleEvents,
  ) {}
  async subject(ctx: CriticalContext, body: unknown) {
    await this.access.staff(ctx);
    const i = object(body, ['code', 'name']);
    return ctx.tx.subject.create({
      data: { code: string(i.code, 1, 80), name: string(i.name, 1, 200) },
    });
  }
  async enrollment(ctx: CriticalContext, body: unknown) {
    const i = object(body, ['studentId', 'subjectId']);
    const student = uuid(i.studentId);
    await this.access.student(ctx, student);
    const subject = await ctx.tx.subject.findUnique({ where: { id: uuid(i.subjectId) } });
    if (!subject || subject.archived_at) return fail(domainError('SUBJECT_INACTIVE', 422));
    return ctx.tx.studentSubjectEnrollment.create({
      data: {
        student_id: student,
        subject_id: subject.id,
        valid_from: await at(ctx.tx),
        source_operation_id: ctx.operationId,
      },
    });
  }
  async assignment(ctx: CriticalContext, body: unknown) {
    const i = object(body, ['enrollmentId', 'teacherId', 'validFrom', 'validTo', 'basis']);
    const staff = await this.access.staff(ctx),
      en = await this.access.enrollment(ctx, uuid(i.enrollmentId));
    const start = date(i.validFrom),
      end = i.validTo === undefined ? null : date(i.validTo);
    if (end && end <= start) return fail(domainError('INVALID_ASSIGNMENT_PERIOD', 422));
    const teacher = await ctx.tx.teacherAccount.findUnique({ where: { id: uuid(i.teacherId) } });
    if (!teacher || teacher.deactivated_at) return fail(domainError('TEACHER_INACTIVE', 422));
    return ctx.tx.teachingAssignment.create({
      data: {
        enrollment_id: en.id,
        teacher_id: teacher.id,
        valid_from: start,
        valid_to: end,
        basis: string(i.basis, 5, 500),
        assigned_by_id: staff,
        source_operation_id: ctx.operationId,
      },
    });
  }
  async revoke(ctx: CriticalContext, id: string, body: unknown) {
    const i = object(body, ['reason']);
    id = uuid(id);
    await ctx.tx.$queryRaw`SELECT id FROM teaching_assignments WHERE id=${id}::uuid FOR UPDATE`;
    const a = await ctx.tx.teachingAssignment.findUnique({ where: { id } });
    if (!a) return fail(domainError('NOT_FOUND', 404));
    const en = await this.access.enrollment(ctx, a.enrollment_id),
      now = await at(ctx.tx);
    if (a.valid_to && a.valid_to <= now) return fail(domainError('ASSIGNMENT_ALREADY_ENDED', 409));
    if (a.valid_from >= now) return fail(domainError('FUTURE_ASSIGNMENT_REQUIRES_REVIEW', 422));
    string(i.reason, 5, 500);
    const updated = await ctx.tx.teachingAssignment.update({
      where: { id },
      data: { valid_to: now },
    });
    if (
      await ctx.tx.lessonOccurrence.findFirst({
        where: {
          teaching_assignment_id: id,
          scheduled_end_at: { gt: now },
          status: { not: 'CANCELLED' },
        },
      })
    )
      await this.events.task(
        ctx,
        en.student_id,
        id,
        `assignment-revoked:${id}`,
        'Назначение отозвано: согласовать будущие удержанные уроки',
      );
    return updated;
  }
  async availability(ctx: CriticalContext, body: unknown) {
    const i = object(body, ['availabilityId', 'startsAt', 'endsAt', 'timezone', 'cancel']);
    const teacher = await this.access.teacher(ctx);
    await ctx.tx.$queryRaw`SELECT id FROM teacher_accounts WHERE id=${teacher}::uuid FOR UPDATE`;
    const old =
      i.availabilityId === undefined
        ? null
        : await ctx.tx.teacherAvailability.findUnique({ where: { id: uuid(i.availabilityId) } });
    if (i.availabilityId !== undefined && (!old || old.teacher_id !== teacher))
      return fail(domainError('FORBIDDEN', 403));
    const start = i.startsAt === undefined ? old?.starts_at : date(i.startsAt),
      end = i.endsAt === undefined ? old?.ends_at : date(i.endsAt);
    if (!start || !end || end <= start) return fail(domainError('INVALID_AVAILABILITY', 422));
    const now = await at(ctx.tx);
    if (start < now) return fail(domainError('AVAILABILITY_FUTURE_ONLY', 422));
    if (i.cancel !== undefined && typeof i.cancel !== 'boolean')
      return fail(domainError('INVALID_INPUT', 400));
    if (i.cancel && !old) return fail(domainError('INVALID_INPUT', 400));
    if (old?.cancelled_at) return fail(domainError('AVAILABILITY_ALREADY_CANCELLED', 409));
    const occupied = await ctx.tx.lessonOccurrence.findFirst({
      where: {
        scheduled_teacher_id: teacher,
        status: { not: 'CANCELLED' },
        OR: [
          { scheduled_at: { lt: end }, scheduled_end_at: { gt: start } },
          ...(old
            ? [{ scheduled_at: { lt: old.ends_at }, scheduled_end_at: { gt: old.starts_at } }]
            : []),
        ],
      },
    });
    if (occupied) return fail(domainError('OCCUPIED_AVAILABILITY_REQUIRES_MANAGER', 409));
    const zone = timezone(i.timezone ?? old?.timezone);
    if (old)
      return ctx.tx.teacherAvailability.update({
        where: { id: old.id },
        data: {
          starts_at: start,
          ends_at: end,
          timezone: zone,
          ...(i.cancel ? { cancelled_at: now } : {}),
        },
      });
    return ctx.tx.teacherAvailability.create({
      data: {
        teacher_id: teacher,
        starts_at: start,
        ends_at: end,
        timezone: zone,
        source_operation_id: ctx.operationId,
      },
    });
  }
  async request(ctx: CriticalContext, body: unknown) {
    const i = object(body, ['lessonId', 'slotId', 'requestedStartAt', 'requestedEndAt', 'reason']);
    const teacher = await this.access.teacher(ctx);
    if ((i.lessonId === undefined) === (i.slotId === undefined))
      return fail(domainError('ONE_SCHEDULE_TARGET_REQUIRED', 400));
    let enrollment: string;
    if (i.lessonId !== undefined)
      enrollment = (await this.access.lesson(ctx, uuid(i.lessonId), true)).enrollment_id;
    else {
      const slot = await ctx.tx.recurringSlot.findUnique({
        where: { id: uuid(i.slotId) },
        include: { teaching_assignment_ref: true },
      });
      if (!slot || slot.teaching_assignment_ref.teacher_id !== teacher)
        return fail(domainError('FORBIDDEN', 403));
      enrollment = slot.enrollment_id;
    }
    const student = await ctx.tx.studentSubjectEnrollment.findUniqueOrThrow({
      where: { id: enrollment },
    });
    if ((i.requestedStartAt === undefined) !== (i.requestedEndAt === undefined))
      return fail(domainError('INVALID_INPUT', 400));
    const start = i.requestedStartAt === undefined ? null : date(i.requestedStartAt),
      end = i.requestedEndAt === undefined ? null : date(i.requestedEndAt);
    if (start && end && end <= start) return fail(domainError('INVALID_LESSON_INTERVAL', 422));
    const request = await ctx.tx.scheduleChangeRequest.create({
      data: {
        teacher_id: teacher,
        lesson_occurrence_id: i.lessonId === undefined ? null : uuid(i.lessonId),
        recurring_slot_id: i.slotId === undefined ? null : uuid(i.slotId),
        requested_start_at: start,
        requested_end_at: end,
        reason: string(i.reason, 5, 500),
        source_operation_id: ctx.operationId,
      },
    });
    await this.events.task(
      ctx,
      student.student_id,
      request.id,
      `schedule-request:${request.id}`,
      'Преподаватель запросил изменение занятого слота',
    );
    return request;
  }
}

import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { NotificationOutboxPublisher } from '../../notifications/notification-outbox.publisher.js';
import { Prisma } from '@online-school/db';
import type { LessonOccurrence } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { domainError, unwrap } from '../../../core/errors/domain-error.js';
import type { DomainError } from '../../../core/errors/domain-error.js';
import type { CriticalContext } from '../../../core/http.js';
import { AuditService } from '../../../core/audit/audit.service.js';
import { BookingService } from '../booking.service.js';
import { ScheduleEvents } from '../schedule-events.service.js';
import { ScheduleAccess } from '../schedule-access.service.js';
import { at } from '../../finance/finance-common.js';
import { ManagerLessonRights } from '../../finance/manager-payments/lesson-rights.service.js';
import { meetLink, redactMeet, effectiveMeetLink } from '../meet-link.js';
import { MeetLinkPort } from './meet-link.port.js';
import { ScheduleRegistry } from '../registry.service.js';
import { scheduleFailure, schedulePolicy } from './policy.js';
import type {
  CancelManagedLesson,
  CreateManagedLesson,
  ManagedLessonView,
  RescheduleManagedLesson,
  ChangeApprovalReview,
} from './contracts.js';
const include = {
  enrollment_ref: true,
  scheduled_teacher_ref: { select: { full_name: true } },
  teaching_assignment_ref: { select: { google_meet_link: true } },
  t03_entitlementconsumption_lesson_occurrence_id: {
    where: { cancelled_at: null },
    select: { quantity: true },
  },
  change_approvals: { where: { consumed_at: null }, orderBy: { created_at: 'desc' as const } },
} as const;
type Row = Prisma.LessonOccurrenceGetPayload<{ include: typeof include }>;
@Injectable()
export class ManagerScheduleWorkflow {
  constructor(
    private readonly booking: BookingService,
    private readonly audit: AuditService,
    private readonly rights: ManagerLessonRights,
    private readonly access: ScheduleAccess,
    private readonly events: ScheduleEvents,
    private readonly meet: MeetLinkPort,
    private readonly registry: ScheduleRegistry,
  ) {}
  project(row: Row): ManagedLessonView {
    const pending = row.change_approvals.find((r) => r.lesson_version === row.version);
    return {
      kind: row.kind ?? 'REGULAR',
      lessonId: row.id,
      studentId: row.enrollment_ref.student_id,
      teacherId: row.scheduled_teacher_id,
      teacherName: row.scheduled_teacher_ref.full_name,
      startsAt: row.scheduled_at.toISOString(),
      endsAt: row.scheduled_end_at.toISOString(),
      status: row.status,
      meetLink: effectiveMeetLink(
        row.meet_link_overridden,
        row.google_meet_link,
        row.teaching_assignment_ref.google_meet_link,
      ),
      subscriptionId: row.manager_subscription_id,
      chargedLessons: row.t03_entitlementconsumption_lesson_occurrence_id.reduce(
        (n, c) => n + c.quantity,
        0,
      ),
      pendingChangeId: pending?.id ?? null,
      requiresApproval: !!pending && !pending.approved_at,
    };
  }
  async get(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<Result<ManagedLessonView, DomainError>> {
    try {
      const row = await tx.lessonOccurrence.findUnique({ where: { id }, include });
      return row ? ok(this.project(row)) : err(domainError('LESSON_NOT_FOUND', 404));
    } catch (error: unknown) {
      return err(scheduleFailure(error));
    }
  }
  async list(
    tx: Prisma.TransactionClient,
    where: Prisma.LessonOccurrenceWhereInput,
  ): Promise<Result<ManagedLessonView[], DomainError>> {
    try {
      return ok(
        (
          await tx.lessonOccurrence.findMany({
            where,
            include,
            orderBy: [{ scheduled_at: 'asc' }, { id: 'asc' }],
          })
        ).map((r) => this.project(r)),
      );
    } catch (error: unknown) {
      return err(scheduleFailure(error));
    }
  }
  async mutable(ctx: CriticalContext, id: string): Promise<Result<LessonOccurrence, DomainError>> {
    try {
      await ctx.tx.$queryRaw`SELECT id FROM lesson_occurrences WHERE id=${id}::uuid FOR UPDATE`;
      const row = await ctx.tx.lessonOccurrence.findUnique({ where: { id } }),
        now = await at(ctx.tx);
      if (!row) return err(domainError('LESSON_NOT_FOUND', 404));
      if (
        !['SCHEDULED', 'STAR_PENDING'].includes(row.status) ||
        row.scheduled_at <= now ||
        row.actual_start_at ||
        row.confirmed_report_id ||
        (await ctx.tx.lessonOutcomeReport.findFirst({
          where: { lesson_occurrence_id: id },
          select: { id: true },
        }))
      )
        return err(domainError('LESSON_IMMUTABLE_STATE', 409));
      return ok(row);
    } catch (error: unknown) {
      return err(scheduleFailure(error));
    }
  }
  private async record(
    ctx: CriticalContext,
    action: string,
    lessonId: string,
    studentId: string,
    metadata: Prisma.InputJsonObject,
  ): Promise<void> {
    const id = randomUUID(),
      data = redactMeet(metadata) as Prisma.InputJsonObject;
    await this.audit.record(
      {
        id,
        actor_kind: 'ACCOUNT',
        actor_id: ctx.actor.accountId,
        action,
        resource_type: 'LessonOccurrence',
        resource_id: lessonId,
        request_id: ctx.requestId,
        result: 'SUCCESS',
        source_operation_id: ctx.operationId,
        event_key: `${action}:${lessonId}:${ctx.operationId}`,
        metadata: { studentId, ...data },
      },
      ctx.tx,
    );
    for (const topic of ['manager.schedule.changed.v1', 'schedule.lesson.changed.v1'])
      await ctx.tx.outboxEvent.create({
        data: {
          topic,
          aggregate_type: 'LessonOccurrence',
          aggregate_id: lessonId,
          audit_event_id: id,
          source_operation_id: ctx.operationId,
          event_key: `${topic}:${action}:${lessonId}:${ctx.operationId}`,
          payload: { schemaVersion: 1, lessonId, studentId, action, ...data },
        },
      });
    const templateCode =
      action === 'LESSON_CREATED'
        ? 'LESSON_SCHEDULED'
        : action === 'LESSON_RESCHEDULED'
          ? 'LESSON_RESCHEDULED'
          : action === 'LESSON_CANCELLED'
            ? 'LESSON_CANCELLED'
            : null;
    if (templateCode) {
      const row = await ctx.tx.lessonOccurrence.findUnique({
        where: { id: lessonId },
        select: { version: true, kind: true },
      });
      if (!row) return unwrap(err(domainError('LESSON_NOT_FOUND', 404)));
      if (row.kind === 'TRIAL') return;
      unwrap(
        await new NotificationOutboxPublisher().enqueue(ctx.tx, {
          studentId,
          templateCode,
          variables: { lessonId },
          dedupeKey: `lesson:${lessonId}:${row.version}:${templateCode}`,
          operationId: ctx.operationId,
          actorId: ctx.actor.accountId,
          requestId: ctx.requestId,
        }),
      );
    }
  }
  private lead(start: Date, now: Date): Result<void, DomainError> {
    const p = unwrap(schedulePolicy());
    return !Number.isFinite(+start) || +start - +now < p.leadMinutes * 60000
      ? err(domainError('LEAD_TIME_VIOLATION', 422))
      : ok(undefined);
  }
  private async assignment(
    ctx: CriticalContext,
    enrollmentId: string,
    teacherId: string,
    start: Date,
    end: Date,
  ): Promise<string> {
    const matches = await ctx.tx.teachingAssignment.findMany({
      where: {
        enrollment_id: enrollmentId,
        teacher_id: teacherId,
        valid_from: { lte: start },
        OR: [{ valid_to: null }, { valid_to: { gte: end } }],
      },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    if (matches.length !== 1) return unwrap(err(domainError('TEACHER_NOT_ASSIGNED', 409)));
    // BookingService owns assignment activity and teacher/resource availability checks.
    await this.booking.assignment(ctx, matches[0]!.id, start, end);
    return matches[0]!.id;
  }
  async create(
    ctx: CriticalContext,
    studentId: string,
    input: CreateManagedLesson,
  ): Promise<Result<ManagedLessonView, DomainError>> {
    try {
      const now = await at(ctx.tx),
        start = new Date(input.startsAt),
        end = new Date(+start + input.durationMinutes * 60000);
      unwrap(this.lead(start, now));
      let rights: { enrollmentId: string; subscriptionId: string | null };
      if (input.kind === 'TRIAL') {
        if (!input.subjectId || input.subscriptionId)
          return err(domainError('INVALID_TRIAL_INPUT', 422));
        let enrollment = await ctx.tx.studentSubjectEnrollment.findFirst({
          where: {
            student_id: studentId,
            subject_id: input.subjectId,
            valid_to: null,
            status: 'ACTIVE',
          },
        });
        if (!enrollment)
          enrollment = await this.registry.enrollment(ctx, {
            studentId,
            subjectId: input.subjectId,
          });
        const assigned = await ctx.tx.teachingAssignment.findFirst({
          where: {
            enrollment_id: enrollment.id,
            teacher_id: input.teacherId,
            valid_from: { lte: start },
            OR: [{ valid_to: null }, { valid_to: { gte: end } }],
          },
          select: { id: true },
        });
        if (!assigned)
          await this.registry.assignment(ctx, {
            enrollmentId: enrollment.id,
            teacherId: input.teacherId,
            validFrom: now.toISOString(),
            basis: 'Пробный урок по заявке',
          });
        rights = { enrollmentId: enrollment.id, subscriptionId: null };
      } else
        rights = unwrap(
          await this.rights.resolve(ctx, studentId, start, end, input.subscriptionId),
        );
      const assignment = await this.assignment(
        ctx,
        rights.enrollmentId,
        input.teacherId,
        start,
        end,
      );
      const link = input.meetLink === undefined ? null : meetLink(input.meetLink);
      const row = await this.booking.one(ctx, {
        teachingAssignmentId: assignment,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        basis: input.kind === 'TRIAL' ? 'Пробный урок по заявке' : 'Manager booked a paid lesson',
        kind: input.kind ?? 'REGULAR',
        ...(input.kind === 'TRIAL' ? { trialLeadId: input.trialLeadId } : {}),
      });
      if (row.status !== 'SCHEDULED') return err(domainError('SUBSCRIPTION_NOT_ACTIVE', 409));
      await ctx.tx.lessonOccurrence.update({
        where: { id: row.id },
        data: {
          manager_subscription_id: rights.subscriptionId,
          reschedule_history_verified: true,
          student_reschedule_count: 0,
          google_meet_link: link,
          meet_link_overridden: input.meetLink !== undefined,
        },
      });
      await this.record(ctx, 'LESSON_CREATED', row.id, studentId, {
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        teacherId: input.teacherId,
      });
      return this.get(ctx.tx, row.id);
    } catch (error: unknown) {
      return err(scheduleFailure(error));
    }
  }
  private async exception(
    ctx: CriticalContext,
    row: LessonOccurrence,
    studentId: string,
    payload: Prisma.InputJsonObject,
    needed: boolean,
  ): Promise<string | null> {
    if (!needed) return null;
    const snapshot = {
      ...payload,
      oldStartsAt: row.scheduled_at.toISOString(),
      oldTeacherId: row.scheduled_teacher_id,
    };
    const hash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
    const prior = await ctx.tx.scheduleChangeApproval.findUnique({
      where: {
        lesson_id_lesson_version_request_hash: {
          lesson_id: row.id,
          lesson_version: row.version,
          request_hash: hash,
        },
      },
    });
    if (prior?.approved_at && !prior.consumed_at) {
      await ctx.tx.scheduleChangeApproval.update({
        where: { id: prior.id },
        data: { consumed_at: await at(ctx.tx) },
      });
      return null;
    }
    if (prior) return prior.id;
    const staff = await this.access.staff(ctx);
    const request = await ctx.tx.scheduleChangeApproval.create({
      data: {
        lesson_id: row.id,
        lesson_version: row.version,
        request_hash: hash,
        payload: snapshot,
        requested_by_id: staff,
        source_operation_id: ctx.operationId,
      },
    });
    await this.record(ctx, 'LESSON_CHANGE_APPROVAL_REQUESTED', row.id, studentId, {
      changeRequestId: request.id,
      requestedAction: payload.action!,
    });
    await this.events.task(
      ctx,
      studentId,
      row.id,
      `manager-schedule-approval:${request.id}`,
      'Требуется решение директора об исключении расписания',
    );
    return request.id;
  }
  async reschedule(
    ctx: CriticalContext,
    studentId: string,
    id: string,
    input: RescheduleManagedLesson,
  ): Promise<Result<ManagedLessonView, DomainError>> {
    try {
      if (
        typeof input.reason !== 'string' ||
        input.reason.trim().length < 3 ||
        input.reason.length > 500
      )
        return err(domainError('INVALID_INPUT', 422));
      const row = unwrap(await this.mutable(ctx, id)),
        now = await at(ctx.tx),
        start = new Date(input.newStartsAt),
        end = new Date(+start + (+row.scheduled_end_at - +row.scheduled_at));
      unwrap(this.lead(start, now));
      const initiator = input.initiator ?? 'STUDENT',
        teacher = input.newTeacherId ?? row.scheduled_teacher_id;
      if (+start === +row.scheduled_at && teacher === row.scheduled_teacher_id)
        return err(domainError('NO_SCHEDULE_CHANGE', 422));
      const rights =
        row.kind === 'TRIAL'
          ? { subscriptionId: null }
          : unwrap(
              await this.rights.resolve(
                ctx,
                studentId,
                start,
                end,
                row.manager_subscription_id ?? undefined,
                row.enrollment_id,
              ),
            );
      const assignment = await this.assignment(ctx, row.enrollment_id, teacher, start, end);
      const late = +row.scheduled_at - +now < unwrap(schedulePolicy()).freeHours * 3600000;
      if (row.kind !== 'TRIAL' && initiator === 'STUDENT' && late && !input.overrideLateRule)
        return err(domainError('LATE_RULE_OVERRIDE_REQUIRED', 409));
      const needs =
        row.kind !== 'TRIAL' &&
        initiator === 'STUDENT' &&
        (late || !row.reschedule_history_verified || row.student_reschedule_count >= 2);
      const pending = await this.exception(
        ctx,
        row,
        studentId,
        {
          action: 'RESCHEDULE',
          startsAt: start.toISOString(),
          teacherId: teacher,
          initiator,
          reason: input.reason.trim(),
        },
        needs,
      );
      if (pending)
        return ok({
          ...unwrap(await this.get(ctx.tx, id)),
          pendingChangeId: pending,
          requiresApproval: true,
        });
      await this.booking.reschedule(ctx, id, {
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        teachingAssignmentId: assignment,
        reason: `Manager reschedule: ${input.reason.trim()}`,
      });
      await ctx.tx.lessonOccurrence.update({
        where: { id },
        data: {
          manager_subscription_id: rights.subscriptionId,
          ...(initiator === 'STUDENT' ? { student_reschedule_count: { increment: 1 } } : {}),
        },
      });
      await this.record(ctx, 'LESSON_RESCHEDULED', id, studentId, {
        oldStartsAt: row.scheduled_at.toISOString(),
        newStartsAt: start.toISOString(),
        oldTeacherId: row.scheduled_teacher_id,
        newTeacherId: teacher,
        initiator,
        reason: input.reason.trim(),
        overrideLateRule: input.overrideLateRule ?? false,
      });
      return this.get(ctx.tx, id);
    } catch (error: unknown) {
      return err(scheduleFailure(error));
    }
  }
  async cancel(
    ctx: CriticalContext,
    studentId: string,
    id: string,
    input: CancelManagedLesson,
    bypassException = false,
  ): Promise<Result<ManagedLessonView, DomainError>> {
    try {
      if (
        typeof input.reason !== 'string' ||
        input.reason.trim().length < 3 ||
        input.reason.length > 500
      )
        return err(domainError('INVALID_INPUT', 422));
      const row = unwrap(await this.mutable(ctx, id)),
        now = await at(ctx.tx),
        initiator = input.initiator ?? 'STUDENT';
      if (row.kind === 'TRIAL') input = { ...input, chargeable: false };
      const late =
        row.kind !== 'TRIAL' &&
        +row.scheduled_at - +now < unwrap(schedulePolicy()).freeHours * 3600000;
      if (
        !bypassException &&
        initiator === 'STUDENT' &&
        late &&
        !input.chargeable &&
        !input.overrideLateRule
      )
        return err(domainError('LATE_RULE_OVERRIDE_REQUIRED', 409));
      const pending = await this.exception(
        ctx,
        row,
        studentId,
        { action: 'CANCEL', chargeable: input.chargeable, initiator, reason: input.reason.trim() },
        !bypassException && initiator === 'STUDENT' && late && !input.chargeable,
      );
      if (pending)
        return ok({
          ...unwrap(await this.get(ctx.tx, id)),
          pendingChangeId: pending,
          requiresApproval: true,
        });
      if (input.chargeable) {
        if (initiator !== 'STUDENT' || !late)
          return err(domainError('CHARGEABLE_CANCELLATION_NOT_ALLOWED', 409));
        const rights = unwrap(
          await this.rights.resolve(
            ctx,
            studentId,
            row.scheduled_at,
            row.scheduled_end_at,
            row.manager_subscription_id ?? undefined,
            row.enrollment_id,
          ),
        );
        await ctx.tx.lessonOccurrence.update({
          where: { id },
          data: { manager_subscription_id: rights.subscriptionId },
        });
      }
      await this.booking.cancel(ctx, id, {
        reason: `Manager cancellation: ${input.reason.trim()}`,
      });
      await this.record(ctx, 'LESSON_CANCELLED', id, studentId, {
        reason: input.reason.trim(),
        chargeable: input.chargeable,
        initiator,
      });
      if (input.chargeable)
        await this.events.task(
          ctx,
          studentId,
          id,
          `chargeable-cancellation:${id}`,
          'Проверить отдельную компенсацию преподавателю за позднюю отмену',
        );
      return this.get(ctx.tx, id);
    } catch (error: unknown) {
      return err(scheduleFailure(error));
    }
  }
  async setMeet(
    ctx: CriticalContext,
    studentId: string,
    id: string,
    url: string | null,
  ): Promise<Result<ManagedLessonView, DomainError>> {
    try {
      unwrap(await this.mutable(ctx, id));
      const value = url === null ? null : meetLink(url);
      await ctx.tx.lessonOccurrence.update({
        where: { id },
        data: { google_meet_link: value, meet_link_overridden: true },
      });
      await this.record(
        ctx,
        url === null ? 'LESSON_MEET_LINK_CLEARED' : 'LESSON_MEET_LINK_SET',
        id,
        studentId,
        { meetLink: value },
      );
      return this.get(ctx.tx, id);
    } catch (error: unknown) {
      return err(scheduleFailure(error));
    }
  }
  generateMeet(lesson: { id: string }): Promise<Result<string, DomainError>> {
    return this.meet.generate(lesson);
  }
  async review(
    ctx: CriticalContext,
    id: string,
  ): Promise<Result<ChangeApprovalReview, DomainError>> {
    try {
      if (
        ctx.actor.kind !== 'STAFF' ||
        !ctx.actor.roles.includes('DIRECTOR') ||
        ctx.actor.recoveryOnly
      )
        return err(domainError('FORBIDDEN_ROLE', 403));
      await this.access.staff(ctx);
      const request = await ctx.tx.scheduleChangeApproval.findUnique({ where: { id } });
      if (!request) return err(domainError('CHANGE_REQUEST_NOT_FOUND', 404));
      const row = await ctx.tx.lessonOccurrence.findUnique({
        where: { id: request.lesson_id },
        include: { enrollment_ref: true },
      });
      if (!row) return err(domainError('CHANGE_REQUEST_NOT_FOUND', 404));
      const payload = request.payload as Prisma.JsonObject;
      return ok({
        id: request.id,
        lessonId: row.id,
        studentId: row.enrollment_ref.student_id,
        action: payload.action as 'RESCHEDULE' | 'CANCEL',
        initiator: payload.initiator as 'STUDENT' | 'TEACHER' | 'ACADEMY',
        reason: redactMeet(payload.reason) as string,
        oldStartsAt: payload.oldStartsAt as string,
        newStartsAt: typeof payload.startsAt === 'string' ? payload.startsAt : null,
        oldTeacherId: payload.oldTeacherId as string,
        newTeacherId: typeof payload.teacherId === 'string' ? payload.teacherId : null,
        chargeable: typeof payload.chargeable === 'boolean' ? payload.chargeable : null,
        status: request.consumed_at
          ? 'APPLIED'
          : row.version !== request.lesson_version ||
              row.scheduled_at <= (await at(ctx.tx)) ||
              !['SCHEDULED', 'STAR_PENDING'].includes(row.status)
            ? 'STALE'
            : request.approved_at
              ? 'APPROVED'
              : 'PENDING',
      });
    } catch (error: unknown) {
      return err(scheduleFailure(error));
    }
  }
  async approve(
    ctx: CriticalContext,
    id: string,
  ): Promise<Result<{ id: string; lessonId: string; status: 'APPROVED' }, DomainError>> {
    try {
      if (
        ctx.actor.kind !== 'STAFF' ||
        !ctx.actor.roles.includes('DIRECTOR') ||
        ctx.actor.recoveryOnly
      )
        return err(domainError('FORBIDDEN_ROLE', 403));
      const staff = await this.access.staff(ctx);
      await ctx.tx
        .$queryRaw`SELECT id FROM schedule_change_approvals WHERE id=${id}::uuid FOR UPDATE`;
      const approval = await ctx.tx.scheduleChangeApproval.findUnique({ where: { id } });
      if (!approval) return err(domainError('CHANGE_REQUEST_NOT_FOUND', 404));
      const lesson = unwrap(await this.mutable(ctx, approval.lesson_id));
      if (lesson.version !== approval.lesson_version || approval.consumed_at)
        return err(domainError('CHANGE_REQUEST_STALE', 409));
      if (approval.approved_at) return err(domainError('CHANGE_REQUEST_ALREADY_APPROVED', 409));
      await ctx.tx.scheduleChangeApproval.update({
        where: { id },
        data: { approved_by_id: staff, approved_at: await at(ctx.tx) },
      });
      const enrollment = await ctx.tx.studentSubjectEnrollment.findUniqueOrThrow({
        where: { id: lesson.enrollment_id },
      });
      await this.record(ctx, 'LESSON_CHANGE_APPROVED', lesson.id, enrollment.student_id, {
        changeRequestId: id,
      });
      return ok({ id, lessonId: lesson.id, status: 'APPROVED' });
    } catch (error: unknown) {
      return err(scheduleFailure(error));
    }
  }
}

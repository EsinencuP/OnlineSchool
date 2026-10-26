import { Injectable } from '@nestjs/common';
import type { CriticalContext } from '../../core/http.js';
import { domainError, fail } from '../../core/errors/domain-error.js';
import { object, string, uuid } from '../identity/input.js';
import { at, count, date } from '../finance/finance-common.js';
import { TeacherRateService } from '../finance/teacher-rate.service.js';
import { ScheduleAccess } from './schedule-access.service.js';
import { ScheduleEvents } from './schedule-events.service.js';
import { admission } from './booking.service.js';

@Injectable()
export class OutcomesService {
  constructor(
    private readonly access: ScheduleAccess,
    private readonly events: ScheduleEvents,
    private readonly rates: TeacherRateService,
  ) {}
  async start(ctx: CriticalContext, id: string, body: unknown) {
    object(body ?? {}, []);
    id = uuid(id);
    await ctx.tx.$queryRaw`SELECT id FROM lesson_occurrences WHERE id=${id}::uuid FOR UPDATE`;
    const lesson = await this.access.lesson(ctx, id, true),
      now = await at(ctx.tx);
    if (
      !['SCHEDULED', 'STAR_PENDING'].includes(lesson.status) ||
      now < lesson.scheduled_at ||
      now >= lesson.scheduled_end_at
    )
      return fail(domainError('LESSON_NOT_IN_START_WINDOW', 422));
    const en = await ctx.tx.studentSubjectEnrollment.findUniqueOrThrow({
      where: { id: lesson.enrollment_id },
    });
    if (en.status !== 'ACTIVE') return fail(domainError('ENROLLMENT_INACTIVE', 422));
    const allowed = await admission(ctx.tx, lesson.enrollment_id, now);
    if (!allowed.paid && !allowed.permissionId)
      return fail(domainError('PAID_ACCESS_OR_DIRECTOR_PERMISSION_REQUIRED', 403));
    const started = await this.rates.snapshotAtStart(ctx, id, lesson.scheduled_teacher_id, now);
    const updated =
      lesson.status === 'STAR_PENDING'
        ? await ctx.tx.lessonOccurrence.update({ where: { id }, data: { status: 'SCHEDULED' } })
        : started;
    await this.events.change(
      ctx,
      id,
      lesson,
      updated,
      'Actual lesson start recorded by assigned teacher',
    );
    return updated;
  }
  async report(ctx: CriticalContext, id: string, body: unknown) {
    const i = object(body, ['result', 'actualStartedAt', 'durationMin', 'note']);
    id = uuid(id);
    await ctx.tx.$queryRaw`SELECT id FROM lesson_occurrences WHERE id=${id}::uuid FOR UPDATE`;
    const lesson = await this.access.lesson(ctx, id, true),
      teacher = await this.access.teacher(ctx),
      now = await at(ctx.tx);
    if (
      lesson.confirmed_report_id ||
      now < lesson.scheduled_end_at ||
      !['SCHEDULED', 'STAR_PENDING'].includes(lesson.status)
    )
      return fail(domainError('LESSON_NOT_REPORTABLE', 422));
    if (!['CONDUCTED', 'NOT_CONDUCTED', 'DISPUTED'].includes(i.result as string))
      return fail(domainError('INVALID_OUTCOME_RESULT', 422));
    const conducted = i.result === 'CONDUCTED';
    const start = conducted ? date(i.actualStartedAt) : null,
      duration = conducted ? count(i.durationMin, 1, 480) : null;
    if (!conducted && (i.actualStartedAt !== undefined || i.durationMin !== undefined))
      return fail(domainError('INVALID_INPUT', 400));
    if (start && duration && (+start + duration * 60000 > +now || start > now))
      return fail(domainError('INVALID_ACTUAL_INTERVAL', 422));
    if (lesson.actual_start_at && start && lesson.actual_start_at.getTime() !== start.getTime())
      return fail(domainError('ACTUAL_START_SNAPSHOT_MISMATCH', 422));
    const prior = await ctx.tx.lessonOutcomeReport.findFirst({
      where: { lesson_occurrence_id: id },
      orderBy: { version: 'desc' },
    });
    const report = await ctx.tx.lessonOutcomeReport.create({
      data: {
        lesson_occurrence_id: id,
        reported_by_id: teacher,
        version: (prior?.version ?? 0) + 1,
        lesson_version: lesson.version,
        result: i.result as 'CONDUCTED' | 'NOT_CONDUCTED' | 'DISPUTED',
        actual_started_at: start,
        duration_min: duration,
        note: string(i.note, 5, 2000),
        reported_at: now,
        source_operation_id: ctx.operationId,
      },
    });
    const en = await ctx.tx.studentSubjectEnrollment.findUniqueOrThrow({
      where: { id: lesson.enrollment_id },
    });
    if (+now > +lesson.scheduled_end_at + 86400000)
      await this.events.task(
        ctx,
        en.student_id,
        id,
        `outcome-deadline:${id}:${lesson.version}`,
        'Истёк 24-часовой срок подтверждения исхода урока',
      );
    return { ...report, late: +now > +lesson.scheduled_end_at + 86400000 };
  }
  async confirm(ctx: CriticalContext, id: string, body: unknown) {
    const i = object(body, ['reportId', 'basis', 'temporaryAccessPermissionId']);
    id = uuid(id);
    await ctx.tx.$queryRaw`SELECT id FROM lesson_occurrences WHERE id=${id}::uuid FOR UPDATE`;
    const lesson = await this.access.lesson(ctx, id),
      staff = await this.access.staff(ctx),
      now = await at(ctx.tx);
    if (lesson.confirmed_report_id || !['SCHEDULED', 'STAR_PENDING'].includes(lesson.status))
      return fail(domainError('LESSON_ALREADY_RESOLVED', 409));
    const report = await ctx.tx.lessonOutcomeReport.findUnique({ where: { id: uuid(i.reportId) } }),
      latest = await ctx.tx.lessonOutcomeReport.findFirst({
        where: { lesson_occurrence_id: id },
        orderBy: { version: 'desc' },
      });
    if (
      !report ||
      report.lesson_occurrence_id !== id ||
      report.id !== latest?.id ||
      report.lesson_version !== lesson.version
    )
      return fail(domainError('LATEST_MATCHING_REPORT_REQUIRED', 409));
    const basis = string(i.basis, 5, 500),
      en = await ctx.tx.studentSubjectEnrollment.findUniqueOrThrow({
        where: { id: lesson.enrollment_id },
      });
    if (+now > +lesson.scheduled_end_at + 86400000)
      await this.events.task(
        ctx,
        en.student_id,
        id,
        `outcome-deadline:${id}:${lesson.version}`,
        'Истёк 24-часовой срок подтверждения исхода урока',
      );
    let status: 'CONDUCTED' | 'STAR_PENDING' | 'CANCELLED' | 'DISPUTED';
    let outcome = null;
    if (report.result === 'CONDUCTED') {
      const started = await this.rates.snapshotAtStart(
        ctx,
        id,
        report.reported_by_id,
        report.actual_started_at!,
      );
      if (started.actual_start_at?.getTime() !== report.actual_started_at?.getTime())
        return fail(domainError('ACTUAL_START_SNAPSHOT_MISMATCH', 422));
      let permission: string | null = null;
      if (i.temporaryAccessPermissionId !== undefined) {
        permission = uuid(i.temporaryAccessPermissionId);
        await ctx.tx
          .$queryRaw`SELECT id FROM temporary_access_permissions WHERE id=${permission}::uuid FOR UPDATE`;
        const allowed = await admission(
          ctx.tx,
          lesson.enrollment_id,
          report.actual_started_at!,
          permission,
        );
        if (allowed.permissionId !== permission)
          return fail(domainError('DIRECTOR_PERMISSION_NOT_APPLICABLE', 422));
      }
      outcome = await ctx.tx.lessonActualOutcome.create({
        data: {
          report_id: report.id,
          lesson_occurrence_id: id,
          actual_teacher_id: report.reported_by_id,
          actual_started_at: report.actual_started_at!,
          duration_min: report.duration_min!,
          confirmed_at: now,
          confirmed_by_id: staff,
          temporary_access_permission_id: permission,
          rate_snapshot: started.rate_at_start_snapshot!,
          points_snapshot: started.points_at_start_snapshot!,
          rate_basis: started.rate_basis_at_start!,
          currency: started.rate_currency_at_start!,
          basis,
          source_operation_id: ctx.operationId,
        },
      });
      status = 'CONDUCTED';
      const allowed = await admission(ctx.tx, lesson.enrollment_id, report.actual_started_at!);
      if (!allowed.paid && !permission)
        await this.events.task(
          ctx,
          en.student_id,
          id,
          `unpaid-conducted:${id}`,
          'Проведён неоплаченный урок: собрать факты для индивидуального решения директора',
        );
    } else if (report.result === 'DISPUTED') status = 'DISPUTED';
    else {
      status = lesson.status === 'STAR_PENDING' ? 'STAR_PENDING' : 'CANCELLED';
      if (status === 'STAR_PENDING')
        await this.events.task(
          ctx,
          en.student_id,
          id,
          `star-follow-up:${id}:${lesson.version}`,
          'Неоплаченный ⭐-урок не состоялся: связаться с семьёй; слот удержан',
        );
    }
    const updated = await ctx.tx.lessonOccurrence.update({
      where: { id },
      data: { status, confirmed_report_id: report.id },
    });
    await this.events.change(ctx, id, lesson, updated, basis);
    return { id, lesson: updated, outcome };
  }
}

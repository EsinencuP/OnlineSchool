import { Injectable } from '@nestjs/common';
import type { LessonOccurrence, LessonOutcomeDisputeDecision, Prisma } from '@online-school/db';
import { ok } from '@online-school/shared';
import { domainError, fail, unwrap } from '../../core/errors/domain-error.js';
import type { CriticalContext } from '../../core/http.js';
import { TransactionService } from '../../core/transaction/transaction.service.js';
import { recordCheckpoints } from '../education/checkpoints.js';
import { FinanceAccess } from '../finance/finance-access.service.js';
import { at, count, date } from '../finance/finance-common.js';
import { FinanceLedger } from '../finance/finance-ledger.service.js';
import { TeacherRateService } from '../finance/teacher-rate.service.js';
import { object, string, uuid } from '../identity/input.js';
import { lessonOutcomeAdmission } from '../schedule/lesson-outcome-admission.js';
import { redactMeet } from '../schedule/meet-link.js';
import { ScheduleEvents } from '../schedule/schedule-events.service.js';
import type {
  LessonDisputeDecisionDto,
  LessonDisputeReviewDto,
} from './dto/director-lesson-dispute.dto.js';

const decisionView = (
  row: LessonOutcomeDisputeDecision,
  hasAccrual = false,
): LessonDisputeDecisionDto => ({
  id: row.id,
  lessonId: row.lesson_id,
  reportId: row.report_id,
  outcomeId: row.outcome_id,
  originPeriodId: row.origin_period_id,
  directorId: row.director_id,
  result: row.result === 'CONDUCTED' ? 'CONDUCTED' : 'NOT_CONDUCTED',
  reconstructedSnapshot: row.reconstructed_snapshot,
  decidedAt: row.decided_at.toISOString(),
  requiresFinancialDecision: row.outcome_id !== null && !hasAccrual,
});

@Injectable()
export class DirectorLessonDisputeService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly access: FinanceAccess,
    private readonly rates: TeacherRateService,
    private readonly ledger: FinanceLedger,
    private readonly events: ScheduleEvents,
  ) {}

  async review(id: string): Promise<LessonDisputeReviewDto> {
    id = uuid(id);
    return unwrap(
      await this.transactions.runReadOnly(async (tx) => {
        const lesson = await tx.lessonOccurrence.findUnique({
          where: { id },
          include: {
            enrollment_ref: { select: { student_id: true } },
            confirmed_report_ref: true,
            outcome_dispute_decision: {
              include: {
                outcome: {
                  select: { t03_teacheraccrual_lesson_actual_outcome_id: { select: { id: true } } },
                },
              },
            },
          },
        });
        const report = lesson?.confirmed_report_ref;
        const decision = lesson?.outcome_dispute_decision;
        if (
          !lesson ||
          lesson.kind !== 'REGULAR' ||
          report?.result !== 'DISPUTED' ||
          report.lesson_occurrence_id !== id ||
          (lesson.status !== 'DISPUTED' && !decision)
        )
          return fail(domainError('LESSON_DISPUTE_NOT_FOUND', 404));
        return ok({
          lessonId: lesson.id,
          reportId: report.id,
          studentId: lesson.enrollment_ref.student_id,
          teacherId: report.reported_by_id,
          scheduledAt: lesson.scheduled_at.toISOString(),
          scheduledEndAt: lesson.scheduled_end_at.toISOString(),
          reportedAt: report.reported_at.toISOString(),
          reportNote: redactMeet(report.note) as string,
          actualStartedAt: lesson.actual_start_at?.toISOString() ?? null,
          decision: decision
            ? decisionView(
                decision,
                !!decision.outcome?.t03_teacheraccrual_lesson_actual_outcome_id,
              )
            : null,
          decisionEvidenceReference: decision
            ? (redactMeet(decision.evidence_reference) as string)
            : null,
          decisionReason: decision ? (redactMeet(decision.reason) as string) : null,
        });
      }),
    );
  }

  async resolve(
    ctx: CriticalContext,
    id: string,
    body: unknown,
  ): Promise<LessonDisputeDecisionDto> {
    if (!ctx.actor.mfaCompleted) return fail(domainError('MFA_REQUIRED', 403));
    const staffId = await this.access.staff(ctx, true);
    id = uuid(id);
    const input = object(body, [
      'reportId',
      'result',
      'actualStartedAt',
      'durationMin',
      'temporaryAccessPermissionId',
      'evidenceReference',
      'reason',
    ]);
    const reportId = uuid(input.reportId);
    const { result } = input;
    if (result !== 'CONDUCTED' && result !== 'NOT_CONDUCTED')
      return fail(domainError('INVALID_OUTCOME_RESULT', 422));
    const evidenceReference = string(input.evidenceReference, 1, 200);
    const reason = string(input.reason, 5, 500);
    if (
      result === 'NOT_CONDUCTED' &&
      (input.actualStartedAt !== undefined ||
        input.durationMin !== undefined ||
        input.temporaryAccessPermissionId !== undefined)
    )
      return fail(domainError('INVALID_INPUT', 400));
    await ctx.tx.$queryRaw`SELECT id FROM lesson_occurrences WHERE id=${id}::uuid FOR UPDATE`;
    const lesson = await ctx.tx.lessonOccurrence.findUnique({ where: { id } });
    if (!lesson || lesson.kind !== 'REGULAR' || !lesson.confirmed_report_id)
      return fail(domainError('LESSON_DISPUTE_NOT_FOUND', 404));
    if (lesson.status !== 'DISPUTED')
      return fail(domainError('LESSON_DISPUTE_ALREADY_RESOLVED', 409));
    if (lesson.confirmed_report_id !== reportId)
      return fail(domainError('LESSON_DISPUTE_REPORT_CHANGED', 409));
    const report = await ctx.tx.lessonOutcomeReport.findUnique({ where: { id: reportId } });
    if (!report || report.lesson_occurrence_id !== id || report.result !== 'DISPUTED')
      return fail(domainError('LESSON_DISPUTE_NOT_FOUND', 404));
    if (
      await ctx.tx.lessonActualOutcome.findUnique({
        where: { lesson_occurrence_id: id },
        select: { id: true },
      })
    )
      return fail(domainError('LESSON_DISPUTE_ALREADY_RESOLVED', 409));
    const now = await at(ctx.tx);
    const origin = await this.ledger.periodState(ctx.tx, lesson.scheduled_at, false);

    let outcomeId: string | null = null;
    if (result === 'CONDUCTED')
      outcomeId = await this.verifyConducted(ctx, lesson, input, {
        now,
        staffId,
        reason,
        evidenceReference,
      });
    const decision = await ctx.tx.lessonOutcomeDisputeDecision.create({
      data: {
        lesson_id: id,
        report_id: reportId,
        outcome_id: outcomeId,
        origin_period_id: origin?.id ?? null,
        director_id: staffId,
        result,
        evidence_reference: evidenceReference,
        reason,
        reconstructed_snapshot: result === 'CONDUCTED' && !lesson.actual_start_at,
        decided_at: now,
        source_operation_id: ctx.operationId,
      },
    });
    const status = result === 'CONDUCTED' ? 'CONDUCTED' : 'CANCELLED';
    await ctx.tx.lessonOccurrence.update({ where: { id }, data: { status } });
    if (outcomeId)
      await recordCheckpoints(ctx.tx, {
        enrollmentId: lesson.enrollment_id,
        outcomeId,
        confirmedAt: now,
        operationId: ctx.operationId,
      });
    await this.events.change(
      ctx,
      id,
      { status: lesson.status, reportId },
      { status, reportId, decisionId: decision.id, outcomeId, originPeriodId: origin?.id ?? null },
      reason,
    );
    return decisionView(decision);
  }

  private async verifyConducted(
    ctx: CriticalContext,
    lesson: LessonOccurrence,
    input: Record<string, unknown>,
    evidence: { now: Date; staffId: string; reason: string; evidenceReference: string },
  ) {
    const actualInput = input.actualStartedAt === undefined ? null : date(input.actualStartedAt);
    const start = lesson.actual_start_at ?? actualInput;
    if (!start) return fail(domainError('DOCUMENTED_LESSON_START_REQUIRED', 422));
    if (lesson.actual_start_at && actualInput && +lesson.actual_start_at !== +actualInput)
      return fail(domainError('ACTUAL_START_SNAPSHOT_MISMATCH', 422));
    const durationMin = count(input.durationMin, 1, 480);
    if (
      +start + durationMin * 60000 > +evidence.now ||
      (!lesson.actual_start_at && (start < lesson.scheduled_at || start >= lesson.scheduled_end_at))
    )
      return fail(domainError('INVALID_ACTUAL_INTERVAL', 422));
    const snapshot = lesson.actual_start_at
      ? lesson
      : await this.reconstructStart(ctx.tx, lesson, start, evidence);
    const teacher = snapshot.actual_teacher_at_start_id;
    if (
      !teacher ||
      snapshot.rate_at_start_snapshot === null ||
      snapshot.points_at_start_snapshot === null ||
      !snapshot.rate_basis_at_start ||
      !snapshot.rate_currency_at_start
    )
      return fail(domainError('ACTUAL_START_SNAPSHOT_MISMATCH', 422));
    const { permissionId, paid } = await lessonOutcomeAdmission(
      ctx.tx,
      lesson,
      start,
      input.temporaryAccessPermissionId,
    );
    const outcome = await ctx.tx.lessonActualOutcome.create({
      data: {
        lesson_occurrence_id: lesson.id,
        actual_teacher_id: teacher,
        actual_started_at: start,
        duration_min: durationMin,
        confirmed_at: evidence.now,
        confirmed_by_id: evidence.staffId,
        temporary_access_permission_id: permissionId,
        rate_snapshot: snapshot.rate_at_start_snapshot,
        points_snapshot: snapshot.points_at_start_snapshot,
        rate_basis: snapshot.rate_basis_at_start,
        currency: snapshot.rate_currency_at_start,
        basis: evidence.reason,
        source_operation_id: ctx.operationId,
      },
    });
    if (!paid) {
      const enrollment = await ctx.tx.studentSubjectEnrollment.findUniqueOrThrow({
        where: { id: lesson.enrollment_id },
        select: { student_id: true },
      });
      await this.events.task(
        ctx,
        enrollment.student_id,
        lesson.id,
        `unpaid-conducted:${lesson.id}`,
        'Проведён неоплаченный урок: сверить документы для решения о начислении',
      );
    }
    return outcome.id;
  }

  private async reconstructStart(
    tx: Prisma.TransactionClient,
    lesson: LessonOccurrence,
    start: Date,
    evidence: { now: Date; evidenceReference: string },
  ) {
    const assignment = await tx.teachingAssignment.findFirst({
      where: {
        id: lesson.teaching_assignment_id,
        teacher_id: lesson.scheduled_teacher_id,
        enrollment_id: lesson.enrollment_id,
        valid_from: { lte: start },
        OR: [{ valid_to: null }, { valid_to: { gt: start } }],
      },
      select: { id: true },
    });
    if (!assignment) return fail(domainError('ACTUAL_TEACHER_NOT_ASSIGNED', 422));
    const quote = await this.rates.quote(tx, lesson.scheduled_teacher_id, start);
    return tx.lessonOccurrence.update({
      where: { id: lesson.id },
      data: {
        actual_start_at: start,
        actual_teacher_at_start_id: lesson.scheduled_teacher_id,
        rate_at_start_snapshot: quote.rate,
        points_at_start_snapshot: quote.points,
        rate_basis_at_start: quote.basis,
        rate_currency_at_start: quote.currency,
        rate_context_snapshot: {
          ...quote.context,
          source: 'DIRECTOR_VERIFIED_RETROSPECTIVE',
          recordedAt: evidence.now.toISOString(),
          evidenceReference: evidence.evidenceReference,
        },
      },
    });
  }
}

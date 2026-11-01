import { Injectable } from '@nestjs/common';
import type { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { domainError } from '../../../core/errors/domain-error.js';
import type { DomainError } from '../../../core/errors/domain-error.js';
import type { CriticalContext } from '../../../core/http.js';
import { TransactionService } from '../../../core/transaction/transaction.service.js';
import { ManagerScheduleWorkflow } from '../../schedule/manager/workflow.service.js';
import { interval, scheduleFailure } from '../../schedule/manager/policy.js';
import type {
  CancelManagedLesson,
  CreateManagedLesson,
  ManagedLessonView,
  RescheduleManagedLesson,
  ScheduleQuery,
} from '../../schedule/manager/contracts.js';
import type { ManagerContext } from '../context/manager-context.js';
import { ManagerScopeService } from '../scope/manager-scope.service.js';
import { ManagerFinanceFacade } from '../finance/manager-finance.facade.js';
import { scheduleOverlapWhere } from './schedule-read.spec.js';
@Injectable()
export class ManagerScheduleService {
  constructor(
    private readonly workflow: ManagerScheduleWorkflow,
    private readonly transactions: TransactionService,
    private readonly scope: ManagerScopeService,
    private readonly finance: ManagerFinanceFacade,
  ) {}
  async target(
    ctx: ManagerContext,
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<Result<string, DomainError>> {
    try {
      const row = await tx.lessonOccurrence.findUnique({
        where: { id },
        select: { enrollment_ref: { select: { student_id: true } } },
      });
      if (!row) return err(domainError('LESSON_NOT_FOUND', 404));
      const allowed = await this.scope.assertStudentInPortfolio(
        ctx,
        row.enrollment_ref.student_id,
        tx,
      );
      return allowed.ok
        ? ok(row.enrollment_ref.student_id)
        : err(
            allowed.error.code === 'STUDENT_NOT_FOUND'
              ? domainError('LESSON_NOT_FOUND', 404)
              : allowed.error,
          );
    } catch (error: unknown) {
      return err(scheduleFailure(error));
    }
  }
  private async authorize(
    ctx: ManagerContext,
    c: CriticalContext,
  ): Promise<Result<void, DomainError>> {
    const current = await this.scope.resolveContext({ ...c.actor, requestId: c.requestId }, c.tx);
    if (!current.ok) return current;
    return current.value.managerId === ctx.managerId && current.value.accountId === ctx.accountId
      ? ok(undefined)
      : err(domainError('FORBIDDEN_ROLE', 403));
  }
  list(ctx: ManagerContext, q: ScheduleQuery): Promise<Result<ManagedLessonView[], DomainError>> {
    return this.transactions.runResult(async (tx) => {
      const dates = interval(q.from, q.to);
      if (!dates.ok) return dates;
      if (q.studentId) {
        const allowed = await this.scope.assertStudentInPortfolio(ctx, q.studentId, tx);
        if (!allowed.ok) return allowed;
      }
      return this.workflow.list(tx, {
        ...scheduleOverlapWhere(dates.value.from, dates.value.to),
        ...(q.teacherId ? { scheduled_teacher_id: q.teacherId } : {}),
        ...(q.status ? { status: q.status } : {}),
        enrollment_ref: {
          ...(q.studentId ? { student_id: q.studentId } : {}),
          student_ref: this.scope.portfolioWhere(ctx),
        },
      });
    });
  }
  get(ctx: ManagerContext, id: string): Promise<Result<ManagedLessonView, DomainError>> {
    return this.transactions.runResult(async (tx) => {
      const s = await this.target(ctx, id, tx);
      return s.ok ? this.workflow.get(tx, id) : s;
    });
  }
  async create(
    ctx: ManagerContext,
    studentId: string,
    input: CreateManagedLesson,
    c: CriticalContext,
  ): Promise<Result<ManagedLessonView, DomainError>> {
    const actor = await this.authorize(ctx, c);
    if (!actor.ok) return actor;
    const s = await this.scope.assertStudentInPortfolio(ctx, studentId, c.tx);
    return s.ok ? this.workflow.create(c, studentId, input) : s;
  }
  async reschedule(
    ctx: ManagerContext,
    id: string,
    input: RescheduleManagedLesson,
    c: CriticalContext,
  ): Promise<Result<ManagedLessonView, DomainError>> {
    const actor = await this.authorize(ctx, c);
    if (!actor.ok) return actor;
    const s = await this.target(ctx, id, c.tx);
    return s.ok ? this.workflow.reschedule(c, s.value, id, input) : s;
  }
  async cancel(
    ctx: ManagerContext,
    id: string,
    input: CancelManagedLesson,
    c: CriticalContext,
  ): Promise<Result<ManagedLessonView, DomainError>> {
    const actor = await this.authorize(ctx, c);
    if (!actor.ok) return actor;
    const s = await this.target(ctx, id, c.tx);
    if (!s.ok) return s;
    const result = await this.workflow.cancel(c, s.value, id, input);
    if (
      !result.ok ||
      result.value.requiresApproval ||
      result.value.status !== 'CANCELLED' ||
      !input.chargeable
    )
      return result;
    if (!result.value.subscriptionId) return err(domainError('SUBSCRIPTION_NOT_ACTIVE', 409));
    const deducted = await this.finance.publishDeduction(
      ctx,
      {
        studentId: s.value,
        lessonId: id,
        subscriptionId: result.value.subscriptionId,
        reason: `Cancellation: ${input.reason.trim()}`,
      },
      c,
    );
    return deducted.ok ? this.workflow.get(c.tx, id) : deducted;
  }
  async setMeetLink(
    ctx: ManagerContext,
    id: string,
    url: string | null,
    c: CriticalContext,
  ): Promise<Result<ManagedLessonView, DomainError>> {
    const actor = await this.authorize(ctx, c);
    if (!actor.ok) return actor;
    const s = await this.target(ctx, id, c.tx);
    return s.ok ? this.workflow.setMeet(c, s.value, id, url) : s;
  }
}

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
  private async brief(
    ctx: ManagerContext,
    views: ManagedLessonView[],
    tx: Prisma.TransactionClient,
  ): Promise<Result<ManagedLessonView[], DomainError>> {
    try {
      const ids = views.filter((v) => v.kind === 'TRIAL').map((v) => v.lessonId);
      if (!ids.length) return ok(views.map((v) => ({ ...v, trialBrief: null })));
      const leads = await tx.lead.findMany({
        where: {
          AND: [this.scope.leadWhere(ctx), { trial_lessons: { some: { id: { in: ids } } } }],
        },
        select: {
          id: true,
          audience: true,
          age_years: true,
          grade: true,
          level: true,
          subject: { select: { name: true } },
          trial_lessons: { where: { id: { in: ids } }, select: { id: true } },
        },
      });
      return ok(
        views.map((v) => {
          const lead = leads.find((l) => l.trial_lessons.some((t) => t.id === v.lessonId));
          return {
            ...v,
            trialBrief: lead
              ? {
                  leadId: lead.id,
                  audience: lead.audience,
                  ageYears: lead.age_years,
                  grade: lead.grade,
                  level: lead.level,
                  subjectName: lead.subject?.name ?? '',
                }
              : null,
          };
        }),
      );
    } catch (e: unknown) {
      return err(scheduleFailure(e));
    }
  }
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
      const result = await this.workflow.list(tx, {
        ...scheduleOverlapWhere(dates.value.from, dates.value.to),
        ...(q.teacherId ? { scheduled_teacher_id: q.teacherId } : {}),
        ...(q.status ? { status: q.status } : {}),
        ...(q.kind ? { kind: q.kind } : {}),
        enrollment_ref: {
          ...(q.studentId ? { student_id: q.studentId } : {}),
          student_ref: this.scope.portfolioWhere(ctx),
        },
      });
      return result.ok ? this.brief(ctx, result.value, tx) : result;
    });
  }
  get(ctx: ManagerContext, id: string): Promise<Result<ManagedLessonView, DomainError>> {
    return this.transactions.runResult(async (tx) => {
      const s = await this.target(ctx, id, tx);
      if (!s.ok) return s;
      const result = await this.workflow.get(tx, id);
      if (!result.ok) return result;
      const projected = await this.brief(ctx, [result.value], tx);
      return projected.ok ? ok(projected.value[0]!) : projected;
    });
  }
  async create(
    ctx: ManagerContext,
    studentId: string,
    input: CreateManagedLesson,
    c: CriticalContext,
    trialLeadId?: string,
  ): Promise<Result<ManagedLessonView, DomainError>> {
    const actor = await this.authorize(ctx, c);
    if (!actor.ok) return actor;
    if (input.kind === 'TRIAL') {
      if (!trialLeadId || !input.subjectId) return err(domainError('TRIAL_LEAD_REQUIRED', 422));
      const allowed = await this.scope.assertLeadInPortfolio(ctx, trialLeadId, c.tx);
      if (!allowed.ok) return allowed;
      const lead = await c.tx.lead.findFirst({
        where: {
          id: trialLeadId,
          subject_id: input.subjectId,
          stage: { in: ['CONTACTED', 'AWAITING_PAYMENT'] },
          student_links: { some: { student_id: studentId, unlinked_at: null } },
        },
        select: { id: true },
      });
      if (!lead) return err(domainError('LEAD_NOT_FOUND', 404));
      input = { ...input, trialLeadId };
    }
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
      !input.chargeable ||
      result.value.kind === 'TRIAL'
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

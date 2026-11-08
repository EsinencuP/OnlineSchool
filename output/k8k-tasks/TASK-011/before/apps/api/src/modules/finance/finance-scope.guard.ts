import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { err, ok } from '@online-school/shared';
import { DatabaseService } from '../../core/database/database.module.js';
import { AuditService } from '../../core/audit/audit.service.js';
import { AppException, domainError, fail, unwrap } from '../../core/errors/domain-error.js';
import type { HttpRequest, CriticalContext } from '../../core/http.js';
import { uuid } from '../identity/input.js';
import { FinanceAccess } from './finance-access.service.js';

@Injectable()
export class FinanceScopeGuard implements CanActivate {
  constructor(
    private readonly access: FinanceAccess,
    private readonly db: DatabaseService,
    private readonly audit: AuditService,
  ) {}
  async check(name: string, ctx: CriticalContext, req: HttpRequest): Promise<void> {
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
      string,
      unknown
    >;
    if (name === 'register') {
      await this.access.student(ctx, uuid(body.studentId));
      return;
    }
    if (['confirm', 'distribute'].includes(name)) {
      await this.access.payment(ctx, uuid(req.params.id));
      if (name === 'distribute') await this.access.subscription(ctx, uuid(body.subscriptionId));
      return;
    }
    if (['grant', 'temporary'].includes(name)) {
      await this.access.subscription(ctx, uuid(body.subscriptionId));
      return;
    }
    if (name === 'subscription') {
      const en = await ctx.tx.studentSubjectEnrollment.findUnique({
        where: { id: uuid(body.enrollmentId) },
      });
      if (!en) return fail(domainError('NOT_FOUND', 404));
      await this.access.student(ctx, en.student_id);
      return;
    }
    if (name === 'approve') {
      const d = await ctx.tx.paymentDistribution.findUnique({ where: { id: uuid(req.params.id) } });
      if (!d) return fail(domainError('NOT_FOUND', 404));
      await this.access.payment(ctx, d.payment_id);
      await this.access.subscription(ctx, d.subscription_id);
      return;
    }
    if (['consume', 'adjust'].includes(name)) {
      const g = await ctx.tx.entitlementGrant.findUnique({ where: { id: uuid(body.grantId) } });
      if (!g) return fail(domainError('NOT_FOUND', 404));
      await this.access.subscription(ctx, g.subscription_id);
      return;
    }
    if (['accrue', 'payoutAttempt', 'payoutConfirm'].includes(name)) {
      let outcomeId: string;
      if (name === 'accrue') outcomeId = uuid(body.outcomeId);
      else {
        const attempt =
          name === 'payoutConfirm'
            ? await ctx.tx.payoutAttempt.findUnique({ where: { id: uuid(req.params.id) } })
            : null;
        if (name === 'payoutConfirm' && !attempt) return fail(domainError('NOT_FOUND', 404));
        const obligation = await ctx.tx.payrollObligation.findUnique({
          where: { id: attempt?.obligation_id ?? uuid(body.obligationId) },
        });
        if (!obligation) return fail(domainError('NOT_FOUND', 404));
        const accrual = await ctx.tx.teacherAccrual.findUniqueOrThrow({
          where: { id: obligation.accrual_id },
        });
        outcomeId = accrual.lesson_actual_outcome_id;
      }
      const outcome = await ctx.tx.lessonActualOutcome.findUnique({ where: { id: outcomeId } });
      if (!outcome) return fail(domainError('NOT_FOUND', 404));
      const lesson = await ctx.tx.lessonOccurrence.findUniqueOrThrow({
          where: { id: outcome.lesson_occurrence_id },
        }),
        en = await ctx.tx.studentSubjectEnrollment.findUniqueOrThrow({
          where: { id: lesson.enrollment_id },
        });
      await this.access.student(ctx, en.student_id);
      return;
    }
    if (name === 'teacherPayroll') {
      const teacher = await ctx.tx.teacherAccount.findUnique({
        where: { id: uuid(req.params.id) },
      });
      if (
        !teacher ||
        (!ctx.actor.roles.includes('DIRECTOR') &&
          (!ctx.actor.roles.includes('TEACHER') || teacher.account_id !== ctx.actor.accountId))
      )
        return fail(domainError('FORBIDDEN', 403));
    }
  }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<HttpRequest>(),
      name = context.getHandler().name;
    if (!req.account) return fail(domainError('UNAUTHENTICATED', 401));
    req.resourceAuthorizer = async (tx, actor) => {
      try {
        await this.check(
          name,
          {
            tx,
            actor,
            operationId: req.idempotencyKey ?? req.requestId!,
            requestId: req.requestId!,
          },
          req,
        );
        return ok(undefined);
      } catch (error: unknown) {
        if (error instanceof AppException) return err(error.domain);
        return Promise.reject(error);
      }
    };
    const result = await this.db.client.$transaction((tx) =>
      req.resourceAuthorizer!(tx, req.account!),
    );
    if (result.ok) return true;
    unwrap(
      await this.audit.denial({
        requestId: req.requestId!,
        actor: req.account,
        action: 'finance.access.denied',
        code: result.error.code,
      }),
    );
    return fail(result.error);
  }
}

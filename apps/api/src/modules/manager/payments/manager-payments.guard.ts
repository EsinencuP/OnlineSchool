import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Prisma } from '@online-school/db';
import { DatabaseService } from '../../../core/database/database.module.js';
import { domainError, unwrap } from '../../../core/errors/domain-error.js';
import { UUID } from '../../../core/http.js';
import { subscriptionFailure } from '../../finance/manager-subscriptions/finance-facade.js';
import { ManagerScopeService } from '../scope/manager-scope.service.js';
import type { ManagerRequest } from '../context/manager-context.js';
@Injectable()
export class ManagerPaymentsGuard implements CanActivate {
  constructor(
    private readonly db: DatabaseService,
    private readonly scope: ManagerScopeService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ManagerRequest>(),
      byPayment = req.params.paymentId !== undefined;
    const targets = async (tx?: Prisma.TransactionClient): Promise<string[]> => {
      const client = tx ?? this.db.client;
      let student = req.params.studentId ?? '';
      if (byPayment) {
        if (!UUID.test(req.params.paymentId ?? ''))
          return unwrap({ ok: false, error: domainError('PAYMENT_NOT_FOUND', 404) });
        const p = await client.paymentReceipt.findUnique({
          where: { id: req.params.paymentId! },
          select: { student_id: true },
        });
        if (!p?.student_id)
          return unwrap({ ok: false, error: domainError('PAYMENT_NOT_FOUND', 404) });
        student = p.student_id;
      }
      const result = [student];
      const path = req.originalUrl.split('?')[0]?.toLowerCase().replace(/\/+$/, '') ?? '';
      if (
        req.method === 'POST' &&
        (path.endsWith('/prepare-subscription') || path.endsWith('/distributions'))
      ) {
        const body = req.body as Record<string, unknown> | undefined;
        if (path.endsWith('/prepare-subscription')) {
          if (typeof body?.enrollmentId !== 'string' || !UUID.test(body.enrollmentId))
            return unwrap({ ok: false, error: domainError('INVALID_INPUT', 422) });
          const row = await client.studentSubjectEnrollment.findUnique({
            where: { id: body.enrollmentId },
            select: { student_id: true },
          });
          if (!row) return unwrap({ ok: false, error: domainError('STUDENT_NOT_FOUND', 404) });
          result.push(row.student_id);
        } else {
          if (typeof body?.subscriptionId !== 'string' || !UUID.test(body.subscriptionId))
            return unwrap({ ok: false, error: domainError('INVALID_INPUT', 422) });
          const row = await client.subscription.findUnique({
            where: { id: body.subscriptionId },
            select: { enrollment_ref: { select: { student_id: true } } },
          });
          if (!row) return unwrap({ ok: false, error: domainError('SUBSCRIPTION_NOT_FOUND', 404) });
          result.push(row.enrollment_ref.student_id);
        }
      }
      return result;
    };
    try {
      for (const student of await targets()) {
        const s = await this.scope.assertStudentInPortfolio(req.managerCtx!, student);
        if (!s.ok)
          unwrap({
            ok: false,
            error:
              byPayment && s.error.code === 'STUDENT_NOT_FOUND'
                ? domainError('PAYMENT_NOT_FOUND', 404)
                : s.error,
          });
      }
      req.resourceAuthorizer = async (tx, actor) => {
        const ctx = await this.scope.resolveContext({ ...actor, requestId: req.requestId! }, tx);
        if (!ctx.ok) return ctx;
        req.managerCtx = ctx.value;
        for (const student of await targets(tx)) {
          const s = await this.scope.assertStudentInPortfolio(ctx.value, student, tx);
          if (!s.ok)
            return {
              ok: false,
              error:
                byPayment && s.error.code === 'STUDENT_NOT_FOUND'
                  ? domainError('PAYMENT_NOT_FOUND', 404)
                  : s.error,
            };
        }
        return { ok: true, value: undefined };
      };
      return true;
    } catch (error: unknown) {
      return unwrap({ ok: false, error: subscriptionFailure(error) });
    }
  }
}

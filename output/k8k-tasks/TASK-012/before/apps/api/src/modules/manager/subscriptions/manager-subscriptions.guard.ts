import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { DatabaseService } from '../../../core/database/database.module.js';
import { domainError, unwrap } from '../../../core/errors/domain-error.js';
import { subscriptionFailure } from '../../finance/manager-subscriptions/finance-facade.js';
import type { Prisma } from '@online-school/db';
import { UUID } from '../../../core/http.js';
import { ManagerScopeService } from '../scope/manager-scope.service.js';
import type { ManagerRequest } from '../context/manager-context.js';
@Injectable()
export class ManagerSubscriptionsGuard implements CanActivate {
  constructor(
    private readonly db: DatabaseService,
    private readonly scope: ManagerScopeService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ManagerRequest>();
    const bySubscription = req.params.id !== undefined;
    const target = async (tx?: Prisma.TransactionClient): Promise<string> => {
      if (!bySubscription) return req.params.studentId ?? '';
      if (!UUID.test(req.params.id ?? ''))
        return unwrap({ ok: false, error: domainError('SUBSCRIPTION_NOT_FOUND', 404) });
      const row = await (tx ?? this.db.client).managerSubscription.findUnique({
        where: { id: req.params.id! },
        select: { enrollment_ref: { select: { student_id: true } } },
      });
      return (
        row?.enrollment_ref.student_id ??
        unwrap({ ok: false, error: domainError('SUBSCRIPTION_NOT_FOUND', 404) })
      );
    };
    try {
      const allowed = await this.scope.assertStudentInPortfolio(req.managerCtx!, await target());
      if (!allowed.ok)
        unwrap({
          ok: false,
          error:
            bySubscription && allowed.error.code === 'STUDENT_NOT_FOUND'
              ? domainError('SUBSCRIPTION_NOT_FOUND', 404)
              : allowed.error,
        });
      req.resourceAuthorizer = async (tx, actor) => {
        const ctx = await this.scope.resolveContext({ ...actor, requestId: req.requestId! }, tx);
        if (!ctx.ok) return ctx;
        req.managerCtx = ctx.value;
        const scoped = await this.scope.assertStudentInPortfolio(ctx.value, await target(tx), tx);
        return !scoped.ok && bySubscription && scoped.error.code === 'STUDENT_NOT_FOUND'
          ? { ok: false, error: domainError('SUBSCRIPTION_NOT_FOUND', 404) }
          : scoped;
      };
      return true;
    } catch (error: unknown) {
      // Keep expected domain denials at the single core exception boundary.
      return unwrap({ ok: false, error: subscriptionFailure(error) });
    }
  }
}

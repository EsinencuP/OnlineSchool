import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { unwrap } from '../../../core/errors/domain-error.js';
import { ManagerScopeService } from '../scope/manager-scope.service.js';
import { AuthRateLimitService } from '../../identity/auth-rate-limit.service.js';
import type { ManagerRequest } from '../context/manager-context.js';
@Injectable()
export class ManagerAccountsGuard implements CanActivate {
  constructor(
    private readonly scope: ManagerScopeService,
    private readonly rate: AuthRateLimitService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ManagerRequest>(),
      studentId = req.params.studentId ?? '';
    unwrap(await this.scope.assertStudentInPortfolio(req.managerCtx!, studentId));
    const action = req.originalUrl
      .split('?')[0]
      ?.toLowerCase()
      .replace(/\/+$/, '')
      .endsWith('/reset-password')
      ? 'reset'
      : 'create';
    await this.rate.limit(req, `manager.account.${action}.manager`, req.managerCtx!.accountId);
    await this.rate.limit(req, `manager.account.${action}.student`, studentId);
    req.resourceAuthorizer = async (tx, actor) => {
      const ctx = await this.scope.resolveContext({ ...actor, requestId: req.requestId! }, tx);
      if (!ctx.ok) return ctx;
      req.managerCtx = ctx.value;
      return this.scope.assertStudentInPortfolio(ctx.value, studentId, tx);
    };
    return true;
  }
}

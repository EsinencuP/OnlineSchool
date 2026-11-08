import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { AuditService } from '../../../core/audit/audit.service.js';
import { domainError, fail, unwrap } from '../../../core/errors/domain-error.js';
import type { ManagerRequest } from '../context/manager-context.js';
import { ManagerScopeService } from '../scope/manager-scope.service.js';

@Injectable()
export class ManagerContextGuard implements CanActivate {
  constructor(
    private readonly scope: ManagerScopeService,
    private readonly audit: AuditService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ManagerRequest>();
    delete req.managerCtx;
    if (!req.account) return fail(domainError('UNAUTHENTICATED', 401));
    const result = await this.scope.resolveContext({ ...req.account, requestId: req.requestId! });
    if (!result.ok) {
      unwrap(
        await this.audit.denial({
          requestId: req.requestId!,
          actor: req.account,
          action: 'manager.context.denied',
          code: result.error.code,
        }),
      );
      return fail(result.error);
    }
    req.managerCtx = result.value;
    return true;
  }
}

import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { DatabaseService } from '../../../core/database/database.module.js';
import { domainError, unwrap } from '../../../core/errors/domain-error.js';
import { UUID } from '../../../core/http.js';
import { ok } from '@online-school/shared';
import { ManagerScopeService } from '../scope/manager-scope.service.js';
import type { ManagerRequest } from '../context/manager-context.js';
@Injectable()
export class ManagerNotificationsGuard implements CanActivate {
  constructor(
    private readonly db: DatabaseService,
    private readonly scope: ManagerScopeService,
  ) {}
  async canActivate(c: ExecutionContext): Promise<boolean> {
    const r = c.switchToHttp().getRequest<ManagerRequest>(),
      id = r.params.studentId;
    if (!id || !UUID.test(id))
      return unwrap({ ok: false, error: domainError('STUDENT_NOT_FOUND', 404) });
    r.resourceAuthorizer = async (tx, actor) => {
      const ctx = await this.scope.resolveContext({ ...actor, requestId: r.requestId! }, tx);
      if (!ctx.ok) return ctx;
      r.managerCtx = ctx.value;
      const s = await this.scope.assertStudentInPortfolio(ctx.value, id, tx);
      return s.ok ? ok(undefined) : s;
    };
    unwrap(await r.resourceAuthorizer(this.db.client, r.account!));
    return true;
  }
}

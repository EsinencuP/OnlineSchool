import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { ok } from '@online-school/shared';
import { DatabaseService } from '../../../core/database/database.module.js';
import { domainError, unwrap } from '../../../core/errors/domain-error.js';
import { UUID } from '../../../core/http.js';
import type { ManagerRequest } from '../context/manager-context.js';
import { ManagerScopeService } from '../scope/manager-scope.service.js';
import { ManagerTasksService } from './manager-tasks.service.js';
@Injectable()
export class ManagerTasksGuard implements CanActivate {
  constructor(
    private readonly db: DatabaseService,
    private readonly scope: ManagerScopeService,
    private readonly tasks: ManagerTasksService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ManagerRequest>(),
      id = req.params.taskId;
    if (id && !UUID.test(id))
      return unwrap({ ok: false, error: domainError('TASK_NOT_FOUND', 404) });
    req.resourceAuthorizer = async (tx, actor) => {
      const ctx = await this.scope.resolveContext({ ...actor, requestId: req.requestId! }, tx);
      if (!ctx.ok) return ctx;
      req.managerCtx = ctx.value;
      if (!id) return ok(undefined);
      const row = await this.tasks.find(ctx.value, id, tx);
      return row.ok ? ok(undefined) : row;
    };
    unwrap(await req.resourceAuthorizer(this.db.client, req.account!));
    return true;
  }
}

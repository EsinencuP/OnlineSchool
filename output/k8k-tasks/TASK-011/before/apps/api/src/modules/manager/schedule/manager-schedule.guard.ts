import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { ok } from '@online-school/shared';
import { DatabaseService } from '../../../core/database/database.module.js';
import { domainError, unwrap } from '../../../core/errors/domain-error.js';
import { UUID } from '../../../core/http.js';
import type { ManagerRequest } from '../context/manager-context.js';
import { ManagerScheduleService } from './manager-schedule.service.js';
import { ManagerScopeService } from '../scope/manager-scope.service.js';
@Injectable()
export class ManagerScheduleGuard implements CanActivate {
  constructor(
    private readonly db: DatabaseService,
    private readonly schedule: ManagerScheduleService,
    private readonly scope: ManagerScopeService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ManagerRequest>(),
      id = req.params.lessonId,
      student = req.params.studentId;
    if (id && !UUID.test(id))
      return unwrap({ ok: false, error: domainError('LESSON_NOT_FOUND', 404) });
    req.resourceAuthorizer = async (tx, actor) => {
      const ctx = await this.scope.resolveContext({ ...actor, requestId: req.requestId! }, tx);
      if (!ctx.ok) return ctx;
      req.managerCtx = ctx.value;
      if (id) {
        const found = await this.schedule.target(ctx.value, id, tx);
        return found.ok ? ok(undefined) : found;
      }
      return student ? this.scope.assertStudentInPortfolio(ctx.value, student, tx) : ok(undefined);
    };
    unwrap(await req.resourceAuthorizer(this.db.client, req.account!));
    if (req.method !== 'GET')
      req.afterCriticalCommit = async (body) => {
        const view = body as { lessonId: string };
        // Meet capability URLs are projected after commit and never saved in command results.
        const current = unwrap(await this.schedule.get(req.managerCtx!, view.lessonId));
        return { ...view, meetLink: current.meetLink };
      };
    return true;
  }
}

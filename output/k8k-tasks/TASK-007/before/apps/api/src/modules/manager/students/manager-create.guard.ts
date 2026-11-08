import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { err, ok } from '@online-school/shared';
import { domainError } from '../../../core/errors/domain-error.js';
import type { ManagerRequest } from '../context/manager-context.js';
import { ManagerScopeService } from '../scope/manager-scope.service.js';

@Injectable()
export class ManagerCreateReplayGuard implements CanActivate {
  constructor(private readonly scope: ManagerScopeService) {}
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<ManagerRequest>();
    req.resourceAuthorizer = async (tx, actor) => {
      const ctx = await this.scope.resolveContext({ ...actor, requestId: req.requestId! }, tx);
      if (!ctx.ok) return ctx;
      try {
        const cached = await tx.idempotencyRecord.findUnique({
          where: {
            scope_command_type_key: {
              scope: actor.accountId,
              command_type: 'manager.student.create',
              key: req.idempotencyKey!,
            },
          },
        });
        if (cached && cached.expires_at > new Date() && cached.status === 'COMPLETED') {
          const result = cached.result as { body?: { studentId?: unknown } } | null;
          if (typeof result?.body?.studentId !== 'string')
            return err(domainError('CACHED_RESULT_INVALID', 503));
          return this.scope.assertStudentInPortfolio(ctx.value, result.body.studentId, tx);
        }
        return ok(undefined);
      } catch {
        return err(domainError('DATABASE_ERROR', 503));
      }
    };
    return true;
  }
}

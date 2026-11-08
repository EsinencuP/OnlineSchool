import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { ok, err } from '@online-school/shared';
import { DatabaseService } from '../../../core/database/database.module.js';
import { domainError, unwrap } from '../../../core/errors/domain-error.js';
import { databaseError } from '../../../core/errors/database-error.js';
import { UUID } from '../../../core/http.js';
import type { ManagerRequest } from '../context/manager-context.js';
import { ManagerScopeService } from '../scope/manager-scope.service.js';
import { ManagerLeadsService } from './manager-leads.service.js';
@Injectable()
export class ManagerLeadsGuard implements CanActivate {
  constructor(
    private readonly db: DatabaseService,
    private readonly scope: ManagerScopeService,
    private readonly leads: ManagerLeadsService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ManagerRequest>(),
      id = req.params.leadId;
    if (id && !UUID.test(id)) return unwrap(err(domainError('LEAD_NOT_FOUND', 404)));
    req.resourceAuthorizer = async (tx, actor) => {
      const current = await this.scope.resolveContext({ ...actor, requestId: req.requestId! }, tx);
      if (!current.ok) return current;
      req.managerCtx = current.value;
      if (id) return this.scope.assertLeadInPortfolio(current.value, id, tx);
      if (req.method === 'POST' && req.idempotencyKey) {
        try {
          const cached = await tx.idempotencyRecord.findUnique({
            where: {
              scope_command_type_key: {
                scope: actor.accountId,
                command_type: 'manager.lead.create',
                key: req.idempotencyKey,
              },
            },
          });
          if (cached?.status === 'COMPLETED' && cached.expires_at > new Date()) {
            const body = cached.result as { body?: { leadId?: unknown } } | null;
            return typeof body?.body?.leadId === 'string'
              ? this.scope.assertLeadInPortfolio(current.value, body.body.leadId, tx)
              : err(domainError('CACHED_RESULT_INVALID', 503));
          }
        } catch (e: unknown) {
          return err(databaseError(e));
        }
      }
      return ok(undefined);
    };
    unwrap(await req.resourceAuthorizer(this.db.client, req.account!));
    if (req.method !== 'GET')
      req.afterCriticalCommit = async (body) => {
        const view = body as { leadId: string };
        return unwrap(await this.leads.get(req.managerCtx!, view.leadId));
      };
    return true;
  }
}

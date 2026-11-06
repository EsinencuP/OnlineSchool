import { Injectable } from '@nestjs/common';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { DatabaseService } from '../../../core/database/database.module.js';
import { AppException, domainError } from '../../../core/errors/domain-error.js';
import type { DomainError } from '../../../core/errors/domain-error.js';
import { PolicyService } from '../../../core/policy/policy.service.js';
import type { AccountContext } from '../../../core/http.js';
import type { ManagerCapability, ManagerContext } from '../context/manager-context.js';
import type { ManagerMeResponseDto } from '../dto/manager-me.response.dto.js';
import { ManagerScopeService } from '../scope/manager-scope.service.js';
import { StaffActorContextService } from '../../../core/actor/actor-context.service.js';

@Injectable()
export class ManagerMeService {
  constructor(
    private readonly db: DatabaseService,
    private readonly scope: ManagerScopeService,
    private readonly policy: PolicyService,
    private readonly actors: StaffActorContextService,
  ) {}

  async get(
    ctx: ManagerContext,
    actor: AccountContext,
  ): Promise<Result<ManagerMeResponseDto, DomainError>> {
    try {
      const profile = await this.db.client.staffAccount.findFirst({
        where: { id: ctx.managerId, account_id: ctx.accountId },
        select: { full_name: true, deactivated_at: true },
      });
      if (!profile) return err(domainError('MANAGER_PROFILE_NOT_FOUND', 403));
      if (profile.deactivated_at) return err(domainError('MANAGER_INACTIVE', 403));
      const timezone = process.env.SCHOOL_TIMEZONE ?? 'Europe/Chisinau';
      // Validate configuration once at this data boundary; never use the host timezone.
      try {
        new Intl.DateTimeFormat('en', { timeZone: timezone });
      } catch {
        return err(domainError('MANAGER_CONFIGURATION_INVALID', 503));
      }
      const permissions: ReadonlyArray<readonly [ManagerCapability, string]> = [
        ['LEADS_MANAGE', 'student:create'],
        ['STUDENTS_VIEW', 'student:read'],
        ['ACCOUNTS_CREATE', 'student:create'],
        ['SUBSCRIPTIONS_MANAGE', 'subscription:create'],
        ['SCHEDULE_MANAGE', 'schedule:manage'],
      ];
      return ok({
        actorContext: await this.actors.get(actor),
        managerId: ctx.managerId,
        displayName: profile.full_name,
        role: 'MANAGER',
        portfolioSize: await this.db.client.student.count({
          where: this.scope.portfolioWhere(ctx),
        }),
        timezone,
        capabilities: permissions
          .filter(([, permission]) => this.policy.hasPermission(actor, permission))
          .map(([capability]) => capability)
          .concat(
            this.policy.canRequestPaymentApproval(actor) ? ['PAYMENTS_REQUEST_APPROVAL'] : [],
          ),
      });
    } catch (error: unknown) {
      return err(error instanceof AppException ? error.domain : domainError('DATABASE_ERROR', 503));
    }
  }
}

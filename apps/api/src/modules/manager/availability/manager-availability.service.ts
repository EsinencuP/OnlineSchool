import { Injectable } from '@nestjs/common';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { databaseError } from '../../../core/errors/database-error.js';
import { domainError } from '../../../core/errors/domain-error.js';
import type { DomainError } from '../../../core/errors/domain-error.js';
import type { CriticalContext } from '../../../core/http.js';
import { TransactionService } from '../../../core/transaction/transaction.service.js';
import { at } from '../../finance/finance-common.js';
import type { ManagerContext } from '../context/manager-context.js';
import { ManagerScopeService } from '../scope/manager-scope.service.js';
import type {
  ManagerAvailabilityDto,
  ManagerAvailabilityStatus,
} from './manager-availability.dto.js';

@Injectable()
export class ManagerAvailabilityService {
  constructor(
    private readonly transactions: TransactionService,
    private readonly scope: ManagerScopeService,
  ) {}

  get(ctx: ManagerContext): Promise<Result<ManagerAvailabilityDto, DomainError>> {
    return this.transactions.runReadOnly(async (tx) => {
      const row = await tx.managerAvailability.findUnique({ where: { manager_id: ctx.managerId } });
      return ok({
        status: (row?.status as ManagerAvailabilityStatus | undefined) ?? 'AVAILABLE',
        changedAt: row?.changed_at.toISOString() ?? null,
      });
    });
  }

  async set(
    ctx: ManagerContext,
    status: ManagerAvailabilityStatus,
    c: CriticalContext,
  ): Promise<Result<ManagerAvailabilityDto, DomainError>> {
    const current = await this.scope.resolveContext({ ...c.actor, requestId: c.requestId }, c.tx);
    if (!current.ok) return current;
    if (current.value.managerId !== ctx.managerId) return err(domainError('FORBIDDEN_ROLE', 403));
    try {
      const changedAt = await at(c.tx);
      const row = await c.tx.managerAvailability.upsert({
        where: { manager_id: ctx.managerId },
        create: { manager_id: ctx.managerId, status, changed_at: changedAt },
        update: { status, changed_at: changedAt },
      });
      return ok({ status, changedAt: row.changed_at.toISOString() });
    } catch (error: unknown) {
      return err(databaseError(error));
    }
  }
}

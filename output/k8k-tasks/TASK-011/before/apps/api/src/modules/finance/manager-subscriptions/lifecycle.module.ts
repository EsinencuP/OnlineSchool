import { Injectable, Module } from '@nestjs/common';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { AuditModule } from '../../../core/audit/audit.service.js';
import {
  TransactionModule,
  TransactionService,
} from '../../../core/transaction/transaction.service.js';
import { DatabaseService } from '../../../core/database/database.module.js';
import type { DomainError } from '../../../core/errors/domain-error.js';
import { domainError } from '../../../core/errors/domain-error.js';
import { FinanceInfrastructureModule } from '../finance-infrastructure.module.js';
import { at } from '../finance-common.js';
import { ManagerAllocationFinance } from './finance-facade.js';
import { ScheduleInfrastructureModule } from '../../schedule/schedule-infrastructure.module.js';
import { ScheduleFreezeCancellation } from '../../schedule/manager/freeze-cancellation.service.js';
import { ManagerSubscriptionLifecycle } from './lifecycle.service.js';
import { LessonCancellationPort } from './contracts.js';
export { ManagerSubscriptionLifecycle } from './lifecycle.service.js';
export { LessonCancellationPort } from './contracts.js';
@Injectable()
export class ManagerSubscriptionExpiry {
  constructor(
    private readonly transactions: TransactionService,
    private readonly lifecycle: ManagerSubscriptionLifecycle,
    private readonly db: DatabaseService,
  ) {}
  async processDue(limit = 10): Promise<Result<number, DomainError>> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      return err(domainError('INVALID_BATCH_SIZE', 400));
    let count = 0;
    for (let i = 0; i < limit; i++) {
      const outcome = await this.transactions.runResult(async (tx) => {
        const now = await at(tx);
        const rows = await tx.$queryRaw<{ id: string }[]>`
          SELECT s.id FROM manager_subscriptions s WHERE (s.status='ACTIVE' AND s.ends_at<=${now})
            OR (s.status='FROZEN' AND EXISTS(SELECT 1 FROM subscription_freezes f WHERE f.subscription_id=s.id AND f.actual_ends_on IS NULL AND f.ends_at<=${now}))
          ORDER BY s.ends_at,s.id FOR UPDATE OF s SKIP LOCKED LIMIT 1`;
        if (!rows[0]) return ok(false);
        return this.lifecycle.processDue(tx, rows[0].id, now);
      });
      if (!outcome.ok) return outcome;
      if (!outcome.value) break;
      count++;
    }
    return ok(count);
  }
  async enabled(): Promise<Result<number, DomainError>> {
    try {
      if (!process.env.DATABASE_URL) return ok(0);
      const [available] = await this.db.client.$queryRaw<
        { ready: boolean }[]
      >`SELECT to_regclass('public.manager_subscriptions') IS NOT NULL AS ready`;
      return available?.ready ? this.processDue() : ok(0);
    } catch {
      return err(domainError('DATABASE_ERROR', 503));
    }
  }
}
@Module({
  imports: [
    FinanceInfrastructureModule,
    AuditModule,
    TransactionModule,
    ScheduleInfrastructureModule,
  ],
  providers: [
    ManagerAllocationFinance,
    ManagerSubscriptionLifecycle,
    ManagerSubscriptionExpiry,
    { provide: LessonCancellationPort, useExisting: ScheduleFreezeCancellation },
  ],
  exports: [ManagerSubscriptionLifecycle, ManagerSubscriptionExpiry],
})
export class ManagerSubscriptionLifecycleModule {}

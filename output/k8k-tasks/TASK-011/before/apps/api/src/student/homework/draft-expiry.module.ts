import { Injectable, Module } from '@nestjs/common';
import { ok } from '@online-school/shared';
import { DatabaseModule } from '../../core/database/database.module.js';
import {
  TransactionModule,
  TransactionService,
} from '../../core/transaction/transaction.service.js';

@Injectable()
export class HomeworkDraftExpiry {
  private nextPoll = 0;
  constructor(private readonly transactions: TransactionService) {}
  async enabled() {
    if (!process.env.DATABASE_URL || Date.now() < this.nextPoll) return ok(0);
    this.nextPoll = Date.now() + 60000;
    return this.transactions.runCritical(async (tx) => {
      // No DELETE privilege, and no draft text in audit/log/outbox. Restarts retry the durable expiry predicate.
      const changed = await tx.$queryRaw<{ delivery_id: string }[]>`
        WITH expired AS (SELECT delivery_id FROM homework_drafts WHERE expires_at<=clock_timestamp() AND content<>''
          ORDER BY expires_at,delivery_id FOR UPDATE SKIP LOCKED LIMIT 100)
        UPDATE homework_drafts d SET content='',updated_at=clock_timestamp() FROM expired e
        WHERE d.delivery_id=e.delivery_id RETURNING d.delivery_id`;
      return changed.length;
    });
  }
}
@Module({
  imports: [DatabaseModule, TransactionModule],
  providers: [HomeworkDraftExpiry],
  exports: [HomeworkDraftExpiry],
})
export class HomeworkDraftExpiryModule {}

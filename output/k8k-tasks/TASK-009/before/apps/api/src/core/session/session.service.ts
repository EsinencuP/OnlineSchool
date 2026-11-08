import { randomUUID } from 'node:crypto';
import { Injectable, Module } from '@nestjs/common';
import { err } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { AuditModule, AuditService } from '../audit/audit.service.js';
import { TransactionModule, TransactionService } from '../transaction/transaction.service.js';
import { domainError, fail } from '../errors/domain-error.js';
import type { DomainError } from '../errors/domain-error.js';
import type { AccountContext } from '../http.js';
import { SessionStore } from './session.store.js';

@Injectable()
export class SessionService {
  constructor(
    private readonly transaction: TransactionService,
    private readonly audit: AuditService,
  ) {}
  async revoke(
    actor: AccountContext,
    requestId: string,
    reason = 'USER_LOGOUT',
  ): Promise<Result<void, DomainError>> {
    if (!reason.trim() || reason.length > 500) return err(domainError('INVALID_INPUT', 400));
    return this.transaction.runCritical(async (tx) => {
      const session = await tx.session.findUnique({ where: { id: actor.sessionId } });
      if (!session || session.account_id !== actor.accountId)
        return fail(domainError('UNAUTHENTICATED', 401));
      if (session.revoked_at) return;
      const now = (await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`)[0]!.now;
      const operationId = randomUUID();
      await tx.session.update({ where: { id: session.id }, data: { revoked_at: now } });
      await tx.accessRevocation.create({
        data: {
          account_id: actor.accountId,
          session_id: session.id,
          revoked_by_account_id: actor.accountId,
          source: 'USER_LOGOUT',
          reason,
          revoked_at: now,
        },
      });
      await this.audit.record(
        {
          actor_kind: 'ACCOUNT',
          actor_id: actor.accountId,
          action: 'session.revoke',
          resource_type: 'Session',
          resource_id: session.id,
          result: 'SUCCESS',
          request_id: requestId,
          source_operation_id: operationId,
          event_key: `session.revoke:${session.id}`,
        },
        tx,
      );
    });
  }
}
@Module({
  imports: [AuditModule, TransactionModule],
  providers: [SessionStore, SessionService],
  exports: [SessionStore, SessionService],
})
export class SessionModule {}

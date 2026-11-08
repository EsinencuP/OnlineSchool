import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { AuthAccount, Prisma } from '@online-school/db';
import { AuditService } from '../../core/audit/audit.service.js';
import { TransactionService } from '../../core/transaction/transaction.service.js';
import { AppException, domainError, fail, unwrap } from '../../core/errors/domain-error.js';
import type { DomainError } from '../../core/errors/domain-error.js';
import type { AccountContext } from '../../core/http.js';
import { header, UUID } from '../../core/http.js';
import { IdentityService, now } from '../../modules/identity/identity.service.js';
import { AuthRateLimitService } from '../../modules/identity/auth-rate-limit.service.js';
import type { IssuedSession } from '../../core/session/session.store.js';
import { MeService } from '../me/me.service.js';
import type { StudentRequest, IStudentContext } from '../student-context.interface.js';
export type SecurityOutcome<T> = {
  resourceId: string;
  body?: T;
  issued?: IssuedSession;
  error?: DomainError;
};
@Injectable()
export class StudentSecurityCommands {
  constructor(
    private readonly identity: IdentityService,
    private readonly me: MeService,
    private readonly transactions: TransactionService,
    private readonly rate: AuthRateLimitService,
    private readonly audit: AuditService,
  ) {}
  async run<T>(
    req: StudentRequest,
    student: IStudentContext,
    action: string,
    fn: (
      tx: Prisma.TransactionClient,
      account: AuthAccount,
      actor: AccountContext,
      time: Date,
    ) => Promise<SecurityOutcome<T>>,
  ): Promise<SecurityOutcome<T>> {
    // Secret-bearing commands deliberately have no body hash or durable response cache.
    try {
      await this.rate.limit(req, action, student.userId);
    } catch (error) {
      const denied =
        error instanceof AppException ? error.domain : domainError('AUTH_SERVICE_UNAVAILABLE', 503);
      unwrap(
        await this.audit.denial({
          requestId: req.requestId!,
          actor: req.account!,
          action: action + '.denied',
          code: denied.code,
        }),
      );
      return fail(denied);
    }
    const key = header(req, 'idempotency-key');
    if (key && !UUID.test(key)) return fail(domainError('IDEMPOTENCY_KEY_INVALID', 400));
    const operationId = key?.toLowerCase() ?? randomUUID();
    const result = await this.transactions.runCritical(async (tx) => {
      const actor = await this.identity.actor(req, tx),
        account = await this.identity.account(tx, actor.accountId);
      if (
        actor.kind !== 'STUDENT' ||
        !actor.roles.includes('STUDENT') ||
        actor.accountId !== student.userId
      )
        return fail(domainError('FORBIDDEN', 403));
      const current = unwrap(await this.me.load(actor.accountId, tx)).context;
      if (current.studentProfileId !== student.studentProfileId)
        return fail(domainError('FORBIDDEN', 403));
      if (current.mustChangePassword) return fail(domainError('MUST_CHANGE_PASSWORD', 403));
      if (!current.hasActiveAccess)
        return fail({
          ...domainError('ACCESS_SUSPENDED', 402),
          details: { managerContacts: current.managerContacts ?? { whatsapp: '', telegram: '' } },
        });
      const time = await now(tx),
        outcome = await fn(tx, account, actor, time),
        id = randomUUID();
      await this.audit.record(
        {
          id,
          actor_kind: 'ACCOUNT',
          actor_id: actor.accountId,
          action,
          resource_type: 'StudentSecurity',
          resource_id: outcome.resourceId,
          result: outcome.error ? 'DENIED' : 'SUCCESS',
          request_id: req.requestId!,
          source_operation_id: operationId,
          event_key: `student-security:${id}`,
          ...(outcome.error ? { metadata: { code: outcome.error.code } } : {}),
        },
        tx,
      );
      if (!outcome.error)
        await tx.outboxEvent.create({
          data: {
            topic: action + '.v1',
            aggregate_type: 'StudentSecurity',
            aggregate_id: outcome.resourceId,
            source_operation_id: operationId,
            audit_event_id: id,
            event_key: `student-security:${id}`,
            payload: { schemaVersion: 1, resourceId: outcome.resourceId },
          },
        });
      // A failed OTP attempt commits its counter and DENIED audit before returning
      // its HTTP error. Throwing inside the transaction would undo the counter.
      return outcome;
    });
    if (!result.ok) {
      unwrap(
        await this.audit.denial({
          requestId: req.requestId!,
          actor: req.account!,
          action: action + '.denied',
          code: result.error.code,
        }),
      );
      return fail(result.error);
    }
    if (result.value.error) return fail(result.value.error);
    return result.value;
  }
}

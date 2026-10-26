import { randomUUID } from 'node:crypto';
import { Injectable, Module } from '@nestjs/common';
import type { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import type { DomainError } from '../errors/domain-error.js';
import { domainError } from '../errors/domain-error.js';
import type { AccountContext } from '../http.js';
import { DatabaseService } from '../database/database.module.js';

export type AuditEventInput = Prisma.AuditEventUncheckedCreateInput;
@Injectable()
export class AuditService {
  constructor(private readonly db: DatabaseService) {}
  async record(event: AuditEventInput, tx: Prisma.TransactionClient): Promise<void> {
    await tx.auditEvent.create({ data: event });
  }
  async denial(input: {
    requestId: string;
    action: string;
    code: string;
    actor?: AccountContext;
    resourceId?: string;
  }): Promise<Result<void, DomainError>> {
    try {
      await this.db.client.$transaction((tx) =>
        this.record(
          {
            actor_kind: input.actor ? 'ACCOUNT' : 'ANONYMOUS',
            actor_id: input.actor?.accountId ?? null,
            action: input.action,
            resource_type: 'SecurityBoundary',
            resource_id: input.resourceId ?? null,
            result: 'DENIED',
            request_id: input.requestId,
            event_key: `security:${randomUUID()}`,
            metadata: { code: input.code },
          },
          tx,
        ),
      );
      return ok(undefined);
    } catch {
      return err(domainError('AUDIT_UNAVAILABLE', 503));
    }
  }
}
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}

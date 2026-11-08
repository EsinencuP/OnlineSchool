import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { CriticalContext } from '../../core/http.js';
import { AuditService } from '../../core/audit/audit.service.js';

@Injectable()
export class FinanceEvents {
  constructor(private readonly audit: AuditService) {}
  async record(
    ctx: CriticalContext,
    action: string,
    resourceType: string,
    id: string,
    payload: Record<string, string | number> = {},
  ) {
    const auditId = randomUUID();
    await this.audit.record(
      {
        id: auditId,
        actor_kind: 'ACCOUNT',
        actor_id: ctx.actor.accountId,
        action,
        resource_type: resourceType,
        resource_id: id,
        result: 'SUCCESS',
        request_id: ctx.requestId,
        source_operation_id: ctx.operationId,
        event_key: `${action}:${id}:${ctx.operationId}`,
      },
      ctx.tx,
    );
    return ctx.tx.outboxEvent.create({
      data: {
        topic: `${action}.v1`,
        aggregate_type: resourceType,
        aggregate_id: id,
        source_operation_id: ctx.operationId,
        audit_event_id: auditId,
        event_key: `${action}:${id}:${ctx.operationId}`,
        payload: { schemaVersion: 1, resourceId: id, ...payload },
      },
    });
  }
}

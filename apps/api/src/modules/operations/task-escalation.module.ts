import { Injectable, Module } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { AuditModule, AuditService } from '../../core/audit/audit.service.js';
import { DatabaseModule, DatabaseService } from '../../core/database/database.module.js';
import { domainError } from '../../core/errors/domain-error.js';
import type { DomainError } from '../../core/errors/domain-error.js';
import {
  TransactionModule,
  TransactionService,
} from '../../core/transaction/transaction.service.js';
import { at } from '../finance/finance-common.js';
import { urgentTaskPolicy } from './escalation-policy.js';
import type { UrgentTaskPolicy } from './escalation-policy.js';

type Candidate = {
  id: string;
  type: string;
  created_at: Date;
  manager_id: string | null;
  manager_status: 'AVAILABLE' | 'UNAVAILABLE' | 'OFF_SHIFT' | 'UNASSIGNED';
};
const BATCH = 50;

/**
 * OPS-01/B: an urgent task unclaimed by an available manager for the acceptance window, or whose manager
 * is unavailable / off shift / missing, is escalated to the director. The task stays open and the client
 * assignment is untouched. One escalation per task (unique task_id), so timer reruns never duplicate it.
 */
@Injectable()
export class ManagerTaskEscalation {
  constructor(
    private readonly transactions: TransactionService,
    private readonly audit: AuditService,
    private readonly db: DatabaseService,
  ) {}

  private async sweep(
    tx: Prisma.TransactionClient,
    policy: UrgentTaskPolicy,
  ): Promise<Result<number, DomainError>> {
    const now = await at(tx);
    const since = new Date(+now - policy.lookbackHours * 3_600_000);
    // The row lock makes the timer and a manager's claim mutually exclusive on the same task.
    const rows = await tx.$queryRaw<Candidate[]>`
      WITH cand AS (
        SELECT t.id, t.type::text AS type, t.created_at,
          COALESCE(t.assigned_manager_id, (
            SELECT am.manager_id FROM assigned_managers am
            WHERE (am.student_id=t.student_id OR am.lead_id=t.lead_id)
              AND am.assigned_at<=${now} AND (am.ended_at IS NULL OR am.ended_at>${now})
            ORDER BY am.assigned_at DESC LIMIT 1)) AS manager_id
        FROM crm_tasks t
        WHERE t.status='OPEN' AND t.type::text = ANY(${policy.types}::text[]) AND t.created_at>${since}
          AND NOT EXISTS (SELECT 1 FROM task_escalations e WHERE e.task_id=t.id)
        ORDER BY t.created_at, t.id
        FOR UPDATE OF t SKIP LOCKED LIMIT ${BATCH})
      SELECT c.id, c.type, c.created_at, c.manager_id,
        CASE WHEN c.manager_id IS NULL THEN 'UNASSIGNED'
             WHEN s.deactivated_at IS NOT NULL THEN 'UNAVAILABLE'
             ELSE COALESCE(a.status, 'AVAILABLE') END AS manager_status
      FROM cand c
      LEFT JOIN staff_accounts s ON s.id=c.manager_id
      LEFT JOIN manager_availability a ON a.manager_id=c.manager_id
      ORDER BY c.created_at, c.id`;
    let escalated = 0;
    for (const row of rows) {
      const dueAt = new Date(+row.created_at + policy.acceptMinutes * 60_000);
      const reason =
        row.manager_status !== 'AVAILABLE'
          ? 'MANAGER_UNAVAILABLE'
          : dueAt <= now
            ? 'ACCEPT_TIMEOUT'
            : null;
      if (!reason) continue;
      const [created] = await tx.$queryRaw<{ id: string }[]>`
        INSERT INTO task_escalations (task_id, primary_manager_id, reason, manager_status, accept_due_at, escalated_at)
        VALUES (${row.id}::uuid, ${row.manager_id}::uuid, ${reason}, ${row.manager_status}, ${dueAt}, ${now})
        ON CONFLICT (task_id) DO NOTHING RETURNING id`;
      if (!created) continue;
      escalated++;
      const auditId = randomUUID(),
        operationId = randomUUID(),
        eventKey = `task-escalation:${row.id}`;
      const payload = {
        schemaVersion: 1,
        escalationId: created.id,
        taskId: row.id,
        taskType: row.type,
        primaryManagerId: row.manager_id,
        reason,
        managerStatus: row.manager_status,
      };
      await this.audit.record(
        {
          id: auditId,
          actor_kind: 'SYSTEM',
          system_actor_ref: 'manager-task-escalation',
          action: 'TASK_ESCALATED_TO_DIRECTOR',
          resource_type: 'CrmTask',
          resource_id: row.id,
          result: 'SUCCESS',
          request_id: randomUUID(),
          source_operation_id: operationId,
          event_key: eventKey,
          recorded_at: now,
          metadata: payload,
        },
        tx,
      );
      await tx.outboxEvent.create({
        data: {
          topic: 'manager.task.escalated.v1',
          aggregate_type: 'CrmTask',
          aggregate_id: row.id,
          audit_event_id: auditId,
          source_operation_id: operationId,
          event_key: eventKey,
          payload,
          created_at: now,
        },
      });
    }
    return ok(escalated);
  }

  async processDue(): Promise<Result<number, DomainError>> {
    const policy = urgentTaskPolicy();
    if (!policy.ok) return policy;
    let total = 0;
    for (let round = 0; round < 10; round++) {
      const done = await this.transactions.runResult((tx) => this.sweep(tx, policy.value));
      if (!done.ok) return done;
      total += done.value;
      if (done.value === 0) break;
    }
    return ok(total);
  }

  async enabled(): Promise<Result<number, DomainError>> {
    try {
      if (!process.env.DATABASE_URL) return ok(0);
      const [available] = await this.db.client.$queryRaw<
        { ready: boolean }[]
      >`SELECT to_regclass('public.task_escalations') IS NOT NULL AND to_regclass('public.manager_availability') IS NOT NULL AS ready`;
      return available?.ready ? this.processDue() : ok(0);
    } catch {
      return err(domainError('DATABASE_ERROR', 503));
    }
  }
}

@Module({
  imports: [DatabaseModule, AuditModule, TransactionModule],
  providers: [ManagerTaskEscalation],
  exports: [ManagerTaskEscalation],
})
export class ManagerTaskEscalationModule {}

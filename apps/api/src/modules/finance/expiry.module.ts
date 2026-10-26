import { randomUUID } from 'node:crypto';
import { Injectable, Module } from '@nestjs/common';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { DatabaseModule } from '../../core/database/database.module.js';
import {
  TransactionModule,
  TransactionService,
} from '../../core/transaction/transaction.service.js';
import { AuditModule, AuditService } from '../../core/audit/audit.service.js';
import { domainError, fail } from '../../core/errors/domain-error.js';
import type { DomainError } from '../../core/errors/domain-error.js';
import { at } from './finance-common.js';

@Injectable()
export class TemporaryAccessExpiry {
  private readonly workerId = `finance-expiry:${randomUUID()}`;
  constructor(
    private readonly transactions: TransactionService,
    private readonly audit: AuditService,
  ) {}
  async processDue(limit = 10): Promise<Result<number, DomainError>> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      return err(domainError('INVALID_BATCH_SIZE', 400));
    let processed = 0;
    for (let i = 0; i < limit; i++) {
      const claimed = await this.transactions.runCritical(async (tx) => {
        const rows = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM job_records WHERE type='finance.temporary-access.expire.v1' AND next_run_at<=clock_timestamp() AND (status IN ('PENDING','RETRY_WAIT') OR (status='RUNNING' AND locked_until<=clock_timestamp())) ORDER BY next_run_at,id FOR UPDATE SKIP LOCKED LIMIT 1`;
        if (!rows.length) return null;
        const job = await tx.jobRecord.findUniqueOrThrow({ where: { id: rows[0]!.id } }),
          now = await at(tx);
        if (job.status === 'RUNNING')
          await tx.jobAttempt.updateMany({
            where: { job_id: job.id, attempt_no: job.attempts, finished_at: null },
            data: { finished_at: now, result: 'FAILED', error: 'LEASE_EXPIRED' },
          });
        if (job.attempts >= job.max_attempts) {
          await tx.jobRecord.update({
            where: { id: job.id },
            data: {
              status: 'FAILED',
              finished_at: now,
              locked_by: null,
              locked_until: null,
              last_error_code: 'ATTEMPTS_EXHAUSTED',
            },
          });
          return null;
        }
        const reserved = await tx.jobRecord.update({
          where: { id: job.id },
          data: {
            status: 'RUNNING',
            attempts: job.attempts + 1,
            started_at: now,
            locked_by: this.workerId,
            locked_until: new Date(+now + 30000),
          },
        });
        const attempt = await tx.jobAttempt.create({
          data: {
            job_id: job.id,
            attempt_no: reserved.attempts,
            started_at: now,
            created_at: now,
            updated_at: now,
          },
        });
        return { job: reserved, attemptId: attempt.id };
      });
      if (!claimed.ok) return claimed;
      if (!claimed.value) break;
      const { job, attemptId } = claimed.value;
      const outcome = await this.transactions.runCritical(async (tx) => {
        await tx.$queryRaw`SELECT id FROM job_records WHERE id=${job.id}::uuid FOR UPDATE`;
        const lease = await tx.jobRecord.findUniqueOrThrow({ where: { id: job.id } }),
          now = await at(tx);
        if (
          lease.status !== 'RUNNING' ||
          lease.locked_by !== this.workerId ||
          !lease.locked_until ||
          lease.locked_until <= now
        )
          return fail(domainError('LEASE_EXPIRED', 409));
        const payload = job.payload as { permissionId?: unknown };
        if (typeof payload?.permissionId !== 'string')
          return fail(domainError('INVALID_EXPIRY_JOB', 422));
        const permission = await tx.temporaryAccessPermission.findUniqueOrThrow({
          where: { id: payload.permissionId },
        });
        if (permission.valid_to > now) return fail(domainError('PERMISSION_NOT_EXPIRED', 422));
        const sub = await tx.subscription.findUniqueOrThrow({
            where: { id: permission.subscription_id },
          }),
          enrollment = await tx.studentSubjectEnrollment.findUniqueOrThrow({
            where: { id: sub.enrollment_id },
          });
        const manager = await tx.assignedManager.findFirst({
          where: {
            student_id: enrollment.student_id,
            assigned_at: { lte: now },
            OR: [{ ended_at: null }, { ended_at: { gt: now } }],
          },
        });
        const key = `temporary-access-expired:${permission.id}`,
          prior = await tx.crmTask.findUnique({ where: { idempotency_key: key } });
        if (!prior) {
          const auditId = randomUUID();
          await this.audit.record(
            {
              id: auditId,
              actor_kind: 'SYSTEM',
              system_actor_ref: 'finance-expiry-worker',
              action: 'temporary-access.expired',
              resource_type: 'TemporaryAccessPermission',
              resource_id: permission.id,
              result: 'SUCCESS',
              request_id: randomUUID(),
              source_operation_id: job.source_operation_id,
              event_key: key,
            },
            tx,
          );
          const event = await tx.outboxEvent.create({
            data: {
              topic: 'finance.temporary-access.expired.v1',
              aggregate_type: 'TemporaryAccessPermission',
              aggregate_id: permission.id,
              source_operation_id: job.source_operation_id,
              audit_event_id: auditId,
              event_key: key,
              payload: {
                schemaVersion: 1,
                permissionId: permission.id,
                studentId: enrollment.student_id,
              },
            },
          });
          await tx.crmTask.create({
            data: {
              student_id: enrollment.student_id,
              assigned_manager_id: manager?.manager_id ?? null,
              type: 'PAYMENT_FOLLOW_UP',
              title: 'Истёк ограниченный допуск: проверить оплату и дальнейший доступ',
              due_at: now,
              source_event_id: event.id,
              idempotency_key: key,
            },
          });
        }
        await tx.jobAttempt.update({
          where: { id: attemptId },
          data: { finished_at: now, result: 'SUCCEEDED' },
        });
        await tx.jobRecord.update({
          where: { id: job.id },
          data: { status: 'SUCCEEDED', finished_at: now, locked_by: null, locked_until: null },
        });
      });
      if (!outcome.ok) {
        const released = await this.transactions.runCritical(async (tx) => {
          const current = await tx.jobRecord.findUniqueOrThrow({ where: { id: job.id } });
          if (current.locked_by !== this.workerId || current.status !== 'RUNNING') return;
          const now = await at(tx),
            final = current.attempts >= current.max_attempts;
          await tx.jobAttempt.update({
            where: { id: attemptId },
            data: { finished_at: now, result: 'FAILED', error: outcome.error.code },
          });
          await tx.jobRecord.update({
            where: { id: job.id },
            data: {
              status: final ? 'FAILED' : 'RETRY_WAIT',
              finished_at: final ? now : null,
              locked_by: null,
              locked_until: null,
              next_run_at: new Date(+now + 30000 * 2 ** (current.attempts - 1)),
              last_error_code: outcome.error.code,
            },
          });
        });
        if (!released.ok) return released;
        return outcome;
      }
      processed++;
    }
    return ok(processed);
  }
  async enabled(): Promise<Result<number, DomainError>> {
    return process.env.DATABASE_URL ? this.processDue() : ok(0);
  }
}
@Module({
  imports: [DatabaseModule, TransactionModule, AuditModule],
  providers: [TemporaryAccessExpiry],
  exports: [TemporaryAccessExpiry],
})
export class FinanceExpiryModule {}

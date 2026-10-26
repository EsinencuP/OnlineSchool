import { randomUUID } from 'node:crypto';
import type { JobRecord, OutboxEvent, PrismaClient } from '@online-school/db';
import type { Handler, Tx, WorkerOptions } from './contracts.js';
import { dbNow, retryDelay, rollback, safeCode, systemAudit } from './contracts.js';
import { createHandlers } from './handlers.js';

export type Claim = { event: OutboxEvent; job: JobRecord; token: string };
const transactionOptions = {
  isolationLevel: 'ReadCommitted',
  timeout: 10000,
  maxWait: 5000,
} as const;

export class OutboxWorker {
  private readonly workerId = `outbox:${randomUUID()}`;
  private stopped = false;
  constructor(
    private readonly db: PrismaClient,
    private readonly options: WorkerOptions,
    private readonly handlers: ReadonlyMap<string, Handler> = createHandlers(),
  ) {}

  stop(): void {
    this.stopped = true;
  }

  async processDue(): Promise<number> {
    let processed = 0;
    for (let i = 0; i < this.options.batchSize && !this.stopped; i++) {
      const claim = await this.claim();
      if (!claim) break;
      if (claim === 'settled') continue;
      if (this.stopped) await this.fail(claim, 'WORKER_STOPPED');
      else await this.deliver(claim);
      processed++;
    }
    return processed;
  }

  // Separate, committed claim: SIGKILL leaves the job and attempt in PostgreSQL.
  async claim(): Promise<Claim | 'settled' | null> {
    return this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM outbox_events WHERE status='PENDING' AND next_attempt_at<=clock_timestamp()
          AND (locked_until IS NULL OR locked_until<=clock_timestamp())
        ORDER BY next_attempt_at,id FOR UPDATE SKIP LOCKED LIMIT 1`;
      if (!rows.length) return null;
      const event = await tx.outboxEvent.findUniqueOrThrow({ where: { id: rows[0]!.id } });
      const key = `outbox-delivery:${event.id}`;
      await tx.jobRecord.createMany({
        skipDuplicates: true,
        data: [
          {
            type: 'outbox.deliver.v1',
            payload: { eventId: event.id },
            source_operation_id: event.source_operation_id,
            source_outbox_event_id: event.id,
            deduplication_key: key,
            retry_policy: 'SAFE_RETRY',
            max_attempts: this.options.maxAttempts,
          },
        ],
      });
      const job = await tx.jobRecord.findUniqueOrThrow({ where: { deduplication_key: key } });
      const now = await dbNow(tx);
      if (job.status === 'RUNNING') {
        // An expired lease is reclaimed; a live lease can never be stolen.
        if (job.locked_until && job.locked_until > now) return null;
        await tx.jobAttempt.updateMany({
          where: { job_id: job.id, finished_at: null },
          data: { result: 'FAILED', finished_at: now, error: 'LEASE_EXPIRED' },
        });
        await tx.jobRecord.update({
          where: { id: job.id },
          data: {
            status: 'PENDING',
            locked_by: null,
            locked_until: null,
            last_error_code: 'LEASE_EXPIRED',
          },
        });
      }
      if (job.attempts >= job.max_attempts) {
        await this.dead(tx, event, job, now, 'ATTEMPTS_EXHAUSTED');
        return 'settled';
      }
      const token = `${this.workerId}:${randomUUID()}`;
      const until = new Date(+now + this.options.leaseMs);
      const reserved = await tx.jobRecord.update({
        where: { id: job.id },
        data: {
          status: 'RUNNING',
          attempts: { increment: 1 },
          started_at: now,
          locked_by: token,
          locked_until: until,
        },
      });
      await tx.jobAttempt.create({
        data: { job_id: job.id, attempt_no: reserved.attempts, started_at: now },
      });
      const reservedEvent = await tx.outboxEvent.update({
        where: { id: event.id },
        data: {
          attempts: { increment: 1 },
          last_attempt_at: now,
          locked_by: token,
          locked_until: until,
        },
      });
      return { event: reservedEvent, job: reserved, token };
    }, transactionOptions);
  }

  async deliver(claim: Claim): Promise<void> {
    try {
      await this.db.$transaction(async (tx) => {
        const current = await this.owned(tx, claim);
        if (!current) return;
        const now = await dbNow(tx);
        if (!current.locked_until || current.locked_until <= now) return rollback('LEASE_EXPIRED');
        const payload = current.payload;
        if (
          current.schema_version !== 1 ||
          !payload ||
          typeof payload !== 'object' ||
          Array.isArray(payload) ||
          payload.schemaVersion !== 1
        )
          return rollback('EVENT_SCHEMA_UNSUPPORTED');
        const handler = this.handlers.get(current.topic);
        if (!handler) return rollback('OUTBOX_HANDLER_NOT_REGISTERED');
        const result = await handler(tx, current, now);
        if (!result.ok) return rollback(result.error.code);
        const finished = await dbNow(tx);
        await tx.jobAttempt.update({
          where: { job_id_attempt_no: { job_id: claim.job.id, attempt_no: claim.job.attempts } },
          data: { result: 'SUCCEEDED', finished_at: finished },
        });
        await tx.jobRecord.update({
          where: { id: claim.job.id },
          data: {
            status: 'SUCCEEDED',
            finished_at: finished,
            locked_by: null,
            locked_until: null,
            last_error_code: null,
          },
        });
        await tx.outboxEvent.update({
          where: { id: current.id },
          data: {
            status: 'DELIVERED',
            published_at: finished,
            delivery_reference: claim.job.id,
            locked_by: null,
            locked_until: null,
            last_error_code: null,
          },
        });
      }, transactionOptions);
    } catch (error: unknown) {
      await this.fail(claim, safeCode(error));
    }
  }

  private async owned(tx: Tx, claim: Claim): Promise<OutboxEvent | null> {
    await tx.$queryRaw`SELECT id FROM outbox_events WHERE id=${claim.event.id}::uuid FOR UPDATE`;
    const current = await tx.outboxEvent.findUniqueOrThrow({ where: { id: claim.event.id } });
    if (
      current.status !== 'PENDING' ||
      current.locked_by !== claim.token ||
      current.attempts !== claim.event.attempts
    )
      return null;
    await tx.$queryRaw`SELECT id FROM job_records WHERE id=${claim.job.id}::uuid FOR UPDATE`;
    return current;
  }

  private async dead(tx: Tx, event: OutboxEvent, job: JobRecord, now: Date, code: string) {
    await tx.jobRecord.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        finished_at: now,
        locked_by: null,
        locked_until: null,
        last_error_code: code,
      },
    });
    await tx.outboxEvent.update({
      where: { id: event.id },
      data: {
        status: 'DEAD',
        locked_by: null,
        locked_until: null,
        last_error_code: code,
      },
    });
    await systemAudit(tx, {
      key: `worker:dead:${event.id}`,
      action: 'worker.outbox-dead',
      resourceType: 'OutboxEvent',
      resourceId: event.id,
      operationId: event.source_operation_id,
      error: true,
    });
  }

  private async fail(claim: Claim, code: string): Promise<void> {
    await this.db.$transaction(async (tx) => {
      if (!(await this.owned(tx, claim))) return;
      const now = await dbNow(tx);
      await tx.jobAttempt.updateMany({
        where: { job_id: claim.job.id, attempt_no: claim.job.attempts, finished_at: null },
        data: { result: 'FAILED', finished_at: now, error: code },
      });
      if (claim.job.attempts >= claim.job.max_attempts) {
        await this.dead(tx, claim.event, claim.job, now, code);
        return;
      }
      const next = new Date(+now + retryDelay(claim.job.attempts));
      await tx.jobRecord.update({
        where: { id: claim.job.id },
        data: {
          status: 'PENDING',
          next_run_at: next,
          locked_by: null,
          locked_until: null,
          last_error_code: code,
        },
      });
      await tx.outboxEvent.update({
        where: { id: claim.event.id },
        data: {
          next_attempt_at: next,
          locked_by: null,
          locked_until: null,
          last_error_code: code,
        },
      });
    }, transactionOptions);
  }
}

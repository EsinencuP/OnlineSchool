import { randomUUID } from 'node:crypto';
import type { PrismaClient, RecoveryState } from '@online-school/db';
import type { Tx, WorkerOptions } from './contracts.js';
import { dbNow, retryDelay, systemAudit } from './contracts.js';

export type RecoveryCheck =
  | { status: 'CONFIRMED'; resourceId: string; evidenceRef: string }
  | { status: 'FAILED'; evidenceRef: string } // Verified absence/failure, never just a timeout/404 guess.
  | { status: 'PENDING' };

export interface RecoveryProvider {
  // Read-only reconciliation of the ORIGINAL request/resource. Must honor abort; never create/delete.
  check(state: Readonly<RecoveryState>, signal: AbortSignal): Promise<RecoveryCheck>;
}
type RecoveryClaim = { state: RecoveryState; token: string };
const transactionOptions = {
  isolationLevel: 'ReadCommitted',
  timeout: 10000,
  maxWait: 5000,
} as const;

export class RecoveryWorker {
  private stopped = false;
  private active: AbortController | undefined;
  constructor(
    private readonly db: PrismaClient,
    private readonly options: WorkerOptions,
    private readonly providers: ReadonlyMap<string, RecoveryProvider> = new Map(),
  ) {}
  stop(): void {
    this.stopped = true;
    this.active?.abort();
  }

  async processDue(): Promise<number> {
    let processed = 0;
    for (let i = 0; i < this.options.batchSize && !this.stopped; i++) {
      const claim = await this.claim();
      if (!claim) break;
      if (claim === 'settled') continue;
      const result = await this.check(claim.state);
      await this.finish(claim, result);
      processed++;
    }
    return processed;
  }

  private async claim(): Promise<RecoveryClaim | 'settled' | null> {
    return this.db.$transaction(async (tx) => {
      // Reconciliation never races a retry or another checker of the same job.
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT r.id FROM recovery_states r JOIN job_records j ON j.id=r.job_id
        WHERE r.status='PENDING' AND j.status='RECONCILIATION_REQUIRED' AND j.attempts=r.attempt_no
          AND (r.next_check_at IS NULL OR r.next_check_at<=clock_timestamp())
          AND (r.locked_until IS NULL OR r.locked_until<=clock_timestamp())
        ORDER BY r.next_check_at NULLS FIRST,r.id FOR UPDATE OF j,r SKIP LOCKED LIMIT 1`;
      if (!rows.length) return null;
      const state = await tx.recoveryState.findUniqueOrThrow({ where: { id: rows[0]!.id } });
      const now = await dbNow(tx);
      if (state.check_attempts >= this.options.recoveryMaxAttempts) {
        await this.manual(tx, state, now);
        return 'settled';
      }
      const token = `recovery:${randomUUID()}`;
      const reserved = await tx.recoveryState.update({
        where: { id: state.id },
        data: {
          check_attempts: { increment: 1 },
          last_checked_at: now,
          locked_by: token,
          locked_until: new Date(+now + this.options.leaseMs),
        },
      });
      return { state: reserved, token };
    }, transactionOptions);
  }

  private async check(state: RecoveryState): Promise<RecoveryCheck> {
    const provider = this.providers.get(state.provider);
    if (!provider || this.stopped) return { status: 'PENDING' };
    const controller = new AbortController();
    this.active = controller;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<RecoveryCheck>((resolve) => {
        const unknown = () => resolve({ status: 'PENDING' });
        controller.signal.addEventListener('abort', unknown, { once: true });
        timer = setTimeout(() => controller.abort(), this.options.providerTimeoutMs);
      });
      return await Promise.race([provider.check(state, controller.signal), timeout]);
    } catch {
      return { status: 'PENDING' }; // Provider errors/tokens/payloads never enter logs or audit.
    } finally {
      if (timer) clearTimeout(timer);
      this.active = undefined;
    }
  }

  private async finish(claim: RecoveryClaim, result: RecoveryCheck): Promise<void> {
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM job_records WHERE id=${claim.state.job_id}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM recovery_states WHERE id=${claim.state.id}::uuid FOR UPDATE`;
      const state = await tx.recoveryState.findUniqueOrThrow({ where: { id: claim.state.id } });
      const job = await tx.jobRecord.findUniqueOrThrow({ where: { id: state.job_id } });
      const now = await dbNow(tx);
      if (
        state.status !== 'PENDING' ||
        state.locked_by !== claim.token ||
        !state.locked_until ||
        state.locked_until <= now ||
        job.status !== 'RECONCILIATION_REQUIRED' ||
        job.attempts !== state.attempt_no
      )
        return;
      const verified =
        result &&
        (result.status === 'CONFIRMED' || result.status === 'FAILED') &&
        typeof result.evidenceRef === 'string' &&
        !!result.evidenceRef.trim() &&
        (result.status !== 'CONFIRMED' ||
          (typeof result.resourceId === 'string' && !!result.resourceId.trim()));
      if (verified && (result.status === 'CONFIRMED' || result.status === 'FAILED')) {
        await tx.recoveryState.update({
          where: { id: state.id },
          data: {
            status: result.status,
            evidence_ref: result.evidenceRef,
            ext_resource_id: result.status === 'CONFIRMED' ? result.resourceId : null,
            reconciled_at: now,
            next_check_at: null,
            reason_code: null,
            locked_by: null,
            locked_until: null,
          },
        });
        const confirmed = result.status === 'CONFIRMED';
        const exhausted = job.attempts >= job.max_attempts;
        await tx.jobRecord.update({
          where: { id: job.id },
          data: {
            status: confirmed ? 'SUCCEEDED' : exhausted ? 'FAILED' : 'PENDING',
            finished_at: confirmed || exhausted ? now : null,
            next_run_at: new Date(+now + retryDelay(job.attempts)),
            last_error_code: confirmed ? null : 'EXTERNAL_OPERATION_ABSENT',
          },
        });
        await systemAudit(tx, {
          key: `worker:reconciled:${state.id}`,
          action: 'worker.recovery-reconciled',
          resourceType: 'RecoveryState',
          resourceId: state.id,
          operationId: job.source_operation_id,
        });
      } else if (state.check_attempts >= this.options.recoveryMaxAttempts) {
        await this.manual(tx, state, now);
      } else {
        await tx.recoveryState.update({
          where: { id: state.id },
          data: {
            next_check_at: new Date(+now + retryDelay(state.check_attempts)),
            reason_code: this.providers.has(state.provider)
              ? 'EXTERNAL_OUTCOME_UNKNOWN'
              : 'RECOVERY_PROVIDER_NOT_CONFIGURED',
            locked_by: null,
            locked_until: null,
          },
        });
      }
    }, transactionOptions);
  }

  private async manual(tx: Tx, state: RecoveryState, now: Date) {
    await tx.recoveryState.update({
      where: { id: state.id },
      data: {
        status: 'NEEDS_MANUAL',
        next_check_at: null,
        last_checked_at: now,
        locked_by: null,
        locked_until: null,
        reason_code: 'RECONCILIATION_EXHAUSTED',
      },
    });
    const job = await tx.jobRecord.findUniqueOrThrow({ where: { id: state.job_id } });
    await systemAudit(tx, {
      key: `worker:recovery-manual:${state.id}`,
      action: 'worker.recovery-needs-manual',
      resourceType: 'RecoveryState',
      resourceId: state.id,
      operationId: job.source_operation_id,
      error: true,
    });
  }
}

import { randomUUID } from 'node:crypto';
import type { OutboxEvent, Prisma } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';

export type Tx = Prisma.TransactionClient;
export type WorkerError = { code: string };
export type Handler = (tx: Tx, event: OutboxEvent, now: Date) => Promise<Result<void, WorkerError>>;
export type WorkerOptions = Readonly<{
  maxAttempts: number;
  recoveryMaxAttempts: number;
  pollMs: number;
  leaseMs: number;
  batchSize: number;
  providerTimeoutMs: number;
}>;

export function readOptions(
  env: NodeJS.ProcessEnv = process.env,
): Result<WorkerOptions, WorkerError> {
  const read = (key: string, fallback: number, max: number) => {
    const raw = env[key];
    const value = raw === undefined ? fallback : /^\d+$/.test(raw) ? Number(raw) : NaN;
    return Number.isSafeInteger(value) && value > 0 && value <= max ? value : NaN;
  };
  const options = {
    maxAttempts: read('WORKER_MAX_ATTEMPTS', 10, 1000),
    recoveryMaxAttempts: read('WORKER_RECOVERY_MAX_ATTEMPTS', 10, 1000),
    pollMs: read('WORKER_POLL_MS', 1000, 60000),
    leaseMs: read('WORKER_LEASE_MS', 30000, 300000),
    batchSize: read('WORKER_BATCH_SIZE', 20, 100),
    providerTimeoutMs: read('WORKER_PROVIDER_TIMEOUT_MS', 5000, 60000),
  };
  if (Object.values(options).some(Number.isNaN) || options.providerTimeoutMs >= options.leaseMs)
    return err({ code: 'WORKER_CONFIG_INVALID' });
  return ok(options);
}

export const retryDelay = (attempt: number): number =>
  [1000, 5000, 30000, 300000, 1800000][Math.min(Math.max(attempt - 1, 0), 4)]!;

export async function dbNow(tx: Tx): Promise<Date> {
  const rows = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
  return rows[0]!.now;
}

// Only this boundary rejects to roll back an interactive transaction on a Result failure.
export class WorkerFailure extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
export const rollback = (code: string): Promise<never> => Promise.reject(new WorkerFailure(code));
export const safeCode = (error: unknown): string =>
  error instanceof WorkerFailure && /^[A-Z][A-Z0-9_]{0,79}$/.test(error.code)
    ? error.code
    : 'WORKER_OPERATION_FAILED';

export async function systemAudit(
  tx: Tx,
  input: {
    key: string;
    action: string;
    resourceType: string;
    resourceId: string;
    operationId: string;
    error?: boolean;
  },
): Promise<void> {
  // Append-only audit forbids UPDATE, including an upsert's update path.
  await tx.auditEvent.createMany({
    skipDuplicates: true,
    data: [
      {
        actor_kind: 'SYSTEM',
        system_actor_ref: 'outbox-worker',
        action: input.action,
        resource_type: input.resourceType,
        resource_id: input.resourceId,
        result: input.error ? 'ERROR' : 'SUCCESS',
        request_id: randomUUID(),
        source_operation_id: input.operationId,
        event_key: input.key,
      },
    ],
  });
}

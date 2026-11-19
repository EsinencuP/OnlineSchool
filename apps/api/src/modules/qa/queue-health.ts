import type { Prisma } from '@online-school/db';
import type { QueueHealthResponse } from './qa.dto.js';
import { OUTBOX_AUDIT_REPLAY_TOPIC } from './outbox-replay.js';

type QueueSample = Omit<QueueHealthResponse, 'checkedAt'> & { checkedAt: Date };

export async function readQueueHealth(
  db: Pick<Prisma.TransactionClient, '$queryRaw'>,
): Promise<QueueHealthResponse | null> {
  const [sample] = await db.$queryRaw<QueueSample[]>`
    WITH outbox AS (
      SELECT jsonb_build_object(
        'pending', count(*) FILTER (WHERE status='PENDING'),
        'ready', count(*) FILTER (WHERE status='PENDING' AND next_attempt_at <= statement_timestamp()
          AND (locked_until IS NULL OR locked_until <= statement_timestamp())),
        'waitingRetry', count(*) FILTER (WHERE status='PENDING' AND attempts>0
          AND next_attempt_at > statement_timestamp() AND locked_until IS NULL),
        'inFlight', count(*) FILTER (WHERE status='PENDING' AND locked_until > statement_timestamp()),
        'expiredLeases', count(*) FILTER (WHERE status='PENDING' AND locked_until <= statement_timestamp()),
        'dead', count(*) FILTER (WHERE status='DEAD'),
        'oldestReadySeconds', floor(extract(epoch FROM statement_timestamp() - min(next_attempt_at)
          FILTER (WHERE status='PENDING' AND next_attempt_at <= statement_timestamp()
            AND (locked_until IS NULL OR locked_until <= statement_timestamp()))))
      ) AS counters FROM public.outbox_events WHERE status IN ('PENDING','DEAD')
    ), jobs AS (
      SELECT jsonb_build_object(
        'waiting', count(*) FILTER (WHERE status IN ('PENDING','RETRY_WAIT')),
        'ready', count(*) FILTER (WHERE status IN ('PENDING','RETRY_WAIT') AND next_run_at <= statement_timestamp()),
        'oldestReadySeconds', floor(extract(epoch FROM statement_timestamp() - min(next_run_at)
          FILTER (WHERE status IN ('PENDING','RETRY_WAIT') AND next_run_at <= statement_timestamp()))),
        'running', count(*) FILTER (WHERE status='RUNNING'),
        'expiredLeases', count(*) FILTER (WHERE status='RUNNING' AND locked_until <= statement_timestamp()),
        'failed', count(*) FILTER (WHERE status='FAILED'),
        'reconciliationRequired', count(*) FILTER (WHERE status='RECONCILIATION_REQUIRED')
      ) AS counters FROM public.job_records WHERE status NOT IN ('SUCCEEDED','CANCELLED')
    ), recovery AS (
      SELECT jsonb_build_object(
        'waiting', count(*) FILTER (WHERE status='PENDING'),
        'needsManual', count(*) FILTER (WHERE status='NEEDS_MANUAL')
      ) AS counters FROM public.recovery_states WHERE status IN ('PENDING','NEEDS_MANUAL')
    ), latest_dead AS (
      SELECT id, topic, attempts, updated_at,
        CASE WHEN last_error_code ~ '^[A-Z][A-Z0-9_]{0,79}$' THEN last_error_code END AS code
      FROM public.outbox_events WHERE status='DEAD' ORDER BY updated_at DESC, id DESC LIMIT 20
    )
    SELECT statement_timestamp() AS "checkedAt", outbox.counters AS outbox,
      jobs.counters AS jobs, recovery.counters AS recovery,
      (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id,
        'topic', CASE WHEN topic ~ '^[a-z][a-z0-9_.-]{0,119}$' THEN topic ELSE 'unknown' END,
        'attempts', attempts, 'lastErrorCode', code, 'failedAt', updated_at,
        'replayStatus', (SELECT replay.status FROM public.outbox_events replay
          WHERE replay.topic=${OUTBOX_AUDIT_REPLAY_TOPIC} AND replay.aggregate_id=latest_dead.id
            AND replay.status IN ('PENDING','DELIVERED') LIMIT 1))
        ORDER BY updated_at DESC, id DESC), '[]'::jsonb) FROM latest_dead) AS "latestDead"
    FROM outbox CROSS JOIN jobs CROSS JOIN recovery`;
  return sample ? { ...sample, checkedAt: sample.checkedAt.toISOString() } : null;
}

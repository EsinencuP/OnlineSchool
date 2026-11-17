import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { domainError } from '../../core/errors/domain-error.js';
import type { DomainError } from '../../core/errors/domain-error.js';

export interface UrgentTaskPolicy {
  /** Task types that must be accepted by the manager (stored CrmTaskType values). */
  types: string[];
  /** OPS-01/B: acceptance window of an available manager. */
  acceptMinutes: number;
  /** Older open tasks are overdue work, not an acceptance race anymore. */
  lookbackHours: number;
}

const KNOWN_TYPES = [
  'LEAD_FOLLOWUP',
  'ASSIGN_TEACHER',
  'SUBSCRIPTION_EXPIRING',
  'ATTENDANCE_DISPUTE',
  'RESCHEDULE_REQUEST',
  'MANUAL',
  'FOLLOW_UP',
  'TRIAL_FOLLOW_UP',
  'PAYMENT_FOLLOW_UP',
];

/** The catalog of urgent tasks is an owner decision; the default covers student-initiated cases. */
export function urgentTaskPolicy(
  env: NodeJS.ProcessEnv = process.env,
): Result<UrgentTaskPolicy, DomainError> {
  const types = (env.URGENT_TASK_TYPES ?? 'ATTENDANCE_DISPUTE,RESCHEDULE_REQUEST')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const minutes = env.URGENT_ACCEPT_MINUTES ?? '10',
    lookback = env.URGENT_LOOKBACK_HOURS ?? '24';
  if (
    !types.length ||
    !types.every((t) => KNOWN_TYPES.includes(t)) ||
    !/^[1-9]\d*$/.test(minutes) ||
    +minutes > 120 ||
    !/^[1-9]\d*$/.test(lookback) ||
    +lookback > 168
  )
    return err(domainError('URGENT_TASK_CONFIGURATION_INVALID', 503));
  return ok({ types, acceptMinutes: +minutes, lookbackHours: +lookback });
}

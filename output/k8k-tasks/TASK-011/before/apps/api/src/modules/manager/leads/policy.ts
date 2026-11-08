import type { LeadStage as StoredStage } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { domainError } from '../../../core/errors/domain-error.js';
import type { DomainError } from '../../../core/errors/domain-error.js';

export const LEAD_STAGES = [
  'NEW',
  'IN_PROGRESS',
  'TRIAL',
  'AWAITING_PAYMENT',
  'CONVERTED',
  'LOST',
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];
export const LEAD_SOURCES = ['SITE', 'PHONE', 'MESSENGER', 'REFERRAL', 'OTHER'] as const;
export const LEAD_LOST_REASONS = [
  'NOT_INTERESTED',
  'PRICE',
  'NO_CONTACT',
  'COMPETITOR',
  'SCHEDULE_MISMATCH',
  'TRIAL_NO_SHOW',
  'OTHER',
] as const;
export const STAGE_STORAGE: Record<LeadStage, StoredStage> = {
  NEW: 'NEW',
  IN_PROGRESS: 'CONTACTED',
  TRIAL: 'TRIAL_SCHEDULED',
  AWAITING_PAYMENT: 'AWAITING_PAYMENT',
  CONVERTED: 'CONVERTED',
  LOST: 'CLOSED',
};
export function publicStage(stage: StoredStage): LeadStage {
  if (stage === 'CONTACTED') return 'IN_PROGRESS';
  if (stage === 'TRIAL_SCHEDULED' || stage === 'TRIAL_DONE') return 'TRIAL';
  return stage === 'CLOSED' ? 'LOST' : stage;
}
export function leadTransition(
  from: LeadStage,
  to: LeadStage,
  outcome?: string,
  skipReason?: string,
): Result<void, DomainError> {
  if (from === 'CONVERTED') return err(domainError('LEAD_TERMINAL', 409));
  const allowed: Record<LeadStage, LeadStage[]> = {
    NEW: ['IN_PROGRESS', 'LOST'],
    IN_PROGRESS: ['TRIAL', 'AWAITING_PAYMENT', 'LOST'],
    TRIAL: ['IN_PROGRESS', 'AWAITING_PAYMENT', 'LOST'],
    AWAITING_PAYMENT: ['TRIAL', 'LOST'],
    CONVERTED: [],
    LOST: ['IN_PROGRESS'],
  };
  if (!allowed[from].includes(to)) return err(domainError('INVALID_STAGE_TRANSITION', 409));
  if (from === 'TRIAL' && to === 'AWAITING_PAYMENT' && outcome !== 'ATTENDED')
    return err(domainError('TRIAL_OUTCOME_REQUIRED', 409));
  if (from === 'TRIAL' && to === 'IN_PROGRESS' && !['NO_SHOW', 'CANCELLED'].includes(outcome ?? ''))
    return err(domainError('TRIAL_OUTCOME_REQUIRED', 409));
  if (
    from === 'IN_PROGRESS' &&
    to === 'AWAITING_PAYMENT' &&
    (!skipReason || skipReason.trim().length < 3)
  )
    return err(domainError('SKIP_TRIAL_REASON_REQUIRED', 422));
  return ok(undefined);
}
export function leadConfig(): Result<
  { minutes: number; followupMinutes: number; feedbackVisible: boolean; perMinute: number },
  DomainError
> {
  const read = (name: string, fallback: string) => {
    const raw = process.env[name] ?? fallback;
    return /^[1-9]\d*$/.test(raw) ? parseInt(raw, 10) : NaN;
  };
  const minutes = read('TRIAL_LESSON_MINUTES', '50'),
    followupMinutes = read('LEAD_FOLLOWUP_DUE_MINUTES', '120'),
    perMinute = read('LEADS_PER_MANAGER_PER_MINUTE', '30');
  const visible = process.env.TRIAL_FEEDBACK_VISIBLE_TO_MANAGER ?? 'true';
  return [minutes, followupMinutes, perMinute].every(Number.isInteger) &&
    minutes >= 15 &&
    minutes <= 120 &&
    followupMinutes >= 1 &&
    followupMinutes <= 14400 &&
    perMinute >= 1 &&
    perMinute <= 1000 &&
    ['true', 'false'].includes(visible)
    ? ok({ minutes, followupMinutes, perMinute, feedbackVisible: visible === 'true' })
    : err(domainError('LEAD_CONFIGURATION_INVALID', 503));
}
export const normalizePhone = (s: string) => s.replace(/\D/g, '');
export const maskPhone = (s: string | null) => (s ? `••• ${normalizePhone(s).slice(-3)}` : null);

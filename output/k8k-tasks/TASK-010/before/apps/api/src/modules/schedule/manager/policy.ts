import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { AppException, domainError } from '../../../core/errors/domain-error.js';
import type { DomainError } from '../../../core/errors/domain-error.js';
import { databaseError } from '../../../core/errors/database-error.js';
import { Prisma } from '@online-school/db';
export const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
export function schedulePolicy(): Result<{ leadMinutes: number; freeHours: number }, DomainError> {
  const lead = process.env.LESSON_MIN_LEAD_MINUTES ?? '60';
  const free = process.env.LESSON_FREE_CHANGE_HOURS ?? '24';
  if (!/^\d+$/.test(lead) || !/^\d+$/.test(free) || +lead > 10080 || +free > 720)
    return err(domainError('INVALID_SCHEDULE_CONFIGURATION', 503));
  return ok({ leadMinutes: +lead, freeHours: +free });
}
export function scheduleFailure(error: unknown): DomainError {
  const failure = error instanceof AppException ? error.domain : databaseError(error);
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = error.meta as
      { code?: string; driverAdapterError?: { cause?: { originalCode?: string } } } | undefined;
    if ([meta?.code, meta?.driverAdapterError?.cause?.originalCode].includes('23P01'))
      return domainError('SLOT_CONFLICT', 409);
  }
  if (failure.code === 'CALENDAR_CONFLICT') return domainError('SLOT_CONFLICT', 409);
  if (['LESSON_HAS_REPORTED_FACT', 'CONFIRMED_LESSON_REQUIRED'].includes(failure.code))
    return domainError('LESSON_IMMUTABLE_STATE', 409);
  return failure;
}
export function interval(from: string, to: string): Result<{ from: Date; to: Date }, DomainError> {
  const a = new Date(from),
    b = new Date(to);
  if (
    !INSTANT.test(from) ||
    !INSTANT.test(to) ||
    !Number.isFinite(+a) ||
    !Number.isFinite(+b) ||
    b <= a
  )
    return err(domainError('INVALID_RANGE', 422));
  return +b - +a > 31 * 86400000
    ? err(domainError('RANGE_TOO_LARGE', 422))
    : ok({ from: a, to: b });
}

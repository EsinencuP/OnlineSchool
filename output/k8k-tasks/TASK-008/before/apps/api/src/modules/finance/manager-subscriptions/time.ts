import { Temporal } from '@js-temporal/polyfill';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { domainError } from '../../../core/errors/domain-error.js';
import type { DomainError } from '../../../core/errors/domain-error.js';
export type FreezePolicy = { zone: string; maxDays: number; totalDays: number };
export function freezePolicy(): Result<FreezePolicy, DomainError> {
  const zone = process.env.SCHOOL_TIMEZONE ?? 'Europe/Chisinau';
  const maxDays = Number(process.env.SUBSCRIPTION_MAX_FREEZE_DAYS ?? '30');
  const totalDays = Number(process.env.SUBSCRIPTION_MAX_FREEZE_TOTAL_DAYS ?? '60');
  try {
    Temporal.Now.zonedDateTimeISO(zone);
    if (
      !Number.isInteger(maxDays) ||
      maxDays < 1 ||
      !Number.isInteger(totalDays) ||
      totalDays < maxDays
    )
      return err(domainError('INVALID_FREEZE_CONFIGURATION', 503));
    return ok({ zone, maxDays, totalDays });
  } catch {
    return err(domainError('INVALID_FREEZE_CONFIGURATION', 503));
  }
}
export function localDay(date: Date, zone: string): string {
  return Temporal.Instant.fromEpochMilliseconds(+date)
    .toZonedDateTimeISO(zone)
    .toPlainDate()
    .toString();
}
export function schoolMidnight(day: string, zone: string): Date {
  return new Date(
    Temporal.PlainDate.from(day).toZonedDateTime({ timeZone: zone, plainTime: '00:00' })
      .epochMilliseconds,
  );
}
export function addSchoolDays(date: Date, days: number, zone: string): Date {
  return new Date(
    Temporal.Instant.fromEpochMilliseconds(+date).toZonedDateTimeISO(zone).add({ days })
      .epochMilliseconds,
  );
}
export function daysBetween(from: string, to: string): number {
  return Temporal.PlainDate.from(from).until(Temporal.PlainDate.from(to), { largestUnit: 'day' })
    .days;
}
export function freezeDates(
  startsOn: string,
  endsOn: string,
  now: Date,
  used: number,
  policy: FreezePolicy,
): Result<{ from: Date; until: Date; days: number }, DomainError> {
  try {
    if (
      ![startsOn, endsOn].every(
        (d) =>
          /^\d{4}-\d{2}-\d{2}$/.test(d) &&
          Temporal.PlainDate.from(d, { overflow: 'reject' }).toString() === d,
      )
    )
      return err(domainError('INVALID_FREEZE_DATES', 422));
    const days = daysBetween(startsOn, endsOn);
    if (days < 1 || startsOn < localDay(now, policy.zone))
      return err(domainError('INVALID_FREEZE_DATES', 422));
    if (days > policy.maxDays || days + used > policy.totalDays)
      return err(domainError('FREEZE_LIMIT_EXCEEDED', 409));
    return ok({
      from: schoolMidnight(startsOn, policy.zone),
      until: schoolMidnight(endsOn, policy.zone),
      days,
    });
  } catch {
    return err(domainError('INVALID_FREEZE_DATES', 422));
  }
}

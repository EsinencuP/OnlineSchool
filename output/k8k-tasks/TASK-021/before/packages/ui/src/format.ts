import { intlLocaleFor } from './messages.js';
import type { Locale } from './messages.js';

type CalendarFields = Pick<Intl.DateTimeFormatOptions, 'day' | 'month' | 'year' | 'weekday'>;
type Instant = string | number;
const dayMonth = { day: 'numeric', month: 'long' } as const;
const clock = { hour: '2-digit', minute: '2-digit' } as const;

function plainDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value) || value.startsWith('0000-')) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

export function calendarDate(value: string): string | null {
  return plainDate(value) ? value : null;
}

export function formatDateOnly(
  value: string,
  locale: Locale,
  fields: CalendarFields = dayMonth,
): string | null {
  return (
    plainDate(value)?.toLocaleDateString(intlLocaleFor(locale), { ...fields, timeZone: 'UTC' }) ??
    null
  );
}

export function instantMilliseconds(value: Instant): number | null {
  if (
    typeof value === 'string' &&
    !(
      /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/iu.test(
        value,
      ) && plainDate(value.slice(0, 10))
    )
  )
    return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function formatInstant(
  value: Instant,
  locale: Locale,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): string | null {
  const timestamp = instantMilliseconds(value);
  if (timestamp === null || !timeZone.trim()) return null;
  try {
    return new Intl.DateTimeFormat(intlLocaleFor(locale), { ...options, timeZone }).format(
      timestamp,
    );
  } catch {
    return null;
  }
}

export function formatDate(value: Instant, locale: Locale, timeZone: string): string | null {
  return formatInstant(value, locale, timeZone, dayMonth);
}

export function formatDateTime(value: Instant, locale: Locale, timeZone: string): string | null {
  return formatInstant(value, locale, timeZone, { ...dayMonth, ...clock });
}

export function formatTime(value: Instant, locale: Locale, timeZone: string): string | null {
  return formatInstant(value, locale, timeZone, clock);
}

export function formatRelativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  locale: Locale,
): string | null {
  return Number.isFinite(value)
    ? new Intl.RelativeTimeFormat(intlLocaleFor(locale), { numeric: 'always' }).format(value, unit)
    : null;
}

import { Temporal } from '@js-temporal/polyfill';
import { domainError, fail } from '../../core/errors/domain-error.js';

export function timezone(value: unknown): string {
  if (typeof value !== 'string' || value.length > 100)
    return fail(domainError('INVALID_TIMEZONE', 422));
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format(0);
    return value;
  } catch {
    return fail(domainError('INVALID_TIMEZONE', 422));
  }
}
export function occurrences(rule: string, zone: string, from: Date, until: Date, duration: number) {
  const match =
    /^FREQ=WEEKLY;BYDAY=(MO|TU|WE|TH|FR|SA|SU);BYHOUR=(\d{1,2});BYMINUTE=(\d{1,2})$/.exec(rule);
  if (
    !match ||
    Number(match[2]) > 23 ||
    Number(match[3]) > 59 ||
    until <= from ||
    +until - +from > 366 * 86400000
  )
    return fail(domainError('INVALID_RECURRENCE', 422));
  timezone(zone);
  const day = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'].indexOf(match[1]!) + 1;
  try {
    let date = Temporal.Instant.fromEpochMilliseconds(+from).toZonedDateTimeISO(zone).toPlainDate();
    const end = Temporal.Instant.fromEpochMilliseconds(+until)
      .toZonedDateTimeISO(zone)
      .toPlainDate();
    const result: { date: Date; start: Date; end: Date }[] = [];
    while (Temporal.PlainDate.compare(date, end) <= 0) {
      if (date.dayOfWeek === day) {
        // Reject both nonexistent and ambiguous wall times. A manager must select
        // an explicit alternative; the generator never silently shifts a lesson.
        const z = Temporal.ZonedDateTime.from(
          {
            timeZone: zone,
            year: date.year,
            month: date.month,
            day: date.day,
            hour: Number(match[2]),
            minute: Number(match[3]),
          },
          { disambiguation: 'reject' },
        );
        const start = new Date(z.epochMilliseconds);
        if (start >= from && start < until)
          result.push({
            date: new Date(date.toString() + 'T00:00:00Z'),
            start,
            end: new Date(+start + duration * 60000),
          });
      }
      date = date.add({ days: 1 });
    }
    return result;
  } catch {
    return fail(domainError('AMBIGUOUS_OR_INVALID_LOCAL_TIME', 422));
  }
}

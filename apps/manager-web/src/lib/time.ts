import { Temporal } from '@js-temporal/polyfill';
import { ru } from '../i18n/ru.js';
export function displayTime(iso: string | null, timezone: string): string {
  return iso
    ? new Intl.DateTimeFormat('ru-RU', {
        timeZone: timezone,
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso))
    : ru.dash;
}
export function localToIso(local: string, timezone: string): string | null {
  try {
    return Temporal.PlainDateTime.from(local)
      .toZonedDateTime(timezone, { disambiguation: 'reject' })
      .toString({ timeZoneName: 'never', calendarName: 'never', smallestUnit: 'second' });
  } catch {
    return null;
  }
}
export function schoolDate(timezone: string): string {
  return Temporal.Now.zonedDateTimeISO(timezone).toPlainDate().toString();
}
export function dateShift(date: string, days: number): string {
  return Temporal.PlainDate.from(date).add({ days }).toString();
}
export function weekStart(date: string): string {
  const d = Temporal.PlainDate.from(date);
  return d.subtract({ days: d.dayOfWeek - 1 }).toString();
}
export function localInput(iso: string, timezone: string): string {
  return Temporal.Instant.from(iso)
    .toZonedDateTimeISO(timezone)
    .toPlainDateTime()
    .toString({ smallestUnit: 'minute' });
}

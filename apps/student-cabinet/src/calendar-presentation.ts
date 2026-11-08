/** Date-only month arithmetic stays in UTC; lesson instants use the cabinet zone. */
export function calendarMonth(month: string) {
  const first = new Date(`${month}-01T12:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const last = new Date(first);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  return Array.from({ length: offset + last.getUTCDate() }, (_, index) =>
    index < offset ? null : `${month}-${String(index - offset + 1).padStart(2, '0')}`,
  );
}
export function adjacentMonth(month: string, step: number) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + step);
  const result = date.toISOString().slice(0, 7);
  return /^(?!0000)\d{4}-\d{2}$/.test(result) ? result : null;
}
export function lessonCalendarDay(instant: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(instant));
}

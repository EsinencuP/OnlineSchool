import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarMonth, adjacentMonth, lessonCalendarDay } from '../src/calendar-presentation.ts';

test('month index starts on Monday and includes November Sunday and final Monday', () => {
  const days = calendarMonth('2026-11');
  assert.equal(days[6], '2026-11-01');
  assert.equal(days[35], '2026-11-30');
  assert.equal(days.filter(Boolean).length, 30);
});
test('date-only months preserve leap years and supported year limits', () => {
  assert.equal(calendarMonth('2028-02').filter(Boolean).at(-1), '2028-02-29');
  assert.equal(calendarMonth('0001-01').filter(Boolean).length, 31);
  assert.equal(adjacentMonth('2026-12', 1), '2027-01');
  assert.equal(adjacentMonth('0001-01', -1), null);
  assert.equal(adjacentMonth('9999-12', 1), null);
});
test('lesson dots follow cabinet day across midnight and DST, not UTC or device date', () => {
  assert.equal(lessonCalendarDay('2026-11-08T22:15:00Z', 'Europe/Chisinau'), '2026-11-09');
  assert.equal(lessonCalendarDay('2026-03-29T21:30:00Z', 'Europe/Chisinau'), '2026-03-30');
  assert.equal(lessonCalendarDay('2026-11-08T10:30:00Z', 'Pacific/Kiritimati'), '2026-11-09');
  assert.equal(lessonCalendarDay('2026-11-08T10:30:00Z', 'Pacific/Pago_Pago'), '2026-11-07');
});

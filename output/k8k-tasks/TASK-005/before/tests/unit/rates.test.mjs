import { expect, test } from '@jest/globals';
import {
  ordinaryRate,
  restoredEngagements,
  addCalendarMonths,
} from '../../apps/api/dist/modules/finance/teacher-rate.service.js';

test('full rate calculation: all 200/220/250 boundaries, never ordinary 230 MDL', () => {
  for (let months = 0; months <= 30; months++)
    for (let students = 0; students <= 20; students++) {
      const tenure = Math.min(6, Math.floor(months / 2));
      const pupils = Math.min(4, Math.floor(students / 2));
      const expected = tenure + pupils < 5 ? '200' : tenure + pupils < 10 ? '220' : '250';
      const actual = ordinaryRate(months, students);
      expect(actual.points).toBe(tenure + pupils);
      expect(actual.rate.toString()).toBe(expected);
    }
});
test('teacher returns within six calendar months: restore, but not one millisecond later', () => {
  const ended = {
    id: 'old',
    starts_at: new Date('2024-01-01Z'),
    ends_at: new Date('2025-08-31T12:00Z'),
  };
  const boundary = addCalendarMonths(ended.ends_at, 6);
  const returned = { id: 'returned', starts_at: boundary, ends_at: null };
  expect(restoredEngagements([ended, returned], new Date('2026-03-01Z')).map((x) => x.id)).toEqual([
    'old',
    'returned',
  ]);
  expect(
    restoredEngagements(
      [ended, { ...returned, starts_at: new Date(+boundary + 1) }],
      new Date('2026-03-01Z'),
    ).map((x) => x.id),
  ).toEqual(['returned']);
});

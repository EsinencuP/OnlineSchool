import assert from 'node:assert/strict';
import { test } from '../../../tests/support/test-harness.mjs';
import { money } from '../dist/modules/finance/finance-common.js';
import {
  ordinaryRate,
  restoredEngagements,
  addCalendarMonths,
} from '../dist/modules/finance/teacher-rate.service.js';

test('ordinary 4/5/9/10 point boundaries are 200/220/220/250; no automatic 230', () => {
  for (const [months, students, points, rate] of [
    [0, 8, 4, '200'],
    [2, 8, 5, '220'],
    [12, 6, 9, '220'],
    [12, 8, 10, '250'],
  ]) {
    const result = ordinaryRate(months, students);
    assert.equal(result.points, points);
    assert.equal(result.rate.toString(), rate);
  }
  assert.equal(ordinaryRate(100, 100).points, 10);
});
test('rehire restores tenure within six calendar months, but never across seven-month break', () => {
  const old = { id: 'old', starts_at: new Date('2024-01-01Z'), ends_at: new Date('2025-01-01Z') };
  const current = { id: 'new', starts_at: new Date('2025-07-01Z'), ends_at: null };
  assert.deepEqual(
    restoredEngagements([old, current], new Date('2025-08-01Z')).map((p) => p.id),
    ['old', 'new'],
  );
  assert.deepEqual(
    restoredEngagements(
      [old, { ...current, starts_at: new Date('2025-08-01Z') }],
      new Date('2025-09-01Z'),
    ).map((p) => p.id),
    ['new'],
  );
  assert.equal(
    addCalendarMonths(new Date('2025-08-31Z'), 6).toISOString(),
    '2026-02-28T00:00:00.000Z',
  );
});
test('money accepts exact decimal strings only, rejecting float, exponent, excess scale and range', () => {
  assert.equal(money('9999999999999999.9999').toFixed(4), '9999999999999999.9999');
  for (const invalid of [100, 0.1, '1e3', 'NaN', '-1', '1.00001', '10000000000000000', '0'])
    assert.throws(() => money(invalid));
});

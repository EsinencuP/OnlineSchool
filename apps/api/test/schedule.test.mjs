import assert from 'node:assert/strict';
import { test } from 'node:test';
import { occurrences } from '../dist/modules/schedule/recurrence.js';

test('weekly wall time keeps local time across DST, producing distinct stable local dates', () => {
  const result = occurrences(
    'FREQ=WEEKLY;BYDAY=MO;BYHOUR=9;BYMINUTE=0',
    'Europe/Berlin',
    new Date('2026-03-23Z'),
    new Date('2026-04-07Z'),
    60,
  );
  assert.deepEqual(
    result.map((o) => o.start.toISOString()),
    ['2026-03-23T08:00:00.000Z', '2026-03-30T07:00:00.000Z', '2026-04-06T07:00:00.000Z'],
  );
  assert.equal(new Set(result.map((o) => o.date.toISOString())).size, 3);
});
test('nonexistent and ambiguous DST times require an explicit manager choice; unbounded rules are rejected', () => {
  for (const [from, to] of [
    ['2026-03-28Z', '2026-03-30Z'],
    ['2026-10-24Z', '2026-10-26Z'],
  ]) {
    assert.throws(
      () =>
        occurrences(
          'FREQ=WEEKLY;BYDAY=SU;BYHOUR=2;BYMINUTE=30',
          'Europe/Berlin',
          new Date(from),
          new Date(to),
          60,
        ),
      (e) => e.domain.code === 'AMBIGUOUS_OR_INVALID_LOCAL_TIME',
    );
  }
  assert.throws(
    () => occurrences('FREQ=DAILY', 'UTC', new Date('2026-01-01Z'), new Date('2028-01-01Z'), 60),
    (e) => e.domain.code === 'INVALID_RECURRENCE',
  );
});

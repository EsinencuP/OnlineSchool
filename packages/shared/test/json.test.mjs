import assert from 'node:assert/strict';
import test from 'node:test';
import { jsonValue } from '../dist/index.js';

test('JSON projection preserves decimal strings/date snapshots and isolates nested audit data', () => {
  const source = {
    amount: { toJSON: () => '9007199254740993.1234' },
    at: new Date('2026-11-01T10:00:00Z'),
    nested: { count: 2 },
    omitted: undefined,
  };
  const projected = jsonValue(source);
  assert.deepEqual(projected, {
    amount: '9007199254740993.1234',
    at: '2026-11-01T10:00:00.000Z',
    nested: { count: 2 },
  });
  source.nested.count = 3;
  assert.equal(projected.nested.count, 2);
});

test('unsupported JSON input preserves native failure behavior', () => {
  assert.throws(() => jsonValue({ quantity: 1n }), TypeError);
});

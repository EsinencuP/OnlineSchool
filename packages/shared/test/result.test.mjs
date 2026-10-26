import assert from 'node:assert/strict';
import test from 'node:test';
import { err, ok } from '../dist/index.js';

test('Result preserves values and error identity across the package boundary', () => {
  const value = { id: 'example' };
  const failure = new Error('expected');
  assert.equal(ok(value).value, value);
  assert.equal(err(failure).error, failure);
  assert.equal(ok(undefined).ok, true);
  assert.equal(err(null).ok, false);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { createDirectClient, createPoolClient, PrismaClient } from '../dist/index.js';

test('runtime and direct clients never fall back to the other connection', () => {
  assert.deepEqual(createPoolClient({ DIRECT_URL: 'postgresql://localhost/direct' }), {
    ok: false,
    error: { code: 'DATABASE_URL_MISSING', variable: 'DATABASE_URL' },
  });
  assert.deepEqual(createDirectClient({ DATABASE_URL: 'postgresql://localhost/pool' }), {
    ok: false,
    error: { code: 'DATABASE_URL_MISSING', variable: 'DIRECT_URL' },
  });
});

test('invalid URLs return sanitized errors without leaking credentials', () => {
  for (const value of [' ', 'invalid-secret', 'https://user:secret@localhost/db']) {
    const result = createPoolClient({ DATABASE_URL: value });
    assert.equal(result.ok, false);
    assert.equal(JSON.stringify(result).includes('secret'), false);
  }
});

test('both factories construct independently disposable Prisma clients offline', async () => {
  const environment = {
    DATABASE_URL: 'postgresql://localhost:6432/online_school',
    DIRECT_URL: 'postgresql://localhost:5432/online_school',
  };
  const pooled = createPoolClient(environment);
  const direct = createDirectClient(environment);
  assert.equal(pooled.ok, true);
  assert.equal(direct.ok, true);
  try {
    // Prisma returns a proxy; its public lifecycle methods are the runtime contract.
    assert.equal(typeof PrismaClient, 'function');
    assert.equal(typeof pooled.value.$connect, 'function');
    assert.equal(typeof direct.value.$connect, 'function');
    assert.notEqual(pooled.value, direct.value);
  } finally {
    await Promise.all([pooled.value.$disconnect(), direct.value.$disconnect()]);
  }
});

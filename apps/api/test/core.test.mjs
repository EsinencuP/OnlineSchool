import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Prisma } from '@online-school/db';
import { TransactionService } from '../dist/core/transaction/transaction.service.js';
import { payloadHash } from '../dist/core/idempotency/idempotency.module.js';
import { constantEqual } from '../dist/core/csrf/csrf.module.js';
import { cookie } from '../dist/core/http.js';
import { AppException, domainError } from '../dist/core/errors/domain-error.js';

test('canonical payload hash ignores object property ordering and keeps array order', () => {
  assert.equal(payloadHash({ a: 1, b: { x: 2, y: 3 } }), payloadHash({ b: { y: 3, x: 2 }, a: 1 }));
  assert.notEqual(payloadHash([1, 2]), payloadHash([2, 1]));
  assert.notEqual(payloadHash({ amount: '1' }), payloadHash({ amount: 1 }));
});
test('ambiguous cookies are rejected; token comparison handles different lengths', () => {
  assert.equal(cookie({ headers: { cookie: 'a=one; a=two' } }, 'a'), undefined);
  assert.equal(cookie({ headers: { cookie: 'other=one; a=two' } }, 'a'), 'two');
  assert.equal(constantEqual('aa', 'a'), false);
  assert.equal(constantEqual('aa', 'aa'), true);
});
test('serialization/deadlock retries stop at three total attempts', async () => {
  let attempts = 0;
  const db = {
    client: {
      $transaction: async (fn) => {
        attempts++;
        if (attempts < 3)
          throw new Prisma.PrismaClientKnownRequestError('synthetic', {
            code: 'P2034',
            clientVersion: '7.10.1',
          });
        return fn({});
      },
    },
  };
  const service = new TransactionService(db);
  assert.deepEqual(await service.runCritical(async () => 42), { ok: true, value: 42 });
  assert.equal(attempts, 3);
  attempts = 0;
  db.client.$transaction = async () => {
    attempts++;
    throw new Prisma.PrismaClientKnownRequestError('synthetic', {
      code: 'P2034',
      clientVersion: '7.10.1',
    });
  };
  assert.equal(
    (await service.runCritical(async () => 42)).error.code,
    'TRANSACTION_RETRY_EXHAUSTED',
  );
  assert.equal(attempts, 3);
  assert.equal(
    (await service.runCritical(async () => 42, { maxRetries: 4 })).error.code,
    'INVALID_RETRY_LIMIT',
  );
});
test('domain failures are returned without retry or driver detail leakage', async () => {
  let attempts = 0;
  const service = new TransactionService({
    client: {
      $transaction: async () => {
        attempts++;
        throw new AppException(domainError('SYNTHETIC_DENIAL', 403));
      },
    },
  });
  assert.equal((await service.runCritical(async () => 0)).error.code, 'SYNTHETIC_DENIAL');
  assert.equal(attempts, 1);
  const broken = new TransactionService({
    client: {
      $transaction: async () => {
        throw new Error('secret connection string');
      },
    },
  });
  assert.deepEqual(await broken.runCritical(async () => 0), {
    ok: false,
    error: domainError('DATABASE_ERROR', 503),
  });
});

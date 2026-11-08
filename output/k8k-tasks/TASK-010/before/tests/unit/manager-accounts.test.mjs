import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Prisma } from '../../packages/db/dist/index.js';
import { Passwords } from '../../apps/api/dist/modules/identity/passwords.js';
import { studentActivationSql } from '../../apps/api/dist/modules/finance/student-activation.sql.js';
import { databaseError } from '../../apps/api/dist/core/errors/database-error.js';
import { TransactionService } from '../../apps/api/dist/core/transaction/transaction.service.js';
import {
  IdempotencyService,
  payloadHash,
} from '../../apps/api/dist/core/idempotency/idempotency.module.js';
import { notificationContent } from '../../apps/api/dist/modules/notifications/notification.service.js';

test('CSPRNG temporary passwords meet identity policy and omit all ambiguous characters', async () => {
  const passwords = new Passwords(),
    hash = jest.spyOn(passwords, 'hash').mockResolvedValue({ ok: true, value: 'hash-in-identity' });
  const seen = new Set();
  for (let i = 0; i < 100; i++) {
    const result = await passwords.temporary();
    expect(result.ok).toBe(true);
    expect(result.value.plaintext).toMatch(/^[A-HJ-NP-Za-km-z2-9]{16}$/);
    expect(result.value.plaintext).toMatch(/\d/);
    expect(result.value.plaintext).toMatch(/[A-Za-z]/);
    seen.add(result.value.plaintext);
  }
  expect(seen.size).toBe(100);
  expect(hash.mock.calls.every(([, policy]) => policy === 'student')).toBe(true);
});
test('temporary hashes use the same scrypt verifier and reject altered plaintext', async () => {
  const passwords = new Passwords(),
    issued = await passwords.temporary();
  expect(issued.value.hash).toMatch(/^\$scrypt\$v=1\$N=131072,r=8,p=1\$/);
  expect(await passwords.verify(issued.value.plaintext, issued.value.hash)).toBe(true);
  expect(await passwords.verify(issued.value.plaintext + 'x', issued.value.hash)).toBe(false);
});
test('identity hash errors propagate as Results without issuing a credential', async () => {
  const passwords = new Passwords();
  jest
    .spyOn(passwords, 'hash')
    .mockResolvedValue({ ok: false, error: { code: 'PASSWORD_SERVICE_UNAVAILABLE', status: 503 } });
  expect(await passwords.temporary()).toMatchObject({
    ok: false,
    error: { code: 'PASSWORD_SERVICE_UNAVAILABLE' },
  });
});
test('first payment checks published student distributions, cumulative payment and a fresh limited admission', () => {
  const id = randomUUID(),
    sql = studentActivationSql(id, new Date());
  expect(sql.text).toContain('distribution_id');
  expect(sql.text).toContain('enrollment.student_id=');
  expect(sql.values).toContain(id);
  expect(sql.text).toContain('current_posted');
  expect(sql.text).toContain('published_at<=');
  expect(sql.text).toContain('confirmed_by_director_id IS NOT NULL');
  expect(sql.text).toContain('approved_by_director_id IS NOT NULL');
  expect(sql.text).toContain('facts.paid>=candidate.full_price');
  expect(sql.text).toContain('p.approved_at>=facts.latest_payment_at');
  expect(sql.text).toContain('p.max_lessons');
  expect(sql.text).not.toContain('receipt.student_id');
  // Account onboarding may precede the paid subscription's first lesson.
  expect(sql.text).not.toMatch(/candidate.valid_from<=|enrollment.status=|enrollment.valid_from<=/);
  expect(sql.text).not.toMatch(/INSERT INTO|UPDATE\s+ledger|DELETE FROM/i);
});
test('Result-wrapped SERIALIZABLE conflicts retry at the core boundary, at most three attempts', async () => {
  const conflict = new Prisma.PrismaClientKnownRequestError('retry', {
      code: 'P2034',
      clientVersion: '7.10.1',
    }),
    domain = databaseError(conflict);
  expect(domain.retryable).toBe(true);
  let attempts = 0;
  const db = { $transaction: jest.fn(async (fn) => fn({})) },
    service = new TransactionService({ client: db });
  const success = await service.runResult(async () =>
    ++attempts < 3 ? { ok: false, error: domain } : { ok: true, value: 'done' },
  );
  expect(success).toEqual({ ok: true, value: 'done' });
  expect(attempts).toBe(3);
  const exhausted = await service.runResult(async () => ({ ok: false, error: domain }));
  expect(exhausted).toMatchObject({ ok: false, error: { code: 'TRANSACTION_RETRY_EXHAUSTED' } });
  expect(db.$transaction).toHaveBeenCalledTimes(6);
});
test('core redacts secrets before persistence and cached replay skips the handler', async () => {
  const secret = 'ONLY-TRANSIENT-SECRET',
    records = new Map();
  const tx = {
    $queryRaw: jest.fn(async () => [{ now: new Date() }]),
    idempotencyRecord: {
      findUnique: jest.fn(async () => [...records.values()][0] ?? null),
      create: jest.fn(async ({ data }) => {
        records.set(data.id, data);
        return data;
      }),
      update: jest.fn(async ({ where, data }) => Object.assign(records.get(where.id), data)),
    },
    outboxEvent: { create: jest.fn(async () => ({})) },
  };
  const transactions = { runCritical: async (fn) => ({ ok: true, value: await fn(tx) }) },
    audit = { record: jest.fn(async () => {}) };
  const service = new IdempotencyService(transactions, audit),
    key = randomUUID(),
    actor = randomUUID(),
    onReplay = jest.fn();
  const input = {
    scope: actor,
    key,
    hash: 'request-hash',
    requestId: randomUUID(),
    command: {
      type: 'test.account',
      resourceType: 'AuthAccount',
      topic: 'test.account.v1',
      resultIdField: 'accountId',
      redactResultFields: ['temporaryPassword'],
    },
  };
  const handler = jest.fn(async () => ({
    accountId: randomUUID(),
    temporaryPassword: secret,
    passwordAlreadyIssued: true,
  }));
  const first = await service.execute(input, async () => actor, handler, onReplay);
  expect(first.value.temporaryPassword).toBeNull();
  expect(
    JSON.stringify([
      ...records.values(),
      audit.record.mock.calls,
      tx.outboxEvent.create.mock.calls,
    ]),
  ).not.toContain(secret);
  const replay = await service.execute(input, async () => actor, handler, onReplay);
  expect(replay.value).toEqual(first.value);
  expect(handler).toHaveBeenCalledTimes(1);
  expect(onReplay.mock.calls.map(([value]) => value)).toEqual([false, false, true]);
  const stored = [...records.values()][0];
  expect(stored.result_hash).toBe(payloadHash(stored.result));
});
test('account-created instruction contains a login and never accepts arbitrary secret fields', () => {
  const content = notificationContent('ACCOUNT_CREATED', {
    accountId: randomUUID(),
    loginEmail: 'student@example.invalid',
  });
  expect(content.body).toContain('student@example.invalid');
  expect(content.body).toContain('72');
  expect(content.payload).not.toHaveProperty('temporaryPassword');
  expect(() =>
    notificationContent('ACCOUNT_CREATED', {
      accountId: randomUUID(),
      loginEmail: 'student@example.invalid',
      temporaryPassword: 'do-not-store',
    }),
  ).toThrow();
});
test('migration reuses active-account uniqueness and strictly links new activation to a published distribution', async () => {
  const sql = await readFile(
    'packages/db/prisma/migrations/20261031110000_mgr03_student_credentials/migration.sql',
    'utf8',
  );
  expect(sql).not.toMatch(/CREATE UNIQUE INDEX.*student/i);
  expect(sql).toContain("interval '72 hours'");
  expect(sql).toContain('activation_distribution_id');
  expect(sql).toContain('d.payment_id=NEW.activation_payment_confirmation_id');
  expect(sql).toContain('le.published_at<=NEW.activated_at');
  expect(sql).toContain('assignment.valid_from<=approval_at');
  expect(sql).toContain('approval_at:=NEW.activated_at');
  expect(sql).toContain("event.topic='manager.student.account-created.v1'");
  expect(sql).not.toMatch(
    /GRANT\s+(?:INSERT|UPDATE|DELETE)[^;]+(?:ledger_entries|payment_receipts|payment_distributions)/i,
  );
});

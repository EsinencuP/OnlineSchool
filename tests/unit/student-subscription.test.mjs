import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { beforeEach, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import {
  StudentSubscriptionService,
  noSubscription,
  exactPaymentAmount,
  subscriptionDate,
} from '../../apps/api/dist/student/subscription/subscription.service.js';
import {
  SubscriptionQueryPipe,
  SubscriptionHistoryQueryPipe,
} from '../../apps/api/dist/student/subscription/subscription.dto.js';
import {
  subscriptionDetailsSql,
  subscriptionPaymentsSql,
  subscriptionLedgerSql,
} from '../../apps/api/dist/student/subscription/subscription.sql.js';
import { ActiveSubscriptionGuard } from '../../apps/api/dist/student/active-subscription.guard.js';
const student = {
    userId: randomUUID(),
    studentProfileId: randomUUID(),
    mustChangePassword: false,
    hasActiveAccess: false,
    subjectIds: [],
    timeZone: 'Europe/Chisinau',
  },
  id = randomUUID();
let db, service;
beforeEach(() => {
  db = { $queryRaw: jest.fn(async () => [{ forbidden: false, data: null }]) };
  service = new StudentSubscriptionService({ client: db });
});
test('NONE has null for every nullable field, no synthetic balance or plan', async () => {
  expect(await service.details(student, {})).toEqual(noSubscription());
  expect(noSubscription()).toEqual({
    subscriptionId: null,
    planName: null,
    lessonsTotal: null,
    lessonsRemaining: null,
    validFrom: null,
    validUntil: null,
    isFrozen: false,
    frozenFrom: null,
    frozenUntil: null,
    status: 'NONE',
  });
});
test('owned selection and strict page parsing use 1/20 defaults', () => {
  expect(new SubscriptionQueryPipe().transform({ subscriptionId: id.toUpperCase() })).toEqual({
    subscriptionId: id,
  });
  expect(new SubscriptionHistoryQueryPipe().transform({})).toEqual({ page: 1, pageSize: 20 });
});
test.each([
  { subscriptionId: 'bad' },
  { studentId: id },
  { subscriptionId: [id] },
  { page: '0' },
  { pageSize: '101' },
  { page: '1e2' },
])('invalid history query %j', (value) =>
  expect(() => new SubscriptionHistoryQueryPipe().transform(value)).toThrow(),
);
test.each(['details', 'payments', 'ledger'])(
  'foreign/nonexistent explicit subscription is forbidden: %s',
  async (method) => {
    db.$queryRaw.mockResolvedValue([{ forbidden: true, data: null }]);
    await expect(
      service[method](student, { subscriptionId: id, page: 1, pageSize: 20 }),
    ).rejects.toMatchObject({ domain: { code: 'SUBSCRIPTION_FORBIDDEN', status: 403 } });
  },
);
test.each([
  ['1500', '1500.00'],
  ['0.1', '0.10'],
  ['1.005', '1.005'],
  ['1.2345', '1.2345'],
  ['9999999999999999.9999', '9999999999999999.9999'],
])('Decimal %s serializes exactly as %s', (amount, expected) =>
  expect(exactPaymentAmount(amount)).toBe(expected),
);
test('date-only values use the student timezone, not the worker host timezone', () => {
  expect(subscriptionDate('2026-10-27T22:30:00Z', 'Europe/Chisinau')).toBe('2026-10-28');
  expect(subscriptionDate('2026-10-27T22:30:00Z', 'UTC')).toBe('2026-10-27');
});
test('history preserves actual MDL and only serializes known DTO money as strings', async () => {
  db.$queryRaw.mockResolvedValue([
    {
      forbidden: false,
      data: {
        items: [
          {
            paymentId: id,
            confirmedAt: '2026-10-27T12:00:00+00:00',
            amount: '1500',
            currency: 'MDL',
            description: 'Payment',
            lessonsAdded: 8,
          },
        ],
        total: 1,
      },
    },
  ]);
  const result = await service.payments(student, { page: 1, pageSize: 20 });
  expect(result.items[0]).toMatchObject({
    amount: '1500.00',
    currency: 'MDL',
    confirmedAt: '2026-10-27T12:00:00.000Z',
  });
});
test('ledger quantities remain Decimal strings; dates are date-only', async () => {
  db.$queryRaw.mockResolvedValue([
    {
      forbidden: false,
      data: {
        items: [
          {
            entryId: id,
            entryDate: '2026-10-27T12:00:00Z',
            type: 'DEDUCTION',
            balanceBefore: '10',
            balanceAfter: '9',
            description: 'Lesson',
            lessonId: id,
          },
        ],
        total: 1,
      },
    },
  ]);
  const result = await service.ledger(student, { page: 1, pageSize: 20 });
  expect(result.items[0]).toMatchObject({
    balanceBefore: '10',
    balanceAfter: '9',
    entryDate: '2026-10-27',
  });
});
test('query derives paid rights independently of bookings, temporary admission and money totals', () => {
  const q = subscriptionDetailsSql(student.studentProfileId, { subscriptionId: id }, new Date());
  expect(q.values).toContain(student.studentProfileId);
  expect(q.values).toContain(id);
  expect(q.sql).toContain("g.basis='CONFIRMED_PAYMENT'");
  expect(q.sql).toContain('>=s.full_price');
  expect(q.sql).not.toContain('temporary_access_permissions');
  expect(q.sql).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/);
});
test('payment projection uses owned allocation amount, both confirmations and current publication', () => {
  const q = subscriptionPaymentsSql(
    student.studentProfileId,
    { subscriptionId: id, page: 1, pageSize: 20 },
    new Date(),
  );
  expect(q.sql).toContain('a.amount::text');
  expect(q.sql).not.toContain('r.amount::text');
  expect(q.sql).toContain('r.confirmed_by_director_id IS NOT NULL');
  expect(q.sql).toContain('d.approved_by_director_id IS NOT NULL');
  expect(q.sql).toContain('current_posted');
});
test('ledger replays all facts before pagination, keeps stored deduction snapshots and freeze history', () => {
  const q = subscriptionLedgerSql(student.studentProfileId, { page: 2, pageSize: 20 }, new Date());
  expect(q.sql).toContain('ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW');
  expect(q.sql).toContain('coalesce(stored_before,after-delta)');
  expect(q.sql).toContain('subscription_freeze_history');
  expect(q.sql).toContain('CONSUMPTION_CANCELLATION');
  expect(q.values.filter((v) => typeof v === 'number')).toEqual([20, 20]);
});
test.each(['', '/payments', '/ledger'])(
  'only authenticated GET subscription view is exempt from active access: %s',
  async (suffix) => {
    const guard = new ActiveSubscriptionGuard({
      denial: async () => ({ ok: true, value: undefined }),
    });
    const req = {
      method: 'GET',
      originalUrl: '/api/v1/student/subscription' + suffix,
      studentCtx: student,
    };
    const ctx = { switchToHttp: () => ({ getRequest: () => req }) };
    expect(await guard.canActivate(ctx)).toBe(true);
    req.method = 'POST';
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({ domain: { status: 402 } });
  },
);
test('subscription exemption never bypasses first password change or protects unrelated routes', async () => {
  const guard = new ActiveSubscriptionGuard({
    denial: async () => ({ ok: true, value: undefined }),
  });
  const req = {
    method: 'GET',
    originalUrl: '/api/v1/student/subscription',
    studentCtx: { ...student, mustChangePassword: true },
  };
  const ctx = { switchToHttp: () => ({ getRequest: () => req }) };
  await expect(guard.canActivate(ctx)).rejects.toMatchObject({
    domain: { code: 'MUST_CHANGE_PASSWORD' },
  });
  req.studentCtx = student;
  req.originalUrl = '/api/v1/student/subscription/anything';
  await expect(guard.canActivate(ctx)).rejects.toMatchObject({ domain: { status: 402 } });
});

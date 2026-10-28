import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { beforeEach, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../packages/db/dist/index.js';
import {
  StudentHistoryService,
  DISPUTE_WINDOW_MS,
} from '../../apps/api/dist/student/history/history.service.js';
import { StudentDisputeService } from '../../apps/api/dist/student/history/dispute.service.js';
import { HistoryQueryPipe } from '../../apps/api/dist/student/history/history.dto.js';
import { EntitlementsService } from '../../apps/api/dist/modules/finance/entitlements.service.js';
import { FinanceLedger } from '../../apps/api/dist/modules/finance/finance-ledger.service.js';
const student = {
    userId: randomUUID(),
    studentProfileId: randomUUID(),
    hasActiveAccess: true,
    mustChangePassword: false,
    subjectIds: [],
  },
  fixed = new Date('2026-10-27T12:00:00Z');
let row, history, client, ctx, tasks, disputes;
beforeEach(() => {
  row = {
    id: randomUUID(),
    scheduled_at: new Date(+fixed - 86400000),
    duration_minutes: 55,
    teacher_name: 'Actual teacher',
    subject_name: 'Math',
    attendance_status: 'COMPLETED',
    consumption_id: randomUUID(),
    balance_before: '10',
    balance_after: '9',
    has_open_dispute: false,
    can_dispute: true,
    total: 1,
  };
  client = { $queryRaw: jest.fn(async () => [row]) };
  history = new StudentHistoryService({ client });
  ctx = {
    actor: { accountId: student.userId },
    operationId: randomUUID(),
    tx: {
      $queryRaw: jest.fn(async (parts) =>
        parts.join('').includes('FOR UPDATE')
          ? [{ id: row.id, student_id: student.studentProfileId, scheduled_at: row.scheduled_at }]
          : [{ now: fixed }],
      ),
      crmTask: { findFirst: jest.fn(async () => null) },
    },
  };
  tasks = { create: jest.fn(async () => ({ crmTaskId: randomUUID(), status: 'CREATED' })) };
  disputes = new StudentDisputeService({ eligibility: jest.fn(async () => row) }, tasks);
});
test('quantitative balances are exact Decimal strings, with no money/account totals', async () => {
  row.balance_before = new Prisma.Decimal('9007199254740993');
  row.balance_after = new Prisma.Decimal('9007199254740992');
  const result = await history.list(student, { page: 1, pageSize: 20 });
  expect(result.value.items[0]).toMatchObject({
    balanceBefore: '9007199254740993',
    balanceAfter: '9007199254740992',
    durationMinutes: 55,
    lessonDeducted: true,
    attendanceStatus: 'COMPLETED',
  });
  expect(JSON.parse(JSON.stringify(result.value)).items[0].balanceBefore).toBe('9007199254740993');
});
test('legacy published charges keep unknown balances null without losing their deduction', async () => {
  row.balance_before = null;
  row.balance_after = null;
  expect((await history.list(student, { page: 1, pageSize: 20 })).value.items[0]).toMatchObject({
    lessonDeducted: true,
    balanceBefore: null,
    balanceAfter: null,
  });
});
test('empty pages retain true total, and SQL is scoped with stable descending order', async () => {
  client.$queryRaw.mockResolvedValue([{ id: null, total: 42 }]);
  expect((await history.list(student, { page: 100, pageSize: 20 })).value).toEqual({
    items: [],
    total: 42,
    page: 100,
    pageSize: 20,
  });
  const sql = client.$queryRaw.mock.calls[0][0];
  expect(sql.values).toContain(student.studentProfileId);
  expect(sql.sql).toContain('ORDER BY scheduled_at DESC,id DESC');
});
test('DB errors are sanitized', async () => {
  client.$queryRaw.mockRejectedValue(Error('private connection password'));
  const result = await history.list(student, { page: 1, pageSize: 20 });
  expect(result.error.code).toBe('STUDENT_HISTORY_UNAVAILABLE');
  expect(JSON.stringify(result)).not.toContain('private');
});
test.each([
  { page: '0' },
  { pageSize: '101' },
  { page: ['1', '2'] },
  { page: '1.1' },
  { period: 'archive' },
  { studentProfileId: 'another' },
])('history query rejects invalid/scope-selecting input: %j', (input) => {
  expect(() => new HistoryQueryPipe().transform(input)).toThrow();
});
test('history pagination defaults match the declared contract', () => {
  expect(new HistoryQueryPipe().transform({})).toEqual({ page: 1, pageSize: 20 });
});
test('dispute creates only a typed, lesson-addressed CRM task', async () => {
  expect(
    (
      await disputes.create(ctx, student, row.id, {
        description: 'I attended this particular lesson',
      })
    ).status,
  ).toBe('CREATED');
  expect(tasks.create).toHaveBeenCalledWith(
    ctx,
    {
      type: 'ATTENDANCE_DISPUTE',
      lessonId: row.id,
      studentProfileId: student.studentProfileId,
      payload: { description: 'I attended this particular lesson' },
    },
    fixed,
  );
});
test.each(['OPEN', 'IN_PROGRESS'])(
  'an existing %s case is 409 before a new write',
  async (status) => {
    ctx.tx.crmTask.findFirst.mockResolvedValue({ id: randomUUID(), status });
    await expect(
      disputes.create(ctx, student, row.id, { description: 'I dispute this lesson charge' }),
    ).rejects.toMatchObject({ domain: { status: 409, code: 'ATTENDANCE_DISPUTE_ALREADY_OPEN' } });
    expect(tasks.create).not.toHaveBeenCalled();
  },
);
test.each([DISPUTE_WINDOW_MS, DISPUTE_WINDOW_MS - 1])(
  'exact 30-day window accepts age %s milliseconds',
  async (age) => {
    row.scheduled_at = new Date(+fixed - age);
    expect(
      (await disputes.create(ctx, student, row.id, { description: 'I dispute this lesson charge' }))
        .status,
    ).toBe('CREATED');
  },
);
test.each([DISPUTE_WINDOW_MS + 1, -1])(
  'old/future lesson age %s milliseconds is rejected',
  async (age) => {
    row.scheduled_at = new Date(+fixed - age);
    await expect(
      disputes.create(ctx, student, row.id, { description: 'I dispute this lesson charge' }),
    ).rejects.toMatchObject({ domain: { status: 422, code: 'DISPUTE_WINDOW_CLOSED' } });
  },
);
test('cancelled/unpublished/nonexistent consumption cannot be disputed', async () => {
  row.consumption_id = null;
  await expect(
    disputes.create(ctx, student, row.id, { description: 'I dispute this lesson charge' }),
  ).rejects.toMatchObject({ domain: { code: 'PUBLISHED_LESSON_DEDUCTION_REQUIRED' } });
});
test('another student lesson is 403 even when a service is called directly', async () => {
  ctx.tx.$queryRaw.mockResolvedValue([
    { id: row.id, student_id: randomUUID(), scheduled_at: row.scheduled_at },
  ]);
  await expect(
    disputes.create(ctx, student, row.id, { description: 'I dispute this lesson charge' }),
  ).rejects.toMatchObject({ domain: { status: 403 } });
});
test.each(['short', ' '.repeat(20), 'x'.repeat(1001)])(
  'invalid dispute description cannot create a case: length %s',
  async (description) => {
    await expect(disputes.create(ctx, student, row.id, { description })).rejects.toBeDefined();
    expect(tasks.create).not.toHaveBeenCalled();
  },
);
test('finance consumption captures the entire subscription balance before/after with exact decimals', async () => {
  const grantId = randomUUID(),
    subId = randomUUID(),
    enId = randomUUID(),
    lessonId = randomUUID();
  const access = {
    staff: async () => randomUUID(),
    student: async () => {},
    subscription: async () => ({
      sub: { id: subId, enrollment_id: enId },
      enrollment: { student_id: student.studentProfileId },
    }),
  };
  const ledger = {
    period: async () => randomUUID(),
    event: jest.fn(async () => ({ id: randomUUID() })),
  };
  const tx = {
    $queryRaw: jest.fn(async (parts) =>
      parts.join('').includes('AS balance') ? [{ balance: '9007199254740993' }] : [{ now: fixed }],
    ),
    entitlementGrant: { findUnique: async () => ({ id: grantId, subscription_id: subId }) },
    lessonOccurrence: {
      findUnique: async () => ({
        status: 'CONDUCTED',
        enrollment_id: enId,
        scheduled_at: row.scheduled_at,
      }),
    },
    lessonActualOutcome: { findUnique: async () => ({ confirmed_at: row.scheduled_at }) },
    entitlementConsumption: {
      create: jest.fn(async ({ data }) => ({ id: randomUUID(), ...data })),
    },
  };
  const service = new EntitlementsService(access, ledger);
  jest.spyOn(service, 'remaining').mockResolvedValueOnce(10).mockResolvedValueOnce(9);
  await service.consume(
    { tx, operationId: randomUUID() },
    { grantId, studentId: student.studentProfileId, lessonId },
  );
  expect(ledger.event.mock.calls[0][2].before.toString()).toBe('9007199254740993');
  expect(ledger.event.mock.calls[0][2].after.toString()).toBe('9007199254740992');
  expect(
    tx.$queryRaw.mock.calls.find(([p]) => p.join('').includes('AS balance')).slice(1),
  ).toContain(subId);
});
test('finance ledger persists quantitative snapshots separately from monetary balance_snapshot', async () => {
  const access = { staff: async () => randomUUID() },
    events = { record: async () => {} },
    publisher = {
      publishInTransaction: jest.fn(async () => ({ ok: true, value: { id: randomUUID() } })),
    };
  const service = new FinanceLedger(publisher, access, events);
  jest.spyOn(service, 'period').mockResolvedValue(randomUUID());
  const tx = {
    $queryRaw: async () => [{ now: fixed }],
    ledgerEntry: {
      findUnique: async () => null,
      create: jest.fn(async ({ data }) => ({ id: randomUUID(), ...data })),
    },
    ledgerLine: { createMany: async () => {} },
  };
  const before = new Prisma.Decimal('10'),
    after = new Prisma.Decimal('9');
  await service.post(
    { tx },
    { id: randomUUID() },
    [
      {
        currency: 'MDL',
        amount: new Prisma.Decimal('100'),
        account_type: 'CUSTOMER_ADVANCE',
        direction: 'DEBIT',
      },
    ],
    undefined,
    undefined,
    { before, after },
  );
  expect(tx.ledgerEntry.create.mock.calls[0][0].data).toMatchObject({
    entitlement_balance_before: before,
    entitlement_balance_after: after,
  });
  expect(tx.ledgerEntry.create.mock.calls[0][0].data).not.toHaveProperty('balance_snapshot');
});

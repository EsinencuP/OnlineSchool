import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { expect, jest, test } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import { ESLint } from 'eslint';
import { Prisma } from '../../packages/db/dist/index.js';
import { PolicyService } from '../../apps/api/dist/core/policy/policy.service.js';
import { ManagerPaymentWorkflow } from '../../apps/api/dist/modules/finance/manager-payments/workflow.service.js';
import { positiveReceiptAmount } from '../../apps/api/dist/modules/finance/receipt-policy.js';

test('receipt arithmetic uses Decimal and retains four fractional digits', () => {
  expect(new Prisma.Decimal('0.1').add('0.2').toFixed(4)).toBe('0.3000');
  expect(positiveReceiptAmount('999999999999.9999')).toBe(true);
  expect(positiveReceiptAmount('0.00001')).toBe(false);
});

test('core policy requires director approval even for the manager own contact', async () => {
  const policy = new PolicyService({});
  policy.canAccessStudent = jest.fn(async () => ({ ok: true }));
  const actor = { kind: 'STAFF', roles: ['MANAGER'], mfaCompleted: true, recoveryOnly: false };
  expect((await policy.managerPaymentPublication(actor, 'own', {})).error.code).toBe(
    'APPROVAL_REQUIRED',
  );
  expect(policy.hasPermission(actor, 'payment:confirm')).toBe(false);
  expect(policy.hasPermission(actor, 'distribution:approve')).toBe(false);
  expect(policy.hasPermission(actor, 'ledger:publish')).toBe(false);
  policy.canAccessStudent.mockResolvedValue({ ok: false, error: { code: 'FORBIDDEN' } });
  expect((await policy.managerPaymentPublication(actor, 'foreign', {})).error.code).toBe(
    'PAYMENT_NOT_FOUND',
  );
  for (const roles of [
    ['DIRECTOR'],
    ['TEACHER'],
    ['STUDENT'],
    ['TECH_OPERATOR'],
    ['MANAGER', 'DIRECTOR'],
  ])
    expect(
      (await policy.managerPaymentPublication({ ...actor, roles }, 'own', {})).error.code,
    ).toBe('FORBIDDEN_ROLE');
});

test('adjustment port bounds the original charge and delegates approval to Finance', async () => {
  const source = {
    quantity: 2,
    cancelled_at: null,
    subscription_ref: { original_paid_unit_price: new Prisma.Decimal('125.0001') },
  };
  const findFirst = jest.fn(async () => source);
  const tx = { entitlementConsumption: { findFirst } };
  const workflow = new ManagerPaymentWorkflow({}, {}, {});
  const input = {
    studentId: 'own',
    originalConsumptionId: 'charge',
    reason: 'dispute',
    amount: '250.0002',
    lessons: 2,
  };
  const call = (extra = {}) => workflow.adjustment({ tx }, { ...input, ...extra });
  expect((await call()).error.code).toBe('APPROVAL_REQUIRED');
  expect(findFirst.mock.calls[0][0].where.subscription_ref.enrollment_ref.student_id).toBe('own');
  expect((await call({ lessons: 0 })).error.code).toBe('APPROVAL_REQUIRED');
  for (const extra of [
    { amount: '250.0003' },
    { lessons: 3 },
    { lessons: 0, amount: undefined },
    { amount: '-1' },
  ])
    expect((await call(extra)).error.code).toBe('DISPUTE_REFUND_EXCEEDS_CHARGE');
  source.cancelled_at = new Date();
  expect((await call()).error.code).toBe('CHARGE_ALREADY_REVERSED');
  findFirst.mockResolvedValue(null);
  expect((await call()).error.code).toBe('CHARGE_NOT_FOUND');
});

const eslint = new ESLint();
const lint = async (source, name = 'probe.ts') =>
  (
    await eslint.lintText(source, {
      filePath: `apps/api/src/modules/manager/${name}`,
    })
  )[0].messages;
test.each([
  "import { PaymentsService } from '../../finance/payments.service.js';",
  "import { ManagerPaymentWorkflow as W } from '../../finance/manager-payments/workflow.service.js';",
  "const w = import('../../finance/manager-payments/workflow.service.js');",
  "export { ManagerSubscriptionLifecycle } from '../../finance/manager-subscriptions/lifecycle.service.js';",
])('financial domain import bypass is rejected: %s', async (source) => {
  expect((await lint(source)).some((m) => m.ruleId === 'manager/finance-facade-only')).toBe(true);
});
test('canonical facade is the only adapter allowed to import mutation services', async () => {
  expect(
    (
      await lint(
        "import { ManagerPaymentWorkflow } from '../../finance/manager-payments/workflow.service.js';",
        'finance/manager-finance.facade.ts',
      )
    ).filter((m) => m.ruleId === 'manager/finance-facade-only'),
  ).toEqual([]);
});
test.each([
  'paymentReceipt',
  'paymentDistribution',
  'subscription',
  'entitlementGrant',
  'temporaryAccessPermission',
])('direct manager %s writes fail architecture checks', async (model) => {
  expect(
    (await lint(`tx.${model}.create({});`)).some((m) => m.ruleId === 'manager/no-protected-writes'),
  ).toBe(true);
});
test('numeric pagination total does not permit numeric money totals', async () => {
  expect(
    (
      await lint(
        'class ReceiptPageDto { items!: string[]; total!: number; page!: number; pageSize!: number; }',
      )
    ).filter((m) => m.ruleId === 'manager/no-money-number'),
  ).toEqual([]);
  expect(
    (await lint('class Money { total!: number; }')).some(
      (m) => m.ruleId === 'manager/no-money-number',
    ),
  ).toBe(true);
});
test('migration preserves director checks and immutable receipts without fabricating historical metadata', async () => {
  const sql = await readFile(
    'packages/db/prisma/migrations/20261031130000_mgr05_receipts/migration.sql',
    'utf8',
  );
  expect(sql).toContain('public.t03_assert_director');
  expect(sql).toContain('ck_confirmed_payment_immutable');
  expect(sql).toContain('ck_mgr05_rejected_immutable');
  expect(sql).toContain('uq_mgr05_method_reference');
  expect(sql).toContain('Distribution origin is immutable');
  expect(sql).not.toMatch(/UPDATE payment_receipts SET|DEFAULT 'CASH'/i);
});

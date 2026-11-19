import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { Decimal } from '../../apps/api/dist/modules/finance/finance-common.js';
import { FinanceLedger } from '../../apps/api/dist/modules/finance/finance-ledger.service.js';
import { quoteRefund } from '../../apps/api/dist/modules/finance/refunds/refund-quote.js';
import {
  RefundsService,
  refundSettlement,
} from '../../apps/api/dist/modules/finance/refunds/refunds.service.js';

const facts = {
  currency: 'MDL',
  unitPrice: '315.0000',
  fullPrice: '2520.0000',
  lessonCount: 8,
  allocations: [
    { id: randomUUID(), paymentId: randomUUID(), currency: 'MDL', amount: '2520.0000' },
  ],
  advances: [{ currency: 'MDL', amount: '1575.0000' }],
  grants: [
    { id: randomUUID(), remaining: 2 },
    { id: randomUUID(), remaining: 3 },
  ],
  charges: [
    { lessonId: randomUUID(), consumptionId: randomUUID(), quantity: 3, category: 'CONDUCTED' },
  ],
  holds: [],
};

test('uses the original discounted price and caps rights by attributed advance', () => {
  const quote = quoteRefund(facts);
  expect(quote).toMatchObject({ eligibleQuantity: 5, maximumAmount: '1575.0000' });
  expect(quoteRefund(facts).revision).toBe(quote.revision);
  const capped = quoteRefund({ ...facts, advances: [{ currency: 'MDL', amount: '1259.9999' }] });
  expect(capped).toMatchObject({ eligibleQuantity: 3, maximumAmount: '945.0000' });
  expect(capped.revision).not.toBe(quote.revision);
});

test.each([
  ['unreconciled lesson', { holds: [{ id: randomUUID(), reason: 'DISPUTED_LESSON' }] }],
  ['unmatched original tariff', { fullPrice: '2300.0000' }],
  ['mixed currency', { advances: [{ currency: 'EUR', amount: '1575.0000' }] }],
])('holds the proposal when the case has %s', (_case, fields) => {
  expect(quoteRefund({ ...facts, ...fields })).toMatchObject({
    eligibleQuantity: 0,
    maximumAmount: '0.0000',
  });
});

function fixture() {
  const periodId = randomUUID();
  const staffId = randomUUID();
  const now = new Date('2026-11-18T14:00:00Z');
  const request = {
    id: randomUUID(),
    subscription_id: randomUUID(),
    student_id: randomUUID(),
    status: 'APPROVED',
  };
  const refund = {
    id: randomUUID(),
    subscription_id: request.subscription_id,
    version: 1,
    paid_unused_quantity: 4,
    calculated_amount: new Decimal('1260'),
    quote_revision: quoteRefund(facts).revision,
    approved_amount: null,
    approved_by_director_at: null,
    declined_at: null,
    currency: 'MDL',
  };
  const transfers = [];
  const tx = {
    $queryRaw: jest.fn(async (sql) => {
      if (sql.sql?.includes('SELECT jsonb_build_object')) return [{ facts }];
      if (sql.join?.('').includes('clock_timestamp')) return [{ now }];
      return [];
    }),
    managerRequest: { findFirst: jest.fn(async () => ({ ...request, refund })) },
    refundRecord: {
      update: jest.fn(async ({ data }) => Object.assign(refund, data)),
    },
    entitlementAdjustment: { create: jest.fn() },
    refundTransfer: {
      findMany: jest.fn(async () => transfers),
      create: jest.fn(async ({ data }) => {
        const row = { id: randomUUID(), status: 'REPORTED', ...data };
        transfers.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }) =>
        Object.assign(
          transfers.find((r) => r.id === where.id),
          data,
        ),
      ),
    },
  };
  const access = { staff: jest.fn(async () => staffId), student: jest.fn() };
  const ledger = { event: jest.fn(), period: jest.fn(async () => periodId) };
  const ctx = { tx, actor: { role: 'DIRECTOR', mfaCompleted: true }, operationId: randomUUID() };
  return {
    service: new RefundsService({}, access, ledger),
    request,
    refund,
    transfers,
    ctx,
    access,
    tx,
    ledger,
    periodId,
    now,
  };
}

test('the director approves a current version and retires exactly the approved grant quantity', async () => {
  const { service, request, refund, ctx, tx, ledger, periodId } = fixture();
  const command = {
    decision: 'APPROVE',
    version: 1,
    amount: '1260.0000',
    basis: 'Original paid rights confirmed',
  };
  await expect(service.decide(ctx, request.id, command)).resolves.toMatchObject({
    id: refund.id,
    status: 'APPROVED',
  });
  expect(
    tx.entitlementAdjustment.create.mock.calls.map(([{ data }]) => [
      data.grant_id,
      data.delta_quantity,
      data.financial_period_id,
    ]),
  ).toEqual(facts.grants.map(({ id }) => [id, -2, periodId]));
  expect(ledger.event).toHaveBeenCalledWith(
    ctx,
    expect.objectContaining({ refund_approval_id: refund.id }),
  );
  await expect(service.decide(ctx, request.id, command)).rejects.toMatchObject({
    domain: { code: 'REFUND_NOT_EDITABLE' },
  });
  expect(ledger.event).toHaveBeenCalledTimes(1);
});

test('version, intake approval, amount and live quote are all checked before posting', async () => {
  const { service, request, refund, ctx, tx, ledger } = fixture();
  const command = {
    decision: 'APPROVE',
    version: 1,
    amount: '1260',
    basis: 'Original paid rights confirmed',
  };
  await expect(service.decide(ctx, request.id, { ...command, version: 2 })).rejects.toMatchObject({
    domain: { code: 'REFUND_VERSION_CHANGED' },
  });
  request.status = 'PENDING';
  await expect(service.decide(ctx, request.id, command)).rejects.toMatchObject({
    domain: { code: 'REFUND_REQUEST_NOT_ACCEPTED' },
  });
  request.status = 'APPROVED';
  await expect(
    service.decide(ctx, request.id, { ...command, amount: '1260.01' }),
  ).rejects.toMatchObject({ domain: { code: 'REFUND_AMOUNT_MISMATCH' } });
  refund.quote_revision = 'stale';
  await expect(service.decide(ctx, request.id, command)).rejects.toMatchObject({
    domain: { code: 'REFUND_QUOTE_CHANGED' },
  });
  expect(tx.refundRecord.update).not.toHaveBeenCalled();
  expect(ledger.event).not.toHaveBeenCalled();
});

test('a claimed financial command requires a director with verified MFA', async () => {
  const { service, request, ctx, tx } = fixture();
  ctx.actor.mfaCompleted = false;
  await expect(service.decide(ctx, request.id, {})).rejects.toMatchObject({
    domain: { code: 'FORBIDDEN' },
  });
  ctx.actor = { role: 'MANAGER', mfaCompleted: true };
  await expect(service.reviewTransfer(ctx, request.id, randomUUID(), {})).rejects.toMatchObject({
    domain: { code: 'FORBIDDEN' },
  });
  expect(tx.managerRequest.findFirst).not.toHaveBeenCalled();
});

test('a zero-amount proposal can be declined with a reason and produces no financial writes', async () => {
  const { service, request, refund, ctx, ledger, tx } = fixture();
  refund.paid_unused_quantity = 0;
  refund.calculated_amount = new Decimal(0);
  await expect(
    service.decide(ctx, request.id, {
      decision: 'APPROVE',
      version: 1,
      amount: '0',
      basis: 'No available rights',
    }),
  ).rejects.toMatchObject({ domain: { code: 'REFUND_RIGHTS_UNAVAILABLE' } });
  await expect(
    service.decide(ctx, request.id, {
      decision: 'DECLINE',
      version: 1,
      basis: 'No available rights',
    }),
  ).resolves.toMatchObject({ status: 'DECLINED' });
  expect(tx.entitlementAdjustment.create).not.toHaveBeenCalled();
  expect(ledger.event).not.toHaveBeenCalled();
});

test('director reconciliation ignores failed attempts, reopens returned money and checks both caps', async () => {
  const { service, request, refund, transfers, ctx, access, ledger, now } = fixture();
  refund.approved_amount = new Decimal('1260');
  refund.approved_by_director_at = new Date('2026-11-18T10:00:00Z');
  const manager = { ...ctx, actor: { role: 'MANAGER', mfaCompleted: true } };
  const report = (fields) =>
    service.report(manager, request.student_id, request.id, {
      amount: '500',
      kind: 'PAID',
      occurredAt: now.toISOString(),
      channel: 'BANK',
      reference: randomUUID(),
      evidence: 'bank-case:82',
      ...fields,
    });
  const verify = ({ id }) =>
    service.reviewTransfer(ctx, request.id, id, {
      decision: 'VERIFY',
      basis: 'Statement independently checked',
    });
  const success = await report({});
  const failed = await report({ kind: 'FAILED' });
  expect(access.student).toHaveBeenCalledWith(manager, request.student_id);
  expect(ledger.event).not.toHaveBeenCalled();
  await verify(success);
  await verify(failed);
  expect(ledger.event).toHaveBeenCalledTimes(1);
  expect(refundSettlement(refund.approved_amount, transfers).net.toFixed(4)).toBe('500.0000');

  const attemptedOverpay = await report({ amount: '760.0001' });
  await expect(verify(attemptedOverpay)).rejects.toMatchObject({
    domain: { code: 'REFUND_TRANSFER_LIMIT' },
  });
  await service.reviewTransfer(ctx, request.id, attemptedOverpay.id, {
    decision: 'REJECT',
    basis: 'Requires a corrected statement reference',
  });
  await verify(await report({ amount: '760.0000' }));
  expect(refundSettlement(refund.approved_amount, transfers).remaining.toFixed(4)).toBe('0.0000');

  const returned = await report({
    kind: 'RETURNED',
    originalTransferId: success.id,
    amount: '150',
  });
  await verify(returned);
  expect(ledger.event).toHaveBeenLastCalledWith(
    ctx,
    expect.objectContaining({ refund_transfer_id: returned.id, basis: 'VERIFIED_REFUND_RETURN' }),
  );
  const overReturn = await report({
    kind: 'RETURNED',
    originalTransferId: success.id,
    amount: '350.01',
  });
  await expect(verify(overReturn)).rejects.toMatchObject({
    domain: { code: 'REFUND_TRANSFER_LIMIT' },
  });
  const result = refundSettlement(refund.approved_amount, transfers);
  expect(result.net.toFixed(4)).toBe('1110.0000');
  expect(result.remaining.toFixed(4)).toBe('150.0000');
  expect(result.pendingReview).toBe(true);
});

test('publishes liability before cash movement, then reverses cash direction only on a verified return', async () => {
  const ledger = new FinanceLedger({}, {}, {});
  const amount = new Decimal(315);
  const transfer = { kind: 'PAID', status: 'VERIFIED', amount, refund: { currency: 'MDL' } };
  const tx = {
    refundRecord: { findUniqueOrThrow: async () => ({ approved_amount: amount, currency: 'MDL' }) },
    refundTransfer: { findUniqueOrThrow: async () => transfer },
  };
  const lines = async (document) =>
    (await ledger.expected(tx, document)).map((l) => [
      l.account_type,
      l.direction,
      l.amount.toFixed(4),
    ]);
  expect(await lines({ refund_approval_id: randomUUID() })).toEqual([
    ['CUSTOMER_ADVANCE', 'DEBIT', '315.0000'],
    ['REFUND_PAYABLE', 'CREDIT', '315.0000'],
  ]);
  expect(await lines({ refund_transfer_id: randomUUID() })).toEqual([
    ['REFUND_PAYABLE', 'DEBIT', '315.0000'],
    ['CASH', 'CREDIT', '315.0000'],
  ]);
  transfer.kind = 'RETURNED';
  expect(await lines({ refund_transfer_id: randomUUID() })).toEqual([
    ['CASH', 'DEBIT', '315.0000'],
    ['REFUND_PAYABLE', 'CREDIT', '315.0000'],
  ]);
  transfer.kind = 'FAILED';
  await expect(lines({ refund_transfer_id: randomUUID() })).rejects.toMatchObject({
    domain: { code: 'REFUND_TRANSFER_NOT_POSTABLE' },
  });
});

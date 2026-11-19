import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { PayrollService } from '../../apps/api/dist/modules/finance/payroll.service.js';
import { Decimal } from '../../apps/api/dist/modules/finance/finance-common.js';
import { AppException, domainError } from '../../apps/api/dist/core/errors/domain-error.js';

function fixture(status = 'UNKNOWN') {
  const attempt = {
    id: randomUUID(),
    obligation_id: randomUUID(),
    provider: 'manual-bank',
    amount: new Decimal('120.0000'),
    currency: 'MDL',
    status,
  };
  const payoutId = randomUUID();
  const staffId = randomUUID();
  const ledgerEntryId = randomUUID();
  const obligation = { id: attempt.obligation_id, amount: new Decimal('150.0000') };
  const tx = {
    $queryRaw: jest.fn(async (sql) => {
      if (sql.join('').includes('clock_timestamp()')) return [{ now: new Date() }];
      if (sql.join('').includes('sum(p.amount)')) return [{ paid: '50.0000' }];
      return [];
    }),
    payoutAttempt: {
      findUnique: jest.fn(async () => ({ ...attempt })),
      update: jest.fn(async ({ data }) => Object.assign(attempt, data)),
    },
    confirmedPayout: {
      create: jest.fn(async ({ data }) => ({ ...data, id: payoutId })),
    },
  };
  const audit = { record: jest.fn() };
  const access = {
    staff: jest.fn(async ({ actor }, director) => {
      if (director && !actor.roles.includes('DIRECTOR'))
        throw new AppException(domainError('FORBIDDEN', 403));
      return staffId;
    }),
  };
  const ledger = { period: jest.fn(), event: jest.fn(async () => ({ id: ledgerEntryId })) };
  const service = new PayrollService(access, ledger, {}, audit);
  service.obligation = jest.fn(async () => obligation);
  const ctx = {
    tx,
    actor: { accountId: randomUUID(), mfaCompleted: true, roles: ['DIRECTOR'] },
    requestId: randomUUID(),
    operationId: randomUUID(),
  };
  return { service, ctx, attempt, tx, audit, ledger, payoutId, ledgerEntryId, staffId };
}

test('a verified failed attempt releases the reservation without creating a payout or posting', async () => {
  const { service, ctx, attempt, tx, audit, ledger } = fixture();
  const body = { status: 'FAILED', evidenceReference: 'bank-case-81' };
  expect(await service.reconcile(ctx, attempt.id, body)).toEqual({
    id: attempt.id,
    status: 'FAILED',
    payoutId: null,
    ledgerEntryId: null,
  });
  expect(tx.confirmedPayout.create).not.toHaveBeenCalled();
  expect(ledger.event).not.toHaveBeenCalled();
  expect(audit.record).toHaveBeenCalledWith(
    expect.objectContaining({
      source_operation_id: ctx.operationId,
      metadata: expect.objectContaining({ previousStatus: 'UNKNOWN', ...body }),
    }),
    tx,
  );
  await expect(service.reconcile(ctx, attempt.id, body)).rejects.toMatchObject({
    domain: { code: 'PAYOUT_ATTEMPT_ALREADY_FINAL' },
  });
  expect(audit.record).toHaveBeenCalledTimes(1);
});

test('verified success posts only the actual amount and links the decision to the payout and ledger', async () => {
  const { service, ctx, attempt, tx, ledger, payoutId, ledgerEntryId, staffId } = fixture();
  const result = await service.reconcile(ctx, attempt.id, {
    status: 'SUCCEEDED',
    evidenceReference: 'bank-payment-62',
    amount: '75.0000',
  });
  expect(result).toEqual({ id: attempt.id, status: 'SUCCEEDED', payoutId, ledgerEntryId });
  expect(tx.confirmedPayout.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      attempt_id: attempt.id,
      amount: new Decimal('75'),
      provider_confirmation_id: 'bank-payment-62',
      confirmed_by_id: staffId,
    }),
  });
  expect(ledger.event).toHaveBeenCalledWith(ctx, expect.objectContaining({ payout_id: payoutId }));
});

test.each([
  [
    'missing exact amount',
    { status: 'SUCCEEDED', evidenceReference: 'bank-case' },
    'INVALID_MONEY',
  ],
  [
    'overpaid amount',
    { status: 'SUCCEEDED', evidenceReference: 'bank-case', amount: '100.0001' },
    'PAYOUT_EXCEEDS_OBLIGATION',
  ],
  [
    'failed with an amount',
    { status: 'FAILED', evidenceReference: 'bank-case', amount: '5' },
    'INVALID_INPUT',
  ],
  ['no evidence', { status: 'FAILED', evidenceReference: ' ' }, 'INVALID_INPUT'],
])('reconciliation denies %s before financial writes', async (_label, body, code) => {
  const { service, ctx, attempt, tx, audit } = fixture('PENDING');
  await expect(service.reconcile(ctx, attempt.id, body)).rejects.toMatchObject({
    domain: { code },
  });
  expect(tx.payoutAttempt.update).not.toHaveBeenCalled();
  expect(tx.confirmedPayout.create).not.toHaveBeenCalled();
  expect(audit.record).not.toHaveBeenCalled();
});

test.each([
  [{ mfaCompleted: false }, 'MFA_REQUIRED'],
  [{ roles: ['MANAGER'] }, 'FORBIDDEN'],
])('reconciliation rejects an unauthorized actor with %j', async (actor, code) => {
  const { service, ctx, attempt, tx } = fixture();
  Object.assign(ctx.actor, actor);
  await expect(
    service.reconcile(ctx, attempt.id, { status: 'FAILED', evidenceReference: 'bank-case' }),
  ).rejects.toMatchObject({ domain: { code } });
  expect(tx.payoutAttempt.findUnique).not.toHaveBeenCalled();
});

test('ordinary confirmation still rejects an unknown attempt', async () => {
  const { service, ctx, attempt, tx } = fixture();
  await expect(
    service.confirm(ctx, attempt.id, { providerConfirmationId: 'bank-case' }),
  ).rejects.toMatchObject({ domain: { code: 'PAYOUT_RECONCILIATION_REQUIRED' } });
  expect(tx.payoutAttempt.update).not.toHaveBeenCalled();
});

import { afterAll, beforeAll, beforeEach, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../packages/db/dist/index.js';
import { managerPaymentsFixture, match } from '../support/manager-payments-fixture.mjs';

let f, fixture, source, recipient, target, allocation;
const amount = (value) => new Prisma.Decimal(value);
// Store serializable amounts in the fake transaction snapshot, as other finance fixtures do.
const correctionRow = (row) => (row ? { ...row, amount: amount(row.amount) } : null);

beforeAll(async () => {
  fixture = await managerPaymentsFixture({
    snapshotFields: ['corrections'],
    reset(state) {
      state.corrections = new Map();
      state.correctionFacts = null;
    },
    configure(db, state) {
      const query = db.$queryRaw.getMockImplementation();
      db.$queryRaw.mockImplementation(async (sql, ...values) => {
        if (sql.text?.includes('AS source_advance_balance')) return [state().correctionFacts];
        return query(sql, ...values);
      });
      db.paymentAllocationCorrection = {
        findUnique: async ({ where }) => correctionRow(state().corrections.get(where.id)),
        findFirst: async ({ where }) =>
          correctionRow([...state().corrections.values()].find((row) => match(row, where))),
        findMany: async ({ where, take }) =>
          [...state().corrections.values()]
            .filter((row) => match(row, where))
            .sort((a, b) => a.id.localeCompare(b.id))
            .slice(0, take)
            .map(correctionRow),
        create: async ({ data }) => {
          const row = {
            id: randomUUID(),
            status: 'PENDING',
            decided_at: null,
            decided_by_id: null,
            decision_reason: null,
            ...data,
            amount: data.amount.toFixed(4),
          };
          state().corrections.set(row.id, row);
          return correctionRow(row);
        },
        update: async ({ where, data }) => {
          const row = { ...state().corrections.get(where.id), ...data };
          state().corrections.set(row.id, row);
          return correctionRow(row);
        },
      };
    },
  });
  f = fixture.f;
});

afterAll(async () => f?.app.close());

async function createSubscription(student) {
  const { enrollmentId, planId } = fixture.planFor(student);
  const result = await f.api('post', '/api/v1/subscriptions', 4, {
    key: randomUUID(),
    body: { enrollmentId, saleConditionId: planId },
  });
  expect(result.status).toBe(200);
  return result.body;
}

beforeEach(async () => {
  await f.reset();
  source = f.addStudent();
  recipient = f.addStudent();
  const orig = await createSubscription(source);
  target = await createSubscription(recipient);
  const receipt = await f.api('post', '/api/v1/payments/register', 0, {
    key: randomUUID(),
    body: { studentId: source.id, amount: '800', currency: 'MDL' },
  });
  expect(receipt.status).toBe(200);
  expect(
    (
      await f.api('post', `/api/v1/payments/${receipt.body.id}/confirm`, 4, {
        key: randomUUID(),
        body: {},
      })
    ).status,
  ).toBe(200);
  const dist = await f.api('post', `/api/v1/payments/${receipt.body.id}/distribute`, 0, {
    key: randomUUID(),
    body: { subscriptionId: orig.id, amount: '250' },
  });
  expect(dist.status).toBe(200);
  const approved = await f.api('post', `/api/v1/distributions/${dist.body.id}/approve`, 4, {
    key: randomUUID(),
    body: {},
  });
  expect(approved.status).toBe(200);
  allocation = approved.body.id;
  f.state.correctionFacts = {
    payment_id: receipt.body.id,
    subscription_id: orig.id,
    entry_id: approved.body.ledgerEntryId,
    period_id: f.state.periodId,
    currency: 'MDL',
    amount: amount(250),
    receipt_amount: amount(800),
    receipt_unallocated: amount(550),
    source_advance_balance: amount(250),
    target_available: amount(800),
    granted_lessons: 0,
    used_lessons: 0,
    started_lessons: 0,
    closed_at: null,
    source_reversed: false,
    refund_history: false,
    open_current_period: true,
  };
});

const propose = (key = randomUUID(), body = {}) =>
  f.api('post', `/api/v1/distributions/${allocation}/correction-proposals`, 0, {
    key,
    body: {
      amount: '125',
      targetSubscriptionId: target.id,
      reason: 'Receipt was assigned to the wrong subscription',
      ...body,
    },
  });

const review = (id, account, decision) =>
  f.api('post', `/api/v1/director/distribution-corrections/${id}/review`, account, {
    key: randomUUID(),
    body: { decision, reason: 'Reviewed published payment allocation' },
  });

test('manager records a single proposal with financial facts and the director can reject it', async () => {
  const ledgerCount = f.state.entries.size;
  const key = randomUUID();
  const first = await propose(key);
  expect(first.status).toBe(201);
  expect(first.body).toMatchObject({
    status: 'PENDING',
    amount: '125.0000',
    facts: {
      receiptUnallocated: null,
      sourceAdvanceBalance: '250.0000',
      sourceUsedLessons: 0,
      reviewReasons: [],
    },
  });
  expect((await propose(key)).body).toEqual(first.body);
  expect((await propose(key, { amount: '125.01' })).status).toBe(409);
  expect((await propose()).body.code).toBe('ALLOCATION_CORRECTION_ALREADY_OPEN');
  expect((await review(first.body.id, 0, 'REJECTED')).status).toBe(403);
  expect((await review(first.body.id, 4, 'REJECTED')).body.status).toBe('REJECTED');
  expect((await review(first.body.id, 4, 'MANUAL_REVIEW')).body.code).toBe(
    'ALLOCATION_CORRECTION_ALREADY_REVIEWED',
  );
  expect(f.state.entries.size).toBe(ledgerCount);
  expect(f.state.grants.size).toBe(0);
  expect(f.state.corrections.size).toBe(1);
  expect(
    f.state.outbox.some((event) => event.topic === 'finance.allocation-correction.reviewed.v1'),
  ).toBe(true);
  expect(JSON.stringify(f.state.outbox)).not.toContain('Receipt was assigned');
});

test('preview and cached submission preserve the current portfolio of source and destination', async () => {
  const key = randomUUID();
  const submitted = await propose(key);
  expect(submitted.status).toBe(201);
  f.state.students.get(recipient.id).managerId = f.accounts[1].staffId;
  expect((await propose(key)).status).toBe(404);
  expect(
    (await f.api('get', `/api/v1/distribution-corrections/${submitted.body.id}`, 0)).status,
  ).toBe(404);
  expect(
    (await f.api('get', `/api/v1/distribution-corrections/${submitted.body.id}`, 4)).status,
  ).toBe(200);
});

test('closed periods and recorded lessons stay in the director queue for manual review', async () => {
  Object.assign(f.state.correctionFacts, {
    closed_at: f.state.now,
    source_advance_balance: amount(50),
    used_lessons: 2,
  });
  const proposal = await propose();
  expect(proposal.status).toBe(201);
  expect(proposal.body.facts.reviewReasons).toEqual([
    'ORIGIN_PERIOD_CLOSED',
    'LESSON_ACTIVITY_RECORDED',
    'INSUFFICIENT_SOURCE_ADVANCE',
  ]);
  expect((await review(proposal.body.id, 4, 'MANUAL_REVIEW')).body.status).toBe('MANUAL_REVIEW');
  const queue = await f.api('get', '/api/v1/director/distribution-corrections', 4);
  expect(queue.body.items).toEqual([
    expect.objectContaining({ id: proposal.body.id, status: 'MANUAL_REVIEW' }),
  ]);
});

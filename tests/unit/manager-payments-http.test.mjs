import { beforeAll, beforeEach, afterAll, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { managerPaymentsFixture } from '../support/manager-payments-fixture.mjs';
let fx, f, own, foreign;
beforeAll(async () => {
  fx = await managerPaymentsFixture();
  f = fx.f;
});
afterAll(async () => {
  await f?.app.close();
});
beforeEach(async () => {
  await f.reset();
  own = f.addStudent();
  foreign = f.addStudent(1);
});
const create = (extra = {}, student = own, index = 0, key = randomUUID()) =>
  f.api('post', `/api/v1/manager/students/${student.id}/payments`, index, {
    key,
    body: {
      amount: '1000',
      method: 'CASH',
      purpose: 'FIRST_PAYMENT',
      receivedAt: '2026-10-30T10:00:00Z',
      ...extra,
    },
  });
const confirm = (id, key = randomUUID(), index = 0) =>
  f.api('post', `/api/v1/manager/payments/${id}/confirm`, index, { key, body: {} });
const director = (path, body = {}, key = randomUUID()) =>
  f.api('post', `/api/v1/${path}`, 4, { key, body });
const get = (id) => f.api('get', `/api/v1/manager/payments/${id}`);
test('manager registers a pending receipt and sends it for director approval without creating ledger entries', async () => {
  const r = await create({ note: 'PRIVATE NOTE' });
  expect(r.status).toBe(201);
  expect(r.body).toMatchObject({
    studentId: own.id,
    amount: '1000.0000',
    currency: 'MDL',
    status: 'PENDING',
    method: 'CASH',
    purpose: 'FIRST_PAYMENT',
    ledgerPublicationId: null,
  });
  expect(r.body.note).toBeUndefined();
  expect(r.body.consumed).toBeUndefined();
  expect(f.state.entries.size).toBe(0);
  const c = await confirm(r.body.id);
  expect(c.status).toBe(200);
  expect(c.body.status).toBe('AWAITING_APPROVAL');
  expect(f.state.entries.size).toBe(0);
  expect(f.state.audit.some((a) => a.action === 'PAYMENT_SENT_FOR_APPROVAL')).toBe(true);
  expect(JSON.stringify(f.state.outbox)).not.toContain('PRIVATE NOTE');
});
test('director publishes once; manager view follows canonical confirmation and cannot reject it', async () => {
  const r = await create();
  await confirm(r.body.id);
  const key = randomUUID(),
    d = await director(`payments/${r.body.id}/confirm`, {}, key);
  expect(d.status).toBe(200);
  expect((await director(`payments/${r.body.id}/confirm`, {}, key)).body).toEqual(d.body);
  expect(f.state.entries.size).toBe(1);
  expect(f.state.lines).toHaveLength(2);
  const current = await get(r.body.id);
  expect(current.status).toBe(200);
  expect(current.body.status).toBe('CONFIRMED');
  expect(current.body.ledgerPublicationId).toBe(d.body.ledgerEntryId);
  expect([...f.state.dispatches.values()]).toHaveLength(1);
  expect([...f.state.dispatches.values()][0]).toMatchObject({
    template_code: 'PAYMENT_CONFIRMED',
    student_id: own.id,
    status: 'QUEUED',
    variables: { paymentId: r.body.id, receiptOnly: 'true' },
  });
  expect((await confirm(r.body.id)).body.code).toBe('PAYMENT_IMMUTABLE');
  const rejected = await f.api('post', `/api/v1/manager/payments/${r.body.id}/reject`, 0, {
    key: randomUUID(),
    body: { reason: 'cannot edit' },
  });
  expect(rejected.body.code).toBe('PAYMENT_IMMUTABLE');
});
test('prepared allocation is pending until director approval and is reusable by MGR04 without duplicate rights', async () => {
  const r = await create();
  await director(`payments/${r.body.id}/confirm`);
  const plan = fx.planFor(own);
  const p = await f.api('post', `/api/v1/manager/payments/${r.body.id}/prepare-subscription`, 0, {
    key: randomUUID(),
    body: { ...plan, amount: '1000' },
  });
  expect(p.status).toBe(201);
  expect(p.body.status).toBe('AWAITING_APPROVAL');
  expect(f.state.grants.size).toBe(0);
  const approved = await director(`distributions/${p.body.id}/approve`);
  expect(approved.status).toBe(200);
  expect(f.state.entries.size).toBe(2);
  expect(f.state.grants.size).toBe(1);
  const active = await f.api('post', `/api/v1/manager/students/${own.id}/subscriptions`, 0, {
    key: randomUUID(),
    body: { planId: plan.planId, distributionId: p.body.id },
  });
  expect(active.status).toBe(201);
  expect(active.body.remainingLessons).toBe(8);
  expect(f.state.grants.size).toBe(1);
});

test.each(['0', '0.0000', '-1', '1e3', '0.12345', '1000000000000', '01.2', '', ' 1', 'NaN', 0.1])(
  'reject invalid money %p',
  async (amount) => {
    expect((await create({ amount })).status).toBe(422);
    expect(f.state.receipts.size).toBe(0);
  },
);
test.each(['0.1', '0.2', '0.0001', '999999999999.9999'])(
  'money %s remains exact through director publication',
  async (amount) => {
    const r = await create({ amount });
    expect(r.status).toBe(201);
    const d = await director(`payments/${r.body.id}/confirm`);
    expect(d.status).toBe(200);
    expect((await get(r.body.id)).body.amount).toBe(
      amount === '0.1' ? '0.1000' : amount === '0.2' ? '0.2000' : amount,
    );
    expect(f.state.lines.every((l) => l.amount === r.body.amount)).toBe(true);
  },
);
test.each(['USD', 'EUR', 'mdl', 'XYZ'])('new receipt currency %s is rejected', async (currency) => {
  expect((await create({ currency })).status).toBe(422);
});
test('external reference is unique per method, trimmed and optional', async () => {
  expect((await create({ externalRef: ' bank-001 ' })).status).toBe(201);
  expect((await create({ externalRef: 'bank-001' })).body.code).toBe('PAYMENT_DUPLICATE');
  expect((await create({ externalRef: 'bank-001', method: 'CARD' })).status).toBe(201);
  expect((await create()).status).toBe(201);
  expect((await create()).status).toBe(201);
});
test('registration/confirmation replay and competing confirms preserve one approval request', async () => {
  const key = randomUUID(),
    r = await create({}, own, 0, key);
  expect((await create({}, own, 0, key)).body).toEqual(r.body);
  expect(f.state.receipts.size).toBe(1);
  expect((await create({ amount: '10' }, own, 0, key)).body.code).toBe('IDEMPOTENCY_KEY_REUSED');
  const confirmKey = randomUUID();
  const a = await confirm(r.body.id, confirmKey);
  expect((await confirm(r.body.id, confirmKey)).body).toEqual(a.body);
  expect((await confirm(r.body.id)).body.code).toBe('PAYMENT_NOT_PENDING');
  expect(f.state.audit.filter((a) => a.action === 'PAYMENT_SENT_FOR_APPROVAL')).toHaveLength(1);
  const next = await create();
  const results = await Promise.all([confirm(next.body.id), confirm(next.body.id)]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(f.state.entries.size).toBe(0);
});
test('rejection is pending-only, audited with reason, and blocks director confirmation', async () => {
  const r = await create(),
    key = randomUUID();
  const rejected = await f.api('post', `/api/v1/manager/payments/${r.body.id}/reject`, 0, {
    key,
    body: { reason: ' Ошибка регистрации ' },
  });
  expect(rejected.status).toBe(200);
  expect(rejected.body).toMatchObject({
    status: 'REJECTED',
    rejectionReason: 'Ошибка регистрации',
  });
  expect(f.state.audit.find((a) => a.action === 'PAYMENT_REJECTED').metadata.reason).toBe(
    'Ошибка регистрации',
  );
  expect(
    (
      await f.api('post', `/api/v1/manager/payments/${r.body.id}/reject`, 0, {
        key,
        body: { reason: ' Ошибка регистрации ' },
      })
    ).body,
  ).toEqual(rejected.body);
  expect((await director(`payments/${r.body.id}/confirm`)).status).toBe(409);
  expect(f.state.entries.size).toBe(0);
});
test('list/get are paginated by CRM contact, filter canonical status and do not leak notes', async () => {
  const a = await create(),
    b = await create({ note: 'HIDDEN' }),
    c = await create();
  await confirm(b.body.id);
  await director(`payments/${c.body.id}/confirm`);
  await create({}, foreign, 1);
  const base = `/api/v1/manager/students/${own.id}/payments`;
  const listed = await f.api('get', base + '?pageSize=2');
  expect(listed.status).toBe(200);
  expect(listed.body.total).toBe(3);
  expect(listed.body.items).toHaveLength(2);
  const remaining = await f.api('get', base + '?page=2&pageSize=2');
  expect(remaining.body.items).toHaveLength(1);
  expect(new Set([...listed.body.items, ...remaining.body.items].map((r) => r.id)).size).toBe(3);
  expect(
    (await f.api('get', base + '?status=AWAITING_APPROVAL')).body.items.map((r) => r.id),
  ).toEqual([b.body.id]);
  expect((await f.api('get', base + '?status=CONFIRMED')).body.items.map((r) => r.id)).toEqual([
    c.body.id,
  ]);
  expect(JSON.stringify((await get(a.body.id)).body)).not.toContain('HIDDEN');
  expect((await f.api('get', base + '?pageSize=1000')).status).toBe(422);
});
test.each(['ledger', 'unbalanced', 'closed', 'audit', 'outbox'])(
  'director %s failure rolls back publication and confirmation',
  async (failure) => {
    const r = await create();
    await confirm(r.body.id);
    if (failure === 'ledger') f.state.failLedger = true;
    if (failure === 'unbalanced') f.state.unbalanced = true;
    if (failure === 'closed') f.state.closedPeriod = true;
    if (failure === 'audit') f.state.failAudit = 'ledger.published';
    if (failure === 'outbox') f.state.failOutbox = true;
    const d = await director(`payments/${r.body.id}/confirm`);
    expect(d.status).toBe(503);
    expect(d.body.code).toBe('LEDGER_PUBLICATION_FAILED');
    expect(JSON.stringify(d.body)).not.toMatch(/private|bank details/);
    expect(f.state.receipts.get(r.body.id).confirmed_by_director_at).toBeNull();
    expect(f.state.entries.size).toBe(0);
    expect(f.state.lines).toHaveLength(0);
  },
);
test('approval request/rejection rollback keeps the pending receipt unchanged', async () => {
  const r = await create();
  f.state.failAudit = 'PAYMENT_SENT_FOR_APPROVAL';
  expect((await confirm(r.body.id)).status).toBe(503);
  expect(f.state.receipts.get(r.body.id).approval_requested_at).toBeNull();
  f.state.failAudit = null;
  f.state.failOutbox = true;
  expect(
    (
      await f.api('post', `/api/v1/manager/payments/${r.body.id}/reject`, 0, {
        key: randomUUID(),
        body: { reason: 'rejected' },
      })
    ).status,
  ).toBe(503);
  expect(f.state.receipts.get(r.body.id).rejected_at).toBeNull();
});
test('prepare failure rolls back the financial package and refuses a foreign recipient', async () => {
  const r = await create({ amount: '100' }),
    plan = fx.planFor(own),
    foreignPlan = fx.planFor(foreign);
  const result = await f.api(
    'post',
    `/api/v1/manager/payments/${r.body.id}/prepare-subscription`,
    0,
    { key: randomUUID(), body: { ...plan, amount: '200' } },
  );
  expect(result.status).toBe(422);
  expect(f.state.financial.size).toBe(0);
  expect(
    (
      await f.api('post', `/api/v1/manager/payments/${r.body.id}/prepare-subscription`, 0, {
        key: randomUUID(),
        body: { ...foreignPlan, amount: '10' },
      })
    ).status,
  ).toBe(404);
});
test('partial installments revoke every earlier limited decision and grant paid rights once only at full funding', async () => {
  const plan = fx.planFor(own),
    r = await create({ amount: '500' });
  await director(`payments/${r.body.id}/confirm`);
  const p = await f.api('post', `/api/v1/manager/payments/${r.body.id}/prepare-subscription`, 0, {
    key: randomUUID(),
    body: { ...plan, amount: '500' },
  });
  await director(`distributions/${p.body.id}/approve`);
  expect(f.state.grants.size).toBe(0);
  const permission = {
    id: randomUUID(),
    subscription_id: p.body.subscriptionId,
    approved_at: f.state.now,
    valid_from: f.state.now,
    valid_to: new Date('2026-11-20'),
    max_lessons: 1,
    revoked_at: null,
  };
  f.state.permissions.set(permission.id, permission);
  for (const [i, amount] of ['250', '250'].entries()) {
    const top = await create({ amount, purpose: 'OTHER' });
    await director(`payments/${top.body.id}/confirm`);
    const allocation = await f.api(
      'post',
      `/api/v1/manager/payments/${top.body.id}/distributions`,
      0,
      { key: randomUUID(), body: { subscriptionId: p.body.subscriptionId, amount } },
    );
    expect(allocation.status).toBe(201);
    const result = await director(`distributions/${allocation.body.id}/approve`);
    expect(result.status).toBe(200);
    expect(f.state.grants.size).toBe(i === 0 ? 0 : 1);
  }
  expect(f.state.permissions.get(permission.id).revoked_at).toEqual(f.state.now);
  expect([...f.state.grants.values()][0].quantity).toBe(8);
});
test('an allocation remains visible to its recipient without exposing a foreign contact receipt or household totals', async () => {
  const r = await create({ amount: '1000', note: 'FOREIGN CONTACT' }, foreign, 1);
  await director(`payments/${r.body.id}/confirm`);
  const plan = fx.planFor(own);
  const sub = await director('subscriptions', {
    enrollmentId: plan.enrollmentId,
    saleConditionId: plan.planId,
  });
  expect(sub.status).toBe(200);
  const d = await director(`payments/${r.body.id}/distribute`, {
    subscriptionId: sub.body.id,
    amount: '300',
  });
  expect(d.status).toBe(200);
  expect((await director(`distributions/${d.body.id}/approve`)).status).toBe(200);
  const visible = await f.api('get', `/api/v1/manager/students/${own.id}/distributions`);
  expect(visible.status).toBe(200);
  expect(visible.body.items[0]).toMatchObject({
    studentId: own.id,
    amount: '300.0000',
    status: 'CONFIRMED',
    consumed: false,
  });
  expect(JSON.stringify(visible.body)).not.toMatch(
    /1000\.0000|FOREIGN CONTACT|unallocated|household/,
  );
  expect((await get(r.body.id)).status).toBe(404);
});
test('cached preparation rechecks both the contact and recipient portfolio', async () => {
  const recipient = f.addStudent(),
    plan = fx.planFor(recipient),
    r = await create(),
    key = randomUUID();
  const path = `/api/v1/manager/payments/${r.body.id}/prepare-subscription`,
    body = { ...plan, amount: '1000' };
  expect((await f.api('post', path, 0, { key, body })).status).toBe(201);
  f.state.students.get(recipient.id).managerId = f.accounts[1].staffId;
  expect((await f.api('post', path, 0, { key, body })).status).toBe(404);
});

test('critical payment registration retries serialization at most three times without duplicates', async () => {
  f.state.failCommit = 2;
  const r = await create();
  expect(r.status).toBe(201);
  expect(f.state.receipts.size).toBe(1);
  expect(f.state.audit.filter((a) => a.action === 'PAYMENT_CREATED')).toHaveLength(1);
  f.state.failCommit = 4;
  expect((await create()).status).toBe(503);
  expect(f.state.failCommit).toBe(1);
  expect(f.state.receipts.size).toBe(1);
});

test('competing director confirmations publish exactly once in the transactional fixture', async () => {
  const r = await create();
  const results = await Promise.all([
    director(`payments/${r.body.id}/confirm`),
    director(`payments/${r.body.id}/confirm`),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(f.state.entries.size).toBe(1);
  expect(f.state.lines).toHaveLength(2);
});

test('one receipt funds separate own children without consuming the whole receipt', async () => {
  const r = await create({ amount: '2000' });
  await director(`payments/${r.body.id}/confirm`);
  for (const student of [own, f.addStudent()]) {
    const plan = fx.planFor(student);
    const proposal = await f.api(
      'post',
      `/api/v1/manager/payments/${r.body.id}/prepare-subscription`,
      0,
      {
        key: randomUUID(),
        body: { ...plan, amount: '1000' },
      },
    );
    expect(proposal.status).toBe(201);
    expect((await director(`distributions/${proposal.body.id}/approve`)).status).toBe(200);
    expect(
      (
        await f.api('post', `/api/v1/manager/students/${student.id}/subscriptions`, 0, {
          key: randomUUID(),
          body: { planId: plan.planId, distributionId: proposal.body.id },
        })
      ).status,
    ).toBe(201);
    const listed = await f.api('get', `/api/v1/manager/students/${student.id}/distributions`);
    expect(listed.body.items[0].consumed).toBe(true);
  }
  expect(f.state.operations.size).toBe(2);
  expect(f.state.grants.size).toBe(2);
  expect((await get(r.body.id)).body.consumed).toBeUndefined();
});

test.each(['2026-11-01T10:00:00Z', '2026-02-30T10:00:00Z', '2026-10-30'])(
  'invalid or future receivedAt %s is rejected',
  async (receivedAt) => {
    expect((await create({ receivedAt })).status).toBe(422);
  },
);

test('historical receipt keeps its currency and unknown metadata', async () => {
  const r = await create();
  const row = f.state.receipts.get(r.body.id);
  row.currency = 'EUR';
  row.method = null;
  row.purpose = null;
  row.received_at = null;
  const current = await get(r.body.id);
  expect(current.body).toMatchObject({ currency: 'EUR', method: null, purpose: null });
  expect(current.body.receivedAt).toBe(row.registered_at.toISOString());
});
test.each([2, 3, 4, 5])('non-manager role %i cannot use manager payment routes', async (index) => {
  expect((await create({}, own, index)).status).toBe(403);
});
test('director confirmation requires MFA even with a valid session and CSRF', async () => {
  const receipt = await create();
  expect(receipt.status).toBe(201);
  const session = [...f.state.sessions.values()].find((row) => row.account_id === f.accounts[4].id);
  const verifiedAt = session.mfa_verified_at;
  session.mfa_verified_at = null;
  const path = `payments/${receipt.body.id}/confirm`;
  const key = randomUUID();

  const denied = await director(path, {}, key);
  expect(denied.status).toBe(403);
  expect(denied.body.code).toBe('MFA_REQUIRED');

  session.mfa_verified_at = verifiedAt;
  expect((await director(path, {}, key)).status).toBe(200);
});

test('anonymous, missing CSRF/key, forged confirmation body and foreign receipt access are rejected', async () => {
  expect((await create({}, own, null)).status).toBe(401);
  const r = await create(),
    other = await create({}, foreign, 1);
  expect((await get(other.body.id)).body.code).toBe('PAYMENT_NOT_FOUND');
  expect((await get(randomUUID())).body.code).toBe('PAYMENT_NOT_FOUND');
  expect(
    (
      await f.api('post', `/api/v1/manager/payments/${r.body.id}/confirm`, 0, {
        csrf: false,
        key: randomUUID(),
        body: {},
      })
    ).status,
  ).toBe(403);
  expect(
    (await f.api('post', `/api/v1/manager/payments/${r.body.id}/confirm`, 0, { body: {} })).status,
  ).toBe(400);
  expect(
    (
      await f.api('post', `/api/v1/manager/payments/${r.body.id}/confirm`, 0, {
        key: randomUUID(),
        body: { amount: '1' },
      })
    ).status,
  ).toBe(422);
  expect((await director(`payments/${r.body.id}/confirm`, {}, randomUUID())).status).toBe(200);
});

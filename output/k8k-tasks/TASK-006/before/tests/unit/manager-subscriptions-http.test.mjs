import { beforeAll, beforeEach, afterEach, afterAll, expect, test } from '@jest/globals';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { managerSubscriptionsFixture } from '../support/manager-subscriptions-fixture.mjs';
import {
  LessonCancellationPort,
  ManagerSubscriptionExpiry,
} from '../../apps/api/dist/modules/finance/manager-subscriptions/lifecycle.module.js';
import { StudentSubscriptionService } from '../../apps/api/dist/student/subscription/subscription.service.js';
let fixture, f, own, foreign, paid;
const capturedSql = new Set();
beforeAll(async () => {
  fixture = await managerSubscriptionsFixture();
  f = fixture.f;
});
afterAll(async () => {
  await writeFile(join(tmpdir(), 'online-school-mgr04-sql.json'), JSON.stringify([...capturedSql]));
  await f?.app.close();
});
afterEach(() => {
  for (const query of f.state.queries) capturedSql.add(query.text);
});
beforeEach(async () => {
  await f.reset();
  own = f.addStudent();
  foreign = f.addStudent(1);
  paid = fixture.packageFor(own);
});
const create = (pkg = paid, key = randomUUID(), student = own, index = 0, extra = {}) =>
  f.api('post', `/students/${student.id}/subscriptions`, index, {
    key,
    body: { planId: pkg.planId, distributionId: pkg.id, ...extra },
  });
const command = (id, action, body = {}, key = randomUUID(), index = 0) =>
  f.api('post', `/subscriptions/${id}/${action}`, index, { key, body });
const frozen = (id, extra = {}) =>
  command(id, 'freeze', {
    startsOn: '2026-11-01',
    endsOn: '2026-11-11',
    reason: 'ILLNESS',
    ...extra,
  });
test('creation uses published allocation, existing rights and a precise immutable price', async () => {
  f.state.plans.get(paid.planId).price = '1000.0008';
  f.state.plans.get(paid.planId).lesson_unit_price = '125.0001';
  f.state.financial.get(paid.subscription_id).full_price = '1000.0008';
  f.state.financial.get(paid.subscription_id).original_paid_unit_price = '125.0001';
  paid.paid = '1000.0008';
  const result = await create();
  expect(result.status).toBe(201);
  expect([...f.state.dispatches.values()]).toHaveLength(1);
  expect([...f.state.dispatches.values()][0]).toMatchObject({
    template_code: 'SUBSCRIPTION_CREATED',
    student_id: own.id,
    status: 'QUEUED',
  });
  expect(result.body).toMatchObject({
    id: paid.subscription_id,
    studentId: own.id,
    enrollmentId: paid.enrollmentId,
    status: 'ACTIVE',
    totalLessons: 8,
    remainingLessons: 8,
    price: '1000.0008',
    currency: 'MDL',
  });
  expect(f.state.operations.size).toBe(1);
  expect(f.state.grants.size).toBe(1);
  expect([...f.state.operations.values()][0]).toMatchObject({
    distribution_id: paid.id,
    ledger_publication_id: paid.publicationId,
  });
  expect(f.state.outbox.some((e) => e.topic === 'manager.subscription.created.v1')).toBe(true);
  const listed = await f.api('get', `/students/${own.id}/subscriptions`);
  expect(listed.status).toBe(200);
  expect(listed.body).toEqual([result.body]);
});
test('create replay and payload mismatch are atomic and never regrant a package', async () => {
  const key = randomUUID(),
    a = await create(paid, key),
    b = await create(paid, key);
  expect(b.status).toBe(201);
  expect(b.body).toEqual(a.body);
  expect(f.state.grants.size).toBe(1);
  expect(f.state.operations.size).toBe(1);
  const mismatch = await create(paid, key, own, 0, { startsAt: '2026-11-01T00:00:00Z' });
  expect(mismatch.status).toBe(409);
  expect(mismatch.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
});
test.each(['confirmed', 'approved', 'receiptPublished', 'published'])(
  'unready funding %s is rejected without rights',
  async (flag) => {
    paid[flag] = false;
    const r = await create();
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('PAYMENT_NOT_CONFIRMED');
    expect(f.state.roots.size).toBe(0);
    expect(f.state.grants.size).toBe(0);
  },
);
test('partial payment needs a separate admission and never grants full paid rights', async () => {
  paid.paid = '500';
  expect((await create()).body.code).toBe('PAYMENT_NOT_CONFIRMED');
  // Transaction rollback restores database rows as new objects; re-read the stored row.
  paid = f.state.funding.get(paid.id);
  paid.admission = true;
  const r = await create();
  expect(r.status).toBe(201);
  expect(r.body.remainingLessons).toBe(0);
  expect(f.state.grants.size).toBe(0);
});
test('prepared start and plan terms are checked without modifying the sale snapshot', async () => {
  const wrong = await create(paid, randomUUID(), own, 0, { startsAt: '2026-12-01T00:00:00Z' });
  expect(wrong.status).toBe(422);
  f.state.plans.get(paid.planId).duration_days = null;
  expect((await create()).body.code).toBe('PLAN_DURATION_REQUIRED');
});
test('foreign and nonexistent distributions have the same not-found error', async () => {
  const other = fixture.packageFor(foreign);
  const a = await create(other),
    b = await create({ ...paid, id: randomUUID() });
  expect(a.status).toBe(404);
  expect(a.body.code).toBe(b.body.code);
});
test('distribution reuse fails while another allocation from the same receipt remains legitimate', async () => {
  expect((await create()).status).toBe(201);
  expect((await create()).body.code).toBe('DISTRIBUTION_ALREADY_USED');
  const next = fixture.packageFor(own, paid.enrollmentId, paid.planId);
  next.payment_id = paid.payment_id;
  expect((await command(paid.subscription_id, 'renew', { distributionId: next.id })).status).toBe(
    200,
  );
  expect(f.state.operations.size).toBe(2);
});
test('one active contract per enrollment, separate subjects remain independent', async () => {
  expect((await create()).status).toBe(201);
  const duplicate = fixture.packageFor(own, paid.enrollmentId, paid.planId);
  expect((await create(duplicate)).body.code).toBe('ACTIVE_SUBSCRIPTION_EXISTS');
  const subject2 = fixture.packageFor(own);
  expect((await create(subject2)).status).toBe(201);
  expect(f.state.roots.size).toBe(2);
});
test('renewal joins a new financial period, carries rights and is visible to the student reader', async () => {
  const first = await create(),
    oldPrice = f.state.financial.get(paid.subscription_id).full_price;
  [...f.state.grants.values()][0].consumed = 2;
  const next = fixture.packageFor(own, paid.enrollmentId, paid.planId);
  const r = await command(first.body.id, 'renew', { distributionId: next.id });
  expect(r.status).toBe(200);
  expect(r.body.remainingLessons).toBe(14);
  expect(r.body.totalLessons).toBe(16);
  expect(+new Date(r.body.endsAt)).toBe(+new Date(first.body.endsAt) + 30 * 86400000);
  expect(f.state.financial.get(paid.subscription_id).full_price).toBe(oldPrice);
  const reader = new StudentSubscriptionService({ client: f.client });
  const student = await reader.details(
    { studentProfileId: own.id, timeZone: 'Europe/Chisinau' },
    {},
  );
  expect(student.lessonsRemaining).toBe(14);
  expect(student.lessonsTotal).toBe(16);
  expect(
    f.state.queries.some(
      (q) => q.sql.includes('selected_periods') && q.sql.includes('manager_subscription_periods'),
    ),
  ).toBe(true);
});
test('an expired contract starts its renewal term at now', async () => {
  const first = await create();
  f.state.roots.get(first.body.id).status = 'EXPIRED';
  f.state.roots.get(first.body.id).ends_at = new Date('2026-10-30T10:00:00Z');
  const next = fixture.packageFor(own, paid.enrollmentId, paid.planId);
  const r = await command(first.body.id, 'renew', { distributionId: next.id });
  expect(r.status).toBe(200);
  expect(r.body.endsAt).toBe('2026-11-30T10:00:00.000Z');
});
test.each(['FROZEN', 'CANCELLED'])('renew refuses state %s', async (status) => {
  const r = await create();
  f.state.roots.get(r.body.id).status = status;
  const next = fixture.packageFor(own, paid.enrollmentId, paid.planId);
  const response = await command(r.body.id, 'renew', { distributionId: next.id });
  expect(response.body.code).toBe('INVALID_STATE_TRANSITION');
});
test.each(['FROZEN', 'EXPIRED', 'CANCELLED'])('freeze refuses state %s', async (status) => {
  const r = await create();
  f.state.roots.get(r.body.id).status = status;
  expect((await frozen(r.body.id)).body.code).toBe('INVALID_STATE_TRANSITION');
});
test.each(['ACTIVE', 'EXPIRED', 'CANCELLED'])('unfreeze refuses state %s', async (status) => {
  const r = await create();
  f.state.roots.get(r.body.id).status = status;
  expect((await command(r.body.id, 'unfreeze')).body.code).toBe('INVALID_STATE_TRANSITION');
});
test('freeze, early unfreeze and replay extend all periods only by elapsed school days', async () => {
  const first = await create();
  const fr = await frozen(first.body.id);
  expect(fr.status).toBe(200);
  expect(fr.body.status).toBe('FROZEN');
  f.state.now = new Date('2026-11-06T10:00:00Z');
  const key = randomUUID();
  const r = await command(first.body.id, 'unfreeze', {}, key);
  expect(r.status).toBe(200);
  expect(r.body.freezeDaysUsed).toBe(5);
  expect(+new Date(r.body.endsAt) - +new Date(first.body.endsAt)).toBe(5 * 86400000);
  expect((await command(first.body.id, 'unfreeze', {}, key)).body).toEqual(r.body);
  expect(f.state.financial.get(paid.subscription_id).frozen_until).toBeNull();
  expect(f.state.outbox.filter((e) => e.topic === 'manager.subscription.unfrozen.v1')).toHaveLength(
    1,
  );
});
test('freeze limits use configured per-event and accumulated caps', async () => {
  const r = await create();
  expect((await frozen(r.body.id, { endsOn: '2026-12-02' })).body.code).toBe(
    'FREEZE_LIMIT_EXCEEDED',
  );
  f.state.roots.get(r.body.id).freeze_days_used = 55;
  expect((await frozen(r.body.id)).body.code).toBe('FREEZE_LIMIT_EXCEEDED');
});
test('conflicts return only own lesson IDs and need explicit cancellation consent', async () => {
  const r = await create(),
    lesson = {
      id: randomUUID(),
      enrollment_id: paid.enrollmentId,
      status: 'SCHEDULED',
      scheduled_at: new Date('2026-11-02T10:00:00Z'),
    };
  f.state.lessons.set(lesson.id, lesson);
  const conflict = await frozen(r.body.id);
  expect(conflict.status).toBe(409);
  expect(conflict.body.details.lessonIds).toEqual([lesson.id]);
  expect(f.state.freezes.size).toBe(0);
});
test('MGR-06 cancellation port runs in the transaction and must really clear conflicts', async () => {
  const r = await create(),
    lesson = {
      id: randomUUID(),
      enrollment_id: paid.enrollmentId,
      status: 'SCHEDULED',
      scheduled_at: new Date('2026-11-02T10:00:00Z'),
    };
  f.state.lessons.set(lesson.id, lesson);
  const port = f.app.get(LessonCancellationPort),
    original = port.cancelWithoutCharge;
  try {
    port.cancelWithoutCharge = async () => ({ ok: true, value: undefined });
    expect((await frozen(r.body.id, { cancelConflictingLessons: true })).body.code).toBe(
      'LESSON_CANCELLATION_NOT_COMPLETED',
    );
    port.cancelWithoutCharge = async (_ctx, ids, _reason, tx) => {
      expect(tx).toBe(f.client);
      for (const id of ids) f.state.lessons.get(id).status = 'CANCELLED';
      return { ok: true, value: undefined };
    };
    expect((await frozen(r.body.id, { cancelConflictingLessons: true })).status).toBe(200);
  } finally {
    port.cancelWithoutCharge = original;
  }
});
test.each(['publication', 'audit', 'outbox'])(
  '%s failure leaves no partial account, rights or operation',
  async (failure) => {
    if (failure === 'publication') f.state.failPublication = true;
    if (failure === 'audit') f.state.failAudit = 'SUBSCRIPTION_CREATED';
    if (failure === 'outbox') f.state.failOutbox = true;
    expect((await create()).status).toBe(503);
    for (const key of ['roots', 'periods', 'grants', 'operations'])
      expect(f.state[key].size).toBe(0);
  },
);
test('competing renewals of one distribution issue its rights once', async () => {
  const r = await create(),
    next = fixture.packageFor(own, paid.enrollmentId, paid.planId);
  const responses = await Promise.all([
    command(r.body.id, 'renew', { distributionId: next.id }),
    command(r.body.id, 'renew', { distributionId: next.id }),
  ]);
  expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(f.state.grants.size).toBe(2);
});
test('worker expires once, creates no duplicate CRM follow-up and automatically closes elapsed freezes', async () => {
  const r = await create(),
    worker = f.app.get(ManagerSubscriptionExpiry);
  f.state.now = new Date('2026-12-10T10:00:00Z');
  expect(await worker.processDue()).toEqual({ ok: true, value: 1 });
  const count = f.state.outbox.length;
  expect(await worker.processDue()).toEqual({ ok: true, value: 0 });
  expect(f.state.outbox.length).toBe(count);
  expect(f.state.roots.get(r.body.id).status).toBe('EXPIRED');
  expect(f.state.outbox.filter((e) => e.topic === 'manager.subscription.expired.v1')).toHaveLength(
    1,
  );
  await f.reset();
  own = f.addStudent();
  paid = fixture.packageFor(own);
  const created = await create();
  await frozen(created.body.id);
  f.state.now = new Date('2026-11-15T10:00:00Z');
  expect(await worker.processDue()).toEqual({ ok: true, value: 1 });
  expect(f.state.roots.get(created.body.id).freeze_days_used).toBe(10);
  expect(f.state.roots.get(created.body.id).status).toBe('ACTIVE');
  expect(await worker.processDue()).toEqual({ ok: true, value: 0 });
});
test.each([2, 3, 4, 5])('role %i cannot mutate subscriptions', async (index) => {
  expect((await create(paid, randomUUID(), own, index)).status).toBe(403);
});
test('anonymous, CSRF, missing key and forged money/ownership are rejected', async () => {
  expect((await create(paid, randomUUID(), own, null)).status).toBe(401);
  expect(
    (
      await f.api('post', `/students/${own.id}/subscriptions`, 0, {
        csrf: false,
        key: randomUUID(),
        body: { planId: paid.planId, distributionId: paid.id },
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await f.api('post', `/students/${own.id}/subscriptions`, 0, {
        body: { planId: paid.planId, distributionId: paid.id },
      })
    ).status,
  ).toBe(400);
  expect(
    (await create(paid, randomUUID(), own, 0, { price: '1', managerId: randomUUID() })).status,
  ).toBe(422);
});
test('foreign subscription and nonexistent subscription have identical denial without details', async () => {
  const p = fixture.packageFor(foreign),
    created = await create(p, randomUUID(), foreign, 1);
  const a = await command(created.body.id, 'unfreeze'),
    b = await command(randomUUID(), 'unfreeze');
  expect(a.status).toBe(404);
  expect(a.body.code).toBe('SUBSCRIPTION_NOT_FOUND');
  expect(a.body.code).toBe(b.body.code);
  expect(a.body.details).toBeUndefined();
});

test('SERIALIZABLE commit retry rolls back orphan rights and publishes one final operation', async () => {
  f.state.failCommit = 1;
  expect((await create()).status).toBe(201);
  expect(f.state.roots.size).toBe(1);
  expect(f.state.grants.size).toBe(1);
  expect(f.state.operations.size).toBe(1);
  expect(f.state.outbox.filter((e) => e.topic === 'manager.subscription.created.v1')).toHaveLength(
    1,
  );
});
test('three failed commits leave no rights or cached success', async () => {
  f.state.failCommit = 3;
  const r = await create();
  expect(r.status).toBe(503);
  expect(r.body.code).toBe('TRANSACTION_RETRY_EXHAUSTED');
  expect(f.state.grants.size).toBe(0);
  expect(f.state.roots.size).toBe(0);
  expect(f.state.idem.size).toBe(0);
});
test('failed renewal restores old dates, rights, period binding and notification state', async () => {
  const initial = await create(),
    next = fixture.packageFor(own, paid.enrollmentId, paid.planId);
  f.state.failOutbox = true;
  expect((await command(initial.body.id, 'renew', { distributionId: next.id })).status).toBe(503);
  expect(f.state.roots.get(initial.body.id).ends_at.toISOString()).toBe(initial.body.endsAt);
  expect(f.state.periods.size).toBe(1);
  expect(f.state.grants.size).toBe(1);
  expect(f.state.operations.size).toBe(1);
});
test('cancellation and freeze both roll back when the notification outbox fails', async () => {
  const created = await create(),
    lesson = {
      id: randomUUID(),
      enrollment_id: paid.enrollmentId,
      status: 'SCHEDULED',
      scheduled_at: new Date('2026-11-02T10:00:00Z'),
    };
  f.state.lessons.set(lesson.id, lesson);
  const port = f.app.get(LessonCancellationPort),
    original = port.cancelWithoutCharge;
  try {
    port.cancelWithoutCharge = async () => {
      f.state.lessons.get(lesson.id).status = 'CANCELLED';
      return { ok: true, value: undefined };
    };
    f.state.failOutbox = true;
    expect((await frozen(created.body.id, { cancelConflictingLessons: true })).status).toBe(503);
    expect(f.state.freezes.size).toBe(0);
    expect(f.state.lessons.get(lesson.id).status).toBe('SCHEDULED');
    expect(f.state.roots.get(created.body.id).status).toBe('ACTIVE');
  } finally {
    port.cancelWithoutCharge = original;
  }
});
test('cached mutation is no longer visible after the portfolio assignment changes', async () => {
  const key = randomUUID();
  expect((await create(paid, key)).status).toBe(201);
  f.state.students.get(own.id).managerId = f.accounts[1].staffId;
  const replay = await create(paid, key);
  expect(replay.status).toBe(404);
  expect(replay.body.code).toBe('STUDENT_NOT_FOUND');
  expect(replay.body.price).toBeUndefined();
});

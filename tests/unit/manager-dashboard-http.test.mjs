import { beforeAll, beforeEach, afterAll, afterEach, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { managerDashboardFixture } from '../support/manager-dashboard-fixture.mjs';
import { subscriptionExpiryUntil } from '../../apps/api/dist/modules/finance/manager-subscriptions/read-spec.js';
import { schoolMidnight } from '../../apps/api/dist/modules/finance/manager-subscriptions/time.js';
let fx, f;
const sql = new Set(),
  prior = process.env.MANAGER_CURSOR_SECRET;
beforeAll(async () => {
  fx = await managerDashboardFixture();
  f = fx.f;
  process.env.MANAGER_CURSOR_SECRET = 'mgr09-fixture-cursor-secret-at-least-32';
});
beforeEach(async () => {
  await f.reset();
  fx.calls.length = 0;
  fx.captured.length = 0;
});
afterEach(() => {
  for (const q of fx.calls) if (q.text) sql.add(q.text);
});
afterAll(async () => {
  await writeFile(join(tmpdir(), 'online-school-mgr09-sql.json'), JSON.stringify([...sql]));
  await f?.app.close();
  if (prior === undefined) delete process.env.MANAGER_CURSOR_SECRET;
  else process.env.MANAGER_CURSOR_SECRET = prior;
});
const get = (query = '', index = 0) => f.api('get', '/api/v1/manager/dashboard' + query, index);
const lesson = (student, ready, start, extra = {}) => {
  const row = {
    id: randomUUID(),
    enrollment_id: ready.pkg.enrollmentId,
    scheduled_teacher_id: ready.teacherId,
    teaching_assignment_id: ready.assignmentId,
    status: 'SCHEDULED',
    scheduled_at: new Date(start),
    scheduled_end_at: new Date(+new Date(start) + 3600000),
    meet_link_overridden: false,
    google_meet_link: null,
    ...extra,
  };
  f.state.lessons.set(row.id, row);
  return row;
};
test('empty portfolio returns200, one READ ONLY snapshot, six commands and no business writes', async () => {
  const r = await get();
  expect(r.status).toBe(200);
  expect(r.headers['cache-control']).toBe('private, no-store');
  expect(r.body).toEqual({
    generatedAt: f.state.now.toISOString(),
    students: { active: 0, frozen: 0, leads: 0 },
    upcomingLessons: [],
    overdueTasks: { count: 0, top: [] },
    expiringSubscriptions: [],
    pendingPayments: { count: 0, totalsByCurrency: [] },
  });
  expect(fx.captured).toHaveLength(1);
  expect(fx.captured[0]).toMatchObject({
    readOnly: true,
    readCount: 6,
    options: { timeout: 15000, maxWait: 5000 },
  });
  expect(fx.calls[0].text).toBe('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
  expect(f.state.audit).toHaveLength(0);
  expect(f.state.outbox).toHaveLength(0);
  expect(f.state.idem.size).toBe(0);
});
test.each([
  '?lessonsHorizonHours=0',
  '?lessonsHorizonHours=25',
  '?lessonsHorizonHours=',
  '?expiringDays=0',
  '?expiringDays=8',
  '?expiringDays=7.5',
  '?expiringDays[]=7',
  '?managerId=other',
  '?studentId=foreign',
])('invalid query %s returns422 before reporting queries', async (q) => {
  expect((await get(q)).status).toBe(422);
  expect(fx.captured).toHaveLength(0);
});
test.each([24, 48, 168])('accepts lessons horizon%s', async (h) => {
  expect((await get(`?lessonsHorizonHours=${h}`)).status).toBe(200);
});
test.each([3, 7, 14])('accepts expiry window%s', async (d) => {
  expect((await get(`?expiringDays=${d}`)).status).toBe(200);
});
test.each([null, 2, 3, 4, 5])('role/session matrix index%s', async (index) => {
  expect((await get('', index)).status).toBe(index === null ? 401 : 403);
  expect(fx.captured).toHaveLength(0);
});
test('MGR02 status counts agree on a common dataset; foreign portfolio, expired and archived are excluded', async () => {
  const active = f.addStudent(),
    frozen = f.addStudent(),
    lead = f.addStudent(),
    expired = f.addStudent(),
    archived = f.addStudent(0, { archived_at: f.state.now }),
    foreign = f.addStudent(1, { full_name: 'FOREIGN SECRET' });
  fx.readyFor(active);
  const fr = fx.readyFor(frozen);
  Object.assign(f.state.financial.get(fr.pkg.subscription_id), {
    frozen_from: new Date(+f.state.now - 1),
    frozen_until: new Date(+f.state.now + 86400000),
  });
  f.state.roots.get(fr.subscriptionId).status = 'FROZEN';
  fx.readyFor(expired, { ends_at: new Date(+f.state.now - 1) });
  fx.readyFor(archived);
  fx.readyFor(foreign);
  const result = await get();
  expect(result.status).toBe(200);
  expect(result.body.students).toEqual({ active: 1, frozen: 1, leads: 1 });
  for (const [status, name] of [
    ['ACTIVE', 'active'],
    ['FROZEN', 'frozen'],
    ['LEAD', 'leads'],
  ]) {
    const list = await f.api('get', `/api/v1/manager/students?status=${status}`);
    expect(list.status).toBe(200);
    expect(result.body.students[name]).toBe(list.body.items.length);
  }
  expect(JSON.stringify(result.body)).not.toMatch(
    /FOREIGN SECRET|phone|email|manager_note|learning|balance/,
  );
  expect(lead.id).toBeDefined();
});
test('upcoming includes exact start/end, excludes running/past/cancelled and returns ten stable lessons without Meet URLs', async () => {
  const own = f.addStudent(),
    other = f.addStudent(1, { full_name: 'FOREIGN' }),
    ready = fx.readyFor(own),
    foreign = fx.readyFor(other),
    now = f.state.now,
    until = new Date(+now + 48 * 3600000);
  const first = lesson(own, ready, now),
    last = lesson(own, ready, until),
    removed = lesson(own, ready, new Date(+now - 1)),
    cancelled = lesson(own, ready, new Date(+now + 1), { status: 'CANCELLED' });
  lesson(other, foreign, new Date(+now + 2));
  lesson(own, ready, new Date(+until + 1));
  const r = await get();
  expect(r.body.upcomingLessons.map((l) => l.lessonId)).toEqual([first.id, last.id]);
  expect(r.body.upcomingLessons[0].hasMeetLink).toBe(true);
  const calendar = await f.api(
    'get',
    `/api/v1/manager/schedule?from=${now.toISOString()}&to=${new Date(+until + 1).toISOString()}&status=SCHEDULED`,
  );
  expect(calendar.status).toBe(200);
  expect(r.body.upcomingLessons.map((x) => x.lessonId)).toEqual(
    calendar.body
      .filter((x) => new Date(x.startsAt) >= now && new Date(x.startsAt) <= until)
      .slice(0, 10)
      .map((x) => x.lessonId),
  );
  expect(JSON.stringify(r.body)).not.toContain('meet.google.com');
  expect(JSON.stringify(r.body)).not.toContain('FOREIGN');
  f.state.lessons.get(first.id).meet_link_overridden = true;
  expect((await get()).body.upcomingLessons[0].hasMeetLink).toBe(false);
  for (let i = 0; i < 12; i++) lesson(own, ready, new Date(+now + 100 + i));
  const top = (await get()).body.upcomingLessons;
  expect(top).toHaveLength(10);
  expect(top[0].lessonId).toBe(first.id);
  expect(top.some((l) => l.lessonId === removed.id || l.lessonId === cancelled.id)).toBe(false);
});
test('overdue count/top agree with MGR07 and ignore hidden, closed, future, malformed or cross-student tasks', async () => {
  const own = f.addStudent(),
    other = f.addStudent(1);
  for (let i = 0; i < 8; i++)
    await fx.addTask(own, 'MANUAL', { due_at: new Date(+f.state.now - 100 - i) });
  await fx.addTask(other, 'MANUAL', { due_at: new Date(+f.state.now - 1000) });
  await fx.addTask(own, 'FOLLOW_UP', { due_at: new Date(+f.state.now - 1000) });
  await fx.addTask(own, 'MANUAL', { status: 'REJECTED', due_at: new Date(+f.state.now - 1) });
  await fx.addTask(own, 'MANUAL', { due_at: f.state.now });
  await fx.addTask(own, 'SUBSCRIPTION_EXPIRING', {
    payload: { subscriptionId: 'invalid' },
    due_at: new Date(+f.state.now - 1),
  });
  const result = await get(),
    list = await f.api('get', '/api/v1/manager/tasks?overdue=true&limit=100');
  expect(result.status).toBe(200);
  expect(list.status).toBe(200);
  expect(result.body.overdueTasks.count).toBe(list.body.items.length);
  expect(result.body.overdueTasks.top.map((t) => t.taskId)).toEqual(
    list.body.items.slice(0, 5).map((t) => t.taskId),
  );
  expect(result.body.overdueTasks.count).toBe(8);
});
test.each([3, 7, 14])(
  'expiry%s boundaries at school midnight exclude frozen and agree with MGR04 quantities',
  async (days) => {
    f.state.now = schoolMidnight('2026-11-01', 'Europe/Chisinau');
    const own = f.addStudent(),
      other = f.addStudent(1),
      end = subscriptionExpiryUntil(f.state.now, days),
      first = fx.readyFor(own, { ends_at: end });
    fx.readyFor(own, { ends_at: f.state.now });
    fx.readyFor(own, { ends_at: new Date(+end + 1) });
    fx.readyFor(own, { ends_at: end, status: 'FROZEN' });
    fx.readyFor(other, { ends_at: end });
    const r = await get(`?expiringDays=${days}`);
    expect(r.status).toBe(200);
    expect(r.body.expiringSubscriptions).toEqual([
      {
        subscriptionId: first.subscriptionId,
        studentId: own.id,
        studentName: own.full_name,
        endsAt: end.toISOString(),
        remainingLessons: 8,
      },
    ]);
    const list = await f.api('get', `/api/v1/manager/students/${own.id}/subscriptions`);
    expect(list.status).toBe(200);
    const expected = list.body.filter(
      (s) => s.status === 'ACTIVE' && new Date(s.endsAt) > f.state.now && new Date(s.endsAt) <= end,
    );
    expect(
      r.body.expiringSubscriptions.map((x) => ({
        id: x.subscriptionId,
        remaining: x.remainingLessons,
      })),
    ).toEqual(expected.map((x) => ({ id: x.id, remaining: x.remainingLessons })));
  },
);
test('pending combines waiting and published unallocated remainder exactly per currency without double counting', async () => {
  const own = f.addStudent(),
    foreign = f.addStudent(1),
    ready = fx.readyFor(own);
  fx.receipt(own, '0.1001');
  fx.receipt(own, '0.2002', { approval_requested_at: f.state.now });
  fx.receipt(own, '0.1234', { currency: 'EUR' });
  fx.receipt(foreign, '99999.9999');
  fx.receipt(own, '500', { rejected_at: f.state.now });
  const paid = fx.receipt(own, '10.0000', {
    confirmed_by_director_at: f.state.now,
    confirmed_by_director_id: f.accounts[4].staffId,
  });
  fx.post(paid, '10.0000');
  const distribution = {
    id: randomUUID(),
    payment_id: paid.id,
    subscription_id: ready.pkg.subscription_id,
    amount: '7.0001',
    approved_at: f.state.now,
  };
  f.state.funding.set(distribution.id, distribution);
  fx.post(paid, '7.0001', distribution);
  const full = fx.receipt(own, '20', { confirmed_by_director_at: f.state.now });
  fx.post(full, '20');
  const all = {
    id: randomUUID(),
    payment_id: full.id,
    subscription_id: ready.pkg.subscription_id,
    amount: '20',
    approved_at: f.state.now,
  };
  f.state.funding.set(all.id, all);
  fx.post(full, '20', all);
  const r = await get();
  expect(r.status).toBe(200);
  expect(r.body.pendingPayments).toEqual({
    count: 4,
    totalsByCurrency: [
      { currency: 'EUR', amount: '0.1234' },
      { currency: 'MDL', amount: '3.3002' },
    ],
  });
  const list = await f.api('get', `/api/v1/manager/students/${own.id}/payments?status=PENDING`);
  expect(list.status).toBe(200);
  expect(list.body.items.every((p) => p.status === 'PENDING')).toBe(true);
});
test('mixed-portfolio household receipts and explicit foreign-recipient distributions are excluded from aggregates', async () => {
  const a = f.addStudent(),
    b = f.addStudent(1),
    house = randomUUID();
  f.state.memberships = [a, b].map((st) => ({
    household_id: house,
    student_id: st.id,
    status: 'ACTIVE',
    valid_from: new Date('2020-01-01'),
    valid_to: null,
  }));
  fx.receipt(a, '100');
  expect((await get()).body.pendingPayments.count).toBe(0);
  b.managerId = a.managerId;
  expect((await get()).body.pendingPayments.totalsByCurrency).toEqual([
    { currency: 'MDL', amount: '100.0000' },
  ]);
  const other = f.addStudent(1),
    ready = fx.readyFor(other),
    p = fx.receipt(a, '200');
  f.state.funding.set(randomUUID(), {
    id: randomUUID(),
    payment_id: p.id,
    subscription_id: ready.pkg.subscription_id,
  });
  expect((await get()).body.pendingPayments.count).toBe(1);
});
test('counter/list and all time bounds use the transaction snapshot despite a concurrent mock change', async () => {
  const own = f.addStudent(),
    ready = fx.readyFor(own, { ends_at: new Date(+f.state.now + 86400000) });
  lesson(own, ready, new Date(+f.state.now + 3600000));
  const original = f.state.now.toISOString();
  fx.afterStudents(() => {
    own.managerId = f.accounts[1].staffId;
    f.state.now = new Date(+f.state.now + 10 * 86400000);
    f.state.lessons.clear();
  });
  const r = await get();
  expect(r.status).toBe(200);
  expect(r.body.generatedAt).toBe(original);
  expect(r.body.students.active).toBe(1);
  expect(r.body.upcomingLessons).toHaveLength(1);
  expect(r.body.expiringSubscriptions).toHaveLength(1);
  expect(fx.captured[0].readCount).toBe(6);
});
test('large exact decimals and published reversal of an allocation are reflected without float arithmetic', async () => {
  const own = f.addStudent(),
    ready = fx.readyFor(own);
  fx.receipt(own, '9007199254740993.1234');
  fx.receipt(own, '0.0001');
  expect((await get()).body.pendingPayments.totalsByCurrency).toEqual([
    { currency: 'MDL', amount: '9007199254740993.1235' },
  ]);
  f.state.receipts.clear();
  const paid = fx.receipt(own, '10', { confirmed_by_director_at: f.state.now });
  fx.post(paid, '10');
  const distribution = {
    id: randomUUID(),
    payment_id: paid.id,
    subscription_id: ready.pkg.subscription_id,
  };
  f.state.funding.set(distribution.id, distribution);
  const posted = fx.post(paid, '4', distribution),
    doc = randomUUID(),
    entry = randomUUID();
  f.state.documents.set(doc, { id: doc, correction_of_document_id: posted.id });
  f.state.entries.set(entry, {
    id: entry,
    document_id: doc,
    reverses_entry_id: posted.entry,
    published_at: f.state.now,
    effective_at: f.state.now,
  });
  f.state.lines.push({
    entry_id: entry,
    account_type: 'UNALLOCATED_FUNDS',
    direction: 'CREDIT',
    currency: 'MDL',
    amount: '4',
  });
  expect((await get()).body.pendingPayments).toEqual({
    count: 1,
    totalsByCurrency: [{ currency: 'MDL', amount: '10.0000' }],
  });
});
test('DB errors are generic, and a deactivated profile in the snapshot is denied', async () => {
  f.addStudent();
  f.state.failDashboardSql = true;
  let r = await get();
  expect(r.status).toBe(503);
  expect(JSON.stringify(r.body)).not.toMatch(/private|phone|email|SELECT/);
  f.state.failDashboardSql = false;
  f.state.inactiveSnapshot = true;
  r = await get();
  expect(r.status).toBe(403);
  expect(r.body.code).toBe('MANAGER_INACTIVE');
});

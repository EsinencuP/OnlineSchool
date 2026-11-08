import { beforeAll, beforeEach, afterAll, afterEach, expect, test } from '@jest/globals';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../../packages/db/dist/index.js';
import { managerTasksFixture } from '../support/manager-tasks-fixture.mjs';
let fx, f, own, foreign, ready;
const capturedSql = new Set();
const previousCursorSecret = process.env.MANAGER_CURSOR_SECRET;
afterEach(() => {
  for (const q of f.state.queries) capturedSql.add(q.text);
});
beforeAll(async () => {
  fx = await managerTasksFixture();
  f = fx.f;
});
afterAll(async () => {
  await writeFile(join(tmpdir(), 'online-school-mgr07-sql.json'), JSON.stringify([...capturedSql]));
  if (previousCursorSecret === undefined) delete process.env.MANAGER_CURSOR_SECRET;
  else process.env.MANAGER_CURSOR_SECRET = previousCursorSecret;
  await f?.app.close();
});
beforeEach(async () => {
  await f.reset();
  own = f.addStudent();
  foreign = f.addStudent(1);
  ready = fx.readyFor(own);
});
const call = (id, action, body, key = randomUUID(), index = 0) =>
  f.api('post', `/api/v1/manager/tasks/${id}/${action}`, index, { key, body });
const claim = (task) => call(task.id, 'claim', { version: task.version });
const get = (id) => f.api('get', `/api/v1/manager/tasks/${id}`);
test('reschedule request→claim→approve moves the stable lesson and resolves the task in one transaction', async () => {
  const lesson = await f.api('post', `/api/v1/manager/students/${own.id}/lessons`, 0, {
    key: randomUUID(),
    body: {
      teacherId: ready.teacherId,
      subscriptionId: ready.subscriptionId,
      startsAt: '2026-11-02T10:00:00Z',
      durationMinutes: 60,
    },
  });
  const task = await fx.addTask(own, 'RESCHEDULE_REQUEST', {
    lesson_id: lesson.body.lessonId,
    payload: { reason: 'Please move', preferredDate: '2026-11-03' },
  });
  const c = await claim(task);
  expect(c.status).toBe(200);
  expect(c.body).toMatchObject({ status: 'IN_PROGRESS', version: 2 });
  const r = await call(task.id, 'resolve-reschedule', {
    decision: 'APPROVE',
    newStartsAt: '2026-11-03T10:00:00Z',
    version: 2,
  });
  expect(r.status).toBe(200);
  expect(r.body).toMatchObject({ status: 'RESOLVED', version: 3 });
  expect(f.state.lessons.get(lesson.body.lessonId).scheduled_at.toISOString()).toBe(
    '2026-11-03T10:00:00.000Z',
  );
  expect(
    f.state.outbox.some(
      (e) => e.topic === 'manager.task.decision.v1' && e.payload.status === 'RESOLVED',
    ),
  ).toBe(true);
});
test('ACCEPT escalates without money; director reverses the original charge once and resolves the dispute', async () => {
  const charge = await fx.charged(own, ready),
    task = await fx.addTask(own, 'ATTENDANCE_DISPUTE', {
      lesson_id: charge.lessonId,
      original_consumption_id: charge.consumptionId,
      payload: { description: 'Please review charge' },
    });
  expect((await claim(task)).status).toBe(200);
  const proposal = await call(task.id, 'resolve-dispute', {
    decision: 'ACCEPT',
    reason: 'Approved full correction',
    refundLessons: 1,
    version: 2,
  });
  expect(proposal.status).toBe(200);
  expect(proposal.body).toMatchObject({
    status: 'IN_PROGRESS',
    version: 3,
    approvalStatus: 'AWAITING_DIRECTOR',
  });
  expect(f.state.adjustments.size).toBe(0);
  const reviewed = await f.api('get', `/api/v1/dispute-resolutions/${task.id}`, 4);
  expect(reviewed.status).toBe(200);
  expect(reviewed.body).toMatchObject({
    mode: 'FULL_REVERSAL',
    fullAmount: '125.0000',
    fullLessons: 1,
  });
  const r = await f.api('post', `/api/v1/dispute-resolutions/${task.id}/approve`, 4, {
    key: randomUUID(),
    body: { version: 3 },
  });
  expect(r.status).toBe(200);
  expect(r.body.status).toBe('RESOLVED');
  expect(f.state.adjustments.size).toBe(1);
  expect(f.state.tasks.get(task.id).ledger_publication_id).toBe(r.body.ledgerPublicationId);
  expect(f.state.consumptions.get(charge.consumptionId).cancelled_at).not.toBeNull();
  expect((await get(task.id)).body.status).toBe('RESOLVED');
});

const rescheduleTask = async (extra = {}) => {
  const l = await f.api('post', `/api/v1/manager/students/${own.id}/lessons`, 0, {
    key: randomUUID(),
    body: {
      teacherId: ready.teacherId,
      subscriptionId: ready.subscriptionId,
      startsAt: '2026-11-02T10:00:00Z',
      durationMinutes: 60,
      ...extra,
    },
  });
  expect(l.status).toBe(201);
  return fx.addTask(own, 'RESCHEDULE_REQUEST', {
    lesson_id: l.body.lessonId,
    payload: { reason: 'Please reschedule', preferredDate: '2026-11-03' },
  });
};
const disputeTask = async (extra = {}) => {
  const charge = await fx.charged(own, ready);
  return fx.addTask(own, 'ATTENDANCE_DISPUTE', {
    lesson_id: charge.lessonId,
    original_consumption_id: charge.consumptionId,
    payload: { description: 'Please review charge' },
    ...extra,
  });
};
const propose = async (task, extra = {}) => {
  await claim(task);
  return call(task.id, 'resolve-dispute', {
    decision: 'ACCEPT',
    reason: 'Full correction request',
    refundLessons: 1,
    version: 2,
    ...extra,
  });
};
const approve = (id, version = 3, key = randomUUID(), index = 4) =>
  f.api('post', `/api/v1/dispute-resolutions/${id}/approve`, index, { key, body: { version } });
const advance = () =>
  f.state.lines
    .filter(
      (l) => f.state.entries.get(l.entry_id)?.published_at && l.account_type === 'CUSTOMER_ADVANCE',
    )
    .reduce(
      (n, l) => (l.direction === 'CREDIT' ? n.add(l.amount) : n.sub(l.amount)),
      new Prisma.Decimal(0),
    );

test('queue filters compose, keyset order is stable, terminal tasks are never overdue', async () => {
  process.env.MANAGER_CURSOR_SECRET ??= 'task-cursor-test-secret-32-characters';
  const a = await fx.addTask(own, 'MANUAL', { due_at: new Date(+f.state.now - 1) }),
    b = await fx.addTask(own, 'MANUAL', { due_at: a.due_at }),
    future = await fx.addTask(own),
    closed = await fx.addTask(own, 'MANUAL', { status: 'REJECTED', due_at: a.due_at });
  await fx.addTask(foreign, 'MANUAL', { due_at: a.due_at });
  await fx.addTask(own, 'FOLLOW_UP', { due_at: a.due_at });
  const base = '/api/v1/manager/tasks?type=GENERAL&status=OPEN,IN_PROGRESS&overdue=true&limit=1';
  const first = await f.api('get', base);
  expect(first.status).toBe(200);
  expect(first.body.items).toHaveLength(1);
  expect(first.body.items[0].isOverdue).toBe(true);
  expect(first.body.nextCursor.length).toBeLessThanOrEqual(200);
  const next = await f.api('get', base + '&cursor=' + encodeURIComponent(first.body.nextCursor));
  expect(next.status).toBe(200);
  expect(new Set([...first.body.items, ...next.body.items].map((t) => t.taskId))).toEqual(
    new Set([a.id, b.id]),
  );
  expect(next.body.nextCursor).toBeNull();
  expect(
    (
      await f.api(
        'get',
        `/api/v1/manager/tasks?studentId=${own.id}&dueBefore=${encodeURIComponent(future.due_at.toISOString())}&overdue=false`,
      )
    ).body.items.map((t) => t.taskId),
  ).toEqual([closed.id]);
  expect((await get(closed.id)).body.isOverdue).toBe(false);
  expect(
    (
      await f.api(
        'get',
        base.replace('GENERAL', 'CHARGE_DISPUTE') + '&cursor=' + first.body.nextCursor,
      )
    ).body.code,
  ).toBe('INVALID_CURSOR');
  expect((await f.api('get', `/api/v1/manager/tasks?studentId=${foreign.id}`)).status).toBe(404);
});
test.each([
  'overdue=garbage',
  'status=NOT_A_STATUS',
  'type=FOLLOW_UP',
  'limit=101',
  'dueBefore=2026-11-01',
  'cursor=bad',
])('invalid queue filter %s is rejected', async (query) => {
  expect((await f.api('get', '/api/v1/manager/tasks?' + query)).status).toBe(422);
});
test('foreign, disallowed and absent tasks produce identical TASK_NOT_FOUND', async () => {
  const hidden = await fx.addTask(own, 'FOLLOW_UP', { title: 'PRIVATE EDUCATION' }),
    other = await fx.addTask(foreign, 'MANUAL', { title: 'PRIVATE PORTFOLIO' });
  for (const id of [hidden.id, other.id, randomUUID()]) {
    const r = await get(id);
    expect(r.status).toBe(404);
    expect(r.body.code).toBe('TASK_NOT_FOUND');
    expect(JSON.stringify(r.body)).not.toMatch(/PRIVATE/);
  }
});
test('claim CAS, replay and parallel claim advance exactly once', async () => {
  const task = await fx.addTask(own),
    key = randomUUID();
  const first = await call(task.id, 'claim', { version: 1 }, key);
  expect(first.status).toBe(200);
  expect((await call(task.id, 'claim', { version: 1 }, key)).body).toEqual(first.body);
  expect((await claim(task)).body.code).toBe('TASK_VERSION_CONFLICT');
  expect(f.state.audit.filter((a) => a.action === 'TASK_CLAIMED')).toHaveLength(1);
  const second = await fx.addTask(own),
    results = await Promise.all([claim(second), claim(second)]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
});
test('resolution requires claim and the route must match the task type', async () => {
  const task = await rescheduleTask();
  expect(
    (
      await call(task.id, 'resolve-reschedule', {
        decision: 'DECLINE',
        reason: 'not agreed',
        version: 1,
      })
    ).body.code,
  ).toBe('TASK_NOT_IN_PROGRESS');
  const general = await fx.addTask(own);
  expect(
    (
      await call(general.id, 'resolve-dispute', {
        decision: 'REJECT',
        reason: 'wrong route',
        version: 1,
      })
    ).body.code,
  ).toBe('TASK_TYPE_MISMATCH');
});
test.each(['slot', 'cas', 'audit', 'outbox'])(
  '%s failure rolls back lesson change and task resolution together',
  async (failure) => {
    const task = await rescheduleTask();
    await claim(task);
    const start = f.state.lessons.get(task.lesson_id).scheduled_at.toISOString();
    if (failure === 'slot') f.state.failExclusion = true;
    if (failure === 'cas') f.state.failTaskCas = true;
    if (failure === 'audit') f.state.failAudit = 'TASK_RESCHEDULE_APPROVED';
    if (failure === 'outbox') f.state.failOutbox = true;
    const r = await call(task.id, 'resolve-reschedule', {
      decision: 'APPROVE',
      newStartsAt: '2026-11-03T10:00:00Z',
      version: 2,
    });
    expect(r.status).toBe(['slot', 'cas'].includes(failure) ? 409 : 503);
    expect(f.state.tasks.get(task.id)).toMatchObject({ status: 'IN_PROGRESS', version: 2 });
    expect(f.state.lessons.get(task.lesson_id).scheduled_at.toISOString()).toBe(start);
  },
);
test('decline preserves the slot, requires a reason and records one terminal decision', async () => {
  const task = await rescheduleTask();
  await claim(task);
  expect(
    (await call(task.id, 'resolve-reschedule', { decision: 'DECLINE', version: 2 })).status,
  ).toBe(422);
  const key = randomUUID(),
    body = { decision: 'DECLINE', reason: 'No agreement reached', version: 2 },
    r = await call(task.id, 'resolve-reschedule', body, key);
  expect(r.body.status).toBe('REJECTED');
  expect((await call(task.id, 'resolve-reschedule', body, key)).body).toEqual(r.body);
  expect((await call(task.id, 'resolve-reschedule', body)).body.code).toBe('TASK_ALREADY_RESOLVED');
  expect(f.state.lessons.get(task.lesson_id).scheduled_at.toISOString()).toBe(
    '2026-11-02T10:00:00.000Z',
  );
});
test('pending Schedule director exception does not resolve the task prematurely', async () => {
  const task = await rescheduleTask({ startsAt: '2026-10-31T12:00:00Z' });
  await claim(task);
  const body = {
    decision: 'APPROVE',
    newStartsAt: '2026-11-03T10:00:00Z',
    reason: 'Emergency family request',
    overrideLateRule: true,
    version: 2,
  };
  const pending = await call(task.id, 'resolve-reschedule', body);
  expect(pending.status).toBe(200);
  expect(pending.body).toMatchObject({
    status: 'IN_PROGRESS',
    version: 3,
    approvalStatus: 'AWAITING_SCHEDULE_APPROVAL',
  });
  const request = f.state.tasks.get(task.id).decision.changeRequestId;
  expect(
    (
      await f.api('post', `/api/v1/schedule-change-approvals/${request}/approve`, 4, {
        key: randomUUID(),
        body: {},
      })
    ).status,
  ).toBe(200);
  const done = await call(task.id, 'resolve-reschedule', { ...body, version: 3 });
  expect(done.body.status).toBe('RESOLVED');
  expect(done.body.payload.currentStartsAt).toBe('2026-11-03T10:00:00.000Z');
});
test.each([{}, { refundLessons: 0 }])(
  'ACCEPT without a positive requested effect %p returns REFUND_REQUIRED',
  async (extra) => {
    const task = await disputeTask();
    await claim(task);
    const r = await call(task.id, 'resolve-dispute', {
      decision: 'ACCEPT',
      reason: 'check',
      version: 2,
      ...extra,
    });
    expect(r.status).toBe(422);
    expect(r.body.code).toBe('REFUND_REQUIRED');
  },
);
test.each([{ refundAmount: '125.0001' }, { refundLessons: 2 }])(
  'refund larger than the original %p is rejected',
  async (extra) => {
    const task = await disputeTask();
    await claim(task);
    const r = await call(task.id, 'resolve-dispute', {
      decision: 'ACCEPT',
      reason: 'check',
      version: 2,
      ...extra,
    });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('DISPUTE_REFUND_EXCEEDS_CHARGE');
    expect(f.state.adjustments.size).toBe(0);
  },
);
test.each([
  { refundAmount: '10', refundLessons: undefined },
  { refundAmount: '125', refundLessons: 0 },
])(
  'partial/independent request %p stays in manual review and cannot be auto-approved',
  async (extra) => {
    const task = await disputeTask();
    const p = await propose(task, extra);
    expect(p.status).toBe(200);
    expect(p.body.approvalStatus).toBe('MANUAL_FINANCE_REVIEW');
    expect((await approve(task.id)).body.code).toBe('MANUAL_FINANCE_REVIEW_REQUIRED');
    expect(f.state.adjustments.size).toBe(0);
    expect(f.state.tasks.get(task.id).status).toBe('IN_PROGRESS');
  },
);
test('REJECT and ESCALATE leave the student advance unchanged', async () => {
  const task = await disputeTask(),
    before = advance().toFixed(4);
  await claim(task);
  const escalated = await call(task.id, 'resolve-dispute', {
    decision: 'ESCALATE',
    reason: 'Need director review',
    version: 2,
  });
  expect(escalated.body).toMatchObject({
    status: 'IN_PROGRESS',
    version: 3,
    approvalStatus: 'MANUAL_FINANCE_REVIEW',
  });
  const rejected = await call(task.id, 'resolve-dispute', {
    decision: 'REJECT',
    reason: 'Charge confirmed',
    version: 3,
  });
  expect(rejected.body.status).toBe('REJECTED');
  expect(advance().toFixed(4)).toBe(before);
  expect(f.state.adjustments.size).toBe(0);
});
test('full director reversal restores exact posted advance and rights, without changing the lesson outcome', async () => {
  const task = await disputeTask(),
    before = advance(),
    beforeLessons =
      f.state.grants.get(ready.grantId).quantity -
      [...f.state.consumptions.values()].filter((c) => !c.cancelled_at).length;
  await propose(task);
  const key = randomUUID(),
    r = await approve(task.id, 3, key);
  expect(r.status).toBe(200);
  expect((await approve(task.id, 3, key)).body).toEqual(r.body);
  expect((await approve(task.id)).body.code).toBe('TASK_ALREADY_RESOLVED');
  expect(advance().sub(before).toFixed(4)).toBe('125.0000');
  expect(
    f.state.grants.get(ready.grantId).quantity -
      [...f.state.consumptions.values()].filter((c) => !c.cancelled_at).length,
  ).toBe(beforeLessons + 1);
  expect(f.state.lessons.get(task.lesson_id).status).toBe('CANCELLED');
  expect(f.state.adjustments.size).toBe(1);
});
test.each(['ledger', 'closed', 'audit', 'outbox', 'cas'])(
  'director %s failure rolls back adjustment, Ledger and task completion',
  async (failure) => {
    const task = await disputeTask();
    await propose(task);
    const entries = f.state.entries.size;
    if (failure === 'ledger') f.state.failLedger = true;
    if (failure === 'closed') f.state.closedPeriod = true;
    if (failure === 'audit') f.state.failAudit = 'TASK_DISPUTE_ACCEPTED';
    if (failure === 'outbox') f.state.failOutbox = true;
    if (failure === 'cas') f.state.failTaskCas = true;
    const r = await approve(task.id);
    expect(r.status).toBe(failure === 'cas' ? 409 : 503);
    expect(f.state.tasks.get(task.id)).toMatchObject({
      status: 'IN_PROGRESS',
      version: 3,
      ledger_publication_id: null,
    });
    expect(f.state.adjustments.size).toBe(0);
    expect(f.state.entries.size).toBe(entries);
    expect(f.state.consumptions.get(task.original_consumption_id).cancelled_at).toBeNull();
  },
);
test('a stale director review cannot approve a revised proposal', async () => {
  const task = await disputeTask();
  await propose(task);
  expect(
    (
      await call(task.id, 'resolve-dispute', {
        decision: 'ACCEPT',
        reason: 'Revised partial request',
        refundAmount: '10',
        version: 3,
      })
    ).body.version,
  ).toBe(4);
  expect((await approve(task.id, 3)).body.code).toBe('TASK_VERSION_CONFLICT');
  expect((await approve(task.id, 4)).body.code).toBe('MANUAL_FINANCE_REVIEW_REQUIRED');
});
test('competing director requests produce one reversal and one resolved task', async () => {
  const task = await disputeTask();
  await propose(task);
  const rs = await Promise.all([approve(task.id), approve(task.id)]);
  expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(f.state.adjustments.size).toBe(1);
  expect(f.state.tasks.get(task.id).version).toBe(4);
});
test('legacy task source is inferred only from one historical published charge; payload cannot select a different entry', async () => {
  const task = await disputeTask({
    original_consumption_id: null,
    payload: {
      description: '<img src=x onerror=alert(1)>',
      ledgerRef: 'FOREIGN ENTRY',
      private: 'SECRET',
    },
  });
  const r = await get(task.id);
  expect(r.status).toBe(200);
  expect(r.headers['content-type']).toContain('application/json');
  expect(r.body.payload.studentComment).toBe('<img src=x onerror=alert(1)>');
  expect(r.body.payload.ledgerRef).not.toBe('FOREIGN ENTRY');
  expect(JSON.stringify(r.body)).not.toContain('SECRET');
  expect((await propose(task)).body.approvalStatus).toBe('AWAITING_DIRECTOR');
  expect(f.state.tasks.get(task.id).original_consumption_id).toBe(
    [...f.state.consumptions.keys()][0],
  );
});
const routes = [
  ['get', '', undefined],
  ['get', '/TASK', undefined],
  ['post', '/TASK/claim', { version: 1 }],
  ['post', '/TASK/resolve-reschedule', { decision: 'DECLINE', reason: 'request', version: 1 }],
  ['post', '/TASK/resolve-dispute', { decision: 'REJECT', reason: 'request', version: 1 }],
];
test.each(routes.flatMap((r, i) => [null, 2, 3, 4, 5].map((index) => [i, index, r])))(
  'role matrix route%i actor%p',
  async (_i, index, [verb, path, body]) => {
    const task = await fx.addTask(own);
    expect(
      (
        await f.api(verb, '/api/v1/manager/tasks' + path.replace('TASK', task.id), index, {
          key: randomUUID(),
          body,
        })
      ).status,
    ).toBe(index === null ? 401 : 403);
  },
);
test.each(routes.slice(2))('%s %s requires CSRF and UUID idempotency', async (verb, path, body) => {
  const task = await fx.addTask(own);
  path = '/api/v1/manager/tasks' + path.replace('TASK', task.id);
  expect((await f.api(verb, path, 0, { csrf: false, key: randomUUID(), body })).status).toBe(403);
  expect((await f.api(verb, path, 0, { body })).body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
});
test('cached task replay is denied after the student leaves the portfolio', async () => {
  const task = await fx.addTask(own),
    key = randomUUID();
  expect((await call(task.id, 'claim', { version: 1 }, key)).status).toBe(200);
  f.state.students.get(own.id).managerId = f.accounts[1].staffId;
  expect((await call(task.id, 'claim', { version: 1 }, key)).body.code).toBe('TASK_NOT_FOUND');
});
test.each(['0', '-1', '1e2', '1.00001', 125])(
  'invalid refund money%p is rejected before Finance',
  async (refundAmount) => {
    const task = await disputeTask();
    await claim(task);
    expect(
      (
        await call(task.id, 'resolve-dispute', {
          decision: 'ACCEPT',
          reason: 'check money',
          refundAmount,
          version: 2,
        })
      ).status,
    ).toBe(422);
    expect(f.state.adjustments.size).toBe(0);
  },
);
test('source after task creation is not inferred and prior corrections require manual Finance review', async () => {
  const task = await disputeTask({
    original_consumption_id: null,
    created_at: new Date(+f.state.now - 1),
  });
  await claim(task);
  expect(
    (
      await call(task.id, 'resolve-dispute', {
        decision: 'ACCEPT',
        reason: 'source check',
        refundLessons: 1,
        version: 2,
      })
    ).body.code,
  ).toBe('DISPUTE_SOURCE_UNAVAILABLE');
  f.state.tasks.get(task.id).created_at = f.state.now;
  const source = [...f.state.consumptions.values()][0];
  f.state.adjustments.set(randomUUID(), {
    original_consumption_id: source.id,
    kind: 'GRANT_DELTA',
    delta_quantity: 1,
  });
  expect(
    (
      await call(task.id, 'resolve-dispute', {
        decision: 'ACCEPT',
        reason: 'source check',
        refundLessons: 1,
        version: 2,
      })
    ).body.approvalStatus,
  ).toBe('MANUAL_FINANCE_REVIEW');
});
test('director review/approve reject other roles and protect CSRF/key without posting', async () => {
  const task = await disputeTask();
  await propose(task);
  for (const actor of [null, 0, 1, 2, 3, 5]) {
    expect((await f.api('get', `/api/v1/dispute-resolutions/${task.id}`, actor)).status).toBe(
      actor === null ? 401 : 403,
    );
    expect((await approve(task.id, 3, randomUUID(), actor)).status).toBe(
      actor === null ? 401 : 403,
    );
  }
  const path = `/api/v1/dispute-resolutions/${task.id}/approve`;
  expect(
    (await f.api('post', path, 4, { key: randomUUID(), csrf: false, body: { version: 3 } })).status,
  ).toBe(403);
  expect((await f.api('post', path, 4, { body: { version: 3 } })).body.code).toBe(
    'IDEMPOTENCY_KEY_REQUIRED',
  );
  expect(f.state.adjustments.size).toBe(0);
});
test('claim serialization retries stop at three attempts with one Audit and one version increment', async () => {
  const a = await fx.addTask(own);
  f.state.failCommit = 2;
  expect((await claim(a)).status).toBe(200);
  expect(f.state.tasks.get(a.id).version).toBe(2);
  expect(f.state.audit.filter((x) => x.action === 'TASK_CLAIMED')).toHaveLength(1);
  const b = await fx.addTask(own);
  f.state.failCommit = 4;
  expect((await claim(b)).status).toBe(503);
  expect(f.state.tasks.get(b.id).version).toBe(1);
  expect(f.state.failCommit).toBe(1);
});
test('subscription-expiring uses the scoped managed subscription and ignores arbitrary payload extras', async () => {
  const t = await fx.addTask(own, 'SUBSCRIPTION_EXPIRING', {
    payload: { subscriptionId: ready.subscriptionId, private: 'PRIVATE' },
    due_at: f.state.now,
  });
  const r = await get(t.id);
  expect(r.status).toBe(200);
  expect(r.body.type).toBe('SUBSCRIPTION_EXPIRING');
  expect(r.body.payload.endsAt).toBe('2026-12-01T00:00:00.000Z');
  expect(JSON.stringify(r.body)).not.toContain('PRIVATE');
  expect(r.body.isOverdue).toBe(false);
});

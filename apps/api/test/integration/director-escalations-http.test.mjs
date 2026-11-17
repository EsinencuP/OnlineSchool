import 'reflect-metadata';
import { http as fetch } from '../../../../tests/support/http.mjs';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { before, after, test } from '../../../../tests/support/test-harness.mjs';
import pg from '../../../../packages/db/node_modules/pg/lib/index.js';
import { NestFactory } from '@nestjs/core';
import { createDirectClient } from '@online-school/db';
import { AppModule } from '../../dist/app.module.js';
import {
  ManagerTaskEscalation,
  ManagerTaskEscalationModule,
} from '../../dist/modules/operations/task-escalation.module.js';
import { urgentTaskPolicy } from '../../dist/modules/operations/escalation-policy.js';
import { SessionStore } from '../../dist/core/session/session.store.js';
import { QA, qaId, seedQA } from '../../../../packages/db/dist-tools/seed.js';

const url = process.env.TEACHER_TEST_DATABASE_URL;
assert.ok(url);
const target = new URL(url);
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname));
assert.match(target.pathname, /^\/online_school_test[a-z0-9_]*$/);
const client = createDirectClient({ DIRECT_URL: url }).value,
  pool = new pg.Pool({ connectionString: url });
const actors = {},
  tasks = {};
let app, worker, sweeper, base;
const MIN = 60_000;

before(async () => {
  // Student disputes need ledger facts; the timer is type-agnostic, so exercise it with a plain task type.
  process.env.URGENT_TASK_TYPES = 'FOLLOW_UP';
  assert.equal((await seedQA(client)).ok, true);
  await pool.query(
    "DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='task09_runtime') THEN CREATE ROLE task09_runtime LOGIN INHERIT; END IF; END $$",
  );
  await pool.query('GRANT online_school_runtime TO task09_runtime');
  const runtime = new URL(url);
  runtime.username = 'task09_runtime';
  runtime.password = '';
  process.env.DATABASE_URL = runtime.toString();
  process.env.CSRF_SIGNING_SECRET = randomBytes(48).toString('base64url');
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
  // The timer runs in the worker process; here it is driven directly.
  worker = await NestFactory.createApplicationContext(ManagerTaskEscalationModule, {
    logger: false,
  });
  sweeper = worker.get(ManagerTaskEscalation);
  const store = app.get(SessionStore);
  for (const [name, label] of [
    ['director', 'seed-director-001'],
    ['manager', 'seed-manager-001'],
    ['teacher', 'seed-teacher-001'],
  ]) {
    const accountId = qaId(label + '/auth');
    actors[name] = await client.$transaction(async (tx) =>
      store.issue(tx, accountId, (await tx.$queryRaw`SELECT clock_timestamp() AS now`)[0].now),
    );
  }
  await client.assignedManager.create({
    data: {
      manager_id: QA.managers[0],
      student_id: QA.students[0],
      assigned_at: new Date('2026-10-01Z'),
    },
  });
});
after(async () => {
  await worker?.close();
  await app?.close();
  await client.$disconnect();
  await pool.end();
});

const headers = (actor) => {
  const s = actors[actor];
  return { cookie: `__Host-school_session=${s.token}; __Host-school_csrf=${s.csrfToken}` };
};
async function send(method, path, actor, body) {
  const read = method === 'GET';
  const r = await fetch(base + '/api/v1/' + path, {
    method,
    headers: {
      ...headers(actor),
      ...(read
        ? {}
        : {
            'content-type': 'application/json',
            'idempotency-key': randomUUID(),
            'x-csrf-token': actors[actor].csrfToken,
          }),
    },
    ...(read ? {} : { body: JSON.stringify(body ?? {}) }),
  });
  return { status: r.status, body: await r.json() };
}
const urgent = (title, ageMinutes, extra = {}) =>
  client.crmTask.create({
    data: {
      type: 'FOLLOW_UP',
      student_id: QA.students[0],
      assigned_manager_id: QA.managers[0],
      title,
      due_at: new Date(Date.now() + 60 * MIN),
      created_at: new Date(Date.now() - ageMinutes * MIN),
      ...extra,
    },
  });
const run = async () => {
  const r = await sweeper.processDue();
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.value;
};
const escalations = (state = 'OPEN', query = '') =>
  send('GET', `director/escalations?state=${state}${query}`, 'director');

test('roles: director reads escalations, manager owns the working status', async () => {
  for (const actor of ['manager', 'teacher']) {
    for (const path of ['escalations', 'managers/availability']) {
      const r = await send('GET', 'director/' + path, actor);
      assert.equal(r.status, 403, `${path} as ${actor}`);
      assert.equal(r.body.code, 'FORBIDDEN_ROLE');
    }
  }
  for (const actor of ['director', 'teacher'])
    assert.equal((await send('GET', 'manager/availability', actor)).status, 403);
  const initial = await send('GET', 'manager/availability', 'manager');
  assert.deepEqual(initial.body, { status: 'AVAILABLE', changedAt: null });
  assert.equal(
    (await send('PUT', 'manager/availability', 'manager', { status: 'BUSY' })).status,
    422,
  );
  const me = await send('GET', 'director/me', 'director');
  assert.equal(me.body.openEscalations, 0);
});

test('an unclaimed urgent task is escalated only after the acceptance window', async () => {
  tasks.fresh = await urgent('Fresh dispute', 2);
  tasks.stale = await urgent('Stale dispute', 11);
  tasks.notUrgent = await urgent('Manual note', 30, { type: 'MANUAL' });
  tasks.claimed = await urgent('Claimed dispute', 30);
  const claim = await send('POST', `manager/tasks/${tasks.claimed.id}/claim`, 'manager', {
    version: 1,
  });
  assert.equal(claim.status, 200, JSON.stringify(claim.body));

  assert.equal(await run(), 1);
  assert.equal(await run(), 0, 'a second timer run does not duplicate');
  const list = await escalations();
  assert.equal(list.status, 200, JSON.stringify(list.body));
  assert.equal(list.body.items.length, 1);
  const e = list.body.items[0];
  assert.equal(e.taskId, tasks.stale.id);
  assert.equal(e.reason, 'ACCEPT_TIMEOUT');
  assert.equal(e.managerStatus, 'AVAILABLE');
  assert.equal(e.state, 'OPEN');
  assert.equal(e.taskType, 'FOLLOW_UP');
  assert.equal(e.primaryManagerId, QA.managers[0]);
  assert.ok(e.primaryManagerName && e.studentName);
  assert.equal(e.acceptedAt, null);
  tasks.staleEscalation = e.escalationId;
  assert.equal((await send('GET', 'director/me', 'director')).body.openEscalations, 1);

  // Escalation neither closes the task nor moves the client.
  const row = await client.crmTask.findUniqueOrThrow({ where: { id: tasks.stale.id } });
  assert.equal(row.status, 'OPEN');
  assert.equal(row.assigned_manager_id, QA.managers[0]);
  // A late manager acceptance must not create a second execution.
  const late = await send('POST', `manager/tasks/${tasks.stale.id}/claim`, 'manager', {
    version: 1,
  });
  assert.equal(late.status, 409);
  assert.equal(late.body.code, 'TASK_ESCALATED');
  // Audit and outbox carry the handoff.
  const audit = await client.auditEvent.findMany({
    where: { action: 'TASK_ESCALATED_TO_DIRECTOR', resource_id: tasks.stale.id },
  });
  assert.equal(audit.length, 1);
  assert.equal(audit[0].actor_kind, 'SYSTEM');
  assert.equal(
    await client.outboxEvent.count({
      where: { topic: 'manager.task.escalated.v1', aggregate_id: tasks.stale.id },
    }),
    1,
  );
});

test('an unavailable manager sends urgent tasks to the director at once', async () => {
  const set = await send('PUT', 'manager/availability', 'manager', { status: 'OFF_SHIFT' });
  assert.equal(set.status, 200, JSON.stringify(set.body));
  assert.equal(set.body.status, 'OFF_SHIFT');
  assert.ok(set.body.changedAt);
  assert.equal((await send('GET', 'manager/availability', 'manager')).body.status, 'OFF_SHIFT');
  const board = await send('GET', 'director/managers/availability', 'director');
  assert.equal(board.status, 200, JSON.stringify(board.body));
  assert.equal(board.body.managers.find((m) => m.managerId === QA.managers[0]).status, 'OFF_SHIFT');

  tasks.instant = await urgent('Brand new dispute', 0);
  // The earlier two-minute-old task was still waiting; its manager is off shift now.
  assert.equal(await run(), 2);
  const open = await escalations();
  const e = open.body.items.find((i) => i.taskId === tasks.instant.id);
  assert.ok(e, JSON.stringify(open.body));
  assert.equal(e.reason, 'MANAGER_UNAVAILABLE');
  assert.equal(e.managerStatus, 'OFF_SHIFT');
  tasks.instantEscalation = e.escalationId;
  const waited = open.body.items.find((i) => i.taskId === tasks.fresh.id);
  assert.equal(waited.reason, 'MANAGER_UNAVAILABLE');
  tasks.freshEscalation = waited.escalationId;

  // Back to work: new tasks wait for the window again.
  assert.equal(
    (await send('PUT', 'manager/availability', 'manager', { status: 'AVAILABLE' })).status,
    200,
  );
  tasks.waiting = await urgent('Waiting dispute', 1);
  assert.equal(await run(), 0);
});

test('the director accepts an escalation once; finished tasks close it', async () => {
  const path = (id) => `director/escalations/${id}/accept`;
  assert.equal((await send('POST', path(tasks.staleEscalation), 'manager', {})).status, 403);
  assert.equal((await send('POST', path(randomUUID()), 'director', {})).status, 404);
  assert.equal((await send('GET', `director/escalations/${randomUUID()}`, 'director')).status, 404);
  assert.equal((await send('GET', 'director/escalations/not-a-uuid', 'director')).status, 404);

  const accepted = await send('POST', path(tasks.staleEscalation), 'director', {});
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
  assert.equal(accepted.body.state, 'ACCEPTED');
  assert.ok(accepted.body.acceptedAt && accepted.body.acceptedByName);
  const again = await send('POST', path(tasks.staleEscalation), 'director', {});
  assert.equal(again.status, 409);
  assert.equal(again.body.code, 'ESCALATION_ALREADY_ACCEPTED');
  assert.deepEqual(
    (await escalations('ACCEPTED')).body.items.map((i) => i.escalationId),
    [tasks.staleEscalation],
  );
  assert.deepEqual(
    (await escalations('OPEN')).body.items.map((i) => i.escalationId).sort(),
    [tasks.freshEscalation, tasks.instantEscalation].sort(),
  );
  assert.equal((await send('GET', 'director/me', 'director')).body.openEscalations, 2);
  const detail = await send('GET', `director/escalations/${tasks.staleEscalation}`, 'director');
  assert.equal(detail.body.state, 'ACCEPTED');

  // The accepted facts are immutable at the database level.
  await assert.rejects(
    client.$executeRaw`UPDATE task_escalations SET reason='MANAGER_UNAVAILABLE' WHERE id=${tasks.staleEscalation}::uuid`,
  );

  // The director (or manager) finishes the task through its own flow; here only the state matters.
  for (const data of [
    { status: 'IN_PROGRESS' },
    { status: 'RESOLVED', resolved_at: new Date(), resolved_by_staff_id: QA.managers[0] },
  ])
    await client.crmTask.update({
      where: { id: tasks.instant.id },
      data: { ...data, version: { increment: 1 } },
    });
  const closed = await escalations('CLOSED');
  assert.deepEqual(
    closed.body.items.map((i) => i.escalationId),
    [tasks.instantEscalation],
  );
  const late = await send('POST', path(tasks.instantEscalation), 'director', {});
  assert.equal(late.status, 409);
  assert.equal(late.body.code, 'ESCALATION_CLOSED');
  assert.equal((await send('GET', 'director/me', 'director')).body.openEscalations, 1);
});

test('paging and input validation', async () => {
  const extra = [];
  for (const age of [40, 41, 42]) extra.push(await urgent(`Paged ${age}`, age));
  assert.equal(await run(), 3);
  const first = await escalations('OPEN', '&limit=2');
  assert.equal(first.body.items.length, 2);
  assert.ok(first.body.nextCursor);
  const second = await escalations(
    'OPEN',
    `&limit=2&cursor=${encodeURIComponent(first.body.nextCursor)}`,
  );
  assert.equal(second.body.items.length, 2);
  assert.equal(second.body.nextCursor, null);
  const all = [...first.body.items, ...second.body.items].map((i) => i.taskId).sort();
  assert.deepEqual(all, [tasks.fresh.id, ...extra.map((t) => t.id)].sort());
  assert.equal((await escalations('OPEN', '&cursor=garbage')).status, 422);
  assert.equal((await escalations('NOPE')).status, 422);
  assert.equal((await escalations('OPEN', '&limit=500')).status, 422);
});

test('the urgent catalog and window are configurable and validated', () => {
  const standard = urgentTaskPolicy({});
  assert.deepEqual(standard.value, {
    types: ['ATTENDANCE_DISPUTE', 'RESCHEDULE_REQUEST'],
    acceptMinutes: 10,
    lookbackHours: 24,
  });
  assert.equal(urgentTaskPolicy({ URGENT_ACCEPT_MINUTES: '15' }).value.acceptMinutes, 15);
  for (const env of [
    { URGENT_ACCEPT_MINUTES: '0' },
    { URGENT_ACCEPT_MINUTES: '500' },
    { URGENT_TASK_TYPES: 'NOPE' },
    { URGENT_TASK_TYPES: ' , ' },
  ])
    assert.equal(urgentTaskPolicy(env).error.code, 'URGENT_TASK_CONFIGURATION_INVALID');
});

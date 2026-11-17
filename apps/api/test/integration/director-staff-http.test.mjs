import 'reflect-metadata';
import { http as fetch } from '../../../../tests/support/http.mjs';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { before, after, test } from '../../../../tests/support/test-harness.mjs';
import pg from '../../../../packages/db/node_modules/pg/lib/index.js';
import { NestFactory } from '@nestjs/core';
import { createDirectClient } from '@online-school/db';
import { AppModule } from '../../dist/app.module.js';
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
  state = {};
let app, base;
const DAY = 86_400_000,
  HOUR = 3_600_000;
const iso = (ms) => new Date(ms).toISOString();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

before(async () => {
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
  // Start from a clean portfolio: only the student below belongs to the first manager.
  await client.assignedManager.updateMany({
    where: { ended_at: null },
    data: { ended_at: new Date('2026-10-02Z') },
  });
  await client.assignedManager.create({
    data: {
      manager_id: QA.managers[0],
      student_id: QA.students[0],
      assigned_at: new Date('2026-10-03Z'),
    },
  });
});
after(async () => {
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
const staff = (query = '') => send('GET', `director/staff${query}`, 'director');
const find = (r, id) => r.body.items.find((i) => i.id === id);

test('only the director sees the staff directory; it shows load per person', async () => {
  for (const actor of ['manager', 'teacher']) {
    for (const path of ['staff', `staff/MANAGER/${QA.managers[0]}`, 'handovers']) {
      const r = await send('GET', 'director/' + path, actor);
      assert.equal(r.status, 403, `${path} as ${actor}`);
    }
    assert.equal(
      (
        await send('POST', `director/students/${QA.students[0]}/manager`, actor, {
          managerId: QA.managers[1],
        })
      ).status,
      403,
    );
  }
  assert.equal((await fetch(base + '/api/v1/director/staff')).status, 401);
  const all = await staff();
  assert.equal(all.status, 200, JSON.stringify(all.body));
  const first = find(all, QA.managers[0]);
  assert.equal(first.kind, 'MANAGER');
  assert.equal(first.active, true);
  assert.equal(first.metrics.students, 1);
  assert.equal(first.metrics.availability, 'AVAILABLE');
  assert.equal(find(all, QA.managers[1]).metrics.students, 0);
  assert.equal(find(all, QA.teachers[0]).kind, 'TEACHER');
  assert.ok(find(all, QA.teachers[0]).metrics.activeStudents >= 1);
  assert.deepEqual(
    (await staff('?kind=TEACHER')).body.items.map((i) => i.kind),
    ['TEACHER', 'TEACHER'],
  );
  assert.equal((await staff('?kind=ADMIN')).status, 422);
  assert.equal((await staff('?search=zzzz-nobody')).body.items.length, 0);
  assert.equal((await staff('?active=false')).body.items.length, 0);
  const card = await send('GET', `director/staff/MANAGER/${QA.managers[0]}`, 'director');
  assert.equal(card.status, 200, JSON.stringify(card.body));
  assert.deepEqual(card.body.statusHistory, []);
  assert.equal(
    (await send('GET', `director/staff/MANAGER/${QA.teachers[0]}`, 'director')).status,
    404,
  );
  assert.equal(
    (await send('GET', 'director/staff/ADMIN/' + QA.managers[0], 'director')).status,
    404,
  );
});

test('a hand-over moves the client and its open tasks, keeps history and is journaled', async () => {
  const task = await client.crmTask.create({
    data: {
      type: 'FOLLOW_UP',
      student_id: QA.students[0],
      assigned_manager_id: QA.managers[0],
      title: 'Call about the next package',
      due_at: new Date(Date.now() + HOUR),
    },
  });
  const done = await client.crmTask.create({
    data: {
      type: 'FOLLOW_UP',
      student_id: QA.students[0],
      assigned_manager_id: QA.managers[0],
      title: 'Already finished task',
      due_at: new Date(Date.now() - HOUR),
    },
  });
  for (const data of [
    { status: 'IN_PROGRESS' },
    { status: 'RESOLVED', resolved_at: new Date(), resolved_by_staff_id: QA.managers[0] },
  ])
    await client.crmTask.update({
      where: { id: done.id },
      data: { ...data, version: { increment: 1 } },
    });

  const path = `director/students/${QA.students[0]}/manager`;
  assert.equal(
    (await send('POST', path, 'director', { managerId: QA.managers[0] })).body.code,
    'SAME_MANAGER',
  );
  assert.equal(
    (await send('POST', path, 'director', { managerId: randomUUID() })).body.code,
    'MANAGER_NOT_FOUND',
  );
  assert.equal(
    (await send('POST', path, 'director', { managerId: QA.teachers[0] })).body.code,
    'MANAGER_NOT_FOUND',
  );
  assert.equal(
    (await send('POST', path, 'director', { managerId: QA.managers[1], comment: 'x' })).status,
    422,
  );
  assert.equal(
    (
      await send('POST', `director/students/${randomUUID()}/manager`, 'director', {
        managerId: QA.managers[1],
      })
    ).status,
    404,
  );

  const moved = await send('POST', path, 'director', {
    managerId: QA.managers[1],
    comment: 'The first manager goes on leave',
  });
  assert.equal(moved.status, 200, JSON.stringify(moved.body));
  assert.equal(moved.body.subjectKind, 'STUDENT');
  assert.equal(moved.body.fromManagerId, QA.managers[0]);
  assert.equal(moved.body.toManagerId, QA.managers[1]);
  assert.equal(moved.body.movedTasks, 1, 'only the open task moves');
  assert.ok(moved.body.fromManagerName && moved.body.toManagerName);

  const current = await client.assignedManager.findMany({
    where: { student_id: QA.students[0] },
    orderBy: { assigned_at: 'asc' },
  });
  const open = current.filter((a) => !a.ended_at);
  assert.equal(open.length, 1);
  assert.equal(open[0].manager_id, QA.managers[1]);
  assert.ok(
    current.some((a) => a.manager_id === QA.managers[0] && a.ended_at),
    'the old assignment is kept',
  );
  const movedTask = await client.crmTask.findUniqueOrThrow({ where: { id: task.id } });
  assert.equal(movedTask.assigned_manager_id, QA.managers[1]);
  assert.equal(movedTask.version, 2);
  const finished = await client.crmTask.findUniqueOrThrow({ where: { id: done.id } });
  assert.equal(finished.assigned_manager_id, QA.managers[0], 'history stays with the executor');
  assert.equal(finished.resolved_by_staff_id, QA.managers[0]);

  await wait(2500);
  assert.equal(
    (await send('GET', `manager/students/${QA.students[0]}`, 'manager')).status,
    404,
    'the old manager lost the client',
  );

  const journal = await send('GET', `director/handovers?studentId=${QA.students[0]}`, 'director');
  assert.equal(journal.body.items.length, 1);
  assert.equal(journal.body.items[0].comment, 'The first manager goes on leave');
  await assert.rejects(client.$executeRaw`UPDATE manager_handovers SET comment='tampered text'`);
  const card = await send('GET', `director/staff/MANAGER/${QA.managers[1]}`, 'director');
  assert.equal(card.body.handovers.length, 1);
  assert.equal(card.body.metrics.students, 1);
  assert.equal(card.body.metrics.openTasks, 1);

  // A lead is handed over the same way, with its tasks.
  const subject = await client.subject.findFirstOrThrow({});
  const lead = await send('POST', 'manager/leads', 'manager', {
    audience: 'ADULT',
    contactName: 'Handover Lead',
    phone: `+373${Math.floor(60_000_000 + Math.random() * 9_000_000)}`,
    subjectId: subject.id,
    source: 'PHONE',
  });
  assert.equal(lead.status, 201, JSON.stringify(lead.body));
  const leadMove = await send('POST', `director/leads/${lead.body.leadId}/manager`, 'director', {
    managerId: QA.managers[1],
  });
  assert.equal(leadMove.status, 200, JSON.stringify(leadMove.body));
  assert.equal(leadMove.body.subjectKind, 'LEAD');
  assert.equal(leadMove.body.movedTasks, 2, 'follow-up and teacher-assignment tasks');
  assert.equal(
    (
      await send('POST', `director/leads/${randomUUID()}/manager`, 'director', {
        managerId: QA.managers[1],
      })
    ).status,
    404,
  );
});

test('a manager can only be deactivated without clients; a teacher without future lessons', async () => {
  const off = (kind, id, body = { reason: 'Left the school' }) =>
    send('POST', `director/staff/${kind}/${id}/deactivate`, 'director', body);
  const on = (kind, id) =>
    send('POST', `director/staff/${kind}/${id}/reactivate`, 'director', {
      reason: 'Came back to work',
    });
  assert.equal((await off('MANAGER', QA.managers[1])).body.code, 'MANAGER_HAS_PORTFOLIO');
  assert.equal((await off('MANAGER', QA.managers[0], { reason: 'x' })).status, 422);
  assert.equal((await off('MANAGER', QA.teachers[0])).status, 404);
  assert.equal(
    (
      await send('POST', `director/staff/MANAGER/${QA.managers[0]}/deactivate`, 'manager', {
        reason: 'self leave',
      })
    ).status,
    403,
  );

  const gone = await off('MANAGER', QA.managers[0]);
  assert.equal(gone.status, 200, JSON.stringify(gone.body));
  assert.equal(gone.body.active, false);
  assert.ok(gone.body.deactivatedAt);
  assert.equal((await off('MANAGER', QA.managers[0])).body.code, 'STAFF_ALREADY_INACTIVE');
  assert.equal((await staff('?active=false')).body.items.length, 1);
  const me = await send('GET', 'manager/me', 'manager');
  assert.equal(me.status, 403, 'a deactivated manager is locked out');
  assert.equal(me.body.code, 'MANAGER_INACTIVE');
  const target = await send('POST', `director/students/${QA.students[0]}/manager`, 'director', {
    managerId: QA.managers[0],
  });
  assert.equal(target.body.code, 'MANAGER_NOT_FOUND', 'cannot hand over to a deactivated manager');
  const card = await send('GET', `director/staff/MANAGER/${QA.managers[0]}`, 'director');
  assert.equal(card.body.statusHistory[0].action, 'DEACTIVATED');
  assert.equal(card.body.statusHistory[0].reason, 'Left the school');
  assert.equal((await on('MANAGER', QA.managers[0])).body.active, true);
  assert.equal((await on('MANAGER', QA.managers[0])).body.code, 'STAFF_ALREADY_ACTIVE');
  assert.equal((await send('GET', 'manager/me', 'manager')).status, 200);

  // Teacher: a future lesson blocks deactivation; a free teacher disappears from manager options.
  const day = new Date(Date.now() + 12 * DAY);
  day.setUTCHours(6, 0, 0, 0);
  const window = await send('POST', 'teacher-availability', 'teacher', {
    startsAt: iso(+day),
    endsAt: iso(+day + 8 * HOUR),
    timezone: 'Europe/Chisinau',
  });
  assert.equal(window.status, 200, JSON.stringify(window.body));
  const lesson = await send('POST', 'lessons', 'director', {
    teachingAssignmentId: qaId('teaching-001'),
    startsAt: iso(+day + HOUR),
    endsAt: iso(+day + 2 * HOUR),
    basis: 'Staff lifecycle future lesson',
  });
  assert.equal(lesson.status, 200, JSON.stringify(lesson.body));
  assert.equal((await off('TEACHER', QA.teachers[0])).body.code, 'TEACHER_HAS_FUTURE_LESSONS');

  const free = await off('TEACHER', QA.teachers[1], { reason: 'Contract ended' });
  assert.equal(free.status, 200, JSON.stringify(free.body));
  assert.equal(free.body.active, false);
  await wait(300);
  const options = await send('GET', 'manager/options', 'manager');
  assert.ok(!options.body.teachers.some((t) => t.id === QA.teachers[1]));
  assert.equal((await on('TEACHER', QA.teachers[1])).body.active, true);
  const card2 = await send('GET', `director/staff/TEACHER/${QA.teachers[1]}`, 'director');
  assert.deepEqual(
    card2.body.statusHistory.map((c) => c.action),
    ['REACTIVATED', 'DEACTIVATED'],
  );
  await assert.rejects(client.$executeRaw`DELETE FROM staff_status_changes`);
});

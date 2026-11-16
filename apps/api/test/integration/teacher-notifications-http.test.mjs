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
const DAY = 86_400_000;

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
  await client.assignedManager.create({
    data: {
      manager_id: QA.managers[0],
      student_id: QA.students[0],
      assigned_at: new Date('2026-10-01Z'),
    },
  });
  const store = app.get(SessionStore);
  for (const [name, label] of [
    ['teacher', 'seed-teacher-001'],
    ['teacher2', 'seed-teacher-002'],
    ['director', 'seed-director-001'],
    ['manager', 'seed-manager-001'],
  ]) {
    const accountId = qaId(label + '/auth');
    actors[name] = await client.$transaction(async (tx) =>
      store.issue(tx, accountId, (await tx.$queryRaw`SELECT clock_timestamp() AS now`)[0].now),
    );
  }
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
  const r = await fetch(base + '/api/v1/' + path, {
    method,
    headers: {
      ...headers(actor),
      ...(method === 'GET'
        ? {}
        : {
            'content-type': 'application/json',
            'idempotency-key': randomUUID(),
            'x-csrf-token': actors[actor].csrfToken,
          }),
    },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }),
  });
  return { status: r.status, body: await r.json() };
}
const get = (path, actor) => send('GET', 'teacher/notifications' + path, actor);
const iso = (ms) => new Date(ms).toISOString();

test('a manager-side lesson, move and cancellation notify the teacher; own actions do not', async () => {
  assert.equal((await get('/summary', 'teacher')).body.unreadCount, 0);
  const day = new Date(Date.now() + 10 * DAY);
  day.setUTCHours(0, 0, 0, 0);
  const base0 = +day;
  const window = await send('POST', 'teacher-availability', 'teacher', {
    startsAt: iso(base0),
    endsAt: iso(base0 + 10 * 3_600_000),
    timezone: 'Europe/Chisinau',
  });
  assert.equal(window.status, 200, JSON.stringify(window.body));
  // The teacher's own availability change is not a notification.
  assert.equal((await get('/summary', 'teacher')).body.unreadCount, 0);

  const lesson = await send('POST', 'lessons', 'director', {
    teachingAssignmentId: qaId('teaching-001'),
    startsAt: iso(base0 + 3_600_000),
    endsAt: iso(base0 + 2 * 3_600_000),
    basis: 'Synthetic booking',
  });
  assert.equal(lesson.status, 200, JSON.stringify(lesson.body));
  state.lessonId = lesson.body.id;
  const moved = await send('PATCH', `lessons/${state.lessonId}/reschedule`, 'director', {
    startsAt: iso(base0 + 4 * 3_600_000),
    endsAt: iso(base0 + 5 * 3_600_000),
    reason: 'Synthetic move',
  });
  assert.equal(moved.status, 200, JSON.stringify(moved.body));
  const cancelled = await send('DELETE', `lessons/${state.lessonId}`, 'director', {
    reason: 'Synthetic cancellation',
  });
  assert.equal(cancelled.status, 200, JSON.stringify(cancelled.body));

  const feed = await get('', 'teacher');
  assert.equal(feed.status, 200, JSON.stringify(feed.body));
  assert.deepEqual(
    feed.body.items.map((i) => i.type),
    ['LESSON_CANCELLED', 'LESSON_RESCHEDULED', 'LESSON_SCHEDULED'],
  );
  assert.ok(
    feed.body.items.every(
      (i) => !i.read && i.targetKind === 'LESSON' && i.targetId === state.lessonId,
    ),
  );
  assert.ok(feed.body.items[0].studentName && feed.body.items[0].subjectName);
  assert.equal((await get('/summary', 'teacher')).body.unreadCount, 3);
  assert.equal((await get('', 'teacher2')).body.items.length, 0);
  state.keys = feed.body.items.map((i) => i.key);
});

test('homework submissions notify, paging is stable and read state is stored per event', async () => {
  const issued = await send('POST', 'teacher/homework', 'teacher', {
    title: 'Notification homework',
    description: 'Do the exercise',
    enrollmentIds: [
      (await client.teachingAssignment.findFirstOrThrow({ where: { teacher_id: QA.teachers[0] } }))
        .enrollment_id,
    ],
  });
  assert.equal(issued.status, 200, JSON.stringify(issued.body));
  const delivery = issued.body.deliveries[0];
  // Prisma stamps created_at with the application clock, the submission with the DB clock: absorb skew.
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await client.homeworkSubmission.create({
    data: {
      delivery_id: delivery.deliveryId,
      student_id: delivery.studentId,
      submitted_at: (await client.$queryRaw`SELECT clock_timestamp() AS now`)[0].now,
      version: 1,
      content: { text: 'Done' },
      source_operation_id: randomUUID(),
    },
  });
  const feed = await get('?state=UNREAD', 'teacher');
  assert.equal(feed.body.items.length, 4);
  assert.equal(feed.body.items[0].type, 'HOMEWORK_SUBMITTED');
  assert.equal(feed.body.items[0].targetKind, 'HOMEWORK');
  assert.equal(feed.body.items[0].targetId, delivery.deliveryId);

  const seen = [];
  let cursor;
  for (let n = 0; n < 8; n++) {
    const page = await get('?limit=1' + (cursor ? '&cursor=' + cursor : ''), 'teacher');
    assert.equal(page.status, 200, JSON.stringify(page.body));
    seen.push(...page.body.items.map((i) => i.key));
    cursor = page.body.nextCursor;
    if (!cursor) break;
  }
  assert.deepEqual(
    seen,
    feed.body.items.map((i) => i.key),
  );

  const one = feed.body.items[0].key;
  const marked = await send('POST', 'teacher/notifications/read', 'teacher', {
    keys: [one, state.keys[0]],
  });
  assert.equal(marked.status, 200, JSON.stringify(marked.body));
  assert.equal(marked.body.marked, 2);
  assert.equal(
    (await send('POST', 'teacher/notifications/read', 'teacher', { keys: [one] })).body.marked,
    0,
  );
  assert.equal((await get('/summary', 'teacher')).body.unreadCount, 2);
  assert.equal((await get('?state=UNREAD', 'teacher')).body.items.length, 2);
  // Another teacher cannot mark foreign keys: they are not part of their feed.
  assert.equal(
    (await send('POST', 'teacher/notifications/read', 'teacher2', { keys: [state.keys[1]] })).body
      .marked,
    0,
  );
  assert.equal((await get('?state=UNREAD', 'teacher')).body.items.length, 2);
});

test('read-all moves the mark; later events are unread again; input is validated', async () => {
  const all = await send('POST', 'teacher/notifications/read-all', 'teacher');
  assert.equal(all.status, 200, JSON.stringify(all.body));
  assert.equal(all.body.marked, 2);
  assert.equal((await get('/summary', 'teacher')).body.unreadCount, 0);
  assert.equal(
    (await get('', 'teacher')).body.items.every((i) => i.read),
    true,
  );

  await new Promise((resolve) => setTimeout(resolve, 20));
  const request = await send('POST', 'schedule-requests', 'teacher', {
    slotId: qaId('recurring-slot-001'),
    reason: 'Please move the series',
  });
  assert.equal(request.status, 200, JSON.stringify(request.body));
  // Requests become notifications only when a manager resolves them.
  assert.equal((await get('/summary', 'teacher')).body.unreadCount, 0);
  // Resolution is stamped by the application clock, the read mark by the DB clock: absorb skew.
  await new Promise((resolve) => setTimeout(resolve, 1500));
  // The manager sees the follow-up as a general task, claims and resolves it with a note.
  const tasks = await send('GET', 'manager/tasks?type=GENERAL&limit=100', 'manager');
  assert.equal(tasks.status, 200, JSON.stringify(tasks.body));
  const task = tasks.body.items.find((t) => /запросил/.test(t.payload.text));
  assert.ok(task, JSON.stringify(tasks.body.items.map((t) => t.payload)));
  const claimed = await send('POST', `manager/tasks/${task.taskId}/claim`, 'manager', {
    version: task.version,
  });
  assert.equal(claimed.status, 200, JSON.stringify(claimed.body));
  const premature = await send('POST', `manager/tasks/${task.taskId}/resolve`, 'manager', {
    version: claimed.body.version,
    note: 'ok',
  });
  assert.equal(premature.status, 422);
  const resolved = await send('POST', `manager/tasks/${task.taskId}/resolve`, 'manager', {
    version: claimed.body.version,
    note: 'Series moved to Friday',
  });
  assert.equal(resolved.status, 200, JSON.stringify(resolved.body));
  assert.equal(resolved.body.status, 'RESOLVED');
  const requests = await send('GET', 'teacher/schedule-requests', 'teacher');
  assert.equal(requests.body.items.find((r) => r.requestId === request.body.id).status, 'RESOLVED');
  assert.equal(
    (
      await send('POST', `manager/tasks/${task.taskId}/resolve`, 'manager', {
        version: 99,
        note: 'again',
      })
    ).status,
    409,
  );
  const summary = await get('/summary', 'teacher');
  assert.equal(summary.body.unreadCount, 1);
  const item = (await get('?state=UNREAD', 'teacher')).body.items[0];
  assert.equal(item.type, 'SCHEDULE_REQUEST_RESOLVED');
  assert.equal(item.targetKind, 'SCHEDULE_REQUEST');

  for (const bad of [
    {},
    { keys: [] },
    { keys: ['nope'] },
    { keys: ['lesson-change:1'] },
    { keys: [item.key], extra: 1 },
  ])
    assert.equal(
      (await send('POST', 'teacher/notifications/read', 'teacher', bad)).status,
      422,
      JSON.stringify(bad),
    );
  for (const query of ['?state=NOPE', '?limit=0', '?cursor=@@@', '?x=1'])
    assert.equal((await get(query, 'teacher')).status, 422, query);
  for (const actor of ['director', 'manager'])
    assert.equal((await get('', actor)).status, 403, actor);
});

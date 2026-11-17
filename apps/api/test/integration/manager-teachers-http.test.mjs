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
  await client.assignedManager.create({
    data: {
      manager_id: QA.managers[0],
      student_id: QA.students[0],
      assigned_at: new Date('2026-10-01Z'),
    },
  });
  const day = new Date(Date.now() + 3 * DAY);
  day.setUTCHours(6, 0, 0, 0);
  state.day = +day;
  state.assignment = await client.teachingAssignment.findFirstOrThrow({
    where: { teacher_id: QA.teachers[0] },
    include: { enrollment_ref: true },
  });
  state.subjectId = state.assignment.enrollment_ref.subject_id;
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
const teacherRow = (r, id) => r.body.items.find((t) => t.teacherId === id);

test('only a manager reads the teacher directory', async () => {
  for (const actor of ['director', 'teacher']) {
    for (const path of [
      'manager/teachers',
      `manager/teachers/${QA.teachers[0]}/availability?from=${iso(Date.now())}&to=${iso(Date.now() + DAY)}`,
      `manager/leads/${randomUUID()}/teacher-candidates`,
    ]) {
      const r = await send('GET', path, actor);
      assert.equal(r.status, 403, `${path} as ${actor}`);
      assert.equal(r.body.code, 'FORBIDDEN_ROLE');
    }
  }
  assert.equal((await fetch(base + '/api/v1/manager/teachers')).status, 401);
});

test('the directory shows subjects, load and free time and ranks by subject', async () => {
  const before = await send('GET', `manager/teachers?subjectId=${state.subjectId}`, 'manager');
  assert.equal(before.status, 200, JSON.stringify(before.body));
  assert.equal(before.body.items.length, 2);
  const first = teacherRow(before, QA.teachers[0]);
  assert.equal(first.teachesSubject, true);
  assert.ok(first.subjects.some((s) => s.id === state.subjectId));
  assert.ok(first.activeStudents >= 1);
  assert.equal(before.body.items[0].teacherId, QA.teachers[0]);
  assert.equal(teacherRow(before, QA.teachers[1]).teachesSubject, false);
  const filtered = await send(
    'GET',
    `manager/teachers?search=${encodeURIComponent('zzzz-none')}`,
    'manager',
  );
  assert.deepEqual(filtered.body.items, []);
  assert.equal((await send('GET', 'manager/teachers?subjectId=nope', 'manager')).status, 422);

  const window = await send('POST', 'teacher-availability', 'teacher', {
    startsAt: iso(state.day),
    endsAt: iso(state.day + 8 * HOUR),
    timezone: 'Europe/Chisinau',
  });
  assert.equal(window.status, 200, JSON.stringify(window.body));
  const opened = await send('GET', 'manager/teachers', 'manager');
  const t = teacherRow(opened, QA.teachers[0]);
  assert.equal(t.availableMinutesNext7Days - first.availableMinutesNext7Days, 480);
  assert.equal(t.freeMinutesNext7Days - first.freeMinutesNext7Days, 480);

  const lesson = await send('POST', 'lessons', 'director', {
    teachingAssignmentId: state.assignment.id,
    startsAt: iso(state.day + HOUR),
    endsAt: iso(state.day + 2 * HOUR),
    basis: 'Manager teacher directory load',
  });
  assert.equal(lesson.status, 200, JSON.stringify(lesson.body));
  state.lessonId = lesson.body.id;
  const booked = teacherRow(await send('GET', 'manager/teachers', 'manager'), QA.teachers[0]);
  assert.equal(booked.freeMinutesNext7Days, t.freeMinutesNext7Days - 60);
  assert.equal(booked.lessonsNext7Days, t.lessonsNext7Days + 1);
  assert.equal(booked.availableMinutesNext7Days, t.availableMinutesNext7Days);
});

test('availability windows split into booked and free intervals', async () => {
  const q = `from=${iso(state.day - HOUR)}&to=${iso(state.day + DAY)}`;
  const r = await send('GET', `manager/teachers/${QA.teachers[0]}/availability?${q}`, 'manager');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.teacherId, QA.teachers[0]);
  assert.equal(r.body.windows.length, 1);
  const w = r.body.windows[0];
  assert.equal(w.startsAt, iso(state.day));
  assert.equal(w.endsAt, iso(state.day + 8 * HOUR));
  assert.deepEqual(w.busy, [
    { startsAt: iso(state.day + HOUR), endsAt: iso(state.day + 2 * HOUR) },
  ]);
  assert.deepEqual(w.free, [
    { startsAt: iso(state.day), endsAt: iso(state.day + HOUR) },
    { startsAt: iso(state.day + 2 * HOUR), endsAt: iso(state.day + 8 * HOUR) },
  ]);
  // The range clips the window.
  const clipped = await send(
    'GET',
    `manager/teachers/${QA.teachers[0]}/availability?from=${iso(state.day + 4 * HOUR)}&to=${iso(state.day + 5 * HOUR)}`,
    'manager',
  );
  assert.deepEqual(clipped.body.windows[0].free, [
    { startsAt: iso(state.day + 4 * HOUR), endsAt: iso(state.day + 5 * HOUR) },
  ]);
  assert.deepEqual(clipped.body.windows[0].busy, []);
  const bad = (qs) =>
    send('GET', `manager/teachers/${QA.teachers[0]}/availability?${qs}`, 'manager');
  assert.equal(
    (await bad(`from=${iso(state.day)}&to=${iso(state.day)}`)).body.code,
    'INVALID_RANGE',
  );
  assert.equal(
    (await bad(`from=${iso(state.day)}&to=${iso(state.day + 40 * DAY)}`)).body.code,
    'RANGE_TOO_LARGE',
  );
  assert.equal((await bad('from=x')).status, 422);
  const missing = await send(
    'GET',
    `manager/teachers/${randomUUID()}/availability?${q}`,
    'manager',
  );
  assert.equal(missing.status, 404);
  assert.equal(missing.body.code, 'TEACHER_NOT_FOUND');
});

test('lead candidates list trial slots and the chosen one is scheduled with the existing command', async () => {
  const created = await send('POST', 'manager/leads', 'manager', {
    audience: 'ADULT',
    contactName: 'Candidate Lead',
    phone: `+373${Math.floor(60_000_000 + Math.random() * 9_000_000)}`,
    subjectId: state.subjectId,
    source: 'PHONE',
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  state.lead = created.body;
  // Portfolio reads use the API clock; let it pass the DB-stamped assignment time.
  await new Promise((r) => setTimeout(r, 1500));
  assert.equal(
    (await send('GET', `manager/leads/${randomUUID()}/teacher-candidates`, 'manager')).status,
    404,
  );
  assert.equal(
    (await send('GET', `manager/leads/${state.lead.leadId}/teacher-candidates?days=99`, 'manager'))
      .status,
    422,
  );
  const list = await send(
    'GET',
    `manager/leads/${state.lead.leadId}/teacher-candidates?days=7`,
    'manager',
  );
  assert.equal(list.status, 200, JSON.stringify(list.body));
  assert.equal(list.body.subjectId, state.subjectId);
  assert.ok(list.body.trialMinutes >= 15);
  const mine = list.body.candidates.find((c) => c.teacherId === QA.teachers[0]);
  assert.ok(mine, 'teacher with a window is a candidate');
  assert.equal(list.body.candidates[0].teachesSubject, true);
  assert.ok(mine.trialSlots.length >= 1 && mine.trialSlots.length <= 10);
  for (const slot of mine.trialSlots) {
    assert.ok(+new Date(slot.endsAt) - +new Date(slot.startsAt) >= list.body.trialMinutes * 60_000);
    // never inside the booked lesson
    assert.ok(
      +new Date(slot.endsAt) <= state.day + HOUR ||
        +new Date(slot.startsAt) >= state.day + 2 * HOUR,
    );
  }
  assert.equal(
    list.body.candidates.some((c) => c.teacherId === QA.teachers[1]),
    false,
    'a teacher without windows has no trial slots',
  );

  const slot = mine.trialSlots.find((s) => s.startsAt === iso(state.day + 2 * HOUR));
  assert.ok(slot, JSON.stringify(mine.trialSlots));
  const claimed = await send('POST', `manager/leads/${state.lead.leadId}/claim`, 'manager', {
    version: state.lead.version,
  });
  assert.equal(claimed.status, 200, JSON.stringify(claimed.body));
  const trial = await send('POST', `manager/leads/${state.lead.leadId}/trial`, 'manager', {
    version: claimed.body.version,
    teacherId: QA.teachers[0],
    startsAt: slot.startsAt,
  });
  assert.equal(trial.status, 200, JSON.stringify(trial.body));
  assert.equal(trial.body.stage, 'TRIAL');
  const tasks = await client.crmTask.findMany({
    where: { lead_id: state.lead.leadId, type: 'ASSIGN_TEACHER' },
  });
  assert.ok(
    tasks.length >= 1 && tasks.every((t) => t.status !== 'OPEN' && t.status !== 'IN_PROGRESS'),
  );
  // The booked trial disappears from the candidates (another lead sees a shorter list).
  const other = await send('POST', 'manager/leads', 'manager', {
    audience: 'ADULT',
    contactName: 'Second Lead',
    phone: `+373${Math.floor(60_000_000 + Math.random() * 9_000_000)}`,
    subjectId: state.subjectId,
    source: 'PHONE',
  });
  const again = await send(
    'GET',
    `manager/leads/${other.body.leadId}/teacher-candidates`,
    'manager',
  );
  const left = again.body.candidates.find((c) => c.teacherId === QA.teachers[0]);
  assert.ok(!left.trialSlots.some((s) => s.startsAt === slot.startsAt));
});

test('a manager assigns and revokes a teacher for a portfolio student', async () => {
  const path = `manager/students/${QA.students[0]}/teaching-assignments`;
  const body = {
    subjectId: state.subjectId,
    teacherId: QA.teachers[1],
    basis: 'Second teacher for conversation practice',
  };
  const created = await send('POST', path, 'manager', body);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.studentId, QA.students[0]);
  assert.equal(created.body.teacherId, QA.teachers[1]);
  assert.equal(created.body.subjectId, state.subjectId);
  assert.equal(created.body.validTo, null);
  state.assignmentId = created.body.assignmentId;

  const dup = await send('POST', path, 'manager', body);
  assert.equal(dup.status, 409);
  assert.equal(dup.body.code, 'TEACHER_ALREADY_ASSIGNED');
  const foreign = await send(
    'POST',
    `manager/students/${QA.students[2]}/teaching-assignments`,
    'manager',
    body,
  );
  assert.equal(foreign.status, 404);
  assert.equal(foreign.body.code, 'STUDENT_NOT_FOUND');
  const ghost = await send('POST', path, 'manager', { ...body, teacherId: randomUUID() });
  assert.equal(ghost.status, 422, JSON.stringify(ghost.body));
  assert.equal(ghost.body.code, 'TEACHER_INACTIVE');
  assert.equal((await send('POST', path, 'manager', { ...body, basis: 'x' })).status, 422);
  assert.equal((await send('POST', path, 'manager', { ...body, extra: 1 })).status, 422);
  assert.equal((await send('POST', path, 'director', body)).status, 403);

  await new Promise((r) => setTimeout(r, 1500));
  const dir = teacherRow(await send('GET', 'manager/teachers', 'manager'), QA.teachers[1]);
  assert.equal(dir.activeStudents, 1);
  assert.ok(dir.subjects.some((s) => s.id === state.subjectId));

  await new Promise((r) => setTimeout(r, 1500));
  const revokePath = `manager/teaching-assignments/${state.assignmentId}/revoke`;
  assert.equal((await send('POST', revokePath, 'manager', { reason: 'no' })).status, 422);
  assert.equal(
    (
      await send('POST', `manager/teaching-assignments/${randomUUID()}/revoke`, 'manager', {
        reason: 'Unknown assignment',
      })
    ).status,
    404,
  );
  const revoked = await send('POST', revokePath, 'manager', { reason: 'Teacher no longer needed' });
  assert.equal(revoked.status, 200, JSON.stringify(revoked.body));
  assert.ok(revoked.body.validTo);
  const again = await send('POST', revokePath, 'manager', { reason: 'Teacher no longer needed' });
  assert.equal(again.status, 409);
  assert.equal(again.body.code, 'ASSIGNMENT_ALREADY_ENDED');
  await new Promise((r) => setTimeout(r, 2500));
  const after = teacherRow(await send('GET', 'manager/teachers', 'manager'), QA.teachers[1]);
  assert.equal(after.activeStudents, 0);
});

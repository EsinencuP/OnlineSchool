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
  const issue = (accountId) =>
    client.$transaction(async (tx) =>
      store.issue(tx, accountId, (await tx.$queryRaw`SELECT clock_timestamp() AS now`)[0].now),
    );
  for (const [name, label] of [
    ['teacher', 'seed-teacher-001'],
    ['teacher2', 'seed-teacher-002'],
    ['director', 'seed-director-001'],
  ])
    actors[name] = await issue(qaId(label + '/auth'));
  const assignment = await client.teachingAssignment.findFirstOrThrow({
    where: { teacher_id: QA.teachers[0] },
  });
  state.enrollment = assignment.enrollment_id;
  const enrollment = await client.studentSubjectEnrollment.findUniqueOrThrow({
    where: { id: state.enrollment },
  });
  state.subject = enrollment.subject_id;
  state.otherEnrollment = (
    await client.studentSubjectEnrollment.findFirstOrThrow({
      where: { id: { not: state.enrollment } },
    })
  ).id;
  // Student cabinet session (the seeded account starts on a temporary password).
  const studentAccount = await client.studentAccount.findFirstOrThrow({
    where: { student_id: QA.students[0] },
  });
  await client.studentAccount.update({
    where: { id: studentAccount.id },
    data: { must_change_password: false },
  });
  actors.student = await issue(studentAccount.account_id);
});
after(async () => {
  await app?.close();
  await client.$disconnect();
  await pool.end();
});

// The student read model filters by the application clock; absorb host/DB clock skew.
const settle = () => new Promise((resolve) => setTimeout(resolve, 1500));
const headers = (actor) => {
  const s = actors[actor];
  return { cookie: `__Host-school_session=${s.token}; __Host-school_csrf=${s.csrfToken}` };
};
async function get(path, actor, prefix = '/api/v1/teacher') {
  const r = await fetch(base + prefix + path, { headers: headers(actor) });
  return { status: r.status, body: await r.json() };
}
async function post(path, actor, body, key = randomUUID()) {
  const r = await fetch(base + '/api/v1/teacher' + path, {
    method: 'POST',
    headers: {
      ...headers(actor),
      'content-type': 'application/json',
      'idempotency-key': key,
      'x-csrf-token': actors[actor].csrfToken,
    },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}
async function patch(path, actor, body, key = randomUUID()) {
  const r = await fetch(base + '/api/v1/teacher' + path, {
    method: 'PATCH',
    headers: {
      ...headers(actor),
      'content-type': 'application/json',
      'idempotency-key': key,
      'x-csrf-token': actors[actor].csrfToken,
    },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}
let skillSeq = 0;
const newSkill = (data = {}) =>
  client.skillEntry.create({
    data: {
      subject_id: state.subject,
      code: `skill-${++skillSeq}-${randomUUID()}`,
      label: `Skill ${skillSeq}`,
      category: 'Grammar',
      source_operation_id: randomUUID(),
      ...data,
    },
  });
const assess = (skillId, body, actor = 'teacher', key) =>
  post(`/enrollments/${state.enrollment}/skills/${skillId}/assessments`, actor, body, key);

test('roster lists only the actively taught enrollments', async () => {
  const roster = await get('/enrollments', 'teacher');
  assert.equal(roster.status, 200, JSON.stringify(roster.body));
  const row = roster.body.items.find((i) => i.enrollmentId === state.enrollment);
  assert.equal(row.studentId, QA.students[0]);
  assert.ok(row.studentName && row.subjectName && row.assignedFrom);
  assert.ok(row.confirmedLessons >= 1);
  assert.equal(
    roster.body.items.some((i) => i.enrollmentId === state.otherEnrollment),
    false,
  );
  assert.equal((await get('/enrollments', 'teacher2')).body.items.length, 0);
  assert.equal((await get('/enrollments', 'director')).status, 403);
});

test('skill map shows the visible catalog with current public statuses', async () => {
  state.skill = await newSkill();
  await newSkill({ archived_at: new Date() });
  await newSkill({ student_id: QA.students[1] });
  const otherSubject = await client.subject.create({
    data: { code: 'sk-' + randomUUID(), name: 'Other' },
  });
  await newSkill({ subject_id: otherSubject.id });
  const map = await get(`/enrollments/${state.enrollment}/skills`, 'teacher');
  assert.equal(map.status, 200, JSON.stringify(map.body));
  const mine = map.body.skills.find((s) => s.skillId === state.skill.id);
  assert.equal(mine.status, 'NOT_STUDIED');
  assert.equal(mine.assessedAt, null);
  assert.equal(map.body.skills.length, 1);
  assert.equal((await get(`/enrollments/${state.enrollment}/skills`, 'teacher2')).status, 404);
  assert.equal((await get(`/enrollments/${randomUUID()}/skills`, 'teacher')).status, 404);
  assert.equal((await get('/enrollments/nope/skills', 'teacher')).status, 422);
});

test('assessment validation, ownership and idempotency', async () => {
  const id = state.skill.id;
  const ok = {
    level: 'FAMILIARIZING',
    basis: 'Recognises the pattern with help',
    publicComment: 'Good start',
  };
  assert.equal((await assess(id, ok, 'teacher2')).status, 404);
  assert.equal((await assess(id, ok, 'director')).status, 403);
  assert.equal((await assess(randomUUID(), ok)).status, 404);
  const archived = await newSkill({ archived_at: new Date() });
  assert.equal((await assess(archived.id, ok)).status, 404);
  const foreign = await newSkill({ student_id: QA.students[1] });
  assert.equal((await assess(foreign.id, ok)).status, 404);
  for (const bad of [
    { ...ok, level: 'GOLD' },
    { ...ok, basis: 'x' },
    { ...ok, extra: 1 },
    { level: 'APPLYING' },
  ])
    assert.equal((await assess(id, bad)).status, 422, JSON.stringify(bad));
  const unchanged = await assess(id, { level: 'NOT_STUDIED', basis: 'Nothing changed yet' });
  assert.equal(unchanged.status, 409);
  assert.equal(unchanged.body.code, 'SKILL_LEVEL_UNCHANGED');
  const unconfirmed = await assess(id, { ...ok, lessonId: qaId('lesson-scheduled') });
  assert.equal(unconfirmed.status, 422, JSON.stringify(unconfirmed.body));
  assert.equal(unconfirmed.body.code, 'SKILL_LESSON_NOT_CONFIRMED');

  const key = randomUUID();
  const first = await assess(id, ok, 'teacher', key);
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.fromStatus, 'NOT_STUDIED');
  assert.equal(first.body.toStatus, 'FAMILIARIZING');
  assert.deepEqual((await assess(id, ok, 'teacher', key)).body, first.body);
  assert.equal(await client.skillAssessment.count({ where: { skill_id: id } }), 1);
});

test('assessments chain by version, feed history and the student map', async () => {
  const id = state.skill.id;
  const second = await assess(id, {
    level: 'PRACTICING',
    basis: 'Solved three tasks alone',
    publicComment: 'Practising independently',
    lessonId: qaId('lesson-conducted'),
  });
  assert.equal(second.status, 200, JSON.stringify(second.body));
  assert.equal(second.body.fromStatus, 'FAMILIARIZING');
  const rows = await client.skillAssessment.findMany({
    where: { skill_id: id },
    orderBy: { version: 'asc' },
  });
  assert.deepEqual(
    rows.map((r) => r.version),
    [1, 2],
  );
  assert.equal(rows[1].supersedes_assessment_id, rows[0].id);
  assert.equal(rows[1].level, 'PRACTICING');
  assert.equal(
    (await assess(id, { level: 'PRACTICING', basis: 'Still the same level' })).status,
    409,
  );

  const map = await get(`/enrollments/${state.enrollment}/skills`, 'teacher');
  const current = map.body.skills.find((s) => s.skillId === id);
  assert.equal(current.status, 'PRACTICING');
  assert.equal(current.publicComment, 'Practising independently');
  assert.ok(current.assessedByName);

  const history = await get(`/enrollments/${state.enrollment}/skills/${id}/history`, 'teacher');
  assert.equal(history.status, 200, JSON.stringify(history.body));
  assert.deepEqual(
    history.body.items.map((i) => i.toStatus),
    ['PRACTICING', 'FAMILIARIZING'],
  );
  assert.equal(history.body.items[0].basis, 'Solved three tasks alone');
  assert.equal(
    (await get(`/enrollments/${state.enrollment}/skills/${id}/history`, 'teacher2')).status,
    404,
  );

  // The student sees the new status and public comment, never the internal basis.
  await settle();
  const student = await get('/skills', 'student', '/api/v1/student');
  assert.equal(student.status, 200, JSON.stringify(student.body));
  const studentSkill = student.body.flatMap((s) => s.skills).find((s) => s.skillId === id);
  assert.equal(studentSkill.status, 'PRACTICING');
  const audit = await get(`/skills/audit?skillId=${id}`, 'student', '/api/v1/student');
  assert.equal(audit.status, 200, JSON.stringify(audit.body));
  assert.deepEqual(
    audit.body.items.map((i) => i.toStatus),
    ['PRACTICING', 'FAMILIARIZING'],
  );
  assert.equal(JSON.stringify(audit.body).includes('Solved three tasks alone'), false);
});

test('learning goals: create, edit, achieve, archive; the student sees them', async () => {
  const path = `/enrollments/${state.enrollment}/goals`;
  const create = (body, actor = 'teacher') => post(path, actor, body);
  {
    const r = await create({ text: 'Goal' });
    assert.equal(r.status, 422, JSON.stringify(r.body));
  }
  assert.equal((await create({ text: 'Read a chapter alone', extra: 1 })).status, 422);
  assert.equal((await create({ text: 'Read a chapter alone' }, 'teacher2')).status, 404);
  assert.equal((await create({ text: 'Read a chapter alone' }, 'director')).status, 403);
  assert.equal(
    (await create({ text: 'Read a chapter alone', targetDate: '2020-01-01' })).status,
    422,
  );
  assert.equal(
    (await create({ text: 'Read a chapter alone', targetDate: '2099-02-30' })).status,
    422,
  );
  assert.equal((await create({ text: 'Read a chapter alone', skillId: randomUUID() })).status, 404);
  const skill = await newSkill();
  const goal = await create({
    text: 'Read a chapter alone',
    targetDate: '2099-06-01',
    skillId: skill.id,
  });
  assert.equal(goal.status, 200, JSON.stringify(goal.body));
  assert.equal(goal.body.status, 'ACTIVE');

  const list = await get(path, 'teacher');
  assert.equal(list.status, 200, JSON.stringify(list.body));
  assert.equal(list.body.goals[0].targetDate, '2099-06-01');
  assert.equal(list.body.goals[0].skillId, skill.id);
  assert.equal((await get(path, 'teacher2')).status, 404);

  const update = (body, actor = 'teacher') => patch(`${path}/${goal.body.id}`, actor, body);
  assert.equal((await update({})).status, 422);
  assert.equal((await update({ status: 'DONE' })).status, 422);
  assert.equal((await update({ status: 'ACHIEVED' }, 'teacher2')).status, 404);
  const renamed = await update({ text: 'Read two chapters alone', targetDate: null });
  assert.equal(renamed.status, 200, JSON.stringify(renamed.body));
  const achieved = await update({ status: 'ACHIEVED' });
  assert.equal(achieved.body.status, 'ACHIEVED');
  await settle();
  const seen = await get('/skills', 'student', '/api/v1/student');
  const studentGoal = seen.body
    .flatMap((s) => s.learningGoals)
    .find((g) => g.goalId === goal.body.id);
  assert.equal(studentGoal.text, 'Read two chapters alone');
  assert.equal(studentGoal.isAchieved, true);
  assert.equal(studentGoal.targetDate, null);

  assert.equal((await update({ status: 'ARCHIVED' })).status, 200);
  assert.equal((await update({ text: 'Edit after archive' })).status, 409);
  await settle();
  const after = await get('/skills', 'student', '/api/v1/student');
  assert.equal(
    after.body.flatMap((s) => s.learningGoals).some((g) => g.goalId === goal.body.id),
    false,
  );
  const history = await pool.query(
    'SELECT count(*)::int AS n FROM learning_goal_history WHERE goal_id = $1',
    [goal.body.id],
  );
  assert.equal(history.rows[0].n, 4);
});

test('student card summarises lessons, homework, skills, goals and pending reviews', async () => {
  const card = await get(`/enrollments/${state.enrollment}/overview`, 'teacher');
  assert.equal(card.status, 200, JSON.stringify(card.body));
  assert.equal(card.body.studentId, QA.students[0]);
  assert.ok(card.body.studentName && card.body.subjectName);
  assert.ok(card.body.confirmedLessons >= 1);
  assert.equal(card.body.lessonsToNextReview, 4 - (card.body.confirmedLessons % 4));
  assert.ok(card.body.recentLessons.length >= 1);
  assert.ok(card.body.recentLessons.length <= 5);
  const skills = card.body.skills;
  const catalog = await get(`/enrollments/${state.enrollment}/skills`, 'teacher');
  assert.equal(
    skills.notStudied + skills.familiarizing + skills.practicing + skills.applying,
    catalog.body.skills.length,
  );
  assert.equal(skills.practicing >= 1, true);
  assert.deepEqual(Object.keys(card.body.homework).sort(), [
    'awaitingReview',
    'needsRevision',
    'notSubmitted',
    'reviewed',
  ]);
  assert.equal(card.body.activeGoals, 0);
  assert.equal(card.body.pendingCheckpoints, 0);
  assert.equal((await get(`/enrollments/${state.enrollment}/overview`, 'teacher2')).status, 404);
  assert.equal((await get(`/enrollments/${randomUUID()}/overview`, 'teacher')).status, 404);
  assert.equal((await get('/enrollments/nope/overview', 'teacher')).status, 422);
  assert.equal((await get(`/enrollments/${state.enrollment}/overview`, 'director')).status, 403);
});

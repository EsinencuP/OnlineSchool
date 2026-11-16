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
  const assignment = await client.teachingAssignment.findFirstOrThrow({
    where: { teacher_id: QA.teachers[0] },
  });
  state.enrollment = assignment.enrollment_id;
  state.otherEnrollment = (
    await client.studentSubjectEnrollment.findFirstOrThrow({
      where: { id: { not: state.enrollment } },
    })
  ).id;
});
after(async () => {
  await app?.close();
  await client.$disconnect();
  await pool.end();
});

const dbNow = async () => (await client.$queryRaw`SELECT clock_timestamp() AS now`)[0].now;
const headers = (actor) => {
  const s = actors[actor];
  return { cookie: `__Host-school_session=${s.token}; __Host-school_csrf=${s.csrfToken}` };
};
async function get(path, actor) {
  const r = await fetch(base + '/api/v1/teacher/homework' + path, { headers: headers(actor) });
  return { status: r.status, body: await r.json() };
}
async function post(path, actor, body, key = randomUUID()) {
  const r = await fetch(base + '/api/v1/teacher/homework' + path, {
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
const future = (days) => new Date(Date.now() + days * 86_400_000).toISOString();
const issueBody = (extra = {}) => ({
  title: 'Fractions practice',
  description: 'Solve exercises 1-5 on page 12',
  dueAt: future(3),
  enrollmentIds: [state.enrollment],
  ...extra,
});

test('issuing enforces role, assignment, subject and due-date rules', async () => {
  const unassigned = await post(
    '',
    'teacher',
    issueBody({ enrollmentIds: [state.otherEnrollment] }),
  );
  assert.equal(unassigned.status, 403, JSON.stringify(unassigned.body));
  assert.equal(unassigned.body.code, 'HOMEWORK_ENROLLMENT_NOT_ASSIGNED');
  assert.equal((await post('', 'teacher2', issueBody())).status, 403);
  assert.equal((await post('', 'director', issueBody())).status, 403);
  assert.equal((await post('', 'manager', issueBody())).status, 403);
  const past = await post(
    '',
    'teacher',
    issueBody({ dueAt: new Date(Date.now() - 3_600_000).toISOString() }),
  );
  assert.equal(past.status, 422);
  assert.equal(past.body.code, 'HOMEWORK_DUE_IN_PAST');
  for (const bad of [
    { title: '' },
    { enrollmentIds: [] },
    { enrollmentIds: [state.enrollment, state.enrollment] },
    { extra: 1 },
  ])
    assert.equal((await post('', 'teacher', issueBody(bad))).status, 422, JSON.stringify(bad));
  const foreign = await post(
    '',
    'teacher',
    issueBody({ lessonId: qaId('lesson-conducted').replace(/.$/, '0') }),
  );
  assert.equal(foreign.status, 422);

  // A second subject with its own assigned enrollment makes a mixed request invalid.
  const subject = await client.subject.create({
    data: { code: 'hw-' + randomUUID(), name: 'Second subject' },
  });
  const staff = await client.staffAccount.findFirstOrThrow({ where: { id: QA.managers[0] } });
  const enrollment2 = await client.studentSubjectEnrollment.create({
    data: {
      student_id: QA.students[0],
      subject_id: subject.id,
      valid_from: new Date('2026-10-01Z'),
      source_operation_id: randomUUID(),
    },
  });
  await client.teachingAssignment.create({
    data: {
      enrollment_id: enrollment2.id,
      teacher_id: QA.teachers[0],
      valid_from: new Date('2026-10-01Z'),
      basis: 'Synthetic homework subject',
      assigned_by_id: staff.id,
      source_operation_id: randomUUID(),
    },
  });
  const mixed = await post(
    '',
    'teacher',
    issueBody({ enrollmentIds: [state.enrollment, enrollment2.id] }),
  );
  assert.equal(mixed.status, 422, JSON.stringify(mixed.body));
  assert.equal(mixed.body.code, 'HOMEWORK_SUBJECT_MISMATCH');
});

test('issue is idempotent and listed for the issuing teacher only', async () => {
  const key = randomUUID();
  const sameBody = issueBody();
  const issued = await post('', 'teacher', sameBody, key);
  assert.equal(issued.status, 200, JSON.stringify(issued.body));
  assert.equal(issued.body.deliveries.length, 1);
  const replay = await post('', 'teacher', sameBody, key);
  assert.deepEqual(replay.body, issued.body);
  assert.equal(await client.homeworkAssignment.count({ where: { id: issued.body.id } }), 1);
  assert.equal(await client.homeworkAssignment.count({ where: { issued_by: QA.teachers[0] } }), 1);
  state.delivery = issued.body.deliveries[0].deliveryId;
  state.studentId = issued.body.deliveries[0].studentId;

  const list = await get('', 'teacher');
  assert.equal(list.status, 200, JSON.stringify(list.body));
  const row = list.body.items.find((i) => i.deliveryId === state.delivery);
  assert.equal(row.state, 'NOT_SUBMITTED');
  assert.equal(row.title, 'Fractions practice');
  assert.equal(row.submissionCount, 0);
  assert.equal((await get('', 'teacher2')).body.items.length, 0);
  assert.equal((await get('/' + state.delivery, 'teacher2')).status, 404);
  assert.equal((await get('', 'manager')).status, 403);
  for (const query of ['?state=NOPE', '?limit=0', '?cursor=@@@', '?x=1'])
    assert.equal((await get(query, 'teacher')).status, 422, query);
  const card = await get('/' + state.delivery, 'teacher');
  assert.equal(card.body.description, 'Solve exercises 1-5 on page 12');
  assert.equal(card.body.canReview, false);
  assert.deepEqual(card.body.submissions, []);
});

const submit = async (version, text, supersedes = null) =>
  client.homeworkSubmission.create({
    data: {
      delivery_id: state.delivery,
      student_id: state.studentId,
      submitted_at: await dbNow(),
      version,
      content: { text },
      supersedes_submission_id: supersedes,
      source_operation_id: randomUUID(),
    },
  });

test('submission lands in the review queue; revision then acceptance finish the cycle', async () => {
  const v1 = await submit(1, 'My first answer');
  const queue = await get('?state=AWAITING_REVIEW', 'teacher');
  assert.deepEqual(
    queue.body.items.map((i) => i.deliveryId),
    [state.delivery],
  );
  assert.equal(queue.body.items[0].submissionCount, 1);
  const card = await get('/' + state.delivery, 'teacher');
  assert.equal(card.body.canReview, true);
  assert.equal(card.body.submissions[0].text, 'My first answer');
  assert.equal(card.body.submissions[0].review, null);

  const review = (body, actor = 'teacher') => post(`/${state.delivery}/review`, actor, body);
  assert.equal((await review({ submissionId: randomUUID(), result: 'ACCEPTED' })).status, 409);
  const noComment = await review({ submissionId: v1.id, result: 'NEEDS_REVISION' });
  assert.equal(noComment.status, 422);
  assert.equal(noComment.body.code, 'REVIEW_COMMENT_REQUIRED');
  assert.equal((await review({ submissionId: v1.id, result: 'ACCEPTED' }, 'teacher2')).status, 404);
  assert.equal((await review({ submissionId: v1.id, result: 'GRADE_5' })).status, 422);

  const returned = await review({
    submissionId: v1.id,
    result: 'NEEDS_REVISION',
    comment: 'Please show your steps',
  });
  assert.equal(returned.status, 200, JSON.stringify(returned.body));
  const notified = await pool.query(
    'SELECT type FROM student_notification_sources WHERE event_key = $1',
    ['review:' + returned.body.id],
  );
  assert.equal(notified.rows[0].type, 'HOMEWORK_NEEDS_REVISION');
  assert.equal((await review({ submissionId: v1.id, result: 'ACCEPTED' })).status, 409);
  const after1 = await get('/' + state.delivery, 'teacher');
  assert.equal(after1.body.state, 'NEEDS_REVISION');
  assert.equal(after1.body.canReview, false);
  assert.equal(after1.body.submissions[0].review.comment, 'Please show your steps');
  assert.equal((await get('?state=AWAITING_REVIEW', 'teacher')).body.items.length, 0);

  const v2 = await submit(2, 'Answer with steps', v1.id);
  assert.equal((await get('/' + state.delivery, 'teacher')).body.state, 'AWAITING_REVIEW');
  // The earlier submission is no longer reviewable.
  assert.equal((await review({ submissionId: v1.id, result: 'ACCEPTED' })).status, 409);
  const accepted = await review({ submissionId: v2.id, result: 'ACCEPTED' });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
  const done = await get('/' + state.delivery, 'teacher');
  assert.equal(done.body.state, 'REVIEWED');
  assert.equal(done.body.isLate, false);
  assert.equal(done.body.submissions.length, 2);
  assert.equal(done.body.submissions[0].version, 2);
  assert.equal(done.body.submissions[0].review.result, 'ACCEPTED');
});

test('list pages are stable newest first', async () => {
  const second = await post('', 'teacher', issueBody({ title: 'Second homework' }));
  assert.equal(second.status, 200, JSON.stringify(second.body));
  const all = await get('', 'teacher');
  assert.equal(all.body.items.length, 2);
  assert.equal(all.body.items[0].title, 'Second homework');
  const p1 = await get('?limit=1', 'teacher');
  assert.ok(p1.body.nextCursor);
  const p2 = await get('?limit=1&cursor=' + p1.body.nextCursor, 'teacher');
  assert.equal(p2.body.items[0].deliveryId, state.delivery);
  assert.equal(p2.body.nextCursor, null);
});

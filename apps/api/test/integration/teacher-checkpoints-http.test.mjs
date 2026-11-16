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
  state = { day: 1 };
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
  const studentAccount = await client.studentAccount.findFirstOrThrow({
    where: { student_id: QA.students[0] },
  });
  await client.studentAccount.update({
    where: { id: studentAccount.id },
    data: { must_change_password: false },
  });
  actors.student = await issue(studentAccount.account_id);
  const seedLesson = await client.lessonOccurrence.findUniqueOrThrow({
    where: { id: qaId('lesson-conducted') },
  });
  state.lesson = seedLesson;
  // The rate snapshot at confirmation needs a recorded service history of the teacher.
  await client.teacherEngagement.create({
    data: {
      teacher_id: QA.teachers[0],
      starts_at: new Date('2025-01-01Z'),
      basis: 'Synthetic verified teacher service',
      recorded_by_id: QA.director,
      source_operation_id: randomUUID(),
    },
  });
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
async function post(path, actor, body = {}, key = randomUUID()) {
  const r = await fetch(base + '/api/v1/' + path, {
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

// Lesson that already ended (a few days ago), optionally with a directly stored confirmed outcome.
async function pastLesson(status) {
  const start = new Date(Date.UTC(2026, 10, state.day++, 10, 0, 0));
  const lesson = await client.lessonOccurrence.create({
    data: {
      enrollment_id: state.lesson.enrollment_id,
      teaching_assignment_id: state.lesson.teaching_assignment_id,
      scheduled_teacher_id: state.lesson.scheduled_teacher_id,
      original_scheduled_at: start,
      scheduled_at: start,
      scheduled_end_at: new Date(+start + 3_600_000),
      status,
      source_operation_id: randomUUID(),
      ...(status === 'CONDUCTED'
        ? {
            actual_start_at: start,
            actual_teacher_at_start_id: state.lesson.scheduled_teacher_id,
            rate_at_start_snapshot: '200',
            points_at_start_snapshot: 0,
            rate_basis_at_start: 'ORDINARY_POINTS',
            rate_currency_at_start: 'MDL',
          }
        : {}),
    },
  });
  if (status === 'CONDUCTED')
    await client.lessonActualOutcome.create({
      data: {
        lesson_occurrence_id: lesson.id,
        actual_teacher_id: state.lesson.scheduled_teacher_id,
        actual_started_at: start,
        duration_min: 60,
        confirmed_at: new Date(+start + 3_600_000),
        confirmed_by_id: QA.director,
        rate_snapshot: '200',
        points_snapshot: 0,
        rate_basis: 'ORDINARY_POINTS',
        currency: 'MDL',
        basis: 'Synthetic direct outcome',
        source_operation_id: randomUUID(),
      },
    });
  return { lesson, start };
}
// The real command chain: teacher reports, director confirms (this opens the checkpoints).
async function confirmedThroughApi() {
  const { lesson, start } = await pastLesson('SCHEDULED');
  const report = await post(`lessons/${lesson.id}/outcome`, 'teacher', {
    result: 'CONDUCTED',
    actualStartedAt: start.toISOString(),
    durationMin: 60,
    note: 'Lesson went as planned',
  });
  assert.equal(report.status, 200, JSON.stringify(report.body));
  const confirmed = await post(`lessons/${lesson.id}/confirm-outcome`, 'director', {
    reportId: report.body.id,
    basis: 'Confirmed by director',
  });
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
}

test('the fourth confirmed lesson opens a skill review that freezes the student snapshot', async () => {
  await pastLesson('CONDUCTED');
  await pastLesson('CONDUCTED');
  await confirmedThroughApi();
  assert.equal((await get('/checkpoints', 'teacher2')).body.items.length, 0);
  const pending = await get('/checkpoints?state=PENDING', 'teacher');
  assert.equal(pending.status, 200, JSON.stringify(pending.body));
  assert.deepEqual(
    pending.body.items.map((i) => [i.type, i.confirmedLessonCount]),
    [['LESSON_4', 4]],
  );
  state.review = pending.body.items[0];
  assert.equal(state.review.studentId, QA.students[0]);

  const card = await get('/checkpoints/' + state.review.checkpointId, 'teacher');
  assert.equal(card.status, 200, JSON.stringify(card.body));
  assert.equal(card.body.snapshotId, null);
  assert.equal(card.body.report, null);
  assert.equal((await get('/checkpoints/' + state.review.checkpointId, 'teacher2')).status, 404);
  assert.equal((await get('/checkpoints/' + randomUUID(), 'teacher')).status, 404);

  const complete = (body, actor = 'teacher') =>
    post(`teacher/checkpoints/${state.review.checkpointId}/complete`, actor, body);
  assert.equal((await complete({ teacherSummary: 'ok' })).status, 422);
  assert.equal((await complete({ teacherSummary: 'Solid progress', extra: 1 })).status, 422);
  assert.equal((await complete({ teacherSummary: 'Solid progress' }, 'teacher2')).status, 404);
  assert.equal((await complete({ teacherSummary: 'Solid progress' }, 'director')).status, 403);
  const done = await complete({ teacherSummary: 'Solid progress over four lessons' });
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.ok(done.body.snapshotId);
  const again = await complete({ teacherSummary: 'Solid progress over four lessons' });
  assert.equal(again.status, 409);
  assert.equal(again.body.code, 'CHECKPOINT_ALREADY_COMPLETED');

  const completed = await get('/checkpoints?state=COMPLETED&type=LESSON_4', 'teacher');
  assert.equal(completed.body.items.length, 1);
  assert.equal(completed.body.items[0].state, 'COMPLETED');
  const noReport = await post(
    `teacher/checkpoints/${state.review.checkpointId}/report`,
    'teacher',
    {
      achievements: 'a',
      growthAreas: 'b',
      recommendations: 'c',
      teacherSignature: 'T',
    },
  );
  assert.equal(noReport.status, 409);
  assert.equal(noReport.body.code, 'CHECKPOINT_HAS_NO_REPORT');

  await settle();
  const snapshots = await get('/skills/snapshots', 'student', '/api/v1/student');
  assert.equal(snapshots.status, 200, JSON.stringify(snapshots.body));
  assert.equal(snapshots.body.total, 1);
  assert.equal(snapshots.body.items[0].lessonNumber, 4);
  assert.equal(snapshots.body.items[0].teacherSummary, 'Solid progress over four lessons');
});

test('the eighth lesson opens an education report that is drafted, published and shown to the student', async () => {
  await pastLesson('CONDUCTED');
  await pastLesson('CONDUCTED');
  await pastLesson('CONDUCTED');
  await confirmedThroughApi();
  const pending = await get('/checkpoints?state=PENDING', 'teacher');
  assert.deepEqual(pending.body.items.map((i) => [i.type, i.confirmedLessonCount]).sort(), [
    ['LESSON_4', 8],
    ['LESSON_8', 8],
  ]);
  const eight = pending.body.items.find((i) => i.type === 'LESSON_8');
  const card = await get('/checkpoints/' + eight.checkpointId, 'teacher');
  assert.ok(card.body.suggestedPeriodStart && card.body.suggestedPeriodEnd);
  assert.equal(card.body.report, null);

  const save = (body, actor = 'teacher') =>
    post(`teacher/checkpoints/${eight.checkpointId}/report`, actor, body);
  const publish = (actor = 'teacher') =>
    post(`teacher/checkpoints/${eight.checkpointId}/report/publish`, actor);
  const content = {
    achievements: 'Mastered the fraction basics',
    growthAreas: 'Word problems',
    recommendations: 'Practise two problems daily',
    teacherSignature: 'Teacher One',
  };
  assert.equal((await publish()).status, 409);
  assert.equal((await save({ ...content, achievements: '' })).status, 422);
  assert.equal((await save({ ...content, extra: 1 })).status, 422);
  assert.equal((await save(content, 'teacher2')).status, 404);
  const draft = await save(content);
  assert.equal(draft.status, 200, JSON.stringify(draft.body));
  const edited = await save({ ...content, growthAreas: 'Word problems and geometry' });
  assert.equal(edited.body.id, draft.body.id);
  const withDraft = await get('/checkpoints/' + eight.checkpointId, 'teacher');
  assert.equal(withDraft.body.report.status, 'DRAFT');
  assert.equal(withDraft.body.report.growthAreas, 'Word problems and geometry');
  assert.equal(withDraft.body.state, 'PENDING');
  // Drafts are invisible to the student.
  assert.equal((await get('/reports', 'student', '/api/v1/student')).body.total, 0);

  assert.equal((await publish('teacher2')).status, 404);
  const published = await publish();
  assert.equal(published.status, 200, JSON.stringify(published.body));
  assert.equal(published.body.status, 'PUBLISHED');
  assert.equal((await publish()).status, 409);
  const late = await save(content);
  assert.equal(late.status, 409);
  assert.equal(late.body.code, 'REPORT_ALREADY_PUBLISHED');
  const done = await get('/checkpoints/' + eight.checkpointId, 'teacher');
  assert.equal(done.body.state, 'COMPLETED');
  assert.equal(done.body.report.status, 'PUBLISHED');

  await settle();
  const reports = await get('/reports', 'student', '/api/v1/student');
  assert.equal(reports.status, 200, JSON.stringify(reports.body));
  assert.equal(reports.body.total, 1);
  assert.equal(JSON.stringify(reports.body).includes('Mastered the fraction basics'), true);
});

test('query validation', async () => {
  for (const query of ['state=NOPE', 'type=LESSON_5', 'limit=0', 'cursor=@@@', 'x=1'])
    assert.equal((await get('/checkpoints?' + query, 'teacher')).status, 422, query);
  assert.equal((await get('/checkpoints', 'director')).status, 403);
  const page = await get('/checkpoints?limit=1', 'teacher');
  assert.ok(page.body.nextCursor);
  const next = await get('/checkpoints?limit=2&cursor=' + page.body.nextCursor, 'teacher');
  assert.equal(next.status, 200);
  assert.equal(
    new Set([...page.body.items, ...next.body.items].map((i) => i.checkpointId)).size,
    3,
  );
});

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
import { NotificationService } from '../../dist/modules/notifications/notification.service.js';
import { StudentNotificationProjector } from '../../../worker/dist/notifications.js';
import { QA, qaId, seedQA } from '../../../../packages/db/dist-tools/seed.js';

Object.assign(process.env, {
  S3_BUCKET: 'school-test-bucket',
  S3_ENDPOINT: 'https://s3.test.invalid',
  S3_REGION: 'test-1',
  S3_ACCESS_KEY: 'test-access-key',
  S3_SECRET_KEY: 'test-secret-key',
});
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
    ['director', 'seed-director-001'],
    ['manager', 'seed-manager-001'],
  ])
    actors[name] = await issue(qaId(label + '/auth'));
  const account = await client.studentAccount.findFirstOrThrow({
    where: { student_id: QA.students[0] },
  });
  await client.studentAccount.update({
    where: { id: account.id },
    data: { must_change_password: false },
  });
  actors.student = await issue(account.account_id);
  state.accountId = account.account_id;
  state.enrollment = (
    await client.teachingAssignment.findFirstOrThrow({ where: { teacher_id: QA.teachers[0] } })
  ).enrollment_id;
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
async function send(method, path, actor, body, key = randomUUID()) {
  const read = method === 'GET';
  const r = await fetch(base + '/api/v1/' + path, {
    method,
    headers: {
      ...headers(actor),
      ...(read
        ? {}
        : {
            'content-type': 'application/json',
            'idempotency-key': key,
            'x-csrf-token': actors[actor].csrfToken,
          }),
    },
    ...(read ? {} : { body: JSON.stringify(body ?? {}) }),
  });
  const text = await r.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: r.status, body: json, headers: r.headers };
}
const get = (path, actor = 'student') => send('GET', 'student/' + path, actor);

test('every student read route answers 200 with private no-store responses', async () => {
  const routes = [
    'me',
    'dashboard',
    'subjects',
    'lessons',
    'lessons/upcoming',
    'lessons/history',
    'homework',
    'materials',
    'notifications',
    'notifications/count',
    'reports',
    'skills',
    'skills/snapshots',
    'subscription',
    'subscription/payments',
    'subscription/ledger',
    'security/sessions',
  ];
  const failures = [];
  for (const route of routes) {
    const r = await get(route);
    if (r.status !== 200)
      failures.push(`${route} -> ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
    else if (!/no-store/.test(r.headers.get('cache-control') ?? ''))
      failures.push(`${route} lacks no-store`);
  }
  assert.deepEqual(failures, []);
});

test('student routes reject other roles and anonymous callers', async () => {
  for (const route of ['me', 'dashboard', 'homework', 'subscription'])
    for (const actor of ['teacher', 'director', 'manager'])
      assert.equal((await get(route, actor)).status, 403, `${route} as ${actor}`);
  const anon = await fetch(base + '/api/v1/student/me');
  assert.equal(anon.status, 401);
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 1500));
const issueHomework = () =>
  send('POST', 'teacher/homework', 'teacher', {
    title: 'Cabinet homework',
    description: 'Solve three problems',
    dueAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    enrollmentIds: [state.enrollment],
  });

test('homework cycle across roles: issue, draft, submit, revision, resubmit, accept', async () => {
  const issued = await issueHomework();
  assert.equal(issued.status, 200, JSON.stringify(issued.body));
  const hw = issued.body.deliveries[0].deliveryId;
  state.hw = hw;
  await settle();
  const list = await get('homework');
  const item = list.body.items.find((i) => i.homeworkId === hw);
  assert.equal(item.status, 'NOT_SUBMITTED');
  assert.equal(item.title, 'Cabinet homework');
  assert.equal(item.description, 'Solve three problems');
  assert.ok(item.teacherName && item.subjectName);
  assert.equal(
    (await get('homework?status=NOT_SUBMITTED')).body.items.some((i) => i.homeworkId === hw),
    true,
  );
  assert.equal(
    (await get('homework?status=REVIEWED')).body.items.some((i) => i.homeworkId === hw),
    false,
  );

  const draft = await send('PATCH', `student/homework/${hw}/draft`, 'student', {
    content: 'work in progress',
  });
  assert.equal(draft.status, 200, JSON.stringify(draft.body));
  assert.equal((await get(`homework/${hw}`)).body.draftContent, 'work in progress');
  assert.equal(
    (await send('PATCH', `student/homework/${hw}/draft`, 'student', { content: 'x'.repeat(10001) }))
      .status,
    400,
  );
  assert.equal(
    (await send('PATCH', `student/homework/${hw}/draft`, 'teacher', { content: 'no' })).status,
    403,
  );

  const submit = (content) => send('POST', `student/homework/${hw}/submit`, 'student', { content });
  assert.equal((await submit('')).status, 400);
  const first = await submit('Answer version one');
  assert.equal(first.status, 201, JSON.stringify(first.body));
  assert.equal(first.body.versionNumber, 1);
  assert.equal(first.body.isLate, false);
  const blocked = await submit('Second answer before review');
  assert.equal(blocked.status >= 400, true, 'a reviewed-less resubmission must be refused');
  await settle();
  assert.equal((await get(`homework/${hw}`)).body.status, 'SUBMITTED');
  assert.equal((await get(`homework/${hw}`)).body.draftContent ?? null, null);

  const review = (body) => send('POST', `teacher/homework/${hw}/review`, 'teacher', body);
  const returned = await review({
    submissionId: first.body.submissionId,
    result: 'NEEDS_REVISION',
    comment: 'Show the steps please',
  });
  assert.equal(returned.status, 200, JSON.stringify(returned.body));
  await settle();
  const revision = await get(`homework/${hw}`);
  assert.equal(revision.body.status, 'NEEDS_REVISION');
  assert.equal(
    revision.body.versions[0].review?.comment ?? revision.body.versions[0].teacherComment,
    'Show the steps please',
  );

  const second = await submit('Answer with steps');
  assert.equal(second.status, 201, JSON.stringify(second.body));
  assert.equal(second.body.versionNumber, 2);
  await settle();
  const accepted = await review({ submissionId: second.body.submissionId, result: 'ACCEPTED' });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
  await settle();
  const done = await get(`homework/${hw}`);
  assert.equal(done.body.status, 'REVIEWED');
  assert.equal(done.body.versions.length, 2);
  assert.equal(
    (await get('homework?status=REVIEWED')).body.items.some((i) => i.homeworkId === hw),
    true,
  );
});

test('review events reach the student notification inbox; read state works', async () => {
  // The worker projects notification sources into the inbox; run its projector once.
  const projector = new StudentNotificationProjector(client, new NotificationService());
  assert.ok((await projector.processDue()) >= 2);
  const inbox = await get('notifications');
  assert.equal(inbox.status, 200, JSON.stringify(inbox.body));
  const types = inbox.body.items.map((n) => n.type);
  assert.ok(types.includes('HOMEWORK_NEEDS_REVISION'), JSON.stringify(types));
  assert.ok(types.includes('HOMEWORK_REVIEWED'), JSON.stringify(types));
  const unread = await get('notifications/count');
  assert.equal(unread.body.unreadCount >= 2, true);
  const first = inbox.body.items.find((n) => !n.isRead);
  const one = await send('PATCH', `student/notifications/${first.notificationId}/read`, 'student');
  assert.ok([200, 204].includes(one.status), JSON.stringify(one));
  assert.equal((await get('notifications/count')).body.unreadCount, unread.body.unreadCount - 1);
  const all = await send('POST', 'student/notifications/read-all', 'student');
  assert.ok([200, 201, 204].includes(all.status), JSON.stringify(all));
  assert.equal((await get('notifications/count')).body.unreadCount, 0);
  assert.equal(
    (await send('PATCH', `student/notifications/${randomUUID()}/read`, 'student')).status,
    404,
  );
  assert.equal(
    (await send('PATCH', `student/notifications/${first.notificationId}/read`, 'teacher')).status,
    403,
  );
});

test('lessons: list, card, history and scoping to the own student', async () => {
  const list = await get('lessons?period=archive&pageSize=50');
  assert.equal(list.status, 200, JSON.stringify(list.body));
  const conducted = list.body.items.find((l) => l.lessonId === qaId('lesson-conducted'));
  assert.ok(conducted, JSON.stringify(list.body.items.map((l) => l.lessonId)));
  const card = await get(`lessons/${qaId('lesson-conducted')}`);
  assert.equal(card.status, 200, JSON.stringify(card.body));
  assert.equal((await get(`lessons/${randomUUID()}`)).status >= 400, true);
  const history = await get('lessons/history');
  assert.equal(history.status, 200, JSON.stringify(history.body));
  assert.equal((await get('lessons/upcoming')).status, 200);
  // A lesson of another student is not reachable.
  const foreign = await client.studentSubjectEnrollment.findFirst({
    where: { student_id: QA.students[1] },
    select: { id: true },
  });
  if (foreign) {
    const lesson = await client.lessonOccurrence.findFirst({
      where: { enrollment_id: foreign.id },
    });
    if (lesson) assert.equal((await get(`lessons/${lesson.id}`)).status >= 400, true);
  }
});

test('reschedule request and attendance dispute become manager tasks', async () => {
  await client.assignedManager.create({
    data: {
      manager_id: QA.managers[0],
      student_id: QA.students[0],
      assigned_at: new Date('2026-10-01Z'),
    },
  });
  const day = new Date(Date.now() + 10 * 86_400_000);
  day.setUTCHours(0, 0, 0, 0);
  const iso = (ms) => new Date(ms).toISOString();
  const availability = await send('POST', 'teacher-availability', 'teacher', {
    startsAt: iso(+day),
    endsAt: iso(+day + 8 * 3_600_000),
    timezone: 'Europe/Chisinau',
  });
  assert.equal(availability.status, 200, JSON.stringify(availability.body));
  const lesson = await send('POST', 'lessons', 'director', {
    teachingAssignmentId: qaId('teaching-001'),
    startsAt: iso(+day + 3_600_000),
    endsAt: iso(+day + 2 * 3_600_000),
    basis: 'Student cabinet reschedule target',
  });
  assert.equal(lesson.status, 200, JSON.stringify(lesson.body));
  await settle();

  const preferredDate = iso(+day + 86_400_000).slice(0, 10);
  const key = randomUUID();
  const asked = await send(
    'POST',
    `student/lessons/${lesson.body.id}/reschedule-request`,
    'student',
    { reason: 'Exam at school that day', preferredDate },
    key,
  );
  assert.equal(asked.status, 201, JSON.stringify(asked.body));
  assert.equal(asked.body.status, 'CREATED');
  const replay = await send(
    'POST',
    `student/lessons/${lesson.body.id}/reschedule-request`,
    'student',
    { reason: 'Exam at school that day', preferredDate },
    key,
  );
  assert.equal(replay.body.crmTaskId, asked.body.crmTaskId);
  const result = await get(`lessons/${lesson.body.id}/requests/${key}`);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.status, 'CREATED');
  const tasks = await send('GET', 'manager/tasks?type=RESCHEDULE_REQUEST&limit=100', 'manager');
  assert.equal(tasks.status, 200, JSON.stringify(tasks.body));
  assert.ok(tasks.body.items.some((t) => t.taskId === asked.body.crmTaskId));
  assert.equal(
    (
      await send('POST', `student/lessons/${lesson.body.id}/reschedule-request`, 'student', {
        reason: '',
        preferredDate,
      })
    ).status,
    400,
  );
});

test('subscription, ledger and subjects reflect the seeded paid package', async () => {
  const subscription = await get('subscription');
  assert.equal(subscription.status, 200, JSON.stringify(subscription.body));
  assert.equal(subscription.body.status, 'ACTIVE');
  assert.equal(subscription.body.lessonsTotal, 2);
  const payments = await get('subscription/payments');
  assert.equal(payments.status, 200, JSON.stringify(payments.body));
  // Payments and deductions are shown from the published ledger only; nothing is published yet.
  assert.deepEqual(payments.body.items, []);
  const ledger = await get('subscription/ledger');
  assert.equal(ledger.status, 200, JSON.stringify(ledger.body));
  const subjects = await get('subjects');
  assert.equal(subjects.status, 200, JSON.stringify(subjects.body));
  const me = await get('me');
  assert.equal(me.body.mustChangePassword ?? false, false);
});

test('profile display name, sessions and password change', async () => {
  const renamed = await send('PATCH', 'student/profile', 'student', {
    displayName: 'Cabinet Student',
  });
  assert.equal(renamed.status, 200, JSON.stringify(renamed.body));
  assert.equal((await get('me')).body.displayName, 'Cabinet Student');
  assert.equal(
    (await send('PATCH', 'student/profile', 'student', { displayName: '' })).status,
    400,
  );

  const sessions = await get('security/sessions');
  assert.equal(sessions.status, 200, JSON.stringify(sessions.body));
  assert.ok(sessions.body.length >= 1 || sessions.body.items?.length >= 1);
  const wrong = await send('POST', 'student/security/change-password', 'student', {
    currentPassword: 'definitely-wrong',
    newPassword: 'NewSecret123',
  });
  assert.equal(wrong.status >= 400 && wrong.status < 500, true, JSON.stringify(wrong));
  assert.equal(
    (
      await send('POST', 'student/security/change-password', 'student', {
        currentPassword: 'x',
        newPassword: 'short',
      })
    ).status,
    400,
  );
});

test('a granted material yields a short-lived signed URL and an audit row; revoked access is refused', async () => {
  const past = new Date(Date.now() - 120_000);
  const file = await client.s3Object.create({
    data: {
      bucket: 'school-test-bucket',
      key: `materials/final/${randomUUID()}`,
      file_name: 'Guide.pdf',
      size: 10n,
      content_type: 'application/pdf',
      status: 'VERIFIED',
      uploaded_at: past,
      verified_at: past,
      uploaded_by: qaId('seed-teacher-001/auth'),
      source_operation_id: randomUUID(),
    },
  });
  const permission = await client.filePermission.create({
    data: {
      s3_object_id: file.id,
      subject_id: state.accountId,
      subject_type: 'STUDENT',
      granted_by: qaId('seed-teacher-001/auth'),
      granted_at: past,
      can_download: true,
      source_operation_id: randomUUID(),
    },
  });
  await settle();
  const signed = await get(`materials/${file.id}/url`);
  assert.equal(signed.status, 200, JSON.stringify(signed.body));
  assert.match(signed.body.url, /^https:\/\/s3\.test\.invalid\//);
  assert.equal(signed.body.fileName, 'Guide.pdf');
  assert.ok(new Date(signed.body.expiresAt) > new Date());
  const audit = await pool.query(
    "SELECT action FROM file_audit_logs WHERE permission_id = $1 AND action = 'DOWNLOAD'",
    [permission.id],
  );
  assert.equal(audit.rowCount, 1);
  await client.$executeRaw`UPDATE file_permissions SET revoked_at = clock_timestamp(), revoked_by = ${qaId('seed-teacher-001/auth')}::uuid WHERE id = ${permission.id}::uuid`;
  assert.equal((await get(`materials/${file.id}/url`)).status, 403);
  assert.equal((await get(`materials/${randomUUID()}/url`)).status, 403);
});

test('a report PDF export is queued and its status is readable by the owner only', async () => {
  const queued = await send('POST', 'student/reports/export-pdf', 'student', {});
  assert.ok([200, 201, 202].includes(queued.status), JSON.stringify(queued));
  assert.equal(queued.body.status, 'QUEUED');
  const status = await get(`reports/export-pdf/${queued.body.jobId}`);
  assert.equal(status.status, 200, JSON.stringify(status.body));
  assert.equal(status.body.status, 'QUEUED');
  assert.equal((await get(`reports/export-pdf/${queued.body.jobId}`, 'teacher')).status, 403);
});

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
import { PrivateUploads } from '../../dist/modules/storage/private-uploads.service.js';
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
// Signing is local; the S3 round trip of confirm() is replaced by a stub.
Object.assign(process.env, {
  S3_BUCKET: 'school-test-bucket',
  S3_ENDPOINT: 'https://s3.test.invalid',
  S3_REGION: 'test-1',
  S3_ACCESS_KEY: 'test-access-key',
  S3_SECRET_KEY: 'test-secret-key',
});

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
  state.confirms = 0;
  app.get(PrivateUploads).confirm = async () => {
    state.confirms += 1;
  };
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
  state.enrollment = (
    await client.teachingAssignment.findFirstOrThrow({ where: { teacher_id: QA.teachers[0] } })
  ).enrollment_id;
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

const settle = () => new Promise((resolve) => setTimeout(resolve, 1500));
const headers = (actor) => {
  const s = actors[actor];
  return { cookie: `__Host-school_session=${s.token}; __Host-school_csrf=${s.csrfToken}` };
};
async function send(method, path, actor, body, key = randomUUID()) {
  const r = await fetch(base + '/api/v1/' + path, {
    method,
    headers: {
      ...headers(actor),
      ...(method === 'GET'
        ? {}
        : {
            'content-type': 'application/json',
            'idempotency-key': key,
            'x-csrf-token': actors[actor].csrfToken,
          }),
    },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body ?? {}) }),
  });
  return { status: r.status, body: await r.json() };
}
const upload = {
  fileName: 'Fractions worksheet.pdf',
  fileSizeBytes: 2048,
  mimeType: 'application/pdf',
};

test('upload registration validates input and returns a signed staging URL', async () => {
  for (const bad of [
    { ...upload, fileName: 'a/b.pdf' },
    { ...upload, fileName: '' },
    { ...upload, fileSizeBytes: 0 },
    { ...upload, fileSizeBytes: 60_000_000 },
    { ...upload, mimeType: 'pdf' },
    { ...upload, mimeType: 'text/html' },
    { ...upload, mimeType: 'image/svg+xml' },
    { ...upload, extra: 1 },
  ])
    assert.equal(
      (await send('POST', 'teacher/materials/uploads', 'teacher', bad)).status,
      422,
      JSON.stringify(bad),
    );
  assert.equal((await send('POST', 'teacher/materials/uploads', 'director', upload)).status, 403);
  const key = randomUUID();
  const created = await send('POST', 'teacher/materials/uploads', 'teacher', upload, key);
  assert.equal(created.status, 200, JSON.stringify(created.body));
  assert.match(created.body.uploadUrl, /materials\/incoming\//);
  assert.equal(created.body.uploadUrl.includes('materials/final'), false);
  assert.deepEqual(
    (await send('POST', 'teacher/materials/uploads', 'teacher', upload, key)).body,
    created.body,
  );
  state.file = created.body.id;
  const library = await send('GET', 'teacher/materials', 'teacher');
  assert.equal(library.body.items.length, 1);
  assert.equal(library.body.items[0].status, 'PENDING');
  assert.equal(library.body.items[0].fileName, 'Fractions worksheet.pdf');
  assert.equal((await send('GET', 'teacher/materials', 'teacher2')).body.items.length, 0);
});

test('sharing needs a verified file, a taught enrollment and a valid lesson', async () => {
  const share = (body, actor = 'teacher', file = state.file) =>
    send('POST', `teacher/materials/${file}/grants`, actor, body);
  const body = { enrollmentId: state.enrollment, canDownload: false };
  const early = await share(body);
  assert.equal(early.status, 409);
  assert.equal(early.body.code, 'MATERIAL_NOT_VERIFIED');

  assert.equal(
    (await send('POST', `teacher/materials/${state.file}/confirm`, 'teacher2')).status,
    404,
  );
  const confirmed = await send('POST', `teacher/materials/${state.file}/confirm`, 'teacher');
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
  assert.equal(confirmed.body.status, 'VERIFIED');
  assert.equal(state.confirms, 1);
  assert.equal(
    (await send('POST', `teacher/materials/${state.file}/confirm`, 'teacher')).status,
    200,
  );
  assert.equal(state.confirms, 1);

  assert.equal((await share(body, 'teacher2')).status, 404);
  assert.equal((await share({ ...body, enrollmentId: state.otherEnrollment })).status, 404);
  assert.equal((await share({ ...body, extra: 1 })).status, 422);
  assert.equal((await share({ ...body, canDownload: 'yes' })).status, 422);
  const past = await share({ ...body, expiresAt: new Date(Date.now() - 60_000).toISOString() });
  assert.equal(past.status, 422);
  assert.equal(past.body.code, 'MATERIAL_EXPIRY_IN_PAST');
  const foreignLesson = await share({ ...body, lessonId: randomUUID() });
  assert.equal(foreignLesson.status, 422);
  assert.equal(foreignLesson.body.code, 'MATERIAL_LESSON_NOT_APPLICABLE');
});

test('a shared file reaches the student with its lesson title and can be revoked', async () => {
  const shared = await send('POST', `teacher/materials/${state.file}/grants`, 'teacher', {
    enrollmentId: state.enrollment,
    lessonId: qaId('lesson-conducted'),
    lessonTitle: 'Fractions, lesson 1',
    canDownload: true,
  });
  assert.equal(shared.status, 200, JSON.stringify(shared.body));
  state.permission = shared.body.id;
  const again = await send('POST', `teacher/materials/${state.file}/grants`, 'teacher', {
    enrollmentId: state.enrollment,
    canDownload: false,
  });
  assert.equal(again.status, 409);
  assert.equal(again.body.code, 'MATERIAL_ALREADY_SHARED');

  const mine = await send('GET', `teacher/enrollments/${state.enrollment}/materials`, 'teacher');
  assert.equal(mine.status, 200, JSON.stringify(mine.body));
  assert.equal(mine.body.items[0].permissionId, state.permission);
  assert.equal(mine.body.items[0].lessonTitle, 'Fractions, lesson 1');
  assert.equal(mine.body.items[0].revokedAt, null);
  assert.equal(
    (await send('GET', `teacher/enrollments/${state.enrollment}/materials`, 'teacher2')).status,
    404,
  );
  assert.equal((await send('GET', 'teacher/materials', 'teacher')).body.items[0].activeGrants, 1);

  await settle();
  const seen = await send('GET', 'student/materials', 'student');
  assert.equal(seen.status, 200, JSON.stringify(seen.body));
  assert.equal(seen.body.items.length, 1);
  assert.equal(seen.body.items[0].fileName, 'Fractions worksheet.pdf');
  assert.equal(seen.body.items[0].lessonTitle, 'Fractions, lesson 1');
  assert.equal(seen.body.items[0].canDownload, true);

  assert.equal(
    (await send('DELETE', `teacher/materials/grants/${state.permission}`, 'teacher2')).status,
    404,
  );
  const revoked = await send('DELETE', `teacher/materials/grants/${state.permission}`, 'teacher');
  assert.equal(revoked.status, 200, JSON.stringify(revoked.body));
  const twice = await send('DELETE', `teacher/materials/grants/${state.permission}`, 'teacher');
  assert.equal(twice.status, 409);
  assert.equal(twice.body.code, 'MATERIAL_ALREADY_REVOKED');
  assert.equal((await send('GET', 'student/materials', 'student')).body.items.length, 0);
  assert.equal((await send('GET', 'teacher/materials', 'teacher')).body.items[0].activeGrants, 0);
  const audit = await pool.query(
    "SELECT action FROM file_audit_logs WHERE permission_id = $1 AND action = 'REVOKE'",
    [state.permission],
  );
  assert.equal(audit.rowCount, 1);
  // After revocation the same file can be shared again.
  const reshared = await send('POST', `teacher/materials/${state.file}/grants`, 'teacher', {
    enrollmentId: state.enrollment,
    canDownload: false,
  });
  assert.equal(reshared.status, 200, JSON.stringify(reshared.body));
});

test('library paging and query validation', async () => {
  await send('POST', 'teacher/materials/uploads', 'teacher', { ...upload, fileName: 'Second.pdf' });
  const page1 = await send('GET', 'teacher/materials?limit=1', 'teacher');
  assert.equal(page1.body.items[0].fileName, 'Second.pdf');
  assert.ok(page1.body.nextCursor);
  const page2 = await send(
    'GET',
    'teacher/materials?limit=1&cursor=' + page1.body.nextCursor,
    'teacher',
  );
  assert.equal(page2.body.items[0].fileId, state.file);
  assert.equal(
    (await send('GET', 'teacher/materials?state=PENDING', 'teacher')).body.items.length,
    1,
  );
  for (const query of ['state=NOPE', 'limit=0', 'cursor=@@@', 'x=1'])
    assert.equal((await send('GET', 'teacher/materials?' + query, 'teacher')).status, 422, query);
  assert.equal((await send('GET', 'teacher/materials', 'director')).status, 403);
});

test('homework can carry verified library files; students open them as materials', async () => {
  const created = await send('POST', 'teacher/materials/uploads', 'teacher', {
    ...upload,
    fileName: 'Homework sheet.pdf',
  });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const fileId = created.body.id;
  const issue = (extra, actor = 'teacher') =>
    send('POST', 'teacher/homework', actor, {
      title: 'Homework with a file',
      description: 'Use the attached sheet',
      dueAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      enrollmentIds: [state.enrollment],
      ...extra,
    });
  // Unverified, foreign and unknown files are refused.
  assert.equal((await issue({ attachmentFileIds: [fileId] })).status, 422);
  assert.equal((await issue({ attachmentFileIds: [randomUUID()] })).status, 422);
  assert.equal((await send('POST', `teacher/materials/${fileId}/confirm`, 'teacher')).status, 200);
  assert.equal((await issue({ attachmentFileIds: [fileId] }, 'teacher2')).status, 403);
  assert.equal((await issue({ attachmentFileIds: [fileId, fileId] })).status, 422);

  const issued = await issue({ attachmentFileIds: [fileId] });
  assert.equal(issued.status, 200, JSON.stringify(issued.body));
  await settle();
  const homework = await send('GET', 'student/homework', 'student');
  assert.equal(homework.status, 200, JSON.stringify(homework.body));
  const item = homework.body.items.find(
    (i) => i.homeworkId === issued.body.deliveries[0].deliveryId,
  );
  assert.equal(item.attachments.length, 1);
  assert.equal(item.attachments[0].fileId, fileId);
  const materials = await send('GET', 'student/materials', 'student');
  assert.ok(materials.body.items.some((m) => m.fileId === fileId && m.canDownload === true));
});

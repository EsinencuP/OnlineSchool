import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { beforeAll, afterAll, beforeEach, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import request from 'supertest';
import { AppModule } from '../../apps/api/dist/app.module.js';
import { DatabaseService } from '../../apps/api/dist/core/database/database.module.js';
import { SessionStore } from '../../apps/api/dist/core/session/session.store.js';
import { PrivateUploads } from '../../apps/api/dist/modules/storage/private-uploads.service.js';
import { AppException, domainError } from '../../apps/api/dist/core/errors/domain-error.js';
const { Test } = createRequire(new URL('../../apps/api/package.json', import.meta.url))(
  '@nestjs/testing',
);
const users = [randomUUID(), randomUUID(), randomUUID()],
  students = [randomUUID(), randomUUID()],
  hws = [randomUUID(), randomUUID()];
const fixed = new Date('2026-10-27T12:00:00Z');
let app, db, state, issued, storage;
const account = (id) => ({
  id,
  kind: id === users[2] ? 'TEACHER' : 'STUDENT',
  disabled_at: null,
  recovery_registration_required: false,
  login_id: `${users.indexOf(id)}@example.invalid`,
});
beforeAll(async () => {
  db = {
    $queryRaw: jest.fn(async (first, ...args) => {
      const sql = Array.isArray(first) ? first.join('?') : first.sql,
        values = Array.isArray(first) ? args : first.values;
      if (sql.includes('SELECT r.code'))
        return [{ code: values[0] === users[2] ? 'TEACHER' : 'STUDENT' }];
      if (sql.includes('AS has_active_access'))
        return [{ subject_ids: [], has_active_access: state.active }];
      if (sql.includes('FOR UPDATE OF d'))
        return state.deliveries.has(values[0]) ? [state.deliveries.get(values[0])] : [];
      if (sql.includes('WITH scoped AS')) {
        const owner = values.find((x) => students.includes(x)),
          selected = sql.includes('AND d.id=') ? values.find((x) => hws.includes(x)) : undefined,
          delivery = [...state.deliveries.values()].find(
            (x) => x.student_id === owner && (!sql.includes('AND d.id=') || x.id === selected),
          );
        return [
          {
            items: delivery
              ? [
                  {
                    homeworkId: delivery.id,
                    assignedAt: delivery.issued_at.toISOString(),
                    dueAt: null,
                    subjectName: 'Math',
                    teacherName: 'Teacher',
                    title: 'Homework',
                    description: 'Task',
                    status: 'NOT_SUBMITTED',
                    isLate: false,
                    draftContent: null,
                    versions: [],
                    latestVersion: null,
                    attachments: [],
                  },
                ]
              : [],
            total: delivery ? 1 : 0,
          },
        ];
      }
      return [{ now: fixed, locked: true }];
    }),
    studentAccount: {
      findFirst: jest.fn(async ({ where }) => ({
        id: where.account_id,
        student_id: students[users.indexOf(where.account_id)],
        must_change_password: state.mustChange,
        timezone: 'Europe/Chisinau',
        deactivated_at: null,
        created_at: fixed,
        student: { full_name: 'Student' },
        account: account(where.account_id),
      })),
    },
    teacherAccount: { findFirst: jest.fn(async () => ({ deactivated_at: null })) },
    accessRevocation: { findFirst: jest.fn(async () => null) },
    session: {
      create: jest.fn(async ({ data }) => {
        const row = { ...data, id: randomUUID(), revoked_at: null };
        state.sessions.set(row.id, row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }) => {
        const row = where.id
          ? state.sessions.get(where.id)
          : [...state.sessions.values()].find((s) => s.token_hash === where.token_hash);
        return row ? { ...row, account: account(row.account_id) } : null;
      }),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    homeworkDelivery: {
      findFirst: jest.fn(async ({ where }) => {
        const row = state.deliveries.get(where.id);
        return row?.student_id === where.enrollment_ref.student_id ? { id: row.id } : null;
      }),
    },
    homeworkDraft: {
      upsert: jest.fn(async ({ where, create, update }) => {
        const row = state.drafts.has(where.delivery_id)
          ? { ...state.drafts.get(where.delivery_id), ...update }
          : create;
        state.drafts.set(where.delivery_id, row);
        return row;
      }),
      updateMany: jest.fn(async ({ where, data }) => {
        const row = state.drafts.get(where.delivery_id);
        if (row) Object.assign(row, data);
        return { count: row ? 1 : 0 };
      }),
    },
    homeworkSubmission: {
      findFirst: jest.fn(
        async ({ where }) =>
          state.submissions.filter((s) => s.delivery_id === where.delivery_id).at(-1) ?? null,
      ),
      create: jest.fn(async ({ data }) => {
        state.submissions.push(data);
        return data;
      }),
    },
    submissionReview: {
      findFirst: jest.fn(
        async ({ where }) =>
          state.reviews.find((r) => r.submission_id === where.submission_id) ?? null,
      ),
    },
    s3Object: {
      create: jest.fn(async ({ data }) => {
        const row = { ...data, status: 'PENDING' };
        state.files.set(row.id, row);
        state.uploads.set(row.id, {
          ...data.homework_upload.create,
          file_id: row.id,
          confirmed_at: null,
        });
        return row;
      }),
      update: jest.fn(async ({ where, data }) => Object.assign(state.files.get(where.id), data)),
    },
    homeworkUpload: {
      findFirst: jest.fn(async ({ where }) => {
        const row = state.uploads.get(where.file_id),
          file = state.files.get(where.file_id);
        return row &&
          row.delivery_id === where.delivery_id &&
          file.uploaded_by === where.file.uploaded_by &&
          (!where.file.status || where.file.status === file.status)
          ? { ...row, file }
          : null;
      }),
      findMany: jest.fn(async ({ where }) =>
        [...state.uploads.values()].filter(
          (row) =>
            row.delivery_id === where.delivery_id &&
            where.file_id.in.includes(row.file_id) &&
            row.confirmed_at &&
            state.files.get(row.file_id).status === 'VERIFIED',
        ),
      ),
      update: jest.fn(async ({ where, data }) =>
        Object.assign(state.uploads.get(where.file_id), data),
      ),
    },
    auditEvent: {
      create: jest.fn(async ({ data }) => {
        state.audit.push(data);
        return data;
      }),
    },
    outboxEvent: {
      create: jest.fn(async ({ data }) => {
        if (state.outboxFailure) throw Error('private outbox error');
        state.outbox.push(data);
        return data;
      }),
    },
    idempotencyRecord: {
      findUnique: jest.fn(async ({ where }) => {
        const key = where.scope_command_type_key;
        return (
          [...state.records.values()].find(
            (r) =>
              r.scope === key.scope && r.command_type === key.command_type && r.key === key.key,
          ) ?? null
        );
      }),
      create: jest.fn(async ({ data }) => {
        state.records.set(data.id, { ...data, status: 'PENDING' });
        return data;
      }),
      update: jest.fn(async ({ where, data }) => Object.assign(state.records.get(where.id), data)),
      delete: jest.fn(async ({ where }) => state.records.delete(where.id)),
    },
    $disconnect: jest.fn(async () => {}),
  };
  let tail = Promise.resolve();
  db.$transaction = jest.fn((fn) => {
    const result = tail.then(async () => {
      const before = structuredClone(state);
      try {
        return await fn(db);
      } catch (error) {
        state = before;
        throw error;
      }
    });
    tail = result.catch(() => {});
    return result;
  });
  storage = {
    bucket: () => 'online-school-files',
    sign: jest.fn(async () => 'https://private.invalid/?signature=secret'),
    confirm: jest.fn(async () => {}),
  };
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DatabaseService)
    .useValue({ client: db })
    .overrideProvider(PrivateUploads)
    .useValue(storage)
    .compile();
  app = module.createNestApplication();
  app.useLogger(false);
  await app.init();
});
afterAll(async () => app?.close());
beforeEach(async () => {
  jest.clearAllMocks();
  state = {
    sessions: new Map(),
    records: new Map(),
    drafts: new Map(),
    files: new Map(),
    uploads: new Map(),
    submissions: [],
    reviews: [],
    audit: [],
    outbox: [],
    active: true,
    mustChange: false,
    outboxFailure: false,
    deliveries: new Map(
      hws.map((id, i) => [
        id,
        {
          id,
          student_id: students[i],
          issued_at: new Date(+fixed - 86400000),
          due_at: new Date(+fixed - 1),
          cancelled_at: null,
          archived_at: null,
        },
      ]),
    ),
  };
  issued = await Promise.all(users.map((u) => app.get(SessionStore).issue(db, u)));
});
const cookie = (i) =>
  `__Host-school_session=${issued[i].token}; __Host-school_csrf=${issued[i].csrfToken}`;

test('STU-12 direct homework lookup preserves owner isolation and bootstrap guards', async () => {
  const own = await request(app.getHttpServer())
    .get(`/api/v1/student/homework/${hws[0]}`)
    .set('Cookie', cookie(0));
  expect(own.status).toBe(200);
  expect(own.body.homeworkId).toBe(hws[0]);
  for (const id of [hws[1], randomUUID()]) {
    const denied = await request(app.getHttpServer())
      .get(`/api/v1/student/homework/${id}`)
      .set('Cookie', cookie(0));
    expect(denied.status).toBe(404);
    expect(denied.body.code).toBe('HOMEWORK_NOT_FOUND');
  }
  state.active = false;
  expect(
    (
      await request(app.getHttpServer())
        .get(`/api/v1/student/homework/${hws[0]}`)
        .set('Cookie', cookie(0))
    ).status,
  ).toBe(402);
  state.mustChange = true;
  expect(
    (
      await request(app.getHttpServer())
        .get(`/api/v1/student/homework/${hws[0]}`)
        .set('Cookie', cookie(0))
    ).status,
  ).toBe(403);
});
const command = (suffix, body, index = 0, id = hws[0], key = randomUUID(), csrf = true) => {
  const req = request(app.getHttpServer())
    [suffix === 'draft' ? 'patch' : 'post'](`/api/v1/student/homework/${id}/${suffix}`)
    .set('Cookie', cookie(index))
    .set('Idempotency-Key', key);
  if (csrf) req.set('X-CSRF-Token', issued[index].csrfToken);
  return body === undefined ? req : req.send(body);
};
const get = (index = 0) =>
  request(app.getHttpServer()).get('/api/v1/student/homework').set('Cookie', cookie(index));
test('real Nest routes isolate two students, return DTO with no-store and require no student MFA', async () => {
  const a = await get(),
    b = await get(1);
  expect(a.status).toBe(200);
  expect(b.status).toBe(200);
  expect(a.body.items[0].homeworkId).toBe(hws[0]);
  expect(b.body.items[0].homeworkId).toBe(hws[1]);
  expect(JSON.stringify(a.body)).not.toContain(hws[1]);
  expect(a.headers['cache-control']).toBe('no-store');
});
test('unauthenticated request is 401; TEACHER is 403', async () => {
  expect((await request(app.getHttpServer()).get('/api/v1/student/homework')).status).toBe(401);
  expect((await get(2)).status).toBe(403);
});
test('inactive access is 402; forced password change is 403', async () => {
  state.active = false;
  expect((await get()).status).toBe(402);
  state.active = true;
  state.mustChange = true;
  expect((await get()).status).toBe(403);
});
test.each([
  ['draft', { content: 'x' }],
  ['submit', { content: 'x' }],
  ['upload-url', { fileName: 'x.txt', mimeType: 'text/plain', fileSizeBytes: 8 }],
  ['files/' + randomUUID() + '/confirm', undefined],
])('every homework mutation checks CSRF: %s', async (suffix, body) => {
  expect((await command(suffix, body, 0, hws[0], randomUUID(), false)).status).toBe(403);
  expect(state.submissions).toHaveLength(0);
  expect(state.files.size).toBe(0);
});
test('foreign homework returns 403 before storage or DB writes', async () => {
  expect((await command('draft', { content: 'secret' }, 0, hws[1])).status).toBe(403);
  expect(
    (
      await command(
        'upload-url',
        { fileName: 'x', mimeType: 'text/plain', fileSizeBytes: 8 },
        0,
        hws[1],
      )
    ).status,
  ).toBe(403);
  expect(state.drafts.size).toBe(0);
  expect(storage.sign).not.toHaveBeenCalled();
});
test('parallel draft commands share a single row in transactional storage mock', async () => {
  const results = await Promise.all(
    ['one', 'two', 'three'].map((content) => command('draft', { content })),
  );
  expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
  expect(state.drafts.size).toBe(1);
  expect(['one', 'two', 'three']).toContain(state.drafts.get(hws[0]).content);
});
test('same-key submission replays exact 201, different payload is 422, new command while SUBMITTED is 409', async () => {
  const key = randomUUID(),
    first = await command('submit', { content: 'answer' }, 0, hws[0], key),
    second = await command('submit', { content: 'answer' }, 0, hws[0], key);
  expect(first.status).toBe(201);
  expect(second.status).toBe(201);
  expect(second.body).toEqual(first.body);
  expect(first.body.isLate).toBe(true);
  expect(state.submissions).toHaveLength(1);
  expect((await command('submit', { content: 'changed' }, 0, hws[0], key)).status).toBe(422);
  expect((await command('submit', { content: 'again' })).status).toBe(409);
  expect(state.outbox).toHaveLength(1);
  expect(state.audit.find((x) => x.action === 'student.homework.submit').resource_id).toBe(
    first.body.submissionId,
  );
});
test('resubmission preserves version 1 and its teacher comment', async () => {
  const old = await command('submit', { content: 'first' });
  state.reviews.push({
    submission_id: old.body.submissionId,
    result: 'NEEDS_REVISION',
    comment: 'Please explain',
  });
  const next = await command('submit', { content: 'second' });
  expect(next.status).toBe(201);
  expect(next.body.versionNumber).toBe(2);
  expect(state.submissions[0].content.text).toBe('first');
  expect(state.reviews[0].comment).toBe('Please explain');
});
test('outbox failure rolls back submission and draft erasure', async () => {
  await command('draft', { content: 'saved' });
  state.outboxFailure = true;
  const response = await command('submit', { content: 'answer' });
  expect(response.status).toBe(503);
  expect(state.submissions).toHaveLength(0);
  expect(state.drafts.get(hws[0]).content).toBe('saved');
  expect(JSON.stringify(response.body)).not.toContain('private outbox');
});
test('PUT capability is generated only after commit; idempotency never stores URL; confirm before submit', async () => {
  const key = randomUUID(),
    body = { fileName: 'answer.txt', mimeType: 'text/plain', fileSizeBytes: 8 };
  const first = await command('upload-url', body, 0, hws[0], key);
  expect(first.status).toBe(201);
  expect(first.body.uploadUrl).toContain('private.invalid');
  expect(state.files.get(first.body.fileId).status).toBe('PENDING');
  expect(JSON.stringify([...state.records.values()])).not.toContain('signature');
  expect(JSON.stringify(state.outbox)).not.toContain('answer.txt');
  const replay = await command('upload-url', body, 0, hws[0], key);
  expect(replay.body.fileId).toBe(first.body.fileId);
  expect(state.files.size).toBe(1);
  expect(storage.sign).toHaveBeenCalledTimes(2);
  expect(
    (await command('submit', { content: 'answer', fileIds: [first.body.fileId] })).status,
  ).toBe(422);
  const confirmed = await command(`files/${first.body.fileId}/confirm`);
  expect(confirmed.status).toBe(200);
  expect(state.files.get(first.body.fileId).status).toBe('VERIFIED');
  expect(
    (await command('submit', { content: 'answer', fileIds: [first.body.fileId] })).status,
  ).toBe(201);
  expect(state.submissions[0].attachments.create).toEqual([{ file_id: first.body.fileId }]);
});
test('cached replay still rechecks current owner and active access', async () => {
  const key = randomUUID();
  await command('draft', { content: 'saved' }, 0, hws[0], key);
  state.deliveries.get(hws[0]).student_id = students[1];
  expect((await command('draft', { content: 'saved' }, 0, hws[0], key)).status).toBe(403);
});
test('client cannot inject grades, status or student ownership', async () => {
  expect((await command('submit', { content: 'answer', grade: 10 })).status).toBe(400);
  expect((await command('draft', { content: 'answer', student_id: students[1] })).status).toBe(400);
  expect(state.submissions).toHaveLength(0);
});

test('signing failure after commit preserves PENDING intent and same-key retry recovers without another file', async () => {
  storage.sign.mockRejectedValueOnce(
    new AppException(domainError('PRIVATE_STORAGE_UNAVAILABLE', 503)),
  );
  const key = randomUUID(),
    body = { fileName: 'answer.txt', mimeType: 'text/plain', fileSizeBytes: 8 };
  expect((await command('upload-url', body, 0, hws[0], key)).status).toBe(503);
  expect(state.files.size).toBe(1);
  expect([...state.files.values()][0].status).toBe('PENDING');
  const replay = await command('upload-url', body, 0, hws[0], key);
  expect(replay.status).toBe(201);
  expect(state.files.size).toBe(1);
  expect(storage.sign).toHaveBeenCalledTimes(2);
});

test('trailing slash still projects the committed file ID into an upload URL', async () => {
  const response = await command('upload-url/', {
    fileName: 'x.txt',
    mimeType: 'text/plain',
    fileSizeBytes: 8,
  });
  expect(response.status).toBe(201);
  expect(response.body.uploadUrl).toContain('private.invalid');
  expect(state.files.size).toBe(1);
});

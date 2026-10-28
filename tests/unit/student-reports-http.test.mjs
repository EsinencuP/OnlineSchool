import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { beforeAll, afterAll, beforeEach, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import request from 'supertest';
import { AppModule } from '../../apps/api/dist/app.module.js';
import { DatabaseService } from '../../apps/api/dist/core/database/database.module.js';
import { SessionStore } from '../../apps/api/dist/core/session/session.store.js';
import { PrivateUploads } from '../../apps/api/dist/modules/storage/private-uploads.service.js';
import { educationPdfFixture } from '../support/education-pdf-fixture.mjs';
const { Test } = createRequire(new URL('../../apps/api/package.json', import.meta.url))(
  '@nestjs/testing',
);
const users = [randomUUID(), randomUUID(), randomUUID()],
  students = [randomUUID(), randomUUID()],
  reports = [randomUUID(), randomUUID()],
  subject = randomUUID(),
  now = new Date();
let app, db, state, issued;
const identity = (id) => ({
  id,
  kind: id === users[2] ? 'TEACHER' : 'STUDENT',
  disabled_at: null,
  recovery_registration_required: false,
  login_id: 'test@example.invalid',
});
const storage = {
  bucket: jest.fn(() => 'school-files'),
  signPdf: jest.fn(async () => 'https://storage.example.invalid/fake-signed-url'),
};
const row = (i) => ({
  ...educationPdfFixture().reports[0],
  reportId: reports[i],
  periodFrom: '2026-09-01T00:00:00Z',
  periodTo: '2026-09-30T00:00:00Z',
  isNew: !state.reads.has(reports[i] + ':' + students[i]),
});
beforeAll(async () => {
  db = {
    $queryRaw: jest.fn(async (first, ...args) => {
      const sql = Array.isArray(first) ? first.join('?') : first.sql,
        values = Array.isArray(first) ? args : first.values;
      if (sql.includes('SELECT r.code'))
        return [{ code: values[0] === users[2] ? 'TEACHER' : 'STUDENT' }];
      if (sql.includes('AS has_active_access'))
        return [{ subject_ids: [subject], has_active_access: state.active }];
      if (sql.includes('WITH published_reports')) {
        const owner = values.find((v) => students.includes(v)),
          index = students.indexOf(owner);
        if (sql.includes('SELECT id FROM published_reports WHERE id='))
          return values.includes(reports[index]) ? [{ id: reports[index] }] : [];
        return [{ items: index >= 0 ? [row(index)] : [], total: index >= 0 ? 1 : 0 }];
      }
      return [{ now, locked: true }];
    }),
    studentAccount: {
      findFirst: jest.fn(async ({ where }) => ({
        id: where.account_id,
        student_id: students[users.indexOf(where.account_id)],
        must_change_password: state.mustChange,
        timezone: 'Europe/Chisinau',
        deactivated_at: null,
        created_at: now,
        student: { full_name: 'Synthetic pupil' },
        account: identity(where.account_id),
      })),
    },
    teacherAccount: { findFirst: jest.fn(async () => ({ deactivated_at: null })) },
    accessRevocation: { findFirst: jest.fn(async () => null) },
    session: {
      create: jest.fn(async ({ data }) => {
        const r = { ...data, id: randomUUID(), revoked_at: null };
        state.sessions.set(r.id, r);
        return r;
      }),
      findUnique: jest.fn(async ({ where }) => {
        const r = where.id
          ? state.sessions.get(where.id)
          : [...state.sessions.values()].find((s) => s.token_hash === where.token_hash);
        return r ? { ...r, account: identity(r.account_id) } : null;
      }),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    educationReportRead: {
      createMany: jest.fn(async ({ data }) => {
        const r = data[0],
          key = r.report_id + ':' + r.student_id;
        if (state.reads.has(key)) return { count: 0 };
        state.reads.set(key, r);
        return { count: 1 };
      }),
    },
    studentSubjectEnrollment: {
      findFirst: jest.fn(async ({ where }) =>
        where.subject_id === subject ? { id: subject } : null,
      ),
    },
    jobRecord: {
      create: jest.fn(async ({ data }) => {
        const r = { ...data, status: 'PENDING', attempts: 0 };
        state.jobs.set(r.id, r);
        return r;
      }),
    },
    pdfExportJob: {
      create: jest.fn(async ({ data }) => {
        const r = { ...data, ready_at: null, expires_at: null, object_key: null };
        state.pdf.set(r.id, r);
        return r;
      }),
      count: jest.fn(
        async ({ where }) =>
          [...state.pdf.values()].filter(
            (r) =>
              r.student_id === where.student_id &&
              where.job_ref.status.in.includes(state.jobs.get(r.id).status),
          ).length,
      ),
      findFirst: jest.fn(async ({ where }) => {
        const r = state.pdf.get(where.id);
        return r && r.student_id === where.student_id && r.requested_by === where.requested_by
          ? { ...r, job_ref: state.jobs.get(r.id) }
          : null;
      }),
    },
    auditEvent: {
      create: jest.fn(async ({ data }) => {
        state.audit.push(data);
        return data;
      }),
    },
    outboxEvent: {
      create: jest.fn(async ({ data }) => {
        if (state.failOutbox) throw Error('PRIVATE outbox failure');
        state.outbox.push(data);
        return data;
      }),
    },
    idempotencyRecord: {
      findUnique: jest.fn(async ({ where }) => {
        const k = where.scope_command_type_key;
        return (
          [...state.records.values()].find(
            (r) => r.scope === k.scope && r.command_type === k.command_type && r.key === k.key,
          ) ?? null
        );
      }),
      create: jest.fn(async ({ data }) => {
        const r = { ...data, status: 'PENDING' };
        state.records.set(r.id, r);
        return r;
      }),
      update: jest.fn(async ({ where, data }) => Object.assign(state.records.get(where.id), data)),
      delete: jest.fn(async ({ where }) => state.records.delete(where.id)),
    },
    $disconnect: jest.fn(async () => {}),
  };
  db.$transaction = jest.fn(async (fn) => {
    const before = structuredClone(state);
    try {
      return await fn(db);
    } catch (e) {
      state = before;
      throw e;
    }
  });
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
    reads: new Map(),
    records: new Map(),
    jobs: new Map(),
    pdf: new Map(),
    audit: [],
    outbox: [],
    active: true,
    mustChange: false,
    failOutbox: false,
  };
  issued = await Promise.all(users.map((id) => app.get(SessionStore).issue(db, id)));
});
const get = (suffix = '', i = 0) =>
  request(app.getHttpServer())
    .get('/api/v1/student/reports' + suffix)
    .set('Cookie', `__Host-school_session=${issued[i].token}`);
const post = (suffix, body = {}, i = 0, key = randomUUID(), csrf = true) => {
  const r = request(app.getHttpServer())
    .post('/api/v1/student/reports' + suffix)
    .set(
      'Cookie',
      `__Host-school_session=${issued[i].token}; __Host-school_csrf=${issued[i].csrfToken}`,
    )
    .set('Idempotency-Key', key);
  if (csrf) r.set('X-CSRF-Token', issued[i].csrfToken);
  return r.send(body);
};
test('reports default ten, no-store, date-only periods, server pupil ownership', async () => {
  for (let i = 0; i < 2; i++) {
    const r = await get('', i);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ total: 1, page: 1, pageSize: 10 });
    expect(r.body.items[0]).toMatchObject({
      reportId: reports[i],
      periodFrom: '2026-09-01',
      lessonCount: 8,
      isNew: true,
    });
    expect(JSON.stringify(r.body)).not.toContain(reports[1 - i]);
    expect(r.headers['cache-control']).toBe('no-store');
  }
});
test('first read is 204, same-key replay and new-key repeat are 200; isNew changes once', async () => {
  const key = randomUUID(),
    suffix = `/${reports[0]}/read`;
  expect((await post(suffix, {}, 0, key)).status).toBe(204);
  const replay = await post(suffix, {}, 0, key);
  expect(replay.status).toBe(200);
  expect(replay.text).toBe('');
  expect((await post(suffix)).status).toBe(200);
  expect(state.reads.size).toBe(1);
  expect((await get()).body.items[0].isNew).toBe(false);
});
test('read mark cannot target another pupil or an unknown report', async () => {
  for (const id of [reports[1], randomUUID()]) expect((await post(`/${id}/read`)).status).toBe(403);
  expect(state.reads.size).toBe(0);
});
test('queued export is 202 and replay returns the same job without duplicate work', async () => {
  const key = randomUUID(),
    first = await post('/export-pdf', {}, 0, key),
    replay = await post('/export-pdf', {}, 0, key);
  expect(first.status).toBe(202);
  expect(first.body).toMatchObject({ status: 'QUEUED' });
  expect(replay.body).toEqual(first.body);
  expect(state.jobs.size).toBe(1);
  expect(state.pdf.size).toBe(1);
  expect(state.outbox).toHaveLength(1);
  expect(JSON.stringify([...state.records.values()])).not.toContain('https://');
});
test('status progresses to READY with a URL only for its requesting pupil', async () => {
  const queued = await post('/export-pdf'),
    id = queued.body.jobId;
  expect((await get(`/export-pdf/${id}`)).body).toMatchObject({
    status: 'QUEUED',
    downloadUrl: null,
  });
  state.jobs.get(id).status = 'RUNNING';
  expect((await get(`/export-pdf/${id}`)).body.status).toBe('PROCESSING');
  state.jobs.get(id).status = 'SUCCEEDED';
  Object.assign(state.pdf.get(id), {
    ready_at: now,
    expires_at: new Date(+now + 3600000),
    bucket: 'school-files',
    object_key: `student-exports/${id}/${randomUUID()}.pdf`,
  });
  expect((await get(`/export-pdf/${id}`)).body).toMatchObject({
    status: 'READY',
    downloadUrl: 'https://storage.example.invalid/fake-signed-url',
  });
  expect((await get(`/export-pdf/${id}`, 1)).status).toBe(403);
  expect((await get(`/export-pdf/${randomUUID()}`)).status).toBe(403);
});
test('third outstanding PDF is rejected with 429', async () => {
  expect((await post('/export-pdf')).status).toBe(202);
  expect((await post('/export-pdf')).status).toBe(202);
  expect((await post('/export-pdf')).status).toBe(429);
  expect(state.jobs.size).toBe(2);
});
test.each(['/export-pdf', `/${reports[0]}/read`])('CSRF required for %s', async (suffix) => {
  expect((await post(suffix, {}, 0, randomUUID(), false)).status).toBe(403);
  expect(state.jobs.size).toBe(0);
  expect(state.reads.size).toBe(0);
});
test('UUID idempotency key is required before queueing', async () => {
  const r = await post('/export-pdf', {}, 0, 'bad');
  expect(r.status).toBe(400);
  expect(state.jobs.size).toBe(0);
});
test('same command key with a changed selection is rejected', async () => {
  const key = randomUUID();
  await post('/export-pdf', {}, 0, key);
  expect((await post('/export-pdf', { subjectId: subject }, 0, key)).status).toBe(422);
  expect(state.jobs.size).toBe(1);
});
test.each([
  ['read', `/${reports[0]}/read`],
  ['queue', '/export-pdf'],
])('outbox failure rolls back %s and its idempotency state', async (_name, suffix) => {
  state.failOutbox = true;
  const r = await post(suffix);
  expect(r.status).toBe(503);
  expect(state.reads.size).toBe(0);
  expect(state.jobs.size).toBe(0);
  expect(state.pdf.size).toBe(0);
  expect(state.records.size).toBe(0);
  expect(JSON.stringify(r.body)).not.toContain('PRIVATE');
});
test.each(['', '/export-pdf/' + randomUUID()])('anonymous GET %s is forbidden', async (suffix) =>
  expect((await request(app.getHttpServer()).get('/api/v1/student/reports' + suffix)).status).toBe(
    401,
  ),
);
test('teacher cannot read student reports or queue a student export', async () => {
  expect((await get('', 2)).status).toBe(403);
  expect((await post('/export-pdf', {}, 2)).status).toBe(403);
});
test('inactive access and initial-password state block report routes', async () => {
  state.active = false;
  expect((await get()).status).toBe(402);
  expect((await post('/export-pdf')).status).toBe(402);
  state.active = true;
  state.mustChange = true;
  expect((await get()).status).toBe(403);
});
test.each([
  { studentProfileId: students[1] },
  { subjectId: 'bad' },
  { periodFrom: '2026-02-30' },
  { periodTo: 'bad' },
])('invalid export body rejected %j', async (body) =>
  expect((await post('/export-pdf', body)).status).toBe(400),
);
test.each(['?page=0', '?pageSize=101', '?studentId=' + students[1]])(
  'invalid list query %s',
  async (query) => expect((await get(query)).status).toBe(400),
);
test('no student route creates or changes an educational report', async () => {
  expect((await post('', { content: { achievements: 'fake' } })).status).toBe(404);
  expect(
    (
      await request(app.getHttpServer())
        .patch('/api/v1/student/reports/' + reports[0])
        .set('Cookie', `__Host-school_session=${issued[0].token}`)
        .send({ content: 'fake' })
    ).status,
  ).toBe(404);
});

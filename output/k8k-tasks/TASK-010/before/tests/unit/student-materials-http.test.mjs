import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { beforeAll, afterAll, beforeEach, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import request from 'supertest';
import { AppModule } from '../../apps/api/dist/app.module.js';
import { DatabaseService } from '../../apps/api/dist/core/database/database.module.js';
import { SessionStore } from '../../apps/api/dist/core/session/session.store.js';
import { PrivateUploads } from '../../apps/api/dist/modules/storage/private-uploads.service.js';
const { Test } = createRequire(new URL('../../apps/api/package.json', import.meta.url))(
  '@nestjs/testing',
);
const users = [randomUUID(), randomUUID(), randomUUID()],
  students = [randomUUID(), randomUUID()],
  files = [randomUUID(), randomUUID()],
  subjects = [randomUUID(), randomUUID()],
  now = new Date('2026-10-27T12:00:00Z');
let app, db, state, issued, storage;
const account = (id) => ({
  id,
  kind: id === users[2] ? 'TEACHER' : 'STUDENT',
  disabled_at: null,
  recovery_registration_required: false,
  login_id: `${users.indexOf(id)}@example.invalid`,
});
const visible = (p, user) =>
  p.userId === user &&
  p.teacherGrant &&
  p.revoked_at === null &&
  p.granted_at <= now &&
  (!p.expires_at || p.expires_at > now) &&
  p.status === 'VERIFIED';
beforeAll(async () => {
  db = {
    $queryRaw: jest.fn(async (first, ...args) => {
      const sql = Array.isArray(first) ? first.join('?') : first.sql,
        values = Array.isArray(first) ? args : first.values;
      if (sql.includes('SELECT r.code'))
        return [{ code: values[0] === users[2] ? 'TEACHER' : 'STUDENT' }];
      if (sql.includes('AS has_active_access'))
        return [{ subject_ids: subjects, has_active_access: state.active }];
      if (sql.includes('WITH visible AS')) {
        const user = values.find((x) => users.includes(x)),
          subject = values.find((x) => subjects.includes(x));
        let rows = state.grants.filter(
          (p) => visible(p, user) && (!subject || p.subjectId === subject),
        );
        const total = rows.length;
        const [limit, offset] = values.filter((x) => typeof x === 'number');
        rows = rows.slice(offset, offset + limit);
        return [
          {
            items: rows.map((p) => ({
              fileId: p.file_id,
              fileName: p.file_name,
              fileSizeBytes: 8,
              mimeType: 'application/pdf',
              subjectName: 'Math',
              uploadedAt: now.toISOString(),
              sharedAt: p.granted_at.toISOString(),
              sharedByTeacherName: 'Teacher',
              lessonTitle: null,
            })),
            total,
          },
        ];
      }
      if (sql.includes('FOR SHARE OF p,o')) {
        const user = values.find((x) => users.includes(x)),
          id = values.find((x) => files.includes(x));
        return state.grants.filter((p) => p.file_id === id && visible(p, user));
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
          : [...state.sessions.values()].find((r) => r.token_hash === where.token_hash);
        return row ? { ...row, account: account(row.account_id) } : null;
      }),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    fileAuditLog: {
      create: jest.fn(async ({ data }) => {
        if (state.auditFailure) throw Error('provider secret data');
        state.fileAudit.push(data);
        return data;
      }),
    },
    auditEvent: {
      create: jest.fn(async ({ data }) => {
        state.securityAudit.push(data);
        return data;
      }),
    },
    $disconnect: jest.fn(async () => {}),
  };
  let tail = Promise.resolve();
  db.$transaction = jest.fn((fn) => {
    const result = tail.then(async () => {
      if (state.revokeOnTransaction) {
        state.grants[0].revoked_at = now;
        state.revokeOnTransaction = false;
      }
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
    signRead: jest.fn(async () => 'https://private.invalid/temporary?signature=capability'),
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
    active: true,
    mustChange: false,
    fileAudit: [],
    securityAudit: [],
    auditFailure: false,
    revokeOnTransaction: false,
    grants: files.map((file_id, i) => ({
      permission_id: randomUUID(),
      file_id,
      userId: users[i],
      teacherGrant: true,
      status: 'VERIFIED',
      revoked_at: null,
      granted_at: new Date(+now - 1000),
      expires_at: null,
      subjectId: subjects[i],
      bucket: 'online-school-files',
      key: `private/hidden/${i}`,
      file_name: `Material ${i}.pdf`,
      can_download: false,
    })),
  };
  issued = await Promise.all(users.map((id) => app.get(SessionStore).issue(db, id)));
});
const get = (path = '', index = 0) =>
  request(app.getHttpServer())
    .get(`/api/v1/student/materials${path}`)
    .set('Cookie', `__Host-school_session=${issued[index].token}`);
test('actual Nest list returns only explicitly permitted files, DTO and no-store headers', async () => {
  const a = await get(),
    b = await get('', 1);
  expect(a.status).toBe(200);
  expect(a.body.pageSize).toBe(30);
  expect(a.body.items.map((x) => x.fileId)).toEqual([files[0]]);
  expect(b.body.items.map((x) => x.fileId)).toEqual([files[1]]);
  expect(JSON.stringify(a.body)).not.toContain('hidden');
  expect(JSON.stringify(a.body)).not.toContain('online-school-files');
  expect(a.headers['cache-control']).toBe('no-store');
  expect(storage.signRead).not.toHaveBeenCalled();
});
test('subject filter cannot cross students and empty page preserves total', async () => {
  expect((await get(`?subjectId=${subjects[1]}`)).body.items).toEqual([]);
  const page = await get('?page=2&pageSize=1');
  expect(page.body.items).toEqual([]);
  expect(page.body.total).toBe(1);
});
test('GET URL needs the session but no CSRF or idempotency key, and only returns the capability DTO', async () => {
  const result = await get(`/${files[0]}/url`);
  expect(result.status).toBe(200);
  expect(Object.keys(result.body).sort()).toEqual(['expiresAt', 'fileName', 'url']);
  expect(result.body.expiresAt).toBe('2026-10-27T12:15:00.000Z');
  expect(result.headers['cache-control']).toBe('no-store');
  expect(state.fileAudit[0]).toMatchObject({
    action: 'VIEW',
    permission_id: state.grants[0].permission_id,
  });
  expect(JSON.stringify(state.fileAudit)).not.toContain('capability');
});
test('known file ID of another student and an absent file both return 403', async () => {
  expect((await get(`/${files[1]}/url`)).status).toBe(403);
  expect((await get(`/${randomUUID()}/url`)).status).toBe(403);
  expect(storage.signRead).not.toHaveBeenCalled();
});
test.each([
  { revoked_at: now },
  { expires_at: now },
  { granted_at: new Date(+now + 1000) },
  { status: 'PENDING' },
  { status: 'QUARANTINED' },
  { status: 'DELETED' },
  { teacherGrant: false },
])('unavailable or non-teacher permission excluded: %j', async (change) => {
  Object.assign(state.grants[0], change);
  expect((await get()).body.items).toEqual([]);
  expect((await get(`/${files[0]}/url`)).status).toBe(403);
  expect(storage.signRead).not.toHaveBeenCalled();
});
test('revocation between the first guard and locked issuance prevents a capability', async () => {
  state.revokeOnTransaction = true;
  expect((await get(`/${files[0]}/url`)).status).toBe(403);
  expect(storage.signRead).not.toHaveBeenCalled();
  expect(state.securityAudit.at(-1).metadata.code).toBe('FILE_ACCESS_DENIED');
});
test('unauthenticated 401, teacher 403, suspended 402 and forced password change 403', async () => {
  expect((await request(app.getHttpServer()).get('/api/v1/student/materials')).status).toBe(401);
  expect((await get('', 2)).status).toBe(403);
  state.active = false;
  expect((await get()).status).toBe(402);
  state.active = true;
  state.mustChange = true;
  expect((await get(`/${files[0]}/url`)).status).toBe(403);
});
test.each([
  '?studentProfileId=' + students[1],
  '?subjectId=bad',
  '?pageSize=101',
  '/' + files[0] + '/url?download=true',
  '/bad/url',
])('unknown query or invalid ID rejected: %s', async (path) =>
  expect((await get(path)).status).toBe(400),
);
test('audit failure is sanitized and never returns a signed URL', async () => {
  state.auditFailure = true;
  const result = await get(`/${files[0]}/url`);
  expect(result.status).toBe(503);
  expect(result.body.url).toBeUndefined();
  expect(JSON.stringify(result.body)).not.toContain('provider secret');
  expect(state.fileAudit).toHaveLength(0);
});

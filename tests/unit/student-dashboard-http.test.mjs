import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { beforeAll, afterAll, beforeEach, expect, jest, test } from '@jest/globals';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../apps/api/dist/app.module.js';
import { DatabaseService } from '../../apps/api/dist/core/database/database.module.js';
import { SessionStore } from '../../apps/api/dist/core/session/session.store.js';
const requireApi = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const { Test } = requireApi('@nestjs/testing');
const { CACHE_MANAGER } =
  await import('../../apps/api/node_modules/@nestjs/cache-manager/dist/index.js');
const users = [randomUUID(), randomUUID(), randomUUID()],
  students = [randomUUID(), randomUUID()];
let app, db, sessions, issued, revisions, active, mustChange, empty, broken, homework;
const rows = new Map();
const actor = (id) => ({
  id,
  kind: id === users[2] ? 'TEACHER' : 'STUDENT',
  disabled_at: null,
  recovery_registration_required: false,
  login_id: `${users.indexOf(id)}@example.invalid`,
});
const profile = (id) => ({
  id: randomUUID(),
  student_id: students[users.indexOf(id)],
  must_change_password: mustChange,
  deactivated_at: null,
  created_at: new Date('2026-01-01Z'),
  student: { full_name: `Student ${users.indexOf(id)}` },
  account: actor(id),
});
beforeAll(async () => {
  db = {
    $queryRaw: jest.fn(async (parts, ...values) => {
      const sql = parts.join('?');
      if (sql.includes('SELECT r.code'))
        return [{ code: values[0] === users[2] ? 'TEACHER' : 'STUDENT' }];
      if (sql.includes('AS has_active_access'))
        return [{ subject_ids: [], has_active_access: active }];
      if (sql.includes('student_dashboard_revisions')) {
        if (broken) throw Error('private connection failure');
        return [{ revision: revisions.get(values[0]) ?? '0' }];
      }
      const sid = values.find((value) => students.includes(value));
      const owner = students.indexOf(sid);
      if (sql.includes('SELECT l.id'))
        return empty
          ? []
          : [
              {
                id: sid,
                scheduled_at: new Date(Date.now() + 5 * 60000),
                scheduled_end_at: new Date(Date.now() + 65 * 60000),
                teacher_name: `Teacher ${owner}`,
                subject_name: `Subject ${owner}`,
                google_meet_link: owner
                  ? 'https://meet.google.com/xyz-abcd-efg'
                  : 'https://meet.google.com/abc-defg-hij',
              },
            ];
      if (sql.includes('AS "notSubmitted"'))
        return [{ notSubmitted: homework, submitted: 0, needsRevision: 0, total: homework }];
      if (sql.includes('AS is_frozen'))
        return empty
          ? []
          : [
              {
                remaining: owner + 3,
                valid_to: new Date('2026-12-01Z'),
                is_frozen: false,
                frozen_until: null,
              },
            ];
      if (sql.includes('AS familiarizing'))
        return [{ familiarizing: owner + 1, practicing: 0, applying: 0, notStudied: 0 }];
      return [{ now: new Date() }];
    }),
    studentAccount: {
      findFirst: jest.fn(async ({ where }) =>
        users.includes(where.account_id) ? profile(where.account_id) : null,
      ),
    },
    teacherAccount: { findFirst: jest.fn(async () => ({ deactivated_at: null })) },
    session: {
      create: jest.fn(async ({ data }) => {
        const row = { ...data, id: randomUUID(), revoked_at: null };
        rows.set(row.id, row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }) => {
        const row = [...rows.values()].find((r) => r.token_hash === where.token_hash);
        return row ? { ...row, account: actor(row.account_id) } : null;
      }),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    accessRevocation: { findFirst: jest.fn(async () => null) },
    auditEvent: { create: jest.fn(async () => ({})) },
    $disconnect: jest.fn(async () => {}),
  };
  db.$transaction = jest.fn(async (fn) => fn(db));
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DatabaseService)
    .useValue({ client: db })
    .compile();
  app = module.createNestApplication();
  app.useLogger(false);
  await app.init();
  sessions = app.get(SessionStore);
});
afterAll(async () => {
  await app?.close();
});
beforeEach(async () => {
  revisions = new Map();
  active = true;
  mustChange = false;
  empty = false;
  broken = false;
  homework = 1;
  rows.clear();
  await app.get(CACHE_MANAGER).clear();
  db.$queryRaw.mockClear();
  issued = await Promise.all(users.map((user) => sessions.issue(db, user)));
});
const cookie = (index) => `__Host-school_session=${issued[index].token}`;
const get = (index = 0, path = '/api/v1/student/dashboard') =>
  request(app.getHttpServer()).get(path).set('Cookie', cookie(index));

test('real Nest endpoint aggregates for two separate authenticated sessions and isolates warm caches', async () => {
  const a = await get(0);
  const b = await get(1);
  const spoof = await get(0, `/api/v1/student/dashboard?studentProfileId=${students[1]}`);
  expect(a.status).toBe(200);
  expect(b.status).toBe(200);
  expect(spoof.status).toBe(200);
  expect(a.body.nextLesson).toMatchObject({
    lessonId: students[0],
    teacherName: 'Teacher 0',
    canJoin: true,
  });
  expect(b.body.nextLesson.lessonId).toBe(students[1]);
  expect(spoof.body).toEqual(a.body);
  expect(JSON.stringify(a.body)).not.toContain(students[1]);
  expect(JSON.stringify(a.body)).not.toContain('Teacher 1');
  expect(a.headers['cache-control']).toBe('no-store');
  expect(Math.abs(Date.now() - Date.parse(a.body.generatedAt))).toBeLessThan(5000);
  expect(Object.keys(a.body).sort()).toEqual([
    'generatedAt',
    'homework',
    'nextLesson',
    'skillProgress',
    'subscription',
  ]);
});
test('anonymous and teacher sessions cannot access student dashboards', async () => {
  expect((await request(app.getHttpServer()).get('/api/v1/student/dashboard')).status).toBe(401);
  expect((await get(2)).status).toBe(403);
});
test('suspended, initial-password and revoked sessions cannot read a previously warmed dashboard', async () => {
  expect((await get()).status).toBe(200);
  active = false;
  expect((await get()).status).toBe(402);
  active = true;
  mustChange = true;
  expect((await get()).body.code).toBe('MUST_CHANGE_PASSWORD');
  mustChange = false;
  rows.get(issued[0].sessionId).revoked_at = new Date();
  expect((await get()).status).toBe(401);
});
test('homework commit changes the revision and invalidates the real cache before its TTL', async () => {
  expect((await get()).body.homework.total).toBe(1);
  homework = 4;
  revisions.set(students[0], '1');
  expect((await get()).body.homework.total).toBe(4);
});
test('missing lesson/subscription returns null; inaccessible revision state returns sanitized 503', async () => {
  empty = true;
  const response = await get();
  expect(response.status).toBe(200);
  expect(response.body.nextLesson).toBeNull();
  expect(response.body.subscription).toBeNull();
  broken = true;
  const failed = await get();
  expect(failed.status).toBe(503);
  expect(failed.body.code).toBe('DASHBOARD_UNAVAILABLE');
  expect(JSON.stringify(failed.body)).not.toContain('private connection');
});

import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { beforeAll, afterAll, beforeEach, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import request from 'supertest';
import { AppModule } from '../../apps/api/dist/app.module.js';
import { DatabaseService } from '../../apps/api/dist/core/database/database.module.js';
import { SessionStore } from '../../apps/api/dist/core/session/session.store.js';
import { StudentSkillsService } from '../../apps/api/dist/student/skills/skills.service.js';
const { Test } = createRequire(new URL('../../apps/api/package.json', import.meta.url))(
  '@nestjs/testing',
);
const users = [randomUUID(), randomUUID(), randomUUID()],
  students = [randomUUID(), randomUUID()],
  skill = randomUUID(),
  now = new Date();
let app, db, state, issued;
const identity = (id) => ({
  id,
  kind: id === users[2] ? 'TEACHER' : 'STUDENT',
  disabled_at: null,
  recovery_registration_required: false,
  login_id: 'test@example.invalid',
});
const service = { maps: jest.fn(), audit: jest.fn(), snapshots: jest.fn() };
beforeAll(async () => {
  db = {
    $queryRaw: jest.fn(async (first, ...args) => {
      const sql = Array.isArray(first) ? first.join('?') : first.sql,
        values = Array.isArray(first) ? args : first.values;
      if (sql.includes('SELECT r.code'))
        return [{ code: values[0] === users[2] ? 'TEACHER' : 'STUDENT' }];
      if (sql.includes('AS has_active_access'))
        return [{ subject_ids: [], has_active_access: state.active }];
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
        account: identity(where.account_id),
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
        return row ? { ...row, account: identity(row.account_id) } : null;
      }),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    auditEvent: { create: jest.fn(async ({ data }) => data) },
    $disconnect: jest.fn(async () => {}),
  };
  db.$transaction = jest.fn(async (fn) => fn(db));
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DatabaseService)
    .useValue({ client: db })
    .overrideProvider(StudentSkillsService)
    .useValue(service)
    .compile();
  app = module.createNestApplication();
  app.useLogger(false);
  await app.init();
});
afterAll(async () => app?.close());
beforeEach(async () => {
  jest.clearAllMocks();
  state = { sessions: new Map(), active: true, mustChange: false };
  issued = await Promise.all(users.map((id) => app.get(SessionStore).issue(db, id)));
  service.maps.mockImplementation(async (ctx) => [
    { subjectId: ctx.studentProfileId, skills: [], learningGoals: [], nextSnapshotIn: 4 },
  ]);
  service.audit.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
  service.snapshots.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
});
const get = (suffix = '', user = 0) =>
  request(app.getHttpServer())
    .get('/api/v1/student/skills' + suffix)
    .set('Cookie', `__Host-school_session=${issued[user].token}`);
test.each(['', '/audit?skillId=' + skill, '/snapshots'])(
  'anonymous request %s is 401',
  async (suffix) => {
    expect((await request(app.getHttpServer()).get('/api/v1/student/skills' + suffix)).status).toBe(
      401,
    );
    expect(service.maps).not.toHaveBeenCalled();
  },
);
test('maps get server context for each pupil with private no-store responses', async () => {
  for (let i = 0; i < 2; i++) {
    const r = await get('', i);
    expect(r.status).toBe(200);
    expect(r.body[0].subjectId).toBe(students[i]);
    expect(r.headers['cache-control']).toBe('no-store');
    expect(service.maps.mock.calls[i][0].studentProfileId).toBe(students[i]);
  }
});
test.each(['', '/audit?skillId=' + skill, '/snapshots'])(
  'teacher cannot use student route %s',
  async (suffix) => expect((await get(suffix, 2)).status).toBe(403),
);
test.each([
  ['/audit?skillId=' + skill, 'audit'],
  ['/snapshots', 'snapshots'],
])('route %s has bounded default pagination', async (suffix, method) => {
  expect((await get(suffix)).status).toBe(200);
  expect(service[method].mock.calls[0][1]).toMatchObject({ page: 1, pageSize: 20 });
});
test.each(['', '/audit?skillId=' + skill, '/snapshots'])(
  'inactive access remains blocked for %s',
  async (suffix) => {
    state.active = false;
    expect((await get(suffix)).status).toBe(402);
  },
);
test('initial password must change before viewing skill history', async () => {
  state.mustChange = true;
  expect((await get()).status).toBe(403);
  expect(service.maps).not.toHaveBeenCalled();
});
test.each([
  '?studentProfileId=' + students[1],
  '?subjectId=bad',
  '?subjectId=x&subjectId=y',
  '/audit',
  '/audit?skillId=' + skill + '&page=0',
  '/snapshots?pageSize=101',
  '/snapshots?subjectId=' + skill,
])('rejects untrusted query %s', async (suffix) => expect((await get(suffix)).status).toBe(400));
test.each(['post', 'put', 'patch', 'delete'])(
  'student has no %s skill mutation route',
  async (method) => {
    expect(
      (
        await request(app.getHttpServer())
          [method]('/api/v1/student/skills')
          .set('Cookie', `__Host-school_session=${issued[0].token}`)
          .send({ skillId: skill, status: 'APPLYING' })
      ).status,
    ).toBe(404);
  },
);

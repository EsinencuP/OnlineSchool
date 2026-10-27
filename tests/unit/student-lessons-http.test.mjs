import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { beforeAll, afterAll, beforeEach, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import request from 'supertest';
import { AppModule } from '../../apps/api/dist/app.module.js';
import { DatabaseService } from '../../apps/api/dist/core/database/database.module.js';
import { SessionStore } from '../../apps/api/dist/core/session/session.store.js';
import { StudentLessonsService } from '../../apps/api/dist/student/lessons/lessons.service.js';
const requireApi = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const { Test } = requireApi('@nestjs/testing');
const users = [randomUUID(), randomUUID(), randomUUID()],
  students = [randomUUID(), randomUUID()],
  lessons = [randomUUID(), randomUUID()];
const fixed = new Date('2026-10-27T12:00:00Z');
let app, db, store, state, issued;
const account = (id) => ({
  id,
  kind: id === users[2] ? 'TEACHER' : 'STUDENT',
  disabled_at: null,
  recovery_registration_required: false,
  login_id: `${users.indexOf(id)}@example.invalid`,
});
const profile = (id) => ({
  id,
  student_id: students[users.indexOf(id)],
  must_change_password: state.mustChange,
  timezone: 'Europe/Chisinau',
  deactivated_at: null,
  created_at: fixed,
  student: { full_name: 'Student' },
  account: account(id),
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
      if (sql.includes('FOR UPDATE OF l')) {
        const lesson = state.lessons.get(values[0]);
        return lesson ? [lesson] : [];
      }
      if (sql.includes('SELECT l.id FROM lesson_occurrences')) {
        const lesson = state.lessons.get(values[0]);
        return lesson && lesson.student_id === values[1] ? [{ id: lesson.id }] : [];
      }
      if (sql.includes('WITH records AS')) {
        const owner = values.find((v) => students.includes(v)),
          lesson = [...state.lessons.values()].find((l) => l.student_id === owner);
        if (!lesson) return [{ id: null, total: 0 }];
        return [
          {
            id: lesson.id,
            scheduled_at: lesson.scheduled_at,
            scheduled_end_at: new Date(+lesson.scheduled_at + 3600000),
            teacher_name: `Teacher ${students.indexOf(owner)}`,
            subject_name: 'Math',
            student_status: lesson.status,
            google_meet_link: null,
            total: 1,
          },
        ];
      }
      return [{ now: fixed, locked: true }];
    }),
    studentAccount: {
      findFirst: jest.fn(async ({ where }) =>
        users.includes(where.account_id) ? profile(where.account_id) : null,
      ),
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
    assignedManager: { findFirst: jest.fn(async () => null) },
    crmTask: {
      create: jest.fn(async ({ data }) => {
        const row = { ...data, id: randomUUID() };
        state.tasks.push(row);
        return row;
      }),
    },
    auditEvent: {
      create: jest.fn(async ({ data }) => {
        if (state.auditFailure) throw Error('private audit driver');
        state.audit.push(data);
        return data;
      }),
    },
    outboxEvent: {
      create: jest.fn(async ({ data }) => {
        if (state.outboxFailure) throw Error('private outbox driver');
        const row = { ...data, id: randomUUID() };
        state.outbox.push(row);
        return row;
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
        state.records.set(data.id, { ...data, status: 'PENDING' });
        return data;
      }),
      update: jest.fn(async ({ where, data }) => {
        const row = state.records.get(where.id);
        Object.assign(row, data);
        return row;
      }),
      delete: jest.fn(async ({ where }) => {
        state.records.delete(where.id);
      }),
    },
    $disconnect: jest.fn(async () => {}),
  };
  db.$transaction = jest.fn(async (fn) => {
    const before = structuredClone(state);
    try {
      return await fn(db);
    } catch (error) {
      state = before;
      throw error;
    }
  });
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DatabaseService)
    .useValue({ client: db })
    .compile();
  app = module.createNestApplication();
  app.useLogger(false);
  await app.init();
  store = app.get(SessionStore);
});
afterAll(async () => {
  await app?.close();
});
beforeEach(async () => {
  state = {
    sessions: new Map(),
    records: new Map(),
    tasks: [],
    audit: [],
    outbox: [],
    auditFailure: false,
    outboxFailure: false,
    active: true,
    mustChange: false,
    lessons: new Map(
      lessons.map((id, index) => [
        id,
        {
          id,
          student_id: students[index],
          status: 'SCHEDULED',
          scheduled_at: new Date(+fixed + 2 * 86400000),
        },
      ]),
    ),
  };
  issued = await Promise.all(users.map((u) => store.issue(db, u)));
});
const cookie = (index) =>
  `__Host-school_session=${issued[index].token}; __Host-school_csrf=${issued[index].csrfToken}`;
const body = { reason: 'Нужен перенос конкретного урока', preferredDate: '2026-11-03' };
const post = (index = 0, id = lessons[0], key = randomUUID(), data = body) =>
  request(app.getHttpServer())
    .post(`/api/v1/student/lessons/${id}/reschedule-request`)
    .set('Cookie', cookie(index))
    .set('X-CSRF-Token', issued[index].csrfToken)
    .set('Idempotency-Key', key)
    .send(data);
test('real Nest GET validates queries and scopes each account independently', async () => {
  const a = await request(app.getHttpServer())
    .get('/api/v1/student/lessons?period=today')
    .set('Cookie', cookie(0));
  const b = await request(app.getHttpServer())
    .get('/api/v1/student/lessons?month=2026-10')
    .set('Cookie', cookie(1));
  expect(a.status).toBe(200);
  expect(b.status).toBe(200);
  expect(a.body.items[0].lessonId).toBe(lessons[0]);
  expect(b.body.items[0].lessonId).toBe(lessons[1]);
  expect(b.body.pageSize).toBe(62);
  expect(JSON.stringify(a.body)).not.toContain(lessons[1]);
  expect(a.headers['cache-control']).toBe('no-store');
  expect(
    (
      await request(app.getHttpServer())
        .get(`/api/v1/student/lessons?studentProfileId=${students[1]}`)
        .set('Cookie', cookie(0))
    ).status,
  ).toBe(400);
});
test('reschedule is 201 and task/audit/outbox refer to the exact task; schedule stays unchanged', async () => {
  const before = structuredClone(state.lessons),
    result = await post();
  expect(result.status).toBe(201);
  expect(result.body).toEqual({ crmTaskId: expect.any(String), status: 'CREATED' });
  expect(state.tasks).toHaveLength(1);
  expect(state.tasks[0]).toMatchObject({
    id: result.body.crmTaskId,
    type: 'RESCHEDULE_REQUEST',
    student_id: students[0],
    lesson_id: lessons[0],
    payload: body,
  });
  expect(
    state.audit.find((e) => e.action === 'student.lesson.reschedule-request').resource_id,
  ).toBe(result.body.crmTaskId);
  expect(state.outbox[0]).toMatchObject({
    topic: 'student.lesson.reschedule-requested.v1',
    aggregate_id: result.body.crmTaskId,
  });
  expect(state.lessons).toEqual(before);
  expect(JSON.stringify(state.outbox)).not.toContain(body.reason);
});
test('same key replays 201 without duplicate task; changed payload is 422', async () => {
  const key = randomUUID(),
    first = await post(0, lessons[0], key),
    again = await post(0, lessons[0], key);
  expect(first.status).toBe(201);
  expect(again.status).toBe(201);
  expect(again.body).toEqual(first.body);
  expect(state.tasks).toHaveLength(1);
  expect(state.outbox).toHaveLength(1);
  expect((await post(0, lessons[0], key, { ...body, reason: 'Changed reason' })).status).toBe(422);
  expect(state.tasks).toHaveLength(1);
});
test('missing CSRF/idempotency, wrong role and another student lesson are denied', async () => {
  expect(
    (
      await request(app.getHttpServer())
        .post(`/api/v1/student/lessons/${lessons[0]}/reschedule-request`)
        .set('Cookie', cookie(0))
        .send(body)
    ).status,
  ).toBe(403);
  expect(
    (
      await request(app.getHttpServer())
        .post(`/api/v1/student/lessons/${lessons[0]}/reschedule-request`)
        .set('Cookie', cookie(0))
        .set('X-CSRF-Token', issued[0].csrfToken)
        .send(body)
    ).status,
  ).toBe(400);
  expect((await post(2)).status).toBe(403);
  expect((await post(0, lessons[1])).status).toBe(403);
  expect(state.tasks).toHaveLength(0);
});
test.each([86399999, -1000])(
  'less than 24h rejects without any task/outbox at %s ms',
  async (delta) => {
    state.lessons.get(lessons[0]).scheduled_at = new Date(+fixed + delta);
    expect((await post()).status).toBe(422);
    expect(state.tasks).toHaveLength(0);
    expect(state.outbox).toHaveLength(0);
  },
);
test('exactly 24 hours is accepted', async () => {
  state.lessons.get(lessons[0]).scheduled_at = new Date(+fixed + 86400000);
  expect((await post()).status).toBe(201);
});
test.each(['CANCELLED', 'CONDUCTED', 'STAR_PENDING', 'DISPUTED'])(
  'cannot reschedule %s',
  async (status) => {
    state.lessons.get(lessons[0]).status = status;
    expect((await post()).status).toBe(422);
    expect(state.tasks).toHaveLength(0);
  },
);
test.each(['auditFailure', 'outboxFailure'])(
  'failure of %s rolls back task, success audit and idempotency state',
  async (flag) => {
    state[flag] = true;
    const result = await post();
    expect(result.status).toBe(503);
    expect(state.tasks).toHaveLength(0);
    expect(state.outbox).toHaveLength(0);
    expect(state.audit).toHaveLength(0);
    expect(state.records.size).toBe(0);
    expect(JSON.stringify(result.body)).not.toContain('private');
  },
);
test('ownership is rechecked even for a cached idempotent reply', async () => {
  const key = randomUUID();
  expect((await post(0, lessons[0], key)).status).toBe(201);
  state.lessons.get(lessons[0]).student_id = students[1];
  expect((await post(0, lessons[0], key)).status).toBe(403);
  expect(state.tasks).toHaveLength(1);
});
test('transaction authorizer rechecks ownership and stage after the outer guards', async () => {
  const service = app.get(StudentLessonsService),
    spy = jest.spyOn(service, 'authorize');
  spy.mockImplementationOnce(async () => ({
    ok: false,
    error: { code: 'LESSON_FORBIDDEN', status: 403, message: 'Forbidden' },
  }));
  expect((await post()).status).toBe(403);
  expect(state.tasks).toHaveLength(0);
  spy.mockRestore();
});
test.each([
  { ...body, reason: ' ' },
  { ...body, reason: 'x'.repeat(501) },
  { ...body, preferredDate: '2026-02-30' },
  { ...body, preferredDate: '2026-10-26' },
  { ...body, studentProfileId: students[1] },
])('malformed request cannot write a task: %j', async (input) => {
  const result = await post(0, lessons[0], randomUUID(), input);
  expect([400, 422]).toContain(result.status);
  expect(state.tasks).toHaveLength(0);
  expect(state.outbox).toHaveLength(0);
});

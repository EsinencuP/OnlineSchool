import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { beforeAll, afterAll, beforeEach, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import request from 'supertest';
import { AppModule } from '../../apps/api/dist/app.module.js';
import { DatabaseService } from '../../apps/api/dist/core/database/database.module.js';
import { SessionStore } from '../../apps/api/dist/core/session/session.store.js';
import { Prisma } from '../../packages/db/dist/index.js';
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
      if (sql.includes('AS consumption_id')) {
        const owner = values.find((value) => students.includes(value)),
          id = values.find((value) => lessons.includes(value));
        let rows = [...state.history.values()].filter(
          (row) => row.student_id === owner && (!id || row.id === id),
        );
        const time = values.find((value) => value instanceof Date) ?? fixed;
        rows = rows.map((row) => {
          const open = state.tasks.some(
            (task) =>
              task.student_id === owner &&
              task.lesson_id === row.id &&
              task.type === 'ATTENDANCE_DISPUTE' &&
              ['OPEN', 'IN_PROGRESS'].includes(task.status),
          );
          return {
            ...row,
            has_open_dispute: open,
            can_dispute:
              row.consumption_id !== null &&
              !open &&
              +time - +row.scheduled_at <= 30 * 86400000 &&
              row.scheduled_at <= time,
          };
        });
        if (id) return rows;
        const total = rows.length,
          [limit, offset] = values.filter((value) => typeof value === 'number').slice(-2);
        const page = rows.slice(offset, offset + limit).map((row) => ({ ...row, total }));
        return page.length ? page : [{ id: null, total }];
      }
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
      findFirst: jest.fn(
        async ({ where }) =>
          state.tasks.find(
            (task) =>
              task.student_id === where.student_id &&
              task.lesson_id === where.lesson_id &&
              task.type === where.type &&
              where.status.in.includes(task.status),
          ) ?? null,
      ),
      create: jest.fn(async ({ data }) => {
        if (
          data.type === 'ATTENDANCE_DISPUTE' &&
          state.tasks.some(
            (task) =>
              task.type === data.type &&
              task.student_id === data.student_id &&
              task.lesson_id === data.lesson_id &&
              ['OPEN', 'IN_PROGRESS'].includes(task.status),
          )
        )
          throw new Prisma.PrismaClientKnownRequestError('Open dispute conflict', {
            code: 'P2002',
            clientVersion: 'test',
          });
        const row = { ...data, id: randomUUID(), status: 'OPEN' };
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
  let tail = Promise.resolve();
  // Serialize the storage mock so a rollback never erases another simulated transaction's commit.
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
    history: new Map(
      lessons.map((id, index) => [
        id,
        {
          id,
          student_id: students[index],
          scheduled_at: new Date(+fixed - 86400000),
          duration_minutes: 55,
          teacher_name: `Teacher ${index}`,
          subject_name: 'Math',
          attendance_status: 'COMPLETED',
          consumption_id: randomUUID(),
          balance_before: '10',
          balance_after: '9',
        },
      ]),
    ),
  };
  for (const row of state.lessons.values()) row.scheduled_at = new Date(+fixed - 86400000);
  issued = await Promise.all(users.map((u) => store.issue(db, u)));
});

const cookie = (index) =>
  `__Host-school_session=${issued[index].token}; __Host-school_csrf=${issued[index].csrfToken}`;
const description = 'I attended this particular lesson and dispute the deduction';
const post = (index = 0, id = lessons[0], key = randomUUID(), body = { description }) =>
  request(app.getHttpServer())
    .post(`/api/v1/student/lessons/${id}/dispute`)
    .set('Cookie', cookie(index))
    .set('X-CSRF-Token', issued[index].csrfToken)
    .set('Idempotency-Key', key)
    .send(body);
const get = (index = 0, path = '/api/v1/student/lessons/history') =>
  request(app.getHttpServer()).get(path).set('Cookie', cookie(index));
test('actual Nest history serializes Decimal balances as strings and isolates two authenticated students', async () => {
  const a = await get(0),
    b = await get(1);
  expect(a.status).toBe(200);
  expect(b.status).toBe(200);
  expect(a.body.items[0]).toMatchObject({
    lessonId: lessons[0],
    lessonDeducted: true,
    balanceBefore: '10',
    balanceAfter: '9',
    canDispute: true,
  });
  expect(b.body.items[0].lessonId).toBe(lessons[1]);
  expect(JSON.stringify(a.body)).not.toContain(lessons[1]);
  expect(a.headers['cache-control']).toBe('no-store');
  expect(
    (await get(0, `/api/v1/student/lessons/history?studentProfileId=${students[1]}`)).status,
  ).toBe(400);
});
test('dispute creates one addressed task/audit/outbox and never changes attendance or rights', async () => {
  const before = structuredClone(state.history),
    result = await post();
  expect(result.status).toBe(201);
  expect(result.body.status).toBe('CREATED');
  expect(state.tasks[0]).toMatchObject({
    id: result.body.crmTaskId,
    type: 'ATTENDANCE_DISPUTE',
    student_id: students[0],
    lesson_id: lessons[0],
    payload: { description },
  });
  expect(state.audit.find((e) => e.action === 'student.lesson.dispute').resource_id).toBe(
    result.body.crmTaskId,
  );
  expect(state.outbox[0]).toMatchObject({
    aggregate_id: result.body.crmTaskId,
    topic: 'student.lesson.dispute-requested.v1',
  });
  expect(JSON.stringify(state.outbox)).not.toContain(description);
  expect(state.history).toEqual(before);
  expect((await get()).body.items[0].canDispute).toBe(false);
});
test.each(['OPEN', 'IN_PROGRESS'])('another POST with a %s dispute is 409', async (status) => {
  expect((await post()).status).toBe(201);
  state.tasks[0].status = status;
  expect((await post()).status).toBe(409);
  expect(state.tasks).toHaveLength(1);
  expect((await get()).body.items[0].canDispute).toBe(false);
});
test('same-key network retry replays 201 without another task; changed payload is 422', async () => {
  const key = randomUUID(),
    a = await post(0, lessons[0], key),
    again = await post(0, lessons[0], key);
  expect(again.status).toBe(201);
  expect(again.body).toEqual(a.body);
  expect(state.tasks).toHaveLength(1);
  expect(state.outbox).toHaveLength(1);
  expect((await post(0, lessons[0], key, { description: description + ' changed' })).status).toBe(
    422,
  );
});
test('simulated parallel commands have one case; real database uniqueness remains a deployment acceptance check', async () => {
  const responses = await Promise.all([post(), post()]);
  expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
  expect(state.tasks).toHaveLength(1);
});
test('closed cases permit a new dispute within the window', async () => {
  expect((await post()).status).toBe(201);
  state.tasks[0].status = 'RESOLVED';
  expect((await post()).status).toBe(201);
  expect(state.tasks).toHaveLength(2);
});
test('foreign lesson, teacher session and missing CSRF cannot create a dispute', async () => {
  expect((await post(0, lessons[1])).status).toBe(403);
  expect((await post(2)).status).toBe(403);
  expect(
    (
      await request(app.getHttpServer())
        .post(`/api/v1/student/lessons/${lessons[0]}/dispute`)
        .set('Cookie', cookie(0))
        .send({ description })
    ).status,
  ).toBe(403);
  expect(state.tasks).toHaveLength(0);
});
test('no current published deduction rejects a dispute', async () => {
  state.history.get(lessons[0]).consumption_id = null;
  state.history.get(lessons[0]).balance_before = null;
  state.history.get(lessons[0]).balance_after = null;
  expect((await get()).body.items[0]).toMatchObject({
    lessonDeducted: false,
    balanceBefore: null,
    balanceAfter: null,
    canDispute: false,
  });
  expect((await post()).status).toBe(422);
  expect(state.tasks).toHaveLength(0);
});
test('thirty days is allowed, one millisecond later is rejected', async () => {
  state.lessons.get(lessons[0]).scheduled_at = new Date(+fixed - 30 * 86400000);
  state.history.get(lessons[0]).scheduled_at = state.lessons.get(lessons[0]).scheduled_at;
  expect((await post()).status).toBe(201);
  state.tasks[0].status = 'CANCELLED';
  state.lessons.get(lessons[0]).scheduled_at = new Date(+fixed - 30 * 86400000 - 1);
  expect((await post()).status).toBe(422);
});
test.each(['auditFailure', 'outboxFailure'])(
  'failed %s rolls back task and idempotency state',
  async (flag) => {
    state[flag] = true;
    const result = await post();
    expect(result.status).toBe(503);
    expect(state.tasks).toHaveLength(0);
    expect(state.records.size).toBe(0);
    expect(state.outbox).toHaveLength(0);
    expect(state.audit).toHaveLength(0);
  },
);
test('cached replay still rechecks ownership', async () => {
  const key = randomUUID();
  expect((await post(0, lessons[0], key)).status).toBe(201);
  state.lessons.get(lessons[0]).student_id = students[1];
  expect((await post(0, lessons[0], key)).status).toBe(403);
  expect(state.tasks).toHaveLength(1);
});
test.each(['short', ' '.repeat(20), 'x'.repeat(1001)])(
  'invalid description is rejected, length %s',
  async (value) => {
    const response = await post(0, lessons[0], randomUUID(), { description: value });
    expect([400, 422]).toContain(response.status);
    expect(state.tasks).toHaveLength(0);
  },
);

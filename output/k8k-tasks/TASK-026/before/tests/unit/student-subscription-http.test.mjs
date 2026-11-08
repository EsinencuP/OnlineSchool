import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { beforeAll, afterAll, beforeEach, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import request from 'supertest';
import { AppModule } from '../../apps/api/dist/app.module.js';
import { DatabaseService } from '../../apps/api/dist/core/database/database.module.js';
import { SessionStore } from '../../apps/api/dist/core/session/session.store.js';
const { Test } = createRequire(new URL('../../apps/api/package.json', import.meta.url))(
  '@nestjs/testing',
);
const users = [randomUUID(), randomUUID(), randomUUID()],
  students = [randomUUID(), randomUUID()],
  ids = [randomUUID(), randomUUID()],
  subjects = [randomUUID(), randomUUID(), randomUUID()],
  enrollments = [randomUUID(), randomUUID(), randomUUID()],
  lessons = [randomUUID(), randomUUID()],
  wrapper = randomUUID(),
  now = new Date('2026-10-27T12:00:00Z');
let app, db, state, issued;
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
      if (sql.includes('/* student-subjects */')) {
        if (state.subjectsOutage) throw Error('private driver error');
        const accountIndex = users.indexOf(values[0]);
        const owned = accountIndex >= 0 && students[accountIndex] === values[1];
        return [
          {
            generatedAt: now,
            mustChangePassword: owned ? state.snapshotPassword : null,
            rows: owned ? (state.subjects.get(values[1]) ?? []) : [],
          },
        ];
      }
      if (sql.includes('WITH records AS')) {
        const index = lessons.findIndex((id) => values.includes(id));
        if (index < 0 || !values.includes(students[0])) return [{ id: null, total: 0 }];
        return [
          {
            id: lessons[index],
            total: 1,
            student_status: 'SCHEDULED',
            scheduled_at: new Date(),
            scheduled_end_at: new Date(Date.now() + 3600000),
            teacher_name: 'Fixture',
            subject_name: index ? 'Physics' : 'Mathematics',
            google_meet_link: index ? null : 'https://meet.google.com/abc-defg-hij',
          },
        ];
      }
      if (sql.includes('WITH RECURSIVE selected')) {
        const owner = values.find((v) => students.includes(v)),
          selectedId = sql.includes('AND s.id=') ? values[1] : undefined;
        const selected = selectedId
          ? state.subscriptions.find((s) => s.subscriptionId === selectedId && s.owner === owner)
          : state.subscriptions.find((s) => s.owner === owner);
        const forbidden = !!selectedId && !selected;
        if (sql.includes('a.payment_id AS "paymentId"'))
          return [
            {
              forbidden,
              data: {
                items: selected
                  ? [
                      {
                        paymentId: randomUUID(),
                        confirmedAt: now.toISOString(),
                        amount: '1500.005',
                        currency: 'MDL',
                        description: 'Confirmed',
                        lessonsAdded: 8,
                      },
                    ]
                  : [],
                total: selected ? 1 : 0,
              },
            },
          ];
        if (sql.includes('coalesce(stored_before,after-delta)'))
          return [
            {
              forbidden,
              data: {
                items: selected
                  ? [
                      {
                        entryId: randomUUID(),
                        entryDate: now.toISOString(),
                        type: 'DEDUCTION',
                        balanceBefore: '8',
                        balanceAfter: '7',
                        description: 'Lesson',
                        lessonId: randomUUID(),
                      },
                    ]
                  : [],
                total: selected ? 1 : 0,
              },
            },
          ];
        if (!selected) return [{ forbidden, data: null }];
        const data = { ...selected };
        delete data.owner;
        return [{ forbidden, data }];
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
          : [...state.sessions.values()].find((s) => s.token_hash === where.token_hash);
        return row ? { ...row, account: account(row.account_id) } : null;
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
    snapshotPassword: false,
    subjects: new Map(
      students.map((studentId, i) => [
        studentId,
        [
          {
            subjectId: subjects[i],
            subjectName: i ? 'Foreign Physics' : 'Mathematics',
            enrollmentId: enrollments[i],
            subscriptionId: ids[i],
            managerSubscriptionId: i ? null : wrapper,
            enrollmentStatus: 'ACTIVE',
            validUntil: '2026-11-01T10:00:00Z',
            frozenUntil: null,
            periodCurrent: true,
            frozen: false,
            fullyPaid: true,
            grantBalance: 7,
            admission: null,
            homework: false,
            materials: false,
            lessons: false,
          },
        ],
      ]),
    ),
    subscriptions: ids.map((subscriptionId, i) => ({
      owner: students[i],
      subscriptionId,
      planName: 'PLAN-8',
      lessonsTotal: 8,
      lessonsRemaining: 7,
      validFrom: '2026-10-01T10:00:00Z',
      validUntil: '2026-11-01T10:00:00Z',
      isFrozen: false,
      frozenFrom: null,
      frozenUntil: null,
      status: 'ACTIVE',
    })),
  };
  issued = await Promise.all(users.map((id) => app.get(SessionStore).issue(db, id)));
});
const get = (path = '', i = 0) =>
  request(app.getHttpServer())
    .get('/api/v1/student/subscription' + path)
    .set('Cookie', `__Host-school_session=${issued[i].token}`);
test('authenticated active student can read own subscription with date-only DTO and no-store', async () => {
  const response = await get();
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({
    subscriptionId: ids[0],
    lessonsRemaining: 7,
    validFrom: '2026-10-01',
  });
  expect(response.headers['cache-control']).toBe('no-store');
  expect(JSON.stringify(response.body)).not.toContain(ids[1]);
});
test('STU-11 expired access blocks the previously exempt subscription read', async () => {
  state.active = false;
  state.subscriptions[0].status = 'EXPIRED';
  state.subscriptions[0].validUntil = '2026-10-01T10:00:00Z';
  const response = await get();
  expect(response.status).toBe(402);
  expect(response.body.code).toBe('ACCESS_SUSPENDED');
});
test('NONE has null plan and quantity fields', async () => {
  state.subscriptions = [];
  const response = await get();
  expect(response.status).toBe(200);
  expect(response.body).toMatchObject({
    status: 'NONE',
    subscriptionId: null,
    lessonsRemaining: null,
    planName: null,
    isFrozen: false,
  });
});
test.each(['/payments', '/ledger'])(
  'active student can read confirmed history without CSRF: %s',
  async (path) => {
    const response = await get(path);
    expect(response.status).toBe(200);
    expect(response.body.pageSize).toBe(20);
    expect(response.body.items).toHaveLength(1);
    expect(response.headers['cache-control']).toBe('no-store');
  },
);
test('money remains exact Decimal string with actual MDL currency', async () => {
  const response = await get('/payments');
  expect(response.body.items[0]).toMatchObject({ amount: '1500.005', currency: 'MDL' });
  expect(typeof response.body.items[0].amount).toBe('string');
});
test('lesson balance history returns quantities as strings', async () => {
  expect((await get('/ledger')).body.items[0]).toMatchObject({
    balanceBefore: '8',
    balanceAfter: '7',
    entryDate: '2026-10-27',
  });
});
test.each(['', '/payments', '/ledger'])(
  'selected foreign subscription is 403: %s',
  async (path) => {
    const result = await get(`${path}?subscriptionId=${ids[1]}`);
    expect(result.status).toBe(403);
    expect(result.body.code).toBe('SUBSCRIPTION_FORBIDDEN');
  },
);
test('two accounts select their own plans and histories', async () => {
  expect((await get('', 1)).body.subscriptionId).toBe(ids[1]);
  expect((await get(`?subscriptionId=${ids[0]}`)).body.subscriptionId).toBe(ids[0]);
});
test('nonexistent subscription ID also returns 403 without enumerating records', async () => {
  expect((await get(`?subscriptionId=${randomUUID()}`)).status).toBe(403);
});
test('no session is 401, teacher is 403, initial password change still required', async () => {
  expect((await request(app.getHttpServer()).get('/api/v1/student/subscription')).status).toBe(401);
  expect((await get('', 2)).status).toBe(403);
  state.mustChange = true;
  expect((await get('/payments')).status).toBe(403);
});
test.each([
  '?subscriptionId=bad',
  '?studentProfileId=' + students[1],
  '/payments?pageSize=101',
  '/ledger?page=0',
  '?page=1',
])('invalid query rejected: %s', async (path) => expect((await get(path)).status).toBe(400));
test('STU-11 blocks subscription, materials and dashboard without paid access', async () => {
  state.active = false;
  for (const path of [
    'materials',
    'dashboard',
    'subscription',
    'subscription/payments',
    'subscription/ledger',
  ])
    expect(
      (
        await request(app.getHttpServer())
          .get('/api/v1/student/' + path)
          .set('Cookie', `__Host-school_session=${issued[0].token}`)
      ).status,
    ).toBe(402);
});
test.each(['post', 'patch', 'delete'])(
  'no %s payment/card/checkout mutation exists in this namespace',
  async (method) => {
    expect(
      (
        await request(app.getHttpServer())
          [method]('/api/v1/student/subscription/payments')
          .set('Cookie', `__Host-school_session=${issued[0].token}`)
          .send({ amount: '1' })
      ).status,
    ).toBe(404);
  },
);

const studentGet = (path, i = 0) =>
  request(app.getHttpServer())
    .get('/api/v1/student/' + path)
    .set('Cookie', `__Host-school_session=${issued[i].token}`);
const subjectQueries = () =>
  db.$queryRaw.mock.calls.filter(([sql]) => sql.sql?.includes('/* student-subjects */'));

test('subjects: two sessions see only own enrollment and the returned financial ID opens all legacy reads', async () => {
  const [own, other] = await Promise.all([studentGet('subjects'), studentGet('subjects', 1)]);
  expect(own.status).toBe(200);
  expect(other.status).toBe(200);
  expect(own.headers['cache-control']).toBe('private, no-store');
  expect(own.body).toMatchObject({
    generatedAt: now.toISOString(),
    items: [
      {
        subjectId: subjects[0],
        enrollmentIds: [enrollments[0]],
        subscriptions: [
          { subscriptionId: ids[0], managerSubscriptionId: wrapper, paidLessonsRemaining: 7 },
        ],
      },
    ],
  });
  expect(other.body).toMatchObject({
    items: [{ subjectId: subjects[1], enrollmentIds: [enrollments[1]] }],
  });
  expect(JSON.stringify(own.body)).not.toContain(ids[1]);
  expect(JSON.stringify(other.body)).not.toContain(enrollments[0]);
  const anchor = own.body.items[0].subscriptions[0].subscriptionId;
  for (const path of ['', '/payments', '/ledger']) {
    expect((await get(`${path}?subscriptionId=${anchor}`)).status).toBe(200);
    expect((await get(`${path}?subscriptionId=${anchor}`, 1)).status).toBe(403);
    expect((await get(`${path}?subscriptionId=${wrapper}`)).status).toBe(403);
  }
  expect(subjectQueries()).toHaveLength(2);
});

test.each(['studentId', 'enrollmentId', 'subjectId', 'subscriptionId', 'timeZone'])(
  'subjects: rejects an explicit %s selector before querying',
  async (parameter) => {
    const response = await studentGet(`subjects?${parameter}=${encodeURIComponent(students[1])}`);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_INPUT');
    expect(subjectQueries()).toHaveLength(0);
  },
);

test('subjects: unauthorized, foreign role, password and global suspension retain the existing guard responses', async () => {
  expect((await request(app.getHttpServer()).get('/api/v1/student/subjects')).status).toBe(401);
  expect((await studentGet('subjects', 2)).status).toBe(403);
  state.mustChange = true;
  expect((await studentGet('subjects')).body.code).toBe('PASSWORD_CHANGE_REQUIRED');
  state.mustChange = false;
  state.active = false;
  expect((await studentGet('subjects')).status).toBe(402);
  expect((await studentGet('me')).status).toBe(200);
  expect(subjectQueries()).toHaveLength(0);
});

test('subjects: revoked session or changed password between guard and snapshot hides the subjects', async () => {
  state.snapshotPassword = true;
  const password = await studentGet('subjects');
  expect(password.status).toBe(403);
  expect(password.body).toMatchObject({ code: 'PASSWORD_CHANGE_REQUIRED' });
  expect(password.body).not.toHaveProperty('items');
  state.snapshotPassword = null;
  const removed = await studentGet('subjects');
  expect(removed.status).toBe(403);
  expect(removed.body.code).toBe('STUDENT_PROFILE_NOT_FOUND');
  expect(removed.body).not.toHaveProperty('items');
  db.accessRevocation.findFirst.mockResolvedValueOnce({ revoked_at: now });
  expect((await studentGet('subjects')).status).toBe(401);
  expect(subjectQueries()).toHaveLength(2);
});

test('subjects: parallel reads have no business writes and an outage returns ProblemDetails instead of empty', async () => {
  const before = structuredClone(state.subjects);
  const [first, second] = await Promise.all([studentGet('subjects'), studentGet('subjects')]);
  expect(first.status).toBe(200);
  expect(first.body).toEqual(second.body);
  expect(state.subjects).toEqual(before);
  for (const [sql] of subjectQueries())
    expect(sql.text).not.toMatch(/\b(INSERT|UPDATE|DELETE|FOR UPDATE|FOR SHARE)\b/i);
  state.subjectsOutage = true;
  const outage = await studentGet('subjects');
  expect(outage.status).toBe(503);
  expect(outage.body).toMatchObject({ code: 'SUBSCRIPTION_UNAVAILABLE', status: 503 });
  expect(outage.body).not.toHaveProperty('items');
  expect(JSON.stringify(outage.body)).not.toContain('private driver');
  state.subjectsOutage = false;
  state.subjects.set(students[0], []);
  const empty = await studentGet('subjects');
  expect(empty.status).toBe(200);
  expect(empty.body).toEqual({ generatedAt: now.toISOString(), items: [] });
});

test('subjects: live math does not enable the old physics Meet endpoint', async () => {
  const math = state.subjects.get(students[0])[0];
  state.subjects.get(students[0]).push({
    ...math,
    subjectId: subjects[2],
    subjectName: 'Physics',
    enrollmentId: enrollments[2],
    subscriptionId: randomUUID(),
    managerSubscriptionId: null,
    periodCurrent: false,
  });
  const response = await studentGet('subjects');
  expect(response.body.items.map((item) => [item.subjectName, item.liveAccess])).toEqual([
    ['Mathematics', true],
    ['Physics', false],
  ]);
  expect((await studentGet(`lessons/${lessons[0]}`)).body).toMatchObject({ canJoin: true });
  expect((await studentGet(`lessons/${lessons[1]}`)).body).toMatchObject({
    canJoin: false,
    meetLink: null,
  });
  expect((await studentGet(`lessons/${lessons[0]}`, 1)).status).toBe(404);
});

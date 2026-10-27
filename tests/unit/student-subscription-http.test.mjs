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
    active: false,
    mustChange: false,
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
test('authenticated inactive student can read own subscription with date-only DTO and no-store', async () => {
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
test('expired plan is visible without active learning access', async () => {
  state.subscriptions[0].status = 'EXPIRED';
  state.subscriptions[0].validUntil = '2026-10-01T10:00:00Z';
  expect((await get()).body).toMatchObject({ status: 'EXPIRED', validUntil: '2026-10-01' });
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
  'inactive student can read confirmed history without CSRF: %s',
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
test('new read exception does not open materials or dashboard without paid access', async () => {
  for (const path of ['materials', 'dashboard'])
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

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
  ids = Array.from({ length: 7 }, () => randomUUID()),
  review = randomUUID(),
  now = new Date();
let app, db, state, issued;
const identity = (id) => ({
  id,
  kind: id === users[2] ? 'TEACHER' : 'STUDENT',
  disabled_at: null,
  recovery_registration_required: false,
  login_id: 'synthetic@example.invalid',
});
const visible = (n, s) =>
  n.student_id === s &&
  !n.archived_at &&
  +n.created_at > +now - 90 * 86400000 &&
  +n.created_at <= +now;
const matches = (n, w) =>
  n.student_id === w.student_id &&
  (!w.id || w.id === n.id) &&
  !n.archived_at &&
  +n.created_at > +w.created_at.gt &&
  +n.created_at <= +w.created_at.lte &&
  (!Object.hasOwn(w, 'read_at') || n.read_at === null);
beforeAll(async () => {
  db = {
    $queryRaw: jest.fn(async (first, ...args) => {
      const sql = Array.isArray(first) ? first.join('?') : first.sql,
        values = Array.isArray(first) ? args : first.values;
      if (sql.includes('SELECT r.code'))
        return [{ code: values[0] === users[2] ? 'TEACHER' : 'STUDENT' }];
      if (sql.includes('AS has_active_access'))
        return [{ subject_ids: [], has_active_access: state.active }];
      if (sql.includes('FROM student_notifications')) {
        const owner = values.find((v) => students.includes(v)),
          rows = [...state.items.values()]
            .filter((n) => visible(n, owner))
            .sort((a, b) => +b.created_at - +a.created_at || b.id.localeCompare(a.id));
        const unreadCount = rows.filter((n) => !n.read_at).length;
        if (!sql.includes('WITH visible')) return [{ unreadCount }];
        const size = values.at(-2),
          offset = values.at(-1);
        return [
          {
            total: rows.length,
            unreadCount,
            items: rows.slice(offset, offset + size).map((n) => ({
              notificationId: n.id,
              type: n.type,
              title: n.title,
              body: n.body,
              payload: n.payload,
              isRead: !!n.read_at,
              createdAt: n.created_at.toISOString(),
            })),
          },
        ];
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
    studentNotification: {
      findFirst: jest.fn(
        async ({ where }) => [...state.items.values()].find((n) => matches(n, where)) ?? null,
      ),
      updateMany: jest.fn(async ({ where, data }) => {
        let count = 0;
        for (const n of state.items.values())
          if (matches(n, where)) {
            Object.assign(n, data);
            count++;
          }
        return { count };
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
        if (state.failOutbox) throw Error('PRIVATE SQL detail');
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
    const snapshot = structuredClone(state);
    try {
      return await fn(db);
    } catch (e) {
      state = snapshot;
      throw e;
    }
  });
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
    items: new Map(),
    sessions: new Map(),
    records: new Map(),
    audit: [],
    outbox: [],
    active: true,
    mustChange: false,
    failOutbox: false,
  };
  ids.forEach((id, i) =>
    state.items.set(id, {
      id,
      student_id: i === 3 ? students[1] : students[0],
      type: 'HOMEWORK_REVIEWED',
      title: 'PRIVATE STORED TITLE',
      body: 'PRIVATE STORED BODY',
      payload: { homeworkId: randomUUID(), reviewId: review },
      created_at: new Date(+now - (i === 5 ? 91 * 86400000 : i === 6 ? -3600000 : i * 1000)),
      read_at: i === 2 ? now : null,
      archived_at: i === 4 ? now : null,
    }),
  );
  issued = await Promise.all(users.map((id) => app.get(SessionStore).issue(db, id)));
});
const get = (suffix = '', i = 0) =>
  request(app.getHttpServer())
    .get('/api/v1/student/notifications' + suffix)
    .set('Cookie', `__Host-school_session=${issued[i].token}`);
const mutate = (
  suffix,
  { i = 0, key = randomUUID(), csrf = true, body = {}, method = 'patch' } = {},
) => {
  const r = request(app.getHttpServer())
    [method]('/api/v1/student/notifications' + suffix)
    .set(
      'Cookie',
      `__Host-school_session=${issued[i].token}; __Host-school_csrf=${issued[i].csrfToken}`,
    )
    .set('Idempotency-Key', key);
  if (csrf) r.set('X-CSRF-Token', issued[i].csrfToken);
  return r.send(body);
};
test('list defaults30, newest first, private no-store and server pupil ownership', async () => {
  const r = await get();
  expect(r.status).toBe(200);
  expect(r.body).toMatchObject({ total: 3, unreadCount: 2, page: 1, pageSize: 30 });
  expect(r.body.items.map((n) => n.notificationId)).toEqual(ids.slice(0, 3));
  expect(r.headers['cache-control']).toBe('no-store');
  expect(r.body.items[2].isRead).toBe(true);
  expect(JSON.stringify(r.body)).not.toContain('PRIVATE');
  const other = await get('', 1);
  expect(other.body.items.map((n) => n.notificationId)).toEqual([ids[3]]);
});
test('count is global unread, one COUNT query without JOIN or body load', async () => {
  const r = await get('/count');
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ unreadCount: 2 });
  const query = db.$queryRaw.mock.calls
    .map(([s]) => (Array.isArray(s) ? s.join('?') : s.sql))
    .filter((s) => s.includes('FROM student_notifications'));
  expect(query).toHaveLength(1);
  expect(query[0]).toMatch(/SELECT count\(\*\)/);
  expect(query[0]).not.toMatch(/JOIN|title|payload|body/);
});
test('pagination keeps total and unreadCount across pages', async () => {
  const r = await get('?page=2&pageSize=1');
  expect(r.body).toMatchObject({ total: 3, unreadCount: 2, page: 2, pageSize: 1 });
  expect(r.body.items[0].notificationId).toBe(ids[1]);
  expect((await get('?page=99&pageSize=1')).body.items).toEqual([]);
});
test('single read is204 on first, cached replay and new-key repeat; first timestamp preserved', async () => {
  const key = randomUUID(),
    suffix = `/${ids[0]}/read`;
  for (const k of [key, key, randomUUID()]) {
    const r = await mutate(suffix, { key: k });
    expect(r.status).toBe(204);
    expect(r.text).toBe('');
  }
  expect(db.studentNotification.updateMany).toHaveBeenCalledTimes(2);
  expect((await get('/count')).body.unreadCount).toBe(1);
  expect((await get()).body.items[0].isRead).toBe(true);
  expect(state.items.get(ids[0]).read_at).toEqual(now);
});
test('read-all204, idempotent, and new arrivals survive same-key replay', async () => {
  const key = randomUUID();
  expect((await mutate('/read-all', { method: 'post', key })).status).toBe(204);
  expect((await get('/count')).body.unreadCount).toBe(0);
  const item = structuredClone(state.items.get(ids[0]));
  item.id = randomUUID();
  item.read_at = null;
  state.items.set(item.id, item);
  expect((await mutate('/read-all', { method: 'post', key })).status).toBe(204);
  expect((await get('/count')).body.unreadCount).toBe(1);
  expect((await mutate('/read-all', { method: 'post' })).status).toBe(204);
  expect((await get('/count')).body.unreadCount).toBe(0);
});
test.each([3, 4, 5, 6])(
  'foreign archived expired future item index%i is indistinguishable404',
  async (i) => {
    const r = await mutate(`/${ids[i]}/read`);
    expect(r.status).toBe(404);
    expect(r.body).not.toHaveProperty('payload');
  },
);
test('unknown item404 and malformed UUID400', async () => {
  expect((await mutate(`/${randomUUID()}/read`)).status).toBe(404);
  expect((await mutate('/invalid/read')).status).toBe(400);
});
test.each([
  'page=0',
  'page=1.5',
  'pageSize=101',
  'pageSize=0',
  'studentProfileId=' + students[1],
  'type=REPORT_READY',
])('reject invalid or unsupported query %s', async (q) =>
  expect((await get('?' + q)).status).toBe(400),
);
test('unauthenticated401 and teacher403', async () => {
  expect((await request(app.getHttpServer()).get('/api/v1/student/notifications')).status).toBe(
    401,
  );
  expect((await get('', 2)).status).toBe(403);
});
test('expired session401', async () => {
  for (const s of state.sessions.values())
    if (s.account_id === users[0]) s.expires_at = new Date(0);
  expect((await get()).status).toBe(401);
});
test('CSRF and UUID idempotency key required', async () => {
  expect((await mutate('/read-all', { method: 'post', csrf: false })).status).toBe(403);
  expect((await mutate(`/${ids[0]}/read`, { key: 'bad' })).status).toBe(400);
  expect(state.items.get(ids[0]).read_at).toBeNull();
});
test('reject nonempty mutation body before any read', async () => {
  expect(
    (await mutate(`/${ids[0]}/read`, { body: { studentProfileId: students[1] } })).status,
  ).toBe(400);
  expect(state.items.get(ids[0]).read_at).toBeNull();
});
test('atomic rollback when outbox fails', async () => {
  state.failOutbox = true;
  const r = await mutate('/read-all', { method: 'post' });
  expect(r.status).toBe(503);
  expect(JSON.stringify(r.body)).not.toContain('PRIVATE');
  expect(state.items.get(ids[0]).read_at).toBeNull();
  expect(state.records.size).toBe(0);
  expect(state.outbox).toHaveLength(0);
});
test('password change and access checks also apply to cached replay', async () => {
  const key = randomUUID();
  expect((await mutate('/read-all', { method: 'post', key })).status).toBe(204);
  state.active = false;
  expect((await get()).status).toBe(402);
  expect((await mutate('/read-all', { method: 'post', key })).status).toBe(402);
  state.active = true;
  state.mustChange = true;
  expect((await get('/count')).status).toBe(403);
});
test('student cannot create, delete, or edit notification content', async () => {
  expect((await mutate('', { method: 'post', body: { type: 'REPORT_READY' } })).status).toBe(404);
  expect((await mutate(`/${ids[0]}`, { method: 'patch', body: { title: 'forged' } })).status).toBe(
    404,
  );
});

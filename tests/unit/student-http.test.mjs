import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { afterAll, beforeAll, beforeEach, expect, jest, test } from '@jest/globals';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../apps/api/dist/app.module.js';
import { DatabaseService } from '../../apps/api/dist/core/database/database.module.js';
import { Passwords } from '../../apps/api/dist/modules/identity/passwords.js';
import { AuthRateLimitService } from '../../apps/api/dist/modules/identity/auth-rate-limit.service.js';
import { SessionStore } from '../../apps/api/dist/core/session/session.store.js';
import { RequireRole } from '../../apps/api/dist/core/rbac/decorators.js';
const requireApi = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const { Test } = requireApi('@nestjs/testing');
const { Controller, Get, Post, Patch, Put, Delete } = requireApi('@nestjs/common');

// Real Nest controllers, guards, validation, password KDF, session/CSRF service and error filter.
// Only Prisma storage and the independent rate-limit persistence are replaced; no database is created.
class StudentProbe {
  dashboard() {
    return { open: true };
  }
  profile() {
    return { profile: true };
  }
  mutate() {
    return { changed: true };
  }
  mutatePatch() {
    return { changed: true };
  }
  mutatePut() {
    return { changed: true };
  }
  mutateDelete() {
    return { changed: true };
  }
}
Controller('api/v1/student')(StudentProbe);
RequireRole('STUDENT')(StudentProbe);
for (const [method, path, verb] of [
  ['dashboard', 'guard-probe', Get],
  ['profile', 'profile', Get],
  ['mutate', 'profile/probe', Post],
  ['mutatePatch', 'profile/probe', Patch],
  ['mutatePut', 'profile/probe', Put],
  ['mutateDelete', 'profile/probe', Delete],
])
  verb(path)(
    StudentProbe.prototype,
    method,
    Object.getOwnPropertyDescriptor(StudentProbe.prototype, method),
  );
const userId = randomUUID(),
  teacherId = randomUUID(),
  studentId = randomUUID(),
  profileId = randomUUID();
const originalPassword = 'Temporary-student-password-2026!',
  replacement = 'Replaced-student-password-2026!';
let app, state, db, store, passwordHash, issued, teacher;
function clock() {
  return new Date(Math.max(Date.now(), ...state.revocations.map((r) => +r.revoked_at + 1)));
}
function account(id) {
  return {
    id,
    kind: id === teacherId ? 'TEACHER' : 'STUDENT',
    login_id: id === teacherId ? 'teacher@example.invalid' : 'student@example.invalid',
    password_hash: state.hash,
    disabled_at: null,
    recovery_registration_required: false,
  };
}
function profile() {
  return {
    id: profileId,
    student_id: studentId,
    account_id: userId,
    must_change_password: state.mustChangePassword,
    deactivated_at: null,
    activated_at: new Date('2026-10-01Z'),
    created_at: new Date('2026-10-01Z'),
    student: { full_name: 'Contract Student' },
    account: { login_id: 'student@example.invalid' },
  };
}
function fakeClient() {
  const client = {
    $queryRaw: jest.fn(async (strings, ...values) => {
      const sql = strings.join('?');
      if (sql.includes('AS has_active_access'))
        return [{ subject_ids: [randomUUID()], has_active_access: state.active }];
      if (sql.includes('SELECT r.code'))
        return [{ code: values[0] === teacherId ? 'TEACHER' : 'STUDENT' }];
      if (sql.includes('SELECT id FROM auth_accounts')) return [{ id: values[0] }];
      return [{ now: clock() }];
    }),
    authAccount: {
      findUnique: jest.fn(async ({ where }) =>
        where.id
          ? account(where.id)
          : where.login_id === 'student@example.invalid'
            ? account(userId)
            : null,
      ),
      update: jest.fn(async ({ data }) => {
        state.hash = data.password_hash;
        return account(userId);
      }),
    },
    studentAccount: {
      findFirst: jest.fn(async ({ where }) => (where.account_id === userId ? profile() : null)),
      update: jest.fn(async ({ data }) => {
        state.mustChangePassword = data.must_change_password;
        return profile();
      }),
    },
    teacherAccount: {
      findFirst: jest.fn(async () => ({ id: randomUUID(), deactivated_at: null })),
    },
    studentEmailChange: { updateMany: jest.fn(async () => ({ count: 0 })) },
    staffAccount: { findFirst: jest.fn(async () => null) },
    session: {
      create: jest.fn(async ({ data }) => {
        const row = { id: randomUUID(), ...data };
        state.sessions.set(row.id, row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }) => {
        const row = where.id
          ? state.sessions.get(where.id)
          : [...state.sessions.values()].find((s) => s.token_hash === where.token_hash);
        return row ? { ...row, account: account(row.account_id) } : null;
      }),
      updateMany: jest.fn(async ({ where, data }) => {
        let count = 0;
        for (const row of state.sessions.values())
          if (
            (!where.id || row.id === where.id) &&
            (!where.account_id || row.account_id === where.account_id) &&
            (!('revoked_at' in where) || !row.revoked_at)
          ) {
            Object.assign(row, data);
            count++;
          }
        return { count };
      }),
    },
    accessRevocation: {
      create: jest.fn(async ({ data }) => {
        state.revocations.push(data);
        return data;
      }),
      findFirst: jest.fn(
        async ({ where }) =>
          state.revocations.find(
            (r) =>
              r.account_id === where.account_id &&
              where.OR.some((condition) =>
                condition.session_id === null
                  ? r.session_id === null && r.revoked_at >= condition.revoked_at.gte
                  : r.session_id === condition.session_id,
              ),
          ) ?? null,
      ),
    },
    auditEvent: {
      create: jest.fn(async ({ data }) => {
        if (state.auditFailure) throw Error('private storage error');
        state.audit.push(data);
        return data;
      }),
    },
    outboxEvent: {
      create: jest.fn(async ({ data }) => {
        state.outbox.push(data);
        return data;
      }),
    },
    $disconnect: jest.fn(async () => {}),
  };
  client.authAccount.findUniqueOrThrow = client.authAccount.findUnique;
  client.$transaction = jest.fn(async (fn) => {
    const before = structuredClone(state);
    try {
      return await fn(client);
    } catch (error) {
      state = before;
      throw error;
    }
  });
  return client;
}
const cookie = (session) =>
  `__Host-school_session=${session.token}; __Host-school_csrf=${session.csrfToken}`;
beforeAll(async () => {
  passwordHash = (await new Passwords().hash(originalPassword)).value;
  state = {
    sessions: new Map(),
    revocations: [],
    audit: [],
    outbox: [],
    hash: passwordHash,
    mustChangePassword: true,
    active: true,
  };
  db = fakeClient();
  const module = await Test.createTestingModule({
    imports: [AppModule],
    controllers: [StudentProbe],
  })
    .overrideProvider(DatabaseService)
    .useValue({ client: db })
    .overrideProvider(AuthRateLimitService)
    .useValue({ limit: jest.fn(async () => {}) })
    .compile();
  app = module.createNestApplication();
  await app.init();
  store = app.get(SessionStore);
});
afterAll(async () => {
  await app?.close();
});
beforeEach(async () => {
  state = {
    sessions: new Map(),
    revocations: [],
    audit: [],
    outbox: [],
    hash: passwordHash,
    mustChangePassword: true,
    active: true,
  };
  issued = await store.issue(db, userId);
  teacher = await store.issue(db, teacherId, new Date());
});
test('GET student/me is 200 with initial flag and no passkey requirement, including suspended access', async () => {
  state.active = false;
  const response = await request(app.getHttpServer())
    .get('/api/v1/student/me')
    .set('Cookie', cookie(issued));
  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    id: studentId,
    userId,
    displayName: 'Contract Student',
    timeZone: 'Europe/Chisinau',
    email: 'student@example.invalid',
    avatarUrl: null,
    hasActiveAccess: false,
    managerContacts: { whatsapp: '', telegram: '' },
    mustChangePassword: true,
    createdAt: '2026-10-01T00:00:00.000Z',
  });
  expect(response.headers['cache-control']).toBe('no-store');
});
test('no session is 401 Problem Details; teacher is 403 and cannot read student profile', async () => {
  const missing = await request(app.getHttpServer()).get('/api/v1/student/me');
  expect(missing.status).toBe(401);
  expect(missing.headers['content-type']).toContain('application/problem+json');
  expect(missing.body).toMatchObject({
    status: 401,
    code: 'UNAUTHENTICATED',
    instance: '/api/v1/student/me',
  });
  const denied = await request(app.getHttpServer())
    .get('/api/v1/student/me')
    .set('Cookie', cookie(teacher));
  expect(denied.status).toBe(403);
  expect(denied.body.code).toBe('FORBIDDEN');
});
test('STU-11 global guards protect profile and future controllers without paid access', async () => {
  state.mustChangePassword = false;
  state.active = false;
  const suspended = await request(app.getHttpServer())
    .get('/api/v1/student/guard-probe')
    .set('Cookie', cookie(issued));
  expect(suspended.status).toBe(402);
  expect(suspended.body).toMatchObject({
    code: 'ACCESS_SUSPENDED',
    status: 402,
    managerContacts: { whatsapp: expect.any(String), telegram: expect.any(String) },
  });
  expect(
    (
      await request(app.getHttpServer())
        .get('/api/v1/student/profile')
        .set('Cookie', cookie(issued))
    ).status,
  ).toBe(402);
  state.active = true;
  expect(
    (
      await request(app.getHttpServer())
        .get('/api/v1/student/guard-probe')
        .set('Cookie', cookie(issued))
    ).status,
  ).toBe(200);
});
test.each(['post', 'patch', 'put', 'delete'])(
  'all mutation verbs require CSRF before a student handler (%s)',
  async (verb) => {
    // The generic probe exposes all verbs solely in the test module.
    const response = await request(app.getHttpServer())
      [verb]('/api/v1/student/profile/probe')
      .set('Cookie', cookie(issued));
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('CSRF_INVALID');
  },
);
test('password-change route remains available while access is suspended, but missing CSRF is 403', async () => {
  state.active = false;
  const denied = await request(app.getHttpServer())
    .post('/api/v1/student/security/change-password')
    .set('Cookie', cookie(issued))
    .send({ currentPassword: originalPassword, newPassword: replacement });
  expect(denied.status).toBe(403);
  expect(denied.body.code).toBe('CSRF_INVALID');
});
test('initial login -> change password -> cabinet opens, old sessions revoked and mandatory audit/outbox contain no credentials (mock Prisma HTTP contract)', async () => {
  const login = await request(app.getHttpServer())
    .post('/api/v1/auth/session')
    .set('Cookie', cookie(issued))
    .set('X-CSRF-Token', issued.csrfToken)
    .send({ email: 'student@example.invalid', password: originalPassword });
  expect(login.status).toBe(200);
  expect(login.body.mfa_completed).toBe(false);
  const loginCookies = login.headers['set-cookie'];
  issued = {
    token: loginCookies
      .find((c) => c.startsWith('__Host-school_session='))
      .split(';')[0]
      .split('=')[1],
    csrfToken: login.body.csrfToken,
  };
  const before = await request(app.getHttpServer())
    .get('/api/v1/student/guard-probe')
    .set('Cookie', cookie(issued));
  expect(before.status).toBe(403);
  expect(before.body.code).toBe('MUST_CHANGE_PASSWORD');
  const response = await request(app.getHttpServer())
    .post('/api/v1/student/security/change-password')
    .set('Cookie', cookie(issued))
    .set('X-CSRF-Token', issued.csrfToken)
    .send({ currentPassword: originalPassword, newPassword: replacement });
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ mustChangePassword: false });
  expect(state.mustChangePassword).toBe(false);
  expect(await new Passwords().verify(replacement, state.hash)).toBe(true);
  expect(
    (await request(app.getHttpServer()).get('/api/v1/student/me').set('Cookie', cookie(issued)))
      .status,
  ).toBe(401);
  const fresh = response.headers['set-cookie'].map((c) => c.split(';')[0]).join('; ');
  expect(
    (await request(app.getHttpServer()).get('/api/v1/student/guard-probe').set('Cookie', fresh))
      .status,
  ).toBe(200);
  expect(state.audit.some((a) => a.action === 'student.password.change')).toBe(true);
  const events = JSON.stringify(state.outbox);
  for (const secret of [originalPassword, replacement, state.hash, issued.token, issued.csrfToken])
    expect(events).not.toContain(secret);
});
test('wrong current password and failed mandatory audit leave flag and hash unchanged', async () => {
  const wrong = await request(app.getHttpServer())
    .post('/api/v1/student/security/change-password')
    .set('Cookie', cookie(issued))
    .set('X-CSRF-Token', issued.csrfToken)
    .send({ currentPassword: 'wrong', newPassword: replacement });
  expect(wrong.status).toBe(401);
  expect(wrong.body.code).toBe('CURRENT_PASSWORD_INVALID');
  expect(state.hash).toBe(passwordHash);
  expect(state.mustChangePassword).toBe(true);
  state.auditFailure = true;
  const failed = await request(app.getHttpServer())
    .post('/api/v1/student/security/change-password')
    .set('Cookie', cookie(issued))
    .set('X-CSRF-Token', issued.csrfToken)
    .send({ currentPassword: originalPassword, newPassword: replacement });
  expect(failed.status).toBe(503);
  expect(state.hash).toBe(passwordHash);
  expect(state.mustChangePassword).toBe(true);
});
test.each([
  { currentPassword: originalPassword, newPassword: 'short' },
  { currentPassword: originalPassword, newPassword: replacement, mustChangePassword: false },
  { newPassword: replacement },
  null,
])('password DTO and service reject malformed input before writes: %j', async (body) => {
  const before = state.hash;
  const response = await request(app.getHttpServer())
    .post('/api/v1/student/security/change-password')
    .set('Cookie', cookie(issued))
    .set('X-CSRF-Token', issued.csrfToken)
    .send(body);
  expect(response.status).toBe(400);
  expect(state.hash).toBe(before);
  expect(state.mustChangePassword).toBe(true);
});
test('student WebAuthn registration and authentication are denied by the existing auth boundary', async () => {
  for (const action of ['register', 'authenticate']) {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/auth/webauthn/${action}/start`)
      .set('Cookie', cookie(issued))
      .set('X-CSRF-Token', issued.csrfToken)
      .send({});
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('STUDENT_PASSKEYS_NOT_ALLOWED');
  }
});
test('student guards and RFC errors do not change non-student API behavior', async () => {
  const response = await request(app.getHttpServer()).get('/api/health');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ status: 'ok', service: 'api' });
  const unauth = await request(app.getHttpServer()).get('/api/v1/qa/components');
  expect(unauth.status).toBe(401);
  expect(unauth.body).not.toHaveProperty('type');
  expect(unauth.body).toHaveProperty('requestId');
});

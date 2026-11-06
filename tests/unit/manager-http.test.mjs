import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { beforeAll, afterAll, beforeEach, expect, jest, test } from '@jest/globals';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { ManagerModule } from '../../apps/api/dist/modules/manager/manager.module.js';
import { ManagerContextGuard } from '../../apps/api/dist/modules/manager/guards/manager-context.guard.js';
import { ManagerScopeService } from '../../apps/api/dist/modules/manager/scope/manager-scope.service.js';
import { ManagerRoute } from '../../apps/api/dist/modules/manager/guards/manager-route.decorator.js';
import { DatabaseService } from '../../apps/api/dist/core/database/database.module.js';
import { SessionStore, tokenHash } from '../../apps/api/dist/core/session/session.store.js';
import { createOpenApiDocument } from '../../apps/api/dist/openapi/swagger.js';
const requireApi = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const { Test } = requireApi('@nestjs/testing');
const { Controller, Post, Put, Patch, Delete } = requireApi('@nestjs/common');

// Probe is test-only: verifies ManagerRoute inherits core mutation protection.
class ManagerProbe {
  mutate() {
    return { changed: true };
  }
}
Controller('api/v1/manager/probe')(ManagerProbe);
ManagerRoute()(ManagerProbe);
for (const [name, verb] of [
  ['post', Post],
  ['put', Put],
  ['patch', Patch],
  ['delete', Delete],
]) {
  ManagerProbe.prototype[name] = function () {
    return { changed: true };
  };
  verb()(
    ManagerProbe.prototype,
    name,
    Object.getOwnPropertyDescriptor(ManagerProbe.prototype, name),
  );
}
const accounts = new Map(),
  sessions = new Map();
const ownStudent = randomUUID(),
  foreignStudent = randomUUID();
let app, db, issued, broken;
const roles = [
  'MANAGER',
  'MANAGER',
  'STUDENT',
  'TEACHER',
  'DIRECTOR',
  'TECH_OPERATOR',
  'MANAGER',
  'MANAGER',
];
const ids = roles.map(() => randomUUID()),
  staffIds = roles.map(() => randomUUID());
const staff = (id) => {
  const i = ids.indexOf(id);
  return i === 6
    ? null
    : { id: staffIds[i], full_name: `Manager ${i}`, deactivated_at: i === 7 ? new Date() : null };
};
beforeAll(async () => {
  for (const [i, id] of ids.entries())
    accounts.set(id, {
      id,
      kind: roles[i] === 'STUDENT' ? 'STUDENT' : roles[i] === 'TEACHER' ? 'TEACHER' : 'STAFF',
      disabled_at: null,
      recovery_registration_required: false,
    });
  db = {
    authAccount: { findUnique: jest.fn(async ({ where }) => accounts.get(where.id) ?? null) },
    $queryRaw: jest.fn(async (parts, ...values) =>
      parts.join('?').includes('SELECT r.code')
        ? [{ code: roles[ids.indexOf(values[0])] }]
        : [{ now: new Date() }],
    ),
    staffAccount: {
      findFirst: jest.fn(async ({ where }) => {
        if (broken) throw Error(`private ${foreignStudent}`);
        return staff(where.account_id);
      }),
    },
    studentAccount: { findFirst: jest.fn(async () => ({ deactivated_at: null })) },
    teacherAccount: { findFirst: jest.fn(async () => ({ deactivated_at: null })) },
    student: {
      count: jest.fn(async ({ where }) => {
        const managerId = where.manager_assignments.some.manager_id;
        return managerId === staffIds[0] ? 1 : managerId === staffIds[1] ? 2 : 0;
      }),
      findFirst: jest.fn(async ({ where }) =>
        where.AND[0].id === ownStudent &&
        where.AND[1].manager_assignments.some.manager_id === staffIds[0]
          ? { id: ownStudent }
          : null,
      ),
    },
    session: {
      create: jest.fn(async ({ data }) => {
        const row = { ...data, id: randomUUID(), revoked_at: null };
        sessions.set(row.id, row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }) => {
        const row = [...sessions.values()].find(
          (r) => r.token_hash === where.token_hash || r.id === where.id,
        );
        return row ? { ...row, account: accounts.get(row.account_id) } : null;
      }),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    accessRevocation: { findFirst: jest.fn(async () => null) },
    auditEvent: { create: jest.fn(async () => ({})) },
  };
  db.$transaction = jest.fn(async (fn) => fn(db));
  const module = await Test.createTestingModule({
    imports: [ManagerModule],
    controllers: [ManagerProbe],
    providers: [ManagerContextGuard, ManagerScopeService],
  })
    .overrideProvider(DatabaseService)
    .useValue({ client: db })
    .compile();
  app = module.createNestApplication();
  app.useLogger(false);
  await app.init();
});
afterAll(async () => app?.close());
beforeEach(async () => {
  broken = false;
  sessions.clear();
  for (const account of accounts.values()) account.disabled_at = null;
  issued = [];
  for (const id of ids) issued.push(await app.get(SessionStore).issue(db, id, new Date()));
  db.accessRevocation.findFirst.mockResolvedValue(null);
});
const cookies = (i) =>
  `__Host-school_session=${issued[i].token}; __Host-school_csrf=${issued[i].csrfToken}`;
const get = (i, suffix = '') =>
  request(app.getHttpServer())
    .get('/api/v1/manager/me' + suffix)
    .set('Cookie', cookies(i));

test('anonymous and invalid session are 401 with generic core error/request id', async () => {
  for (const token of [undefined, 'invalid']) {
    let query = request(app.getHttpServer()).get('/api/v1/manager/me');
    if (token) query = query.set('Cookie', `__Host-school_session=${token}`);
    const res = await query;
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
    expect(res.body.details).toBeUndefined();
  }
});
test.each([2, 3, 4, 5])('non-manager role at session %i is 403 FORBIDDEN_ROLE', async (i) => {
  const res = await get(i);
  expect(res.status).toBe(403);
  expect(res.body.code).toBe('FORBIDDEN_ROLE');
});
test.each([
  [6, 'MANAGER_PROFILE_NOT_FOUND'],
  [7, 'MANAGER_INACTIVE'],
])('unavailable profile %i gets required code %s', async (i, code) => {
  const res = await get(i);
  expect(res.status).toBe(403);
  expect(res.body.code).toBe(code);
  expect(res.body.details).toBeUndefined();
});
test('active managers get independent portfolio counts; query/path/body cannot select another manager', async () => {
  const a = await get(0, `?managerId=${staffIds[1]}&accountId=${ids[1]}`);
  const b = await get(1);
  expect(a.status).toBe(200);
  expect(a.body).toEqual({
    actorContext: {
      accountId: ids[0],
      role: 'MANAGER',
      staffProfileId: staffIds[0],
      teacherProfileId: null,
      displayName: 'Manager 0',
      timezone: process.env.SCHOOL_TIMEZONE ?? 'Europe/Chisinau',
      timezoneSource:
        process.env.SCHOOL_TIMEZONE === undefined ? 'SCHOOL_DEFAULT' : 'SCHOOL_CONFIGURATION',
      asOf: expect.any(String),
      accountUpdatedAt: null,
      profileUpdatedAt: null,
    },
    managerId: staffIds[0],
    displayName: 'Manager 0',
    role: 'MANAGER',
    portfolioSize: 1,
    timezone: process.env.SCHOOL_TIMEZONE ?? 'Europe/Chisinau',
    capabilities: [
      'LEADS_MANAGE',
      'STUDENTS_VIEW',
      'ACCOUNTS_CREATE',
      'SUBSCRIPTIONS_MANAGE',
      'SCHEDULE_MANAGE',
      'PAYMENTS_REQUEST_APPROVAL',
    ],
  });
  expect(b.body.managerId).toBe(staffIds[1]);
  expect(b.body.portfolioSize).toBe(2);
  expect(a.headers['cache-control']).toBe('no-store');
  expect(JSON.stringify(a.body)).not.toContain(staffIds[1]);
  expect(JSON.stringify(a.body)).not.toContain(foreignStudent);
  expect(JSON.stringify(db.auditEvent.create.mock.calls)).not.toContain(foreignStudent);
  expect(a.body.capabilities).not.toContain('PAYMENTS_CONFIRM');
});
test('MFA, revoked, expired and disabled-account checks still win over feature guards', async () => {
  const session = [...sessions.values()].find((row) => row.account_id === ids[0]);
  session.mfa_verified_at = null;
  expect((await get(0)).body.code).toBe('MFA_REQUIRED');
  session.mfa_verified_at = new Date();
  session.revoked_at = new Date();
  expect((await get(0)).status).toBe(401);
  session.revoked_at = null;
  session.expires_at = new Date(0);
  expect((await get(0)).status).toBe(401);
  session.expires_at = new Date(Date.now() + 60000);
  accounts.get(ids[0]).disabled_at = new Date();
  expect((await get(0)).status).toBe(401);
  accounts.get(ids[7]).disabled_at = new Date();
  expect((await get(7)).status).toBe(401);
  accounts.get(ids[7]).disabled_at = null;
  db.accessRevocation.findFirst.mockResolvedValue({ id: randomUUID() });
  expect((await get(7)).status).toBe(401);
});
test('diagnostic mode is opt-in; inactive staff remain unauthenticated for other routes', async () => {
  const store = app.get(SessionStore);
  expect((await store.resolve(issued[7].token)).error.code).toBe('UNAUTHENTICATED');
  expect((await store.resolve(issued[6].token)).error.code).toBe('UNAUTHENTICATED');
});
test.each(['post', 'put', 'patch', 'delete'])(
  '%s needs core CSRF and succeeds with the bound token',
  async (verb) => {
    let res = await request(app.getHttpServer())
      [verb]('/api/v1/manager/probe')
      .set('Cookie', cookies(0))
      .send({ managerId: staffIds[1] });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CSRF_INVALID');
    res = await request(app.getHttpServer())
      [verb]('/api/v1/manager/probe')
      .set('Cookie', cookies(0))
      .set('X-CSRF-Token', issued[0].csrfToken)
      .send({});
    expect(res.status).toBe(verb === 'post' ? 201 : 200);
  },
);
test('DB errors are generic and never leak SQL, foreign ids or contacts', async () => {
  broken = true;
  const res = await get(0);
  expect(res.status).toBe(503);
  expect(res.body.code).toBe('SESSION_STORE_UNAVAILABLE');
  expect(JSON.stringify(res.body)).not.toContain(foreignStudent);
  expect(JSON.stringify(db.auditEvent.create.mock.calls)).not.toContain(foreignStudent);
});
test('OpenAPI includes manager cookie security, responses and capability enum', () => {
  const doc = createOpenApiDocument(app);
  const operation = doc.paths['/api/v1/manager/me'].get;
  expect(operation.operationId).toBe('getManagerMe');
  expect(operation.tags).toEqual(['manager']);
  expect(operation.security).toContainEqual({ sessionCookie: [] });
  expect(Object.keys(operation.responses)).toEqual(
    expect.arrayContaining(['200', '401', '403', '503']),
  );
  const properties = doc.components.schemas.ManagerMeResponseDto.properties;
  expect(properties.portfolioSize.type).toBe('integer');
  expect(properties.capabilities.items.enum).toContain('PAYMENTS_CONFIRM');
});
test('test sessions store only hashed tokens', () => {
  const row = [...sessions.values()].find((session) => session.account_id === ids[0]);
  expect(row.token_hash).toBe(tokenHash(issued[0].token));
});

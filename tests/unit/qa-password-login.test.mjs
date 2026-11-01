import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { afterAll, beforeAll, beforeEach, expect, test } from '@jest/globals';
import request from 'supertest';
import { managerAccountsFixture } from '../support/manager-accounts-fixture.mjs';
import { Passwords } from '../../apps/api/dist/modules/identity/passwords.js';
import { qaPasswordOnlyLogin } from '../../apps/api/dist/core/session/qa-password-policy.js';
import { AccessService } from '../../apps/api/dist/core/rbac/rbac.guard.js';
import { ACCESS } from '../../apps/api/dist/core/rbac/decorators.js';
import { PolicyService } from '../../apps/api/dist/core/policy/policy.service.js';
import { qaSetupInput, provisionQaAccess } from '../../scripts/provision-qa-access.mjs';

const previous = {
  qa: process.env.QA_PASSWORD_ONLY_LOGIN,
  manager: process.env.MANAGER_PASSWORD_ONLY_LOGIN,
  csrf: process.env.CSRF_SIGNING_SECRET,
};
let f, hash;
const password = 'Fixture-QA-Role-Password!47';
const jar = (r) => (r.headers['set-cookie'] ?? []).map((s) => s.split(';')[0]).join('; ');
beforeAll(async () => {
  process.env.CSRF_SIGNING_SECRET = 'qa-password-fixture-secret-at-least-32-characters';
  ({ f } = await managerAccountsFixture());
  const result = await f.app.get(Passwords).hash(password);
  expect(result.ok).toBe(true);
  hash = result.value;
});
beforeEach(async () => {
  process.env.QA_PASSWORD_ONLY_LOGIN = 'true';
  delete process.env.MANAGER_PASSWORD_ONLY_LOGIN;
  await f.reset();
  f.client.student.count = async () => 0;
  for (const account of f.state.auth.values()) account.password_hash = hash;
});
afterAll(async () => {
  await f?.app.close();
  for (const [key, value] of [
    ['QA_PASSWORD_ONLY_LOGIN', previous.qa],
    ['MANAGER_PASSWORD_ONLY_LOGIN', previous.manager],
    ['CSRF_SIGNING_SECRET', previous.csrf],
  ]) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
async function login(index, supplied = password) {
  const csrf = await request(f.app.getHttpServer()).get('/api/v1/auth/csrf');
  return request(f.app.getHttpServer())
    .post('/api/v1/auth/session')
    .set('Cookie', jar(csrf))
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send({
      method: 'password',
      email: f.state.auth.get(f.accounts[index].id).login_id,
      password: supplied,
    });
}
test.each([
  [0, 'MANAGER'],
  [2, 'STUDENT'],
  [3, 'TEACHER'],
  [4, 'DIRECTOR'],
  [5, 'TECH_OPERATOR'],
])(
  '%s password login for %s produces a real limited-factor session and truthful current-session capability',
  async (index, role) => {
    const signed = await login(index);
    expect(signed.status).toBe(200);
    expect(signed.body).toMatchObject({
      password_only: true,
      mfa_completed: false,
      account: { roles: [role] },
    });
    const current = await request(f.app.getHttpServer())
      .get('/api/v1/auth/session')
      .set('Cookie', jar(signed));
    expect(current.body).toMatchObject({ password_only: true, mfa_completed: false });
    expect(
      [...f.state.sessions.values()].some(
        (s) => s.account_id === signed.body.account.id && s.mfa_verified_at === null,
      ),
    ).toBe(true);
    const manager = await request(f.app.getHttpServer())
      .get('/api/v1/manager/me')
      .set('Cookie', jar(signed));
    expect(manager.status).toBe(role === 'MANAGER' ? 200 : 403);
  },
);
test('wrong password, missing CSRF, recovery sessions and disabling QA mode do not grant access', async () => {
  expect((await login(4, 'wrong')).status).toBe(401);
  const noCsrf = await request(f.app.getHttpServer())
    .post('/api/v1/auth/session')
    .send({ email: 'qa@example.invalid', password });
  expect(noCsrf.status).toBe(403);
  expect(qaPasswordOnlyLogin({ kind: 'STAFF', roles: ['DIRECTOR'], recoveryOnly: true })).toBe(
    false,
  );
  const signed = await login(0);
  process.env.QA_PASSWORD_ONLY_LOGIN = 'false';
  const blocked = await request(f.app.getHttpServer())
    .get('/api/v1/manager/me')
    .set('Cookie', jar(signed));
  expect(blocked.body.code).toBe('MFA_REQUIRED');
  const current = await request(f.app.getHttpServer())
    .get('/api/v1/auth/session')
    .set('Cookie', jar(signed));
  expect(current.body.password_only).toBeUndefined();
});
test.each([
  ['STAFF', 'DIRECTOR'],
  ['STAFF', 'MANAGER'],
  ['STAFF', 'TECH_OPERATOR'],
  ['TEACHER', 'TEACHER'],
])('password mode preserves permissions and role boundaries for %s/%s', async (kind, role) => {
  const metadata = {
    [ACCESS.authenticated]: true,
    [ACCESS.mfa]: true,
    [ACCESS.roles]: ['DIRECTOR', 'MANAGER'],
    [ACCESS.permissions]: ['payment:register'],
  };
  const service = new AccessService(
    { getAllAndOverride: (key) => metadata[key] },
    new PolicyService({}),
  );
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ method: 'POST', originalUrl: '/api/v1/finance/payments' }),
    }),
  };
  const result = await service.authorize(context, { kind, roles: [role], mfaCompleted: false });
  expect(result.ok).toBe(['DIRECTOR', 'MANAGER'].includes(role));
  if (!result.ok) expect(result.error.code).toBe('FORBIDDEN');
});
test('QA setup accepts only exact project/role/hash set in a short-lived production window', () => {
  const env = {
    VERCEL_ENV: 'production',
    VERCEL_PROJECT_ID: 'prj_XusYmdwL1Y0478T09RNKmBQMldgZ',
    QA_PASSWORD_ONLY_LOGIN: 'true',
    QA_ACCESS_SETUP_UNTIL: String(Date.now() + 10_000),
  };
  const rows = [
    ['DIRECTOR', 'qa.director@onlineschool.test'],
    ['TEACHER', 'qa.teacher@onlineschool.test'],
    ['TECH_OPERATOR', 'qa.tech@onlineschool.test'],
  ].map(([role, login]) => ({ role, login, hash }));
  env.QA_ACCESS_SETUP_HASHES = JSON.stringify(rows);
  expect(qaSetupInput(env)).toEqual(rows);
  expect(qaSetupInput({ ...env, VERCEL_ENV: 'preview' })).toBeNull();
  expect(qaSetupInput({ ...env, QA_ACCESS_SETUP_UNTIL: '0' })).toBeNull();
  expect(() =>
    qaSetupInput({
      ...env,
      QA_ACCESS_SETUP_HASHES: JSON.stringify([
        { ...rows[0], login: 'other@example.invalid' },
        ...rows.slice(1),
      ]),
    }),
  ).toThrow('QA_ACCESS_SETUP_INVALID');
});
test('QA provisioning does not reset an existing login with a different hash or grant additional roles', async () => {
  let writes = 0;
  const tx = {
    $executeRaw: async () => {},
    $queryRaw: async () => [{ now: new Date() }],
    staffAccount: { findFirst: async () => ({ id: 'director' }) },
    authAccount: {
      findUnique: async () => ({
        kind: 'STAFF',
        password_hash: 'different',
        staff_profile: {},
        role_assignments: [{ role: { code: 'DIRECTOR' } }],
      }),
      create: async () => {
        writes++;
      },
    },
  };
  await expect(
    provisionQaAccess(tx, [{ role: 'DIRECTOR', login: 'qa.director@onlineschool.test', hash }]),
  ).rejects.toThrow('QA_ACCESS_SETUP_LOGIN_COLLISION');
  expect(writes).toBe(0);
});

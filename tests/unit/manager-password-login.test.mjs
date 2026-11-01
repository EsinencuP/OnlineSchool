import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { beforeAll, beforeEach, afterAll, expect, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { managerAccountsFixture } from '../support/manager-accounts-fixture.mjs';
import { Passwords } from '../../apps/api/dist/modules/identity/passwords.js';
import { managerPasswordOnlyLogin } from '../../apps/api/dist/core/session/manager-password-policy.js';
import { AccessService } from '../../apps/api/dist/core/rbac/rbac.guard.js';
import { ACCESS } from '../../apps/api/dist/core/rbac/decorators.js';

const previous = process.env.MANAGER_PASSWORD_ONLY_LOGIN;
const previousCsrf = process.env.CSRF_SIGNING_SECRET;
let f, passwordHash;
const password = 'Fixture-Password-Only!47';
const cookies = (response) =>
  (response.headers['set-cookie'] ?? []).map((c) => c.split(';')[0]).join('; ');
beforeAll(async () => {
  process.env.CSRF_SIGNING_SECRET = 'manager-password-only-fixture-secret-at-least-32-bytes';
  ({ f } = await managerAccountsFixture());
  const hash = await f.app.get(Passwords).hash(password);
  expect(hash.ok).toBe(true);
  passwordHash = hash.value;
});
beforeEach(async () => {
  process.env.MANAGER_PASSWORD_ONLY_LOGIN = 'true';
  await f.reset();
  f.client.student.count = async () => 0;
  for (const a of f.state.auth.values()) a.password_hash = passwordHash;
});
afterAll(async () => {
  await f?.app.close();
  if (previous === undefined) delete process.env.MANAGER_PASSWORD_ONLY_LOGIN;
  else process.env.MANAGER_PASSWORD_ONLY_LOGIN = previous;
  if (previousCsrf === undefined) delete process.env.CSRF_SIGNING_SECRET;
  else process.env.CSRF_SIGNING_SECRET = previousCsrf;
});
async function login(index = 0, supplied = password) {
  const csrf = await request(f.app.getHttpServer()).get('/api/v1/auth/csrf');
  expect(csrf.status).toBe(200);
  return request(f.app.getHttpServer())
    .post('/api/v1/auth/session')
    .set('Cookie', cookies(csrf))
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send({
      method: 'password',
      email: f.state.auth.get(f.accounts[index].id).login_id,
      password: supplied,
    });
}
test('password login opens manager cabinet without falsely marking MFA verified; disabling flag restores requirement', async () => {
  const signed = await login();
  expect(signed.status).toBe(200);
  expect(signed.body).toMatchObject({ mfa_completed: false, manager_password_only: true });
  const jar = cookies(signed),
    session = [...f.state.sessions.values()].find((s) => s.mfa_verified_at === null);
  expect(session).toBeDefined();
  const current = await request(f.app.getHttpServer())
    .get('/api/v1/auth/session')
    .set('Cookie', jar);
  expect(current.body).toMatchObject({ mfa_completed: false, manager_password_only: true });
  expect(
    (await request(f.app.getHttpServer()).get('/api/v1/manager/me').set('Cookie', jar)).status,
  ).toBe(200);
  process.env.MANAGER_PASSWORD_ONLY_LOGIN = 'false';
  const blocked = await request(f.app.getHttpServer()).get('/api/v1/manager/me').set('Cookie', jar);
  expect(blocked.body.code).toBe('MFA_REQUIRED');
  expect(session.mfa_verified_at).toBeNull();
});
test('password-only manager command keeps CSRF, portfolio scope and transaction checks', async () => {
  const own = f.addStudent(),
    foreign = f.addStudent(1),
    signed = await login(),
    jar = cookies(signed);
  const patch = (id, csrf = true) => {
    let cmd = request(f.app.getHttpServer())
      .patch(`/api/v1/manager/students/${id}/contacts`)
      .set('Cookie', jar)
      .set('Idempotency-Key', randomUUID());
    if (csrf) cmd = cmd.set('X-CSRF-Token', signed.body.csrfToken);
    return cmd.send({ version: 1, phone: '+37360000999' });
  };
  expect((await patch(own.id, false)).status).toBe(403);
  expect((await patch(foreign.id)).body.code).toBe('STUDENT_NOT_FOUND');
  expect((await patch(own.id)).status).toBe(200);
  expect(f.state.students.get(own.id).phone).toBe('+37360000999');
  expect(f.state.students.get(foreign.id).version).toBe(1);
});
test.each([2, 3, 4, 5])('role %i receives no password-only manager exception', async (index) => {
  const signed = await login(index);
  expect(signed.status).toBe(200);
  expect(signed.body.manager_password_only).toBeUndefined();
  const denied = await request(f.app.getHttpServer())
    .get('/api/v1/manager/me')
    .set('Cookie', cookies(signed));
  expect(denied.status).toBe(403);
});
test('wrong password and revoked session are still rejected', async () => {
  expect((await login(0, 'Wrong-password!47')).status).toBe(401);
  const signed = await login(),
    session = [...f.state.sessions.values()].find((s) => s.mfa_verified_at === null);
  session.revoked_at = new Date();
  expect(
    (await request(f.app.getHttpServer()).get('/api/v1/manager/me').set('Cookie', cookies(signed)))
      .status,
  ).toBe(401);
});
test('manager exception does not grant generic staff APIs or explicit RequireMfa', async () => {
  const actor = { kind: 'STAFF', roles: ['MANAGER'], mfaCompleted: false };
  for (const [path, marked, requireMfa] of [
    ['/api/v1/finance/receipts', false, false],
    ['/api/v1/manager/me', true, true],
  ]) {
    const metadata = {
      [ACCESS.roles]: ['MANAGER'],
      [ACCESS.managerProfileErrors]: marked,
      [ACCESS.mfa]: requireMfa,
    };
    const service = new AccessService({ getAllAndOverride: (key) => metadata[key] }, {});
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ originalUrl: path, method: 'GET' }) }),
    };
    expect((await service.authorize(context, actor)).error.code).toBe('MFA_REQUIRED');
  }
});
test('temporary policy rejects mixed roles, recovery and non-exact configuration', () => {
  const actor = { kind: 'STAFF', roles: ['MANAGER'] };
  expect(managerPasswordOnlyLogin(actor)).toBe(true);
  expect(managerPasswordOnlyLogin({ ...actor, roles: ['MANAGER', 'DIRECTOR'] })).toBe(false);
  expect(managerPasswordOnlyLogin({ ...actor, recoveryOnly: true })).toBe(false);
  for (const value of ['false', '1', 'TRUE', '']) {
    process.env.MANAGER_PASSWORD_ONLY_LOGIN = value;
    expect(managerPasswordOnlyLogin(actor)).toBe(false);
  }
  delete process.env.MANAGER_PASSWORD_ONLY_LOGIN;
  expect(managerPasswordOnlyLogin(actor)).toBe(false);
});

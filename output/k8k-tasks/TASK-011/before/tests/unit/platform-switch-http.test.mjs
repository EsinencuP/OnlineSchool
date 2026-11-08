import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { afterAll, beforeAll, beforeEach, expect, test } from '@jest/globals';
import request from 'supertest';
import { managerAccountsFixture } from '../support/manager-accounts-fixture.mjs';
import { Passwords } from '../../apps/api/dist/modules/identity/passwords.js';
const keys = ['PLATFORM_DEMO_SWITCHING', 'QA_PASSWORD_ONLY_LOGIN', 'CSRF_SIGNING_SECRET'];
const previous = keys.map((key) => process.env[key]);
const jar = (response) =>
  (response.headers['set-cookie'] ?? []).map((c) => c.split(';')[0]).join('; ');
let f, hash;
const password = 'Fixture-Switch-Password!47';
beforeAll(async () => {
  process.env.CSRF_SIGNING_SECRET = 'platform-switch-fixture-at-least-32-characters';
  ({ f } = await managerAccountsFixture());
  const result = await f.app.get(Passwords).hash(password);
  expect(result.ok).toBe(true);
  hash = result.value;
});
beforeEach(async () => {
  process.env.PLATFORM_DEMO_SWITCHING = 'true';
  process.env.QA_PASSWORD_ONLY_LOGIN = 'true';
  await f.reset();
  for (const a of f.state.auth.values()) a.password_hash = hash;
});
afterAll(async () => {
  await f?.app.close();
  keys.forEach((key, i) => {
    if (previous[i] === undefined) delete process.env[key];
    else process.env[key] = previous[i];
  });
});
async function login() {
  const csrf = await request(f.app.getHttpServer()).get('/api/v1/auth/csrf');
  const result = await request(f.app.getHttpServer())
    .post('/api/v1/auth/session')
    .set('Cookie', jar(csrf))
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send({ method: 'password', email: f.state.auth.get(f.accounts[0].id).login_id, password });
  expect(result.status).toBe(200);
  return result;
}
test('anonymous switch is rejected even with valid anonymous CSRF', async () => {
  const csrf = await request(f.app.getHttpServer()).get('/api/v1/auth/csrf');
  const result = await request(f.app.getHttpServer())
    .post('/api/v1/auth/switch-user')
    .set('Cookie', jar(csrf))
    .set('X-CSRF-Token', csrf.body.csrfToken)
    .send({ key: 'pasha' });
  expect(result.status).toBe(401);
});
test('authenticated switch requires CSRF', async () => {
  const session = await login();
  const result = await request(f.app.getHttpServer())
    .post('/api/v1/auth/switch-user')
    .set('Cookie', jar(session))
    .send({ key: 'pasha' });
  expect(result.status).toBe(403);
});
test('ordinary manager cannot switch to director and retains its current session', async () => {
  const session = await login();
  const result = await request(f.app.getHttpServer())
    .post('/api/v1/auth/switch-user')
    .set('Cookie', jar(session))
    .set('X-CSRF-Token', session.body.csrfToken)
    .send({ key: 'pasha' });
  expect(result.status).toBe(403);
  expect(result.body.code).toBe('DEMO_SWITCH_FORBIDDEN');
  const current = await request(f.app.getHttpServer())
    .get('/api/v1/auth/session')
    .set('Cookie', jar(session));
  expect(current.status).toBe(200);
  expect(current.body.account.roles).toEqual(['MANAGER']);
});

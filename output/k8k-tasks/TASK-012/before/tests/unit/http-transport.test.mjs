import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { beforeAll, afterAll, expect, test } from '@jest/globals';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { AppModule } from '../../apps/api/dist/app.module.js';
import { http } from '../support/http.mjs';
const requireApi = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const { NestFactory } = requireApi('@nestjs/core');
let app, base;
const original = {
  DATABASE_URL: process.env.DATABASE_URL,
  CSRF_SIGNING_SECRET: process.env.CSRF_SIGNING_SECRET,
};
beforeAll(async () => {
  delete process.env.DATABASE_URL;
  process.env.CSRF_SIGNING_SECRET = randomBytes(48).toString('base64url');
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
});
afterAll(async () => {
  await app?.close();
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
test('Supertest drives real NestJS liveness without a database', async () => {
  const response = await http(base + '/api/health');
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok', service: 'api' });
});
test('real readiness reports 503 without database configuration, never a false worker success', async () => {
  const response = await http(base + '/api/health/worker');
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ status: 'unavailable', service: 'worker' });
  expect(response.headers.get('cache-control')).toBe('no-store');
});
test('real CSRF endpoint preserves separate secure cookies through Supertest transport', async () => {
  const response = await http(base + '/api/v1/auth/csrf');
  expect(response.status).toBe(200);
  expect(
    response.headers
      .getSetCookie()
      .some((value) => value.includes('__Host-school_csrf=') && value.includes('Secure')),
  ).toBe(true);
  expect((await response.json()).csrfToken).toEqual(expect.any(String));
});

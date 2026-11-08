import { expect, test } from '@jest/globals';
const origin = process.env.FND_WORKING_ORIGIN;
const live = origin ? test : test.skip;
if (origin && new URL(origin).protocol !== 'https:')
  throw new Error('Working checks require HTTPS');
live(
  'working API and actual worker heartbeat are available without exposing internals',
  async () => {
    for (const [path, service] of [
      ['/api/health', 'api'],
      ['/api/health/worker', 'worker'],
    ]) {
      const response = await fetch(origin + path, {
        cache: 'no-store',
        signal: AbortSignal.timeout(20000),
      });
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toEqual({ status: 'ok', service });
    }
  },
);
live('working API denies anonymous business and private-file access', async () => {
  for (const path of [
    '/api/v1/auth/session',
    '/api/v1/qa/components',
    '/api/v1/files/00000000-0000-4000-8000-000000000001/access',
  ]) {
    const response = await fetch(origin + path, { signal: AbortSignal.timeout(20000) });
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(JSON.stringify(await response.json())).not.toMatch(
      /postgres(?:ql)?:\/\/|password_hash|csrf_signing_secret/i,
    );
  }
});
live('working Swagger exposes real contracts for security and worker liveness', async () => {
  const response = await fetch(origin + '/api/docs-json', { signal: AbortSignal.timeout(20000) });
  expect(response.status).toBe(200);
  const document = await response.json();
  expect(document.openapi).toBe('3.1.0');
  expect(
    document.paths['/api/health/worker'].get.responses['200'].content['application/json'].schema
      .$ref,
  ).toBe('#/components/schemas/HealthProbeResponse');
  expect(document.paths['/api/v1/auth/session'].post.operationId).toBeTruthy();
});

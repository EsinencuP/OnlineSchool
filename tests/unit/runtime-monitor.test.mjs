import { expect, jest, test } from '@jest/globals';
import { checkRuntime, healthOrigin } from '../../infra/ops/runtime-monitor.mjs';
import { createHealthchecksReporter } from '../../infra/ops/healthchecks-reporter.mjs';

const target = 'https://school.example.test';
const json = (body, status = 200, headers = {}) => Response.json(body, { status, headers });
const health = (service, status = 'ok') =>
  json({ status, service }, status === 'ok' ? 200 : 503, { 'Cache-Control': 'no-store' });

test.each([
  'http://school.example.test',
  'https://user:password@school.example.test',
  'https://school.example.test/path',
  'https://school.example.test/?token=hidden',
])('rejects unsupported origin %s with a redacted error', (origin) => {
  expect(() => healthOrigin(origin)).toThrow('INVALID_HEALTH_ORIGIN');
});

test('a confirmed worker outage is distinct from an API outage', async () => {
  const fetcher = jest.fn(async (url) =>
    url.endsWith('/worker') ? health('worker', 'unavailable') : health('api'),
  );
  const wait = jest.fn();
  await expect(checkRuntime(target, { fetcher, wait })).resolves.toMatchObject({
    state: 'WORKER_UNAVAILABLE',
    api: { result: 'OK', httpStatus: 200 },
    worker: { result: 'UNAVAILABLE', httpStatus: 503 },
    samples: 2,
  });
  expect(wait).toHaveBeenCalledWith(5000);
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
    `${target}/api/health`,
    `${target}/api/health/worker`,
    `${target}/api/health`,
    `${target}/api/health/worker`,
  ]);
  expect(fetcher.mock.calls[0][1]).toMatchObject({
    credentials: 'omit',
    redirect: 'manual',
    cache: 'no-store',
  });
  expect(fetcher.mock.calls[0][1].headers).toEqual({ Accept: 'application/json' });
});

test('a transport error is retried and a recovered sample suppresses the alert', async () => {
  const fetcher = jest.fn(async (url) => health(url.endsWith('/worker') ? 'worker' : 'api'));
  fetcher.mockRejectedValueOnce(new Error('private resolver message'));
  await expect(checkRuntime(target, { fetcher, wait: async () => {} })).resolves.toMatchObject({
    state: 'HEALTHY',
    samples: 2,
  });
});

test.each([
  () => Response.redirect('https://other.example.test/login'),
  () => json({ service: 'api', status: 'ok' }),
  () => json({ service: 'worker', status: 'ok' }, 200, { 'Cache-Control': 'no-store' }),
  () =>
    new Response('sensitive-upstream-body'.repeat(2000), {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    }),
])('rejects redirects, cached responses, wrong service and oversized bodies', async (failure) => {
  const fetcher = async (url) => (url.endsWith('/worker') ? health('worker') : failure());
  const snapshot = await checkRuntime(target, { fetcher, wait: async () => {} });
  expect(snapshot.state).toBe('API_UNAVAILABLE');
  expect(snapshot.samples).toBe(2);
  expect(JSON.stringify(snapshot)).not.toMatch(/sensitive-upstream-body|other\.example\.test/);
});

const env = {
  OPS_RUNTIME_MONITOR_ENABLED: 'true',
  OPS_RUNTIME_PING_URL: 'https://hc-ping.com/00000000-0000-4000-8000-000000000001',
};

test('sends success and failure signals to the single authorized check', async () => {
  const fetcher = jest.fn(async () => new Response(null, { status: 200 }));
  const report = createHealthchecksReporter(env, fetcher);
  await report('WORKER_UNAVAILABLE');
  await report('API_UNAVAILABLE');
  await report('HEALTHY');

  expect(fetcher.mock.calls.map(([url, options]) => [url, options.body])).toEqual([
    [env.OPS_RUNTIME_PING_URL + '/fail', 'WORKER_UNAVAILABLE'],
    [env.OPS_RUNTIME_PING_URL + '/fail', 'API_UNAVAILABLE'],
    [env.OPS_RUNTIME_PING_URL, 'HEALTHY'],
  ]);
  for (const [, options] of fetcher.mock.calls) {
    expect(options).toMatchObject({ method: 'POST', redirect: 'error', credentials: 'omit' });
  }
});

test.each([
  'https://elsewhere.example.test/00000000-0000-4000-8000-000000000001',
  'https://user:password@hc-ping.com/00000000-0000-4000-8000-000000000001',
  'https://hc-ping.com/00000000-0000-4000-8000-000000000001/fail',
  'https://hc-ping.com/00000000-0000-4000-8000-000000000001?token=hidden',
])('rejects unsupported authenticated targets with a redacted error', (url) => {
  expect(() => createHealthchecksReporter({ ...env, OPS_RUNTIME_PING_URL: url })).toThrow(
    'INVALID_HEALTHCHECKS_PING_URL',
  );
});

test('delivery is opt-in and rejects unknown diagnostic labels before sending', async () => {
  const fetcher = jest.fn();
  expect(() =>
    createHealthchecksReporter({ ...env, OPS_RUNTIME_MONITOR_ENABLED: '' }, fetcher),
  ).toThrow('INCIDENT_DELIVERY_DISABLED');
  const report = createHealthchecksReporter(env, fetcher);
  await expect(report('raw diagnostic message')).rejects.toThrow('INVALID_RUNTIME_HEALTH_STATE');
  expect(fetcher).not.toHaveBeenCalled();
});

test('reporting failures expose only a safe status code', async () => {
  const failure = new Error('Cannot reach ' + env.OPS_RUNTIME_PING_URL);
  const fetcher = jest
    .fn(async () => new Response('private upstream response', { status: 429 }))
    .mockRejectedValueOnce(failure);
  const report = createHealthchecksReporter(env, fetcher);
  await expect(report('HEALTHY')).rejects.toThrow(/^INCIDENT_DELIVERY_UNREACHABLE$/);
  await expect(report('HEALTHY')).rejects.toThrow(/^INCIDENT_DELIVERY_HTTP_429$/);
});

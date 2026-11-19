import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { afterAll, beforeAll, beforeEach, expect, jest, test } from '@jest/globals';
import { AppModule } from '../../apps/api/dist/app.module.js';
import { managerFixture } from '../support/manager-crm-fixture.mjs';

const at = new Date('2026-11-18T13:00:00.000Z');
const sample = {
  checkedAt: at,
  outbox: {
    pending: 5,
    ready: 2,
    waitingRetry: 2,
    inFlight: 1,
    expiredLeases: 1,
    dead: 1,
    oldestReadySeconds: 90,
  },
  jobs: {
    waiting: 2,
    ready: 1,
    oldestReadySeconds: 180,
    running: 2,
    expiredLeases: 1,
    failed: 1,
    reconciliationRequired: 1,
  },
  recovery: { waiting: 0, needsManual: 1 },
  latestDead: [
    {
      id: '82ef6355-12fb-46ef-937f-c24cb96170e7',
      topic: 'auth.demo.switch.v1',
      attempts: 10,
      lastErrorCode: 'OUTBOX_HANDLER_NOT_REGISTERED',
      failedAt: '2026-11-18T12:45:00Z',
      replayStatus: null,
    },
  ],
};
let fixture, selectQueue;
const get = (index, path = '/api/v1/qa/queues') => fixture.api('get', path, index);

beforeAll(async () => {
  fixture = await managerFixture({ module: AppModule, basePath: '' });
  selectQueue = jest.fn(async () => [sample]);
  const original = fixture.client.$queryRaw;
  fixture.client.$queryRaw = (parts, ...values) =>
    parts.join?.('').includes('WITH outbox AS')
      ? selectQueue(parts, ...values)
      : original(parts, ...values);
});
beforeEach(async () => {
  selectQueue.mockClear();
  await fixture.reset();
});
afterAll(async () => await fixture?.app.close());

test.each([4, 5])(
  'authorized account %i receives one read-only snapshot with no caching',
  async (index) => {
    const response = await get(index);
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({ ...sample, checkedAt: at.toISOString() });
    expect(selectQueue).toHaveBeenCalledTimes(1);
    const query = selectQueue.mock.calls[0][0].join('');
    expect(query).toContain('LIMIT 20');
    expect(query).not.toMatch(/\b(?:payload|provider_request_id|metadata)\b/i);
    expect(query).not.toMatch(/\b(?:INSERT|UPDATE|DELETE)\s/i);
  },
);

test.each([
  [null, 401],
  [0, 403],
  [2, 403],
  [3, 403],
])('blocks account %s before queue data is queried', async (index, status) => {
  expect((await get(index)).status).toBe(status);
  expect(selectQueue).not.toHaveBeenCalled();
});

test('rejects an authorized role with a password-only demo session', async () => {
  const operator = fixture.accounts[5].id;
  const staffSession = [...fixture.state.sessions.values()].find((s) => s.account_id === operator);
  staffSession.mfa_verified_at = null;
  const env = process.env;
  const previous = [env.QA_PASSWORD_ONLY_LOGIN, env.QA_PASSWORD_ONLY_ACCOUNT_IDS];
  env.QA_PASSWORD_ONLY_LOGIN = 'true';
  env.QA_PASSWORD_ONLY_ACCOUNT_IDS = operator;
  try {
    const response = await get(5);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('MFA_REQUIRED');
    expect(selectQueue).not.toHaveBeenCalled();
  } finally {
    ['QA_PASSWORD_ONLY_LOGIN', 'QA_PASSWORD_ONLY_ACCOUNT_IDS'].forEach((key, i) => {
      if (previous[i] === undefined) delete env[key];
      else env[key] = previous[i];
    });
  }
});

test('query errors return 503 without driver diagnostics or a false zero backlog', async () => {
  selectQueue.mockRejectedValueOnce(new Error('synthetic private SQL diagnostic'));
  const response = await get(5);
  expect(response.status).toBe(503);
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.body.code).toBe('QUEUE_HEALTH_UNAVAILABLE');
  expect(response.text).not.toContain('synthetic private SQL diagnostic');
});

test('an absent snapshot cannot be returned as healthy', async () => {
  selectQueue.mockResolvedValueOnce([]);
  expect((await get(5)).status).toBe(503);
});

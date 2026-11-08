import { expect, jest, test } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import {
  listManagerSubscriptions,
  createManagerSubscription,
  renewManagerSubscription,
  freezeManagerSubscription,
  unfreezeManagerSubscription,
} from '../../packages/api-contracts/dist/generated/client.js';
import { createHandlers } from '../../apps/worker/dist/handlers.js';
const response = {
  id: 'subscription',
  studentId: 'student',
  price: '1000.0008',
  remainingLessons: 14,
};
test('generated subscription list preserves exact monetary strings and cookie auth', async () => {
  const fetch = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify([response])));
  try {
    expect(await listManagerSubscriptions('student')).toEqual({ ok: true, value: [response] });
    expect(fetch.mock.calls[0][0]).toBe('/api/v1/manager/students/student/subscriptions');
    expect(fetch.mock.calls[0][1].credentials).toBe('include');
  } finally {
    fetch.mockRestore();
  }
});
test.each(['create', 'renew', 'freeze', 'unfreeze'])(
  'generated %s command forwards CSRF/idempotency without replacing distribution identity',
  async (action) => {
    const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify(response), { status: action === 'create' ? 201 : 200 }),
      );
    try {
      const opts = { headers: { 'X-CSRF-Token': 'csrf', 'Idempotency-Key': 'key' } };
      const body =
        action === 'create'
          ? { planId: 'plan', distributionId: 'distribution' }
          : action === 'renew'
            ? { distributionId: 'distribution' }
            : action === 'freeze'
              ? {
                  startsOn: '2026-11-01',
                  endsOn: '2026-11-03',
                  reason: 'ILLNESS',
                  cancelConflictingLessons: false,
                }
              : {};
      const call =
        action === 'create'
          ? createManagerSubscription('student', body, opts)
          : action === 'renew'
            ? renewManagerSubscription('subscription', body, opts)
            : action === 'freeze'
              ? freezeManagerSubscription('subscription', body, opts)
              : unfreezeManagerSubscription('subscription', body, opts);
      expect(await call).toEqual({ ok: true, value: response });
      const [url, request] = fetch.mock.calls[0];
      expect(url).toBe(
        action === 'create'
          ? '/api/v1/manager/students/student/subscriptions'
          : `/api/v1/manager/subscriptions/subscription/${action}`,
      );
      expect(request.headers).toMatchObject(opts.headers);
      expect(request.method).toBe('POST');
      expect(JSON.parse(request.body)).toEqual(body);
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally {
      fetch.mockRestore();
    }
  },
);
test('OpenAPI documents all five scoped routes, strict DTOs and monetary strings', async () => {
  const doc = JSON.parse(await readFile('packages/api-contracts/openapi/openapi.json', 'utf8'));
  for (const [path, verb] of [
    ['students/{studentId}/subscriptions', 'get'],
    ['students/{studentId}/subscriptions', 'post'],
    ['subscriptions/{id}/renew', 'post'],
    ['subscriptions/{id}/freeze', 'post'],
    ['subscriptions/{id}/unfreeze', 'post'],
  ]) {
    const operation = doc.paths['/api/v1/manager/' + path][verb];
    expect(operation.tags).toContain('manager');
    expect(operation.security).toContainEqual({ sessionCookie: [] });
    for (const code of ['401', '403', '404', '409'])
      expect(operation.responses[code]).toBeDefined();
    if (verb === 'post') {
      expect(operation.parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Idempotency-Key', required: true }),
          expect.objectContaining({ name: 'X-CSRF-Token', required: true }),
        ]),
      );
    }
  }
  const s = doc.components.schemas;
  expect(s.ManagerSubscriptionDto.properties.price.type).toBe('string');
  expect(s.ManagerSubscriptionDto.properties.remainingLessons.type).toBe('integer');
  for (const name of [
    'CreateManagerSubscriptionDto',
    'RenewManagerSubscriptionDto',
    'FreezeManagerSubscriptionDto',
  ])
    expect(s[name].additionalProperties).toBe(false);
  expect(s.CreateManagerSubscriptionDto.required).toContain('distributionId');
  expect(s.CreateManagerSubscriptionDto.properties.paymentId).toBeUndefined();
  expect(s.CreateManagerSubscriptionDto.properties.price).toBeUndefined();
});
test('worker recognizes subscription notifications and technical command topics', () => {
  for (const action of ['created', 'renewed', 'frozen', 'unfrozen', 'expired'])
    expect(createHandlers().has(`manager.subscription.${action}.v1`)).toBe(true);
  for (const action of ['created', 'renewed', 'frozen', 'unfrozen'])
    expect(createHandlers().has(`manager.subscription.command-${action}.v1`)).toBe(true);
});

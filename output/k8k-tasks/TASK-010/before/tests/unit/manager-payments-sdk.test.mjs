import { expect, jest, test } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import {
  createManagerPayment,
  confirmManagerPayment,
  rejectManagerPayment,
  prepareManagerPaymentSubscription,
  allocateManagerPayment,
  listManagerPayments,
  listManagerDistributions,
} from '../../packages/api-contracts/dist/generated/client.js';

test.each([
  [
    createManagerPayment,
    '/students/id/payments',
    { amount: '0.1001', method: 'CASH', purpose: 'OTHER', receivedAt: '2026-10-30T10:00:00Z' },
  ],
  [confirmManagerPayment, '/payments/id/confirm', {}],
  [rejectManagerPayment, '/payments/id/reject', { reason: 'duplicate' }],
  [
    prepareManagerPaymentSubscription,
    '/payments/id/prepare-subscription',
    { enrollmentId: 'e', planId: 'p', amount: '0.1001' },
  ],
  [allocateManagerPayment, '/payments/id/distributions', { subscriptionId: 's', amount: '0.1001' }],
])(
  'generated command forwards exact payload and security headers: %s',
  async (call, path, body) => {
    const response = { id: 'id', amount: '0.1001', currency: 'MDL', status: 'AWAITING_APPROVAL' };
    const spy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(response)));
    try {
      const options = { headers: { 'X-CSRF-Token': 'csrf', 'Idempotency-Key': 'uuid' } };
      expect(await call('id', body, options)).toEqual({ ok: true, value: response });
      const [url, req] = spy.mock.calls[0];
      expect(url).toBe('/api/v1/manager' + path);
      expect(req).toMatchObject({
        method: 'POST',
        credentials: 'include',
        headers: options.headers,
      });
      expect(JSON.parse(req.body)).toEqual(body);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  },
);
test.each([listManagerPayments, listManagerDistributions])(
  'generated lists preserve pagination and status filters: %s',
  async (call) => {
    const spy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ items: [], total: 0, page: 2, pageSize: 10 })),
      );
    try {
      const result = await call('id', { page: 2, pageSize: 10, status: 'AWAITING_APPROVAL' });
      expect(result.value.total).toBe(0);
      expect(spy.mock.calls[0][0]).toContain('page=2&pageSize=10&status=AWAITING_APPROVAL');
    } finally {
      spy.mockRestore();
    }
  },
);
test('OpenAPI describes strict MDL commands and separates receipt contact from allocated funds', async () => {
  const doc = JSON.parse(await readFile('packages/api-contracts/openapi/openapi.json', 'utf8'));
  const paths = [
    'students/{studentId}/payments',
    'payments/{paymentId}',
    'payments/{paymentId}/confirm',
    'payments/{paymentId}/reject',
    'payments/{paymentId}/prepare-subscription',
    'payments/{paymentId}/distributions',
    'students/{studentId}/distributions',
  ];
  let count = 0;
  for (const path of paths)
    for (const [verb, op] of Object.entries(doc.paths['/api/v1/manager/' + path])) {
      count++;
      expect(op.tags).toContain('manager');
      expect(op.security).toContainEqual({ sessionCookie: [] });
      for (const status of ['401', '403', '404']) expect(op.responses[status]).toBeDefined();
      if (verb === 'post')
        for (const name of ['Idempotency-Key', 'X-CSRF-Token'])
          expect(op.parameters).toContainEqual(expect.objectContaining({ name, required: true }));
    }
  expect(count).toBe(8);
  const s = doc.components.schemas;
  expect(s.CreateManagerPaymentDto.properties.currency.enum).toEqual(['MDL']);
  expect(s.CreateManagerPaymentDto.additionalProperties).toBe(false);
  expect(s.ManagerPaymentDto.properties.amount.type).toBe('string');
  expect(s.ManagerPaymentDto.properties.consumed).toBeUndefined();
  expect(s.ManagerPaymentDto.properties.note).toBeUndefined();
  expect(s.ManagerDistributionDto.properties.consumed.type).toBe('boolean');
  expect(s.ManagerPaymentPageDto.properties.total.type).toBe('integer');
});

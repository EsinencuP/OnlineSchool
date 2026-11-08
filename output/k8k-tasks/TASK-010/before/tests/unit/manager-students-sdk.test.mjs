import { expect, jest, test } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import { createHandlers } from '../../apps/worker/dist/handlers.js';
import {
  listManagerStudents,
  createManagerStudent,
  updateManagerStudentContacts,
} from '../../packages/api-contracts/dist/generated/client.js';
test('generated list client preserves explicit false filters and opaque cursor', async () => {
  const spy = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200 }),
    );
  try {
    expect(
      (
        await listManagerStudents({
          hasOverdueTask: false,
          subscriptionExpiringSoon: false,
          limit: 100,
          cursor: 'opaque-cursor',
        })
      ).ok,
    ).toBe(true);
    const url = new URL(spy.mock.calls[0][0], 'https://example.invalid');
    expect(url.pathname).toBe('/api/v1/manager/students');
    expect(url.searchParams.get('hasOverdueTask')).toBe('false');
    expect(url.searchParams.get('subscriptionExpiringSoon')).toBe('false');
    expect(url.searchParams.get('limit')).toBe('100');
    expect(url.searchParams.get('cursor')).toBe('opaque-cursor');
  } finally {
    spy.mockRestore();
  }
});
test('generated create client forwards CSRF/idempotency headers and preserves signed money strings', async () => {
  const spy = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      new Response(
        JSON.stringify({ studentId: 'id', balance: '-12.1234', balanceCurrency: 'MDL' }),
        { status: 201 },
      ),
    );
  try {
    const result = await createManagerStudent(
      { fullName: 'New student' },
      { headers: { 'X-CSRF-Token': 'csrf', 'Idempotency-Key': 'key' } },
    );
    expect(result.value.balance).toBe('-12.1234');
    const [, options] = spy.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.headers['X-CSRF-Token']).toBe('csrf');
    expect(options.headers['Idempotency-Key']).toBe('key');
    expect(options.credentials).toBe('include');
    expect(JSON.parse(options.body)).toEqual({ fullName: 'New student' });
  } finally {
    spy.mockRestore();
  }
});
test('generated contacts client reports VERSION_CONFLICT without retrying mutation', async () => {
  const spy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({ code: 'VERSION_CONFLICT', message: 'VERSION_CONFLICT' }), {
      status: 409,
    }),
  );
  try {
    const result = await updateManagerStudentContacts('student', {
      version: 1,
      phone: '+373123456',
    });
    expect(result).toMatchObject({ ok: false, error: { code: 'VERSION_CONFLICT', status: 409 } });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][1].method).toBe('PATCH');
  } finally {
    spy.mockRestore();
  }
});
test('OpenAPI documents all four routes and strictly string-valued ledger money', async () => {
  const doc = JSON.parse(await readFile('packages/api-contracts/openapi/openapi.json', 'utf8'));
  for (const [path, verb] of [
    ['/api/v1/manager/students', 'get'],
    ['/api/v1/manager/students', 'post'],
    ['/api/v1/manager/students/{studentId}', 'get'],
    ['/api/v1/manager/students/{studentId}/contacts', 'patch'],
  ]) {
    const operation = doc.paths[path][verb];
    expect(operation.tags).toContain('manager');
    expect(operation.security).toContainEqual({ sessionCookie: [] });
    expect(operation.responses['401']).toBeDefined();
    expect(operation.responses['403']).toBeDefined();
  }
  const schemas = doc.components.schemas;
  expect(schemas.StudentCardDto.properties.balance.type).toBe('string');
  expect(schemas.CurrencyBalanceDto.properties.amount.type).toBe('string');
  expect(schemas.PaymentBriefDto.properties.amount.type).toBe('string');
  expect(schemas.PaymentBriefDto.properties.distributionId.format).toBe('uuid');
  expect(schemas.StudentListItemDto.properties.activeSubscription.anyOf).toContainEqual({
    $ref: '#/components/schemas/ManagerSubscriptionSummaryDto',
  });
  expect(schemas.ManagerSubscriptionSummaryDto.properties.remainingLessons.type).toBe('integer');
  expect(schemas.SubscriptionSummaryDto.properties.lessonsRemaining.type).toBe('integer');
  expect(schemas.PaymentBriefDto.properties.status.enum).toEqual([
    'PENDING',
    'AWAITING_APPROVAL',
    'CONFIRMED',
  ]);
  expect(schemas.UpdateStudentContactsDto.properties.fullName).toBeUndefined();
});
test('worker recognizes both manager outbox topics instead of dead-lettering them', () => {
  const handlers = createHandlers();
  expect(handlers.has('manager.student.created.v1')).toBe(true);
  expect(handlers.has('manager.student.contacts-updated.v1')).toBe(true);
});

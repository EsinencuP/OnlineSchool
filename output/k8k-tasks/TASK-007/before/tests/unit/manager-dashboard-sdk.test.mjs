import { expect, jest, test } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import { getManagerDashboard } from '../../packages/api-contracts/dist/generated/client.js';
test('SDK forwards allowed windows, cookies and preserves Decimal strings', async () => {
  const value = {
      pendingPayments: {
        count: 1,
        totalsByCurrency: [{ currency: 'MDL', amount: '9007199254740993.1234' }],
      },
    },
    fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(JSON.stringify(value)));
  try {
    expect(await getManagerDashboard({ lessonsHorizonHours: 168, expiringDays: 14 })).toEqual({
      ok: true,
      value,
    });
    const [url, options] = fetch.mock.calls[0],
      parsed = new URL(url, 'https://local.invalid');
    expect(parsed.pathname).toBe('/api/v1/manager/dashboard');
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      lessonsHorizonHours: '168',
      expiringDays: '14',
    });
    expect(options).toMatchObject({ method: 'GET', credentials: 'include' });
    expect(options.body).toBeUndefined();
  } finally {
    fetch.mockRestore();
  }
});
test('OpenAPI declares strict nested summary, query enums and authorization errors', async () => {
  const doc = JSON.parse(await readFile('packages/api-contracts/openapi/openapi.json', 'utf8')),
    op = doc.paths['/api/v1/manager/dashboard'].get;
  expect(op.tags).toContain('manager');
  expect(op.security).toContainEqual({ sessionCookie: [] });
  for (const status of ['200', '401', '403', '422', '503'])
    expect(op.responses[status]).toBeDefined();
  for (const [name, values] of [
    ['lessonsHorizonHours', [24, 48, 168]],
    ['expiringDays', [3, 7, 14]],
  ])
    expect(op.parameters.find((p) => p.name === name).schema.enum).toEqual(values);
  for (const name of [
    'DashboardQueryDto',
    'ManagerDashboardDto',
    'DashboardStudentCountsDto',
    'DashboardLessonDto',
    'DashboardTaskDto',
    'DashboardOverdueTasksDto',
    'DashboardSubscriptionDto',
    'DashboardCurrencyTotalDto',
    'DashboardPendingPaymentsDto',
  ])
    expect(doc.components.schemas[name].additionalProperties).toBe(false);
  expect(doc.components.schemas.DashboardCurrencyTotalDto.properties.amount.type).toBe('string');
  expect(doc.components.schemas.DashboardLessonDto.properties).not.toHaveProperty('meetLink');
});

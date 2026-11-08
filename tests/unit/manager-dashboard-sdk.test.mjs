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
    'DashboardPriorityDto',
    'DashboardPriorityTaskDto',
  ])
    expect(doc.components.schemas[name].additionalProperties).toBe(false);
  expect(doc.components.schemas.DashboardCurrencyTotalDto.properties.amount.type).toBe('string');
  expect(doc.components.schemas.DashboardLessonDto.properties).not.toHaveProperty('meetLink');
  const dashboard = doc.components.schemas.ManagerDashboardDto;
  expect(dashboard.required).not.toContain('priority');
  expect(dashboard.properties.priority.anyOf).toEqual([
    { $ref: '#/components/schemas/DashboardPriorityDto' },
    { type: 'null' },
  ]);
});

test.each([
  {},
  { priority: null },
  {
    priority: {
      primary: null,
      criticalCount: 0,
      queueAction: 'TASK_QUEUE',
      sourceAsOf: '2026-11-07T08:00:00Z',
    },
  },
  {
    priority: {
      primary: {
        taskId: '50000000-0000-4000-8000-000000000001',
        title: 'Synthetic critical event',
      },
      criticalCount: 5,
      queueAction: 'TASK_QUEUE',
      sourceAsOf: '2026-11-07T08:00:00Z',
    },
  },
])('SDK preserves optional, unavailable and ready priority snapshots: %j', async (value) => {
  const fetch = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async () => new Response(JSON.stringify(value)));
  try {
    expect(await getManagerDashboard(undefined, { cache: 'no-store' })).toEqual({
      ok: true,
      value,
    });
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: 'GET', cache: 'no-store' });
  } finally {
    fetch.mockRestore();
  }
});

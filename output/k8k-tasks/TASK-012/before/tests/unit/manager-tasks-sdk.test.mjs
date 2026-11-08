import { expect, jest, test } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import {
  listManagerTasks,
  getManagerTask,
  claimManagerTask,
  resolveManagerTaskReschedule,
  resolveManagerTaskDispute,
  getCrmDisputeResolution,
  approveCrmDisputeResolution,
} from '../../packages/api-contracts/dist/generated/client.js';
test.each([
  [claimManagerTask, 'claim', { version: 1 }],
  [
    resolveManagerTaskReschedule,
    'resolve-reschedule',
    { decision: 'APPROVE', version: 2, newStartsAt: '2026-11-02T10:00:00Z' },
  ],
  [
    resolveManagerTaskDispute,
    'resolve-dispute',
    { decision: 'ACCEPT', version: 2, reason: 'review', refundAmount: '125.0001' },
  ],
])('generated%s forwards exact decision and security headers', async (call, path, body) => {
  const value = { taskId: 'id', status: 'IN_PROGRESS', approvalStatus: 'AWAITING_DIRECTOR' },
    spy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(value)));
  try {
    const opts = { headers: { 'X-CSRF-Token': 'csrf', 'Idempotency-Key': 'uuid' } };
    expect(await call('id', body, opts)).toEqual({ ok: true, value });
    const [url, req] = spy.mock.calls[0];
    expect(url).toBe('/api/v1/manager/tasks/id/' + path);
    expect(req).toMatchObject({ method: 'POST', credentials: 'include', headers: opts.headers });
    expect(JSON.parse(req.body)).toEqual(body);
  } finally {
    spy.mockRestore();
  }
});
test('generated queue preserves combined comma filters and opaque cursor', async () => {
  const spy = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify({ items: [], nextCursor: null })));
  try {
    await listManagerTasks({
      status: 'OPEN,IN_PROGRESS',
      type: 'GENERAL,CHARGE_DISPUTE',
      overdue: true,
      limit: 25,
      cursor: 'opaque',
    });
    const u = new URL(spy.mock.calls[0][0], 'https://local.invalid');
    expect(u.searchParams.get('status')).toBe('OPEN,IN_PROGRESS');
    expect(u.searchParams.get('overdue')).toBe('true');
    expect(u.searchParams.get('cursor')).toBe('opaque');
    await getManagerTask('id');
    expect(spy.mock.calls[1][0]).toBe('/api/v1/manager/tasks/id');
  } finally {
    spy.mockRestore();
  }
});
test('director review and approval are generated separately from manager decisions', async () => {
  const spy = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(
      async () => new Response(JSON.stringify({ taskId: 'id', refundAmount: '125.0001' })),
    );
  try {
    await getCrmDisputeResolution('id');
    expect(
      await approveCrmDisputeResolution(
        'id',
        { version: 3 },
        { headers: { 'X-CSRF-Token': 'csrf', 'Idempotency-Key': 'key' } },
      ),
    ).toEqual({ ok: true, value: { taskId: 'id', refundAmount: '125.0001' } });
    expect(spy.mock.calls[0][0]).toBe('/api/v1/dispute-resolutions/id');
    expect(spy.mock.calls[1][0]).toBe('/api/v1/dispute-resolutions/id/approve');
  } finally {
    spy.mockRestore();
  }
});
test('OpenAPI has strict task decisions, discriminated payloads and explicit pending approval state', async () => {
  const doc = JSON.parse(await readFile('packages/api-contracts/openapi/openapi.json', 'utf8'));
  for (const [path, verb] of [
    ['tasks', 'get'],
    ['tasks/{taskId}', 'get'],
    ['tasks/{taskId}/claim', 'post'],
    ['tasks/{taskId}/resolve-reschedule', 'post'],
    ['tasks/{taskId}/resolve-dispute', 'post'],
  ]) {
    const op = doc.paths['/api/v1/manager/' + path][verb];
    expect(op.tags).toContain('manager');
    expect(op.security).toContainEqual({ sessionCookie: [] });
    for (const code of ['401', '403', '404', '409', '422'])
      expect(op.responses[code]).toBeDefined();
    if (verb === 'post')
      for (const name of ['Idempotency-Key', 'X-CSRF-Token'])
        expect(op.parameters).toContainEqual(expect.objectContaining({ name, required: true }));
  }
  const s = doc.components.schemas;
  for (const name of [
    'ClaimManagerTaskDto',
    'ResolveManagerRescheduleDto',
    'ResolveManagerDisputeDto',
  ])
    expect(s[name].additionalProperties).toBe(false);
  expect(s.ManagerTaskDto.properties.payload.discriminator.propertyName).toBe('kind');
  expect(s.TaskDisputePayloadDto.properties.chargedAmount.type).toEqual(['string', 'null']);
  expect(s.ManagerTaskDto.properties.approvalStatus.enum).toContain('AWAITING_DIRECTOR');
  expect(s.ResolveManagerDisputeDto.properties.refundLessons.minimum).toBe(0);
  expect(
    doc.paths['/api/v1/dispute-resolutions/{taskId}/approve'].post.responses['403'],
  ).toBeDefined();
});

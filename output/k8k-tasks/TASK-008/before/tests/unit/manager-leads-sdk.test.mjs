import { expect, jest, test } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import {
  listManagerLeads,
  createManagerLead,
  scheduleManagerTrial,
} from '../../packages/api-contracts/dist/generated/client.js';
import { createHandlers } from '../../apps/worker/dist/handlers.js';
test('generated lead client preserves false filters, scoped cursor and stage CSV', async () => {
  const spy = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      new Response(JSON.stringify({ items: [], nextCursor: null }), { status: 200 }),
    );
  try {
    await listManagerLeads({ stage: 'NEW,TRIAL', overdue: false, cursor: 'opaque', limit: 100 });
    const url = new URL(spy.mock.calls[0][0], 'https://example.test');
    expect(url.pathname).toBe('/api/v1/manager/leads');
    expect(url.searchParams.get('overdue')).toBe('false');
    expect(url.searchParams.get('stage')).toBe('NEW,TRIAL');
    expect(url.searchParams.get('cursor')).toBe('opaque');
  } finally {
    spy.mockRestore();
  }
});
test('duplicate forwards only its explicitly allowed existingId and never retries mutations', async () => {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    spy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 'LEAD_DUPLICATE_SUSPECTED',
            details: { existingId: id, phone: 'private', note: 'private' },
          }),
          { status: 409 },
        ),
      );
  try {
    const r = await createManagerLead(
      {
        audience: 'ADULT',
        contactName: 'Trial',
        phone: '+37360000123',
        subjectId: id,
        source: 'PHONE',
      },
      { headers: { 'X-CSRF-Token': 'csrf', 'Idempotency-Key': 'key' } },
    );
    expect(r.error.existingId).toBe(id);
    expect(r.error).not.toHaveProperty('details');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][1].headers['X-CSRF-Token']).toBe('csrf');
  } finally {
    spy.mockRestore();
  }
});
test('trial client carries version and command headers; OpenAPI includes all ten endpoints', async () => {
  const spy = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      new Response(JSON.stringify({ leadId: 'lead', stage: 'TRIAL' }), { status: 200 }),
    );
  try {
    const input = { teacherId: 'teacher', startsAt: '2030-11-01T12:00:00Z', version: 2 };
    expect(
      (
        await scheduleManagerTrial('lead', input, {
          headers: { 'X-CSRF-Token': 'csrf', 'Idempotency-Key': 'key' },
        })
      ).ok,
    ).toBe(true);
    expect(JSON.parse(spy.mock.calls[0][1].body)).toEqual(input);
    expect(spy.mock.calls[0][1].credentials).toBe('include');
  } finally {
    spy.mockRestore();
  }
  const api = JSON.parse(await readFile('packages/api-contracts/openapi/openapi.json', 'utf8'));
  const operations = Object.entries(api.paths)
    .filter(([path]) => path.startsWith('/api/v1/manager/leads'))
    .flatMap(([, item]) => Object.values(item).filter((v) => v.operationId));
  expect(operations).toHaveLength(10);
  expect(api.components.schemas.ManagerDashboardDto.properties.leads).toBeTruthy();
  const handlers = createHandlers();
  for (const topic of [
    'schedule.trial.outcome.v1',
    'schedule.lesson.changed.v1',
    'finance.lead-first-payment.allocated.v1',
    'manager.lead.changed.v1',
    'manager.lead.command-trial.v1',
  ])
    expect(handlers.has(topic)).toBe(true);
});

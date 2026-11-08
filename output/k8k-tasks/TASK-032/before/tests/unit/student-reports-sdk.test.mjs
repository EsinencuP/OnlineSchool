import { expect, jest, test } from '@jest/globals';
import { markStudentReportRead } from '../../packages/api-contracts/dist/generated/client.js';
import { schoolFetch } from '../../packages/api-contracts/dist/transport.js';
const id = '10000000-0000-4000-8000-000000000001';
test.each([204, 200])('generated read-receipt SDK accepts empty HTTP %i', async (status) => {
  const spy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status }));
  try {
    expect(
      await markStudentReportRead(id, {
        baseUrl: 'https://school.example.invalid',
        headers: { 'X-CSRF-Token': 'test-token', 'Idempotency-Key': id },
      }),
    ).toEqual({ ok: true, value: undefined });
    const [url, options] = spy.mock.calls[0];
    expect(String(url)).toBe(`https://school.example.invalid/api/v1/student/reports/${id}/read`);
    expect(options).toMatchObject({
      method: 'POST',
      headers: { 'X-CSRF-Token': 'test-token', 'Idempotency-Key': id },
    });
    expect(options).not.toHaveProperty('emptyResponse');
    expect(spy).toHaveBeenCalledTimes(1);
  } finally {
    spy.mockRestore();
  }
});
test('JSON operations still reject an unexpected empty response', async () => {
  const spy = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(null, { status: 200 }));
  try {
    expect(await schoolFetch('/api/v1/student/reports')).toMatchObject({
      ok: false,
      error: { code: 'INVALID_RESPONSE' },
    });
  } finally {
    spy.mockRestore();
  }
});
test('bodyless operation still preserves JSON errors and never treats 403 as success', async () => {
  const spy = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      new Response(JSON.stringify({ code: 'REPORT_FORBIDDEN', detail: 'REPORT_FORBIDDEN' }), {
        status: 403,
        headers: { 'x-request-id': 'receipt' },
      }),
    );
  try {
    expect(await markStudentReportRead(id)).toMatchObject({
      ok: false,
      error: { status: 403, code: 'REPORT_FORBIDDEN', requestId: 'receipt' },
    });
  } finally {
    spy.mockRestore();
  }
});
test('no-content SDK rejects a successful but unexpected JSON response body', async () => {
  const spy = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify({ reportId: id }), { status: 200 }));
  try {
    expect(await markStudentReportRead(id)).toMatchObject({
      ok: false,
      error: { code: 'INVALID_RESPONSE' },
    });
  } finally {
    spy.mockRestore();
  }
});

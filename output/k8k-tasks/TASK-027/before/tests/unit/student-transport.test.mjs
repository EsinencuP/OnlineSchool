import { expect, jest, test } from '@jest/globals';
import { schoolFetch } from '../../packages/api-contracts/dist/transport.js';
test('client preserves RFC Problem Details message and manager contacts for suspended access', async () => {
  const spy = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'urn:online-school:error:access-suspended',
          status: 402,
          detail: 'ACCESS_SUSPENDED',
          code: 'ACCESS_SUSPENDED',
          managerContacts: { whatsapp: 'https://wa.me/000', telegram: 'https://t.me/example' },
          private: 'not forwarded',
        }),
        { status: 402, headers: { 'x-request-id': 'request' } },
      ),
    );
  try {
    expect(await schoolFetch('/api/v1/student/dashboard')).toEqual({
      ok: false,
      error: {
        code: 'ACCESS_SUSPENDED',
        status: 402,
        message: 'ACCESS_SUSPENDED',
        requestId: 'request',
        managerContacts: { whatsapp: 'https://wa.me/000', telegram: 'https://t.me/example' },
      },
    });
  } finally {
    spy.mockRestore();
  }
});
test('client keeps legacy errors compatible and discards malformed contacts', async () => {
  const spy = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          message: 'legacy',
          code: 'FORBIDDEN',
          managerContacts: { whatsapp: { secret: true }, telegram: 'invalid' },
        }),
        { status: 403 },
      ),
    );
  try {
    expect(await schoolFetch('/api/v1/payments')).toEqual({
      ok: false,
      error: { code: 'FORBIDDEN', status: 403, message: 'legacy' },
    });
  } finally {
    spy.mockRestore();
  }
});

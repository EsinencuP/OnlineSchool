import { expect, jest, test } from '@jest/globals';
import {
  changeStudentPassword,
  revokeStudentSession,
  getStudentAvatar,
} from '../../packages/api-contracts/dist/generated/client.js';
test('generated change-password uses PATCH and preserves password whitespace', async () => {
  const spy = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      new Response(JSON.stringify({ mustChangePassword: false }), { status: 200 }),
    );
  try {
    expect(
      await changeStudentPassword({ currentPassword: ' old ', newPassword: 'Abcdef12' }),
    ).toEqual({ ok: true, value: { mustChangePassword: false } });
    expect(spy.mock.calls[0][1].method).toBe('PATCH');
    expect(JSON.parse(spy.mock.calls[0][1].body).currentPassword).toBe(' old ');
  } finally {
    spy.mockRestore();
  }
});
test('generated revoke-session consumes empty204', async () => {
  const spy = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(null, { status: 204 }));
  try {
    expect(await revokeStudentSession('10000000-0000-4000-8000-000000000001')).toEqual({
      ok: true,
      value: undefined,
    });
    expect(spy.mock.calls[0][1].method).toBe('DELETE');
  } finally {
    spy.mockRestore();
  }
});
test('generated avatar uses Blob without leaking binary transport flag into fetch', async () => {
  const spy = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      new Response(new Uint8Array([137, 80, 78, 71]), {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      }),
    );
  try {
    const r = await getStudentAvatar();
    expect(r.ok).toBe(true);
    expect(r.value).toBeInstanceOf(Blob);
    expect(r.value.type).toBe('image/png');
    expect(spy.mock.calls[0][1]).not.toHaveProperty('binaryResponse');
  } finally {
    spy.mockRestore();
  }
});
test('avatar error retains402 manager contacts instead of a successful Blob', async () => {
  const spy = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'ACCESS_SUSPENDED',
          detail: 'ACCESS_SUSPENDED',
          managerContacts: { whatsapp: 'https://wa.me/37360000123', telegram: '' },
        }),
        { status: 402 },
      ),
    );
  try {
    expect(await getStudentAvatar()).toMatchObject({
      ok: false,
      error: {
        status: 402,
        code: 'ACCESS_SUSPENDED',
        managerContacts: { whatsapp: 'https://wa.me/37360000123', telegram: '' },
      },
    });
  } finally {
    spy.mockRestore();
  }
});

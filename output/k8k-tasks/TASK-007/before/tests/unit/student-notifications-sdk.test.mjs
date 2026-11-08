import { expect, jest, test } from '@jest/globals';
import {
  markStudentNotificationRead,
  markAllStudentNotificationsRead,
  getStudentUnreadNotificationCount,
} from '../../packages/api-contracts/dist/generated/client.js';
const id = '10000000-0000-4000-8000-000000000001';
test.each([
  [
    'one',
    'PATCH',
    `/api/v1/student/notifications/${id}/read`,
    (options) => markStudentNotificationRead(id, options),
  ],
  [
    'all',
    'POST',
    '/api/v1/student/notifications/read-all',
    (options) => markAllStudentNotificationsRead(options),
  ],
])(
  'generated %s read accepts bodyless204 and sends CSRF/key',
  async (_name, method, path, call) => {
    const spy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));
    try {
      expect(
        await call({
          baseUrl: 'https://school.example.invalid',
          headers: { 'X-CSRF-Token': 'token', 'Idempotency-Key': id },
        }),
      ).toEqual({ ok: true, value: undefined });
      const [url, options] = spy.mock.calls[0];
      expect(String(url)).toBe('https://school.example.invalid' + path);
      expect(options.method).toBe(method);
      expect(options.headers).toMatchObject({ 'X-CSRF-Token': 'token', 'Idempotency-Key': id });
      expect(options).not.toHaveProperty('emptyResponse');
    } finally {
      spy.mockRestore();
    }
  },
);
test('badge SDK preserves numeric count', async () => {
  const spy = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify({ unreadCount: 12 }), { status: 200 }));
  try {
    expect(await getStudentUnreadNotificationCount()).toEqual({
      ok: true,
      value: { unreadCount: 12 },
    });
  } finally {
    spy.mockRestore();
  }
});
test('read SDK preserves404 instead of treating missing item as successful void', async () => {
  const spy = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      new Response(
        JSON.stringify({ code: 'NOTIFICATION_NOT_FOUND', detail: 'NOTIFICATION_NOT_FOUND' }),
        { status: 404 },
      ),
    );
  try {
    expect(await markStudentNotificationRead(id)).toMatchObject({
      ok: false,
      error: { status: 404, code: 'NOTIFICATION_NOT_FOUND' },
    });
  } finally {
    spy.mockRestore();
  }
});

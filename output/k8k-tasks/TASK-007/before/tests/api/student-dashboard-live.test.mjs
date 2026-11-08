import { expect, test } from '@jest/globals';
const origin = process.env.STU_WORKING_ORIGIN ?? 'https://onlineschool-xi.vercel.app';
const credentials = ['A', 'B'].map((key) => ({
  email: process.env[`STU_DASHBOARD_${key}_EMAIL`],
  password: process.env[`STU_DASHBOARD_${key}_PASSWORD`],
}));
const live = credentials.every((c) => c.email && c.password) ? test : test.skip;

// Existing, normally provisioned student accounts only. No synthetic payments/rights or DB setup.
// Both students must have completed initial password change and have distinct upcoming lessons.
live(
  'working API: two real student accounts cannot select each other through the dashboard or its cache',
  async () => {
    if (new URL(origin).protocol !== 'https:') throw Error('Working student E2E requires HTTPS');
    const clients = credentials.map(() => ({ cookies: new Map(), csrf: undefined }));
    const call = async (client, path, body) => {
      const response = await fetch(origin + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          Cookie: [...client.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
          ...(body === undefined
            ? {}
            : { 'Content-Type': 'application/json', 'X-CSRF-Token': client.csrf ?? '' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(20000),
        redirect: 'error',
      });
      for (const header of response.headers.getSetCookie()) {
        const pair = header.split(';')[0],
          at = pair.indexOf('=');
        client.cookies.set(pair.slice(0, at), pair.slice(at + 1));
      }
      const data = await response.json();
      if (typeof data.csrfToken === 'string') client.csrf = data.csrfToken;
      return { status: response.status, data };
    };
    try {
      for (let i = 0; i < 2; i++) {
        expect((await call(clients[i], '/api/v1/auth/csrf')).status).toBe(200);
        expect(
          (await call(clients[i], '/api/v1/auth/login', { ...credentials[i], method: 'password' }))
            .status,
        ).toBe(200);
      }
      const me = await Promise.all(clients.map((client) => call(client, '/api/v1/student/me')));
      expect(
        me.every(
          (result) =>
            result.status === 200 && result.data.hasActiveAccess && !result.data.mustChangePassword,
        ),
      ).toBe(true);
      expect(me[0].data.id).not.toBe(me[1].data.id);
      const dashboards = await Promise.all(
        clients.map((client) => call(client, '/api/v1/student/dashboard')),
      );
      expect(dashboards.every((result) => result.status === 200 && result.data.nextLesson)).toBe(
        true,
      );
      expect(dashboards[0].data.nextLesson.lessonId).not.toBe(
        dashboards[1].data.nextLesson.lessonId,
      );
      const spoof = await call(
        clients[0],
        `/api/v1/student/dashboard?studentProfileId=${me[1].data.id}`,
      );
      expect(spoof.status).toBe(200);
      expect(spoof.data.nextLesson.lessonId).toBe(dashboards[0].data.nextLesson.lessonId);
      expect(JSON.stringify(spoof.data)).not.toContain(dashboards[1].data.nextLesson.lessonId);
    } finally {
      for (const client of clients)
        if (client.cookies.has('__Host-school_session')) {
          const logout = await call(client, '/api/v1/auth/logout', {});
          expect(logout.status).toBeLessThan(400);
        }
    }
  },
  60000,
);

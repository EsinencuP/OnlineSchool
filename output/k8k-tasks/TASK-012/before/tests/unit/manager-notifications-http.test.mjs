import { beforeAll, beforeEach, afterAll, afterEach, expect, test, jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { managerTasksFixture } from '../support/manager-tasks-fixture.mjs';
import { notificationDeliveryHandler } from '../../apps/worker/dist/notification-delivery.js';
import { NotificationOutboxPublisher } from '../../apps/api/dist/modules/notifications/notification-outbox.publisher.js';
let fx, f, own, other;
const sql = new Set();
const prior = {
  limit: process.env.MANUAL_NOTIFICATIONS_PER_HOUR,
  domains: process.env.NOTIFICATION_ALLOWED_DOMAINS,
  cursor: process.env.MANAGER_CURSOR_SECRET,
};
beforeAll(async () => {
  fx = await managerTasksFixture();
  f = fx.f;
  const outbox = f.client.outboxEvent.create.getMockImplementation();
  f.client.outboxEvent.create.mockImplementation(async (q) => {
    if (f.state.failNotificationOutbox && q.data.topic === 'notification.deliver.v1')
      throw Error('private delivery error');
    return outbox(q);
  });
  const profile = f.client.studentAccount.findFirst.getMockImplementation();
  f.client.studentAccount.findFirst.mockImplementation(async (q) =>
    q.where.student_id
      ? f.state.students.get(q.where.student_id)?.hasAccount === false
        ? null
        : { id: randomUUID() }
      : profile(q),
  );
  process.env.NOTIFICATION_ALLOWED_DOMAINS = 'school.example';
  process.env.MANAGER_CURSOR_SECRET = 'notifications-cursor-test-secret-32-bytes';
});
afterEach(() => {
  for (const q of f.state.queries) sql.add(q.text);
});
afterAll(async () => {
  await writeFile(join(tmpdir(), 'online-school-mgr08-sql.json'), JSON.stringify([...sql]));
  for (const [env, k] of [
    ['MANUAL_NOTIFICATIONS_PER_HOUR', 'limit'],
    ['NOTIFICATION_ALLOWED_DOMAINS', 'domains'],
    ['MANAGER_CURSOR_SECRET', 'cursor'],
  ]) {
    if (prior[k] === undefined) delete process.env[env];
    else process.env[env] = prior[k];
  }
  await f?.app.close();
});
beforeEach(async () => {
  await f.reset();
  own = f.addStudent();
  other = f.addStudent(1);
  process.env.MANUAL_NOTIFICATIONS_PER_HOUR = '10';
});
const url = (id) => `/api/v1/manager/students/${id}/notifications`;
const send = (
  body = { channel: 'IN_APP', body: 'Здравствуйте' },
  key = randomUUID(),
  id = own.id,
  index = 0,
  csrf = true,
) => f.api('post', url(id), index, { body, key, csrf });
const list = (query = '', id = own.id, index = 0) => f.api('get', url(id) + query, index);
const event = (id) =>
  f.state.outbox.find((e) => e.topic === 'notification.deliver.v1' && e.aggregate_id === id);
test('HTTP202 queues without provider call; worker creates exactly one canonical inbox and marks SENT', async () => {
  const fetch = jest.spyOn(globalThis, 'fetch');
  try {
    const key = randomUUID(),
      a = await send(undefined, key);
    expect(a.status).toBe(202);
    expect(a.body).toMatchObject({
      studentId: own.id,
      status: 'QUEUED',
      channel: 'IN_APP',
      templateCode: 'MANUAL_MESSAGE',
      sentAt: null,
    });
    expect(f.state.inbox.size).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
    expect((await list()).body.items).toEqual([a.body]);
    expect((await send(undefined, key)).body).toEqual(a.body);
    expect(f.state.dispatches.size).toBe(1);
    const handle = notificationDeliveryHandler({ send: jest.fn() });
    expect((await handle(f.client, event(a.body.notificationId), f.state.now)).ok).toBe(true);
    expect((await handle(f.client, event(a.body.notificationId), f.state.now)).ok).toBe(true);
    expect(f.state.inbox.size).toBe(1);
    expect((await list('?status=SENT')).body.items[0]).toMatchObject({
      status: 'SENT',
      sentAt: f.state.now.toISOString(),
    });
  } finally {
    fetch.mockRestore();
  }
});
test('EMAIL works without account; provider failure leaves committed business and intent intact', async () => {
  own.hasAccount = false;
  const a = await send({ channel: 'EMAIL', subject: 'Проверка', body: 'Здравствуйте' });
  expect(a.status).toBe(202);
  const row = f.state.dispatches.get(a.body.notificationId);
  row.first_attempt_at = f.state.now;
  const provider = {
      send: jest.fn(async () => ({ ok: false, code: 'EMAIL_DELIVERY_UNAVAILABLE' })),
    },
    handle = notificationDeliveryHandler(provider);
  expect(await handle(f.client, event(row.id), f.state.now)).toEqual({
    ok: false,
    error: { code: 'EMAIL_DELIVERY_UNAVAILABLE' },
  });
  expect(row.status).toBe('QUEUED');
  expect(f.state.idem.size).toBe(1);
  expect(f.state.inbox.size).toBe(0);
  provider.send.mockResolvedValue({ ok: true, reference: 'provider-id' });
  expect((await handle(f.client, event(row.id), f.state.now)).ok).toBe(true);
  expect(row).toMatchObject({ status: 'SENT', provider_reference: 'provider-id' });
  expect(row.subject).toBe('Проверка');
});
test.each(['IN_APP', 'EMAIL'])(
  'manual %s rejects a missing selected channel with422',
  async (channel) => {
    own.hasAccount = false;
    own.email = null;
    const a = await send({ channel, body: 'Здравствуйте' });
    expect(a.status).toBe(422);
    expect(a.body.code).toBe('NO_DELIVERY_CHANNEL');
    expect(f.state.dispatches.size).toBe(0);
    expect(f.state.outbox).toHaveLength(0);
  },
);
test('system lesson creation without either channel succeeds with FAILED intent per owner decision', async () => {
  own.hasAccount = false;
  own.email = null;
  const ready = fx.readyFor(own),
    a = await f.api('post', `/api/v1/manager/students/${own.id}/lessons`, 0, {
      key: randomUUID(),
      body: {
        teacherId: ready.teacherId,
        subscriptionId: ready.subscriptionId,
        startsAt: '2026-11-02T10:00:00Z',
        durationMinutes: 60,
      },
    });
  expect(a.status).toBe(201);
  const rows = [...f.state.dispatches.values()];
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    status: 'FAILED',
    failure_reason: 'NO_DELIVERY_CHANNEL',
    template_code: 'LESSON_SCHEDULED',
  });
  expect((await list('?status=FAILED')).body.items[0].failureReason).toBe(
    'Нет доступного канала доставки.',
  );
});
test.each([
  'https://evil.example/path',
  'https://meet.google.com.evil.example/x',
  'https://meet.google.com@evil.example/x',
  'http://school.example/x',
  'https://school.example:8443/x',
  'javascript:alert(1)',
  'www.evil.example',
  'ftp://school.example/x',
])('rejects link %s', async (link) => {
  const a = await send({ channel: 'IN_APP', body: link });
  expect(a.status).toBe(422);
  expect(a.body.code).toBe('LINK_NOT_ALLOWED');
  expect(f.state.dispatches.size).toBe(0);
});
test('allowlisted links and HTML are plain text in inbox; no HTML interpretation', async () => {
  const body =
    '<img src=x onerror=alert(1)> https://meet.google.com/abc-defg-hij https://school.example/course';
  const a = await send({ channel: 'IN_APP', body });
  expect(a.status).toBe(202);
  await notificationDeliveryHandler()(f.client, event(a.body.notificationId), f.state.now);
  expect([...f.state.inbox.values()][0].body).toBe(body);
  expect(JSON.stringify(f.state.audit)).not.toContain(body);
  expect(JSON.stringify(f.state.outbox)).not.toContain(body);
});
test('pair rate limit is atomic, retries do not consume it, and another pair is independent', async () => {
  process.env.MANUAL_NOTIFICATIONS_PER_HOUR = '1';
  const key = randomUUID(),
    a = await send(undefined, key);
  expect(a.status).toBe(202);
  expect((await send(undefined, key)).status).toBe(202);
  expect((await send()).status).toBe(429);
  const two = f.addStudent();
  expect((await send(undefined, randomUUID(), two.id)).status).toBe(202);
});
test('simulated concurrent submissions honor the pair limit once; this does not prove PostgreSQL races', async () => {
  process.env.MANUAL_NOTIFICATIONS_PER_HOUR = '1';
  const r = await Promise.all([send(), send()]);
  expect(r.map((x) => x.status).sort()).toEqual([202, 429]);
  expect(f.state.dispatches.size).toBe(1);
});
test.each(['audit', 'outbox'])(
  '%s failure rolls back manual intent/source/command',
  async (kind) => {
    if (kind === 'audit') f.state.failAudit = 'NOTIFICATION_QUEUED';
    else f.state.failOutbox = true;
    expect((await send()).status).toBe(503);
    expect(f.state.dispatches.size).toBe(0);
    expect(f.state.notificationSources.size).toBe(0);
    expect(f.state.idem.size).toBe(0);
  },
);
test.each([null, 2, 3, 4, 5])('role/session matrix index%s for both routes', async (index) => {
  expect((await send(undefined, randomUUID(), own.id, index)).status).toBe(
    index === null ? 401 : 403,
  );
  expect((await list('', own.id, index)).status).toBe(index === null ? 401 : 403);
});
test('scope and replay scope deny foreign or newly transferred pupil identically', async () => {
  const a = await send(undefined, randomUUID(), other.id),
    b = await send(undefined, randomUUID(), randomUUID());
  expect([a.status, b.status]).toEqual([404, 404]);
  expect(a.body.code).toBe(b.body.code);
  const key = randomUUID();
  expect((await send(undefined, key)).status).toBe(202);
  own.managerId = f.accounts[1].staffId;
  expect((await send(undefined, key)).status).toBe(404);
  expect((await list()).status).toBe(404);
});
test('mutations require CSRF/UUID key and reject unknown fields or IN_APP subject', async () => {
  expect((await send(undefined, randomUUID(), own.id, 0, false)).status).toBe(403);
  expect((await send(undefined, 'invalid')).status).toBe(400);
  expect(
    (await send({ channel: 'IN_APP', body: 'ok', managerId: f.accounts[1].staffId })).status,
  ).toBe(422);
  expect((await send({ channel: 'IN_APP', body: 'ok', subject: 'Email only' })).status).toBe(422);
});
test.each(['', ' '.repeat(5), 'x'.repeat(2001), 'password: secret', 'Bearer abcdefghijklmnop'])(
  'rejects invalid/secret body length%s',
  async (body) => {
    expect((await send({ channel: 'IN_APP', body })).status).toBe(422);
    expect(f.state.dispatches.size).toBe(0);
  },
);
test('queue combines status and opaque student-bound cursor', async () => {
  await send();
  await send({ channel: 'EMAIL', body: 'second' });
  const page = await list('?limit=1');
  expect(page.body.items).toHaveLength(1);
  expect(page.body.nextCursor.length).toBeLessThanOrEqual(200);
  const next = await list('?limit=1&cursor=' + page.body.nextCursor);
  expect(next.body.items).toHaveLength(1);
  expect(next.body.items[0].notificationId).not.toBe(page.body.items[0].notificationId);
  expect((await list('?limit=1&status=SENT&cursor=' + page.body.nextCursor)).status).toBe(422);
  const two = f.addStudent();
  expect((await list('?limit=1&cursor=' + page.body.nextCursor, two.id)).status).toBe(422);
});
test('system dedupe checks exact variables without creating a second dispatch', async () => {
  const publisher = new NotificationOutboxPublisher(),
    id = randomUUID(),
    intent = {
      studentId: own.id,
      templateCode: 'ACCOUNT_CREATED',
      variables: { accountId: id, loginEmail: 'student@example.invalid' },
      dedupeKey: `account-created:${id}`,
    };
  expect((await publisher.enqueue(f.client, intent)).ok).toBe(true);
  expect(
    (
      await publisher.enqueue(f.client, {
        ...intent,
        variables: { loginEmail: 'student@example.invalid', accountId: id },
      })
    ).ok,
  ).toBe(true);
  expect(f.state.dispatches.size).toBe(1);
  expect(
    (
      await publisher.enqueue(f.client, {
        ...intent,
        variables: { accountId: id, loginEmail: 'different@example.invalid' },
      })
    ).error.code,
  ).toBe('NOTIFICATION_DEDUPE_CONFLICT');
});
test('email outside safe retry window is FAILED without another provider call', async () => {
  const a = await send({ channel: 'EMAIL', body: 'Test' }),
    row = f.state.dispatches.get(a.body.notificationId);
  row.first_attempt_at = f.state.now;
  const provider = { send: jest.fn() };
  expect(
    (
      await notificationDeliveryHandler(provider)(
        f.client,
        event(row.id),
        new Date(+f.state.now + 24 * 3600000),
      )
    ).ok,
  ).toBe(true);
  expect(row).toMatchObject({ status: 'FAILED', failure_reason: 'DELIVERY_UNCONFIRMED' });
  expect(provider.send).not.toHaveBeenCalled();
});
test('a failure of the notification Outbox rolls back the originating Schedule move', async () => {
  const ready = fx.readyFor(own),
    created = await f.api('post', `/api/v1/manager/students/${own.id}/lessons`, 0, {
      key: randomUUID(),
      body: {
        teacherId: ready.teacherId,
        subscriptionId: ready.subscriptionId,
        startsAt: '2026-11-02T10:00:00Z',
        durationMinutes: 60,
      },
    });
  expect(created.status).toBe(201);
  f.state.failNotificationOutbox = true;
  const changed = await f.api(
    'post',
    `/api/v1/manager/lessons/${created.body.lessonId}/reschedule`,
    0,
    { key: randomUUID(), body: { newStartsAt: '2026-11-03T10:00:00Z', reason: 'Requested move' } },
  );
  expect(changed.status).toBe(503);
  expect(f.state.lessons.get(created.body.lessonId).scheduled_at.toISOString()).toBe(
    '2026-11-02T10:00:00.000Z',
  );
  expect([...f.state.dispatches.values()].map((x) => x.template_code)).toEqual([
    'LESSON_SCHEDULED',
  ]);
});
test('MGR07 approved transfer emits one LESSON_RESCHEDULED, with no second task-approval notification', async () => {
  const ready = fx.readyFor(own),
    created = await f.api('post', `/api/v1/manager/students/${own.id}/lessons`, 0, {
      key: randomUUID(),
      body: {
        teacherId: ready.teacherId,
        subscriptionId: ready.subscriptionId,
        startsAt: '2026-11-02T10:00:00Z',
        durationMinutes: 60,
      },
    });
  const task = await fx.addTask(own, 'RESCHEDULE_REQUEST', {
    lesson_id: created.body.lessonId,
    payload: { reason: 'Please move' },
  });
  expect(
    (
      await f.api('post', `/api/v1/manager/tasks/${task.id}/claim`, 0, {
        key: randomUUID(),
        body: { version: 1 },
      })
    ).status,
  ).toBe(200);
  const result = await f.api('post', `/api/v1/manager/tasks/${task.id}/resolve-reschedule`, 0, {
    key: randomUUID(),
    body: { version: 2, decision: 'APPROVE', newStartsAt: '2026-11-03T10:00:00Z' },
  });
  expect(result.status).toBe(200);
  expect([...f.state.dispatches.values()].map((x) => x.template_code)).toEqual([
    'LESSON_SCHEDULED',
    'LESSON_RESCHEDULED',
  ]);
});
test('MGR07 dispute ACCEPT notifies only after actual director reversal publication', async () => {
  const ready = fx.readyFor(own),
    charge = await fx.charged(own, ready),
    task = await fx.addTask(own, 'ATTENDANCE_DISPUTE', {
      lesson_id: charge.lessonId,
      original_consumption_id: charge.consumptionId,
      payload: { description: 'Please review' },
    });
  await f.api('post', `/api/v1/manager/tasks/${task.id}/claim`, 0, {
    key: randomUUID(),
    body: { version: 1 },
  });
  const pending = await f.api('post', `/api/v1/manager/tasks/${task.id}/resolve-dispute`, 0, {
    key: randomUUID(),
    body: { version: 2, decision: 'ACCEPT', reason: 'Full reversal', refundLessons: 1 },
  });
  expect(pending.status).toBe(200);
  expect([...f.state.dispatches.values()].some((x) => x.template_code === 'DISPUTE_ACCEPTED')).toBe(
    false,
  );
  const key = randomUUID(),
    approve = () =>
      f.api('post', `/api/v1/dispute-resolutions/${task.id}/approve`, 4, {
        key,
        body: { version: 3 },
      });
  expect((await approve()).status).toBe(200);
  expect((await approve()).status).toBe(200);
  const rows = [...f.state.dispatches.values()].filter(
    (x) => x.template_code === 'DISPUTE_ACCEPTED',
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].variables).toEqual({ taskId: task.id, lessonId: charge.lessonId });
  expect(f.state.adjustments.size).toBe(1);
});

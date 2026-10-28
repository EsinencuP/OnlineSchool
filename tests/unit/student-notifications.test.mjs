import { expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import {
  NotificationService,
  notificationContent,
  NOTIFICATION_TTL_MS,
} from '../../apps/api/dist/modules/notifications/notification.service.js';
import {
  NotificationsQueryPipe,
  NOTIFICATION_TYPES,
} from '../../apps/api/dist/student/notifications/notifications.dto.js';
import {
  StudentNotificationsService,
  notificationsSql,
} from '../../apps/api/dist/student/notifications/notifications.service.js';
import {
  StudentNotificationProjector,
  subscriptionNotificationSql,
} from '../../apps/worker/dist/notifications.js';
import { WorkerLifecycle } from '../../apps/worker/dist/worker.module.js';
const now = new Date('2026-10-28T10:00:00Z'),
  student = randomUUID(),
  sourceId = randomUUID();
const payloads = {
  HOMEWORK_REVIEWED: { homeworkId: randomUUID(), reviewId: randomUUID() },
  HOMEWORK_NEEDS_REVISION: { homeworkId: randomUUID(), reviewId: randomUUID() },
  LESSON_RESCHEDULED: { lessonId: randomUUID() },
  LESSON_CANCELLED: { lessonId: randomUUID() },
  REPORT_READY: { reportId: randomUUID() },
  SUBSCRIPTION_EXPIRING: {
    subscriptionId: randomUUID(),
    daysBefore: 7,
    expiresAt: '2026-11-04T10:00:00+00:00',
  },
  PAYMENT_CONFIRMED: {
    paymentId: randomUUID(),
    distributionId: randomUUID(),
    subscriptionId: randomUUID(),
  },
};
test.each(NOTIFICATION_TYPES)(
  '%s uses fixed public copy and expected entity references only',
  (type) => {
    const out = notificationContent(type, payloads[type]);
    expect(out.title.length).toBeGreaterThan(5);
    expect(out.body.length).toBeGreaterThan(10);
    expect(out.payload).toEqual(payloads[type]);
    expect(JSON.stringify(out)).not.toMatch(/https?:|amount|grade|comment/);
  },
);
test('expiry3 has correct Russian text and preserves canonical source timestamp', () => {
  const p = { ...payloads.SUBSCRIPTION_EXPIRING, daysBefore: 3 };
  expect(notificationContent('SUBSCRIPTION_EXPIRING', p)).toMatchObject({
    body: 'До окончания абонемента 3 дня.',
    payload: p,
  });
});
test('validated source identifiers retain exact JSON for database provenance equality', () => {
  const reportId = randomUUID().toUpperCase();
  expect(notificationContent('REPORT_READY', { reportId }).payload).toEqual({ reportId });
});
test.each([0, 1, 8, '7', null])('expiry rejects noncontract threshold %s', (daysBefore) =>
  expect(() =>
    notificationContent('SUBSCRIPTION_EXPIRING', { ...payloads.SUBSCRIPTION_EXPIRING, daysBefore }),
  ).toThrow(),
);
test('producer cannot put private text or links into payload', () => {
  expect(() =>
    notificationContent('REPORT_READY', { ...payloads.REPORT_READY, teacherNote: 'PRIVATE' }),
  ).toThrow();
  expect(() =>
    notificationContent('REPORT_READY', { reportId: 'https://host.invalid/' }),
  ).toThrow();
  expect(() => notificationContent('arbitrary', {})).toThrow();
});
test('query defaults30 and caps100 with strict ownership-query rejection', () => {
  const p = new NotificationsQueryPipe();
  expect(p.transform({})).toEqual({ page: 1, pageSize: 30 });
  expect(p.transform({ page: '2', pageSize: '100' })).toEqual({ page: 2, pageSize: 100 });
  for (const q of [
    { studentProfileId: student },
    { pageSize: 'NaN' },
    { page: ['1', '2'] },
    { pageSize: '101' },
    null,
  ])
    expect(() => p.transform(q)).toThrow();
});
test('projection scope and TTL are server parameters; paging is stable', () => {
  const q = notificationsSql(student, { page: 3, pageSize: 30 }, now);
  expect(q.values).toContain(student);
  expect(q.values).toContainEqual(new Date(+now - NOTIFICATION_TTL_MS));
  expect(q.values.at(-1)).toBe(60);
  expect(q.sql).toMatch(/ORDER BY created_at DESC,id DESC/);
  expect(q.sql).not.toMatch(/JOIN/);
});
function deliveryFixture() {
  let rows = new Map(),
    source = {
      id: sourceId,
      student_id: student,
      type: 'REPORT_READY',
      payload: payloads.REPORT_READY,
      occurred_at: now,
      delivered_at: null,
    };
  const calls = [];
  const tx = {
    studentNotificationSource: {
      findUnique: jest.fn(async () => source),
      update: jest.fn(async ({ data }) => {
        if (tx.failReceipt) throw Error('receipt failure');
        source = { ...source, ...data };
        return source;
      }),
    },
    studentNotification: {
      createMany: jest.fn(async ({ data }) => {
        const n = data[0];
        if (rows.has(n.id)) return { count: 0 };
        rows.set(n.id, n);
        return { count: 1 };
      }),
    },
    $queryRaw: jest.fn(async (first, ...args) => {
      const sql = Array.isArray(first) ? first.join('?') : first.sql;
      calls.push({ sql, args });
      if (sql.includes('SELECT id FROM student_notification_sources'))
        return source.delivered_at ? [] : [{ id: source.id }];
      if (sql.includes('SELECT DISTINCT student_id')) return [];
      return [{ now }];
    }),
    $executeRaw: jest.fn(async () => 0),
  };
  tx.$transaction = jest.fn(async (fn) => {
    const before = structuredClone({ rows, source });
    try {
      return await fn(tx);
    } catch (e) {
      rows = before.rows;
      source = before.source;
      throw e;
    }
  });
  return { tx, calls, rows: () => rows, source: () => source, setSource: (v) => (source = v) };
}
test('service creates once from canonical source and serializes before pruning', async () => {
  const f = deliveryFixture(),
    s = new NotificationService();
  await s.create(f.tx, sourceId);
  await s.create(f.tx, sourceId);
  expect(f.rows().size).toBe(1);
  expect(f.rows().get(sourceId)).toMatchObject({
    student_id: student,
    type: 'REPORT_READY',
    payload: payloads.REPORT_READY,
    created_at: now,
  });
  expect(f.calls[0].sql).toContain('pg_advisory_xact_lock');
  const q = f.tx.$executeRaw.mock.calls[0];
  expect(q[0].join('?')).toContain('row_number() OVER(ORDER BY created_at DESC,id DESC)');
  expect(q).toContain(500);
  expect(q).toContainEqual(new Date(+now - 90 * 86400000));
});
test('service rejects nonexistent source and never inserts supplied user data', async () => {
  const f = deliveryFixture();
  f.setSource(null);
  await expect(new NotificationService().create(f.tx, sourceId)).rejects.toThrow();
  expect(f.tx.studentNotification.createMany).not.toHaveBeenCalled();
});
test('future source cannot enter inbox', async () => {
  const f = deliveryFixture();
  f.setSource({ ...f.source(), occurred_at: new Date(+now + 1000) });
  await expect(new NotificationService().create(f.tx, sourceId)).rejects.toThrow();
  expect(f.rows().size).toBe(0);
});
test('worker delivery, inbox row and delivery receipt commit together; replay is empty', async () => {
  const f = deliveryFixture(),
    p = new StudentNotificationProjector(f.tx, new NotificationService());
  expect(await p.processDue()).toBe(1);
  expect(f.source().delivered_at).toEqual(now);
  expect(f.rows().size).toBe(1);
  expect(await p.processDue()).toBe(0);
  expect(f.calls.some((c) => c.sql.includes('FOR UPDATE SKIP LOCKED'))).toBe(true);
});
test('receipt failure rolls back inbox row; next attempt succeeds', async () => {
  const f = deliveryFixture(),
    p = new StudentNotificationProjector(f.tx, new NotificationService());
  f.tx.failReceipt = true;
  await expect(p.processDue()).rejects.toThrow();
  expect(f.rows().size).toBe(0);
  expect(f.source().delivered_at).toBeNull();
  f.tx.failReceipt = false;
  expect(await p.processDue()).toBe(1);
  expect(f.rows().size).toBe(1);
});
test('worker stop prevents new claims and maintenance', async () => {
  const f = deliveryFixture(),
    p = new StudentNotificationProjector(f.tx, new NotificationService());
  p.stop();
  expect(await p.processDue()).toBe(0);
  expect(f.tx.$transaction).not.toHaveBeenCalled();
});
test('expiry uses pupil calendar day, finite validity and versioned idempotency key', () => {
  const q = subscriptionNotificationSql(now);
  expect(q.sql).toContain('AT TIME ZONE a.timezone');
  expect(q.sql).toContain('d.days IN(7,3)');
  expect(q.sql).toContain('extract(epoch FROM s.valid_to)');
  expect(q.sql).toContain('ON CONFLICT(event_key) DO NOTHING');
  expect(q.sql).not.toMatch(/payment_receipts/);
  expect(q.values).toContainEqual(now);
});
test('read-all rechecks current owner before any update', async () => {
  const f = deliveryFixture();
  const me = {
    load: jest.fn(async () => ({
      ok: true,
      value: {
        context: {
          studentProfileId: randomUUID(),
          mustChangePassword: false,
          hasActiveAccess: true,
        },
      },
    })),
  };
  const s = new StudentNotificationsService({ client: f.tx }, me);
  await expect(
    s.markRead({ tx: f.tx }, { userId: randomUUID(), studentProfileId: student }, null, {}),
  ).rejects.toThrow();
  expect(f.tx.studentNotification.createMany).not.toHaveBeenCalled();
  expect(f.tx.$queryRaw).not.toHaveBeenCalled();
});
test('no read status mutation from malformed body', async () => {
  const f = deliveryFixture(),
    me = { load: jest.fn() };
  await expect(
    new StudentNotificationsService({ client: f.tx }, me).markRead(
      { tx: f.tx },
      { studentProfileId: student },
      sourceId,
      { isRead: false },
    ),
  ).rejects.toThrow();
  expect(me.load).not.toHaveBeenCalled();
});
test('notification backlog does not block finance or PDF polling; shutdown drains current delivery', async () => {
  const processors = Array.from({ length: 3 }, () => ({
    enabled: jest.fn(async () => ({ ok: true, value: 0 })),
  }));
  const lifecycle = new WorkerLifecycle(...processors, {}, {}, new Map());
  let finish;
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  lifecycle.notifications = { processDue: jest.fn(() => pending), stop: jest.fn(() => finish(1)) };
  lifecycle.pdf = { processDue: jest.fn(async () => 0), stop: jest.fn() };
  await lifecycle.process();
  await lifecycle.process();
  expect(processors[0].enabled).toHaveBeenCalledTimes(2);
  expect(lifecycle.notifications.processDue).toHaveBeenCalledTimes(1);
  expect(lifecycle.pdf.processDue).toHaveBeenCalled();
  await lifecycle.onModuleDestroy();
  expect(lifecycle.notifications.stop).toHaveBeenCalledTimes(1);
});

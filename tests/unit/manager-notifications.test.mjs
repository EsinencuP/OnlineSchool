import { expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  MANAGER_TEMPLATE_CODES,
  renderNotification,
  escapeNotificationHtml,
} from '../../apps/api/dist/modules/notifications/templates.js';
import {
  ResendNotificationProvider,
  notificationDeliveryHandler,
} from '../../apps/worker/dist/notification-delivery.js';
import { OutboxWorker } from '../../apps/worker/dist/outbox.js';
import { standaloneNotificationStorage } from '../support/notification-storage.mjs';
import { NotificationOutboxPublisher } from '../../apps/api/dist/modules/notifications/notification-outbox.publisher.js';
const variables = (code) =>
  code === 'TRIAL_SCHEDULED'
    ? { lessonId: randomUUID(), startsAt: '2026-11-03T12:00:00Z' }
    : code === 'ACCOUNT_CREATED'
      ? { accountId: randomUUID(), loginEmail: 'student@example.invalid' }
      : code === 'PAYMENT_CONFIRMED'
        ? { paymentId: randomUUID(), receiptOnly: 'true' }
        : code === 'MANUAL_MESSAGE'
          ? { body: 'Здравствуйте, ученик' }
          : code.startsWith('SUBSCRIPTION_')
            ? { subscriptionId: randomUUID(), operationId: randomUUID() }
            : code.startsWith('LESSON_')
              ? { lessonId: randomUUID() }
              : { taskId: randomUUID(), lessonId: randomUUID() };
test.each(MANAGER_TEMPLATE_CODES)(
  '%s validates exact variables, ru/en and unknown locale fallback',
  (code) => {
    const v = variables(code);
    for (const locale of ['ru', 'en', 'xx']) {
      const r = renderNotification(code, v, locale);
      expect(r.ok).toBe(true);
      expect(r.value.locale).toBe(locale === 'en' ? 'en' : 'ru');
      expect(r.value.body).not.toMatch(/undefined|temporaryPassword|password_hash/);
      expect(renderNotification(code, { ...v, secret: 'private' }, locale).error.code).toBe(
        'TEMPLATE_VARIABLES_INVALID',
      );
      const missing = { ...v };
      delete missing[Object.keys(v)[0]];
      expect(renderNotification(code, missing, locale).error.code).toBe(
        'TEMPLATE_VARIABLES_INVALID',
      );
    }
  },
);
test('HTML can be escaped at HTML boundary while email uses a plain-text part', () => {
  expect(escapeNotificationHtml('<img a="x">&\'')).toBe('&lt;img a=&quot;x&quot;&gt;&amp;&#39;');
});
test('Resend adapter uses one stable key, plain text, timeout and safe errors only', async () => {
  const old = { key: process.env.RESEND_API_KEY, from: process.env.STUDENT_EMAIL_FROM };
  process.env.RESEND_API_KEY = 'test-key';
  process.env.STUDENT_EMAIL_FROM = 'school@example.invalid';
  const fetch = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response(JSON.stringify({ id: 'receipt' }))),
    row = {
      id: randomUUID(),
      recipient_email: 'student@example.invalid',
      subject: 'Subject',
      body: '<script>alert(1)</script>',
    };
  try {
    const provider = new ResendNotificationProvider();
    expect(await provider.send(row)).toEqual({ ok: true, reference: 'receipt' });
    expect(await provider.send(row)).toEqual({ ok: true, reference: 'receipt' });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers['Idempotency-Key']).toBe(`manager-notification/${row.id}`);
    expect(init.redirect).toBe('error');
    expect(JSON.parse(init.body)).toEqual({
      from: 'school@example.invalid',
      to: [row.recipient_email],
      subject: row.subject,
      text: row.body,
    });
    expect(fetch.mock.calls[1][1].body).toBe(init.body);
    fetch.mockRejectedValue(Error('private@email.invalid provider secret'));
    expect(await provider.send(row)).toEqual({ ok: false, code: 'EMAIL_DELIVERY_UNAVAILABLE' });
    delete process.env.RESEND_API_KEY;
    expect(await provider.send(row)).toEqual({ ok: false, code: 'EMAIL_NOT_CONFIGURED' });
  } finally {
    fetch.mockRestore();
    for (const [k, e] of [
      ['key', 'RESEND_API_KEY'],
      ['from', 'STUDENT_EMAIL_FROM'],
    ]) {
      if (old[k] === undefined) delete process.env[e];
      else process.env[e] = old[k];
    }
  }
});
test('committed Outbox claim records the first email attempt before any provider call; exhausted job marks FAILED', async () => {
  const id = randomUUID(),
    now = new Date(),
    event = {
      id: randomUUID(),
      topic: 'notification.deliver.v1',
      aggregate_id: id,
      source_operation_id: randomUUID(),
      schema_version: 1,
      payload: { schemaVersion: 1, notificationId: id },
      status: 'PENDING',
      attempts: 0,
      locked_until: null,
    },
    job = { id: randomUUID(), status: 'PENDING', attempts: 0, max_attempts: 2 },
    row = { id, status: 'QUEUED', channel: 'EMAIL', first_attempt_at: null };
  const tx = {
    $queryRaw: jest.fn(async (parts) =>
      parts.join('?').includes('AS now') ? [{ now }] : [{ id: event.id }],
    ),
    outboxEvent: {
      findUniqueOrThrow: jest.fn(async () => event),
      update: jest.fn(async ({ data }) => {
        Object.assign(event, {
          ...data,
          ...(data.attempts ? { attempts: event.attempts + 1 } : {}),
        });
        return event;
      }),
    },
    jobRecord: {
      createMany: jest.fn(),
      findUniqueOrThrow: jest.fn(async () => job),
      update: jest.fn(async ({ data }) => {
        Object.assign(job, { ...data, ...(data.attempts ? { attempts: job.attempts + 1 } : {}) });
        return job;
      }),
    },
    jobAttempt: { create: jest.fn() },
    notificationDispatch: { updateMany: jest.fn(async ({ data }) => Object.assign(row, data)) },
    auditEvent: { createMany: jest.fn() },
  };
  const worker = new OutboxWorker(
    { $transaction: async (fn) => fn(tx) },
    { maxAttempts: 2, leaseMs: 30000, batchSize: 1 },
  );
  await worker.claim();
  expect(row.first_attempt_at).toEqual(now);
  await worker.dead(tx, event, job, now, 'EMAIL_DELIVERY_UNAVAILABLE');
  expect(row).toMatchObject({ status: 'FAILED', failure_reason: 'DELIVERY_FAILED' });
});
test('system fallback email/no-channel result and locale are durable, body never enters Outbox/Audit', async () => {
  const student = randomUUID(),
    { tx, state } = standaloneNotificationStorage(student),
    p = new NotificationOutboxPublisher();
  tx.studentAccount.findFirst.mockResolvedValue(null);
  state.students.get(student).notification_locale = 'en';
  const event = {
    studentId: student,
    templateCode: 'LESSON_SCHEDULED',
    variables: { lessonId: randomUUID() },
    dedupeKey: 'system1',
  };
  expect((await p.enqueue(tx, event)).ok).toBe(true);
  expect([...state.dispatches.values()][0]).toMatchObject({
    channel: 'EMAIL',
    locale: 'en',
    status: 'QUEUED',
  });
  state.students.get(student).email = null;
  expect((await p.enqueue(tx, { ...event, dedupeKey: 'system2' })).ok).toBe(true);
  expect([...state.dispatches.values()][1]).toMatchObject({
    status: 'FAILED',
    failure_reason: 'NO_DELIVERY_CHANNEL',
  });
  expect(JSON.stringify(state.audit)).not.toContain('student@example.invalid');
  expect(JSON.stringify(state.outbox)).not.toContain('student@example.invalid');
});
test('worker detects source scope mismatch and disabled pupil account without creating an inbox', async () => {
  const student = randomUUID(),
    { tx, state } = standaloneNotificationStorage(student),
    p = new NotificationOutboxPublisher();
  await p.enqueue(tx, {
    studentId: student,
    templateCode: 'LESSON_SCHEDULED',
    variables: { lessonId: randomUUID() },
    dedupeKey: 'system1',
  });
  const row = [...state.dispatches.values()][0],
    event = state.outbox[0];
  state.notificationSources.get(row.source_id).student_id = randomUUID();
  expect((await notificationDeliveryHandler()(tx, event, new Date())).error.code).toBe(
    'INVALID_NOTIFICATION_SOURCE',
  );
  expect(state.inbox.size).toBe(0);
  tx.studentAccount.findFirst.mockResolvedValue(null);
  expect((await notificationDeliveryHandler()(tx, event, new Date())).ok).toBe(true);
  expect(row.status).toBe('FAILED');
});
test('migration preserves existing source guards, inbox history and delivery identity', async () => {
  const sql = await readFile(
    'packages/db/prisma/migrations/20261101100000_mgr08_notifications/migration.sql',
    'utf8',
  );
  expect(sql).toContain('EXECUTE FUNCTION stu10_guard_source()');
  expect(sql).toContain('dedupe_key text NOT NULL UNIQUE');
  expect(sql).toContain("OLD.status<>'QUEUED'");
  expect(sql).toContain('idx_mgr08_manual_rate');
  expect(sql).not.toMatch(/UPDATE student_notifications|DELETE FROM|TRUNCATE TABLE/);
});

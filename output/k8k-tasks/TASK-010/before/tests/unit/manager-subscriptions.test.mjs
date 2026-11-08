import { standaloneNotificationStorage } from '../support/notification-storage.mjs';
import { notificationDeliveryHandler } from '../../apps/worker/dist/notification-delivery.js';
import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Prisma } from '../../packages/db/dist/index.js';
import {
  freezeDates,
  freezePolicy,
  localDay,
  schoolMidnight,
  addSchoolDays,
  daysBetween,
} from '../../apps/api/dist/modules/finance/manager-subscriptions/time.js';
import { LedgerPublicationService } from '../../apps/api/dist/modules/finance/ledger-publication.service.js';
import { subscriptionFacts } from '../../apps/api/dist/student/subscription/subscription.sql.js';
import { ManagerSubscriptionNoticeHandler } from '../../apps/worker/dist/handlers.js';
const policy = { zone: 'Europe/Chisinau', maxDays: 30, totalDays: 60 },
  now = new Date('2026-10-31T10:00:00Z');
test.each([
  ['2026-10-25', '2026-10-26', 25],
  ['2027-03-28', '2027-03-29', 23],
])('freeze %s→%s uses one local day despite a %i-hour day', (a, b, hours) => {
  expect(+schoolMidnight(b, policy.zone) - +schoolMidnight(a, policy.zone)).toBe(hours * 3600000);
  expect(daysBetween(a, b)).toBe(1);
  expect(addSchoolDays(schoolMidnight(a, policy.zone), 1, policy.zone)).toEqual(
    schoolMidnight(b, policy.zone),
  );
});
test('school midnight, leap dates and an exclusive resume boundary are enforced', () => {
  expect(localDay(new Date('2026-10-31T22:00:00Z'), policy.zone)).toBe('2026-11-01');
  expect(
    freezeDates('2026-10-31', '2026-11-01', new Date('2026-10-31T22:00:00Z'), 0, policy).error.code,
  ).toBe('INVALID_FREEZE_DATES');
  expect(freezeDates('2028-02-29', '2028-03-01', now, 0, policy).ok).toBe(true);
  expect(freezeDates('2027-02-29', '2027-03-01', now, 0, policy).ok).toBe(false);
});
test.each([
  ['2026-11-01', '2026-11-01'],
  ['2026-11-02', '2026-11-01'],
  ['2026-11-31', '2026-12-01'],
  ['2026-1-01', '2026-11-01'],
  ['2026-10-30', '2026-11-01'],
])('reject invalid local interval %s → %s', (a, b) =>
  expect(freezeDates(a, b, now, 0, policy).ok).toBe(false),
);
test('30/60 owner-approved limits reserve planned days and count actual accumulated days', () => {
  expect(freezeDates('2026-11-01', '2026-12-01', now, 30, policy).ok).toBe(true);
  expect(freezeDates('2026-11-01', '2026-12-02', now, 0, policy).error.code).toBe(
    'FREEZE_LIMIT_EXCEEDED',
  );
  expect(freezeDates('2026-11-01', '2026-11-12', now, 50, policy).error.code).toBe(
    'FREEZE_LIMIT_EXCEEDED',
  );
});
test('freeze limits are configuration, with invalid deployment settings rejected', () => {
  const keys = [
      'SUBSCRIPTION_MAX_FREEZE_DAYS',
      'SUBSCRIPTION_MAX_FREEZE_TOTAL_DAYS',
      'SCHOOL_TIMEZONE',
    ],
    old = keys.map((k) => process.env[k]);
  try {
    process.env.SUBSCRIPTION_MAX_FREEZE_DAYS = '2';
    process.env.SUBSCRIPTION_MAX_FREEZE_TOTAL_DAYS = '3';
    process.env.SCHOOL_TIMEZONE = 'Europe/Chisinau';
    expect(freezePolicy()).toEqual({ ok: true, value: { ...policy, maxDays: 2, totalDays: 3 } });
    process.env.SUBSCRIPTION_MAX_FREEZE_DAYS = 'NaN';
    expect(freezePolicy().ok).toBe(false);
    process.env.SUBSCRIPTION_MAX_FREEZE_DAYS = '2';
    process.env.SCHOOL_TIMEZONE = 'INVALID';
    expect(freezePolicy().ok).toBe(false);
  } finally {
    keys.forEach((k, i) => {
      if (old[i] === undefined) delete process.env[k];
      else process.env[k] = old[i];
    });
  }
});
test('published allocation proof reuses the existing ledger and preserves retryability', async () => {
  const id = randomUUID(),
    tx = { $queryRaw: jest.fn(async () => [{ id }]) };
  const publisher = new LedgerPublicationService({ authorize: jest.fn() });
  expect(await publisher.requirePublishedDistribution(tx, randomUUID(), now)).toEqual({
    ok: true,
    value: id,
  });
  const sql = tx.$queryRaw.mock.calls[0][0].join('?');
  expect(sql).toContain('correction_of_document_id');
  expect(sql).toContain('reverses_entry_id');
  expect(sql).not.toMatch(/INSERT|UPDATE|DELETE/);
  tx.$queryRaw.mockRejectedValueOnce(
    new Prisma.PrismaClientKnownRequestError('retry', { code: 'P2034', clientVersion: '7.10.1' }),
  );
  expect(await publisher.requirePublishedDistribution(tx, randomUUID(), now)).toEqual({
    ok: false,
    error: { code: 'RETRYABLE' },
  });
});
test('student read-model aggregates attached financial periods while finance gates remain per purchase', () => {
  const student = randomUUID();
  const studentSql = subscriptionFacts(student, {}, now).text;
  expect(studentSql).toContain('selected_periods');
  expect(studentSql).toContain('manager_subscription_periods sibling');
  expect(studentSql).toContain('sum(p.lesson_count)');
  expect(studentSql).toContain('JOIN selected_periods s ON s.id=g.subscription_id');
  const financeSql = subscriptionFacts(student, {}, now, { financialOnly: true }).text;
  expect(financeSql).not.toContain('manager_subscription_periods sibling');
});
test('migration preserves existing purchase snapshots and enforces distribution/enrollment uniqueness', async () => {
  const sql = await readFile(
    'packages/db/prisma/migrations/20261031120000_mgr04_managed_subscriptions/migration.sql',
    'utf8',
  );
  expect(sql).toContain('uq_mgr04_active_enrollment');
  expect(sql).toContain('ON manager_subscriptions(enrollment_id)');
  expect(sql).toContain('manager_subscription_operations(distribution_id)');
  expect(sql).not.toMatch(
    /UNIQUE[^;]*payment_id|UPDATE\s+(?:sale_conditions|subscriptions)\s+SET|CREATE OR REPLACE FUNCTION t03_guard_subscription_snapshot/,
  );
  expect(sql).toContain('actual_until:=coalesce(actual_until,OLD.frozen_until)');
  expect(sql).toContain("WHEN 'ACCOUNT_CREATED'");
  expect(sql).toContain("WHEN 'SUBSCRIPTION_CREATED'");
});
test('worker queues subscription notice and delivers once without price, comment or private data', async () => {
  const p = { studentId: randomUUID(), subscriptionId: randomUUID(), operationId: randomUUID() },
    now = new Date();
  const { tx, state } = standaloneNotificationStorage(p.studentId, now);
  tx.managerSubscriptionOperation = { findFirst: jest.fn(async () => ({ id: p.operationId })) };
  const event = {
    topic: 'manager.subscription.renewed.v1',
    source_operation_id: randomUUID(),
    payload: p,
    created_at: now,
  };
  expect((await ManagerSubscriptionNoticeHandler(tx, event, now)).ok).toBe(true);
  expect((await ManagerSubscriptionNoticeHandler(tx, event, now)).ok).toBe(true);
  expect(state.inbox.size).toBe(0);
  const delivery = state.outbox[0];
  expect((await notificationDeliveryHandler()(tx, delivery, now)).ok).toBe(true);
  expect((await notificationDeliveryHandler()(tx, delivery, now)).ok).toBe(true);
  expect(state.inbox.size).toBe(1);
  const inbox = [...state.inbox.values()];
  expect(inbox[0]).toMatchObject({
    type: 'SUBSCRIPTION_RENEWED',
    payload: { subscriptionId: p.subscriptionId, operationId: p.operationId },
  });
  expect(JSON.stringify(inbox)).not.toMatch(/price|comment|amount|managerId/);
});

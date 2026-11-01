import { expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { ESLint } from 'eslint';
import { Prisma } from '../../packages/db/dist/index.js';
import { ManagerScopeService } from '../../apps/api/dist/modules/manager/scope/manager-scope.service.js';
import {
  dashboardStudentsSql,
  dashboardLessonsSql,
  dashboardTasksSql,
  dashboardSubscriptionsSql,
} from '../../apps/api/dist/modules/manager/dashboard/dashboard.sql.js';
import { pendingReceiptTotalsSql } from '../../apps/api/dist/modules/finance/manager-payments/pending-totals.sql.js';
import {
  subscriptionSelectionSql,
  subscriptionFacts,
} from '../../apps/api/dist/student/subscription/subscription.sql.js';
import { studentCrmStatusSql } from '../../apps/api/dist/modules/manager/students/student-status.sql.js';
import {
  managedSubscriptionTotalsSql,
  subscriptionExpiryUntil,
  expiringSubscriptionSql,
} from '../../apps/api/dist/modules/finance/manager-subscriptions/read-spec.js';
import {
  schoolMidnight,
  localDay,
} from '../../apps/api/dist/modules/finance/manager-subscriptions/time.js';
import {
  taskOverdueWhere,
  taskOverdueSql,
  taskVisibleSql,
} from '../../apps/api/dist/modules/manager/tasks/task-read.spec.js';
import {
  receiptStatus,
  statusWhere,
  receiptStatusSql,
} from '../../apps/api/dist/modules/finance/manager-payments/receipt-read.spec.js';
import { TransactionService } from '../../apps/api/dist/core/transaction/transaction.service.js';
const normalized = (s) => s.replace(/\$\d+/g, '$p');
const now = new Date('2026-11-01T10:00:00Z'),
  ctx = { managerId: randomUUID() },
  scope = new ManagerScopeService({}).portfolioSql(ctx, now);
test.each([
  ['students', () => dashboardStudentsSql(scope, now)],
  ['lessons', () => dashboardLessonsSql(scope, now, new Date(+now + 48 * 3600000))],
  ['tasks', () => dashboardTasksSql(scope, now)],
  ['subscriptions', () => dashboardSubscriptionsSql(scope, now, subscriptionExpiryUntil(now, 7))],
  ['pending', () => pendingReceiptTotalsSql(scope, now)],
])(
  '%s query binds canonical portfolio and timestamp without raw inputs or writes',
  (name, build) => {
    const sql = build();
    expect(sql.values).toContain(ctx.managerId);
    expect(sql.values).toContain(now);
    expect(sql.text).toContain('am.student_id=st.id');
    expect(sql.text).not.toContain(ctx.managerId);
    expect(sql.text).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|FOR UPDATE)\b/);
  },
);
test('student status uses the exact MGR02/Student selection without expensive ledger joins', () => {
  const selection = subscriptionSelectionSql(Prisma.sql`st.id`, {}, now, { startedOnly: true }),
    query = dashboardStudentsSql(scope, now);
  expect(normalized(query.text)).toContain(normalized(selection.text));
  expect(
    subscriptionFacts(Prisma.sql`st.id`, {}, now, { startedOnly: true }).text.startsWith(
      selection.text,
    ),
  ).toBe(true);
  expect(normalized(query.text)).toContain(normalized(studentCrmStatusSql(now).text));
  expect(query.text).not.toMatch(/ledger_lines|skill_assessments|homework/);
});
test('shared overdue predicate is strict, public types only; damaged legacy references are guarded', () => {
  expect(taskOverdueWhere(now)).toEqual({
    due_at: { lt: now },
    status: { in: ['OPEN', 'IN_PROGRESS'] },
  });
  expect(taskOverdueSql(now).text).toContain('t.due_at<');
  const visible = taskVisibleSql();
  expect(visible.values).toEqual([
    'LEAD_FOLLOWUP',
    'ASSIGN_TEACHER',
    'RESCHEDULE_REQUEST',
    'ATTENDANCE_DISPUTE',
    'SUBSCRIPTION_EXPIRING',
    'MANUAL',
  ]);
  expect(visible.text).toContain('e.student_id=t.student_id');
  expect(visible.text).toContain('CASE WHEN');
  expect(dashboardTasksSql(scope, now).text).toContain('LIMIT 5');
});
test.each([
  ['2026-03-29', 23],
  ['2026-10-25', 25],
])('school calendar day crossing DST on%s is%s hours', (day, hours) => {
  const start = schoolMidnight(day, 'Europe/Chisinau'),
    end = subscriptionExpiryUntil(start, 1);
  expect((+end - +start) / 3600000).toBe(hours);
  expect(localDay(end, 'Europe/Chisinau')).not.toBe(day);
});
test('expiry query shares managed paid-right totals and the ACTIVE open/closed time window', () => {
  const until = subscriptionExpiryUntil(now, 7),
    sql = dashboardSubscriptionsSql(scope, now, until),
    totals = managedSubscriptionTotalsSql(Prisma.sql`ms.id`, now);
  expect(normalized(sql.text)).toContain(normalized(totals.text));
  expect(expiringSubscriptionSql(now, until).text).toMatch(
    /ms.status='ACTIVE'.*ms.ends_at>.*ms.ends_at<=/s,
  );
  expect(sql.text).toContain('LIMIT 10');
  expect(sql.text).not.toContain('FOR UPDATE');
});
test('pending status shares MGR05 projection/filter, counts only positive unallocated money and protects family scope', () => {
  const base = {
    rejected_at: null,
    confirmed_by_director_at: null,
    approval_requested_at: null,
    t03_ledgerdocument_payment_id: null,
  };
  expect(receiptStatus(base)).toBe('PENDING');
  expect(receiptStatus({ ...base, approval_requested_at: now })).toBe('AWAITING_APPROVAL');
  expect(
    receiptStatus({
      ...base,
      confirmed_by_director_at: now,
      t03_ledgerdocument_payment_id: { t03_ledgerentry_document_id: { published_at: now } },
    }),
  ).toBe('CONFIRMED');
  expect(statusWhere('PENDING')).toMatchObject({
    confirmed_by_director_at: null,
    rejected_at: null,
  });
  const q = pendingReceiptTotalsSql(scope, now);
  expect(normalized(q.text)).toContain(normalized(receiptStatusSql(now).text));
  expect(q.text).toContain("line.account_type='UNALLOCATED_FUNDS'");
  expect(q.text).toContain('d.correction_of_document_id');
  expect(q.text).toContain('child.student_id');
  expect(q.text).toContain('sum(amount)::text');
  expect(q.text).not.toMatch(/remainingLessons|CUSTOMER_ADVANCE/);
});
test('core read-only transaction fixes isolation before reads and propagates Result failure without retry or commit', async () => {
  const commands = [],
    error = { code: 'CUSTOM_ERROR', status: 503, message: 'CUSTOM_ERROR' },
    tx = { $executeRaw: jest.fn(async (parts) => commands.push(parts.join(''))) },
    db = {
      client: {
        $transaction: jest.fn(async (fn, options) => {
          commands.push(options.timeout);
          return fn(tx);
        }),
      },
    },
    service = new TransactionService(db);
  const result = await service.runReadOnly(async (t) => {
    expect(t).toBe(tx);
    commands.push('read');
    return { ok: false, error };
  });
  expect(result).toEqual({ ok: false, error });
  expect(commands).toEqual([
    15000,
    'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY',
    'read',
  ]);
  expect(db.client.$transaction).toHaveBeenCalledTimes(1);
});
test('raw SQL exception is limited to dashboard/students read boundaries, not arbitrary manager services', async () => {
  const eslint = new ESLint(),
    probe = 'class Probe { async read(tx: any, sql: any) { return tx.$queryRaw(sql); } }';
  for (const [file, allowed] of [
    ['dashboard/dashboard.read.ts', true],
    ['dashboard/manager-dashboard.service.ts', false],
  ]) {
    const [{ messages }] = await eslint.lintText(probe, {
      filePath: `apps/api/src/modules/manager/${file}`,
    });
    expect(messages.some((m) => m.ruleId === 'manager/no-protected-writes')).toBe(!allowed);
  }
});

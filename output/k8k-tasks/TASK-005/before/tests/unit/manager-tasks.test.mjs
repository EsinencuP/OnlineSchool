import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { ESLint } from 'eslint';
import { UUID } from '../../apps/api/dist/core/http.js';
import {
  readTaskCursor,
  writeTaskCursor,
} from '../../apps/api/dist/modules/manager/tasks/task-cursor.js';
import { disputeOperationId } from '../../apps/api/dist/modules/finance/manager-disputes/dispute.service.js';
import { StudentCrmTaskService } from '../../apps/api/dist/student/lessons/student-crm-task.service.js';
import { StudentHistoryService } from '../../apps/api/dist/student/history/history.service.js';
test('task cursor is opaque, manager/filter-bound and expires after30 minutes', () => {
  const prior = process.env.MANAGER_CURSOR_SECRET;
  process.env.MANAGER_CURSOR_SECRET = 'task-cursor-test-secret-at-least-32-bytes';
  try {
    const ctx = { managerId: randomUUID() },
      q = { limit: 25, type: ['GENERAL'] },
      now = new Date('2026-11-01T10:00:00Z'),
      id = randomUUID(),
      dueAt = new Date(+now + 86400000);
    const token = writeTaskCursor(ctx, q, { now }, id, dueAt);
    expect(token.ok).toBe(true);
    expect(token.value.length).toBeLessThanOrEqual(200);
    expect(token.value).not.toContain(id);
    expect(readTaskCursor(ctx, { ...q, cursor: token.value }, now).value).toEqual({
      id,
      dueAt,
      now,
    });
    for (const [who, query, time] of [
      [{ managerId: randomUUID() }, { ...q, cursor: token.value }, now],
      [ctx, { ...q, type: ['CHARGE_DISPUTE'], cursor: token.value }, now],
      [ctx, { ...q, cursor: token.value }, new Date(+now + 1800001)],
      [ctx, { ...q, cursor: token.value.slice(0, -2) + 'AA' }, now],
    ])
      expect(readTaskCursor(who, query, time).error.code).toBe('INVALID_CURSOR');
  } finally {
    if (prior === undefined) delete process.env.MANAGER_CURSOR_SECRET;
    else process.env.MANAGER_CURSOR_SECRET = prior;
  }
});
test('dispute publication operation derives from the task, not the caller command key', () => {
  const id = randomUUID();
  expect(UUID.test(disputeOperationId(id))).toBe(true);
  expect(disputeOperationId(id)).toBe(disputeOperationId(id));
  expect(disputeOperationId(randomUUID())).not.toBe(disputeOperationId(id));
});
test('student producer binds the exact consumption and sets a24-hour deadline', async () => {
  const now = new Date('2026-11-01T10:00:00Z'),
    original = randomUUID(),
    student = randomUUID(),
    manager = randomUUID(),
    create = jest.fn(async ({ data }) => ({ id: randomUUID(), ...data })),
    ctx = {
      actor: { accountId: randomUUID() },
      operationId: randomUUID(),
      tx: {
        assignedManager: { findFirst: jest.fn(async () => ({ manager_id: manager })) },
        crmTask: { create },
      },
    };
  await new StudentCrmTaskService().create(
    ctx,
    {
      studentProfileId: student,
      lessonId: randomUUID(),
      type: 'ATTENDANCE_DISPUTE',
      originalConsumptionId: original,
      payload: { description: 'Please review' },
    },
    now,
  );
  expect(create.mock.calls[0][0].data).toMatchObject({
    original_consumption_id: original,
    due_at: new Date(+now + 86400000),
    assigned_manager_id: manager,
  });
});
test('student history can display a charged cancellation without inventing a conducted/no-show report', async () => {
  const row = {
    id: randomUUID(),
    scheduled_at: new Date(),
    duration_minutes: 60,
    teacher_name: 'Teacher',
    subject_name: 'Math',
    attendance_status: 'CANCELLED',
    consumption_id: randomUUID(),
    balance_before: '8',
    balance_after: '7',
    can_dispute: true,
    total: 1,
  };
  const history = new StudentHistoryService({ client: { $queryRaw: jest.fn(async () => [row]) } });
  const r = await history.list({ studentProfileId: randomUUID() }, { page: 1, pageSize: 20 });
  expect(r.value.items[0]).toMatchObject({
    attendanceStatus: 'CANCELLED',
    lessonDeducted: true,
    canDispute: true,
  });
});
test('migration protects source identity, task versions and one matching published reversal', async () => {
  const sql = await readFile(
    'packages/db/prisma/migrations/20261101090000_mgr07_crm_tasks/migration.sql',
    'utf8',
  );
  expect(sql).toContain('ledger_publication_id uuid UNIQUE');
  expect(sql).toContain("dispute_resolution_key='dispute:'||id::text");
  expect(sql).toContain('NEW.version<>OLD.version+1');
  expect(sql).toContain('Closed CRM task is immutable');
  expect(sql).toContain('reversal.published_at IS NOT NULL');
  expect(sql).not.toMatch(/UPDATE crm_tasks SET|DELETE FROM|TRUNCATE/);
});
const eslint = new ESLint();
test('Finance dispute writer cannot be imported directly into another manager service', async () => {
  const [{ messages }] = await eslint.lintText(
    "import { DisputeFinanceService } from '../../finance/manager-disputes/dispute.service.js';",
    { filePath: 'apps/api/src/modules/manager/tasks/probe.ts' },
  );
  expect(messages.some((m) => m.ruleId === 'manager/finance-facade-only')).toBe(true);
});
test('refundLessons is an integer quantity while numeric refundAmount still fails INV05', async () => {
  for (const [name, expected] of [
    ['refundLessons', false],
    ['refundAmount', true],
  ]) {
    const [{ messages }] = await eslint.lintText(`class Proposal { ${name}!: number; }`, {
      filePath: 'apps/api/src/modules/manager/tasks/probe.ts',
    });
    expect(messages.some((m) => m.ruleId === 'manager/no-money-number')).toBe(expected);
  }
});

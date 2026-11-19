import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { PeriodsService } from '../../apps/api/dist/modules/finance/periods.service.js';
import { periodDisputesRevision } from '../../apps/api/dist/modules/finance/period-disputes.js';

function fixture() {
  const now = new Date('2026-11-17T09:00:00.000Z');
  const period = {
    id: randomUUID(),
    starts_at: new Date('2026-10-01T00:00:00.000Z'),
    ends_at: new Date('2026-11-01T00:00:00.000Z'),
    closed_at: null,
  };
  const report = {
    lesson_id: randomUUID(),
    report_id: randomUUID(),
    task_id: null,
    source_entry_id: null,
    manager_id: randomUUID(),
    source_version: 2,
    status_at_close: 'DISPUTED',
  };
  const blockers = { lessons: 0, attempts: 0, drafts: 0 };
  const rows = [report];
  const tx = {
    $queryRaw: jest.fn(async (value) => {
      const sql = value.text ?? value.join('?');
      if (sql.includes('clock_timestamp')) return [{ now }];
      if (sql.includes('WITH matched_charges')) return [blockers];
      if (sql.includes('AS status_at_close')) return rows;
      return [{ id: period.id }];
    }),
    financialPeriod: {
      findUnique: jest.fn(async () => period),
      update: jest.fn(async ({ data }) => ({ ...period, ...data })),
    },
    financialPeriodDispute: { createMany: jest.fn() },
  };
  const staff = randomUUID();
  const access = { staff: jest.fn(async () => staff) };
  const service = new PeriodsService(access, {});
  const ctx = { tx, operationId: randomUUID() };
  return { now, period, report, blockers, rows, tx, staff, access, service, ctx };
}

test('closure requires the reviewed register and records the immutable sources before closing', async () => {
  const { service, ctx, period, report, rows, tx, now, staff, access } = fixture();
  const revision = periodDisputesRevision(period.id, rows);
  const result = await service.close(ctx, period.id, { disputesRevision: revision });
  expect(access.staff).toHaveBeenCalledWith(ctx, true);
  expect(result).toMatchObject({ closed_at: now, closed_by_id: staff });
  expect(tx.financialPeriodDispute.createMany).toHaveBeenCalledWith({
    data: [{ ...report, period_id: period.id, registered_at: now }],
  });
  expect(tx.financialPeriodDispute.createMany.mock.invocationCallOrder[0]).toBeLessThan(
    tx.financialPeriod.update.mock.invocationCallOrder[0],
  );
});

test('closure rejects missing and stale revisions before writing', async () => {
  const { service, ctx, period, rows, report, tx } = fixture();
  await expect(service.close(ctx, period.id, {})).rejects.toMatchObject({
    domain: { code: 'PERIOD_DISPUTES_CONFIRMATION_REQUIRED' },
  });
  const revision = periodDisputesRevision(period.id, rows);
  report.manager_id = randomUUID();
  await expect(service.close(ctx, period.id, { disputesRevision: revision })).rejects.toMatchObject(
    {
      domain: { code: 'PERIOD_DISPUTES_CHANGED' },
    },
  );
  expect(tx.financialPeriodDispute.createMany).not.toHaveBeenCalled();
  expect(tx.financialPeriod.update).not.toHaveBeenCalled();
});

test.each([
  ['lessons', 'PERIOD_HAS_UNRESOLVED_FACTS'],
  ['attempts', 'PERIOD_HAS_UNRESOLVED_FACTS'],
  ['drafts', 'PERIOD_HAS_DRAFT_ENTRIES'],
])('confirmed dispute register cannot bypass %s blockers', async (kind, code) => {
  const { service, ctx, period, rows, blockers, tx } = fixture();
  blockers[kind] = 1;
  const revision = periodDisputesRevision(period.id, rows);
  await expect(service.close(ctx, period.id, { disputesRevision: revision })).rejects.toMatchObject(
    {
      domain: { code },
    },
  );
  expect(tx.financialPeriodDispute.createMany).not.toHaveBeenCalled();
  expect(tx.financialPeriod.update).not.toHaveBeenCalled();
});

test('an ordinary closure without disputes still accepts an empty body', async () => {
  const { service, ctx, period, rows, tx, now } = fixture();
  rows.length = 0;
  expect(await service.close(ctx, period.id, {})).toMatchObject({ closed_at: now });
  expect(tx.financialPeriodDispute.createMany).not.toHaveBeenCalled();
});

import { expect, test } from '@jest/globals';
import {
  assessRecoveryReport,
  inspectRecoveryDatabase,
} from '../../apps/api/scripts/database-recovery-audit.mjs';

const checkedAt = '2026-11-18T10:00:00.000Z';
const migrationVersion = '20261116140000_mgr_family_requests';
const digest = 'a'.repeat(64);

function report() {
  return {
    format: 1,
    checkedAt,
    migrationVersion,
    checks: { LEDGER_UNBALANCED: 0, PAID_RIGHTS_NEGATIVE: 0 },
    datasets: { ledger_entries: { rows: 10, digest }, lesson_occurrences: { rows: 15, digest } },
  };
}

function database(overrides = {}) {
  const statements = [];
  return {
    statements,
    async $transaction(callback) {
      return callback({
        async $executeRaw(parts) {
          statements.push(parts.join(''));
        },
        async $queryRaw(query) {
          const sql = Array.isArray(query) ? query.join('') : query.text;
          statements.push(sql);
          if (sql.includes('current_setting')) {
            return [
              {
                checked_at: new Date(checkedAt),
                migration_version: migrationVersion,
                read_only: true,
                server_version: 180007,
                ...overrides,
              },
            ];
          }
          if (sql.includes('ADMISSION_CAPACITY_EXCEEDED')) {
            return [
              {
                checks: { ADMISSION_CAPACITY_EXCEEDED: 0 },
                datasets: { lesson_admission_starts: { rows: 1, digest } },
              },
            ];
          }
          const { checks, datasets } = report();
          return [{ checks, datasets, payload: 'metadata that should never reach the report' }];
        },
      });
    },
  };
}

test('reads the full backup audit from a consistent PostgreSQL 18 snapshot', async () => {
  const db = database();
  await expect(inspectRecoveryDatabase(db)).resolves.toEqual(report());
  expect(db.statements).toEqual([
    'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY',
    "SET LOCAL statement_timeout = '15000ms'",
    "SET LOCAL TIME ZONE 'UTC'",
    'SET LOCAL row_security = off',
    expect.stringContaining("current_setting('transaction_read_only')"),
    expect.stringContaining('ORDER BY r.id'),
  ]);
  expect(db.statements.at(-1)).toMatch(/SELECT[\s\S]+AS checks,[\s\S]+AS datasets;/);
});

test('recovery after the admission migration compares saved start records in the same snapshot', async () => {
  const db = database({ migration_version: '20261118160000_lesson_admission_starts' });
  await expect(inspectRecoveryDatabase(db)).resolves.toMatchObject({
    checks: { LEDGER_UNBALANCED: 0, ADMISSION_CAPACITY_EXCEEDED: 0 },
    datasets: { lesson_admission_starts: { rows: 1, digest } },
  });
  expect(db.statements.at(-1)).toContain('ADMISSION_START_OUTCOME_MISMATCH');
});

test.each([{ read_only: false }, { server_version: 170008 }])(
  'stops before reading any recovery data when the database reports %p',
  async (overrides) => {
    const db = database(overrides);
    await expect(inspectRecoveryDatabase(db)).rejects.toThrow('RECOVERY_AUDIT_DATABASE_INVALID');
    expect(db.statements).toHaveLength(5);
  },
);

test('a baseline is distinct from a successful comparison against a protected checkpoint', () => {
  const checkpoint = report();
  expect(assessRecoveryReport(checkpoint)).toMatchObject({ status: 'INVARIANTS_OK' });
  expect(
    assessRecoveryReport({ ...report(), checkedAt: '2026-11-19T10:00:00.000Z' }, checkpoint),
  ).toMatchObject({
    status: 'CHECKPOINT_MATCH',
    schemaMatches: true,
    changedDatasets: [],
    changedChecks: [],
  });
});

test('detects changed data at the same row count, omitted datasets and a different migration', () => {
  const restored = report();
  restored.migrationVersion = '20261116150000_dir04_staff_lifecycle';
  restored.datasets.ledger_entries.digest = 'b'.repeat(64);
  delete restored.datasets.lesson_occurrences;
  delete restored.checks.PAID_RIGHTS_NEGATIVE;
  expect(assessRecoveryReport(restored, report())).toMatchObject({
    status: 'CHECKPOINT_MISMATCH',
    schemaMatches: false,
    changedDatasets: ['ledger_entries', 'lesson_occurrences'],
    changedChecks: ['PAID_RIGHTS_NEGATIVE'],
  });
});

test('detects missing records and gives invariant violations priority over checkpoint comparisons', () => {
  const restored = report();
  restored.datasets.ledger_entries.rows -= 1;
  restored.checks.LEDGER_UNBALANCED = 1;
  expect(assessRecoveryReport(restored)).toMatchObject({ status: 'INVARIANTS_FAILED' });
  expect(assessRecoveryReport(restored, report())).toMatchObject({
    status: 'INVARIANTS_FAILED',
    changedDatasets: ['ledger_entries'],
    changedChecks: ['LEDGER_UNBALANCED'],
  });
});

test('rejects invalid and failing checkpoints', () => {
  const malformed = report();
  malformed.datasets.ledger_entries.digest = 'invalid';
  const failed = report();
  failed.checks.LEDGER_UNBALANCED = 1;
  for (const checkpoint of [malformed, failed, { ...report(), datasets: {} }, null]) {
    expect(() => assessRecoveryReport(report(), checkpoint)).toThrow('RECOVERY_CHECKPOINT_INVALID');
  }
});

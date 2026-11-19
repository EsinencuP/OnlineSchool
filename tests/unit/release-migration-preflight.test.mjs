import { expect, test } from '@jest/globals';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  checkReleaseMigrations,
  compareMigrationHistory,
  inspectMigrationHistory,
  parseDatabaseTarget,
  readSourceMigrations,
} from '../../infra/vercel/migration-preflight.mjs';

const first = '20261026020000_init';
const failed = '20261116150000_dir04_staff_lifecycle';
const next = '20261117100000_ops02_period_disputes';
const source = [first, failed, next].map((name) => ({ name, checksums: new Set([name]) }));

function applied(name, checksum = name) {
  return { migration_name: name, checksum, finished: true, rolled_back: false };
}

test('the failed release stops even if its source SQL has been corrected', () => {
  const unfinished = { ...applied(failed, 'old'), finished: false };
  expect(compareMigrationHistory(source, [applied(first), unfinished])).toEqual({
    status: 'BLOCKED',
    code: 'UNFINISHED_MIGRATION',
    migration: failed,
  });
});

test('a retired failed attempt can coexist with its successful retry', () => {
  const retired = { ...applied(failed, 'old'), finished: false, rolled_back: true };
  const history = [applied(first), retired, applied(failed)];
  expect(compareMigrationHistory(source, history)).toEqual({
    status: 'PENDING',
    migration: next,
    applied: 2,
    expected: 3,
  });
  expect(compareMigrationHistory(source, history, true)).toEqual({
    status: 'BLOCKED',
    code: 'MIGRATIONS_PENDING',
    migration: next,
    applied: 2,
    expected: 3,
  });
  expect(compareMigrationHistory(source, [...history, applied(next)], true)).toEqual({
    status: 'CURRENT',
    applied: 3,
    expected: 3,
  });
});

test.each([
  ['MIGRATION_GAP', [applied(first), applied(next)], failed],
  ['DUPLICATE_MIGRATION', [applied(first), applied(first)], first],
  ['CHECKSUM_MISMATCH', [applied(first, 'modified')], first],
  ['UNKNOWN_MIGRATION', [applied('20261118140000_unknown')], '20261118140000_unknown'],
])('active migration history rejects %s', (code, history, migration) => {
  expect(compareMigrationHistory(source, history)).toEqual({ status: 'BLOCKED', code, migration });
});

test('applied source checksums accept both supported checkout line endings', async () => {
  const migrations = await readSourceMigrations();
  expect(migrations[0].name).toBe(first);
  const sourceFile = new URL(
    `../../packages/db/prisma/migrations/${first}/migration.sql`,
    import.meta.url,
  );
  const lf = (await readFile(sourceFile, 'utf8')).replaceAll('\r\n', '\n');
  for (const sql of [lf, lf.replaceAll('\n', '\r\n')]) {
    const checksum = createHash('sha256').update(sql).digest('hex');
    expect(compareMigrationHistory(migrations, [applied(first, checksum)])).toMatchObject({
      status: 'PENDING',
      applied: 1,
    });
  }
});

function database(metadata = {}, history = [applied(first)]) {
  const statements = [];
  const target = {
    database: 'online_school',
    server_version: 180007,
    read_only: true,
    has_history: true,
    ...metadata,
  };
  return {
    statements,
    async $transaction(check) {
      async function query(parts) {
        const sql = parts.join('');
        statements.push(sql);
        return sql.includes('current_database()') ? [target] : history;
      }
      return check({ $executeRaw: query, $queryRaw: query });
    },
  };
}

test('queries a consistent read-only snapshot of the public migration table', async () => {
  const db = database();
  await expect(inspectMigrationHistory(db, 'online_school', source)).resolves.toMatchObject({
    status: 'PENDING',
    migration: failed,
  });
  expect(db.statements).toEqual([
    'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY',
    "SET LOCAL statement_timeout = '4000ms'",
    expect.stringContaining('current_database()'),
    expect.stringContaining('FROM public._prisma_migrations'),
  ]);
});

test.each([
  ['UNEXPECTED_DATABASE', { database: 'wrong_db' }],
  ['UNEXPECTED_DATABASE', { read_only: false }],
  ['UNSUPPORTED_POSTGRES', { server_version: 170007 }],
  ['MIGRATION_HISTORY_MISSING', { has_history: false }],
])('stops before reading migration rows on %s', async (code, metadata) => {
  const db = database(metadata);
  await expect(inspectMigrationHistory(db, 'online_school', source)).resolves.toEqual({
    status: 'BLOCKED',
    code,
  });
  expect(db.statements).toHaveLength(3);
});

test('the release gate requires at least one applied migration in the registry', async () => {
  for (const history of [[], [{ ...applied(first), finished: false, rolled_back: true }]]) {
    await expect(
      inspectMigrationHistory(database({}, history), 'online_school', source),
    ).resolves.toEqual({ status: 'BLOCKED', code: 'MIGRATION_HISTORY_EMPTY' });
  }
});

test('diagnostics omit malformed credentials and unexpected values from database rows', async () => {
  const marker = 'sensitive\nvalue';
  await expect(checkReleaseMigrations(marker)).resolves.toEqual({
    status: 'BLOCKED',
    code: 'DIRECT_DATABASE_URL_INVALID',
  });
  expect(compareMigrationHistory(source, [applied(marker)])).toEqual({
    status: 'BLOCKED',
    code: 'UNKNOWN_MIGRATION',
  });
});

test('database target uses decoded identifiers and the public schema', () => {
  expect(
    parseDatabaseTarget('postgresql://%6Fwner:test@db.example/school%5Fdb?schema=public'),
  ).toEqual({
    hostname: 'db.example',
    port: '5432',
    database: 'school_db',
    username: 'owner',
  });
  expect(
    parseDatabaseTarget('postgresql://owner:test@db.example/school?schema=private'),
  ).toBeUndefined();
});

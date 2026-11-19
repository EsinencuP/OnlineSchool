import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const migrationRoot = new URL('../../packages/db/prisma/migrations/', import.meta.url);
const migrationName = /^\d{14}_[a-z0-9_]+$/;

export function parseDatabaseTarget(value) {
  try {
    const url = new URL(value);
    const database = decodeURIComponent(url.pathname.slice(1));
    const username = decodeURIComponent(url.username);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) return undefined;
    if (!database || database.includes('/') || !username || !url.password) return undefined;
    if (url.searchParams.getAll('schema').some((schema) => schema !== 'public')) return undefined;
    return { hostname: url.hostname, port: url.port || '5432', database, username };
  } catch {
    return undefined;
  }
}

function checksum(sql) {
  return createHash('sha256').update(sql).digest('hex');
}

function sourceMigration(name, sql) {
  // Prisma accepts the original checksum as well as LF/CRLF checkout variants.
  const lf = sql.toString('utf8').replaceAll('\r\n', '\n');
  return {
    name,
    checksums: new Set([checksum(sql), checksum(lf), checksum(lf.replaceAll('\n', '\r\n'))]),
  };
}

export async function readSourceMigrations(root = migrationRoot) {
  const entries = await readdir(root, { withFileTypes: true });
  const names = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (names.length === 0 || names.some((name) => !migrationName.test(name))) {
    throw new Error('Invalid source migration directory');
  }
  return Promise.all(
    names.map(async (name) => {
      const sql = await readFile(new URL(`${name}/migration.sql`, root));
      return sourceMigration(name, sql);
    }),
  );
}

function blocked(code, name) {
  const result = { status: 'BLOCKED', code };
  // Never include an unchecked value read from the server in release logs.
  if (typeof name === 'string' && migrationName.test(name)) result.migration = name;
  return result;
}

export function compareMigrationHistory(source, history, expectCurrent = false) {
  const applied = new Map();
  for (const row of history) {
    if (row.rolled_back) continue;
    if (!row.finished) return blocked('UNFINISHED_MIGRATION', row.migration_name);
    if (applied.has(row.migration_name)) return blocked('DUPLICATE_MIGRATION', row.migration_name);
    applied.set(row.migration_name, row.checksum);
  }
  if (applied.size === 0) return blocked('MIGRATION_HISTORY_EMPTY');

  const known = new Set(source.map(({ name }) => name));
  for (const name of applied.keys()) {
    if (!known.has(name)) return blocked('UNKNOWN_MIGRATION', name);
  }

  for (const { name, checksums } of source.slice(0, applied.size)) {
    if (!applied.has(name)) return blocked('MIGRATION_GAP', name);
    if (!checksums.has(applied.get(name))) return blocked('CHECKSUM_MISMATCH', name);
  }

  const counts = { applied: applied.size, expected: source.length };
  const next = source[applied.size];
  if (!next) return { status: 'CURRENT', ...counts };
  if (expectCurrent) return { ...blocked('MIGRATIONS_PENDING', next.name), ...counts };
  return { status: 'PENDING', migration: next.name, ...counts };
}

export async function inspectMigrationHistory(db, database, source, expectCurrent = false) {
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY`;
      await tx.$executeRaw`SET LOCAL statement_timeout = '4000ms'`;
      const [target] = await tx.$queryRaw`SELECT
      current_database() AS database,
      current_setting('server_version_num')::int AS server_version,
      current_setting('transaction_read_only') = 'on' AS read_only,
      to_regclass('public._prisma_migrations') IS NOT NULL AS has_history`;
      if (!target?.read_only || target.database !== database) return blocked('UNEXPECTED_DATABASE');
      if (Math.floor(target.server_version / 10_000) !== 18) return blocked('UNSUPPORTED_POSTGRES');
      if (!target.has_history) return blocked('MIGRATION_HISTORY_MISSING');
      const history = await tx.$queryRaw`SELECT migration_name, checksum,
      finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back
      FROM public._prisma_migrations ORDER BY started_at, id`;
      return compareMigrationHistory(source, history, expectCurrent);
    },
    { maxWait: 5_000, timeout: 10_000 },
  );
}

export async function checkReleaseMigrations(connectionString, expectCurrent = false) {
  if (!connectionString?.trim()) return blocked('DIRECT_DATABASE_URL_MISSING');
  const target = parseDatabaseTarget(connectionString);
  if (!target || target.hostname.includes('-pooler.'))
    return blocked('DIRECT_DATABASE_URL_INVALID');

  let source;
  try {
    source = await readSourceMigrations();
  } catch {
    return blocked('MIGRATION_SOURCE_UNAVAILABLE');
  }

  let db;
  try {
    const { createDirectClient } = await import('../../packages/db/dist/index.js');
    const connection = createDirectClient({ DIRECT_URL: connectionString });
    if (!connection.ok) return blocked(connection.error.code);
    db = connection.value;
    return await inspectMigrationHistory(db, target.database, source, expectCurrent);
  } catch {
    return blocked('MIGRATION_HISTORY_UNAVAILABLE');
  } finally {
    await db?.$disconnect().catch(() => undefined);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const result =
    args.length === 0 || (args.length === 1 && args[0] === '--expect-current')
      ? await checkReleaseMigrations(process.env.DIRECT_DATABASE_URL, args.length === 1)
      : blocked('INVALID_ARGUMENTS');
  console.log(JSON.stringify(result));
  if (result.status === 'BLOCKED') process.exitCode = 1;
}

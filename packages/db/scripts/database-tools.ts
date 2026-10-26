import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createDirectClient } from '@online-school/db';
import type { PrismaClient } from '@online-school/db';
import { err, ok } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import { databaseTarget, qaTarget } from './database-targets.js';
import type { DatabaseTarget, DatabaseToolError } from './database-targets.js';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
type Route = 'current' | 'legacy';
type Migration = {
  migration_name: string;
  checksum: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
};

async function prisma(args: string[], url: string): Promise<Result<undefined, DatabaseToolError>> {
  return new Promise((done) => {
    const child = spawn(
      process.execPath,
      [resolve(packageRoot, 'node_modules/prisma/build/index.js'), ...args],
      {
        cwd: packageRoot,
        env: { ...process.env, DIRECT_URL: url },
        stdio: ['ignore', 'inherit', 'inherit'],
        windowsHide: true,
      },
    );
    child.once('error', () => done(err({ code: 'PRISMA_COMMAND_FAILED' })));
    child.once('exit', (code) =>
      done(code === 0 ? ok(undefined) : err({ code: 'PRISMA_COMMAND_FAILED' })),
    );
  });
}

async function inspect(
  client: PrismaClient,
  mode: 'dry-run' | 'up' | 'reset-qa',
  target: DatabaseTarget,
): Promise<Result<Route, DatabaseToolError>> {
  const server = await client.$queryRaw<{ database: string; version: number }[]>`
    SELECT current_database() AS database, current_setting('server_version_num')::int AS version
  `;
  if (server[0]?.database !== target.database) return err({ code: 'DATABASE_IDENTITY_MISMATCH' });
  if (Math.floor((server[0]?.version ?? 0) / 10000) !== 18)
    return err({ code: 'POSTGRESQL_18_REQUIRED' });
  if (mode === 'reset-qa') return ok('current');
  const tables = await client.$queryRaw<
    { tablename: string }[]
  >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;
  if (mode === 'dry-run')
    return tables.length === 0 ? ok('current') : err({ code: 'REHEARSAL_REQUIRES_EMPTY_DATABASE' });
  if (!tables.some((table) => table.tablename === '_prisma_migrations'))
    return err({ code: 'STAGING_MIGRATION_HISTORY_REQUIRED' });
  const history = await client.$queryRaw<
    Migration[]
  >`SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY started_at`;
  if (history.some((item) => !item.finished_at && !item.rolled_back_at))
    return err({ code: 'FAILED_MIGRATION_PRESENT' });
  const applied = history.filter((item) => item.finished_at && !item.rolled_back_at);
  const current = applied.some((item) => item.migration_name === '20261026020000_init');
  const legacy = applied.some(
    (item) => item.migration_name === '20261025210404_task02_identity_access_crm',
  );
  if (current === legacy) return err({ code: 'MIGRATION_CHAIN_UNKNOWN' });
  const route = current ? 'current' : 'legacy';
  for (const item of applied) {
    if (!/^\d{14}_[a-z0-9_]+$/.test(item.migration_name))
      return err({ code: 'MIGRATION_CHAIN_UNKNOWN' });
    const sql = await readFile(
      resolve(
        packageRoot,
        'prisma',
        route === 'current' ? 'migrations' : 'migrations-history',
        item.migration_name,
        'migration.sql',
      ),
    );
    if (createHash('sha256').update(sql).digest('hex') !== item.checksum)
      return err({ code: 'MIGRATION_CHECKSUM_MISMATCH' });
  }
  if (tables.some((table) => table.tablename === 'lesson_occurrences')) {
    const overlaps = await client.$queryRaw<{ id: string }[]>`
      SELECT a.id FROM lesson_occurrences a JOIN lesson_occurrences b
        ON a.id<b.id AND a.scheduled_teacher_id=b.scheduled_teacher_id
        AND a.status<>'CANCELLED' AND b.status<>'CANCELLED'
        AND tstzrange(a.scheduled_at,a.scheduled_end_at,'[)') && tstzrange(b.scheduled_at,b.scheduled_end_at,'[)') LIMIT 1
    `;
    if (overlaps.length) return err({ code: 'STAGING_CALENDAR_OVERLAPS' });
  }
  if (tables.some((table) => table.tablename === 'payment_distributions')) {
    const duplicates = await client.$queryRaw<{ payment_id: string }[]>`
      SELECT payment_id FROM payment_distributions GROUP BY payment_id,subscription_id HAVING count(*)>1 LIMIT 1
    `;
    if (duplicates.length) return err({ code: 'STAGING_DUPLICATE_PAYMENT_DISTRIBUTIONS' });
  }
  if (tables.some((table) => table.tablename === 'ledger_entries')) {
    const reversals = await client.$queryRaw<{ reverses_entry_id: string }[]>`
      SELECT reverses_entry_id FROM ledger_entries WHERE reverses_entry_id IS NOT NULL
      GROUP BY reverses_entry_id HAVING count(*)>1 LIMIT 1
    `;
    if (reversals.length) return err({ code: 'STAGING_DUPLICATE_LEDGER_REVERSALS' });
  }
  if (tables.some((table) => table.tablename === 'teacher_availabilities')) {
    const overlaps = await client.$queryRaw<{ id: string }[]>`
      SELECT a.id FROM teacher_availabilities a JOIN teacher_availabilities b
      ON a.id<b.id AND a.teacher_id=b.teacher_id AND a.cancelled_at IS NULL AND b.cancelled_at IS NULL
      AND tstzrange(a.starts_at,a.ends_at,'[)') && tstzrange(b.starts_at,b.ends_at,'[)') LIMIT 1
    `;
    if (overlaps.length) return err({ code: 'STAGING_AVAILABILITY_OVERLAPS' });
    const duplicates = await client.$queryRaw<{ recurring_slot_id: string }[]>`
      SELECT l.recurring_slot_id FROM lesson_occurrences l JOIN recurring_slots s ON s.id=l.recurring_slot_id
      GROUP BY l.recurring_slot_id,(l.original_scheduled_at AT TIME ZONE s.timezone)::date
      HAVING count(*)>1 LIMIT 1
    `;
    if (duplicates.length) return err({ code: 'STAGING_DUPLICATE_SLOT_DAY' });
  }
  return ok(route);
}

export async function databaseOperation(
  mode: string,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<Result<{ mode: string; route: Route }, DatabaseToolError>> {
  if (!['dry-run', 'up', 'reset-qa'].includes(mode))
    return err({ code: 'DATABASE_OPERATION_UNKNOWN' });
  if (environment.APP_ENV === 'production')
    return err({ code: 'STAGING_QA_OPERATION_IN_PRODUCTION_FORBIDDEN' });
  const target =
    mode === 'reset-qa'
      ? qaTarget(environment, true)
      : databaseTarget(
          mode === 'dry-run'
            ? environment.MIGRATION_TEST_DATABASE_URL
            : environment.STAGING_DATABASE_URL,
        );
  if (!target.ok) return target;
  const connection = createDirectClient({ DIRECT_URL: target.value.url });
  if (!connection.ok) return err({ code: connection.error.code });
  let route: Result<Route, DatabaseToolError>;
  try {
    route = await inspect(connection.value, mode as 'dry-run' | 'up' | 'reset-qa', target.value);
  } catch {
    return err({ code: 'DATABASE_PREFLIGHT_FAILED' });
  } finally {
    await connection.value.$disconnect();
  }
  if (!route.ok) return route;
  const config = route.value === 'legacy' ? 'prisma.legacy.config.ts' : 'prisma.config.ts';
  const applied = await prisma(
    mode === 'reset-qa'
      ? ['migrate', 'reset', '--force', '--config', config]
      : ['migrate', 'deploy', '--config', config],
    target.value.url,
  );
  if (!applied.ok) return applied;
  const status = await prisma(['migrate', 'status', '--config', config], target.value.url);
  if (!status.ok) return status;
  const diff = await prisma(
    [
      'migrate',
      'diff',
      '--config',
      config,
      '--from-config-datasource',
      '--to-schema',
      'prisma/schema.prisma',
      '--exit-code',
    ],
    target.value.url,
  );
  if (!diff.ok) return diff;
  return ok({ mode, route: route.value });
}

async function main(): Promise<void> {
  const result = await databaseOperation(process.argv[2] ?? '');
  if (!result.ok) {
    console.error(result.error.code);
    process.exitCode = 1;
    return;
  }
  console.log(
    `Database operation complete: ${result.value.mode}; ${result.value.route} migration chain.`,
  );
  if (result.value.mode === 'reset-qa') console.log('Run pnpm db:seed to create QA fixtures.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch(() => {
    console.error('DATABASE_TOOL_INITIALIZATION_FAILED');
    process.exitCode = 1;
  });
}

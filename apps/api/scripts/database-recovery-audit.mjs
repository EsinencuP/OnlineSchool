import { readFile, stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createDirectClient, Prisma } from '@online-school/db';

const auditSql = new URL('../../../infra/ops/database-recovery-audit.sql', import.meta.url);
const admissionAuditSql = new URL(
  '../../../infra/ops/database-recovery-admissions.sql',
  import.meta.url,
);
const admissionMigration = '20261118160000_lesson_admission_starts';
const migration = /^\d{14}_[a-z0-9_]+$/;
const sha256 = /^[0-9a-f]{64}$/;
const maxCheckpointBytes = 128 * 1024;

class AuditFailure extends Error {}

function validMap(value, pattern, validate) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const rows = Object.entries(value);
  return rows.length > 0 && rows.every(([name, data]) => pattern.test(name) && validate(data));
}

function validReport(value) {
  const count = (n) => Number.isSafeInteger(n) && n >= 0;
  return (
    value?.format === 1 &&
    typeof value.checkedAt === 'string' &&
    Number.isFinite(Date.parse(value.checkedAt)) &&
    typeof value.migrationVersion === 'string' &&
    migration.test(value.migrationVersion) &&
    validMap(value.checks, /^[A-Z_]+$/, count) &&
    validMap(
      value.datasets,
      /^[a-z_]+$/,
      (d) => count(d?.rows) && typeof d.digest === 'string' && sha256.test(d.digest),
    )
  );
}

function projectReport(report) {
  return {
    format: 1,
    checkedAt: report.checkedAt,
    migrationVersion: report.migrationVersion,
    checks: report.checks,
    datasets: Object.fromEntries(
      Object.entries(report.datasets).map(([name, { rows, digest }]) => [name, { rows, digest }]),
    ),
  };
}

export async function readRecoverySnapshot(tx) {
  await tx.$executeRaw`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY`;
  await tx.$executeRaw`SET LOCAL statement_timeout = '15000ms'`;
  await tx.$executeRaw`SET LOCAL TIME ZONE 'UTC'`;
  await tx.$executeRaw`SET LOCAL row_security = off`;
  const [target] = await tx.$queryRaw`SELECT
    statement_timestamp() AS checked_at,
    current_setting('transaction_read_only')='on' AS read_only,
    current_setting('server_version_num')::int AS server_version,
    public.runtime_migration_version() AS migration_version`;
  if (!target?.read_only || Math.floor(target.server_version / 10_000) !== 18) {
    throw new AuditFailure('RECOVERY_AUDIT_DATABASE_INVALID');
  }
  // A static repository query. Neither the connection configuration nor a checkpoint supplies SQL.
  const sql = await readFile(auditSql, 'utf8');
  const [row] = await tx.$queryRaw(Prisma.raw(sql));
  const metadata = {
    format: 1,
    checkedAt: target.checked_at.toISOString(),
    migrationVersion: target.migration_version,
  };
  const report = { ...row, ...metadata };
  if (!validReport(report)) throw new AuditFailure('RECOVERY_AUDIT_RESULT_INVALID');
  if (report.migrationVersion < admissionMigration) return projectReport(report);

  const [admissionAudit] = await tx.$queryRaw(
    Prisma.raw(await readFile(admissionAuditSql, 'utf8')),
  );
  if (!validReport({ ...admissionAudit, ...metadata }))
    throw new AuditFailure('RECOVERY_AUDIT_RESULT_INVALID');
  return projectReport({
    ...report,
    checks: { ...report.checks, ...admissionAudit.checks },
    datasets: { ...report.datasets, ...admissionAudit.datasets },
  });
}

export async function inspectRecoveryDatabase(db) {
  return db.$transaction(readRecoverySnapshot, { maxWait: 5_000, timeout: 20_000 });
}

export function assessRecoveryReport(report, checkpoint) {
  if (!validReport(report)) throw new AuditFailure('RECOVERY_AUDIT_RESULT_INVALID');
  const violations = Object.values(report.checks).some((count) => count > 0);
  if (checkpoint === undefined)
    return { status: violations ? 'INVARIANTS_FAILED' : 'INVARIANTS_OK', ...projectReport(report) };
  if (!validReport(checkpoint) || Object.values(checkpoint.checks).some((n) => n !== 0)) {
    throw new AuditFailure('RECOVERY_CHECKPOINT_INVALID');
  }
  const changedDatasets = [
    ...new Set([...Object.keys(report.datasets), ...Object.keys(checkpoint.datasets)]),
  ]
    .sort()
    .filter(
      (name) =>
        report.datasets[name]?.digest !== checkpoint.datasets[name]?.digest ||
        report.datasets[name]?.rows !== checkpoint.datasets[name]?.rows,
    );
  const changedChecks = [
    ...new Set([...Object.keys(report.checks), ...Object.keys(checkpoint.checks)]),
  ]
    .sort()
    .filter((name) => report.checks[name] !== checkpoint.checks[name]);
  const schemaMatches = report.migrationVersion === checkpoint.migrationVersion;
  const status = violations
    ? 'INVARIANTS_FAILED'
    : changedDatasets.length || changedChecks.length || !schemaMatches
      ? 'CHECKPOINT_MISMATCH'
      : 'CHECKPOINT_MATCH';
  return { status, ...projectReport(report), schemaMatches, changedDatasets, changedChecks };
}

async function checkpointFromFile(path) {
  try {
    const info = await stat(path);
    if (!info.isFile() || info.size > maxCheckpointBytes)
      throw new AuditFailure('RECOVERY_CHECKPOINT_INVALID');
    return JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''));
  } catch {
    throw new AuditFailure('RECOVERY_CHECKPOINT_INVALID');
  }
}

async function main(args, env) {
  if (args.length !== 0 && (args.length !== 2 || args[0] !== '--checkpoint' || !args[1])) {
    throw new AuditFailure('RECOVERY_AUDIT_ARGUMENTS_INVALID');
  }
  const checkpoint = args.length ? await checkpointFromFile(args[1]) : undefined;
  if (args.length && !validReport(checkpoint))
    throw new AuditFailure('RECOVERY_CHECKPOINT_INVALID');
  const client = createDirectClient({ DIRECT_URL: env.RECOVERY_DATABASE_URL });
  if (!client.ok) throw new AuditFailure('RECOVERY_DATABASE_CONFIGURATION_INVALID');
  try {
    return assessRecoveryReport(await inspectRecoveryDatabase(client.value), checkpoint);
  } finally {
    await client.value.$disconnect().catch(() => undefined);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await main(process.argv.slice(2), process.env);
    console.log(JSON.stringify(report));
    if (report.status !== 'INVARIANTS_OK' && report.status !== 'CHECKPOINT_MATCH')
      process.exitCode = 1;
  } catch (error) {
    console.error(
      JSON.stringify({
        status: 'ERROR',
        code: error instanceof AuditFailure ? error.message : 'RECOVERY_AUDIT_UNAVAILABLE',
      }),
    );
    process.exitCode = 2;
  }
}

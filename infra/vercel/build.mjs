// Runs inside the existing Vercel project's protected production build environment.
// No credentials are sent to GitHub, command arguments, generated files or build logs.
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { checkReleaseMigrations, parseDatabaseTarget } from './migration-preflight.mjs';

function run(args, env = process.env, quiet = false) {
  const result = spawnSync('pnpm', args, {
    env,
    stdio: quiet ? 'pipe' : 'inherit',
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.error || result.status !== 0) {
    // Prisma diagnostics can contain a connection string. Preserve only a safe code.
    const code = quiet ? result.stderr?.match(/\bP\d{4}\b/)?.[0] : undefined;
    throw new Error(`Deployment step failed${code ? ` (${code})` : ''}`);
  }
}

async function checkMigrations(direct, expectCurrent) {
  const result = await checkReleaseMigrations(direct, expectCurrent);
  console.log(JSON.stringify(result));
  if (result.status === 'BLOCKED')
    throw new Error('Working database migration history check failed');
}

if (process.env.VERCEL_ENV !== 'production') {
  throw new Error('Only the single working production target is configured; previews are disabled');
}
if (process.env.VERCEL_GIT_COMMIT_REF !== 'main') {
  throw new Error('Production builds must use the main Git branch');
}
const direct = process.env.DIRECT_DATABASE_URL;
if (!direct || !process.env.DATABASE_URL)
  throw new Error('Deployment database configuration missing');
const migration = parseDatabaseTarget(direct);
const runtime = parseDatabaseTarget(process.env.DATABASE_URL);
if (
  !migration ||
  !runtime ||
  migration.hostname.includes('-pooler.') ||
  migration.database !== runtime.database ||
  migration.hostname !== runtime.hostname.replace('-pooler.', '.') ||
  migration.port !== runtime.port ||
  migration.username === runtime.username
)
  throw new Error(
    'Direct migration and pooled runtime must target the same database with separate roles',
  );

// Fail compilation before touching the working schema. Vercel publishes only after all steps succeed.
const buildEnv = { ...process.env };
delete buildEnv.DIRECT_DATABASE_URL;
delete buildEnv.DIRECT_URL;
run(['--filter', '@online-school/api', 'build'], buildEnv);
await checkMigrations(direct, false);
run(
  ['--filter', '@online-school/db', 'exec', 'prisma', 'migrate', 'deploy'],
  {
    ...buildEnv,
    DIRECT_URL: direct,
  },
  true,
);
await checkMigrations(direct, true);
console.log('Working database migrations applied; deployment may be published');
if (process.env.PLATFORM_DEMO_SETUP_UNTIL) {
  run(['exec', 'node', 'scripts/provision-platform-demo.mjs'], { ...buildEnv, DIRECT_URL: direct });
}
if (process.env.QA_ACCESS_SETUP_UNTIL) {
  run(['exec', 'node', 'scripts/provision-qa-access.mjs'], { ...buildEnv, DIRECT_URL: direct });
}
if (process.env.MANAGER_SETUP_UNTIL) {
  run(['exec', 'node', 'scripts/provision-owner-manager.mjs'], {
    ...buildEnv,
    DIRECT_URL: direct,
  });
}
run(['exec', 'node', 'scripts/check-student-runtime.mjs'], buildEnv);
if (process.env.STUDENT_TEST_PROVISION_UNTIL) {
  run(['exec', 'node', 'scripts/provision-student-test-data.mjs'], {
    ...buildEnv,
    DIRECT_URL: direct,
  });
}
if (process.env.STUDENT_DB_INSPECT_UNTIL) {
  run(['exec', 'node', 'scripts/inspect-student-db.mjs'], { ...buildEnv, DIRECT_URL: direct });
}
mkdirSync(new URL('../../output/vercel-static/', import.meta.url), { recursive: true });

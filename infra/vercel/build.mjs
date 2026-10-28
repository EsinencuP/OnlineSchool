// Runs inside the existing Vercel project's protected production build environment.
// No credentials are sent to GitHub, command arguments, generated files or build logs.
import { spawnSync } from 'node:child_process';
import { cpSync } from 'node:fs';

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

if (process.env.VERCEL_ENV !== 'production') {
  throw new Error('Only the single working production target is configured; previews are disabled');
}
const direct = process.env.DIRECT_DATABASE_URL;
if (!direct || !process.env.DATABASE_URL)
  throw new Error('Deployment database configuration missing');
const migration = new URL(direct);
const runtime = new URL(process.env.DATABASE_URL);
if (
  !['postgres:', 'postgresql:'].includes(migration.protocol) ||
  migration.hostname.includes('-pooler.') ||
  migration.pathname !== runtime.pathname ||
  migration.hostname !== runtime.hostname.replace('-pooler.', '.') ||
  migration.username === runtime.username ||
  !migration.password ||
  !runtime.password
)
  throw new Error(
    'Direct migration and pooled runtime must target the same database with separate roles',
  );

// Fail compilation before touching the working schema. Vercel publishes only after all steps succeed.
const buildEnv = { ...process.env };
delete buildEnv.DIRECT_DATABASE_URL;
delete buildEnv.DIRECT_URL;
run(['--filter', '@online-school/api', 'build'], buildEnv);
run(['--filter', '@online-school/qa-shell', 'build'], buildEnv);
run(['--filter', '@online-school/student-cabinet', 'build'], buildEnv);
cpSync('apps/student-cabinet/dist', 'apps/qa-shell/dist/student', { recursive: true });
run(
  ['--filter', '@online-school/db', 'exec', 'prisma', 'migrate', 'deploy'],
  {
    ...buildEnv,
    DIRECT_URL: direct,
  },
  true,
);
console.log('Working database migrations applied; deployment may be published');

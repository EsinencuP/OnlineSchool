import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pg from '../../packages/db/node_modules/pg/lib/index.js';

// This runner only creates fresh localhost CI databases; never resets or touches the working DB.
const root = fileURLToPath(new URL('../../', import.meta.url));
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const baseEnv = { ...process.env, APP_ENV: 'test', NODE_ENV: 'test' };
delete baseEnv.DATABASE_URL;
delete baseEnv.DIRECT_URL;
delete baseEnv.QA_DATABASE_URL;
const secrets = [process.env.DATABASE_URL_CI, process.env.DATABASE_URL_TEST].filter(Boolean);
function safe(value) {
  let text = String(value);
  for (const secret of secrets) text = text.replaceAll(secret, '[CI connection]');
  return text.replace(/postgres(?:ql)?:\/\/[^\s'"<>]+/gi, '[CI connection]');
}
function run(command, args, env, cwd = root) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...baseEnv, ...env },
      shell: process.platform === 'win32' && command.endsWith('.cmd'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (data) => process.stdout.write(safe(data)));
    child.stderr.on('data', (data) => process.stderr.write(safe(data)));
    child.once('error', () => reject(new Error('CI child process failed to start')));
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`CI command failed (${code})`)),
    );
  });
}
function local(value, maintenance = false) {
  const url = new URL(value);
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
  assert.equal(url.searchParams.has('host'), false);
  assert.equal(url.searchParams.has('hostaddr'), false);
  assert.ok(
    maintenance
      ? url.pathname === '/postgres'
      : /^\/online_school_test[a-z0-9_]*$/.test(url.pathname),
  );
  return url;
}
async function main() {
  assert.equal(process.env.CI, 'true', 'Explicit CI=true required');
  assert.notEqual(process.env.APP_ENV, 'production');
  const adminUrl = local(process.env.DATABASE_URL_CI, true);
  const templateUrl = local(process.env.DATABASE_URL_TEST);
  assert.equal(templateUrl.host, adminUrl.host);
  assert.equal(templateUrl.username, adminUrl.username);
  const suffix = randomBytes(4).toString('hex');
  const template = `online_school_test_template_ci_${suffix}`;
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  const connection = (name) => {
    const url = new URL(adminUrl);
    url.pathname = '/' + name;
    return url.toString();
  };
  await admin.connect();
  try {
    const version = Number(
      (await admin.query('SHOW server_version_num')).rows[0].server_version_num,
    );
    assert.equal(Math.floor(version / 10000), 18);
    // Identifiers are generated here, not taken from environment input. No DROP DATABASE anywhere.
    await admin.query(`CREATE DATABASE ${template}`);
    await run(
      pnpm,
      ['prisma', 'migrate', 'deploy'],
      { DIRECT_URL: connection(template) },
      fileURLToPath(new URL('../../packages/db/', import.meta.url)),
    );
    await run(process.execPath, ['packages/db/prisma/seed.mjs'], {
      DIRECT_URL: connection(template),
    });
    const specs = [
      ['db', 'online_school_test_db', 'packages/db/test/integration', 'TEST_DATABASE_URL'],
      [
        'core',
        'online_school_test_api',
        'apps/api/test/integration',
        'TEST_DATABASE_URL',
        'core-http.test.mjs',
      ],
      [
        'identity',
        'online_school_test_identity',
        'apps/api/test/integration',
        'IDENTITY_TEST_DATABASE_URL',
        'identity-http.test.mjs',
      ],
      [
        'finance',
        'online_school_test_finance',
        'apps/api/test/integration',
        'FINANCE_TEST_DATABASE_URL',
        'finance-http.test.mjs',
      ],
      [
        'schedule',
        'online_school_test_schedule',
        'apps/api/test/integration',
        'SCHEDULE_TEST_DATABASE_URL',
        'schedule-http.test.mjs',
      ],
      [
        'worker',
        'online_school_test_task11',
        'apps/worker/test/integration',
        'WORKER_TEST_DATABASE_URL',
      ],
    ];
    for (const [label, prefix, directory, variable, filename] of specs) {
      const name = `${prefix}_ci_${suffix}`;
      await admin.query(`CREATE DATABASE ${name} TEMPLATE ${template}`);
      const files = filename
        ? [filename]
        : (await readdir(new URL('../../' + directory, import.meta.url)))
            .filter((f) => f.endsWith('.test.mjs'))
            .sort();
      console.log(`PostgreSQL 18 integration suite: ${label}`);
      await run(
        process.execPath,
        ['--test', '--test-concurrency=1', ...files.map((f) => `${directory}/${f}`)],
        { [variable]: connection(name) },
      );
    }
  } finally {
    await admin.end();
  }
}
void main().catch((error) => {
  console.error(safe(error.message));
  process.exitCode = 1;
});

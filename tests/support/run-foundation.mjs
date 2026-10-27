import { spawnSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
if (!process.env.FND_WORKING_ORIGIN)
  throw new Error(
    'Explicit FND_WORKING_ORIGIN is required; live HTTP checks must not silently skip',
  );
await mkdir(new URL('../../.codex/fnd/', import.meta.url), { recursive: true });
const report = '.codex/fnd/safe-jest.json';
const result = spawnSync(
  process.execPath,
  [
    '--experimental-vm-modules',
    'node_modules/jest/bin/jest.js',
    'tests/unit',
    'tests/integration/recorded-sql.test.mjs',
    'tests/api/working-health.test.mjs',
    '--runInBand',
    '--json',
    `--outputFile=${report}`,
  ],
  { cwd: root, env: process.env, stdio: 'inherit' },
);
const status = JSON.parse(
  await readFile(new URL('../FOUNDATION_STATUS.json', import.meta.url), 'utf8'),
);
await writeFile(
  new URL('../../.codex/fnd/gate-status.json', import.meta.url),
  JSON.stringify(
    { checkedAt: new Date().toISOString(), safeChecksExitCode: result.status, ...status },
    null,
    2,
  ) + '\n',
);
if (result.error || result.status !== 0) process.exitCode = 1;
else if (process.argv.includes('--safe-only'))
  console.log('Safe checks passed. This command does not establish FND-GATE.');
else {
  console.error(
    'FND-GATE NOT PASSED: clean/previous migrations, full real PostgreSQL/API/concurrency/crash regression lack an owner-permitted target. No databases created and no working data reset. See tests/FOUNDATION_STATUS.json.',
  );
  process.exitCode = 1;
}

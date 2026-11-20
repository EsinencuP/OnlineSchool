import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { railwayTestDatabase } from '../../scripts/platform-demo-plan.mjs';

if (!railwayTestDatabase(process.env)) {
  console.error('RAILWAY_TEST_DATABASE_REQUIRED');
  process.exit(1);
}

const root = fileURLToPath(new URL('../../', import.meta.url));
const db = fileURLToPath(new URL('../../packages/db/', import.meta.url));
for (const [label, cwd, args] of [
  ['MIGRATE', db, ['node_modules/prisma/build/index.js', 'migrate', 'deploy']],
  ['REFERENCE', root, ['packages/db/prisma/seed.mjs']],
  ['DEMO', root, ['scripts/provision-platform-demo.mjs', '--railway-test']],
]) {
  const result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) {
    const code = result.stderr?.match(/\b(?:P\d{4}|PLATFORM_DEMO_[A-Z_]+)\b/)?.[0];
    console.error(`RAILWAY_TEST_${label}_FAILED${code ? ` ${code}` : ''}`);
    process.exit(1);
  }
  console.log(`RAILWAY_TEST_${label}_OK`);
}

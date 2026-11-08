// TASK-035: source compilation + mocks + isolated browser. No .env, DB, seed or provider calls.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { evaluateRoute, FONT_METHOD_V2 } from './k8k-route-budget-core.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'output/k8k-taskpack/task-035');
const run =
  process.env.K8K_STUDENT_GATE_OUTPUT ??
  path.join(output, 'runs', new Date().toISOString().replaceAll(':', '-'));
await mkdir(run, { recursive: true });
const env = Object.fromEntries(
  [
    'PATH',
    'Path',
    'SystemRoot',
    'WINDIR',
    'TEMP',
    'TMP',
    'USERPROFILE',
    'LOCALAPPDATA',
    'APPDATA',
    'COMSPEC',
    'PATHEXT',
    'PLAYWRIGHT_BROWSERS_PATH',
  ]
    .filter((key) => process.env[key])
    .map((key) => [key, process.env[key]]),
);
Object.assign(env, {
  CI: '1',
  NODE_ENV: 'test',
  TZ: 'UTC',
  NO_COLOR: '1',
  K8K_STUDENT_GATE_OUTPUT: run,
});
const results = [];
const scrub = (text) =>
  text.replace(
    /https?:\/\/[^\s"'<>]*(?:signature|X-Amz|token|capability)[^\s"'<>]*/gi,
    '[private URL omitted]',
  );
async function command(id, args, cwd = root) {
  const started = Date.now();
  const child = spawn(process.execPath, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let text = '';
  child.stdout.on('data', (bytes) => {
    text += bytes;
  });
  child.stderr.on('data', (bytes) => {
    text += bytes;
  });
  const exit = await new Promise((resolve) => {
    child.on('error', () => resolve(1));
    child.on('exit', (code) => resolve(code ?? 1));
  });
  const log = path.join(run, id + '.log');
  await writeFile(log, scrub(text));
  results.push({
    id,
    command: [process.execPath, ...args],
    cwd,
    exit,
    durationMs: Date.now() - started,
    evidence: path.relative(root, log).replaceAll('\\', '/'),
  });
  console.log(`${id}: ${exit === 0 ? 'PASS' : 'FAIL'} (${exit})`);
}
const require = createRequire(path.join(root, 'apps/manager-web/package.json'));
async function build() {
  const { build: vite } = await import(pathToFileURL(require.resolve('vite')));
  const { default: react } = await import(pathToFileURL(require.resolve('@vitejs/plugin-react')));
  const aliases = [
    ['@online-school/ui/style.css', 'packages/ui/src/style.css'],
    ['@online-school/account-ui/style.css', 'packages/account-ui/src/style.css'],
    ['@online-school/ui', 'packages/ui/src/index.ts'],
    ['@online-school/account-ui', 'packages/account-ui/src/index.tsx'],
    ['@online-school/api-contracts', 'packages/api-contracts/src/index.ts'],
    ['@online-school/shared', 'packages/shared/src/index.ts'],
  ].map(([find, p]) => ({ find, replacement: path.join(root, p) }));
  const built = await vite({
    root: path.join(root, 'apps/student-cabinet'),
    configFile: false,
    envDir: false,
    publicDir: false,
    plugins: [react()],
    base: '/student/',
    resolve: { alias: aliases, dedupe: ['react', 'react-dom'] },
    build: { write: false, manifest: true },
    logLevel: 'error',
  });
  assert(!Array.isArray(built) && 'output' in built);
  const assets = new Map(
    built.output.map((item) => [
      item.fileName,
      Buffer.from(item.type === 'chunk' ? item.code : item.source),
    ]),
  );
  const destination = path.join(output, 'build/student');
  await mkdir(destination, { recursive: true });
  for (const [name, bytes] of assets) {
    const target = path.join(destination, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
  const manifest = JSON.parse(assets.get('.vite/manifest.json').toString());
  const measured = evaluateRoute({
    manifest,
    seeds: ['index.html'],
    assets,
    requiredFonts: ['cyrillic', 'latin', 'romanian'],
  });
  const router = await readFile(path.join(root, 'apps/student-cabinet/src/router.tsx'), 'utf8');
  const routes = [...router.matchAll(/path:\s*'([^']+)'/g)].map((m) => m[1]);
  const previous = JSON.parse(
    await readFile(path.join(root, 'output/ui-motion-2026-11-08/budgets.json'), 'utf8'),
  ).rows.find((row) => row.app === 'student-cabinet');
  await writeFile(
    path.join(run, 'budgets.json'),
    JSON.stringify(
      {
        taskId: 'TASK-035',
        method: FONT_METHOD_V2,
        provenance: {
          configFile: false,
          envDir: false,
          publicDir: false,
          write: false,
          sourceAlias: aliases,
        },
        rows: routes.map((route) => ({
          route,
          ...measured,
          delta: measured.total - previous.total,
        })),
        assets: [...assets].map(([file, bytes]) => ({
          file,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        })),
      },
      null,
      2,
    ) + '\n',
  );
  results.push({
    id: 'source-build-budget',
    command: 'programmatic Vite source build / evaluateRoute',
    exit: measured.pass ? 0 : 1,
    evidence: path.relative(root, path.join(run, 'budgets.json')).replaceAll('\\', '/'),
  });
  console.log(
    `source-build-budget: ${measured.pass ? 'PASS' : 'FAIL'} ${measured.total}/${measured.limit}`,
  );
}
const phase = process.argv.find((arg) => arg.startsWith('--phase='))?.split('=')[1] ?? 'all';
assert(
  ['all', 'checks', 'build', 'browser', 'accessibility'].includes(phase),
  'Unknown gate phase',
);
if (phase === 'all' || phase === 'checks') {
  await command('compile', [
    'node_modules/typescript/bin/tsc',
    '-b',
    'packages/ui',
    'packages/account-ui',
    'packages/api-contracts',
    'apps/student-cabinet',
    'apps/api',
    'apps/worker',
    '--pretty',
    'false',
  ]);
  await command('student-lint', [
    'node_modules/eslint/bin/eslint.js',
    'apps/student-cabinet',
    '--max-warnings',
    '0',
  ]);
  await command('presentation', [
    '--test',
    'apps/student-cabinet/tests/k8k-presentation.test.mjs',
    'apps/student-cabinet/tests/locales.test.mjs',
  ]);
  await command('design', ['scripts/k8k-design-check.mjs']);
  const suites = (await readdir(path.join(root, 'tests/unit')))
    .filter((name) => /^student.*\.test\.mjs$/.test(name))
    .map((name) => 'tests/unit/' + name);
  await command('api-http-sdk', [
    '--import',
    './scripts/k8k-student-gate-network.mjs',
    '--experimental-vm-modules',
    'node_modules/jest/bin/jest.js',
    '--roots',
    'tests',
    '--runInBand',
    '--runTestsByPath',
    ...suites,
    '--json',
    '--outputFile=' + path.join(run, 'api-results.json'),
  ]);
}
if (['all', 'build', 'browser', 'accessibility'].includes(phase)) await build();
if (['all', 'browser'].includes(phase)) {
  await command(
    'browser',
    [
      path.join(root, 'node_modules/@playwright/test/cli.js'),
      'test',
      '--config',
      'playwright.student-gate.config.mjs',
      ...process.argv.filter((arg) => arg.startsWith('--grep=')),
    ],
    path.join(root, 'apps/student-cabinet'),
  );
}
if (['all', 'accessibility'].includes(phase)) {
  await command(
    'accessibility',
    [
      path.join(root, 'node_modules/@playwright/test/cli.js'),
      'test',
      '--config',
      'playwright.student-gate-axe.config.mjs',
    ],
    path.join(root, 'apps/student-cabinet'),
  );
}
await writeFile(
  path.join(run, 'commands.json'),
  JSON.stringify(
    { taskId: 'TASK-035', run: path.relative(root, run).replaceAll('\\', '/'), phase, results },
    null,
    2,
  ) + '\n',
);
await writeFile(
  path.join(output, 'latest-' + phase + '.json'),
  JSON.stringify({ run: path.relative(root, run).replaceAll('\\', '/'), phase, results }, null, 2) +
    '\n',
);
console.log(path.relative(root, run));
if (results.some((row) => row.exit !== 0)) process.exitCode = 1;

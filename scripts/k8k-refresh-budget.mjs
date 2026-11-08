// Safe programmatic frontend builds: no .env, backend generation or API.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { evaluateRoute, FONT_METHOD_V2 } from './k8k-route-budget-core.mjs';
const root = new URL('../', import.meta.url);
const baselines = {
  'TASK-034': 'TASK-033',
  'TASK-033': 'TASK-032',
  'TASK-032': 'TASK-031',
  'TASK-031': 'TASK-030',
  'TASK-030': 'TASK-029',
  'TASK-029': 'TASK-028',
  'TASK-028': 'TASK-027',
  'TASK-027': 'TASK-026',
  'TASK-026': 'TASK-025',
  'TASK-025': 'TASK-023',
  'TASK-022': 'TASK-021',
  'TASK-021': 'TASK-020',
};
const task =
  Object.keys(baselines).find((id) => process.argv.includes(`--${id.toLowerCase()}`)) ?? 'TASK-021';
const baseline = baselines[task];
const output = new URL(`output/k8k-tasks/${task}/`, root);
await mkdir(output, { recursive: true });
const require = createRequire(new URL('apps/manager-web/package.json', root));
const { build } = await import(pathToFileURL(require.resolve('vite')));
const { default: react } = await import(pathToFileURL(require.resolve('@vitejs/plugin-react')));
const previous = JSON.parse(
  await readFile(new URL(`output/k8k-tasks/${baseline}/budgets.json`, root), 'utf8'),
);
assert.equal(previous.method, FONT_METHOD_V2);
const plans = [...previous.rows];
if (task === 'TASK-025') {
  const studentHome = plans.find((plan) => plan.route === '/student');
  assert(studentHome);
  for (const route of ['/student/subjects', '/student/help']) plans.push({ ...studentHome, route });
}
const alias = [
  ['@online-school/ui/style.css', 'packages/ui/src/style.css'],
  ['@online-school/account-ui/style.css', 'packages/account-ui/src/style.css'],
  ['@online-school/ui', 'packages/ui/src/index.ts'],
  ['@online-school/account-ui', 'packages/account-ui/src/index.tsx'],
  ['@online-school/api-contracts', 'packages/api-contracts/src/index.ts'],
  ['@online-school/shared', 'packages/shared/src/index.ts'],
].map(([find, path]) => ({ find, replacement: fileURLToPath(new URL(path, root)) }));
const rows = [];
const chunks = [];
for (const app of ['student-cabinet', 'manager-web', 'platform']) {
  const built = await build({
    root: fileURLToPath(new URL(`apps/${app}/`, root)),
    configFile: false,
    envDir: false,
    publicDir: false,
    mode: 'production',
    plugins: [react()],
    base: app === 'student-cabinet' ? '/student/' : app === 'manager-web' ? '/manager/' : '/',
    resolve: { alias, dedupe: ['react', 'react-dom'] },
    build: { write: false, manifest: true },
    logLevel: 'error',
  });
  assert(!Array.isArray(built) && 'output' in built);
  const assets = new Map(
    built.output.map((file) => [
      file.fileName,
      Buffer.from(file.type === 'chunk' ? file.code : file.source),
    ]),
  );
  const manifest = JSON.parse(assets.get('.vite/manifest.json').toString());
  await writeFile(
    new URL(`manifest-${app}.json`, output),
    JSON.stringify(manifest, null, 2) + '\n',
  );
  const modules = built.output.filter((file) => file.type === 'chunk');
  for (const chunk of modules)
    for (const id of Object.keys(chunk.modules))
      assert.doesNotMatch(
        id.replaceAll('\\', '/'),
        /(?:\/@storybook\/|\/storybook\/|\/packages\/ui\/(?:stories|\.storybook)\/)/u,
      );
  chunks.push({ app, chunks: modules.length, storybookModules: 0 });
  for (const plan of plans.filter((row) => row.app === app)) {
    const seeds = [...plan.manifestSeeds];
    const measured = evaluateRoute({
      manifest,
      seeds,
      assets,
      requiredFonts: ['cyrillic', 'latin', 'romanian'],
    });
    const optionalActions = (plan.optionalActions ?? []).map((action) => ({
      seed: action.seed,
      ...evaluateRoute({
        manifest,
        seeds: [...new Set([...seeds, action.seed])],
        assets,
        requiredFonts: ['cyrillic', 'latin', 'romanian'],
      }),
    }));
    rows.push({
      role: plan.role,
      route: plan.route,
      app,
      manifestSeeds: seeds,
      ...measured,
      optionalActions,
      [`deltaTask${baseline.slice(-3)}`]: measured.total - plan.total,
    });
  }
}
await writeFile(
  new URL('budgets.json', output),
  JSON.stringify(
    {
      method: FONT_METHOD_V2,
      provenance: {
        configFile: false,
        envDir: false,
        publicDir: false,
        write: false,
        node: process.version,
        sourceAlias: alias,
        previous: `${baseline}/budgets.json`,
        explicitOverviewSeed: true,
      },
      rows,
      chunks,
    },
    null,
    2,
  ) + '\n',
);
console.log({
  routes: rows.length,
  passed: rows.filter((row) => row.pass).length,
  maxBytes: Math.max(...rows.map((row) => row.total)),
  chunks,
});
assert.equal(
  rows.length,
  [
    'TASK-025',
    'TASK-026',
    'TASK-027',
    'TASK-028',
    'TASK-029',
    'TASK-030',
    'TASK-031',
    'TASK-032',
    'TASK-033',
    'TASK-034',
  ].includes(task)
    ? 50
    : 48,
);
assert(
  rows.every((row) => row.pass),
  'See budgets.json',
);
assert(
  rows.every((row) => row.optionalActions.every((action) => action.pass)),
  'Optional action over budget',
);

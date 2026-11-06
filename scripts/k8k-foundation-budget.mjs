// TASK-017 safe programmatic frontend builds: no .env, backend generation or API.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { evaluateRoute, FONT_METHOD_V2 } from './k8k-route-budget-core.mjs';
const root = new URL('../', import.meta.url);
const output = new URL('output/k8k-tasks/TASK-017/', root);
await mkdir(output, { recursive: true });
const require = createRequire(new URL('apps/manager-web/package.json', root));
const { build } = await import(pathToFileURL(require.resolve('vite')));
const { default: react } = await import(pathToFileURL(require.resolve('@vitejs/plugin-react')));
const previous = JSON.parse(
  await readFile(
    new URL('output/k8k-tasks/TASK-012/runs/2026-11-04T05-14-33.552Z/bundle.json', root),
    'utf8',
  ),
);
assert.equal(previous.method, FONT_METHOD_V2);
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
  for (const plan of previous.rows.filter((row) => row.app === app)) {
    const seeds = [...plan.manifestSeeds];
    if (app === 'manager-web' && plan.route === '/manager/students/:id?tab=overview')
      seeds.push('src/pages/student/BalanceSummary.tsx');
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
      deltaTask012: measured.total - plan.total,
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
        previous: 'TASK-012/bundle.json',
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
assert.equal(rows.length, 48);
assert(
  rows.every((row) => row.pass),
  'See budgets.json',
);
assert(
  rows.every((row) => row.optionalActions.every((action) => action.pass)),
  'Optional action over budget',
);

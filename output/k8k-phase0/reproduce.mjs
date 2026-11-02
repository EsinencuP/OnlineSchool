// Audit tooling only: materializes the pinned frontend in .codex, never edits apps/packages.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const root = process.cwd();
const evidence = path.join(root, 'output/k8k-phase0');
const sha = JSON.parse(fs.readFileSync(path.join(evidence, 'baseline.json'), 'utf8')).source;
const snapshot = path.join(root, '.codex/k8k-phase0-baseline');
fs.mkdirSync(snapshot, { recursive: true });
const scopes = [
  'apps/student-cabinet',
  'apps/manager-web',
  'apps/platform',
  'packages/account-ui',
  'packages/api-contracts/openapi',
  'tsconfig.base.json',
  'packages/api-contracts/tsconfig.json',
  'packages/shared/tsconfig.json',
];
const entries = execFileSync('git', ['ls-tree', '-r', sha, '--', ...scopes], { encoding: 'utf8' })
  .trim()
  .split('\n');
for (const line of entries) {
  const [meta, file] = line.split('\t');
  const blob = meta.split(' ')[2];
  const content = execFileSync('git', ['cat-file', 'blob', blob]);
  const actual = createHash('sha1')
    .update(Buffer.from(`blob ${content.length}\0`))
    .update(content)
    .digest('hex');
  if (actual !== blob) throw Error(`Unexpected git blob ${file}`);
  fs.mkdirSync(path.dirname(path.join(snapshot, file)), { recursive: true });
  fs.writeFileSync(path.join(snapshot, file), content);
}
// SDK and shared runtime reuse is allowed only while their source matches the pinned commit.
execFileSync('git', [
  'diff',
  '--quiet',
  sha,
  '--',
  'packages/api-contracts/src',
  'packages/shared/src',
]);
for (const pkg of ['api-contracts', 'shared']) {
  const dir = path.join(root, 'packages', pkg, 'dist');
  if (!fs.existsSync(dir)) throw Error(`Existing workspace build required: packages/${pkg}/dist`);
  fs.cpSync(dir, path.join(snapshot, 'packages', pkg, 'dist'), { recursive: true });
}
for (const relative of [
  'node_modules',
  ...['student-cabinet', 'manager-web', 'platform'].map((app) => `apps/${app}/node_modules`),
  'packages/account-ui/node_modules',
]) {
  const target = path.join(snapshot, relative);
  if (!fs.existsSync(target)) fs.symlinkSync(path.join(root, relative), target, 'junction');
}
const vReq = createRequire(path.join(root, 'apps/platform/package.json'));
const vite = pathToFileURL(vReq.resolve('vite')).href;
const react = pathToFileURL(vReq.resolve('@vitejs/plugin-react')).href;
for (const [app, base, port] of [
  ['student-cabinet', '/student/', 55174],
  ['manager-web', '/manager/', 55177],
  ['platform', '/', 55173],
]) {
  const configFile = path.join(root, '.codex', `k8k-phase0-${app}.vite.mjs`);
  const settings = {
    root: path.join(snapshot, 'apps', app),
    base,
    publicDir: app === 'manager-web' ? path.join(snapshot, 'apps/manager-web/test/public') : false,
    resolve: {
      alias: [
        {
          find: '@online-school/account-ui/style.css',
          replacement: path.join(snapshot, 'packages/account-ui/src/style.css'),
        },
        {
          find: '@online-school/account-ui',
          replacement: path.join(snapshot, 'packages/account-ui/src/index.tsx'),
        },
        {
          find: '@online-school/api-contracts',
          replacement: path.join(snapshot, 'packages/api-contracts/dist/index.js'),
        },
        {
          find: '@online-school/shared',
          replacement: path.join(snapshot, 'packages/shared/dist/index.js'),
        },
      ],
    },
    server: { host: '127.0.0.1', port, strictPort: true, proxy: {} },
    build: { outDir: path.join(root, '.codex/k8k-phase0-dist', app), manifest: true },
  };
  fs.writeFileSync(
    configFile,
    `import {defineConfig} from ${JSON.stringify(vite)};import react from ${JSON.stringify(react)};export default defineConfig({...${JSON.stringify(settings)},plugins:[react()]});\n`,
  );
  if (process.argv.includes('--build'))
    execFileSync(
      process.execPath,
      [
        path.join(path.dirname(vReq.resolve('vite/package.json')), 'bin/vite.js'),
        'build',
        '--config',
        configFile,
      ],
      { cwd: root, stdio: 'inherit' },
    );
}
console.log(
  `Pinned frontend ${sha} ready. Start manager Vite with its isolated config in --mode mock, then run output/k8k-phase0/capture.mjs.`,
);

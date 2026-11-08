// TASK-006 source builds and local synthetic browser evidence. No env/DB/providers.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { wcagContrast } from 'culori';
import {
  evaluateRoute,
  FONT_METHOD_V2 as METHOD,
  METHOD as PREVIOUS_METHOD,
} from './k8k-route-budget-core.mjs';
import { measured, resolveTokens, contrast } from '../packages/ui/tests/contrast-contract.mjs';

const root = path.resolve(import.meta.dirname, '..');
const previous = 'output/k8k-tasks/TASK-005/runs/2026-11-03T21-34-16.851Z';
const run = path.join(
  root,
  'output/k8k-tasks/TASK-006/runs',
  new Date().toISOString().replaceAll(':', '-'),
);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const read = async (p) => JSON.parse(await fs.readFile(p, 'utf8'));
const write = async (p, d) => fs.writeFile(path.join(run, p), JSON.stringify(d, null, 2) + '\n');
const git = (...a) =>
  execFileSync('git', ['--no-optional-locks', '-c', 'core.safecrlf=false', ...a], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
await fs.mkdir(run, { recursive: true });
const before = await read(path.join(root, previous, 'bundle.json'));
assert.equal(before.method, PREVIOUS_METHOD);
const sourcePaths = new Set(before.basis.sourceManifest.map((e) => e.path));
for (const p of [
  'scripts/k8k-typography-evidence.mjs',
  'scripts/k8k-font-assets.py',
  'scripts/k8k-font-requirements.txt',
  'packages/ui/src/fonts/golos-text-romanian-wght-normal.woff2',
  'packages/ui/src/fonts/provenance.json',
  'packages/ui/src/fonts/LICENSE',
  'packages/ui/src/fonts/SOURCE.md',
  'packages/ui/tests/typography.test.mjs',
  'packages/ui/tests/typography/index.html',
  'packages/ui/tests/typography/fixture.tsx',
  'packages/ui/tests/typography/style.css',
  'stylelint.config.mjs',
  'scripts/stylelint-k8k.mjs',
  'scripts/k8k-stylelint.mjs',
  'scripts/k8k-design-check.mjs',
  'scripts/k8k-design-evidence.mjs',
  '.github/workflows/ci.yml',
  'packages/ui/tests/contrast-contract.mjs',
  'packages/ui/tests/stylelint.test.mjs',
  'packages/ui/tests/stylelint-legacy.json',
  'packages/ui/tests/design/index.html',
  'packages/ui/tests/design/fixture.tsx',
  'packages/ui/tests/design/style.css',
])
  sourcePaths.add(p);
// Earlier inventory-derived manifests omitted shared UI entrypoints/CSS. Capture actual sources.
async function addSourceTree(relative) {
  for (const item of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
    const name = `${relative}/${item.name}`;
    if (item.isDirectory()) await addSourceTree(name);
    else if (/\.(?:ts|tsx|css|json|html|svg|png|woff2)$/.test(name)) sourcePaths.add(name);
  }
}
for (const dir of [
  'packages/ui/src',
  'packages/account-ui/src',
  'apps/student-cabinet/src',
  'apps/manager-web/src',
  'apps/platform/src',
])
  await addSourceTree(dir);
const sourceManifest = await Promise.all(
  [...sourcePaths]
    .sort()
    .map(async (p) => ({ path: p, sha256: sha(await fs.readFile(path.join(root, p))) })),
);
const basis = {
  head: git('rev-parse', 'HEAD').toString().trim(),
  branch: git('branch', '--show-current').toString().trim(),
  sourceManifest,
  sourceDigest: sha(JSON.stringify(sourceManifest)),
  dirtyDigest: sha(
    JSON.stringify({
      patchSha256: sha(git('diff', '--binary', '--full-index', 'HEAD', '--')),
      sourceManifest,
    }),
  ),
  definition:
    'SHA256(JSON.stringify({patchSha256: SHA256(git diff --binary --full-index HEAD --), sourceManifest})); scoped ordered inputs; mutable bookkeeping/output excluded',
};
const req = createRequire(path.join(root, 'apps/manager-web/package.json'));
const { build, version: viteVersion } = await import(pathToFileURL(req.resolve('vite')));
const { default: react } = await import(pathToFileURL(req.resolve('@vitejs/plugin-react')));
const alias = [
  ['@online-school/ui/style.css', 'packages/ui/src/style.css'],
  ['@online-school/account-ui/style.css', 'packages/account-ui/src/style.css'],
  ['@online-school/ui', 'packages/ui/src/index.ts'],
  ['@online-school/account-ui', 'packages/account-ui/src/index.tsx'],
  ['@online-school/api-contracts', 'packages/api-contracts/src/index.ts'],
  ['@online-school/shared', 'packages/shared/src/index.ts'],
].map(([find, p]) => ({ find, replacement: path.join(root, p) }));
const buildProvenance = {
  method: before.buildProvenance.method,
  viteVersion,
  node: process.version,
  zlibVersion: process.versions.zlib,
  lockfileSha256: sha(await fs.readFile(path.join(root, 'pnpm-lock.yaml'))),
  configFile: false,
  envDir: false,
  publicDir: false,
  manifest: true,
  gzipLevel: 9,
  sourceAlias: alias,
};
for (const key of [
  'method',
  'viteVersion',
  'node',
  'zlibVersion',
  'configFile',
  'envDir',
  'publicDir',
  'manifest',
  'gzipLevel',
  'sourceAlias',
])
  assert.deepEqual(
    buildProvenance[key],
    before.buildProvenance[key],
    `Comparable build method ${key}`,
  );
assert.equal(
  buildProvenance.lockfileSha256,
  before.buildProvenance.lockfileSha256,
  'JS lockfile unchanged',
);
const assetsByApp = new Map();
const manifests = {};
for (const app of ['student-cabinet', 'manager-web', 'platform']) {
  const dir = path.join(run, 'build', app);
  await build({
    root: path.join(root, 'apps', app),
    configFile: false,
    envDir: false,
    publicDir: false,
    mode: 'production',
    plugins: [react()],
    base: app === 'student-cabinet' ? '/student/' : app === 'manager-web' ? '/manager/' : '/',
    resolve: { alias, dedupe: ['react', 'react-dom'] },
    build: { outDir: dir, emptyOutDir: false, manifest: true },
    logLevel: 'error',
  });
  const manifestFile = path.join(dir, '.vite/manifest.json');
  const manifest = await read(manifestFile);
  const assets = new Map();
  for (const file of await fs.readdir(path.join(dir, 'assets')))
    assets.set(`assets/${file}`, await fs.readFile(path.join(dir, 'assets', file)));
  assetsByApp.set(app, { manifest, assets });
  manifests[app] = {
    path: path.relative(root, manifestFile).replaceAll('\\', '/'),
    sha256: sha(await fs.readFile(manifestFile)),
  };
}
const rows = [];
for (const plan of before.rows) {
  const { manifest, assets } = assetsByApp.get(plan.app);
  const result = evaluateRoute({
    manifest,
    seeds: plan.manifestSeeds,
    assets,
    requiredFonts: ['cyrillic', 'latin', 'romanian'],
  });
  assert.equal(result.method, METHOD, 'All three fonts must use v2 policy');
  assert.equal(result.pass, true, `${plan.inventoryId} route budget`);
  const old = before.rows.find((r) => r.inventoryId === plan.inventoryId);
  assert.ok(old);
  const optionalActions = [];
  if (plan.app === 'manager-web' && plan.manifestSeeds.includes('src/pages/Login.tsx'))
    for (const seed of manifest['src/pages/Login.tsx'].dynamicImports ?? []) {
      const action = evaluateRoute({
        manifest,
        seeds: [...plan.manifestSeeds, seed],
        assets,
        requiredFonts: ['cyrillic', 'latin', 'romanian'],
      });
      assert.equal(action.pass, true);
      optionalActions.push({ name: 'passkey-browser-action', seed, ...action });
    }
  rows.push({
    ...plan,
    ...result,
    optionalActions,
    baselineRef: { path: previous, dirtyDigest: before.basis.dirtyDigest, method: PREVIOUS_METHOD },
    delta: {
      gzip: result.gzip - old.gzip,
      font: result.font.total - old.font.total,
      total: result.total - old.total,
    },
  });
}
assert.equal(rows.length, 48);
await write('bundle.json', {
  task: 'TASK-006',
  method: METHOD,
  basis,
  buildProvenance,
  manifests,
  routePlanSource: previous,
  comparison:
    'Same Vite/runtime/closure/gzip/route seeds and unchanged JS lockfile. Font policy explicitly upgraded v1 to v2: Romanian raw bytes included; code/font deltas separated.',
  rows,
});
const tokens = resolveTokens();
await write('contrast.json', {
  basis,
  measured: measured.map(([fg, bg, expected]) => ({
    fg,
    bg,
    expected,
    actual: contrast(tokens[fg], tokens[bg]),
    independent: wcagContrast(tokens[fg], tokens[bg]),
    roundedMatches: contrast(tokens[fg], tokens[bg]).toFixed(2) === expected.toFixed(2),
  })),
});
const fixtureDir = path.join(run, 'fixture');
await build({
  root: path.join(root, 'packages/ui/tests/typography'),
  configFile: false,
  envDir: false,
  publicDir: false,
  plugins: [react()],
  resolve: { alias, dedupe: ['react', 'react-dom'] },
  build: { outDir: fixtureDir, emptyOutDir: false },
  logLevel: 'error',
});
const fontAssetNames = (await fs.readdir(path.join(fixtureDir, 'assets'))).filter((p) =>
  p.endsWith('.woff2'),
);
assert.equal(fontAssetNames.length, 3);
const expectedBytes = new Map(
  await Promise.all(
    fontAssetNames.map(async (p) => [
      p,
      (await fs.readFile(path.join(fixtureDir, 'assets', p))).length,
    ]),
  ),
);
assert.equal(
  [...expectedBytes.values()].reduce((sum, n) => sum + n, 0),
  63492,
);
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const relative =
      url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).slice(1);
    const target = path.resolve(fixtureDir, relative);
    if (!target.startsWith(fixtureDir + path.sep)) throw Error('path');
    const bytes = await fs.readFile(target);
    response.setHeader(
      'Content-Type',
      target.endsWith('.js')
        ? 'text/javascript'
        : target.endsWith('.css')
          ? 'text/css'
          : target.endsWith('.woff2')
            ? 'font/woff2'
            : 'text/html',
    );
    response.end(bytes);
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const browserVersion = browser.version();
const screenshots = [];
const errors = [];
let blockedExternal = 0;
try {
  for (const locale of ['ru', 'ro'])
    for (const width of [360, 768, 1024, 1280])
      for (const role of ['student', 'manager'])
        for (const fontMode of ['loaded', 'blocked']) {
          const context = await browser.newContext({
            viewport: { width, height: 900 },
            locale: locale === 'ro' ? 'ro-MD' : 'ru-MD',
            timezoneId: 'Europe/Chisinau',
            serviceWorkers: 'block',
            reducedMotion: 'reduce',
          });
          const requests = new Map();
          const delivered = [];
          const pending = [];
          await context.route('**/*', (route) => {
            const url = new URL(route.request().url());
            if (url.origin !== origin) {
              blockedExternal++;
              return route.abort('blockedbyclient');
            }
            if (url.pathname.endsWith('.woff2')) {
              const name = url.pathname.split('/').at(-1);
              requests.set(name, (requests.get(name) ?? 0) + 1);
              if (fontMode === 'blocked') return route.abort('failed');
            }
            return route.continue();
          });
          const page = await context.newPage();
          page.on('pageerror', (e) => errors.push(e.message));
          page.on('response', (response) => {
            if (new URL(response.url()).pathname.endsWith('.woff2'))
              pending.push(
                (async () => {
                  const name = new URL(response.url()).pathname.split('/').at(-1);
                  const bytes = (await response.body()).length;
                  delivered.push({ name, bytes });
                  assert.equal(bytes, expectedBytes.get(name));
                })(),
              );
          });
          await page.clock.setFixedTime(new Date('2026-11-03T10:35:00Z'));
          await page.goto(`${origin}/?ui.k8k=1&locale=${locale}&role=${role}`);
          await page.locator('#glyph-ro').waitFor();
          assert.equal(await page.locator('html').getAttribute('data-k8k'), 'provisional');
          await page.evaluate(() => globalThis.document.fonts.ready);
          await Promise.all(pending);
          await page.evaluate(() => fetch('https://font-cdn.invalid/sentinel').catch(() => null));
          assert.equal(requests.size, 3);
          assert.ok(
            [...requests.values()].every((n) => n === 1),
            'one request per subset, not per component/weight',
          );
          assert.equal(
            delivered.reduce((sum, r) => sum + r.bytes, 0),
            fontMode === 'loaded' ? 63492 : 0,
          );
          const client = await context.newCDPSession(page);
          await client.send('DOM.enable');
          await client.send('CSS.enable');
          const doc = await client.send('DOM.getDocument');
          const glyphs = {};
          for (const id of ['glyph-ro', 'glyph-ru', 'glyph-nfd']) {
            const { nodeId } = await client.send('DOM.querySelector', {
              nodeId: doc.root.nodeId,
              selector: `#${id}`,
            });
            glyphs[id] = (await client.send('CSS.getPlatformFontsForNode', { nodeId })).fonts;
            assert.ok(glyphs[id].length > 0);
            if (id !== 'glyph-nfd')
              assert.ok(
                glyphs[id].every((f) => f.isCustomFont === (fontMode === 'loaded')),
                `${id} actual font selection`,
              );
          }
          const label = locale === 'ro' ? 'Deschide orarul' : 'Открыть расписание';
          const iconButton = page.getByRole('button', { name: label, exact: true }).first();
          await page.keyboard.press('Tab');
          assert.equal(
            await iconButton.evaluate(
              (e) => e === globalThis.document.activeElement && e.matches(':focus-visible'),
            ),
            true,
          );
          const ax = (await client.send('Accessibility.getFullAXTree')).nodes.filter(
            (n) => !n.ignored,
          );
          const namedButtons = ax.filter(
            (n) => n.role?.value === 'button' && n.name?.value === label,
          );
          assert.equal(namedButtons.length, 2);
          assert.equal(
            ax.filter((n) => n.role?.value === 'image').length,
            1,
            'only named Avatar appears; decorative SVGs absent',
          );
          const metrics = await page.evaluate(() => {
            const style = (selector) =>
              globalThis.getComputedStyle(globalThis.document.querySelector(selector));
            const avatar = globalThis.document.querySelector('.k8k-avatar');
            return {
              viewport: globalThis.innerWidth,
              scrollWidth: globalThis.document.documentElement.scrollWidth,
              bodySize: style('.k8k-body').fontSize,
              dataSize: style('.k8k-data').fontSize,
              family: style('.k8k-body').fontFamily,
              tabular: style('#numbers').fontVariantNumeric,
              avatarWidth: avatar.getBoundingClientRect().width,
              avatarName: avatar.getAttribute('aria-label'),
              roText: globalThis.document.querySelector('#glyph-ro').textContent,
              scale: [...globalThis.document.querySelectorAll('[data-scale]')].map(
                (e) => globalThis.getComputedStyle(e).fontSize,
              ),
              states: [...globalThis.document.querySelectorAll('.k8k-state')].map((e) =>
                e.getAttribute('data-state'),
              ),
            };
          });
          assert.ok(metrics.scrollWidth <= width);
          assert.equal(metrics.bodySize, '16px');
          assert.ok(parseFloat(metrics.dataSize) >= 14);
          assert.equal(metrics.tabular, 'tabular-nums');
          assert.equal(metrics.avatarWidth, 44);
          assert.equal(metrics.roText, 'șțăâîȘȚĂÂÎ');
          assert.deepEqual(metrics.scale, ['12px', '14px', '16px', '18px', '22px', '28px', '36px']);
          assert.equal(metrics.states.length, 10);
          const file = `${locale}-${width}-${role}-${fontMode}.png`;
          await page.screenshot({ path: path.join(run, file), fullPage: true });
          screenshots.push({
            locale,
            width,
            role,
            fontMode,
            file,
            sha256: sha(await fs.readFile(path.join(run, file))),
            route: '/synthetic-typography',
            requests: Object.fromEntries(requests),
            delivered,
            totalFontBodyBytes: delivered.reduce((sum, r) => sum + r.bytes, 0),
            glyphs,
            metrics,
            accessibleButtons: namedButtons.map((n) => ({
              role: n.role.value,
              name: n.name.value,
            })),
            decorativeSvgAbsentFromAX: true,
            existingGaps:
              'StateBoundary RU copy on RO remains TASK-012/015; actual screen reader speech not run',
          });
          await context.close();
        }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
assert.equal(errors.length, 0, JSON.stringify(errors));
assert.equal(blockedExternal, 32);
for (const e of sourceManifest)
  assert.equal(
    sha(await fs.readFile(path.join(root, e.path))),
    e.sha256,
    `Source unchanged: ${e.path}`,
  );
const summary = {
  passed: true,
  routes: rows.length,
  maxTotal: Math.max(...rows.map((r) => r.total)),
  fontBytes: 63492,
  fontDelta: 3544,
  screenshots: screenshots.length,
  externalSentinelsBlocked: blockedExternal,
  browserErrors: errors,
  sourceFiles: sourceManifest.length,
};
await write('visual.json', {
  basis,
  browser: browserVersion,
  network:
    'Only exact ephemeral loopback static origin; external fonts/CDN aborted; serviceworkers blocked; no cabinet APIs',
  screenshots,
  summary,
});
await write('verification.json', {
  basis,
  summary,
  method: METHOD,
  oldFontMethod: PREVIOUS_METHOD,
  lockfileUnchanged: true,
});
console.log(
  JSON.stringify({ run: path.relative(root, run).replaceAll('\\', '/'), ...summary }, null, 2),
);

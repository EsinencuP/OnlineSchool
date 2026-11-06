// TASK-005 source builds and local synthetic browser evidence. No env/DB/providers.
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
import { evaluateRoute, METHOD } from './k8k-route-budget-core.mjs';
import { measured, resolveTokens, contrast } from '../packages/ui/tests/contrast-contract.mjs';

const root = path.resolve(import.meta.dirname, '..');
const previous = 'output/k8k-tasks/TASK-004/runs/2026-11-03T21-10-19-078Z-0b1240';
const run = path.join(
  root,
  'output/k8k-tasks/TASK-005/runs',
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
assert.equal(before.method, METHOD);
const sourcePaths = new Set(before.basis.sourceManifest.map((e) => e.path));
for (const p of [
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
// Lockfile additions are dev tools only. Existing importer/resolution/snapshot values must survive.
const yamlReq = createRequire(req.resolve('vite'));
const { parse: parseYaml } = await import(pathToFileURL(yamlReq.resolve('yaml')));
const oldLock = parseYaml(
  await fs.readFile(path.join(root, 'output/k8k-tasks/TASK-005/before/pnpm-lock.yaml'), 'utf8'),
);
const newLock = parseYaml(await fs.readFile(path.join(root, 'pnpm-lock.yaml'), 'utf8'));
for (const section of ['importers', 'packages', 'snapshots'])
  for (const [key, value] of Object.entries(oldLock[section])) {
    if (section === 'importers' && key === '.') {
      const current = structuredClone(newLock.importers['.']);
      for (const name of ['culori', 'postcss-value-parser', 'stylelint'])
        delete current.devDependencies[name];
      assert.deepEqual(current, value, 'Only three root dev dependency additions');
    } else assert.deepEqual(newLock[section][key], value, `Existing lockfile ${section}/${key}`);
  }
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
for (const plan of before.routePlan) {
  const { manifest, assets } = assetsByApp.get(plan.app);
  const result = evaluateRoute({ manifest, seeds: plan.manifestSeeds, assets });
  assert.equal(
    result.method,
    METHOD,
    'TASK-005 only supports v1 fonts; use TASK-006 typography evidence for the expanded font policy',
  );
  assert.equal(result.pass, true, `${plan.id} route budget`);
  const old = before.rows.find((r) => r.inventoryId === plan.inventoryId);
  assert.ok(old);
  const optionalActions = [];
  if (plan.app === 'manager-web' && plan.manifestSeeds.includes('src/pages/Login.tsx'))
    for (const seed of manifest['src/pages/Login.tsx'].dynamicImports ?? []) {
      const action = evaluateRoute({ manifest, seeds: [...plan.manifestSeeds, seed], assets });
      assert.equal(action.pass, true);
      optionalActions.push({ name: 'passkey-browser-action', seed, ...action });
    }
  rows.push({
    ...plan,
    ...result,
    optionalActions,
    baselineRef: { path: previous, dirtyDigest: before.basis.dirtyDigest, method: METHOD },
    delta: {
      gzip: result.gzip - old.gzip,
      font: result.font.total - old.font.total,
      total: result.total - old.total,
    },
  });
}
assert.equal(rows.length, 48);
await write('bundle.json', {
  task: 'TASK-005',
  method: METHOD,
  basis,
  buildProvenance,
  manifests,
  routePlanSource: previous,
  comparison:
    'Same runtime/method/route seeds, all existing dependency resolutions preserved; three dev tools added; changed source inputs enumerated',
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
  root: path.join(root, 'packages/ui/tests/design'),
  configFile: false,
  envDir: false,
  publicDir: false,
  plugins: [react()],
  resolve: { alias, dedupe: ['react', 'react-dom'] },
  build: { outDir: fixtureDir, emptyOutDir: false },
  logLevel: 'error',
});
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
const screenshots = [];
const blocked = [];
const errors = [];
function rgb(css) {
  const values = css.match(/[\d.]+/g);
  return (
    '#' +
    values
      .slice(0, 3)
      .map((v) => Number(v).toString(16).padStart(2, '0'))
      .join('')
  );
}
try {
  for (const locale of ['ru', 'ro'])
    for (const width of [360, 768, 1024, 1280])
      for (const role of ['student', 'manager']) {
        const context = await browser.newContext({
          viewport: { width, height: 900 },
          locale: locale === 'ro' ? 'ro-MD' : 'ru-MD',
          timezoneId: 'Europe/Chisinau',
          reducedMotion: 'reduce',
          serviceWorkers: 'block',
        });
        await context.route('**/*', (route) => {
          const url = new URL(route.request().url());
          if (url.origin !== origin) {
            blocked.push(url.origin);
            return route.abort('blockedbyclient');
          }
          return route.continue();
        });
        const page = await context.newPage();
        page.on('pageerror', (e) => errors.push(e.message));
        await page.clock.setFixedTime(new Date('2026-11-03T10:35:00Z'));
        await page.goto(`${origin}/?ui.k8k=1&locale=${locale}&role=${role}`);
        assert.equal(await page.locator('html').getAttribute('data-k8k'), 'provisional');
        await page.locator('.design-sand').waitFor();
        await page.evaluate(() => globalThis.document.fonts.ready);
        await page.evaluate(() => fetch('https://baseline.invalid/sentinel').catch(() => null));
        const link = page.locator('a[data-surface="sand"]');
        // Reach the real sand link using Tab, preserving keyboard focus-visible semantics.
        let focused = false;
        for (let i = 0; i < 35; i++) {
          await page.keyboard.press('Tab');
          focused = await link.evaluate((e) => e === globalThis.document.activeElement);
          if (focused) break;
        }
        assert.equal(focused, true, 'keyboard reaches sand link');
        const focus = await link.evaluate((e) => {
          const s = globalThis.getComputedStyle(e);
          return {
            visible: e.matches(':focus-visible'),
            outline: s.outlineColor,
            width: s.outlineWidth,
            shadow: s.boxShadow,
            bg: globalThis.getComputedStyle(e.closest('.design-sand')).backgroundColor,
          };
        });
        await write('last-focus-probe.json', {
          locale,
          width,
          role,
          focus,
          rootAttributes: await page.locator('html').evaluate((e) => e.outerHTML.slice(0, 250)),
          styleSheets: await page.evaluate(() =>
            [...globalThis.document.styleSheets].map((s) => s.href),
          ),
        });
        assert.ok(focus.visible && parseFloat(focus.width) >= 2, JSON.stringify(focus));
        assert.ok(wcagContrast(rgb(focus.outline), rgb(focus.bg)) >= 3);
        const button = page.locator('[data-primary="white"]');
        await button.hover();
        const hover = await button.evaluate((e) => {
          const s = globalThis.getComputedStyle(e);
          return {
            color: s.color,
            bg: s.backgroundColor,
            height: e.getBoundingClientRect().height,
          };
        });
        assert.ok(wcagContrast(rgb(hover.color), rgb(hover.bg)) >= 4.5);
        assert.ok(hover.height >= (role === 'student' ? 48 : 44));
        const disabled = await page
          .locator('button:disabled')
          .first()
          .evaluate((e) => {
            const s = globalThis.getComputedStyle(e);
            return {
              color: s.color,
              bg: s.backgroundColor,
              opacity: s.opacity,
              disabled: e.disabled,
            };
          });
        assert.ok(disabled.disabled && disabled.opacity === '1');
        assert.ok(wcagContrast(rgb(disabled.color), rgb(disabled.bg)) >= 4.5);
        const actualLinks = await page.locator('a[data-surface]').evaluateAll((items) =>
          items.map((e) => ({
            color: globalThis.getComputedStyle(e).color,
            bg: globalThis.getComputedStyle(e.closest('.design-surface')).backgroundColor,
          })),
        );
        for (const linkColor of actualLinks)
          assert.ok(wcagContrast(rgb(linkColor.color), rgb(linkColor.bg)) >= 4.5);
        const actualError = await page
          .locator('[aria-invalid="true"]')
          .first()
          .evaluate((e) => ({
            border: globalThis.getComputedStyle(e).borderColor,
            bg: globalThis.getComputedStyle(e).backgroundColor,
          }));
        assert.equal(rgb(actualError.border), tokens['--danger']);
        assert.ok(wcagContrast(rgb(actualError.border), rgb(actualError.bg)) >= 3);
        const variantHovers = [];
        for (const variant of ['secondary', 'danger']) {
          const control = page.locator(`.k8k-button-${variant}`).first();
          await control.hover();
          const colors = await control.evaluate((e) => ({
            color: globalThis.getComputedStyle(e).color,
            bg: globalThis.getComputedStyle(e).backgroundColor,
          }));
          assert.ok(wcagContrast(rgb(colors.color), rgb(colors.bg)) >= 4.5);
          variantHovers.push({ variant, ...colors });
        }
        await button.hover();
        const overflow = await page.evaluate(() => ({
          viewport: globalThis.innerWidth,
          scrollWidth: globalThis.document.documentElement.scrollWidth,
        }));
        assert.ok(overflow.scrollWidth <= width);
        const chips = await page
          .locator('.k8k-status-chip')
          .evaluateAll((items) =>
            items.every((e) => e.textContent.trim() && e.querySelector('svg[aria-hidden="true"]')),
          );
        assert.ok(chips);
        const states = await page
          .locator('.k8k-state')
          .evaluateAll((items) => items.map((e) => e.getAttribute('data-state')));
        assert.equal(states.length, 10);
        const file = `${locale}-${width}-${role}.png`;
        await page.screenshot({ path: path.join(run, file), fullPage: true });
        screenshots.push({
          locale,
          width,
          role,
          route: '/synthetic-token-contract',
          fixture: 'packages/ui/tests/design/fixture.tsx',
          file,
          sha256: sha(await fs.readFile(path.join(run, file))),
          focus,
          hover,
          disabled,
          actualLinks,
          actualError,
          variantHovers,
          overflow,
          states,
          statusTextAndIcon: chips,
          legacyBoundaryTranslation: 'Existing StateBoundary RU copy remains on RO; TASK-012/015',
        });
        await context.close();
      }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
assert.equal(errors.length, 0, JSON.stringify(errors));
assert.equal(blocked.length, 16);
for (const e of sourceManifest)
  assert.equal(
    sha(await fs.readFile(path.join(root, e.path))),
    e.sha256,
    `Unchanged during run: ${e.path}`,
  );
const summary = {
  passed: true,
  routes: rows.length,
  maxTotal: Math.max(...rows.map((r) => r.total)),
  deltas: [...new Set(rows.map((r) => r.delta.total))],
  screenshots: screenshots.length,
  blockedSentinels: blocked.length,
  errors,
  sourceFiles: sourceManifest.length,
};
await write('visual.json', {
  basis,
  browser: browser.version(),
  network:
    'Exact ephemeral loopback origin only; all external requests aborted, serviceworkers blocked; no API routes',
  screenshots,
  summary,
});
await write('verification.json', {
  basis,
  summary,
  lockfileExistingEntriesUnchanged: true,
  legacyAcceptance: 'Palette provisional; UI-only evidence, not full product WCAG/i18n or FND-GATE',
});
console.log(
  JSON.stringify({ run: path.relative(root, run).replaceAll('\\', '/'), ...summary }, null, 2),
);

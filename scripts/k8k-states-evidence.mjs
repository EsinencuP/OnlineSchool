// TASK-012 source builds and local synthetic browser evidence. No env/DB/providers.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { evaluateRoute, FONT_METHOD_V2 as METHOD } from './k8k-route-budget-core.mjs';

const root = path.resolve(import.meta.dirname, '..');
const previous = 'output/k8k-tasks/TASK-011/runs/2026-11-04T05-04-04.818Z';
const run = path.join(
  root,
  'output/k8k-tasks/TASK-012/runs',
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
  'scripts/k8k-states-evidence.mjs',
  'packages/ui/tests/state.test.mjs',
  'packages/ui/stories/states.stories.tsx',
  'apps/manager-web/test/ui-states/fixture.tsx',
  'apps/manager-web/test/ui-states/fixture.css',
  'apps/manager-web/test/ui-states/index.html',
  'apps/manager-web/tsconfig.ui-states.json',
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
assert.equal(buildProvenance.lockfileSha256, before.buildProvenance.lockfileSha256);
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
  task: 'TASK-012',
  method: METHOD,
  basis,
  buildProvenance,
  manifests,
  routePlanSource: previous,
  comparison:
    'Same v2 font policy and Vite/runtime/closure/gzip/route seeds; same lockfile. State and freshness code deltas measured separately from fonts.',
  rows,
});

const fixtureDir = path.join(run, 'fixture');
await build({
  root: path.join(root, 'apps/manager-web/test/ui-states'),
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
    const relative = url.pathname.startsWith('/assets/')
      ? decodeURIComponent(url.pathname.slice(1))
      : 'index.html';
    const target = path.resolve(fixtureDir, relative);
    if (!target.startsWith(fixtureDir + path.sep)) throw Error('invalid fixture path');
    response.setHeader(
      'Content-Type',
      {
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.woff2': 'font/woff2',
        '.html': 'text/html',
      }[path.extname(target)] ?? 'application/octet-stream',
    );
    response.end(await fs.readFile(target));
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const version = browser.version(),
  requests = [],
  cases = [],
  screenshots = [],
  unexpected = [];
const asOf = '2026-11-04T07:40:00Z';
const receipt = '2026-11-04T08:12:00.000Z';
const cached = { items: ['Synthetic private fixture'], asOf };
async function setup(locale, width) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    locale: `${locale}-MD`,
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    timezoneId: 'Pacific/Honolulu',
  });
  await context.addInitScript(
    (locale) => globalThis.localStorage.setItem('k8k.locale', locale),
    locale,
  );
  let response = { status: 200, json: cached },
    gate,
    release = () => {};
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.origin !== origin || method !== 'GET') {
      unexpected.push(`${method} ${url.origin}${url.pathname}`);
      return route.abort();
    }
    if (url.pathname === '/fixture-state') {
      const reply = response;
      requests.push({ locale, width, path: url.pathname, method, status: reply.status });
      if (gate) await gate;
      return route.fulfill({ ...reply, headers: { 'Cache-Control': 'no-store' } });
    }
    if (url.pathname.startsWith('/api/')) {
      unexpected.push(url.pathname);
      return route.fulfill({ status: 501 });
    }
    return route.continue();
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(receipt));
  page.setDefaultTimeout(5000);
  page.on('pageerror', (error) => unexpected.push(error.message));
  page.on('console', (event) => {
    if (event.type() !== 'warning' && event.type() !== 'error') return;
    if (
      event.location().url === `${origin}/fixture-state` &&
      /status of (401|403|503)/.test(event.text())
    )
      return;
    unexpected.push(event.text());
  });
  const go = (mode = '', enabled = true) =>
    page.goto(`${origin}/?ui.k8k=${enabled ? '1' : '0'}&mode=${mode}`);
  const reply = (status, json = cached) => {
    response = { status, json };
  };
  const hold = () => {
    gate = new Promise((resolve) => {
      release = () => {
        gate = undefined;
        resolve();
      };
    });
  };
  return { context, page, go, reply, hold, release: () => release() };
}
async function capture(page, locale, width, scenario) {
  const file = `${locale}-${width}-${scenario}.png`;
  await page.evaluate(() => globalThis.document.fonts.ready);
  assert.ok(
    await page.evaluate(
      () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
    ),
  );
  await page.screenshot({ path: path.join(run, file), fullPage: true, animations: 'disabled' });
  screenshots.push({
    file,
    locale,
    width,
    scenario,
    role: 'fixture',
    route: '/',
    sha256: sha(await fs.readFile(path.join(run, file))),
  });
}
const emit = (page, event) =>
  page.evaluate((name) => globalThis.dispatchEvent(new Event(`fixture:${name}`)), event);
const waitState = (page, state) => page.locator(`.k8k-state[data-state="${state}"]`).waitFor();
const copy = {
  ru: {
    loading: /Загружаем/,
    empty: /Пока нет данных/,
    stale: /Последняя загрузка не вернула записей/,
    error: /Не удалось загрузить/,
    pending: /Результат действия пока неизвестен/,
    forbidden: /Нет доступа/,
    'subscription-limited': /Доступ к части/,
    'session-expired': /Сессия завершилась/,
  },
  ro: {
    loading: /Se încarcă/,
    empty: /Nu există încă date|Nu există date/,
    stale: /Ultima încărcare nu a returnat/,
    error: /Datele nu au putut fi încărcate|Nu s-au putut încărca/,
    pending: /Rezultatul acțiunii este încă necunoscut/,
    forbidden: /Nu ai acces|Accesul.*restricționat/,
    'subscription-limited': /Accesul la o parte/,
    'session-expired': /Sesiunea a expirat/,
  },
};
try {
  for (const locale of ['ru', 'ro'])
    for (const width of [360, 768, 1024, 1280]) {
      const { context, page, go, reply, hold, release } = await setup(locale, width);
      try {
        await go('catalog');
        await page.locator('[data-example="ready"]').waitFor();
        assert.equal(await page.locator('[data-example] .k8k-state').count(), 9);
        for (const [state, text] of Object.entries(copy[locale]))
          assert.match(
            await page.locator(`[data-example="${state}"] .k8k-state-message`).textContent(),
            text,
          );
        assert.equal(
          await page.locator('[data-example="loading"] .k8k-skeleton[aria-hidden="true"]').count(),
          1,
        );
        assert.equal(
          await page.locator('[data-example="subscription-limited"] [data-authorized]').count(),
          1,
        );
        assert.equal(await page.locator('.k8k-stages-track li').count(), 6);
        assert.equal(await page.locator('.k8k-stages-track [aria-current="step"]').count(), 1);
        assert.equal(
          await page.locator('[data-time-source="server"]').getAttribute('datetime'),
          '2026-11-04T07:40:00.000Z',
        );
        assert.match(
          await page.locator('[data-example="pending"] .k8k-freshness').textContent(),
          locale === 'ro' ? /nu este cunoscut/ : /неизвестно/,
        );
        await capture(page, locale, width, 'catalog');
        cases.push({
          locale,
          width,
          scenario: 'nine localized states, skeleton, authorized partial access and stages',
        });

        hold();
        await go();
        await waitState(page, 'loading');
        assert.equal(await page.locator('#draft').count(), 0);
        assert.doesNotMatch(
          await page.locator('.k8k-state-message').textContent(),
          copy[locale].empty,
        );
        release();
        await waitState(page, 'ready');
        const draft = page.locator('#draft');
        await draft.fill('Synthetic unsaved edit');
        await draft.focus();
        const original = await draft.elementHandle();
        const retain = async () => {
          assert.ok(
            await original.evaluate(
              (node) => node.isConnected && node === node.ownerDocument.activeElement,
            ),
          );
          assert.equal(await draft.inputValue(), 'Synthetic unsaved edit');
        };
        hold();
        await emit(page, 'refresh');
        await page.locator('.k8k-state-data[aria-busy="true"]').waitFor();
        await retain();
        release();
        await page.locator('.k8k-state-data[aria-busy="false"]').waitFor();
        await retain();
        reply(503);
        await emit(page, 'refresh');
        await waitState(page, 'stale');
        await retain();
        await emit(page, 'pending');
        await waitState(page, 'pending');
        await retain();
        await emit(page, 'unknown');
        await page.getByText(copy[locale].pending).waitFor();
        await retain();
        assert.equal(await page.locator('.k8k-state-message button').count(), 0);
        await capture(page, locale, width, 'retained-unknown');
        await emit(page, 'ready');
        await waitState(page, 'stale');
        reply(200);
        await page
          .getByRole('button', {
            name: locale === 'ro' ? 'Reîncearcă încărcarea' : 'Повторить загрузку',
          })
          .click();
        await waitState(page, 'ready');
        assert.equal(await page.locator('[data-retries]').textContent(), '1');
        assert.ok(await original.evaluate((node) => node.isConnected));
        assert.equal(await draft.inputValue(), 'Synthetic unsaved edit');
        cases.push({
          locale,
          width,
          scenario: 'real refetch and ready/stale/pending/unknown retain DOM and focus; read retry',
        });

        const status = width === 1280 ? 401 : 403;
        reply(status);
        await emit(page, 'refresh');
        await waitState(page, status === 401 ? 'session-expired' : 'forbidden');
        assert.equal(
          await page
            .locator('[data-private-content], [data-private-action], .k8k-freshness')
            .count(),
          0,
        );
        assert.ok(await original.evaluate((node) => !node.isConnected));
        cases.push({
          locale,
          width,
          scenario: 'cached denial removes the editor, private actions and freshness',
          status,
        });
      } finally {
        release();
        await context.close();
      }
    }
  for (const locale of ['ru', 'ro']) {
    const width = 360;
    const { context, page, go, reply, release } = await setup(locale, width);
    try {
      reply(200, { items: [] });
      await go();
      await waitState(page, 'empty');
      reply(503);
      await emit(page, 'refresh');
      await waitState(page, 'stale');
      assert.match(await page.locator('.k8k-state-message').textContent(), copy[locale].stale);
      assert.equal(await page.locator('#draft').count(), 0);
      cases.push({
        locale,
        width,
        scenario: 'cached empty becomes stale rather than a fresh empty state',
      });
      for (const mode of ['manager', 'student'])
        for (const enabled of [true, false]) {
          reply(200);
          await go(mode, enabled);
          const draft = page.locator('#draft');
          await draft.waitFor();
          if (enabled) {
            assert.equal(
              await page.locator('[data-time-source="client"]').getAttribute('datetime'),
              receipt,
            );
            const serverTime = page.locator('[data-time-source="server"]');
            assert.equal(await serverTime.count(), mode === 'student' ? 1 : 0);
            if (mode === 'student')
              assert.equal(await serverTime.getAttribute('datetime'), '2026-11-04T07:40:00.000Z');
          }
          const status = locale === 'ru' ? 403 : 401;
          reply(status);
          await emit(page, 'refresh');
          await waitState(page, status === 401 ? 'session-expired' : 'forbidden');
          assert.equal(
            await page.locator('[data-private-content], #draft, .k8k-freshness').count(),
            0,
          );
          cases.push({
            locale,
            width,
            role: mode,
            enabled,
            status,
            scenario: 'actual State/QueryState adapter strips cached private content',
          });
        }
    } finally {
      release();
      await context.close();
    }
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
assert.deepEqual(unexpected, []);
for (const entry of sourceManifest)
  assert.equal(sha(await fs.readFile(path.join(root, entry.path))), entry.sha256, entry.path);
const summary = {
  passed: true,
  browserCases: cases.length,
  screenshots: screenshots.length,
  routes: rows.length,
  maxTotal: Math.max(...rows.map((r) => r.total)),
  sourceFiles: sourceManifest.length,
  mockReads: requests.length,
  unexpected,
};
await write('visual.json', {
  basis,
  browser: version,
  cases,
  screenshots,
  requests,
  summary,
  network: 'Loopback GET fixtures only',
});
await write('verification.json', { basis, method: METHOD, summary });
await fs.writeFile(
  path.join(run, 'bundle.md'),
  '# TASK-012 — route budgets\n\nJS/CSS gzip9 and 63492 bytes of local WOFF2.\n\n| Route | Total | Δcode | Δfont |\n|---|---:|---:|---:|\n' +
    rows
      .map((r) => `| ${r.inventoryId} | ${r.total} | ${r.delta.gzip} | ${r.delta.font} |`)
      .join('\n') +
    '\n',
);
await fs.writeFile(
  path.join(run, 'gallery.html'),
  '<!doctype html><meta charset="utf-8"><title>TASK-012 fixtures</title><h1>TASK-012</h1>' +
    screenshots
      .map(
        ({ file }) =>
          `<figure><figcaption>${file}</figcaption><img style="max-width:100%" loading="lazy" src="${file}" alt="${file}"></figure>`,
      )
      .join('\n'),
);
console.log(
  JSON.stringify({ run: path.relative(root, run).replaceAll('\\', '/'), ...summary }, null, 2),
);

// TASK-010 source builds and local synthetic browser evidence. No env/DB/providers.
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
const previous = 'output/k8k-tasks/TASK-009/runs/2026-11-04T04-40-16.278Z';
const run = path.join(
  root,
  'output/k8k-tasks/TASK-010/runs',
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
  'scripts/k8k-tables-evidence.mjs',
  'packages/ui/tests/tables.test.mjs',
  'apps/manager-web/test/ui-tables/fixture.tsx',
  'apps/manager-web/test/ui-tables/fixture.css',
  'apps/manager-web/test/ui-tables/index.html',
  'apps/manager-web/tsconfig.ui-tables.json',
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
// New pinned TanStack dependencies change the lockfile; engine/config/font/closure policy stay identical.
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
  task: 'TASK-010',
  method: METHOD,
  basis,
  buildProvenance,
  manifests,
  routePlanSource: previous,
  comparison:
    'Same v2 font policy and Vite/runtime/closure/gzip/route seeds; pinned TanStack Table v8 added. DenseTable/Leads code and font deltas separated.',
  rows,
});

const fixtureDir = path.join(run, 'fixture');
await build({
  root: path.join(root, 'apps/manager-web/test/ui-tables'),
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
const exactAmount = '12345678901234567890.12345678901234567890';
const dataset = [
  { id: 'z', name: `Zina${'Ștefănescu'.repeat(8)}`, group: 'blue', amount: exactAmount },
  { id: 'a', name: 'Ana Sintetică', group: 'red', amount: '123.456789' },
  { id: 'm', name: 'Maria Sintetică', group: 'red', amount: '0.01' },
  { id: 'b', name: 'Bianca Sintetică', group: 'blue', amount: '9.99999' },
];
function fixturePage(params) {
  const filtered = dataset.filter((row) => !params.filter || row.group === params.filter);
  const sorted = params.direction
    ? [...filtered].sort(
        (a, b) => (params.direction === 'desc' ? -1 : 1) * a.name.localeCompare(b.name, 'ro-MD'),
      )
    : filtered;
  const offset = params.cursor === 'fixture-page-2' ? 2 : 0;
  const rows = sorted.slice(offset, offset + 2);
  const hasMore = offset + rows.length < sorted.length;
  return {
    rows,
    next: hasMore ? 'fixture-page-2' : null,
    previous: null,
    pageInfo: {
      total: params.total === 'known' ? sorted.length : null,
      hasMore,
      canFirst: offset > 0,
      canPrevious: offset > 0,
    },
    sort: params.direction ? { columnId: 'name', direction: params.direction } : null,
  };
}
function lead(id, name) {
  return {
    leadId: id,
    contactName: name,
    stage: 'NEW',
    audience: 'CHILD',
    source: 'SITE',
    subjectName: 'Fixture',
    maskedPhone: null,
    createdAt: '2026-11-04T09:00:00Z',
    stageChangedAt: '2026-11-04T09:00:00Z',
    trialAt: null,
    nextActionAt: null,
    isOverdue: false,
  };
}
async function setup(locale, width) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    locale: `${locale}-MD`,
    reducedMotion: 'reduce',
    hasTouch: width === 360,
    isMobile: width === 360,
    serviceWorkers: 'block',
    timezoneId: 'Europe/Chisinau',
  });
  await context.addInitScript(
    (locale) => globalThis.localStorage.setItem('k8k.locale', locale),
    locale,
  );
  let denied = false,
    release;
  const hold = new Promise((resolve) => {
    release = resolve;
  });
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.origin !== origin || method !== 'GET') {
      unexpected.push(`${method} ${url.origin}${url.pathname}`);
      return route.abort();
    }
    const params = Object.fromEntries(url.searchParams);
    const reply = (json, status = 200) => {
      requests.push({ locale, width, path: url.pathname, method, params, status });
      return route.fulfill({ status, headers: { 'Cache-Control': 'no-store' }, json });
    };
    if (url.pathname === '/fixture-table') {
      if (denied) return reply({ code: 'FORBIDDEN' }, 403);
      if (params.state === 'loading') await hold;
      return reply(fixturePage(params));
    }
    if (url.pathname === '/api/v1/manager/me') return reply({ timezone: 'Europe/Chisinau' });
    if (url.pathname === '/api/v1/manager/options') return reply({ subjects: [] });
    if (url.pathname === '/api/v1/manager/leads/summary')
      return reply({ countsByStage: {}, createdToday: 0, trialsToday: 0, conversion30dBp: 0 });
    if (url.pathname === '/api/v1/manager/leads') {
      if (params.cursor === 'opaque-leads-second')
        return reply({ items: [lead('fixture-later', 'Fixture later')], nextCursor: null });
      return reply({
        items: [lead('fixture-first', 'Fixture ' + (params.search ?? 'first'))],
        nextCursor: 'opaque-leads-second',
      });
    }
    if (url.pathname.startsWith('/api/')) {
      unexpected.push(url.pathname);
      return reply({ code: 'UNEXPECTED_FIXTURE_REQUEST' }, 501);
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5500);
  page.on('pageerror', (error) => unexpected.push(error.message));
  page.on('console', (event) => {
    if (event.type() !== 'warning' && event.type() !== 'error') return;
    if (
      event.location().url.startsWith(`${origin}/fixture-table`) &&
      /status of 403/.test(event.text())
    )
      return;
    unexpected.push(event.text());
  });
  const goto = (pathname = '/', suffix = '') => page.goto(`${origin}${pathname}?ui.k8k=1${suffix}`);
  return {
    context,
    page,
    goto,
    release,
    deny: () => {
      denied = true;
    },
  };
}
async function capture(page, locale, width, scenario, route = '/') {
  const file = `${locale}-${width}-${scenario}.png`;
  await page.screenshot({ path: path.join(run, file), fullPage: true, animations: 'disabled' });
  screenshots.push({
    file,
    locale,
    width,
    scenario,
    route,
    role: 'manager',
    sha256: sha(await fs.readFile(path.join(run, file))),
  });
}
async function geometry(page, width) {
  await page.evaluate(() => globalThis.document.fonts.ready);
  const result = await page.locator('.k8k-table-scroll').evaluate((region) => ({
    documentWidth: region.ownerDocument.documentElement.scrollWidth,
    regionWidth: region.clientWidth,
    contentWidth: region.scrollWidth,
    overflowingCells: [...region.querySelectorAll('th,td')].filter(
      (cell) => cell.scrollWidth > cell.clientWidth + 1,
    ).length,
  }));
  assert.ok(result.documentWidth <= width && result.overflowingCells === 0, JSON.stringify(result));
  if (width === 360)
    assert.ok(result.contentWidth > result.regionWidth, 'Mobile uses its own scroll region');
  return result;
}
try {
  for (const locale of ['ru', 'ro'])
    for (const width of [360, 768, 1024, 1280]) {
      const { context, page, goto, release, deny } = await setup(locale, width);
      try {
        const meta = { locale, width, role: 'manager', route: '/' };
        await goto('/', '&state=loading&pending=1');
        const table = page.locator('.k8k-dense-table');
        await page.locator('table[aria-busy="true"]').waitFor();
        assert.equal(await table.locator('tbody tr').count(), 0);
        assert.equal(await page.locator('.k8k-table-footer').count(), 0);
        assert.ok(await page.locator('.k8k-table-state').isVisible());
        assert.ok(await page.locator('.k8k-kanban-list[aria-busy="true"]').count());
        await capture(page, locale, width, 'loading');
        release();
        const z = page.getByRole('checkbox', {
          name: locale === 'ro' ? 'Selectează z' : 'Выбрать z',
        });
        await z.waitFor();
        await z.check();
        assert.deepEqual(
          await table
            .locator('tbody tr')
            .evaluateAll((rows) => rows.map((r) => r.querySelector('a')?.getAttribute('href'))),
          ['/objects/z', '/objects/a'],
        );
        assert.equal(await page.locator('[data-amount]').first().textContent(), exactAmount);
        assert.ok(
          await page
            .getByText(
              locale === 'ro' ? 'Numărul total nu este cunoscut' : 'Общее число неизвестно',
              { exact: true },
            )
            .first()
            .isVisible(),
        );
        const next = page.getByRole('button', {
          name: locale === 'ro' ? 'Pagina următoare' : 'Следующая страница',
        });
        assert.ok(await next.isVisible());
        const shape = await geometry(page, width);
        await capture(page, locale, width, 'cursor-unknown');
        await next.click();
        await page
          .getByRole('checkbox', { name: locale === 'ro' ? 'Selectează b' : 'Выбрать b' })
          .waitFor();
        assert.equal(await next.count(), 0);
        assert.doesNotMatch(
          await page.locator('.k8k-table-footer').textContent(),
          /последняя|ultima|\d+\s*\/\s*\d+/i,
        );
        const first = page.getByRole('button', {
          name: locale === 'ro' ? 'Prima pagină' : 'Первая страница',
        });
        await first.click();
        await z.waitFor();
        assert.ok(await z.isChecked());
        cases.push({
          ...meta,
          scenario: 'loading, cursor unknown total, stable selection',
          geometry: shape,
        });

        const sort = table.getByRole('button', { name: locale === 'ro' ? 'Nume' : 'Имя' });
        await sort.focus();
        await page.keyboard.press('Enter');
        await table.locator('th[aria-sort="ascending"]').waitFor();
        assert.deepEqual(
          await table
            .locator('tbody tr')
            .evaluateAll((rows) => rows.map((r) => r.querySelector('a')?.getAttribute('href'))),
          ['/objects/a', '/objects/b'],
        );
        assert.ok(await sort.evaluate((el) => el === el.ownerDocument.activeElement));
        await page.keyboard.press('Space');
        await table.locator('th[aria-sort="descending"]').waitFor();
        await z.waitFor();
        assert.ok(await z.isChecked());
        cases.push({
          ...meta,
          scenario: 'keyboard sort, aria-sort reflects server, full-dataset order',
        });

        const filter = page.locator('input[name="filter"]');
        await filter.fill('blue');
        await page.locator('.fixture-filter button[type="submit"]').click();
        await page.waitForURL(/filter=blue/);
        await table.getByText('Bianca Sintetică').waitFor();
        assert.equal(await next.count(), 0);
        const action = table.locator('[data-row-action]').last();
        await action.focus();
        if (width === 360)
          assert.ok(await page.locator('.k8k-table-scroll').evaluate((el) => el.scrollLeft > 0));
        await page.keyboard.press('Enter');
        await page.waitForURL('**/objects/b');
        await page.goBack();
        await table.getByText('Bianca Sintetică').waitFor();
        assert.equal(await filter.inputValue(), 'blue');
        assert.equal(new URL(page.url()).searchParams.get('direction'), 'desc');
        assert.ok(await z.isChecked());
        cases.push({
          ...meta,
          scenario: 'server filter, ordinary mobile link, Back restores filter/sort/ID selection',
        });

        deny();
        await page.evaluate(() => globalThis.dispatchEvent(new Event('fixture:refresh')));
        await page.locator('.k8k-table-state[data-state="forbidden"]').waitFor();
        assert.equal(await table.count(), 0);
        assert.equal(await z.count(), 0);
        assert.equal(await page.getByText('Bianca Sintetică').count(), 0);
        assert.equal(await page.locator('[data-row-action], .k8k-table-footer').count(), 0);
        await capture(page, locale, width, '403');
        cases.push({
          ...meta,
          scenario: '403 after successful read removes cached rows and actions',
        });
      } finally {
        release();
        await context.close();
      }
    }
  for (const [locale, width] of [
    ['ru', 360],
    ['ro', 1280],
  ]) {
    const { context, page, goto, release } = await setup(locale, width);
    try {
      await goto('/manager/leads');
      const table = page.locator('.k8k-dense-table');
      await table.getByRole('link', { name: 'Fixture first' }).waitFor();
      assert.equal(await table.getByRole('columnheader').count(), 7);
      assert.equal(await table.getByRole('button').count(), 0);
      const search = page.locator('input[name="search"]');
      await search.fill('alpha');
      await page.locator('.filters button[type="submit"]').click();
      await table.getByRole('link', { name: 'Fixture alpha' }).waitFor();
      const next = page.getByRole('button', {
        name: locale === 'ro' ? 'Pagina următoare' : 'Следующая страница',
      });
      await next.click();
      await table.getByRole('link', { name: 'Fixture later' }).click();
      await page.waitForURL('**/manager/leads/fixture-later');
      await page.goBack();
      await table.getByRole('link', { name: 'Fixture later' }).waitFor();
      const url = new URL(page.url());
      assert.equal(url.searchParams.get('search'), 'alpha');
      assert.equal(url.searchParams.get('cursor'), 'opaque-leads-second');
      assert.equal(await search.inputValue(), 'alpha');
      assert.ok(
        requests.some(
          (r) =>
            r.path === '/api/v1/manager/leads' &&
            r.locale === locale &&
            r.params.search === 'alpha' &&
            r.params.cursor === 'opaque-leads-second',
        ),
      );
      await geometry(page, width);
      await capture(page, locale, width, 'crm-leads', '/manager/leads');
      cases.push({
        locale,
        width,
        route: '/manager/leads',
        role: 'manager',
        scenario: 'actual Leads uses API cursor and object link',
      });
      await goto('/', '&total=known&filter=missing');
      await page.locator('.k8k-table-shell[data-state="empty"]').waitFor();
      assert.match(
        await page.locator('.k8k-table-footer').textContent(),
        locale === 'ro' ? /Total 0/ : /Всего 0/,
      );
      assert.equal(await page.locator('table[aria-busy="true"]').count(), 0);
      cases.push({
        locale,
        width,
        route: '/',
        role: 'manager',
        scenario: 'known total zero, distinct empty state',
      });
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
  '# TASK-010 — route budgets\n\nJS/CSS gzip9 and 63492 bytes of local WOFF2.\n\n| Route | Total | Δcode | Δfont |\n|---|---:|---:|---:|\n' +
    rows
      .map((r) => `| ${r.inventoryId} | ${r.total} | ${r.delta.gzip} | ${r.delta.font} |`)
      .join('\n') +
    '\n',
);
await fs.writeFile(
  path.join(run, 'gallery.html'),
  '<!doctype html><meta charset="utf-8"><title>TASK-010 fixtures</title><h1>TASK-010</h1>' +
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

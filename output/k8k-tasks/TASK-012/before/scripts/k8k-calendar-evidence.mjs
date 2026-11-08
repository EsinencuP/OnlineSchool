// TASK-011 source builds and local synthetic browser evidence. No env/DB/providers.
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
const previous = 'output/k8k-tasks/TASK-010/runs/2026-11-04T04-50-46.028Z';
const run = path.join(
  root,
  'output/k8k-tasks/TASK-011/runs',
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
  'scripts/k8k-calendar-evidence.mjs',
  'packages/ui/tests/calendar.test.mjs',
  'apps/manager-web/test/ui-calendar/fixture.tsx',
  'apps/manager-web/test/ui-calendar/fixture.css',
  'apps/manager-web/test/ui-calendar/index.html',
  'apps/manager-web/tsconfig.ui-calendar.json',
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
// The existing Temporal pin is added to the UI importer; engine/config/font/closure policy stay identical.
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
  task: 'TASK-011',
  method: METHOD,
  basis,
  buildProvenance,
  manifests,
  routePlanSource: previous,
  comparison:
    'Same v2 font policy and Vite/runtime/closure/gzip/route seeds; existing Temporal pin shared with UI. Calendar and URL code deltas measured separately from fonts.',
  rows,
});

const fixtureDir = path.join(run, 'fixture');
await build({
  root: path.join(root, 'apps/manager-web/test/ui-calendar'),
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
const lesson = {
  lessonId: 'fixture-lesson',
  studentId: 'fixture-student',
  teacherId: 'fixture-teacher',
  teacherName: 'Fixture teacher',
  startsAt: '2026-10-25T00:30:00Z',
  endsAt: '2026-10-25T01:30:00Z',
  status: 'SCHEDULED',
  meetLink: null,
  subscriptionId: null,
  chargedLessons: 0,
  pendingChangeId: null,
  requiresApproval: false,
};
async function setup(locale, width) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    locale: `${locale}-MD`,
    reducedMotion: 'reduce',
    hasTouch: width === 360,
    isMobile: width === 360,
    serviceWorkers: 'block',
    timezoneId: 'America/Los_Angeles',
  });
  await context.addInitScript(
    (locale) => globalThis.localStorage.setItem('k8k.locale', locale),
    locale,
  );
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.origin !== origin || method !== 'GET') {
      unexpected.push(`${method} ${url.origin}${url.pathname}`);
      return route.abort();
    }
    const params = Object.fromEntries(url.searchParams);
    const reply = (json) => {
      requests.push({ locale, width, path: url.pathname, method, params });
      return route.fulfill({ status: 200, headers: { 'Cache-Control': 'no-store' }, json });
    };
    if (url.pathname === '/api/v1/manager/me') return reply({ timezone: 'Europe/Chisinau' });
    if (url.pathname === '/api/v1/manager/options')
      return reply({ students: [{ id: 'fixture-student', label: 'Fixture student' }] });
    if (url.pathname === '/api/v1/manager/schedule')
      return reply([{ ...lesson, kind: params.kind === 'TRIAL' ? 'TRIAL' : 'REGULAR' }]);
    if (url.pathname === '/api/v1/student/lessons')
      return reply({ items: [], total: 0, page: 1, pageSize: 20 });
    if (url.pathname.startsWith('/api/')) {
      unexpected.push(url.pathname);
      return route.fulfill({ status: 501 });
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5500);
  page.on('pageerror', (error) => unexpected.push(error.message));
  page.on('console', (event) => {
    if (event.type() === 'warning' || event.type() === 'error') unexpected.push(event.text());
  });
  const goto = (pathname = '/', suffix = '') => page.goto(`${origin}${pathname}?ui.k8k=1${suffix}`);
  return { context, page, goto };
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
    role: route.startsWith('/student') ? 'student' : 'manager',
    sha256: sha(await fs.readFile(path.join(run, file))),
  });
}
async function geometry(page, width) {
  await page.evaluate(() => globalThis.document.fonts.ready);
  const geometry = await page.evaluate(() => ({
    width: globalThis.innerWidth,
    scrollWidth: globalThis.document.documentElement.scrollWidth,
  }));
  assert.ok(geometry.scrollWidth <= width, JSON.stringify(geometry));
}
const utc = (page) =>
  page
    .locator('.k8k-calendar time')
    .evaluateAll((elements) => elements.map((element) => element.dateTime));
try {
  for (const locale of ['ru', 'ro'])
    for (const width of [360, 768, 1024, 1280]) {
      const { context, page, goto } = await setup(locale, width);
      try {
        await goto();
        const date = page.locator('#validity'),
          wall = page.locator('#wall-time'),
          value = page.locator('[data-instant]');
        const ro = locale === 'ro';
        const event = (id) => page.locator(`[data-event-id="${id}"]`);
        await event('protected').waitFor();
        assert.match(await event('protected').locator('time').first().textContent(), /03:30.*\+3/);
        assert.match(await event('renewal').locator('time').first().textContent(), /03:30.*\+2/);
        assert.equal(await event('renewal').getAttribute('data-revision'), '9');
        assert.match(
          await event('renewal').textContent(),
          ro ? /așteptarea reînnoirii/ : /Ожидает продления/,
        );
        assert.doesNotMatch(await event('renewal').textContent(), /\bLiber\b|Свободно/);
        assert.equal(await event('boundary').getAttribute('data-event-state'), 'unknown');
        assert.equal(await event('outside').count(), 0);
        assert.match(
          await page.locator('[data-date="2026-10-27"]').textContent(),
          ro ? /în afara intervalului/ : /вне загруженного/,
        );
        assert.match(
          await page.locator('[data-date="2026-10-24"]').textContent(),
          ro ? /Nu există evenimente/ : /нет событий/,
        );
        assert.match(
          await page.locator('[data-date="2026-10-25"] h3').textContent(),
          ro ? /octombrie/ : /октября/,
        );
        await geometry(page, width);
        await capture(page, locale, width, 'calendar-horizon');
        const before = await utc(page);
        const newWidth = width === 360 ? 1280 : 360;
        await page.setViewportSize({ width: newWidth, height: 900 });
        assert.deepEqual(await utc(page), before);
        await geometry(page, newWidth);
        await page.setViewportSize({ width, height: 900 });
        cases.push({
          locale,
          width,
          scenario: 'localized labels, horizon, protected and renewal states, UTC across resize',
        });

        assert.equal(await value.getAttribute('data-valid'), 'false');
        await wall.fill('2026-03-29T03:30');
        assert.equal(await value.getAttribute('data-valid'), 'false');
        await wall.fill('2026-03-29T04:30');
        assert.equal(await value.textContent(), '2026-03-29T04:30:00+03:00');
        await page
          .getByRole('button', { name: ro ? 'Data următoare' : 'Следующая дата' })
          .press('Enter');
        assert.equal(await date.inputValue(), '2026-10-26');
        await page
          .getByRole('button', { name: ro ? 'Data precedentă' : 'Предыдущая дата' })
          .press('Space');
        assert.equal(await date.inputValue(), '2026-10-25');
        const hint = page.locator('#validity-description');
        const plain = await hint.textContent();
        assert.match(plain, ro ? /octombrie/ : /октября/);
        await page.locator('[data-zone]').click();
        assert.equal(await date.inputValue(), '2026-10-25');
        assert.equal(await hint.textContent(), plain);
        assert.match(await page.locator('.k8k-calendar-zone').textContent(), /Pacific\/Honolulu/);
        assert.equal(
          await event('protected').locator('time').first().getAttribute('datetime'),
          '2026-10-25T00:30:00Z',
        );
        await date.focus();
        await page.evaluate(() => globalThis.dispatchEvent(new Event('fixture:refresh')));
        await page.locator('.k8k-calendar[aria-busy="true"]').waitFor();
        assert.ok(
          await date.evaluate((element) => element === element.ownerDocument.activeElement),
        );
        assert.equal(await date.inputValue(), '2026-10-25');
        cases.push({
          locale,
          width,
          scenario:
            'DST gap/overlap rejected, native keyboard date, date-only zone independence and focus',
        });
      } finally {
        await context.close();
      }
    }
  for (const [locale, width] of [
    ['ru', 360],
    ['ro', 1280],
  ]) {
    const { context, page, goto } = await setup(locale, width);
    try {
      await goto('/manager/schedule', '&date=2026-10-25&view=day&kind=TRIAL');
      const date = page.locator('input[name="calendarDate"]');
      await page.locator('[data-event-id="fixture-lesson"]').waitFor();
      assert.equal(await date.inputValue(), '2026-10-25');
      assert.ok(
        requests.some(
          (r) =>
            r.locale === locale &&
            r.path === '/api/v1/manager/schedule' &&
            r.params.from === '2026-10-25T00:00:00+03:00' &&
            r.params.to === '2026-10-26T00:00:00+02:00' &&
            r.params.kind === 'TRIAL',
        ),
      );
      const action = page.locator('.lesson-card .actions button').first();
      await action.focus();
      const element = await action.elementHandle();
      const refetch = page.waitForResponse(
        (response) => new URL(response.url()).pathname === '/api/v1/manager/schedule',
      );
      await page.evaluate(() => globalThis.dispatchEvent(new Event('fixture:refetch-schedule')));
      await refetch;
      await page.locator('.k8k-calendar:not([aria-busy="true"])').waitFor();
      assert.ok(await element.evaluate((node) => node === node.ownerDocument.activeElement));
      assert.equal(await date.inputValue(), '2026-10-25');
      await page.locator('select[name="view"]').selectOption('week');
      await page.locator('.k8k-calendar[data-view="week"]').waitFor();
      await page.goBack();
      await page.locator('.k8k-calendar[data-view="day"]').waitFor();
      assert.equal(await date.inputValue(), '2026-10-25');
      assert.equal(await page.locator('select[name="kind"]').inputValue(), 'TRIAL');
      await geometry(page, width);
      await capture(page, locale, width, 'manager-schedule', '/manager/schedule');
      cases.push({
        locale,
        width,
        scenario: 'real Schedule with 25-hour range, read refetch focus and Back',
      });

      await goto('/student/lessons', '&view=calendar&month=2026-10');
      const month = page.locator('input[type="month"]');
      assert.equal(await month.inputValue(), '2026-10');
      await month.fill('2026-11');
      await page.waitForURL(/month=2026-11/);
      const list = page.getByRole('radio', { name: locale === 'ro' ? 'Listă' : 'Список' });
      await list.click();
      await page.waitForURL(/view=list/);
      await page.locator('input[type="month"]').waitFor({ state: 'detached' });
      assert.ok(await list.isChecked());
      assert.equal(new URL(page.url()).searchParams.get('month'), '2026-11');
      await page.goBack();
      await month.waitFor();
      assert.equal(await month.inputValue(), '2026-11');
      assert.ok(
        requests.some(
          (r) =>
            r.locale === locale &&
            r.path === '/api/v1/student/lessons' &&
            r.params.month === '2026-11',
        ),
      );
      cases.push({ locale, width, scenario: 'real student calendar/list month survives Back' });
    } finally {
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
  browserTimeZone: 'America/Los_Angeles',
  cases,
  screenshots,
  requests,
  summary,
  network: 'Loopback GET fixtures only',
});
await write('verification.json', { basis, method: METHOD, summary });
await fs.writeFile(
  path.join(run, 'bundle.md'),
  '# TASK-011 — route budgets\n\nJS/CSS gzip9 and 63492 bytes of local WOFF2.\n\n| Route | Total | Δcode | Δfont |\n|---|---:|---:|---:|\n' +
    rows
      .map((r) => `| ${r.inventoryId} | ${r.total} | ${r.delta.gzip} | ${r.delta.font} |`)
      .join('\n') +
    '\n',
);
await fs.writeFile(
  path.join(run, 'gallery.html'),
  '<!doctype html><meta charset="utf-8"><title>TASK-011 fixtures</title><h1>TASK-011</h1>' +
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

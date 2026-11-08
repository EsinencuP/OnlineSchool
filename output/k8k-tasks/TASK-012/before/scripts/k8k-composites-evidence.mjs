// TASK-009 source builds and local synthetic browser evidence. No env/DB/providers.
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
const previous = 'output/k8k-tasks/TASK-008/runs/2026-11-03T22-51-32.206Z';
const run = path.join(
  root,
  'output/k8k-tasks/TASK-009/runs',
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
  'scripts/k8k-composites-evidence.mjs',
  'packages/ui/tests/composites.test.mjs',
  'packages/ui/stories/composites.stories.tsx',
  'packages/ui/stories/composites.css',
  'apps/student-cabinet/tests/ui-composites/fixture.tsx',
  'apps/student-cabinet/tests/ui-composites/index.html',
  'apps/student-cabinet/tsconfig.ui-composites.json',
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
// New pinned Radix dependencies change the lockfile; engine/config/font/closure policy stay identical.
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
  task: 'TASK-009',
  method: METHOD,
  basis,
  buildProvenance,
  manifests,
  routePlanSource: previous,
  comparison:
    'Same v2 font policy and Vite/runtime/closure/gzip/route seeds; pinned Radix Tabs/Tooltip added. Composite controls code and font deltas separated.',
  rows,
});

const fixtureDir = path.join(run, 'fixture');
await build({
  root: path.join(root, 'apps/student-cabinet/tests/ui-composites'),
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
    const relative = decodeURIComponent(url.pathname).slice(1) || 'index.html';
    const target = path.resolve(fixtureDir, relative);
    if (!target.startsWith(fixtureDir + path.sep)) throw Error('invalid fixture path');
    const bytes = await fs.readFile(target);
    const mime = {
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.woff2': 'font/woff2',
      '.html': 'text/html',
    };
    response.setHeader('Content-Type', mime[path.extname(target)] ?? 'application/octet-stream');
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
const cases = [],
  screenshots = [],
  unexpected = [],
  requests = [];
const replies = { queued: 202, unknown: 504, error: 422, confirmed: 200 };
async function setup(locale, width, touch = false) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    locale: `${locale}-MD`,
    reducedMotion: 'reduce',
    hasTouch: touch,
    isMobile: touch,
    serviceWorkers: 'block',
    timezoneId: 'Europe/Chisinau',
  });
  await context.addInitScript(
    (locale) => globalThis.localStorage.setItem('k8k.locale', locale),
    locale,
  );
  let releaseConfirmed;
  const confirmedGate = new Promise((resolve) => {
    releaseConfirmed = resolve;
  });
  let confirmedStarted = false;
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) {
      unexpected.push(`external:${url.origin}`);
      return route.abort();
    }
    const method = route.request().method();
    const params = Object.fromEntries(url.searchParams);
    if (method === 'GET' && url.pathname === '/api/v1/student/lessons') {
      requests.push({ locale, width, kind: 'lessons', method, params });
      return route.fulfill({
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
        json: { items: [], page: 1, pageSize: 20, total: 0 },
      });
    }
    if (
      method === 'GET' &&
      url.pathname === '/fixture-result' &&
      Object.hasOwn(replies, params.outcome)
    ) {
      const status = replies[params.outcome];
      requests.push({ locale, width, kind: 'synthetic-result', method, status });
      if (params.outcome === 'confirmed') {
        confirmedStarted = true;
        await confirmedGate;
      }
      return route.fulfill({
        status,
        headers: { 'Cache-Control': 'no-store' },
        json: { synthetic: true },
      });
    }
    if (
      url.pathname.startsWith('/api/') ||
      url.pathname === '/fixture-result' ||
      method !== 'GET'
    ) {
      unexpected.push(`${method} ${url.pathname}`);
      return route.fulfill({ status: 501, json: { code: 'UNEXPECTED_FIXTURE_REQUEST' } });
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.on('pageerror', (e) => unexpected.push(e.message));
  page.on('console', (event) => {
    if (event.type() !== 'warning' && event.type() !== 'error') return;
    const url = event.location().url;
    if (
      url.startsWith(`${origin}/fixture-result?outcome=`) &&
      /status of (422|504)/.test(event.text())
    )
      return;
    unexpected.push(event.text());
  });
  const go = (kind = '') => page.goto(`${origin}/?ui.k8k=1&locale=${locale}&kind=${kind}`);
  return { context, page, go, releaseConfirmed, confirmedStarted: () => confirmedStarted };
}
async function capture(page, metadata) {
  const name = `${metadata.locale}-${metadata.width}-${metadata.kind}.png`;
  const fullPage = ['queued-202', 'unknown-and-error'].includes(metadata.kind);
  await page.screenshot({ path: path.join(run, name), animations: 'disabled', fullPage });
  screenshots.push({
    ...metadata,
    file: name,
    sha256: sha(await fs.readFile(path.join(run, name))),
  });
}
const active = (locator) => locator.evaluate((e) => e === e.ownerDocument.activeElement);
const event = (page, name) =>
  page.evaluate((name) => globalThis.dispatchEvent(new Event(name)), name);
async function waitForFocus(page, locator) {
  const id = await locator.getAttribute('id');
  assert.ok(id);
  await page.waitForFunction((id) => globalThis.document.activeElement?.id === id, id);
}
async function layout(page, width) {
  await page.evaluate(() => globalThis.document.fonts.ready);
  const geometry = await page.evaluate(() => ({
    width: globalThis.innerWidth,
    scroll: globalThis.document.documentElement.scrollWidth,
    outside: [
      ...globalThis.document.querySelectorAll(
        '.k8k-tab-trigger, .k8k-segment-option, .k8k-information-card, .k8k-toast, .k8k-tooltip',
      ),
    ].some((e) => {
      const rect = e.getBoundingClientRect();
      return (
        rect.width > 0 &&
        (rect.left < -1 ||
          rect.right > globalThis.innerWidth + 1 ||
          e.scrollWidth > e.clientWidth + 1)
      );
    }),
    reduced: globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches,
    motion: [
      ...globalThis.document.querySelectorAll('.k8k-tab-panel, .k8k-tooltip, .k8k-toast'),
    ].some((e) => {
      const style = globalThis.getComputedStyle(e);
      return [...style.animationDuration.split(','), ...style.transitionDuration.split(',')].some(
        (duration) => parseFloat(duration) > 0,
      );
    }),
  }));
  assert.ok(
    geometry.scroll <= width && !geometry.outside && geometry.reduced && !geometry.motion,
    JSON.stringify(geometry),
  );
  return geometry;
}
try {
  for (const locale of ['ru', 'ro'])
    for (const width of [360, 768, 1024, 1280]) {
      const { context, page, go, releaseConfirmed, confirmedStarted } = await setup(locale, width);
      try {
        await go();
        const meta = { locale, width, role: 'manager-fixture' };
        const tabs = page.getByRole('tab'),
          form = tabs.nth(0),
          disabled = tabs.nth(1),
          details = tabs.nth(2);
        const draft = page.locator('#synthetic-draft');
        await draft.fill('Synthetic Ștefan');
        const ids = await tabs.evaluateAll((elements) =>
          elements.map((el) => ({
            id: el.id,
            panel: el.getAttribute('aria-controls'),
            labelled: el.ownerDocument
              .getElementById(el.getAttribute('aria-controls'))
              ?.getAttribute('aria-labelledby'),
          })),
        );
        assert.equal(new Set(ids.map((item) => item.id)).size, 3);
        assert.ok(ids.every((item) => item.panel && item.labelled === item.id));
        assert.ok(await disabled.isDisabled());
        await form.press('ArrowRight');
        await waitForFocus(page, details);
        assert.equal(await form.getAttribute('aria-selected'), 'true');
        await page.keyboard.press('Home');
        await waitForFocus(page, form);
        await page.keyboard.press('End');
        await waitForFocus(page, details);
        await page.keyboard.press('Enter');
        assert.equal(await details.getAttribute('aria-selected'), 'true');
        assert.equal(await draft.count(), 1);
        assert.equal(await draft.isVisible(), false);
        await details.press('ArrowLeft');
        await waitForFocus(page, form);
        await page.keyboard.press('Space');
        assert.equal(await draft.inputValue(), 'Synthetic Ștefan');
        assert.deepEqual(
          await tabs.evaluateAll((elements) => elements.map((el) => el.id)),
          ids.map((item) => item.id),
        );
        cases.push({ ...meta, kind: 'Tabs manual keyboard, stable IDs, keep-mounted', pass: true });

        const help = page.getByRole('button', {
          name: locale === 'ro' ? 'Explicație suplimentară' : 'Дополнительное пояснение',
        });
        const reason = page.locator('.composite-help .k8k-control-reason');
        assert.ok(await reason.isVisible());
        assert.equal(
          await page.locator('.composite-help button:disabled').getAttribute('aria-describedby'),
          await reason.getAttribute('id'),
        );
        await help.focus();
        await page.locator('.k8k-tooltip').waitFor();
        const tipId = await help.getAttribute('aria-describedby');
        assert.equal(await page.getByRole('tooltip').getAttribute('id'), tipId);
        await layout(page, width);
        await capture(page, { ...meta, kind: 'tooltip-keyboard' });
        await page.keyboard.press('Escape');
        await page.locator('.k8k-tooltip').waitFor({ state: 'detached' });
        assert.ok(await active(help));
        await draft.focus();
        await help.hover();
        await page.locator('.k8k-tooltip').waitFor();
        await page.locator('.k8k-tooltip').hover();
        await page.mouse.move(1, 1, { steps: 8 });
        await page.locator('.k8k-tooltip').waitFor({ state: 'detached' });
        cases.push({
          ...meta,
          kind: 'Tooltip keyboard, hover, Escape, visible disabled reason',
          pass: true,
        });

        await page.evaluate(() => {
          globalThis.fixtureAnnouncements = [];
          for (const region of globalThis.document.querySelectorAll('[data-toast-live]')) {
            const observer = new globalThis.MutationObserver(() => {
              if (region.textContent.trim())
                globalThis.fixtureAnnouncements.push({
                  severity: region.dataset.toastLive,
                  text: region.textContent.trim(),
                });
            });
            observer.observe(region, { childList: true, characterData: true, subtree: true });
          }
        });
        const log = () => page.evaluate(() => globalThis.fixtureAnnouncements);
        const send = (outcome) => page.locator(`[data-reply="${outcome}"]`);
        const toast = (outcome) => page.locator(`[data-outcome="${outcome}"]`);
        await send('queued').click();
        await toast('queued').waitFor();
        await page.waitForFunction(() => globalThis.fixtureAnnouncements.length === 1);
        assert.equal(await toast('queued').getAttribute('data-tone'), 'info');
        assert.equal(await page.locator('[data-tone="success"]').count(), 0);
        await event(page, 'fixture:replay');
        for (let n = 0; n < 4; n++) await event(page, 'fixture:tick');
        await page.waitForFunction(() =>
          globalThis.document.querySelector('[data-ticks]').textContent.endsWith('4'),
        );
        assert.equal(await toast('queued').count(), 1);
        assert.ok(await active(send('queued')));
        assert.equal((await log()).length, 1);
        await capture(page, { ...meta, kind: 'queued-202' });
        await toast('queued').getByRole('button').click();
        await toast('queued').waitFor({ state: 'detached' });
        await page.waitForFunction(
          () => !globalThis.document.querySelector('[data-toast-live="polite"]').textContent.trim(),
        );
        await event(page, 'fixture:replay');
        await toast('queued').waitFor();
        assert.equal((await log()).length, 1);
        await send('unknown').click();
        await toast('unknown').waitFor();
        assert.equal(await toast('unknown').getAttribute('data-tone'), 'warning');
        assert.equal(await page.locator('[data-tone="success"]').count(), 0);
        await page.waitForFunction(() => globalThis.fixtureAnnouncements.length === 2);
        await send('error').click();
        await toast('error').waitFor();
        await page.waitForFunction(() => globalThis.fixtureAnnouncements.length === 3);
        assert.deepEqual(
          (await log()).map((entry) => entry.severity),
          ['polite', 'polite', 'assertive'],
        );
        await layout(page, width);
        await capture(page, { ...meta, kind: 'unknown-and-error' });
        await send('confirmed').click();
        assert.equal(await toast('confirmed').count(), 0);
        releaseConfirmed();
        await toast('confirmed').waitFor();
        assert.ok(confirmedStarted());
        assert.equal(await toast('confirmed').getAttribute('data-tone'), 'success');
        await page.waitForFunction(() => globalThis.fixtureAnnouncements.length === 4);
        assert.ok(await active(send('confirmed')));
        cases.push({
          ...meta,
          kind: 'Toast 202/504/422/200, dedup/dismiss/focus/live mutations',
          announcements: await log(),
          pass: true,
        });

        const decimal = '12345678901234567890.123456789';
        const card = page.locator('.k8k-stat-tile');
        assert.ok((await card.textContent()).includes(decimal));
        for (const status of [
          'loading',
          'empty',
          'ready',
          'stale',
          'error',
          'pending',
          'forbidden',
          'subscription-limited',
          'session-expired',
        ]) {
          await page.locator('#fixture-state').selectOption(status);
          assert.equal(await card.getAttribute('data-state'), status);
          const visibleValue = ['ready', 'stale', 'pending', 'subscription-limited'].includes(
            status,
          );
          assert.equal((await card.textContent()).includes(decimal), visibleValue);
          if (['forbidden', 'session-expired'].includes(status)) {
            assert.equal(await page.locator('.k8k-information-meta').count(), 0);
            assert.equal(await page.locator('.k8k-information-card a').count(), 0);
          }
        }
        await page.locator('#fixture-state').selectOption('ready');
        const geometry = await layout(page, width);
        cases.push({ ...meta, kind: 'HeroCard/StatTile all nine states', geometry, pass: true });
        await event(page, 'fixture:revoke');
        await page.locator('.k8k-toasts').waitFor({ state: 'detached' });
        assert.equal(await page.locator('[data-toast-live]').count(), 0);

        await go('lessons');
        const lessonsMeta = { locale, width, role: 'student', route: '/student/lessons' };
        const list = page.getByRole('radio', { name: locale === 'ro' ? 'Listă' : 'Список' });
        const calendar = page.getByRole('radio', {
          name: locale === 'ro' ? 'Calendar' : 'Календарь',
        });
        await list.focus();
        await page.keyboard.press('ArrowRight');
        assert.ok(await calendar.isChecked());
        assert.ok(await active(calendar));
        const month = page.locator('input[type="month"]');
        await month.fill('2027-03');
        await page.getByText('В этом месяце уроков нет.').waitFor();
        await calendar.press('Home');
        assert.ok(await list.isChecked());
        await list.press('End');
        assert.ok(await calendar.isChecked());
        assert.equal(await month.inputValue(), '2027-03');
        assert.ok(
          requests.some(
            (r) =>
              r.locale === locale &&
              r.width === width &&
              r.kind === 'lessons' &&
              r.params.month === '2027-03',
          ),
        );
        assert.ok(
          requests.some(
            (r) =>
              r.locale === locale &&
              r.width === width &&
              r.kind === 'lessons' &&
              r.params.period === 'month' &&
              r.params.page === '1',
          ),
        );
        await layout(page, width);
        await capture(page, { ...lessonsMeta, kind: 'calendar-retained' });
        cases.push({
          ...lessonsMeta,
          kind: 'native keyboard mode, month retained, real read query',
          pass: true,
        });
      } finally {
        releaseConfirmed();
        await context.close();
      }
    }
  for (const locale of ['ru', 'ro']) {
    const width = 360;
    const { context, page, go } = await setup(locale, width, true);
    try {
      await go('guard');
      const draft = page.locator('#synthetic-draft'),
        form = page.getByRole('tab').nth(0),
        details = page.getByRole('tab').nth(2);
      await draft.fill('Synthetic protected draft');
      await form.press('ArrowRight');
      await waitForFocus(page, details);
      await page.keyboard.press('Enter');
      await page.getByRole('alertdialog').waitFor();
      assert.equal(
        await page.locator('.k8k-tab-trigger').first().getAttribute('aria-selected'),
        'true',
      );
      await capture(page, { locale, width, role: 'manager-fixture', kind: 'guarded-form' });
      await page.keyboard.press('Escape');
      await page.getByRole('alertdialog').waitFor({ state: 'detached' });
      assert.equal(await draft.inputValue(), 'Synthetic protected draft');
      await form.press('ArrowRight');
      await waitForFocus(page, details);
      await page.keyboard.press('Space');
      await page
        .getByRole('button', { name: locale === 'ro' ? 'Renunță' : 'Отбросить', exact: true })
        .click();
      await draft.waitFor({ state: 'detached' });
      assert.equal(await details.getAttribute('aria-selected'), 'true');
      await form.click();
      await draft.waitFor();
      assert.equal(await draft.inputValue(), '');
      cases.push({ locale, width, kind: 'unmount only after explicit discard', pass: true });
      await go();
      const help = page.getByRole('button', {
        name: locale === 'ro' ? 'Explicație suplimentară' : 'Дополнительное пояснение',
      });
      await help.tap();
      await page.locator('.k8k-tooltip').waitFor();
      await layout(page, width);
      await capture(page, { locale, width, role: 'manager-touch-fixture', kind: 'tooltip-touch' });
      await help.tap();
      await page.locator('.k8k-tooltip').waitFor({ state: 'detached' });
      cases.push({ locale, width, kind: 'Tooltip tap open/close', pass: true });
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
  maxTotal: Math.max(...rows.map((row) => row.total)),
  sourceFiles: sourceManifest.length,
  mockLessonReads: requests.filter((r) => r.kind === 'lessons').length,
  mockResults: requests.filter((r) => r.kind === 'synthetic-result').length,
  unexpectedNetworkOrBrowserErrors: unexpected,
};
await write('visual.json', {
  basis,
  browser: browserVersion,
  cases,
  screenshots,
  requests,
  summary,
  network:
    'Exact loopback origin. Only GET lesson mock and synthetic result transport. No SDK commands, DB or providers.',
});
await write('verification.json', { basis, method: METHOD, summary });
await fs.writeFile(
  path.join(run, 'bundle.md'),
  '# TASK-009 — route budgets\n\nJS/CSS gzip9 plus all three raw fonts (63492 bytes).\n\n| Route | Total | Δcode | Δfont |\n|---|---:|---:|---:|\n' +
    rows
      .map((row) => `| ${row.inventoryId} | ${row.total} | ${row.delta.gzip} | ${row.delta.font} |`)
      .join('\n') +
    '\n',
);
await fs.writeFile(
  path.join(run, 'gallery.html'),
  '<!doctype html><meta charset="utf-8"><title>TASK-009 fixtures</title><h1>TASK-009</h1>' +
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

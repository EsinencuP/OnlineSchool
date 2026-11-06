// TASK-007 source builds and local synthetic browser evidence. No env/DB/providers.
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
import { evaluateRoute, FONT_METHOD_V2 as METHOD } from './k8k-route-budget-core.mjs';
import { measured, resolveTokens, contrast } from '../packages/ui/tests/contrast-contract.mjs';

const root = path.resolve(import.meta.dirname, '..');
const previous = 'output/k8k-tasks/TASK-006/runs/2026-11-03T21-57-30.880Z';
const run = path.join(
  root,
  'output/k8k-tasks/TASK-007/runs',
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
  'scripts/k8k-controls-evidence.mjs',
  'packages/ui/tests/controls.test.mjs',
  'apps/student-cabinet/tsconfig.ui-controls.json',
  'apps/student-cabinet/tests/ui-controls/fixture.tsx',
  'apps/student-cabinet/tests/ui-controls/index.html',
  'packages/ui/stories/controls.stories.tsx',
  'packages/ui/stories/controls.css',
  'apps/student-cabinet/index.html',
  'apps/manager-web/index.html',
  'apps/platform/index.html',
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
  task: 'TASK-007',
  method: METHOD,
  basis,
  buildProvenance,
  manifests,
  routePlanSource: previous,
  comparison:
    'Same v2 font policy and Vite/runtime/closure/gzip/route seeds; unchanged JS lockfile. Controls/profile changes only; code/font deltas separated.',
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
  root: path.join(root, 'apps/student-cabinet/tests/ui-controls'),
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
const browserVersion = browser.version();
const errors = [];
const cases = [];
const shots = [];
let sentinels = 0;
async function contextFor(locale, width, role = 'student', touch = false) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    locale: locale === 'ro' ? 'ro-MD' : 'ru-MD',
    timezoneId: 'Europe/Chisinau',
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
    hasTouch: touch,
    isMobile: touch,
  });
  await context.addInitScript(
    ({ locale }) => globalThis.localStorage.setItem('k8k.locale', locale),
    { locale },
  );
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) {
      sentinels++;
      return route.abort('blockedbyclient');
    }
    if (url.pathname.startsWith('/api/'))
      return route.fulfill({
        status: 501,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'UNEXPECTED_LOCAL_API' }),
      });
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-11-03T10:35:00Z'));
  return { context, page, role };
}
async function capture(page, file, metadata) {
  await page.screenshot({ path: path.join(run, file), fullPage: true });
  shots.push({ file, sha256: sha(await fs.readFile(path.join(run, file))), ...metadata });
}
async function assertLayout(page, width) {
  const layout = await page.evaluate(() => ({
    viewport: globalThis.innerWidth,
    scrollWidth: globalThis.document.documentElement.scrollWidth,
  }));
  assert.ok(layout.scrollWidth <= width, JSON.stringify(layout));
  return layout;
}
try {
  for (const locale of ['ru', 'ro'])
    for (const width of [360, 768, 1024, 1280])
      for (const role of ['student', 'manager']) {
        const { context, page } = await contextFor(locale, width, role);
        await page.goto(`${origin}/?ui.k8k=1&locale=${locale}&role=${role}`);
        await page.locator('#controlled-name').waitFor();
        await page.evaluate(() => globalThis.document.fonts.ready);
        await page.evaluate(() => fetch('https://controls.invalid/sentinel').catch(() => null));
        assert.equal(await page.locator('html').getAttribute('data-k8k'), 'provisional');
        const field = page.locator('#controlled-name'),
          select = page.locator('#controlled-select'),
          submit = page.locator('[data-submit]');
        const refs = [];
        for (const [trigger, target] of [
          ['[data-focus-input]', '#controlled-name'],
          ['[data-focus-select]', '#controlled-select'],
          ['[data-focus-button]', '[data-submit]'],
          ['[data-focus-icon]', '[data-icon]'],
          ['#consumer-card .k8k-card-actions button', '#consumer-card'],
        ]) {
          await page.locator(trigger).click();
          const focused = await page
            .locator(target)
            .evaluate((e) => e === globalThis.document.activeElement);
          assert.ok(focused, `forwarded ref ${target}`);
          refs.push(target);
        }
        await page.locator('label[for="controlled-name"]').click();
        assert.ok(await field.evaluate((e) => e === globalThis.document.activeElement));
        await page.locator('[data-default-button]').click();
        assert.equal(await page.locator('[data-attempts]').textContent(), '0');
        assert.equal(await page.locator('[data-default-button]').getAttribute('type'), 'button');
        await field.fill('Synthetic Ștefan');
        await page.locator('#uncontrolled-name').fill('Synthetic uncontrolled edit');
        await select.focus();
        await select.press('ArrowUp');
        assert.equal(await select.inputValue(), 'ru');
        const native = await field.evaluate((e) => ({
          name: e.name,
          autocomplete: e.autocomplete,
          inputMode: e.inputMode,
          maxLength: e.maxLength,
        }));
        assert.deepEqual(native, {
          name: 'displayName',
          autocomplete: 'nickname',
          inputMode: 'text',
          maxLength: 100,
        });
        const unknown = page.locator('[data-unknown]');
        assert.match(await unknown.getAttribute('class'), /neutral/);
        assert.equal(
          await unknown.textContent(),
          locale === 'ro' ? 'Stare necunoscută' : 'Статус неизвестен',
        );
        const sizes = await page.evaluate(() => {
          const measure = (selector) => {
            const e = globalThis.document.querySelector(selector);
            return {
              min: globalThis.getComputedStyle(e).minHeight,
              height: e.getBoundingClientRect().height,
            };
          };
          return {
            primary: measure('[data-variant="primary"]'),
            secondary: measure('[data-variant="secondary"]'),
            compact: measure('[data-compact]'),
            fine: globalThis.matchMedia('(pointer: fine)').matches,
          };
        });
        assert.ok(sizes.primary.height >= (role === 'student' ? 48 : 44));
        assert.ok(sizes.secondary.height >= 44);
        assert.equal(
          sizes.compact.min,
          role === 'manager' && width >= 1024 && sizes.fine
            ? '36px'
            : role === 'student'
              ? '48px'
              : '44px',
        );
        const base = {
          locale,
          width,
          role,
          route: '/synthetic-controls',
          fixture: 'packages/ui/stories/controls.stories.tsx',
        };
        await capture(page, `${locale}-${width}-${role}-ready.png`, { ...base, state: 'ready' });
        await submit.click();
        assert.ok(await submit.isDisabled());
        assert.ok(await field.isDisabled());
        assert.ok(await select.isDisabled());
        assert.equal(await submit.getAttribute('aria-busy'), 'true');
        await submit.evaluate((e) => e.click());
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('[data-attempts]').textContent(), '1');
        await capture(page, `${locale}-${width}-${role}-pending.png`, {
          ...base,
          state: 'pending',
        });
        await page.locator('#controlled-name-description[role="alert"]').waitFor();
        assert.equal(await field.inputValue(), 'Synthetic Ștefan');
        assert.equal(
          await page.locator('#uncontrolled-name').inputValue(),
          'Synthetic uncontrolled edit',
        );
        assert.equal(await select.inputValue(), 'ru');
        assert.equal(await page.locator('[data-attempts]').textContent(), '1');
        assert.ok(await field.evaluate((e) => e === globalThis.document.activeElement));
        const descriptions = await field.evaluate((e) =>
          e
            .getAttribute('aria-describedby')
            .split(/\s+/)
            .map((id) => ({ id, exists: !!globalThis.document.getElementById(id) })),
        );
        assert.equal(new Set(descriptions.map((x) => x.id)).size, descriptions.length);
        assert.ok(descriptions.every((x) => x.exists));
        assert.ok(descriptions.some((x) => x.id === 'outside-help'));
        assert.ok(descriptions.some((x) => x.id === 'controlled-name-hint'));
        const overlap = await page.evaluate(() =>
          ['controlled-name', 'controlled-select'].map((id) => ({
            inputBottom: globalThis.document.getElementById(id).getBoundingClientRect().bottom,
            errorTop: globalThis.document
              .getElementById(id + '-description')
              .getBoundingClientRect().top,
          })),
        );
        assert.ok(overlap.every((r) => r.errorTop >= r.inputBottom));
        const layout = await assertLayout(page, width);
        const states = await page.locator('.k8k-state').count();
        assert.equal(states, 10);
        const cdp = await context.newCDPSession(page);
        const ax = (await cdp.send('Accessibility.getFullAXTree')).nodes.filter((n) => !n.ignored);
        assert.ok(
          ax.some(
            (n) =>
              n.role?.value === 'textbox' &&
              n.name?.value === (locale === 'ro' ? 'Numele sintetic' : 'Синтетическое имя'),
          ),
        );
        assert.ok(
          ax.some(
            (n) =>
              n.role?.value === 'combobox' &&
              n.name?.value === (locale === 'ro' ? 'Selecție nativă' : 'Нативный выбор'),
          ),
        );
        await capture(page, `${locale}-${width}-${role}-validation.png`, {
          ...base,
          state: 'validation-failure',
        });
        cases.push({
          ...base,
          refs,
          native,
          sizes,
          layout,
          descriptions,
          overlap,
          defaultNotSubmit: true,
          pendingIntentCount: 1,
          controlledAndUncontrolledValuesRetained: true,
          nativeSelectKeyboard: true,
          axLabels: true,
          states,
        });
        await context.close();
      }
  // Fine-pointer desktop may compact; large touch viewport must retain44px.
  {
    const { context, page } = await contextFor('ro', 1280, 'manager', true);
    await page.goto(`${origin}/?ui.k8k=1&locale=ro&role=manager`);
    await page.locator('[data-compact]').waitFor();
    assert.equal(
      await page
        .locator('[data-compact]')
        .evaluate((e) => globalThis.getComputedStyle(e).minHeight),
      '44px',
    );
    cases.push({
      route: '/synthetic-controls',
      locale: 'ro',
      width: 1280,
      role: 'manager',
      touch: true,
      compactMinHeight: 44,
    });
    await context.close();
  }
  // Actual app Profile: existing useCommand/write/SDK, only local CSRF+PATCH mocks.
  for (const locale of ['ru', 'ro'])
    for (const width of [360, 768, 1024, 1280])
      for (const theme of ['1', '0']) {
        const { context, page } = await contextFor(locale, width);
        let calls = 0;
        let release;
        const gate = new Promise((resolve) => {
          release = resolve;
        });
        const headersChecked = [];
        await context.route('**/api/v1/auth/csrf', (route) =>
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: { 'Cache-Control': 'no-store' },
            body: JSON.stringify({ csrfToken: 'synthetic-test-csrf' }),
          }),
        );
        await context.route('**/api/v1/student/profile', async (route) => {
          assert.equal(route.request().method(), 'PATCH');
          calls++;
          assert.equal(
            route.request().postDataJSON().displayName,
            calls === 1 ? 'Synthetic profile edit' : 'Synthetic corrected profile',
          );
          const h = route.request().headers();
          headersChecked.push({
            csrfPresent: !!h['x-csrf-token'],
            idempotencyPresent: !!h['idempotency-key'],
          });
          assert.ok(h['x-csrf-token'] && h['idempotency-key']);
          await gate;
          if (calls === 2)
            return route.fulfill({
              status: 200,
              contentType: 'application/json',
              headers: { 'Cache-Control': 'no-store' },
              body: JSON.stringify({
                displayName: 'Synthetic corrected profile',
                avatarFileId: null,
              }),
            });
          await route.fulfill({
            status: 422,
            contentType: 'application/problem+json',
            headers: { 'Cache-Control': 'no-store' },
            body: JSON.stringify({
              status: 422,
              code: 'VALIDATION_ERROR',
              type: 'about:blank',
              title: 'Synthetic validation failure',
              detail: 'Synthetic profile rejected',
              requestId: 'synthetic-request',
            }),
          });
        });
        await page.goto(`${origin}/?ui.k8k=${theme}&locale=${locale}&mode=profile`);
        const name = page.locator('input[name="displayName"]');
        await name.waitFor();
        await page.evaluate(() => globalThis.document.fonts.ready);
        assert.equal(await page.locator('.k8k-field').count(), theme === '1' ? 1 : 0);
        assert.equal(await page.locator('.k8k-card').count(), theme === '1' ? 1 : 0);
        await name.fill('  Synthetic profile edit  ');
        const save = page.locator('button[type="submit"]');
        const profileRequest = page.waitForRequest((r) =>
          r.url().includes('/api/v1/student/profile'),
        );
        await save.click();
        await profileRequest;
        assert.ok(await save.isDisabled());
        if (theme === '1') assert.ok(await page.locator('.k8k-control-reason').isVisible());
        await save.evaluate((e) => e.click());
        await page.keyboard.press('Enter');
        assert.equal(calls, 1);
        release();
        await page.locator('p.error[role="alert"]').waitFor();
        assert.equal(await name.inputValue(), '  Synthetic profile edit  ');
        assert.equal(calls, 1);
        assert.ok(await save.isEnabled());
        const layout = await assertLayout(page, width);
        const base = {
          locale,
          width,
          role: 'student',
          theme,
          route: '/student/profile',
          fixture: 'actual Profile with local hooks/SDK network mocks',
          state: 'validation-failure',
        };
        await capture(page, `${locale}-${width}-profile-k8k-${theme}.png`, base);
        cases.push({
          ...base,
          layout,
          commandCalls: calls,
          headersChecked,
          trimmedFormDataPreserved: true,
          inputRetainedAfterServer422: true,
          legacyBranchUnchanged: theme === '0',
        });
        await name.fill('Synthetic corrected profile');
        const successRequest = page.waitForRequest((r) =>
          r.url().includes('/api/v1/student/profile'),
        );
        await save.click();
        await successRequest;
        await page.getByRole('status').waitFor();
        assert.equal(calls, 2);
        assert.equal(
          await page.getByRole('status').textContent(),
          theme === '1' && locale === 'ro' ? 'Profilul a fost salvat' : 'Профиль сохранён',
        );
        assert.equal(await name.inputValue(), 'Synthetic corrected profile');
        await capture(page, `${locale}-${width}-profile-k8k-${theme}-success.png`, {
          ...base,
          state: 'success',
        });
        cases.push({
          ...base,
          state: 'success',
          commandCalls: calls,
          headersChecked,
          inputRetainedAfterSuccess: true,
        });
        await context.close();
      }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
assert.equal(errors.length, 0, JSON.stringify(errors));
assert.equal(sentinels, 16);
for (const e of sourceManifest)
  assert.equal(
    sha(await fs.readFile(path.join(root, e.path))),
    e.sha256,
    `Source unchanged ${e.path}`,
  );
const summary = {
  passed: true,
  unitTests: 'recorded separately after UI build',
  browserCases: cases.length,
  screenshots: shots.length,
  externalSentinelsBlocked: sentinels,
  browserErrors: errors,
  routes: 48,
  maxTotal: Math.max(...rows.map((r) => r.total)),
  sourceFiles: sourceManifest.length,
};
await write('visual.json', {
  basis,
  browser: browserVersion,
  cases,
  screenshots: shots,
  network:
    'Exact loopback origin only; CSRF/Profile PATCH intercepted locally, unknown APIs501, no DB/provider/real credentials. Headers recorded as booleans only.',
  summary,
});
await write('verification.json', { basis, method: METHOD, summary, lockfileUnchanged: true });
console.log(
  JSON.stringify({ run: path.relative(root, run).replaceAll('\\', '/'), ...summary }, null, 2),
);

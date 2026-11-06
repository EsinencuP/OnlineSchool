// TASK-008 source builds and local synthetic browser evidence. No env/DB/providers.
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
const previous = 'output/k8k-tasks/TASK-007/runs/2026-11-03T22-17-03.782Z';
const run = path.join(
  root,
  'output/k8k-tasks/TASK-008/runs',
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
  'scripts/k8k-overlays-evidence.mjs',
  'packages/ui/tests/overlays.test.mjs',
  'packages/ui/stories/overlays.stories.tsx',
  'packages/ui/stories/overlays.css',
  'apps/student-cabinet/tests/ui-overlays/fixture.tsx',
  'apps/student-cabinet/tests/ui-overlays/index.html',
  'apps/student-cabinet/tsconfig.ui-overlays.json',
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
  task: 'TASK-008',
  method: METHOD,
  basis,
  buildProvenance,
  manifests,
  routePlanSource: previous,
  comparison:
    'Same v2 font policy and Vite/runtime/closure/gzip/route seeds; pinned Radix and UI runtime ReactDOM are explicit lockfile changes. Overlay/profile help code and font deltas separated.',
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
for (const [folder, outDir] of [
  ['ui-overlays', fixtureDir],
  ['ui-controls', path.join(run, 'profile-fixture')],
])
  await build({
    root: path.join(root, 'apps/student-cabinet/tests', folder),
    configFile: false,
    envDir: false,
    publicDir: false,
    plugins: [react()],
    resolve: { alias, dedupe: ['react', 'react-dom'] },
    build: { outDir, emptyOutDir: false },
    logLevel: 'error',
  });
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const profile = url.pathname.startsWith('/profile/');
    const folder = profile ? path.join(run, 'profile-fixture') : fixtureDir;
    const relative =
      (profile ? url.pathname.slice('/profile'.length) : url.pathname).slice(1) || 'index.html';
    // Both Vite fixtures use root-absolute /assets; their hashed filenames are distinct.
    let target = path.resolve(folder, decodeURIComponent(relative));
    if (!target.startsWith(folder + path.sep)) throw Error('path');
    let bytes;
    try {
      bytes = await fs.readFile(target);
    } catch {
      target = path.resolve(run, 'profile-fixture', relative);
      if (!target.startsWith(path.join(run, 'profile-fixture') + path.sep)) throw Error('path');
      bytes = await fs.readFile(target);
    }
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
const expectedSentinelConsole = [];
const expectedSentinelFailures = [];
const unexpectedNetworkFailures = [];
const browserVersion = browser.version(),
  errors = [],
  warnings = [],
  cases = [],
  shots = [];
let sentinels = 0,
  apiRequests = 0;
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
    if (url.pathname.startsWith('/api/')) {
      apiRequests++;
      return route.fulfill({
        status: 501,
        contentType: 'application/json',
        body: '{"code":"UNEXPECTED_LOCAL_API"}',
      });
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (e) => {
    if (e.type() !== 'warning' && e.type() !== 'error') return;
    const entry = { text: e.text(), location: e.location() };
    if (
      entry.location.url === 'https://overlays.invalid/sentinel' &&
      /ERR_BLOCKED_BY_CLIENT/.test(entry.text)
    )
      expectedSentinelConsole.push(entry);
    else warnings.push(entry);
  });
  page.on('requestfailed', (request) => {
    const entry = { url: request.url(), failure: request.failure()?.errorText };
    if (
      entry.url === 'https://overlays.invalid/sentinel' &&
      /ERR_BLOCKED_BY_CLIENT/.test(entry.failure ?? '')
    )
      expectedSentinelFailures.push(entry);
    else unexpectedNetworkFailures.push(entry);
  });
  return { context, page, role };
}
async function shot(page, file, metadata) {
  await page.screenshot({ path: path.join(run, file), fullPage: false });
  shots.push({ file, sha256: sha(await fs.readFile(path.join(run, file))), ...metadata });
}
const focused = (locator) => locator.evaluate((e) => e === globalThis.document.activeElement);
async function layout(page, width, selector) {
  const value = await page.locator(selector).evaluate((e) => {
    const r = e.getBoundingClientRect();
    return {
      left: r.left,
      right: r.right,
      top: r.top,
      bottom: r.bottom,
      width: r.width,
      scrollWidth: e.scrollWidth,
      clientWidth: e.clientWidth,
      documentWidth: globalThis.document.documentElement.scrollWidth,
      titleWidth: e.querySelector('h2')?.scrollWidth,
      titleClient: e.querySelector('h2')?.clientWidth,
      role: e.getAttribute('role'),
      label:
        e.getAttribute('aria-label') ||
        (e.getAttribute('aria-labelledby') ?? '')
          .split(/\s+/)
          .map((id) => e.ownerDocument.getElementById(id)?.textContent ?? '')
          .join(' ')
          .trim(),
      description: (e.getAttribute('aria-describedby') ?? '')
        .split(/\s+/)
        .map((id) => e.ownerDocument.getElementById(id)?.textContent ?? '')
        .join(' ')
        .trim(),
    };
  });
  assert.ok(
    value.left >= -1 && value.right <= width + 1 && value.top >= -1 && value.bottom <= 901,
    JSON.stringify(value),
  );
  assert.ok(
    value.scrollWidth <= value.clientWidth + 1 && value.documentWidth <= width,
    JSON.stringify(value),
  );
  if (value.titleClient)
    assert.ok(value.titleWidth <= value.titleClient + 1, 'Title wraps without horizontal clipping');
  assert.ok(value.label.length > 0, 'Resolved accessible name is nonempty');
  if (value.role !== 'menu')
    assert.ok(value.description.length > 0, 'Resolved accessible description is nonempty');
  return value;
}
async function trap(page, selector) {
  for (const key of ['Tab', 'Shift+Tab'])
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press(key);
      assert.ok(
        await page.locator(selector).evaluate((e) => e.contains(globalThis.document.activeElement)),
        `Trap ${selector} ${key}`,
      );
    }
}
const dispatch = (page, event) =>
  page.evaluate((event) => globalThis.dispatchEvent(new Event(event)), event);
try {
  for (const locale of ['ru', 'ro'])
    for (const width of [360, 768, 1024, 1280]) {
      const { context, page } = await contextFor(
        locale,
        width,
        width >= 1024 ? 'manager' : 'student',
      );
      for (const kind of ['dialog', 'drawer', 'confirm', 'popover', 'menu', 'nonmodal']) {
        await page.goto(
          `${origin}/?ui.k8k=1&locale=${locale}&kind=${kind}&role=${width >= 1024 ? 'manager' : 'student'}`,
        );
        await page.locator('[data-trigger]').waitFor();
        await page.evaluate(() => globalThis.document.fonts.ready);
        if (kind === 'dialog')
          await page.evaluate(() => fetch('https://overlays.invalid/sentinel').catch(() => null));
        await page.locator('[data-trigger]').click();
        const selector =
          kind === 'menu'
            ? '[role="menu"]'
            : kind === 'confirm'
              ? '[role="alertdialog"]'
              : '.k8k-overlay-surface';
        await page.locator(selector).waitFor();
        await page.locator(`${selector}[data-ref-proof="connected"]`).waitFor();
        if (['dialog', 'drawer', 'nonmodal', 'popover'].includes(kind))
          assert.ok(await focused(page.locator('#overlay-name')), 'Caller initialFocusRef honored');
        const geometry = await layout(page, width, selector);
        const modal = ['dialog', 'drawer', 'confirm'].includes(kind);
        const isolation = await page.locator('[data-background]').evaluate((e) => ({
          hidden: !!e.closest('[aria-hidden="true"]'),
          pointer: globalThis.getComputedStyle(globalThis.document.body).pointerEvents,
          locked: !!globalThis.document.body.getAttribute('data-scroll-locked'),
        }));
        assert.equal(isolation.hidden, modal, `${kind} AT isolation`);
        assert.equal(isolation.locked, modal, `${kind} scroll lock`);
        if (modal) {
          assert.equal(isolation.pointer, 'none');
          await trap(page, selector);
          await page.locator('[data-background]').evaluate((e) => e.focus());
          assert.ok(
            await page
              .locator(selector)
              .evaluate((e) => e.contains(globalThis.document.activeElement)),
            'Background cannot take modal focus',
          );
          const oldScroll = await page.evaluate(() => globalThis.scrollY);
          await page.mouse.move(2, 400);
          await page.mouse.wheel(0, 400);
          await page.waitForTimeout(50);
          assert.equal(
            await page.evaluate(() => globalThis.scrollY),
            oldScroll,
            'Background wheel blocked',
          );
          if (kind === 'confirm')
            assert.ok(
              await page
                .getByRole('button', { name: locale === 'ro' ? 'Anulează' : 'Отмена', exact: true })
                .count(),
            );
        }
        if (kind === 'menu') {
          await page.keyboard.press('Home');
          assert.ok(await focused(page.getByRole('menuitem').nth(0)));
          await page.keyboard.press('ArrowDown');
          await page.waitForFunction(
            () =>
              globalThis.document.querySelectorAll('[role="menuitem"]')[2] ===
              globalThis.document.activeElement,
          );
          assert.ok(await focused(page.getByRole('menuitem').nth(2)), 'Disabled item skipped');
          await page.keyboard.press('Enter');
          assert.equal(await page.locator('[data-selection]').textContent(), 'keep');
          assert.equal(
            await page.locator('[role="menu"]').count(),
            1,
            'onSelect preventDefault retained',
          );
        }
        await shot(page, `${locale}-${width}-${kind}.png`, {
          locale,
          width,
          role: width >= 1024 ? 'manager' : 'student',
          kind,
          state: 'open',
        });
        await page.keyboard.press('Escape');
        await page.locator(selector).waitFor({ state: 'detached' });
        await page.waitForFunction(() =>
          globalThis.document.activeElement?.hasAttribute('data-trigger'),
        );
        assert.equal(await page.locator('body').getAttribute('data-scroll-locked'), null);
        assert.notEqual(
          await page.locator('body').evaluate((e) => globalThis.getComputedStyle(e).pointerEvents),
          'none',
        );
        cases.push({
          locale,
          width,
          kind,
          modal,
          geometry,
          isolation,
          focusReturn: true,
          scrollRestore: true,
        });
      }
      // Safe production consumer: real Profile component, synthetic outlet data; no reads or writes.
      await page.goto(`${origin}/profile/?ui.k8k=1&locale=${locale}&mode=profile`);
      const help = page.getByRole('button', {
        name: locale === 'ro' ? 'Despre numele afișat' : 'Об имени в кабинете',
        exact: true,
      });
      await help.click();
      await page.getByRole('dialog').waitFor();
      await layout(page, width, '[role="dialog"]');
      await shot(page, `${locale}-${width}-profile-help.png`, {
        locale,
        width,
        role: 'student',
        kind: 'Profile read-only help',
        state: 'open',
      });
      await page.keyboard.press('Escape');
      await page.getByRole('dialog').waitFor({ state: 'detached' });
      await page.waitForFunction(() =>
        globalThis.document.activeElement?.textContent?.match(/Despre numele|Об имени/),
      );
      cases.push({ locale, width, kind: 'Profile read-only help', focusReturn: true, apiCalls: 0 });
      await context.close();
    }
  // Deep lifecycle checks independent of screenshot matrix.
  for (const locale of ['ru', 'ro']) {
    const { context, page } = await contextFor(locale, 360);
    const goto = (kind) =>
      page.goto(`${origin}/?ui.k8k=1&locale=${locale}&kind=${kind}&role=student`);
    await goto('dialog');
    await page.locator('[data-trigger]').click();
    await page.locator('[data-nested]').click();
    await page.locator('.k8k-popover').waitFor();
    await page.locator('[data-inner]').click();
    await page.locator('[data-inner-end]').waitFor();
    assert.equal(
      await page.locator('[role="dialog"]').count(),
      3,
      'All three nested surfaces mounted',
    );
    assert.equal(
      await page.getByRole('dialog').count(),
      1,
      'Only top modal exposed to accessibility tree',
    );
    await trap(page, '.k8k-dialog:has([data-inner-end])');
    await page.keyboard.press('Escape');
    await page.locator('[data-inner-end]').waitFor({ state: 'detached' });
    await page.waitForFunction(() => globalThis.document.activeElement?.hasAttribute('data-inner'));
    assert.ok(await focused(page.locator('[data-inner]')));
    await page.keyboard.press('Escape');
    await page.locator('.k8k-popover').waitFor({ state: 'detached' });
    await page.waitForFunction(() =>
      globalThis.document.activeElement?.hasAttribute('data-nested'),
    );
    assert.ok(await focused(page.locator('[data-nested]')));
    assert.equal(await page.locator('.k8k-dialog').count(), 1);
    await page.keyboard.press('Escape');
    await page.locator('.k8k-dialog').waitFor({ state: 'detached' });
    cases.push({
      locale,
      kind: 'nested dialog/popover/dialog',
      innerOnlyEscape: true,
      stackFocusRestored: true,
    });
    for (const kind of ['nonmodal', 'popover']) {
      await goto(kind);
      await page.locator('[data-trigger]').click();
      await page.locator('[data-background]').focus();
      assert.ok(
        await focused(page.locator('[data-background]')),
        'Nonmodal permits background focus',
      );
      cases.push({ locale, kind, backgroundFocusable: true });
    }
    // App guard keeps dirty input on Escape/outside/close, confirms discard explicitly.
    await goto('guard');
    await page.locator('[data-guard-trigger]').click();
    await page.locator('#guard-name').fill('Synthetic draft');
    await page.keyboard.press('Escape');
    await page.getByRole('alertdialog').waitFor();
    const cancel = page.getByRole('button', {
      name: locale === 'ro' ? 'Continuă editarea' : 'Продолжить ввод',
      exact: true,
    });
    assert.ok(await focused(cancel), 'AlertDialog defaults to safe cancel');
    await trap(page, '[role="alertdialog"]');
    await page.keyboard.press('Escape');
    await page.getByRole('alertdialog').waitFor({ state: 'detached' });
    assert.equal(await page.locator('#guard-name').inputValue(), 'Synthetic draft');
    await page.locator('.k8k-dialog .k8k-icon-button').click();
    await page.getByRole('alertdialog').waitFor();
    await cancel.click();
    await page.getByRole('alertdialog').waitFor({ state: 'detached' });
    await page.waitForFunction(() => globalThis.document.activeElement?.id === 'guard-name');
    await page.mouse.click(2, 2);
    await page.getByRole('alertdialog').waitFor();
    await shot(page, `${locale}-360-dirty-confirm.png`, {
      locale,
      width: 360,
      kind: 'guard',
      state: 'dirty-confirm',
    });
    await page
      .getByRole('button', {
        name: locale === 'ro' ? 'Renunță la modificări' : 'Отбросить изменения',
        exact: true,
      })
      .click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.equal(await page.locator('[data-private]').count(), 0);
    assert.equal(await page.locator('[data-count]').textContent(), '0');
    cases.push({
      locale,
      kind: 'app dirty guard',
      retained: true,
      closeReasons: ['escape', 'close-button', 'outside'],
      commands: 0,
    });
    await page.locator('[data-guard-trigger]').click();
    await page.locator('#guard-name').fill('Synthetic pending');
    await page.locator('[data-send]').click();
    await page.keyboard.press('Escape');
    await page.locator('[data-close-notice]').waitFor();
    await page.locator('.k8k-dialog .k8k-icon-button').click();
    await page.mouse.click(2, 2);
    assert.equal(await page.locator('[data-phase]').textContent(), 'pending');
    assert.equal(await page.locator('[data-count]').textContent(), '1');
    assert.ok(await page.locator('[data-send]').isDisabled());
    await shot(page, `${locale}-360-pending.png`, {
      locale,
      width: 360,
      kind: 'guard',
      state: 'pending',
    });
    await dispatch(page, 'fixture:unknown');
    await page.locator('[data-unknown]').waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('[data-phase]').textContent(), 'unknown');
    assert.ok(await page.locator('[data-send]').isDisabled());
    assert.equal(await page.locator('[data-count]').textContent(), '1');
    await shot(page, `${locale}-360-unknown.png`, {
      locale,
      width: 360,
      kind: 'guard',
      state: 'unknown-result',
    });
    await dispatch(page, 'fixture:complete');
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.equal(await page.locator('[data-phase]').textContent(), 'settled');
    assert.equal(await page.locator('[data-private]').count(), 0);
    cases.push({
      locale,
      kind: 'pending/unknown result guard',
      commands: 1,
      noBlindRetry: true,
      asyncSettlementClosed: true,
    });
    // Session revocation removes subtree and queued callback; late response cannot re-create it.
    await goto('guard');
    await page.locator('[data-guard-trigger]').click();
    await page.locator('[data-send]').click();
    await dispatch(page, 'fixture:revoke');
    await page.locator('[data-session]').waitFor();
    await dispatch(page, 'fixture:complete');
    assert.equal(
      await page
        .locator('[data-private], [role="dialog"], [role="alertdialog"], #guard-name')
        .count(),
      0,
    );
    assert.equal(await page.locator('body').getAttribute('data-scroll-locked'), null);
    assert.equal(await page.locator('[data-count]').textContent(), '1');
    await shot(page, `${locale}-360-session-expired.png`, {
      locale,
      width: 360,
      kind: 'guard',
      state: 'session-expired (no private marker)',
    });
    cases.push({
      locale,
      kind: 'session revoke',
      privateDomRemoved: true,
      staleCallbackDropped: true,
      commands: 1,
    });
    await context.close();
  }
  for (const locale of ['ru', 'ro']) {
    const { context, page } = await contextFor(locale, 360);
    await page.goto(`${origin}/?ui.k8k=1&locale=${locale}&kind=async-confirm`);
    await page.locator('[data-confirm-trigger]').click();
    const confirm = page.getByRole('button', {
      name: locale === 'ro' ? 'Confirmă' : 'Подтвердить',
      exact: true,
    });
    await confirm.click();
    assert.ok(await confirm.isDisabled());
    assert.equal(
      await page.getByRole('alertdialog').count(),
      1,
      'Confirm action does not auto-close async operation',
    );
    await page.keyboard.press('Escape');
    await page.locator('[data-confirm-notice]').waitFor();
    await page
      .getByRole('button', { name: locale === 'ro' ? 'Anulează' : 'Отмена', exact: true })
      .click();
    assert.equal(await page.getByRole('alertdialog').count(), 1, 'App guard vetoes pending cancel');
    assert.equal(await page.locator('[data-confirm-count]').textContent(), '1');
    await shot(page, `${locale}-360-confirm-pending.png`, {
      locale,
      width: 360,
      kind: 'ConfirmDialog',
      state: 'pending',
    });
    await dispatch(page, 'fixture:complete');
    await page.getByRole('alertdialog').waitFor({ state: 'detached' });
    cases.push({
      locale,
      kind: 'async ConfirmDialog',
      commands: 1,
      actionDoesNotAutoClose: true,
      guardVeto: true,
    });
    await context.close();
  }
  // Touch target + scroll position restoration with the same Drawer lifecycle.
  const { context, page } = await contextFor('ro', 360, 'student', true);
  await page.goto(`${origin}/?ui.k8k=1&kind=drawer&locale=ro`);
  await page.locator('[data-trigger]').click();
  assert.ok(
    await page
      .locator('.k8k-drawer .k8k-icon-button')
      .evaluate((e) => e.getBoundingClientRect().height >= 44),
  );
  await page.keyboard.press('Escape');
  await page.locator('.k8k-drawer').waitFor({ state: 'detached' });
  await page.evaluate(() => globalThis.scrollTo(0, 200));
  const oldY = await page.evaluate(() => globalThis.scrollY);
  // Programmatic opening avoids the browser scrolling the trigger into view.
  await page.locator('[data-trigger]').evaluate((e) => e.click());
  await page.locator('.k8k-drawer').waitFor();
  await page.keyboard.press('Escape');
  await page.locator('.k8k-drawer').waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => globalThis.scrollY), oldY);
  cases.push({
    locale: 'ro',
    width: 360,
    kind: 'touch Drawer',
    touchTarget: true,
    restoredScrollY: oldY,
  });
  await context.close();
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
assert.deepEqual(errors, []);
await write('console.json', {
  unexpected: warnings,
  expectedSentinelConsole,
  expectedSentinelFailures,
  unexpectedNetworkFailures,
});
assert.deepEqual(warnings, []);
assert.equal(expectedSentinelConsole.length, 8);
assert.equal(expectedSentinelFailures.length, 8);
assert.deepEqual(unexpectedNetworkFailures, []);
assert.equal(sentinels, 8);
assert.equal(apiRequests, 0);
for (const e of sourceManifest)
  assert.equal(
    sha(await fs.readFile(path.join(root, e.path))),
    e.sha256,
    `Source unchanged ${e.path}`,
  );
const summary = {
  passed: true,
  browserCases: cases.length,
  screenshots: shots.length,
  externalSentinelsBlocked: sentinels,
  unexpectedApiRequests: apiRequests,
  browserErrors: errors,
  browserWarnings: warnings,
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
    'Exact ephemeral loopback only. Synthetic noncredential marker. No SDK calls/DB/providers. External sentinel deliberately blocked.',
  summary,
});
await write('verification.json', { basis, method: METHOD, summary, newPinnedDependencies: true });
await fs.writeFile(
  path.join(run, 'bundle.md'),
  '# TASK-008 — comparable v2 route budgets\n\nJS/CSS gzip9 + all3 raw fonts63492 bytes, <=256000. Same route seeds/engines/method; pinned Radix graph added.\n\n| Route | Total | Δcode | Δfont |\n|---|---:|---:|---:|\n' +
    rows
      .map((r) => `| ${r.inventoryId} | ${r.total} | ${r.delta.gzip} | ${r.delta.font} |`)
      .join('\n') +
    '\n',
);
const escapeHtml = (s) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
await fs.writeFile(
  path.join(run, 'gallery.html'),
  '<!doctype html><meta charset="utf-8"><title>TASK-008 local synthetic evidence</title><h1>TASK-008 — synthetic UI only</h1>' +
    shots
      .map(
        (s) =>
          `<figure><figcaption>${escapeHtml(s.file)} — ${escapeHtml(s.state)}</figcaption><img style="max-width:100%;border:1px solid" loading="lazy" src="${s.file}" alt="${escapeHtml(s.file)}"></figure>`,
      )
      .join('\n'),
);
console.log(
  JSON.stringify({ run: path.relative(root, run).replaceAll('\\', '/'), ...summary }, null, 2),
);

// Production client builds in memory; only synthetic GET responses on loopback.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { evaluateRoute, FONT_METHOD_V2 } from './k8k-route-budget-core.mjs';

const root = new URL('../', import.meta.url);
const out = new URL('output/k8k-tasks/TASK-023/', root);
const images = new URL('screenshots/', out);
await mkdir(images, { recursive: true });
const load = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const write = (name, value) => writeFile(new URL(name, out), JSON.stringify(value, null, 2) + '\n');
const prev = await load('output/k8k-tasks/TASK-022/budgets.json');
const baseline = await load(
  'output/k8k-tasks/TASK-004/runs/2026-11-03T21-10-19-078Z-0b1240/bundle.json',
);
const key = (row) => `${row.app}|${row.role}|${row.route}`;
const old = new Map(baseline.rows.map((row) => [key(row), row]));
const require = createRequire(new URL('apps/manager-web/package.json', root));
const { build } = await import(pathToFileURL(require.resolve('vite')));
const { default: react } = await import(pathToFileURL(require.resolve('@vitejs/plugin-react')));
const alias = [
  ['@online-school/ui/style.css', 'packages/ui/src/style.css'],
  ['@online-school/account-ui/style.css', 'packages/account-ui/src/style.css'],
  ['@online-school/ui', 'packages/ui/src/index.ts'],
  ['@online-school/account-ui', 'packages/account-ui/src/index.tsx'],
  ['@online-school/api-contracts', 'packages/api-contracts/src/index.ts'],
  ['@online-school/shared', 'packages/shared/src/index.ts'],
].map(([find, path]) => ({ find, replacement: fileURLToPath(new URL(path, root)) }));
const rows = [],
  bundles = new Map(),
  chunks = [];
for (const [app, prefix] of [
  ['student-cabinet', '/student/'],
  ['manager-web', '/manager/'],
  ['platform', '/'],
]) {
  const result = await build({
    root: fileURLToPath(new URL(`apps/${app}/`, root)),
    base: prefix,
    configFile: false,
    envDir: false,
    publicDir: false,
    mode: 'production',
    plugins: [react()],
    resolve: { alias, dedupe: ['react', 'react-dom'] },
    build: { write: false, manifest: true },
    logLevel: 'error',
  });
  assert(!Array.isArray(result) && 'output' in result);
  const assets = new Map(
    result.output.map((file) => [
      file.fileName,
      Buffer.from(file.type === 'chunk' ? file.code : file.source),
    ]),
  );
  const manifest = JSON.parse(assets.get('.vite/manifest.json').toString());
  bundles.set(app, { prefix, assets });
  const scripts = result.output.filter((file) => file.type === 'chunk');
  for (const script of scripts)
    for (const path of Object.keys(script.modules))
      assert.doesNotMatch(
        path.replaceAll('\\', '/'),
        /(?:\/@storybook\/|\/storybook\/|\/packages\/ui\/(?:stories|\.storybook)\/)/u,
      );
  chunks.push({ app, chunks: scripts.length, storybookModules: 0 });
  const measure = (seeds) =>
    evaluateRoute({ assets, manifest, seeds, requiredFonts: ['cyrillic', 'latin', 'romanian'] });
  for (const route of prev.rows.filter((row) => row.app === app)) {
    const previous = old.get(key(route));
    assert.equal(previous.status, 'available');
    const measured = measure(route.manifestSeeds);
    const comparable = measure(previous.manifestSeeds);
    assert.equal(comparable.status, 'available');
    const v1FontBytes = comparable.font.cyrillic.bytes + comparable.font.latin.bytes;
    const optionalActions = route.optionalActions.map(({ seed }) => ({
      seed,
      ...measure([...new Set([...route.manifestSeeds, seed])]),
    }));
    rows.push({
      app,
      role: route.role,
      route: route.route,
      manifestSeeds: route.manifestSeeds,
      ...measured,
      optionalActions,
      deltaTask022: measured.total - route.total,
      task004: {
        previousSeeds: previous.manifestSeeds,
        previousTotal: previous.total,
        gzipDeltaOnPreviousSeeds: comparable.gzip - previous.gzip,
        deltaOnPreviousSeedsWithoutRomanianSubset: comparable.gzip + v1FontBytes - previous.total,
        currentExtraSeedBytes: measured.total - comparable.total,
        actualTotalDelta: measured.total - previous.total,
      },
    });
  }
}
await write('budgets.json', { method: FONT_METHOD_V2, chunks, rows });
assert.equal(rows.length, 48);
assert(rows.every((row) => row.pass && row.optionalActions.every((action) => action.pass)));
console.log(
  `Budgets ${rows.length}/${rows.length}; max ${Math.max(...rows.map((row) => row.total))} bytes.`,
);

const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
};
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  const app = /^\/student(?:\/|$)/.test(path)
    ? 'student-cabinet'
    : /^\/manager(?:\/|$)/.test(path)
      ? 'manager-web'
      : 'platform';
  const { prefix, assets } = bundles.get(app);
  const relative = path.slice(prefix.length);
  const file = relative.startsWith('assets/') ? relative : 'index.html';
  const bytes = assets.get(file);
  if (!bytes || path.startsWith('/api/')) return res.writeHead(404).end();
  res.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
  res.end(bytes);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const cases = [],
  screenshots = [],
  unexpected = [],
  failures = [];
const widths = [360, 768, 1024, 1280];
const rolePaths = {
  STUDENT: '/student',
  TEACHER: '/teacher',
  MANAGER: '/manager',
  DIRECTOR: '/director',
  TECH_OPERATOR: '/operator',
};
const language = { ru: 'Язык интерфейса', ro: 'Limba interfeței' };
const navigation = {
  ru: ['Основная навигация', 'Мобильная навигация'],
  ro: ['Navigare principală', 'Navigare mobilă'],
};
const id = '50000000-0000-4000-8000-000000000001';
const asOf = '2026-11-07T08:00:00.000Z';
const sampleName = 'Synthetic Academy Test Name';
const zone = 'Europe/Chisinau';
const emptyPage = { items: [], total: 0, page: 1, pageSize: 20 };
const managerDashboard = {
  generatedAt: asOf,
  leads: {
    countsByStage: { NEW: 0, IN_PROGRESS: 0, TRIAL: 0, AWAITING_PAYMENT: 0 },
    createdToday: 0,
    trialsToday: 0,
    overdueFollowups: 0,
    conversion30dBp: 0,
  },
  students: { active: 0, frozen: 0, leads: 0 },
  upcomingLessons: [],
  overdueTasks: { count: 0, top: [] },
  expiringSubscriptions: [],
  pendingPayments: { count: 0, totalsByCurrency: [] },
};
const roleRead = {
  STUDENT: '/api/v1/student/dashboard',
  MANAGER: '/api/v1/manager/dashboard',
  TEACHER: '/api/v1/platform/workspace',
  DIRECTOR: '/api/v1/platform/workspace',
  TECH_OPERATOR: '/api/v1/qa/components',
};

async function setup(role, locale, width) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    locale: `${locale}-MD`,
    isMobile: width < 1024,
    hasTouch: width < 1024,
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  });
  const state = { status: 200, priority: undefined, reads: [] };
  const actorContext = {
    accountId: id,
    role,
    staffProfileId: role === 'TEACHER' ? null : id,
    teacherProfileId: role === 'TEACHER' ? id : null,
    displayName: sampleName,
    timezone: zone,
    timezoneSource: 'SCHOOL_CONFIGURATION',
    asOf,
    accountUpdatedAt: null,
    profileUpdatedAt: null,
  };
  const coverage = {
    scope: role === 'TEACHER' ? 'OWN_TEACHER' : 'SCHOOL',
    windowFrom: null,
    windowTo: null,
    sourceUpdatedAt: null,
    pageInfo: { returned: 0, limit: 100, hasMore: false, total: null },
  };
  await context.addInitScript((lang) => {
    if (!globalThis.localStorage.getItem('k8k.locale'))
      globalThis.localStorage.setItem('k8k.locale', lang);
  }, locale);
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.origin !== origin || method !== 'GET') {
      unexpected.push({ role, locale, width, method, path: url.origin + url.pathname });
      return route.abort();
    }
    const path = url.pathname;
    if (!path.startsWith('/api/')) return route.continue();
    state.reads.push(path);
    const send = (json, status = 200) =>
      route.fulfill({ json, status, headers: { 'Cache-Control': 'private, no-store' } });
    if (path === roleRead[role] && state.status !== 200)
      return send(
        { code: state.status === 403 ? 'FORBIDDEN' : 'SERVICE_UNAVAILABLE' },
        state.status,
      );
    switch (path) {
      case '/api/v1/auth/session':
        if (role === 'SHARED') return send({ code: 'UNAUTHENTICATED' }, 401);
        return send({
          account: { id, kind: role === 'TEACHER' ? 'TEACHER' : 'STAFF', roles: [role] },
          mfa_completed: true,
          recovery_only: false,
          expires_at: '2027-01-02T12:00:00Z',
        });
      case '/api/v1/platform/accounts':
        return send({ enabled: false, currentKey: null, items: [] });
      case '/api/v1/platform/workspace':
        return send({
          actorContext,
          coverage: { lessons: coverage, students: coverage, homework: coverage, tasks: coverage },
          name: sampleName,
          role,
          lessons: [],
          students: [],
          homework: [],
          tasks: [],
        });
      case '/api/v1/qa/components':
        return send({
          api: 'ok',
          db: 'ok',
          worker: 'ok',
          checkedAt: asOf,
          workerLastSeenAt: asOf,
          migrationVersion: null,
        });
      case '/api/v1/manager/me':
        return send({
          actorContext,
          managerId: id,
          displayName: sampleName,
          role,
          portfolioSize: 0,
          timezone: zone,
          capabilities: [],
        });
      case '/api/v1/manager/dashboard':
        return send({
          ...managerDashboard,
          ...(state.priority !== undefined ? { priority: state.priority } : {}),
        });
      case '/api/v1/manager/tasks':
        return send({ items: [], nextCursor: null });
      case '/api/v1/student/me':
        return send({
          id,
          userId: id,
          displayName: sampleName,
          timeZone: zone,
          email: 'shell@example.invalid',
          avatarUrl: null,
          hasActiveAccess: true,
          mustChangePassword: false,
          createdAt: asOf,
        });
      case '/api/v1/student/dashboard':
        return send({
          nextLesson: null,
          homework: { notSubmitted: 0, submitted: 0, needsRevision: 0, total: 0 },
          subscription: null,
          skillProgress: { familiarizing: 0, practicing: 0, applying: 0, notStudied: 0 },
          generatedAt: asOf,
        });
      case '/api/v1/student/skills':
        return send([]);
      case '/api/v1/student/notifications/count':
        return send({ unreadCount: 0 });
      case '/api/v1/student/notifications':
        return send({ ...emptyPage, unreadCount: 0 });
      case '/api/v1/student/lessons/upcoming':
      case '/api/v1/student/homework':
      case '/api/v1/student/skills/snapshots':
        return send(emptyPage);
      default:
        unexpected.push({ role, locale, width, path });
        return send({ code: 'UNEXPECTED_FIXTURE_READ' }, 501);
    }
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => unexpected.push({ role, locale, width, error: error.message }));
  await page.clock.install({ time: new Date('2026-11-07T08:01:00Z') });
  return { context, page, state, cdp: await context.newCDPSession(page) };
}
const focusRead = async (page) => {
  await page.clock.runFor(1100);
  await page.evaluate(() => globalThis.dispatchEvent(new Event('focus')));
};
async function noOverflow(page) {
  const overflow = await page.evaluate(() => {
    const { document } = globalThis;
    const { scrollWidth, clientWidth } = document.documentElement;
    if (scrollWidth <= clientWidth) return null;
    const edges = [...document.querySelectorAll('body *')]
      .filter((node) => node.getBoundingClientRect().right > clientWidth)
      .slice(-12)
      .map((node) => `${node.localName}.${node.getAttribute('class') ?? ''}`);
    return { scrollWidth, clientWidth, edges };
  });
  assert.equal(overflow, null, `Horizontal overflow ${JSON.stringify(overflow)}`);
}
async function capture(page, name) {
  await page.evaluate(() => globalThis.document.fonts.ready);
  const bytes = await page.screenshot({
    path: fileURLToPath(new URL(name, images)),
    animations: 'disabled',
  });
  screenshots.push({ name, sha256: createHash('sha256').update(bytes).digest('hex') });
}
const activate = async (target) => {
  await target.focus();
  await target.press('Enter');
};
async function verifySafeArea(cdp, nav) {
  const padding = () =>
    nav.evaluate((el) => parseFloat(globalThis.getComputedStyle(el).paddingBottom));
  const original = await padding();
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { bottom: 24, bottomMax: 24 } });
  await expect.poll(padding).toBe(original + 24);
}

try {
  for (const [role, path] of Object.entries(rolePaths))
    for (const locale of ['ru', 'ro'])
      for (const width of widths) {
        const { context, page, state, cdp } = await setup(role, locale, width);
        try {
          await page.goto(`${origin}${path}?ui.k8k=1`);
          const shell = page.locator('.k8k-shell');
          const main = page.locator('.k8k-main');
          const ready = main.locator('[data-state="ready"]').first();
          await expect(ready).toBeVisible();
          await expect(page.locator('html')).toHaveAttribute('lang', locale);
          const mobile = width < 1024;
          const nav = shell.getByRole('navigation', { name: navigation[locale][mobile ? 1 : 0] });
          await expect(nav).toBeVisible();
          const navBefore = await nav
            .locator('a')
            .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
          await activate(shell.locator('.k8k-skip'));
          await expect(main).toBeFocused();
          if (mobile) {
            const toggle = shell.locator('.k8k-menu-button');
            await activate(toggle);
            await expect(toggle).toHaveAttribute('aria-expanded', 'true');
            await page.keyboard.press('Escape');
            await expect(toggle).toBeFocused();
            await expect(toggle).toHaveAttribute('aria-expanded', 'false');
          }
          const summary = shell.locator('.account-menu > summary');
          await activate(summary);
          const languageSelect = page.getByRole('combobox', { name: language[locale] });
          await expect(languageSelect).toHaveValue(locale);
          if (width === 360) {
            const other = locale === 'ru' ? 'ro' : 'ru';
            await languageSelect.selectOption(other);
            await expect(page.locator('html')).toHaveAttribute('lang', other);
            await page.getByRole('combobox', { name: language[other] }).selectOption(locale);
          }
          await page.keyboard.press('Escape');
          await expect(summary).toBeFocused();
          await noOverflow(page);
          if (mobile) await verifySafeArea(cdp, nav);
          await capture(page, `${role.toLowerCase()}-${locale}-${width}.png`);
          const reflowWidth = Math.max(320, width / 2);
          await page.setViewportSize({ width: reflowWidth, height: 550 });
          const reflowNav = shell.getByRole('navigation', { name: navigation[locale][1] });
          await expect(reflowNav).toBeVisible();
          if (!mobile) await verifySafeArea(cdp, reflowNav);
          await noOverflow(page);
          if (role === 'STUDENT' && reflowWidth === 320) {
            await activate(summary);
            await expect(languageSelect).toBeVisible();
            await noOverflow(page);
            await capture(page, `student-${locale}-320-reflow.png`);
            await page.keyboard.press('Escape');
          }
          await page.setViewportSize({ width, height: 900 });
          await expect(nav).toBeVisible();
          const received = ready.locator('time[data-time-source="client"]');
          await expect(received).toHaveCount(1);
          if (role !== 'TECH_OPERATOR')
            await expect(
              ready.locator(`time[data-time-source="server"][datetime="${asOf}"]`),
            ).toHaveCount(1);
          if (role === 'MANAGER') {
            const priority = main.locator('.k8k-priority-slot');
            await expect(priority).toHaveCount(0);
            if (width === 360) {
              state.priority = {
                primary: { taskId: id, title: 'Synthetic priority event' },
                criticalCount: 5,
                queueAction: 'TASK_QUEUE',
                sourceAsOf: asOf,
              };
              await focusRead(page);
              await expect(priority.getByRole('heading')).toHaveText('Synthetic priority event');
              await expect(priority.locator('[data-slot="queue"] strong')).toHaveText('5');
              state.priority = null;
              await focusRead(page);
              await expect(
                main
                  .getByRole('region', {
                    name:
                      locale === 'ru'
                        ? 'События, требующие внимания'
                        : 'Evenimente care necesită atenție',
                  })
                  .getByRole('button'),
              ).toBeVisible();
              await expect(priority).toHaveCount(0);
            }
            state.priority = {
              primary: null,
              criticalCount: 0,
              queueAction: 'TASK_QUEUE',
              sourceAsOf: asOf,
            };
            await focusRead(page);
            await expect(priority.locator('[data-slot="queue"] strong')).toHaveText('0');
          }
          state.status = 503;
          await focusRead(page);
          await expect(main.locator('[data-state="stale"]').first()).toBeVisible();
          await expect(main.locator('.k8k-priority-slot')).toHaveCount(0);
          assert.deepEqual(
            await nav
              .locator('a')
              .evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
            navBefore,
          );
          if (width === 360 && role === 'STUDENT') {
            state.status = 200;
            await page.goto(`${origin}/student/notifications?ui.k8k=1`);
            await expect(page).toHaveURL(/\/student\?events=1$/);
            await expect(page.locator('.k8k-notification-menu[open]')).toBeVisible();
          }
          if (width === 360 && role === 'MANAGER') {
            await page.goto(`${origin}/manager/tasks?overdue=true&ui.k8k=1`);
            await expect(main.locator('input[type="checkbox"]')).toBeChecked();
          }
          if (width === 1280 && role === 'TECH_OPERATOR') {
            state.status = 403;
            await focusRead(page);
            await expect(main.locator('[data-state="forbidden"]')).toBeVisible();
            assert(state.reads.filter((read) => read === '/api/v1/auth/session').length >= 3);
          }
          cases.push({
            role,
            path,
            locale,
            width,
            reflowWidth,
            safeAreaBottom: 24,
            reads: state.reads,
          });
        } catch (error) {
          failures.push({ role, path, locale, width, error: error.message });
          console.error(`${role} ${locale} ${width}: ${error.message}`);
        } finally {
          await context.close();
        }
      }
  for (const locale of ['ru', 'ro'])
    for (const width of widths) {
      const { context, page, cdp } = await setup('SHARED', locale, width);
      try {
        const path = width === 360 ? '/' : '/account';
        await page.goto(`${origin}${path}?ui.k8k=1`);
        const email = page.locator('form input[type="email"]');
        const password = page.locator('form input[type="password"]');
        await expect(page.getByRole('combobox', { name: language[locale] })).toHaveValue(locale);
        await email.fill('shell@example.invalid');
        await email.press('Tab');
        await expect(password).toBeFocused();
        await cdp.send('Emulation.setVirtualKeyboardGeometryOverride', {
          keyboardRect: { x: 0, y: 480, width, height: 320 },
        });
        await expect
          .poll(() => page.evaluate(() => globalThis.navigator.virtualKeyboard.boundingRect.height))
          .toBe(320);
        await page.setViewportSize({ width, height: 480 });
        await password.scrollIntoViewIfNeeded();
        await expect(password).toBeInViewport();
        await expect(password).toBeFocused();
        await password.press('Tab');
        await expect(page.locator('form button[type="submit"]')).toBeFocused();
        await noOverflow(page);
        await capture(page, `login-${locale}-${width}.png`);
        cases.push({
          role: 'SHARED',
          path,
          locale,
          width,
          keyboardGeometry: 320,
          remainingHeight: 480,
        });
      } catch (error) {
        failures.push({ role: 'SHARED', locale, width, error: error.message });
        console.error(`SHARED ${locale} ${width}: ${error.message}`);
      } finally {
        await context.close();
      }
    }
  await write('browser.json', {
    browser: browser.version(),
    cases,
    screenshots,
    failures,
    unexpected,
  });
  console.log(
    `Shell/login ${cases.length}/48; ${screenshots.length} screenshots; ${unexpected.length} unexpected requests or page errors.`,
  );
  assert.deepEqual(unexpected, []);
  assert.deepEqual(failures, []);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

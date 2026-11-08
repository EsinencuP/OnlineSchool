import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
const run = path.join(
  root,
  'output/k8k-tasks/TASK-021/runs',
  new Date().toISOString().replaceAll(':', '-'),
);
const fixture = path.join(run, 'fixture');
await mkdir(run, { recursive: true });
const require = createRequire(path.join(root, 'apps/manager-web/package.json'));
const { build } = await import(pathToFileURL(require.resolve('vite')));
const { default: react } = await import(pathToFileURL(require.resolve('@vitejs/plugin-react')));
const alias = [
  ['@online-school/ui/style.css', 'packages/ui/src/style.css'],
  ['@online-school/account-ui/style.css', 'packages/account-ui/src/style.css'],
  ['@online-school/ui', 'packages/ui/src/index.ts'],
  ['@online-school/account-ui', 'packages/account-ui/src/index.tsx'],
  ['@online-school/api-contracts', 'packages/api-contracts/src/index.ts'],
  ['@online-school/shared', 'packages/shared/src/index.ts'],
].map(([find, file]) => ({ find, replacement: path.join(root, file) }));
await build({
  root: path.join(root, 'apps/manager-web/test/ui-refresh'),
  configFile: false,
  envDir: false,
  publicDir: false,
  plugins: [react()],
  resolve: { alias, dedupe: ['react', 'react-dom'] },
  build: { outDir: fixture },
  logLevel: 'error',
});
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const file = path.resolve(
      fixture,
      url.pathname.startsWith('/assets/') ? url.pathname.slice(1) : 'index.html',
    );
    assert.ok(file.startsWith(fixture + path.sep));
    res.setHeader(
      'Content-Type',
      {
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.html': 'text/html',
        '.woff2': 'font/woff2',
      }[path.extname(file)] ?? 'application/octet-stream',
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const cases = [],
  screenshots = [],
  unexpected = [],
  requests = [];
const base = new Date('2026-11-07T08:00:00Z');
const asOf = '2026-11-07T07:59:40Z';
const lessonId = '50000000-0000-4000-8000-000000000003';
const list = { items: [], total: 0, page: 1, pageSize: 20 };
const wait = (ms = 70) => new Promise((resolve) => setTimeout(resolve, ms));
async function setup(locale, width, url = '/') {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    locale: `${locale}-MD`,
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  });
  await context.addInitScript((locale) => {
    globalThis.localStorage.setItem('k8k.locale', locale);
    globalThis.fixtureVisibility = 'visible';
    globalThis.fixtureOnline = true;
    Object.defineProperty(globalThis.document, 'visibilityState', {
      get: () => globalThis.fixtureVisibility,
    });
    Object.defineProperty(globalThis.navigator, 'onLine', { get: () => globalThis.fixtureOnline });
  }, locale);
  const counts = new Map();
  let gate;
  let fail = false;
  let allowJoin = false;
  let release = () => {};
  const hold = (target) => {
    const promise = new Promise((resolve) => {
      release = resolve;
    });
    gate = { target, promise };
  };
  await context.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    const method = route.request().method();
    if (u.origin !== origin || method !== 'GET') {
      unexpected.push(`${method} ${u.origin}${u.pathname}`);
      return route.abort();
    }
    if (!/^\/(api\/|fixture-read\/)/.test(u.pathname)) return route.continue();
    const target = u.pathname;
    counts.set(target, (counts.get(target) ?? 0) + 1);
    requests.push({ locale, width, target, method });
    if (gate?.target === target) {
      const { promise } = gate;
      gate = undefined;
      await promise;
    }
    const fulfill = (json, status = 200) =>
      route.fulfill({ json, status, headers: { 'Cache-Control': 'no-store' } });
    if (target === '/api/v1/platform/accounts')
      return fulfill({ enabled: false, currentKey: null, items: [] });
    if (target.startsWith('/fixture-read/'))
      return fail && target.endsWith('/dashboard')
        ? fulfill({ code: 'NETWORK_ERROR' }, 503)
        : fulfill({ items: [], asOf });
    if (target === '/api/v1/student/me')
      return fulfill({
        id: '50000000-0000-4000-8000-000000000001',
        userId: '50000000-0000-4000-8000-000000000002',
        displayName: 'Fixture',
        timeZone: 'Europe/Chisinau',
        hasActiveAccess: true,
        mustChangePassword: false,
      });
    if (target === '/api/v1/student/notifications/count') return fulfill({ unreadCount: 0 });
    if (target === '/api/v1/student/dashboard')
      return fulfill({
        generatedAt: counts.get(target) === 1 ? base.toISOString() : '2026-11-07T08:00:21Z',
        nextLesson: {
          lessonId,
          scheduledAt: '2026-11-07T08:10:20Z',
          durationMinutes: 60,
          teacherName: 'Fixture',
          subjectName: 'Fixture lesson',
          meetLink: 'https://meet.google.com/abc-defg-hij',
          canJoin: allowJoin,
        },
        homework: { total: 0 },
        subscription: null,
      });
    if (target === '/api/v1/student/skills') return fulfill([]);
    if (
      [
        '/api/v1/student/lessons/upcoming',
        '/api/v1/student/homework',
        '/api/v1/student/skills/snapshots',
      ].includes(target)
    )
      return fulfill(list);
    unexpected.push(target);
    return fulfill({ code: 'UNEXPECTED_FIXTURE_READ' }, 501);
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => unexpected.push(error.message));
  await page.clock.install({ time: base });
  page.setDefaultTimeout(5000);
  const count = (target) => counts.get(target) ?? 0;
  const expectCount = async (target, n) => {
    for (let i = 0; i < 20 && count(target) < n; i++) await wait(30);
    await wait();
    assert.equal(count(target), n, target);
  };
  const go = () =>
    page.goto(`${origin}${url}?ui.k8k=1${url === '/' && width === 1024 ? '&live=1' : ''}`);
  return {
    context,
    page,
    go,
    count,
    expectCount,
    hold,
    release: () => release(),
    fail: () => {
      fail = true;
    },
    allow: () => {
      allowJoin = true;
    },
  };
}
const signal = (page, { visibility, online, events }) =>
  page.evaluate(
    ({ visibility, online, events }) => {
      if (visibility) globalThis.fixtureVisibility = visibility;
      if (online !== undefined) globalThis.fixtureOnline = online;
      for (const type of events)
        (type === 'visibilitychange' ? globalThis.document : globalThis).dispatchEvent(
          new Event(type, { bubbles: true }),
        );
    },
    { visibility, online, events },
  );
async function capture(page, locale, width, scenario) {
  const file = `${locale}-${width}-${scenario}.png`;
  await page.evaluate(() => globalThis.document.fonts.ready);
  assert.ok(
    await page.evaluate(
      () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
    ),
  );
  await page.screenshot({ path: path.join(run, file), animations: 'disabled' });
  screenshots.push({
    file,
    locale,
    width,
    scenario,
    sha256: createHash('sha256')
      .update(await readFile(path.join(run, file)))
      .digest('hex'),
  });
}
try {
  for (const locale of ['ru', 'ro'])
    for (const width of [360, 768, 1024, 1280]) {
      const f = await setup(locale, width),
        { page } = f;
      const key = width === 1024 ? 'lesson' : 'dashboard';
      const target = `/fixture-read/${key}`;
      try {
        await f.go();
        await page.locator('[data-state="empty"]').waitFor();
        await capture(page, locale, width, 'cached-empty');
        const draft = page.locator('#draft');
        await draft.fill('Synthetic unsaved edit');
        const node = await draft.elementHandle();
        await page.clock.runFor(31_000);
        await signal(page, { visibility: 'hidden', events: ['visibilitychange'] });
        await signal(page, { visibility: 'visible', events: ['focus', 'visibilitychange'] });
        await f.expectCount('/fixture-read/me', 2);
        await f.expectCount(target, 1);
        assert.ok(await node.evaluate((el) => el === el.ownerDocument.activeElement));
        assert.equal(await draft.inputValue(), 'Synthetic unsaved edit');
        await draft.press('Tab');
        assert.ok(
          await page.locator('#outside').evaluate((el) => el === el.ownerDocument.activeElement),
        );
        await f.expectCount(target, 2);
        assert.ok(await node.evaluate((el) => el.isConnected));
        assert.equal(await draft.inputValue(), 'Synthetic unsaved edit');
        cases.push({ locale, width, scenario: 'editing retains DOM and auth focus bypasses gate' });

        await page.clock.runFor(1100);
        f.hold(target);
        await signal(page, { events: ['focus', 'visibilitychange', 'online'] });
        await f.expectCount(target, 3);
        await signal(page, { events: ['focus', 'visibilitychange'] });
        await f.expectCount(target, 3);
        f.release();
      await page.locator('.k8k-state-data[aria-busy="false"]').waitFor({ state: 'attached' });
        cases.push({ locale, width, scenario: 'focus, visibility, online and in-flight coalesce' });

        await page.clock.runFor(1100);
        await page.locator('#open').click();
        await page.getByRole('dialog').waitFor();
        await signal(page, { events: ['focus', 'visibilitychange'] });
        await f.expectCount(target, 3);
        await page.locator('#close').click();
        await page.getByRole('dialog').waitFor({ state: 'detached' });
        await f.expectCount(target, 4);
        cases.push({ locale, width, scenario: 'Radix close releases one deferred read' });

        await signal(page, {
          online: false,
          visibility: 'hidden',
          events: ['offline', 'visibilitychange'],
        });
        await page.clock.fastForward(60_100);
        await f.expectCount(target, 4);
        await signal(page, { visibility: 'visible', events: ['visibilitychange', 'focus'] });
        await f.expectCount(target, 4);
        await signal(page, { online: true, events: ['online', 'focus', 'visibilitychange'] });
        await f.expectCount(target, 5);
        await f.expectCount('/fixture-read/reports', 1);
        cases.push({
          locale,
          width,
          scenario: 'hidden/offline polling blocked; online resumes only operational group',
        });

        if (key === 'dashboard') {
          f.fail();
          await draft.focus();
          await page.locator('#invalidate').evaluate((button) => button.click());
          await page.locator('[data-state="stale"]').waitFor();
          await f.expectCount(target, 6);
          assert.ok(await node.evaluate((el) => el === el.ownerDocument.activeElement));
          assert.equal(await page.locator('[data-state="empty"]').count(), 0);
          assert.equal(
            await page.locator('[data-time-source="server"]').getAttribute('datetime'),
            '2026-11-07T07:59:40.000Z',
          );
          assert.notEqual(
            await page.locator('[data-time-source="client"]').getAttribute('datetime'),
            '2026-11-07T07:59:40.000Z',
          );
          await capture(page, locale, width, 'stale-empty');
          cases.push({
            locale,
            width,
            scenario: 'direct invalidation and stale empty source and receipt',
          });
        }
        const count = f.count(target);
        await page.locator('#stop').click();
        await page.clock.fastForward(65_000);
        await signal(page, { events: ['focus', 'visibilitychange', 'online'] });
        await f.expectCount(target, count);
        cases.push({ locale, width, scenario: 'cleanup stops timers and listeners' });
      } catch (error) {
        console.error(await page.locator('body').innerText(), requests.slice(-12), unexpected);
        throw error;
      } finally {
        f.release();
        await f.context.close();
      }
    }
  for (const [width, period, key] of [
    [768, 60_000, 'dashboard'],
    [1024, 15_000, 'lesson'],
  ]) {
    const f = await setup('ru', width),
      { page } = f;
    const target = `/fixture-read/${key}`;
    try {
      await f.go();
      await page.locator('[data-state="empty"]').waitFor();
      await page.clock.runFor(period - 2000);
      await f.expectCount(target, 1);
      await page.clock.runFor(2200);
      await f.expectCount(target, 2);
      await f.expectCount('/fixture-read/reports', 1);
      cases.push({ locale: 'ru', width, scenario: `one automatic read after ${period}ms` });
    } finally {
      f.release();
      await f.context.close();
    }
  }
  for (const locale of ['ru', 'ro']) {
    const width = 360,
      f = await setup(locale, width, '/student'),
      { page } = f;
    const target = '/api/v1/student/dashboard';
    try {
      await f.go();
      const join = page.locator('.k8k-meet-action');
      await join.waitFor();
      assert.equal(await join.getAttribute('href'), null);
      f.hold(target);
      await page.clock.runFor(20_200);
      await f.expectCount(target, 2);
      assert.equal(await join.getAttribute('href'), null);
      await signal(page, { events: ['focus', 'visibilitychange'] });
      await f.expectCount(target, 2);
      f.release();
      await page.locator('[data-module="DASH-STU-01"]').waitFor();
      await wait();
      await page.clock.runFor(1100);
      f.allow();
      await signal(page, { events: ['focus', 'visibilitychange'] });
      await page.locator('.k8k-meet-action[href]').waitFor();
      await f.expectCount(target, 3);
      await capture(page, locale, width, 'server-can-join');
      cases.push({
        locale,
        width,
        scenario: 'actual StudentLayout/Home T−10 asks server before enabling Meet',
      });
    } catch (error) {
      console.error(await page.locator('body').innerText(), requests.slice(-12), unexpected);
      throw error;
    } finally {
      f.release();
      await f.context.close();
    }
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
assert.deepEqual(unexpected, []);
const result = {
  run: path.relative(root, run).replaceAll('\\', '/'),
  browser: browser.version(),
  cases,
  screenshots,
  requests,
  unexpected,
};
await writeFile(path.join(run, 'browser.json'), JSON.stringify(result, null, 2) + '\n');
console.log(
  JSON.stringify({
    run: result.run,
    cases: cases.length,
    screenshots: screenshots.length,
    reads: requests.length,
    unexpected,
  }),
);

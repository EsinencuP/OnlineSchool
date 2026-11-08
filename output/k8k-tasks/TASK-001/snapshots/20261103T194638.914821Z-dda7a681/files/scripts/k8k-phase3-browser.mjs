// Student-only production UI + synthetic HTTP/component fixtures. No working API/DB/S3.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import {
  startFixture,
  lessonId,
  homeworkId,
} from '../apps/student-cabinet/tests/fixture-server.mjs';
const root = resolve(import.meta.dirname, '..'),
  out = resolve(root, 'output/k8k-phase3');
await mkdir(out, { recursive: true });
const requireManager = createRequire(resolve(root, 'apps/manager-web/package.json'));
const { default: AxeBuilder } = await import(
  pathToFileURL(requireManager.resolve('@axe-core/playwright'))
);
const { createServer } = await import(pathToFileURL(requireManager.resolve('vite')));
const { default: react } = await import(
  pathToFileURL(requireManager.resolve('@vitejs/plugin-react'))
);
const component = await createServer({
  root: resolve(root, 'apps/student-cabinet/tests/k8k-subscriptions'),
  configFile: false,
  plugins: [react()],
  server: { host: '127.0.0.1', port: 55185, strictPort: true, fs: { allow: [root] } },
});
const server = startFixture(55184);
await component.listen();
const browser = await chromium.launch({ headless: true });
const base = 'http://127.0.0.1:55184',
  rows = [],
  checks = [],
  failures = [];
const cases = [
  { id: 'ready', path: '' },
  { id: 'early', path: '' },
  { id: 'missing-meet', path: '' },
  { id: 'invalid-meet', path: '' },
  { id: 'skewed-clock', path: '' },
  { id: 'empty', path: '' },
  { id: 'partial-access', path: '' },
  { id: 'frozen-access', path: '' },
  { id: 'notifications', path: '' },
  { id: 'suspended', path: '/suspended', state: { active: false } },
  ...[
    ['lessons', '/lessons'],
    ['lesson-detail', `/lessons/${lessonId}`],
    ['homework', '/homework'],
    ['homework-editor', `/homework/${homeworkId}`],
    ['skills', '/skills'],
    ['materials', '/materials'],
    ['subscription', '/subscription'],
    ['events', '/notifications'],
    ['profile', '/profile'],
    ['security', '/security'],
    ['password', '/security/change-password'],
    ['login', '/login'],
  ].map(([id, path]) => ({ id, path })),
  { id: 'legacy', path: '', legacy: true },
];
async function capture(page, id, width, axe = true) {
  await page.evaluate(() => globalThis.document.fonts.ready);
  const violations = axe
    ? (await new AxeBuilder({ page }).analyze()).violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      }))
    : [];
  const file = `${id}-${width}.png`;
  await page.screenshot({ path: resolve(out, file), fullPage: true, animations: 'disabled' });
  const dom = await page.evaluate(() => ({
    overflow: globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
    title: globalThis.document.title,
    k8k: globalThis.document.documentElement.dataset.k8k ?? null,
    photos: globalThis.document.querySelectorAll('img').length,
    knowledgeBars: globalThis.document.querySelectorAll('progress').length,
    homeworkChecks: globalThis.document.querySelectorAll(
      '[data-module="DASH-STU-02"] input[type="checkbox"]',
    ).length,
  }));
  rows.push({
    id,
    width,
    file,
    sha256: createHash('sha256')
      .update(await readFile(resolve(out, file)))
      .digest('hex'),
    dom,
    violations,
  });
  assert.ok(!dom.overflow, `${id}/${width}: horizontal overflow`);
  assert.deepEqual(violations, [], `${id}/${width}: axe`);
  if (!id.startsWith('legacy')) {
    assert.equal(dom.photos, 0);
    assert.equal(dom.knowledgeBars, 0);
    assert.equal(dom.homeworkChecks, 0);
  }
}
try {
  for (const item of cases) {
    const context = await browser.newContext({ locale: 'ru-RU', timezoneId: 'Europe/Chisinau' });
    await context.request.post(`${base}/__fixture/reset`, { data: { ...item.state } });
    await context.addCookies((await context.request.storageState()).cookies);
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    if (item.id === 'skewed-clock')
      await page.clock.install({ time: new Date('2099-01-01T00:00:00Z') });
    await context.route('**/*', (route) =>
      ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname)
        ? route.continue()
        : route.abort(),
    );
    await page.route('**/api/**', async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname === '/api/v1/platform/accounts')
        return route.fulfill({ json: { enabled: false, currentKey: null, items: [] } });
      const response = await route.fetch();
      if (response.status() === 204) return route.fulfill({ response });
      let body = await response.json();
      if (pathname.endsWith('/dashboard') && response.status() === 200) {
        if (item.id === 'early')
          body.nextLesson = {
            ...body.nextLesson,
            scheduledAt: new Date(Date.now() + 2 * 3600000).toISOString(),
            canJoin: true,
          };
        if (item.id === 'missing-meet') body.nextLesson = { ...body.nextLesson, meetLink: null };
        if (item.id === 'invalid-meet')
          body.nextLesson = { ...body.nextLesson, meetLink: 'javascript:alert(1)' };
        if (item.id === 'empty' || item.id === 'frozen-access') body.nextLesson = null;
        if (item.id === 'empty')
          body.homework = { notSubmitted: 0, submitted: 0, needsRevision: 0, total: 0 };
        if (item.id === 'partial-access')
          body.subscription = {
            lessonsRemaining: 0,
            validUntil: '2020-01-01',
            isFrozen: false,
            frozenUntil: null,
          };
        if (item.id === 'frozen-access')
          body.subscription = {
            lessonsRemaining: 3,
            validUntil: '2026-11-30',
            isFrozen: true,
            frozenUntil: '2026-11-15',
          };
      }
      if (item.id === 'empty' && pathname === '/api/v1/student/skills') body = [];
      if (
        (item.id === 'empty' || item.id === 'frozen-access') &&
        pathname === '/api/v1/student/lessons/upcoming'
      )
        body = { items: [], total: 0, page: 1, pageSize: 20 };
      if (item.id === 'empty' && pathname === '/api/v1/student/homework')
        body = { items: [], total: 0, page: 1, pageSize: 3 };
      if (pathname === '/api/v1/student/skills/snapshots' && item.id !== 'empty')
        body = {
          items: [
            {
              snapshotId: '30000000-0000-4000-8000-000000000009',
              subjectName: 'Английский язык',
              createdAt: new Date().toISOString(),
              lessonNumber: 4,
              teacherSummary: 'Опубликованный комментарий преподавателя из синтетического API.',
              skills: [
                {
                  skillName: 'Аудирование',
                  status: 'PRACTICING',
                  teacherComment: 'Продолжай практику.',
                },
              ],
            },
          ],
          total: 1,
          page: 1,
          pageSize: 1,
        };
      if (pathname === '/api/v1/student/notifications')
        body.items = body.items.map((n) => ({ ...n, payload: { homeworkId } }));
      return route.fulfill({ response, json: body });
    });
    for (const width of ['ready', 'early', 'empty', 'notifications', 'suspended'].includes(item.id)
      ? [360, 768, 1024, 1280]
      : [360, 1280]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${base}/student${item.path}?ui.k8k=${item.legacy ? 0 : 1}`, {
        waitUntil: 'networkidle',
      });
      await page.locator('h1').first().waitFor();
      if (
        !item.legacy &&
        item.path !== '/suspended' &&
        item.path !== '/login' &&
        item.path !== '/security/change-password'
      )
        await page.locator('.k8k-shell').waitFor();
      if (item.id === 'notifications')
        await page.locator('.k8k-notification-menu > summary').click();
      if (item.id === 'ready') {
        const join = page.locator('.k8k-lesson-hero .k8k-meet-action');
        await join.waitFor();
        assert.match(await join.getAttribute('href'), /^https:\/\/meet\.google\.com\//);
        assert.ok(await join.evaluate((el) => el.getBoundingClientRect().height >= 48));
        assert.equal(await page.locator('[data-module="DASH-STU-05"]').count(), 0);
        const nav = await page.locator('.k8k-sidebar nav').textContent();
        assert.ok(!/Сообщения|Уведомления/.test(nav));
      }
      if (item.id === 'early') {
        assert.equal(await page.locator('.k8k-lesson-hero .k8k-meet-action[href]').count(), 0);
        assert.match(await page.locator('.k8k-join-reason').textContent(), /10 минут/);
      }
      if (['missing-meet', 'invalid-meet'].includes(item.id))
        assert.equal(await page.locator('.k8k-lesson-hero .k8k-meet-action').count(), 0);
      if (item.id === 'skewed-clock')
        assert.match(await page.locator('.k8k-hero-countdown').textContent(), /Через [1-9]\d* мин/);
      if (item.id === 'suspended') {
        assert.equal(await page.locator('.k8k-shell').count(), 0);
        assert.equal(await page.locator('nav').count(), 0);
        const state = await (await context.request.get(`${base}/__fixture/state`)).json();
        assert.ok(
          state.calls.every(
            (c) => !c.path.startsWith('/api/v1/student/') || c.path === '/api/v1/student/me',
          ),
        );
      }
      if (item.id === 'partial-access' || item.id === 'frozen-access')
        assert.ok(!page.url().includes('/suspended'));
      await capture(page, item.id, width, !item.legacy);
    }
    if (item.id === 'ready') {
      await page.goto(`${base}/student?ui.k8k=1`, { waitUntil: 'networkidle' });
      await page.locator('.k8k-lesson-hero .k8k-meet-action').focus();
      await page.evaluate(() => {
        globalThis.__joinNode = globalThis.document.activeElement;
      });
      await page.route('**/api/v1/student/dashboard', (route) =>
        route.fulfill({ status: 503, json: { code: 'DASHBOARD_UNAVAILABLE' } }),
      );
      await page.evaluate(() => globalThis.dispatchEvent(new Event('focus')));
      await page.locator('.k8k-student-focus [data-state="stale"]').waitFor();
      assert.equal(await page.locator('.k8k-lesson-hero .k8k-meet-action[href]').count(), 0);
      assert.ok(
        await page
          .locator('.k8k-meet-action')
          .evaluate(
            (el) => el === globalThis.__joinNode && el === globalThis.document.activeElement,
          ),
      );
      await capture(page, 'stale', 1280);
      await page.route('**/api/v1/student/dashboard', (route) =>
        route.fulfill({ status: 403, json: { code: 'PROFILE_NOT_FOUND' } }),
      );
      await page
        .locator('.k8k-student-focus')
        .getByRole('button', { name: 'Повторить загрузку' })
        .click();
      await page.locator('.k8k-student-focus [data-state="forbidden"]').waitFor();
      assert.equal(await page.locator('.k8k-lesson-hero').count(), 0);
      await capture(page, 'forbidden', 1280);
      checks.push('ready/stale/403: no stale Meet URL; stable focused link until access denial');
    }
    if (item.id === 'notifications') {
      await page.locator('.k8k-notification-menu > summary').click();
      await page.locator('.k8k-notification-menu > summary').click();
      const write = page.waitForResponse(
        (response) => response.request().method() === 'POST' && response.url().endsWith('/read'),
      );
      await page.getByRole('button', { name: 'Отметить прочитанным' }).first().click();
      await write;
      const state = await (await context.request.get(`${base}/__fixture/state`)).json();
      const writes = state.calls.filter((c) => !['GET', 'HEAD'].includes(c.method));
      assert.ok(
        writes.every((c) => c.path.includes('/notifications/') && c.path.endsWith('/read')),
      );
      assert.ok(writes.every((c) => c.csrf === 'fixture-csrf'));
      checks.push('bell: explicit mark-read only, existing CSRF; no CRM/finance/external mutation');
    }
    if (item.id === 'frozen-access') {
      await page.goto(`${base}/student/homework/${homeworkId}`, { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: /Present Perfect/ }).waitFor();
      checks.push(
        'server hasActiveAccess=true preserves previously assigned homework during freeze',
      );
    }
    assert.deepEqual(errors, [], `${item.id}: uncaught browser error`);
    await context.close();
    console.log(`${item.id}: passed`);
  }
  const context = await browser.newContext({ locale: 'ru-RU' }),
    page = await context.newPage();
  await page.goto('http://127.0.0.1:55185/?ui.k8k=1', { waitUntil: 'networkidle' });
  for (const width of [360, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.equal(await page.locator('[data-module="DASH-STU-05"]').count(), 1);
    assert.equal(await page.getByRole('heading', { name: 'Физика', exact: true }).count(), 1);
    assert.equal(await page.getByRole('link', { name: 'Подробнее' }).count(), 3);
    await capture(page, 'subject-subscriptions-component', width);
  }
  checks.push(
    'subject-subscription renderer: active, expired and frozen independent rows; disabled duplicate stays absent; synthetic component source only',
  );
  await context.close();
} catch (error) {
  failures.push(String(error.stack ?? error));
  console.error(error);
  process.exitCode = 1;
} finally {
  await writeFile(
    resolve(out, 'browser.json'),
    JSON.stringify(
      {
        fixtureOnly: true,
        boundary:
          'Production student build; local synthetic API and separate component-only source; no working API/DB/S3 or external traffic.',
        rows,
        checks,
        failures,
      },
      null,
      2,
    ),
  );
  await browser.close();
  await component.close();
  await new Promise((done) => server.close(done));
}

// Local synthetic boundaries only. Never contacts the working API, DB or external services.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createRequire } from 'node:module';
import { createServer as httpServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { startFixture, homeworkId } from '../apps/student-cabinet/tests/fixture-server.mjs';

const root = resolve(import.meta.dirname, '..'),
  out = resolve(root, 'output/k8k-phase2');
await mkdir(out, { recursive: true });
const fromManager = createRequire(resolve(root, 'apps/manager-web/package.json'));
const { createServer } = await import(pathToFileURL(fromManager.resolve('vite')));
const { default: react } = await import(pathToFileURL(fromManager.resolve('@vitejs/plugin-react')));
const { default: AxeBuilder } = await import(
  pathToFileURL(fromManager.resolve('@axe-core/playwright'))
);
const manager = await createServer({
  root: resolve(root, 'apps/manager-web'),
  configFile: resolve(root, 'apps/manager-web/vite.config.ts'),
  mode: 'mock',
  server: { host: '127.0.0.1', port: 55177, strictPort: true },
});
const fixtureUI = await createServer({
  root: resolve(root, 'packages/ui/tests/browser'),
  configFile: false,
  plugins: [react()],
  server: { host: '127.0.0.1', port: 55179, strictPort: true, fs: { allow: [root] } },
});
const student = startFixture(55174);
const platformDir = resolve(root, 'apps/platform/dist');
const platform = httpServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://local').pathname;
  const target = resolve(
    platformDir,
    pathname.startsWith('/assets/') ? pathname.slice(1) : 'index.html',
  );
  if (!target.startsWith(platformDir + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    res.writeHead(200, {
      'Content-Type':
        {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.woff2': 'font/woff2',
        }[extname(target)] ?? 'application/octet-stream',
    });
    res.end(await readFile(target));
  } catch {
    res.writeHead(404).end();
  }
}).listen(55173, '127.0.0.1');
await manager.listen();
await fixtureUI.listen();
const browser = await chromium.launch({ headless: true });
const rows = [],
  checks = [],
  failures = [];
const now = Date.now();
const catalog = JSON.parse(
  await readFile(resolve(root, 'output/k8k-phase0/demo-catalog.json'), 'utf8'),
).items;
try {
  for (const [role, url, apiRole] of [
    ['student', 'http://127.0.0.1:55174/student', 'STUDENT'],
    ['manager', 'http://127.0.0.1:55177/manager/', 'MANAGER'],
    ['teacher', 'http://127.0.0.1:55173/teacher', 'TEACHER'],
    ['director', 'http://127.0.0.1:55173/director', 'DIRECTOR'],
    ['operator', 'http://127.0.0.1:55173/operator', 'TECH_OPERATOR'],
  ]) {
    const context = await browser.newContext({ locale: 'ru-RU', timezoneId: 'Europe/Chisinau' });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    let readStatus = 200;
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await context.route('**/*', (route) =>
      ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname)
        ? route.continue()
        : route.abort(),
    );
    await context.route('**/api/v1/platform/accounts', (route) =>
      route.fulfill({ json: { enabled: true, currentKey: null, items: catalog } }),
    );
    if (!['student', 'manager'].includes(role)) {
      await page.route('**/api/**', (route) => {
        const pathname = new URL(route.request().url()).pathname;
        const data = {
          '/api/v1/auth/session': {
            account: { id: 'synthetic-staff', kind: 'STAFF', roles: [apiRole] },
            mfa_completed: true,
            recovery_only: false,
            expires_at: new Date(now + 3600000).toISOString(),
          },
          '/api/v1/platform/accounts': { enabled: true, currentKey: null, items: catalog },
          '/api/v1/platform/workspace': {
            name: 'Тестовый сотрудник',
            role: apiRole,
            lessons: [
              {
                id: 'synthetic-lesson',
                startsAt: new Date(now + 3600000).toISOString(),
                endsAt: new Date(now + 7200000).toISOString(),
                status: 'SCHEDULED',
                subject: 'Синтетический предмет',
                student: 'Тестовый ученик',
                teacher: 'Тестовый преподаватель',
                meetUrl: null,
              },
            ],
            students: [
              {
                id: 'synthetic-student',
                name: 'Тестовый ученик',
                subject: 'Синтетический предмет',
              },
            ],
            homework: [],
            tasks: [],
          },
          '/api/v1/qa/components': { api: 'ok', db: 'ok', worker: 'ok' },
        };
        const status =
          pathname.endsWith('/workspace') || pathname.endsWith('/components') ? readStatus : 200;
        return route.fulfill({
          status,
          json:
            status === 200
              ? (data[pathname] ?? {})
              : {
                  code: status === 403 ? 'FORBIDDEN' : 'NETWORK_ERROR',
                  message: 'Synthetic failure',
                },
        });
      });
    }
    for (const enabled of [true, false])
      for (const width of enabled ? [360, 768, 1024, 1280] : [360, 1280]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(`${url}?ui.k8k=${enabled ? 1 : 0}`, { waitUntil: 'networkidle' });
        await page.locator('h1').first().waitFor();
        if (enabled) await page.locator('.k8k-shell').waitFor();
        await page.evaluate(() => globalThis.document.fonts.ready);
        const file = `${role}-${enabled ? 'k8k' : 'legacy'}-${width}.png`;
        await page.screenshot({ path: resolve(out, file), fullPage: true, animations: 'disabled' });
        const dom = await page.evaluate(() => ({
          k8k: globalThis.document.documentElement.dataset.k8k ?? null,
          overflow: globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
          nav: [
            ...globalThis.document.querySelectorAll('.k8k-sidebar nav a,.k8k-sidebar nav button'),
          ].map((x) => x.textContent),
          font: globalThis.getComputedStyle(
            globalThis.document.querySelector('.k8k-shell') ?? globalThis.document.body,
          ).fontFamily,
        }));
        assert.equal(!!dom.k8k, enabled);
        if (enabled) {
          assert.ok(!dom.overflow, `${role} ${width}: overflow`);
          if (role === 'student') {
            assert.equal(
              await page.locator('.k8k-main progress').count(),
              0,
              'no aggregate knowledge scale in new UI',
            );
            const controls = await page.locator('.k8k-main .primary').evaluateAll((elements) =>
              elements.map((el) => ({
                color: globalThis.getComputedStyle(el).color,
                background: globalThis.getComputedStyle(el).backgroundColor,
              })),
            );
            for (const control of controls)
              assert.notEqual(
                control.color,
                control.background,
                'shell must preserve primary action text',
              );
          }
          assert.ok(!dom.nav.some((x) => /сообщения|написать менеджеру/i.test(x)));
          const axe = await new AxeBuilder({ page })
            .include('.k8k-header')
            .include('.k8k-sidebar')
            .include('.k8k-bottom-nav')
            .analyze();
          assert.deepEqual(
            axe.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
            [],
            `${role} ${width}: shell axe`,
          );
        }
        rows.push({ role, width, enabled, file, dom });
      }
    await page.goto(`${url}?ui.k8k=1`, { waitUntil: 'networkidle' });
    if (role === 'student') {
      await page.setViewportSize({ width: 360, height: 1000 });
      await page.getByRole('button', { name: 'Ещё', exact: true }).click();
      await page.locator('.k8k-mobile-menu').waitFor({ state: 'visible' });
      await page.keyboard.press('Escape');
      assert.equal(
        await page
          .getByRole('button', { name: 'Ещё', exact: true })
          .evaluate((el) => el === globalThis.document.activeElement),
        true,
      );
      await page.goto(`http://127.0.0.1:55174/student/homework/${homeworkId}`, {
        waitUntil: 'networkidle',
      });
      assert.ok(
        await page.locator('.k8k-shell').count(),
        'opt-in persists through same-origin navigation',
      );
      checks.push('student: mobile menu Escape returns focus; flag persists through navigation');
    }
    if (role === 'teacher') {
      const before = await page.locator('.k8k-sidebar nav').textContent();
      const refresh = page.getByRole('button', { name: 'Обновить', exact: false });
      await refresh.focus();
      readStatus = 503;
      await refresh.click();
      await page.locator('[data-state="stale"]').waitFor();
      assert.ok(await page.getByText('Синтетический предмет', { exact: true }).count());
      assert.equal(await page.locator('.k8k-sidebar nav').textContent(), before);
      assert.ok(await refresh.evaluate((el) => el === globalThis.document.activeElement));
      await page.screenshot({ path: resolve(out, 'teacher-stale-1280.png'), fullPage: true });
      readStatus = 403;
      await refresh.click();
      await page.locator('[data-state="forbidden"]').waitFor();
      assert.equal(await page.getByText('Синтетический предмет', { exact: true }).count(), 0);
      await page.screenshot({ path: resolve(out, 'teacher-forbidden-1280.png'), fullPage: true });
      checks.push(
        'teacher: background error retains last-known content/nav/focus; 403 removes private content',
      );
    }
    assert.deepEqual(pageErrors, [], `${role}: runtime errors`);
    await context.close();
    console.log(`${role}: new shell at four widths and legacy at two widths passed`);
  }
  const componentContext = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    locale: 'ru-RU',
  });
  const page = await componentContext.newPage();
  await page.clock.install();
  await page.goto('http://127.0.0.1:55179/?ui.k8k=1', { waitUntil: 'networkidle' });
  const field = page.getByRole('textbox', { name: 'Черновик' });
  await field.fill('Сохранить введённый текст');
  await page.evaluate(() => {
    globalThis.__draftNode = globalThis.document.activeElement;
    globalThis.__k8kFixture.setState({ status: 'stale' });
  });
  assert.equal(await field.inputValue(), 'Сохранить введённый текст');
  assert.ok(
    await field.evaluate(
      (el) => el === globalThis.__draftNode && el === globalThis.document.activeElement,
    ),
  );
  await page.evaluate(() =>
    globalThis.__k8kFixture.setState({ status: 'pending', outcome: 'unknown' }),
  );
  assert.ok(
    await field.evaluate(
      (el) => el === globalThis.__draftNode && el === globalThis.document.activeElement,
    ),
  );
  assert.equal(await page.getByRole('button', { name: 'Повторить загрузку' }).count(), 0);
  await page.clock.fastForward(60001);
  assert.equal(await page.getByLabel('Чтения').textContent(), '0', 'editing defers polling');
  await field.blur();
  await page.waitForFunction(() => globalThis.document.querySelector('output').textContent === '1');
  await page.evaluate(() =>
    Object.defineProperty(globalThis.document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    }),
  );
  await page.clock.fastForward(60001);
  assert.equal(await page.getByLabel('Чтения').textContent(), '1');
  await page.evaluate(() => {
    Object.defineProperty(globalThis.document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    globalThis.document.dispatchEvent(new Event('visibilitychange'));
    globalThis.dispatchEvent(new Event('focus'));
  });
  await page.waitForFunction(() => globalThis.document.querySelector('output').textContent === '2');
  await page.clock.runFor(5);
  assert.equal(
    await page.getByLabel('Чтения').textContent(),
    '2',
    'return events are deduplicated',
  );
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
    await page.evaluate(
      (status) =>
        globalThis.__k8kFixture.setState(
          status === 'pending'
            ? { status, outcome: 'unknown' }
            : status === 'subscription-limited'
              ? { status, message: 'Ограничен один предмет; остальные доступны' }
              : { status },
        ),
      status,
    );
    await page.locator(`[data-state="${status}"]`).waitFor();
    if (['forbidden', 'session-expired'].includes(status))
      assert.equal(await page.getByText('PRIVATE_LESSON', { exact: true }).count(), 0);
    const axe = await new AxeBuilder({ page }).analyze();
    assert.deepEqual(
      axe.violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
      [],
      `component state ${status}: axe`,
    );
    await page.screenshot({ path: resolve(out, `state-${status}.png`), fullPage: true });
  }
  checks.push(
    'components: stable input DOM/value/focus in stale and unknown-result; no command retry; nine states pass axe',
  );
  checks.push(
    'refresh: editing defers; blur resumes; hidden tab stops polling; return refreshes once',
  );
  await page.close();
} catch (error) {
  failures.push(String(error.stack ?? error));
  console.error(error);
  process.exitCode = 1;
} finally {
  await writeFile(
    resolve(out, 'browser.json'),
    JSON.stringify({ fixtureOnly: true, rows, checks, failures }, null, 2),
  );
  await browser.close();
  await manager.close();
  await fixtureUI.close();
  await new Promise((r) => student.close(r));
  await new Promise((r) => platform.close(r));
}

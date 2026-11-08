import { test, expect } from './gate-fixtures.mjs';
import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { localeFixture } from './locale-fixtures.mjs';
import { skillFixture } from './skill-journey-fixtures.mjs';
import { reportFixture, oldReport } from './report-journey-fixtures.mjs';
import { bellFixture } from './bell-fixtures.mjs';
import { anchors } from './k8k-subscriptions/data.mjs';
const require = createRequire(new URL('../../manager-web/package.json', import.meta.url));
const AxeBuilder = require('@axe-core/playwright').default;
const lesson = '10000000-0000-4000-8000-000000000001';
const homework = '20000000-0000-4000-8000-000000000001';
const output = () => process.env.K8K_STUDENT_GATE_OUTPUT;
const state = (request) => request.get('/__fixture/state').then((response) => response.json());
const fixture = () => ({
  ...localeFixture(),
  ...skillFixture(),
  ...reportFixture(),
  ...bellFixture(),
  displayName: 'София ' + 'ДлиннаяФамилия'.repeat(8).slice(0, 94),
  subjectHub: true,
  subscriptionScenario: 'ready',
  meetSnapshot: {
    asOf: new Date().toISOString(),
    scheduledAt: new Date(Date.now() + 300000).toISOString(),
    subjectName: 'Математика',
  },
});
async function setup({ request, context }, locale = 'ru', extra = {}) {
  await request.post('/__fixture/reset', { data: { ...fixture(), ...extra } });
  await context.addCookies((await request.storageState()).cookies);
  await context.addInitScript(
    (lang) => globalThis.localStorage.setItem('k8k.locale', lang),
    locale,
  );
}
async function capture(page, name) {
  await page.evaluate(() => globalThis.document.fonts.ready);
  await page.screenshot({
    path: path.join(output(), 'matrix', name + '.png'),
    animations: 'disabled',
  });
}
const routes = [
  ['home', '/student'],
  ['subjects', '/student/subjects'],
  ['help', '/student/help'],
  ['schedule', '/student/lessons?view=list'],
  ['calendar', '/student/lessons?view=calendar&month=2026-11'],
  ['lesson', '/student/lessons/' + lesson],
  ['homework', '/student/homework'],
  ['editor', '/student/homework/' + homework],
  ['skills', '/student/skills'],
  ['reports', '/student/reports'],
  ['report-detail', '/student/reports?reportId=' + oldReport + '&page=3'],
  ['subscriptions', '/student/subscription?subscriptionId=' + anchors.math],
  ['materials', '/student/materials'],
  ['profile', '/student/profile'],
  ['security', '/student/security'],
  ['bell', '/student?events=1'],
  ['login', '/student/login'],
  ['first-password', '/student/security/change-password'],
  ['suspended', '/student/suspended'],
];
for (const locale of ['ru', 'ro'])
  for (const [name, route] of routes) {
    test(`TASK-035 screen matrix ${locale} ${name}`, async ({ page, request, context }) => {
      test.setTimeout(90_000);
      await setup({ request, context }, locale, name === 'suspended' ? { active: false } : {});
      await page.goto(route + (route.includes('?') ? '&' : '?') + 'ui.k8k=1');
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await page.waitForLoadState('networkidle');
      for (const width of [360, 768, 1024, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
          await page.evaluate(() => globalThis.document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        await expect(page.locator('body')).not.toContainText(
          /\b(?:student\.|chrome\.|errors\.|nav\.)[A-Za-z]/,
        );
        await capture(page, `${locale}-${name}-${width}-ready`);
        if (width === 360) {
          const axe = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
            .analyze();
          const failures = axe.violations.map(({ id, nodes }) => ({
            id,
            targets: nodes.map((n) => n.target),
          }));
          appendFileSync(
            path.join(output(), 'axe.jsonl'),
            JSON.stringify({ taskId: 'TASK-035', route, locale, width, failures }) + '\n',
          );
          expect(failures).toEqual([]);
        }
      }
      expect((await state(request)).missingRoutes).toEqual([]);
    });
  }

for (const locale of ['ru', 'ro'])
  for (const status of [
    'loading',
    'empty',
    'error',
    'forbidden',
    'limited',
    'stale',
    'session-expired',
  ]) {
    test(`TASK-035 critical state matrix ${locale} ${status}`, async ({
      page,
      request,
      context,
    }) => {
      test.setTimeout(60_000);
      const extra =
        status === 'loading'
          ? { subjectDelay: 10000 }
          : status === 'empty'
            ? { subjectEmpty: true }
            : status === 'error'
              ? { subjectError: 503 }
              : status === 'forbidden'
                ? { subjectError: 403 }
                : status === 'limited'
                  ? { subscriptionScenario: 'partial' }
                  : {};
      await setup({ request, context }, locale, extra);
      await page.goto('/student/subjects?ui.k8k=1');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      if (status === 'stale' || status === 'session-expired') {
        await expect(page.locator('.k8k-subject-grid')).toBeVisible();
        await request.patch('/__fixture/state', {
          data: status === 'stale' ? { subjectError: 503 } : { auth: false },
        });
        await page.evaluate(() => globalThis.dispatchEvent(new Event('online')));
      }
      if (status === 'session-expired') {
        await expect(page).toHaveURL(/\/student\/login$/);
        await expect(page.locator('.k8k-shell')).toHaveCount(0);
      } else if (status !== 'limited')
        await expect(page.locator(`.k8k-state[data-state=${status}]`)).toBeVisible();
      else await expect(page.locator('.k8k-subject-grid')).toBeVisible();
      for (const width of [360, 768, 1024, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
          await page.evaluate(() => globalThis.document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        await capture(page, `${locale}-subjects-${width}-${status}`);
      }
      expect((await state(request)).missingRoutes).toEqual([]);
    });
  }

test('TASK-035 complete student journey preserves rights, commands and session boundaries', async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(100_000);
  await setup({ request, context }, 'ru', {
    auth: false,
    mustChangePassword: true,
    demoContacts: true,
    demoAlternate: { displayName: 'Другой ученик' },
  });
  await page.goto('/student/login?ui.k8k=1');
  await page.getByLabel('Email', { exact: true }).fill('student@example.invalid');
  await page.getByLabel('Пароль', { exact: true }).fill('Fixture-Temporary-2026!');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/change-password$/);
  await page.getByLabel('Текущий пароль', { exact: true }).fill('Fixture-Temporary-2026!');
  await page.getByLabel('Новый пароль', { exact: true }).fill('Fixture-New-2026!');
  await page.getByLabel('Повторите новый пароль').fill('Fixture-New-2026!');
  await page.getByRole('button', { name: 'Изменить пароль', exact: true }).click();
  await expect(page.locator('.k8k-lesson-hero')).toBeVisible();
  await page.goto('/student/subjects');
  await expect(page.locator('.k8k-subject-grid')).toBeVisible();
  await expect(page.locator('main')).toContainText('Математика');
  await expect(page.locator('main')).toContainText('Физика');
  await page.goto('/student');
  await context.route('https://meet.google.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Synthetic Meet boundary</title>' }),
  );
  const join = page.getByRole('link', { name: 'Войти в Google Meet', exact: true });
  await expect(join).toBeEnabled();
  const [popup] = await Promise.all([context.waitForEvent('page'), join.click()]);
  await popup.close();
  await page.goto('/student/homework/' + homework);
  const answer = page.locator('.k8k-homework-answer textarea');
  await answer.fill('Сквозной учебный черновик');
  await expect.poll(async () => (await state(request)).draft).toBe('Сквозной учебный черновик');
  await page.route('https://upload.student.test/**', (route) =>
    route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' }),
  );
  await page.locator('input[type=file]').setInputFiles({
    name: 'gate-answer.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Synthetic answer'),
  });
  await expect(
    page.getByRole('button', { name: 'Убрать gate-answer.txt', exact: true }),
  ).toBeVisible();
  await page.locator('.k8k-homework-submit').click();
  await expect.poll(async () => (await state(request)).submitted).toBe(true);
  await page.goto('/student/skills');
  const englishSkills = page
    .locator('.panel')
    .filter({ has: page.getByRole('heading', { name: 'Английский язык', exact: true }) })
    .locator('.k8k-skill-list [data-skill-status]');
  await expect(englishSkills).toHaveCount(4);
  await page.goto('/student/reports?reportId=' + oldReport + '&page=3');
  await expect(page.locator('[data-report-id="' + oldReport + '"]')).toBeVisible();
  await page.getByRole('button', { name: 'Подготовить PDF', exact: true }).click();
  await expect.poll(async () => Object.keys((await state(request)).pdfJobs ?? {}).length).toBe(1);
  await page.goto('/student/subscription?subscriptionId=' + anchors.math);
  await expect(page.locator('main')).toContainText('Математика');
  await page.goto('/student/help');
  await expect(page.locator('a[href^="https://wa.me/"]')).toBeVisible();
  const beforeSwitch = await state(request);
  expect(
    beforeSwitch.calls.filter(
      (c) => /attendance|ledger|finance/.test(c.path) && c.method !== 'GET',
    ),
  ).toHaveLength(0);
  expect(beforeSwitch.calls.filter((c) => c.path.endsWith('/submit'))).toHaveLength(1);
  await page.locator('.account-menu > summary').click();
  await page.getByRole('button', { name: /Демо Даниил/ }).click();
  await expect(page.locator('main h1')).toContainText('Другой ученик');
  await page.locator('.account-menu > summary').click();
  await page.getByRole('button', { name: 'Выйти из аккаунта', exact: true }).click();
  await expect(page).toHaveURL(/\/student\/login$/);
  await expect(page.locator('.k8k-shell')).toHaveCount(0);
});

for (const locale of ['ru', 'ro'])
  test(
    'TASK-035 keyboard, 200% reflow and motion preference ' + locale,
    async ({ page, request, context }) => {
      await setup({ request, context }, locale);
      await page.goto('/student?ui.k8k=1');
      await expect(page.locator('.k8k-lesson-hero')).toBeVisible();
      await page.keyboard.press('Tab');
      await expect(page.locator('.k8k-skip')).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.locator('main.k8k-main')).toBeFocused();
      await page.setViewportSize({ width: 360, height: 900 });
      await page.locator('.k8k-menu-button').click();
      await page.keyboard.press('Escape');
      await expect(page.locator('.k8k-menu-button')).toBeFocused();
      await page.locator('.k8k-bell').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('.k8k-bell')).toBeFocused();
      await page.setViewportSize({ width: 1280, height: 900 });
      const zoomContext = await context.browser().newContext({
        viewport: { width: 640, height: 450 },
        deviceScaleFactor: 2,
        storageState: await context.storageState(),
        reducedMotion: 'reduce',
        serviceWorkers: 'block',
      });
      await zoomContext.route('**/*', (route) =>
        new URL(route.request().url()).origin === 'http://127.0.0.1:4175'
          ? route.continue()
          : route.abort(),
      );
      try {
        const zoomPage = await zoomContext.newPage();
        await zoomPage.goto(
          '/student?ui.k8k=1'.replace('/student', 'http://127.0.0.1:4175/student'),
        );
        await expect(zoomPage.locator('.k8k-lesson-hero')).toBeVisible();
        expect(await zoomPage.evaluate(() => globalThis.innerWidth)).toBe(640);
        expect(await zoomPage.evaluate(() => globalThis.devicePixelRatio)).toBe(2);
        expect(
          await zoomPage.evaluate(() => globalThis.document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(640);
        const screenshot = path.join(output(), 'matrix', locale + '-home-200-percent.png');
        await zoomPage.screenshot({ path: screenshot, scale: 'device', animations: 'disabled' });
        appendFileSync(
          path.join(output(), 'screenshots.jsonl'),
          JSON.stringify({
            taskId: 'TASK-035',
            test: test.info().title,
            route: '/student?ui.k8k=1',
            locale,
            state: 'ready',
            zoom: 'emulated 200%: 640 CSS px / 1280 device px',
            viewport: { width: 640, height: 450, dpr: 2 },
            evidence: screenshot,
          }) + '\n',
        );
      } finally {
        await zoomContext.close();
      }
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.setViewportSize({ width: 360, height: 900 });
      await page.locator('.k8k-menu-button').click();
      await page.keyboard.press('Escape');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      expect(
        await page
          .locator('.k8k-menu-button')
          .evaluate((el) => globalThis.getComputedStyle(el).transitionDuration),
      ).toBe('0s');
      await expect(
        page.getByRole('link', {
          name: locale === 'ro' ? 'Intră în Google Meet' : 'Войти в Google Meet',
          exact: true,
        }),
      ).toBeVisible();
    },
  );

for (const locale of ['ru', 'ro'])
  for (const outcome of ['pending', 'unknown-result']) {
    test(`TASK-035 command state matrix ${locale} ${outcome}`, async ({
      page,
      request,
      context,
    }) => {
      test.setTimeout(60_000);
      await setup({ request, context }, locale, {
        loseSubmitResponse: outcome === 'unknown-result',
      });
      let release, complete;
      const pending = new Promise((resolve) => {
        release = resolve;
      });
      const finished = new Promise((resolve) => {
        complete = resolve;
      });
      let started = false;
      if (outcome === 'pending')
        await page.route('**/api/v1/student/homework/*/submit', async (route) => {
          started = true;
          await pending;
          await route.continue();
          complete();
        });
      try {
        await page.goto('/student/homework/' + homework + '?ui.k8k=1');
        await page
          .locator('.k8k-homework-answer textarea')
          .fill('Учебный ответ для проверки исхода');
        await page.locator('.k8k-homework-submit').click();
        if (outcome === 'pending') await expect.poll(() => started).toBe(true);
        else
          await expect(
            page.getByText(
              locale === 'ro'
                ? /Rezultatul trimiterii este încă necunoscut/
                : /Результат отправки пока неизвестен/,
            ),
          ).toBeVisible();
        await expect(page.locator('.k8k-homework-answer textarea')).toBeDisabled();
        for (const width of [360, 768, 1024, 1280]) {
          await page.setViewportSize({ width, height: 900 });
          expect(
            await page.evaluate(() => globalThis.document.documentElement.scrollWidth),
          ).toBeLessThanOrEqual(width);
          await capture(page, `${locale}-homework-${width}-${outcome}`);
        }
      } finally {
        release();
        if (started) await finished;
      }
    });
  }

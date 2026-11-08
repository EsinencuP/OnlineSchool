import { test, expect } from './gate-fixtures.mjs';
import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { localeFixture } from './locale-fixtures.mjs';
import { reportFixture, reportId } from './report-journey-fixtures.mjs';
const require = createRequire(new URL('../../manager-web/package.json', import.meta.url));
const AxeBuilder = require('@axe-core/playwright').default;
const homework = '20000000-0000-4000-8000-000000000001';
async function setup({ request, context }, locale, extra = {}) {
  await request.post('/__fixture/reset', {
    data: { ...localeFixture(), subscriptionScenario: 'ready', ...extra },
  });
  await context.addCookies((await request.storageState()).cookies);
  await context.addInitScript(
    (lang) => globalThis.localStorage.setItem('k8k.locale', lang),
    locale,
  );
}
async function audit(page, locale, state) {
  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const failures = axe.violations.map(({ id, nodes }) => ({
    id,
    targets: nodes.map((n) => n.target),
  }));
  appendFileSync(
    path.join(process.env.K8K_STUDENT_GATE_OUTPUT, 'axe.jsonl'),
    JSON.stringify({
      taskId: 'TASK-035',
      route: new URL(page.url()).pathname,
      locale,
      state,
      width: 360,
      failures,
    }) + '\n',
  );
  await page.screenshot({
    path: path.join(process.env.K8K_STUDENT_GATE_OUTPUT, 'states', locale + '-' + state + '.png'),
    animations: 'disabled',
  });
  expect(failures).toEqual([]);
}
for (const locale of ['ru', 'ro'])
  for (const state of [
    'loading',
    'empty',
    'ready',
    'error',
    'stale',
    'forbidden',
    'subscription-limited',
    'session-expired',
    'pending',
    'unknown-result',
  ]) {
    test(`TASK-035 composed-state accessibility ${locale} ${state}`, async ({
      page,
      request,
      context,
    }) => {
      test.setTimeout(45_000);
      await page.setViewportSize({ width: 360, height: 900 });
      const extra =
        state === 'loading'
          ? { subjectDelay: 20000 }
          : state === 'empty'
            ? { subjectEmpty: true }
            : state === 'error'
              ? { subjectError: 503 }
              : state === 'forbidden'
                ? { subjectError: 403 }
                : state === 'subscription-limited'
                  ? { subscriptionScenario: 'partial' }
                  : state === 'unknown-result'
                    ? { loseSubmitResponse: true }
                    : {};
      await setup({ request, context }, locale, extra);
      let release,
        finished,
        started = false;
      const wait = new Promise((resolve) => {
        release = resolve;
      });
      const done = new Promise((resolve) => {
        finished = resolve;
      });
      if (state === 'pending')
        await page.route('**/api/v1/student/homework/*/submit', async (route) => {
          started = true;
          await wait;
          await route.continue();
          finished();
        });
      try {
        if (state === 'pending' || state === 'unknown-result') {
          await page.goto('/student/homework/' + homework + '?ui.k8k=1');
          await page.locator('.k8k-homework-answer textarea').fill('Синтетический ответ');
          await page.locator('.k8k-homework-submit').click();
          if (state === 'pending') await expect.poll(() => started).toBe(true);
          else
            await expect(
              page.getByText(
                locale === 'ro'
                  ? /Rezultatul trimiterii este încă necunoscut/
                  : /Результат отправки пока неизвестен/,
              ),
            ).toBeVisible();
          await expect(page.locator('.k8k-homework-answer textarea')).toBeDisabled();
        } else {
          await page.goto('/student/subjects?ui.k8k=1');
          await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
          if (state === 'stale' || state === 'session-expired') {
            await expect(page.locator('.k8k-subject-grid')).toBeVisible();
            await request.patch('/__fixture/state', {
              data: state === 'stale' ? { subjectError: 503 } : { auth: false },
            });
            await page.evaluate(() => globalThis.dispatchEvent(new Event('online')));
          }
          if (state === 'session-expired') await expect(page).toHaveURL(/\/student\/login$/);
          else if (state === 'subscription-limited')
            await expect(page.locator('.k8k-subject-grid')).toBeVisible();
          else await expect(page.locator(`.k8k-state[data-state=${state}]`)).toBeVisible();
        }
        await audit(page, locale, state);
      } finally {
        release();
        if (started) await done;
      }
    });
  }
for (const locale of ['ru', 'ro'])
  test(`TASK-035 actual third-page report link ${locale}`, async ({ page, request, context }) => {
    const original = reportFixture().reportRows;
    const rows = original.map((row, index) => ({
      ...row,
      subjectName: index === 24 ? 'Отчёт с третьей страницы' : row.subjectName,
    }));
    await setup({ request, context }, locale, { reportRows: rows });
    await page.goto('/student/reports?page=3&ui.k8k=1');
    await expect(page.locator('.k8k-report-summary')).toHaveCount(10);
    await page.locator('a[href*="reportId=' + reportId(25) + '"]').click();
    await expect(
      page.getByRole('heading', { name: 'Отчёт с третьей страницы', exact: true }),
    ).toBeFocused();
    expect(new URL(page.url()).searchParams.get('page')).toBe('3');
    await page.locator('.k8k-reports-page > a[href^="/student/reports?"]').click();
    await expect(page.locator('.k8k-report-summary')).toHaveCount(10);
    expect(new URL(page.url()).searchParams.get('page')).toBe('3');
  });

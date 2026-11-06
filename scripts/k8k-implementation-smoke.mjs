// Local HTTP fixtures only. External network is blocked. Build student-cabinet first.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { startFixture } from '../apps/student-cabinet/tests/fixture-server.mjs';
const out = new URL('../output/k8k-implementation/browser/', import.meta.url);
await mkdir(out, { recursive: true });
const server = startFixture(0);
if (!server.listening) await new Promise((resolve) => server.once('listening', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const requireManager = createRequire(new URL('../apps/manager-web/package.json', import.meta.url));
const { default: AxeBuilder } = await import(
  pathToFileURL(requireManager.resolve('@axe-core/playwright'))
);
const results = [];
try {
  const context = await browser.newContext();
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
  );
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  for (const width of [360, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${origin}/student/reports?ui.k8k=1`);
    await page.getByRole('heading', { name: 'Опубликованные отчёты', exact: true }).waitFor();
    await page.getByText('Достижения', { exact: true }).count();
    await page.locator('main details > summary').filter({ hasText: '8' }).click();
    await page.getByRole('heading', { name: 'Достижения', exact: true }).waitFor();
    assert.equal(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
      ),
      true,
    );
    await page.screenshot({
      path: new URL(`reports-${width}.png`, out).pathname.replace(/^\/(?:([A-Za-z]):)/, '$1:'),
      fullPage: true,
    });
    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    assert.deepEqual(
      accessibility.violations.map((v) => v.id),
      [],
    );
    results.push({
      width,
      report: true,
      overflow: false,
      axeViolations: accessibility.violations.length,
    });
  }
  await page.getByRole('combobox', { name: 'Язык интерфейса' }).selectOption('ro');
  await page.getByRole('heading', { name: 'Rapoarte publicate', exact: true }).waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'), 'ro');
  await page.reload();
  await page.getByRole('heading', { name: 'Rapoarte publicate', exact: true }).waitFor();
  await page.getByRole('combobox', { name: 'Limba interfeței' }).selectOption('ru');
  await page.goto(`${origin}/student/notifications?ui.k8k=1`);
  await page.waitForURL('**/student?events=1');
  await page.locator('.k8k-notification-menu[open]').waitFor();
  await page.getByRole('button', { name: 'Прочитать все', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.locator('.k8k-notification-menu:not([open])').waitFor();
  results.push({
    localePersistence: true,
    legacyEventsRedirect: true,
    readAll: true,
    escape: true,
  });
  await writeFile(new URL('results.json', out), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

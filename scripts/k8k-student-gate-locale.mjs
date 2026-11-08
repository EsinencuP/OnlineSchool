// Measure a real RU→RO switch against the already source-built, loopback-only student gate.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
const root = new URL('../', import.meta.url),
  out = new URL('output/k8k-taskpack/task-035/', root);
const latest = JSON.parse(await readFile(new URL('latest-accessibility.json', out), 'utf8'));
const budget = JSON.parse(await readFile(new URL(latest.run + '/budgets.json', root), 'utf8'));
const dist = new URL('build/student/', out);
for (const asset of budget.assets)
  assert.equal(
    createHash('sha256')
      .update(await readFile(new URL(asset.file, dist)))
      .digest('hex'),
    asset.sha256,
  );
process.env.STUDENT_FIXTURE_DIST = fileURLToPath(dist);
const { startFixture } = await import('../apps/student-cabinet/tests/fixture-server.mjs');
const server = startFixture(process.argv.includes('--serve') ? 4195 : 0);
if (!server.listening) await new Promise((resolve) => server.once('listening', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
if (process.argv.includes('--serve')) {
  console.log(origin + '/student?ui.k8k=1');
  await new Promise(() => {});
}
const browser = await chromium.launch(),
  requests = [],
  blocked = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    serviceWorkers: 'block',
    reducedMotion: 'reduce',
  });
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === origin
      ? route.continue()
      : (blocked.push(new URL(route.request().url()).hostname), route.abort()),
  );
  await context.request.post(origin + '/__fixture/reset', {
    data: { subjectHub: true, displayName: 'Зоя Пример' },
  });
  const page = await context.newPage();
  page.on('request', (request) => {
    const u = new URL(request.url());
    if (u.origin === origin && /\.(js|css|woff2)$/.test(u.pathname)) requests.push(u.pathname);
  });
  await page.goto(origin + '/student?ui.k8k=1');
  await expect(page.locator('.k8k-lesson-hero')).toBeVisible();
  await page.evaluate(() => globalThis.document.fonts.ready);
  const ru = [...new Set(requests)];
  await page.locator('.account-menu > summary').click();
  await page.locator('.k8k-language select').selectOption('ro');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ro');
  await page.evaluate(() => globalThis.document.fonts.ready);
  const added = [...new Set(requests)].filter((file) => !ru.includes(file));
  const details = [];
  for (const file of added) {
    const bytes = await readFile(new URL(file.replace(/^\/student\//, ''), dist));
    details.push({ file, rawBytes: bytes.length });
  }
  assert.equal(added.filter((p) => /\.(js|css)$/.test(p)).length, 0);
  assert.deepEqual(blocked, []);
  await writeFile(
    new URL('locale-impact.json', out),
    JSON.stringify(
      {
        taskId: 'TASK-035',
        scope: 'same current source bundle, runtime RU→RO switch',
        ruAssets: ru,
        additionalRoAssets: details,
        additionalJavaScriptCss: 0,
        allRequiredFontsAlreadyIncludedInBudget: budget.rows[0].font.total,
        method:
          'runtime requests after document.fonts.ready; asset paths only, no API bodies/credentials',
      },
      null,
      2,
    ) + '\n',
  );
  console.log({ additionalRoAssets: details, additionalJavaScriptCss: 0 });
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

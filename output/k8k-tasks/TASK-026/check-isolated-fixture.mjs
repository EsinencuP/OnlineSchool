import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const require = createRequire(resolve('apps/student-cabinet/package.json'));
const { createServer } = await import(pathToFileURL(require.resolve('vite')));
const { default: react } = await import(pathToFileURL(require.resolve('@vitejs/plugin-react')));
const server = await createServer({
  root: resolve('apps/student-cabinet/tests/k8k-subscriptions'),
  configFile: false,
  envDir: false,
  publicDir: false,
  plugins: [react()],
  server: { host: '127.0.0.1', port: 55185, strictPort: true, fs: { allow: [resolve('.')] } },
});
await server.listen();
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
  await page.route('**/*', (route) => new URL(route.request().url()).origin === 'http://127.0.0.1:55185'
    ? route.continue() : route.abort());
  await page.goto('http://127.0.0.1:55185/?ui.k8k=1');
  const panel = page.locator('[data-module="DASH-STU-05"]');
  await panel.getByRole('heading', { name: 'Физика' }).waitFor();
  assert.equal(await panel.getByRole('link', { name: 'Условия абонемента' }).count(), 3);
  assert.equal(await page.evaluate(() => globalThis.document.documentElement.scrollWidth), 360);
  await page.evaluate(() => globalThis.document.fonts.ready);
  await page.screenshot({ path: 'output/k8k-tasks/TASK-026/states/isolated-fixture.png', fullPage: true });
  console.log('Isolated subscription fixture rendered three subject rows and financial links at 360 px.');
} finally {
  await browser?.close();
  await server.close();
}

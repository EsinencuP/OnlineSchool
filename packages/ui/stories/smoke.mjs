// Serves only static catalog files on loopback. No live credentials, SDK, API or database.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, expect } from '@playwright/test';

const build = new URL('../dist/storybook/', import.meta.url);
const evidence = new URL('../dist/storybook-evidence/', import.meta.url);
const { entries } = JSON.parse(await readFile(new URL('index.json', build), 'utf8'));
const files = new Set(
  (await readdir(build, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) =>
      pathToFileURL(join(entry.parentPath, entry.name)).href.slice(build.href.length),
    ),
);
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (request.method !== 'GET' || !files.has(file)) {
    response.writeHead(403).end();
    return;
  }
  response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' });
  response.end(await readFile(new URL(file, build)));
});

const widths = [360, 768, 1024, 1280];
const screenshots = new URL('screenshots/', evidence);
await mkdir(screenshots, { recursive: true });
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
const checks = [];
const blocked = [];
let browser;
try {
  browser = await chromium.launch();
  const context = await browser.newContext({ reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin && (url.pathname === '/' || files.has(url.pathname.slice(1)))) {
      return route.continue();
    }
    blocked.push(url.origin === origin ? url.pathname : url.origin + url.pathname);
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const root = page.locator('#storybook-root');
  const stateStories = {
    loading: 'loading',
    empty: 'empty',
    ready: 'ready',
    stale: 'stale',
    error: 'error',
    'unknown-result': 'pending',
    forbidden: 'forbidden',
    'subscription-limited': 'subscription-limited',
    'session-expired': 'session-expired',
  };
  async function open(id, locale, width) {
    assert(id in entries, `Story missing from index: ${id}`);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${origin}/iframe.html?id=${id}&viewMode=story&globals=locale:${locale}`);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(root).not.toBeEmpty();
    await expect(page.locator('body')).not.toHaveClass(/sb-show-errordisplay/u);
    assert.equal(
      await page.locator('html').evaluate((element) => element.scrollWidth),
      width,
      `Page overflow in ${id}`,
    );
  }

  for (const locale of ['ru', 'ro']) {
    for (const width of widths) {
      for (const [story, state] of Object.entries(stateStories)) {
        await open(`ui-vis-11--${story}`, locale, width);
        await expect(root.locator('[data-state]')).toHaveAttribute('data-state', state);
        if (['loading', 'empty', 'error', 'forbidden', 'session-expired'].includes(state)) {
          await expect(root.locator('[data-synthetic-content]')).toHaveCount(0);
        }
        if (state === 'subscription-limited')
          await expect(root.locator('[data-authorized]')).toBeVisible();
        if (state === 'pending') await expect(root.getByRole('button')).toHaveCount(0);
      }
      await open('ui-shell--student', locale, width);
      await expect(root.getByRole('heading', { level: 1 })).toHaveText(
        locale === 'ro' ? 'Exemplu local de cabinet' : 'Локальный пример кабинета',
      );
      await page.screenshot({
        path: fileURLToPath(new URL(`shell-${locale}-${width}.png`, screenshots)),
      });
      await open('ui-controlled-overlays--modal-dialog', locale, width);
      await page.keyboard.press('Tab');
      const trigger = root.locator('[data-trigger]');
      await expect(trigger).toBeFocused();
      assert(await trigger.evaluate((button) => button.matches(':focus-visible')));
      await page.keyboard.press('Enter');
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('textbox')).toBeFocused();
      await page.screenshot({
        path: fileURLToPath(new URL(`dialog-${locale}-${width}.png`, screenshots)),
      });
      await page.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toBeFocused();
      checks.push({
        locale,
        width,
        vis11: 9,
        shell: 'rendered',
        dialog: 'keyboard focus and return',
      });
    }
  }

  for (const id of Object.keys(entries)) {
    if (entries[id].type === 'story') await open(id, 'ro', 360);
  }

  await open('ui-native-controls--variants', 'ro', 360);
  const primary = root.locator('[data-variant="primary"]');
  const background = await primary.evaluate(
    (element) => globalThis.getComputedStyle(element).backgroundColor,
  );
  await primary.hover();
  await expect(primary).not.toHaveCSS('background-color', background);
  checks.push('Primary Button hover changes visual state');

  await open('ui-composite-controls--retained-form', 'ro', 360);
  const field = root.getByRole('textbox');
  await field.fill('Sintetic');
  await root.getByRole('tab', { name: 'Formular' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(root.getByRole('tab', { name: /Detalii/u })).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(field).toHaveValue('Sintetic');
  checks.push('Tabs keyboard navigation, disabled tab skipped and draft retained');

  await open('ui-lists-and-tables--ordered-pages', 'ro', 360);
  const sort = root.getByRole('button', { name: /Denumire/u });
  await sort.focus();
  await page.keyboard.press('Enter');
  await expect(root.getByRole('columnheader', { name: /Denumire/u })).toHaveAttribute(
    'aria-sort',
    'descending',
  );
  await expect(root.getByRole('row').nth(1)).toContainText(/denumire mai lungă D/u);
  await root.getByRole('checkbox', { name: 'Selectează D' }).focus();
  await page.keyboard.press('Space');
  await expect(root.getByRole('checkbox', { name: 'Selectează D' })).toBeChecked();
  await root.getByRole('button', { name: 'Pagina următoare' }).focus();
  await page.keyboard.press('Enter');
  await expect(root.getByRole('row').nth(1)).toContainText(/denumire mai lungă B/u);
  checks.push('DenseTable keyboard sort, selection and next page');

  await open('ui-calendar-and-dates--calendar-views', 'ro', 360);
  const date = root.getByLabel('Data locală');
  const next = root.getByRole('button', { name: 'Data următoare' });
  await next.focus();
  await page.keyboard.press('Enter');
  await expect(date).toHaveValue('2026-10-26');
  await root.getByRole('radio', { name: 'Zi' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(root.getByRole('radio', { name: 'Săptămână' })).toBeChecked();
  checks.push('DatePicker and Segmented keyboard navigation');

  await open('ui-vis-11--error', 'ro', 360);
  await root.getByRole('button', { name: 'Reîncearcă încărcarea' }).focus();
  await page.keyboard.press('Enter');
  await expect(root.locator('output')).toHaveText('Citiri locale: 1');
  checks.push('Error retry dispatches one synthetic read');

  assert.equal((await context.request.get(`${origin}/api/storybook-sentinel`)).status(), 403);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(`${origin}/?path=/story/ui-vis-11--ready`);
  const preview = page.frameLocator('#storybook-preview-iframe');
  await expect(preview.locator('[data-state="ready"]')).toBeVisible();
  await page.getByRole('button', { name: 'Русский' }).click();
  await page.getByText('Română', { exact: true }).click();
  await expect(preview.locator('html')).toHaveAttribute('lang', 'ro');
  await expect(preview.getByText('Date pentru exemplul local')).toBeVisible();
  for (const width of widths) {
    await page.getByRole('button', { name: 'Viewport size' }).click();
    await page.getByRole('option', { name: `${width} px` }).click();
    await expect
      .poll(async () => (await page.locator('#storybook-preview-iframe').boundingBox())?.width)
      .toBe(width);
  }
  checks.push('Manager locale toolbar and four viewport controls');

  await page.getByRole('tab', { name: 'Accessibility' }).click();
  await page.getByRole('button', { name: 'Rerun accessibility scan' }).click();
  await expect(page.getByText('No accessibility violations found.')).toBeVisible();
  checks.push('Accessibility addon axe scan, VIS-11 Ready, RO');

  const outbound = await page.evaluate(() =>
    Promise.all([
      fetch('https://example.invalid/storybook-sentinel').then(
        () => 'unexpected',
        () => 'blocked',
      ),
      fetch('/api/storybook-sentinel').then(
        () => 'unexpected',
        () => 'blocked',
      ),
    ]),
  );
  assert.deepEqual(outbound, ['blocked', 'blocked']);
  assert.deepEqual(blocked.filter((url) => url.includes('storybook-sentinel')).sort(), [
    '/api/storybook-sentinel',
    'https://example.invalid/storybook-sentinel',
  ]);
  assert.deepEqual(
    blocked.filter((url) => !url.includes('storybook-sentinel')),
    [],
  );
  assert.deepEqual(pageErrors, []);
  await writeFile(
    new URL('smoke.json', evidence),
    JSON.stringify({ checks, blocked, pageErrors, stories: Object.keys(entries).length }, null, 2) +
      '\n',
  );
  console.log(`Storybook smoke passed. ${Object.keys(entries).length} stories.`);
} catch (error) {
  console.error(error);
  throw error;
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}

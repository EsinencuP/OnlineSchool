// TASK-017. Static UI fixtures only, exact local file allowlist, no API or env.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { chromium, expect } from '@playwright/test';

const require = createRequire(new URL('../../../apps/manager-web/package.json', import.meta.url));
const { default: AxeBuilder } = await import(
  pathToFileURL(require.resolve('@axe-core/playwright'))
);
const build = new URL('../dist/storybook/', import.meta.url);
const evidence = new URL('../dist/foundation-evidence/', import.meta.url);
const screenshots = new URL('screenshots/', evidence);
await mkdir(screenshots, { recursive: true });
const { entries } = JSON.parse(await readFile(new URL('index.json', build), 'utf8'));
const stories = Object.values(entries).filter((entry) => entry.type === 'story');
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
};
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (request.method !== 'GET' || !files.has(file)) return response.writeHead(403).end();
  response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' });
  response.end(await readFile(new URL(file, build)));
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const origin = `http://127.0.0.1:${server.address().port}`;
const result = {
  scope: 'component fixtures; no role/production/AT gate',
  renders: [],
  axe: [],
  keyboard: [],
  zoom: [],
  motion: [],
  blocked: [],
  pageErrors: [],
  failures: [],
};
const selected = new Set([
  'ui-shell--student',
  'ui-native-controls--field-and-select',
  'ui-lists-and-tables--queue-columns',
  'ui-vis-11--stages',
  'ui-calendar-and-dates--calendar-views',
  'ui-calendar-and-dates--month-range',
]);
let browser;
try {
  browser = await chromium.launch();
  const context = await browser.newContext({ reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin && files.has(url.pathname.slice(1))) return route.continue();
    result.blocked.push(url.origin + url.pathname);
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  page.on('pageerror', (error) => result.pageErrors.push(error.message));
  const root = page.locator('#storybook-root');
  async function open(id, locale, width) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${origin}/iframe.html?id=${id}&viewMode=story&globals=locale:${locale}`);
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(root).not.toBeEmpty();
    await expect(page.locator('body')).not.toHaveClass(/sb-show-errordisplay/u);
    await page.evaluate(() => globalThis.document.fonts.ready);
  }
  async function scan(id, locale, mode) {
    const analysis = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const violations = analysis.violations.map(({ id, impact, nodes }) => ({
      id,
      impact,
      nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
    }));
    result.axe.push({
      id,
      locale,
      mode,
      violations,
      incomplete: analysis.incomplete.map(({ id, nodes }) => ({
        id,
        targets: nodes.map((n) => n.target),
      })),
    });
    if (violations.length) result.failures.push({ id, locale, mode, violations });
  }
  for (const locale of ['ru', 'ro']) {
    for (const width of [360, 768, 1024, 1280]) {
      for (const story of stories) {
        await open(story.id, locale, width);
        const scrollWidth = await page.locator('html').evaluate((el) => el.scrollWidth);
        result.renders.push({ id: story.id, locale, width, scrollWidth });
        if (scrollWidth > width) result.failures.push({ id: story.id, locale, width, scrollWidth });
        if (width === 360) await scan(story.id, locale, 'initial');
        if (story.id === 'ui-calendar-and-dates--month-range') {
          await expect(root.locator('[data-date]')).toHaveCount(31);
          await expect(root.locator('[data-event-id]')).toHaveCount(5);
          if (width === 1280) {
            assert.equal(
              await root
                .locator('[data-date="2026-10-01"]')
                .evaluate((el) => globalThis.getComputedStyle(el).gridColumnStart),
              '4',
            );
            assert.equal(
              await root
                .locator('.k8k-calendar-days')
                .evaluate(
                  (el) => globalThis.getComputedStyle(el).gridTemplateColumns.split(' ').length,
                ),
              7,
            );
          }
        }
        if (selected.has(story.id))
          await page.screenshot({
            path: fileURLToPath(new URL(`${story.id}-${locale}-${width}.png`, screenshots)),
            fullPage: true,
          });
      }
      console.log(`Rendered ${stories.length} stories: ${locale} ${width}`);
    }
    for (const kind of [
      'modal-dialog',
      'side-drawer',
      'confirmation',
      'inline-popover',
      'action-menu',
    ]) {
      const id = `ui-controlled-overlays--${kind}`;
      await open(id, locale, 360);
      const trigger = root.locator('[data-trigger]');
      await trigger.focus();
      await page.keyboard.press('Enter');
      const overlay = page.locator('[role="dialog"], [role="alertdialog"], [role="menu"]').last();
      await expect(overlay).toBeVisible();
      await scan(id, locale, 'open');
      if (kind === 'modal-dialog' || kind === 'side-drawer' || kind === 'confirmation') {
        for (let step = 0; step < 10; step++) {
          await page.keyboard.press('Tab');
          assert(
            await overlay.evaluate((el) => el.contains(globalThis.document.activeElement)),
            `${kind}: focus escaped`,
          );
        }
      }
      await page.screenshot({
        path: fileURLToPath(new URL(`${id}-${locale}-open.png`, screenshots)),
        fullPage: true,
      });
      await page.keyboard.press('Escape');
      await expect(overlay).toHaveCount(0);
      await expect(trigger).toBeFocused();
      result.keyboard.push({ id, locale, escape: 'closed', returnFocus: true });
    }
    // Browser zoom equivalent: 1280/200%=640 and 1280/400%=320 CSS px.
    // Full-page screenshots show reflow, not deviceScaleFactor (which is only pixel density).
    for (const width of [640, 320]) {
      for (const id of selected) {
        await open(id, locale, width);
        const scrollWidth = await page.locator('html').evaluate((el) => el.scrollWidth);
        result.zoom.push({
          id,
          locale,
          originalWidth: 1280,
          zoomPercent: 128000 / width,
          width,
          scrollWidth,
        });
        if (scrollWidth > width)
          result.failures.push({ id, locale, width, scrollWidth, mode: 'zoom reflow' });
        if (width === 320)
          await page.screenshot({
            path: fileURLToPath(new URL(`${id}-${locale}-reflow400.png`, screenshots)),
            fullPage: true,
          });
      }
    }
    await open('ui-controlled-overlays--modal-dialog', locale, 360);
    await root.locator('[data-trigger]').click();
    const motion = await page.evaluate(() => ({
      reduced: globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches,
      activeAnimations: globalThis.document
        .getAnimations()
        .filter((animation) => animation.playState === 'running').length,
    }));
    assert(motion.reduced && motion.activeAnimations === 0);
    result.motion.push({ locale, ...motion });
  }
  assert.deepEqual(result.blocked, []);
  assert.deepEqual(result.pageErrors, []);
  assert.deepEqual(result.failures, [], 'See foundation.json for criterion-level failures');
} finally {
  await writeFile(new URL('foundation.json', evidence), JSON.stringify(result, null, 2) + '\n');
  await browser?.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}

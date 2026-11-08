// Real shared components, isolated bundle and intercepted loopback HTTP; no environment or DB.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, expect } from '@playwright/test';

const root = new URL('../../../../', import.meta.url);
const output = new URL('output/ui-motion-2026-11-08/', root);
await mkdir(output, { recursive: true });
const require = createRequire(new URL('apps/manager-web/package.json', root));
const { build } = await import(pathToFileURL(require.resolve('vite')));
const { default: react } = await import(pathToFileURL(require.resolve('@vitejs/plugin-react')));
const alias = [
  ['@online-school/ui/style.css', 'packages/ui/src/style.css'],
  ['@online-school/account-ui/style.css', 'packages/account-ui/src/style.css'],
  ['@online-school/ui', 'packages/ui/src/index.ts'],
  ['@online-school/account-ui', 'packages/account-ui/src/index.tsx'],
].map(([find, path]) => ({ find, replacement: fileURLToPath(new URL(path, root)) }));
const built = await build({
  root: fileURLToPath(new URL('apps/student-cabinet/', root)),
  configFile: false,
  envDir: false,
  publicDir: false,
  plugins: [react()],
  resolve: { alias },
  logLevel: 'error',
  build: {
    write: false,
    rollupOptions: {
      input: fileURLToPath(new URL('apps/student-cabinet/tests/ui-motion/index.html', root)),
    },
  },
});
const assets = new Map(
  built.output.map((item) => [
    item.fileName,
    Buffer.from(item.type === 'chunk' ? item.code : item.source),
  ]),
);
if (process.argv.includes('--serve')) {
  createServer((request, response) => {
    const path = new URL(request.url, 'http://127.0.0.1:4199').pathname;
    if (path === '/api/v1/platform/accounts') {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ enabled: false, currentKey: null, items: [] }));
      return;
    }
    const key = path === '/' ? 'tests/ui-motion/index.html' : path.slice(1),
      asset = assets.get(key);
    if (!asset) {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, {
      'Content-Type': key.endsWith('.js')
        ? 'text/javascript'
        : key.endsWith('.css')
          ? 'text/css'
          : key.endsWith('.woff2')
            ? 'font/woff2'
            : 'text/html',
    });
    response.end(asset);
  }).listen(4199, '127.0.0.1', () => console.log('Motion fixture: http://127.0.0.1:4199'));
  await new Promise(() => {});
}
const origin = 'http://127.0.0.1:4199',
  errors = [],
  checks = [];
const browser = await chromium.launch();
async function record(name, run) {
  await run();
  checks.push(name);
  console.log(name);
}
async function settle(page) {
  await page.evaluate(async () => {
    globalThis.document.getAnimations().forEach((animation) => animation.finish());
    await new Promise(globalThis.requestAnimationFrame);
    await new Promise(globalThis.requestAnimationFrame);
  });
}
async function animation(locator, name) {
  return locator.evaluate((element, wanted) => {
    const animation = element.getAnimations().find((item) => item.animationName === wanted);
    if (!animation) return null;
    animation.pause();
    animation.currentTime = 50;
    return {
      duration: animation.effect.getTiming().duration,
      easing: animation.effect.getTiming().easing,
      frames: animation.effect.getKeyframes(),
      origin: globalThis.getComputedStyle(element).transformOrigin,
    };
  }, name);
}
try {
  for (const reduced of [false, true]) {
    const context = await browser.newContext({
      viewport: { width: 1000, height: 900 },
      reducedMotion: reduced ? 'reduce' : 'no-preference',
      serviceWorkers: 'block',
    });
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) {
        errors.push(url.origin);
        return route.abort();
      }
      if (url.pathname === '/api/v1/platform/accounts')
        return route.fulfill({ json: { enabled: false, currentKey: null, items: [] } });
      const key = url.pathname === '/' ? 'tests/ui-motion/index.html' : url.pathname.slice(1);
      const asset = assets.get(key);
      if (asset)
        return route.fulfill({
          body: asset,
          contentType: key.endsWith('.js')
            ? 'text/javascript'
            : key.endsWith('.css')
              ? 'text/css'
              : key.endsWith('.woff2')
                ? 'font/woff2'
                : 'text/html',
        });
      if (url.pathname === '/favicon.ico') return route.fulfill({ status: 204 });
      errors.push(url.pathname);
      return route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(origin);
    await expect(page.getByRole('heading', { name: 'Проверка движений' })).toBeVisible();
    await record(`rows: ${reduced ? 'reduced' : '30ms stagger'}`, async () => {
      const rows = await page.locator('[data-motion-list] > li').evaluateAll((items) =>
        items.map((el) => ({
          delay: globalThis.getComputedStyle(el).animationDelay,
          animation: globalThis.getComputedStyle(el).animationName,
        })),
      );
      assert.deepEqual(
        rows.map((row) => row.delay),
        reduced ? ['0s', '0s', '0s', '0s'] : ['0s', '0.03s', '0.06s', '0.09s'],
      );
      if (reduced) assert(rows.every((row) => row.animation === 'none'));
    });
    await record(`press: ${reduced ? 'reduced' : '0.97'}`, async () => {
      const button = page.locator('#press');
      await button.hover();
      await page.mouse.down();
      await expect
        .poll(() => button.evaluate((el) => globalThis.getComputedStyle(el).scale))
        .toBe(reduced ? 'none' : '0.97');
      await page.mouse.up();
      assert.equal(
        await page.locator('#disabled').evaluate((el) => globalThis.getComputedStyle(el).scale),
        'none',
      );
    });
    await page.locator('#popover-trigger').click();
    const popover = page.locator('.k8k-popover');
    await record(`popover origin and entrance: ${reduced}`, async () => {
      const motion = await animation(popover, 'k8k-surface-in');
      if (reduced) assert.equal(motion, null);
      else {
        assert.equal(motion.duration, 200);
        assert.equal(motion.frames[0].scale, '0.95');
        assert.notEqual(motion.origin, '50% 50%');
      }
    });
    await page.screenshot({
      path: fileURLToPath(new URL(`popover-${reduced ? 'reduced' : 'in-50ms'}.png`, output)),
    });
    await settle(page);
    await page.keyboard.press('Escape');
    await record(`popover exit and focus: ${reduced}`, async () => {
      if (!reduced) {
        const exit = await animation(popover, 'k8k-surface-out');
        assert.equal(exit.duration, 160);
        await settle(page);
      }
      await expect(popover).toHaveCount(0);
      await expect(page.locator('#popover-trigger')).toBeFocused();
    });
    await record(`dialog origin / Escape: ${reduced}`, async () => {
      await page.locator('#dialog-trigger').click();
      const dialog = page.locator('.k8k-dialog');
      const originValue = await dialog.evaluate((el) => el.style.transformOrigin);
      assert.match(originValue, /px/);
      await settle(page);
      await page.keyboard.press('Escape');
      await settle(page);
      await expect(dialog).toHaveCount(0);
      await expect(page.locator('#dialog-trigger')).toBeFocused();
    });
    await record(`drawer and rapid reopen: ${reduced}`, async () => {
      await page.locator('#drawer-trigger').click();
      await settle(page);
      await page.keyboard.press('Escape');
      await settle(page);
      await expect(page.locator('.k8k-drawer')).toHaveCount(0);
      await page.locator('#drawer-trigger').click();
      await settle(page);
      await page.keyboard.press('Escape');
      await settle(page);
      await expect(page.locator('.k8k-drawer')).toHaveCount(0);
    });
    await record(`dropdown 200/160 / keyboard: ${reduced}`, async () => {
      await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
      if (!reduced)
        assert.equal((await animation(page.locator('.k8k-menu'), 'k8k-surface-in')).duration, 200);
      await settle(page);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Escape');
      if (!reduced)
        assert.equal((await animation(page.locator('.k8k-menu'), 'k8k-surface-out')).duration, 160);
      await settle(page);
      await expect(page.getByRole('button', { name: 'Открыть меню', exact: true })).toBeFocused();
    });
    await record(`native account disclosure: ${reduced}`, async () => {
      const summary = page.locator('.account-menu > summary');
      await summary.click();
      await expect(page.locator('.account-menu')).toHaveAttribute('open', '');
      await expect(page.locator('.account-popover')).toBeVisible();
      await settle(page);
      await page.keyboard.press('Escape');
      await settle(page);
      await expect(page.locator('.account-menu')).not.toHaveAttribute('open', '');
      assert(await page.locator('.account-popover').evaluate((el) => el.inert));
      await expect(summary).toBeFocused();
    });
    await record(`overlapping tabs, inert outgoing, draft retention: ${reduced}`, async () => {
      await page.locator('#draft').fill('Черновик не теряется');
      await page.getByRole('tab', { name: 'Вторая', exact: true }).click();
      const outgoing = page.locator('.k8k-tab-panel[data-motion-exiting=true]');
      if (!reduced) {
        await expect(outgoing).toHaveAttribute('aria-hidden', 'true');
        assert(await outgoing.evaluate((el) => el.inert));
        await expect(page.getByRole('tabpanel')).toHaveCount(1);
      }
      await settle(page);
      await expect(outgoing).toHaveCount(0);
      await page.getByRole('tab', { name: 'Первая', exact: true }).click();
      await settle(page);
      await expect(page.locator('#draft')).toHaveValue('Черновик не теряется');
    });
    await record(`confirmed-only success pulse: ${reduced}`, async () => {
      await page.getByRole('button', { name: 'Подтвердить успех', exact: true }).click();
      const success = await animation(
        page.locator('[data-toast-id=confirmed] > svg'),
        'k8k-success-pulse',
      );
      assert.equal(!!success, !reduced);
      assert.equal(
        await animation(page.locator('[data-toast-id=unknown] > svg'), 'k8k-success-pulse'),
        null,
      );
      await settle(page);
    });
    await record(`icon crossfade: ${reduced}`, async () => {
      await page.locator('#swap').click();
      if (!reduced) {
        assert(await animation(page.locator('#swap .k8k-icon-current'), 'k8k-icon-in'));
        assert(await animation(page.locator('#swap .k8k-icon-previous'), 'k8k-icon-out'));
      }
      await settle(page);
      if (!reduced) await expect(page.locator('#swap .k8k-icon-previous')).toHaveCount(0);
      else await expect(page.locator('#swap .k8k-icon-previous')).not.toBeVisible();
    });
    await page.setViewportSize({ width: 360, height: 900 });
    assert(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
      ),
    );
    await page.screenshot({
      path: fileURLToPath(new URL(`fixture-${reduced ? 'reduced' : 'motion'}-360.png`, output)),
    });
    await context.close();
  }
} finally {
  await browser.close();
}
await writeFile(
  new URL('browser-results.json', output),
  JSON.stringify({ checks, errors }, null, 2) + '\n',
);
assert.deepEqual(errors, []);
console.log({ checks: checks.length, errors: errors.length });

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, expect } from '@playwright/test';

const root = new URL('../', import.meta.url);
const out = new URL('output/k8k-tasks/TASK-022/browser/', root);
await mkdir(out, { recursive: true });
const require = createRequire(new URL('apps/manager-web/package.json', root));
const { build } = await import(pathToFileURL(require.resolve('vite')));
const { default: react } = await import(pathToFileURL(require.resolve('@vitejs/plugin-react')));
const alias = [
  ['@online-school/ui/style.css', 'packages/ui/src/style.css'],
  ['@online-school/account-ui/style.css', 'packages/account-ui/src/style.css'],
  ['@online-school/ui', 'packages/ui/src/index.ts'],
  ['@online-school/account-ui', 'packages/account-ui/src/index.tsx'],
  ['@online-school/api-contracts', 'packages/api-contracts/src/index.ts'],
  ['@online-school/shared', 'packages/shared/src/index.ts'],
].map(([find, path]) => ({ find, replacement: fileURLToPath(new URL(path, root)) }));
const built = await build({
  root: fileURLToPath(new URL('apps/manager-web/', root)),
  base: '/manager/',
  configFile: false,
  envDir: false,
  publicDir: false,
  plugins: [react()],
  resolve: { alias, dedupe: ['react', 'react-dom'] },
  build: { write: false },
  logLevel: 'error',
});
assert(!Array.isArray(built) && 'output' in built);
const assets = new Map(
  built.output.map((asset) => [
    asset.fileName,
    Buffer.from(asset.type === 'chunk' ? asset.code : asset.source),
  ]),
);
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
};
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  const key = path.startsWith('/manager/assets/') ? path.slice('/manager/'.length) : 'index.html';
  const bytes = assets.get(key);
  if (!bytes) return res.writeHead(404).end();
  res.setHeader('Content-Type', types[extname(key)] ?? 'application/octet-stream');
  res.end(bytes);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const unexpected = [],
  checks = [],
  screenshots = [],
  requests = [];
const sourceAsOf = '2026-11-07T08:10:00.000Z';
const taskId = (n) => `50000000-0000-4000-8000-00000000000${n}`;
const task = {
  taskId: taskId(2),
  type: 'GENERAL',
  status: 'OPEN',
  version: 1,
  leadId: null,
  studentId: taskId(8),
  studentName: 'Synthetic student',
  createdAt: sourceAsOf,
  dueAt: sourceAsOf,
  isOverdue: true,
  escalatedAt: null,
  approvalStatus: 'NONE',
  payload: { kind: 'GENERAL' },
  ledgerPublicationId: null,
  resolution: null,
};
const overview = {
  generatedAt: '2026-11-07T08:10:20.000Z',
  leads: {
    countsByStage: { NEW: 0, IN_PROGRESS: 0, TRIAL: 0, AWAITING_PAYMENT: 0 },
    createdToday: 0,
    trialsToday: 0,
    overdueFollowups: 0,
    conversion30dBp: 0,
  },
  students: { active: 0, frozen: 0, leads: 0 },
  upcomingLessons: [],
  expiringSubscriptions: [],
  pendingPayments: { count: 0, totalsByCurrency: [] },
  overdueTasks: { count: 1, top: [task] },
};
const first = {
  primary: { taskId: taskId(1), title: `Synthetic ${'LongTitle'.repeat(18)}` },
  criticalCount: 5,
  queueAction: 'TASK_QUEUE',
  sourceAsOf,
};
const second = { ...first, primary: { taskId: taskId(2), title: 'Synthetic replacement event' } };
const verifiedEmpty = { ...first, primary: null, criticalCount: 0 };
const attention = { ru: 'События, требующие внимания', ro: 'Evenimente care necesită atenție' };

async function capture(page, locale, width, name) {
  const file = `${locale}-${width}-${name}.png`;
  await page.evaluate(() => globalThis.document.fonts.ready);
  assert.ok(
    await page.evaluate(
      () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
    ),
  );
  const bytes = await page.screenshot({
    path: fileURLToPath(new URL(file, out)),
    animations: 'disabled',
  });
  screenshots.push({
    file,
    locale,
    width,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}
const focusRead = async (page) => {
  await page.clock.runFor(1100);
  await page.evaluate(() => globalThis.dispatchEvent(new Event('focus')));
};

try {
  for (const locale of ['ru', 'ro'])
    for (const width of [360, 768, 1024, 1280]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        locale: `${locale}-MD`,
        reducedMotion: 'reduce',
        serviceWorkers: 'block',
      });
      await context.addInitScript(
        (lang) => globalThis.localStorage.setItem('k8k.locale', lang),
        locale,
      );
      let priority;
      let status = 200;
      await context.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        const method = route.request().method();
        if (url.origin !== origin || method !== 'GET') {
          unexpected.push(`${method} ${url.origin}${url.pathname}`);
          return route.abort();
        }
        if (!url.pathname.startsWith('/api/')) return route.continue();
        requests.push({ locale, width, method, path: url.pathname });
        const send = (json, status = 200) =>
          route.fulfill({ json, status, headers: { 'Cache-Control': 'private, no-store' } });
        switch (url.pathname) {
          case '/api/v1/manager/me':
            return send({
              managerId: taskId(9),
              displayName: 'Synthetic Manager',
              role: 'MANAGER',
              portfolioSize: 1,
              timezone: 'Europe/Chisinau',
              capabilities: ['TASKS_PROCESS'],
            });
          case '/api/v1/platform/accounts':
            return send({ enabled: false, currentKey: null, items: [] });
          case '/api/v1/manager/options':
            return send({
              teachers: [],
              students: [],
              subjects: [],
              plans: [],
              enrollments: [],
              financialSubscriptions: [],
            });
          case '/api/v1/manager/dashboard':
            if (status === 503) return send({ code: 'DASHBOARD_UNAVAILABLE' }, status);
            if (status === 403) return send({ code: 'FORBIDDEN_ROLE' }, status);
            return send({ ...overview, ...(priority !== undefined ? { priority } : {}) });
          case '/api/v1/manager/tasks':
            return send({ items: [task], nextCursor: null, asOf: sourceAsOf });
          case `/api/v1/manager/tasks/${task.taskId}`:
            return send(task);
          default:
            unexpected.push(url.pathname);
            return send({ code: 'UNEXPECTED_FIXTURE_READ' }, 501);
        }
      });
      const page = await context.newPage();
      page.on('pageerror', (error) => unexpected.push(error.message));
      const slot = page.locator('.k8k-priority-slot');
      const scope = page.getByRole('region', { name: attention[locale] });
      const primary = slot.locator('[data-slot="critical"]');
      const count = slot.locator('[data-slot="queue"] strong');
      try {
        await page.clock.install({ time: new Date('2026-11-07T08:11:00Z') });
        await page.goto(`${origin}/manager?ui.k8k=1`);
        await expect(page.locator('.dashboard-metrics')).toBeVisible();
        await expect(scope).toHaveCount(0);
        checks.push({ locale, width, scenario: 'old payload and overdue task keep slot hidden' });

        priority = first;
        await focusRead(page);
        await expect(primary.getByRole('heading')).toHaveText(first.primary.title);
        await expect(count).toHaveText('5');
        await expect(
          page.locator(`time[data-time-source="server"][datetime="${sourceAsOf}"]`),
        ).toHaveCount(1);
        const menu = page.locator('nav a[href]');
        const links = await menu.evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute('href')),
        );
        const menuNode = await menu.first().elementHandle();
        const primaryLink = primary.getByRole('link');
        await primaryLink.focus();
        await page.keyboard.press('Tab');
        await expect(slot.locator('[data-slot="queue"]').getByRole('link')).toBeFocused();
        await capture(page, locale, width, 'ready-five');

        priority = second;
        await primaryLink.focus();
        await focusRead(page);
        await expect(primary.getByRole('heading')).toHaveText(second.primary.title);
        await expect(primaryLink).toBeFocused();
        assert.ok(await menuNode.evaluate((node) => node.isConnected));
        assert.deepEqual(
          await menu.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href'))),
          links,
        );
        checks.push({
          locale,
          width,
          scenario: 'single primary, full server count, two times, tab and stable menu/focus',
        });

        priority = null;
        await focusRead(page);
        await expect(scope.getByRole('button')).toBeVisible();
        await expect(count).toHaveCount(0);
        await capture(page, locale, width, 'unavailable');
        priority = verifiedEmpty;
        await scope.getByRole('button').click();
        await expect(count).toHaveText('0');
        await expect(primary.getByRole('heading')).toHaveCount(0);
        checks.push({
          locale,
          width,
          scenario: 'explicit outage shows no count; GET retry restores verified empty',
        });

        status = 503;
        await focusRead(page);
        await expect(page.locator('[data-state="stale"]')).toBeVisible();
        await expect(count).toHaveCount(0);
        checks.push({ locale, width, scenario: 'dashboard failure hides cached zero' });

        if (width === 360) {
          status = 200;
          priority = second;
          await focusRead(page);
          await expect(count).toHaveText('5');
          await expect(slot.locator('[data-slot="queue"]').getByRole('link')).toHaveAttribute(
            'href',
            '/manager/tasks',
          );
          await primaryLink.press('Enter');
          await expect(page).toHaveURL(new RegExp(`/manager/tasks/${task.taskId}$`));
          await expect(page.locator('.back-link')).toBeVisible();
          await expect(page.getByText(task.studentName)).toBeVisible();
          assert.ok(
            requests.some((request) => request.path === `/api/v1/manager/tasks/${task.taskId}`),
          );
          await page.goBack();
          await expect(count).toHaveText('5');
          await slot.locator('[data-slot="queue"]').getByRole('link').click();
          await expect(page).toHaveURL(/\/manager\/tasks$/);
          await expect(page.locator('[name="taskStatus"]')).toBeVisible();
          await expect(page.getByText(task.studentName)).toBeVisible();
          checks.push({
            locale,
            width,
            scenario: 'links open existing task and queue with GET only',
          });
        }
        if (width === 1280) {
          status = 403;
          await focusRead(page);
          await expect(page.locator('[data-state="forbidden"]')).toBeVisible();
          await expect(scope).toHaveCount(0);
          checks.push({ locale, width, scenario: 'authorization denial clears cached priority' });
        }
      } finally {
        await context.close();
      }
    }
  assert.deepEqual(unexpected, []);
  await writeFile(
    new URL('browser.json', out),
    JSON.stringify(
      { browser: browser.version(), checks, screenshots, requests, unexpected },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `${checks.length} checks, ${screenshots.length} screenshots, ${requests.length} GET requests.`,
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

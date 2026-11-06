// TASK-018: real App, in-memory build and fully intercepted API. No env or live target.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { build } from 'vite';
import { evaluateRoute } from '../../../../scripts/k8k-route-budget-core.mjs';
const out = new URL('../../dist/staff-context-evidence/', import.meta.url);
await mkdir(new URL('screenshots/', out), { recursive: true });
const built = await build({
  root: fileURLToPath(new URL('../../', import.meta.url)),
  envDir: false,
  logLevel: 'error',
  build: { write: false, manifest: true },
});
assert(!Array.isArray(built) && 'output' in built);
const assets = new Map(
  built.output.map((file) => [
    file.fileName,
    Buffer.from(file.type === 'chunk' ? file.code : file.source),
  ]),
);
const budget = evaluateRoute({
  manifest: JSON.parse(assets.get('.vite/manifest.json').toString()),
  seeds: ['index.html'],
  assets,
  requiredFonts: ['cyrillic', 'latin', 'romanian'],
});
assert(budget.pass);
const origin = 'http://127.0.0.1:4198';
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
};
const checks = [],
  unexpected = [],
  errors = [];
const browser = await chromium.launch();
try {
  for (const role of ['TEACHER', 'DIRECTOR'])
    for (const locale of ['ru', 'ro']) {
      const context = await browser.newContext({
        reducedMotion: 'reduce',
        serviceWorkers: 'block',
      });
      await context.addInitScript(
        ({ locale }) => {
          globalThis.localStorage.setItem('k8k.locale', locale);
          // A deliberately wrong client clock must not determine the server sample count.
          Date.now = () => Date.UTC(2027, 0, 1);
        },
        { locale },
      );
      const name = `Synthetic ${role}`;
      const coverage = (returned, limit, hasMore = false) => ({
        scope: role === 'TEACHER' ? 'OWN_TEACHER' : 'SCHOOL',
        windowFrom: null,
        windowTo: null,
        sourceUpdatedAt: null,
        pageInfo: { returned, limit, hasMore, total: null },
      });
      const workspace = {
        name,
        role,
        actorContext: {
          accountId: '10000000-0000-4000-8000-000000000001',
          role,
          staffProfileId: role === 'DIRECTOR' ? '20000000-0000-4000-8000-000000000001' : null,
          teacherProfileId: role === 'TEACHER' ? '30000000-0000-4000-8000-000000000001' : null,
          displayName: name,
          timezone: 'Asia/Tokyo',
          timezoneSource: 'SCHOOL_CONFIGURATION',
          asOf: '2026-11-04T12:00:00Z',
          accountUpdatedAt: null,
          profileUpdatedAt: null,
        },
        lessons: Array.from({ length: 100 }, (_, i) => ({
          id: `synthetic-${i}`,
          startsAt: '2026-11-04T12:30:00Z',
          endsAt: '2026-11-04T13:30:00Z',
          status: 'SCHEDULED',
          subject: 'Synthetic subject',
          student: 'Ștefan Sintetic',
          teacher: 'Synthetic teacher',
          meetUrl: null,
        })),
        students: [
          { id: 'synthetic-student', name: 'Ștefan Sintetic', subject: 'Synthetic subject' },
        ],
        homework: [],
        tasks: [],
        coverage: {
          lessons: coverage(100, 100, true),
          students: coverage(1, 100),
          homework: coverage(0, 50),
          tasks: coverage(0, 50),
        },
      };
      let phase = 'loading',
        release;
      await context.route('**/*', async (route) => {
        const request = route.request(),
          url = new URL(request.url());
        if (url.origin === origin && request.method() === 'GET') {
          if (url.pathname === '/api/v1/auth/session')
            return route.fulfill({
              json: {
                account: {
                  id: workspace.actorContext.accountId,
                  kind: role === 'TEACHER' ? 'TEACHER' : 'STAFF',
                  roles: [role],
                },
                mfa_completed: true,
                recovery_only: false,
                expires_at: '2027-01-02T12:00:00Z',
              },
            });
          if (url.pathname === '/api/v1/platform/accounts')
            return route.fulfill({ json: { enabled: false, currentKey: null, items: [] } });
          if (url.pathname === '/api/v1/platform/workspace') {
            if (phase === 'loading')
              await new Promise((resolve) => {
                release = resolve;
              });
            return phase === 'forbidden'
              ? route.fulfill({ status: 403, json: { code: 'FORBIDDEN' } })
              : route.fulfill({ json: workspace });
          }
          if (url.pathname === '/favicon.ico') return route.fulfill({ status: 204 });
          const key = ['/', '/teacher', '/director'].includes(url.pathname)
            ? 'index.html'
            : url.pathname.slice(1);
          if (assets.has(key))
            return route.fulfill({
              body: assets.get(key),
              contentType: mime[extname(key)] ?? 'application/octet-stream',
            });
        }
        unexpected.push(`${request.method()} ${url.origin}${url.pathname}`);
        return route.abort('blockedbyclient');
      });
      const page = await context.newPage();
      page.setDefaultTimeout(6000);
      page.on('pageerror', (error) => errors.push(error.message));
      const path = `${origin}/${role.toLowerCase()}?ui.k8k=1`;
      await page.goto(path);
      await expect(page.locator('[data-state="loading"]')).toBeVisible();
      await expect(page.locator('.stats')).toHaveCount(0);
      phase = 'ready';
      release();
      for (const width of [360, 768, 1024, 1280]) {
        await page.setViewportSize({ width, height: 1000 });
        await expect(page.locator('.stats > section').first().locator('strong')).toHaveText('100');
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        await expect(page.locator('#staff-summary-coverage [data-truncated]')).toContainText(
          locale === 'ro' ? 'doar o parte' : 'только часть',
        );
        await expect(page.locator('.lesson').first()).toContainText('21:30');
        await expect(page.locator('.section-heading').first()).toContainText('Asia/Tokyo');
        const totalCopy =
          locale === 'ro' ? 'Numărul total nu este cunoscut' : 'Общее число неизвестно';
        await expect(page.locator('#staff-summary-coverage [data-staff-coverage]')).toContainText(
          totalCopy,
        );
        assert(
          await page
            .locator('#staff-summary-coverage [data-staff-coverage]')
            .evaluate((el) => Number.parseFloat(globalThis.getComputedStyle(el).fontSize) >= 14),
        );
        assert.equal(await page.locator('html').evaluate((el) => el.scrollWidth), width);
        await page.locator('.refresh').focus();
        assert(await page.locator('.refresh').evaluate((el) => el.matches(':focus-visible')));
        await page.screenshot({
          path: fileURLToPath(
            new URL(`screenshots/${role.toLowerCase()}-${locale}-${width}.png`, out),
          ),
          fullPage: true,
        });
        checks.push({
          role,
          locale,
          width,
          serverCount: 100,
          clientClock: '2027-01-01',
          timezone: 'Asia/Tokyo',
          total: null,
        });
      }
      phase = 'forbidden';
      await page.locator('.refresh').click();
      await expect(page.locator('[data-state="forbidden"]')).toBeVisible();
      await expect(page.getByText('Synthetic subject', { exact: true })).toHaveCount(0);
      checks.push({ role, locale, cached403: 'private rows and sample counts hidden' });
      await context.close();
    }
  assert.deepEqual(unexpected, []);
  assert.deepEqual(errors, []);
  await writeFile(
    new URL('browser.json', out),
    JSON.stringify({ checks, unexpected, errors, budget }, null, 2) + '\n',
  );
  console.log(
    `Staff context browser passed ${checks.length} cases; platform ${budget.total} bytes.`,
  );
} finally {
  await browser.close();
}

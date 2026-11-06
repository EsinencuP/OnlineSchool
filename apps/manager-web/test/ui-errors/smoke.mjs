// Safe local browser specimen. All API calls are intercepted; no env, provider or DB target.
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname } from 'node:path';
import { chromium, expect } from '@playwright/test';
import react from '@vitejs/plugin-react';
import { build } from 'vite';
import { evaluateRoute } from '../../../../scripts/k8k-route-budget-core.mjs';

const out = new URL('../../dist/error-evidence/', import.meta.url);
await mkdir(out, { recursive: true });
const fixture = await build({
  root: fileURLToPath(new URL('./', import.meta.url)),
  configFile: false,
  envDir: false,
  plugins: [react()],
  logLevel: 'error',
  build: { write: false },
});
assert(!Array.isArray(fixture) && 'output' in fixture);
const files = new Map(
  fixture.output.map((file) => [
    `/${file.fileName}`,
    file.type === 'chunk' ? file.code : Buffer.from(file.source),
  ]),
);
const actual = await build({
  root: fileURLToPath(new URL('../../', import.meta.url)),
  envDir: false,
  logLevel: 'error',
  build: { write: false, manifest: true },
});
assert(!Array.isArray(actual) && 'output' in actual);
const actualAssets = new Map(
  actual.output.map((file) => [
    file.fileName,
    Buffer.from(file.type === 'chunk' ? file.code : file.source),
  ]),
);
const manifest = JSON.parse(actualAssets.get('.vite/manifest.json').toString());
const previous = JSON.parse(
  await readFile(
    new URL(
      '../../../../output/k8k-tasks/TASK-012/runs/2026-11-04T05-14-33.552Z/bundle.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const selected = previous.rows
  .filter((row) => row.app === 'manager-web')
  .sort((a, b) => b.total - a.total)
  .slice(0, 2);
const overview = previous.rows.find(
  (row) => row.app === 'manager-web' && row.route === '/manager/students/:id?tab=overview',
);
assert(overview);
selected.push({
  ...overview,
  manifestSeeds: [...overview.manifestSeeds, 'src/pages/student/BalanceSummary.tsx'],
});
for (const tab of ['payments', 'subscriptions']) {
  const formRoute = previous.rows.find(
    (row) => row.app === 'manager-web' && row.route === `/manager/students/:id?tab=${tab}`,
  );
  assert(formRoute);
  selected.push(formRoute);
}
const budgets = selected.map((row) => ({
  route: row.route,
  ...evaluateRoute({
    manifest,
    seeds: row.manifestSeeds,
    assets: actualAssets,
    requiredFonts: ['cyrillic', 'latin', 'romanian'],
  }),
}));
await writeFile(new URL('budgets.json', out), JSON.stringify(budgets, null, 2) + '\n');
const origin = 'http://127.0.0.1:4193';
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
};
const checks = [];
const browserErrors = [];
const external = [];
const browser = await chromium.launch();
const names = {
  ru: { language: 'Язык интерфейса', save: 'Сохранить' },
  ro: { language: 'Limba interfeței', save: 'Salvează' },
};
async function setup(locale = 'ro') {
  const context = await browser.newContext({
    viewport: { width: 360, height: 900 },
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  });
  await context.addInitScript(
    (locale) => globalThis.localStorage.setItem('k8k.locale', locale),
    locale,
  );
  const state = {
    writes: 0,
    csrf: false,
    idempotency: false,
    status: 422,
    code: 'INVALID_MONEY',
    denied: false,
  };
  await context.route('**/*', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) {
      external.push(url.origin + url.pathname);
      return route.abort();
    }
    if (request.method() === 'GET') {
      if (url.pathname === '/api/v1/auth/csrf')
        return route.fulfill({ json: { csrfToken: 'local-only' } });
      if (url.pathname === '/fixture/read')
        return state.denied
          ? route.fulfill({
              status: 403,
              json: { code: 'FORBIDDEN', message: 'SQL FOREIGN_OBJECT' },
            })
          : route.fulfill({ json: { text: 'PRIVATE_SYNTHETIC_BODY' } });
      const key =
        url.pathname.endsWith('.html') || files.has(url.pathname) ? url.pathname : '/index.html';
      const body = files.get(key);
      if (body !== undefined)
        return route.fulfill({
          body,
          contentType: mime[extname(key)] ?? 'application/octet-stream',
        });
    }
    if (['POST', 'PATCH'].includes(request.method()) && url.pathname.startsWith('/api/v1/')) {
      state.writes++;
      state.csrf = !!request.headers()['x-csrf-token'];
      state.idempotency = /^[0-9a-f-]{36}$/u.test(request.headers()['idempotency-key'] ?? '');
      if (state.status === 202)
        return route.fulfill({
          status: 202,
          json: {
            notificationId: '10000000-0000-4000-8000-000000000002',
            studentId: '10000000-0000-4000-8000-000000000001',
            channel: 'IN_APP',
            templateCode: 'MANUAL_MESSAGE',
            status: 'QUEUED',
            createdAt: '2026-11-04T09:00:00Z',
            sentAt: null,
            failureReason: null,
          },
        });
      return route.fulfill({
        status: state.status,
        json: {
          status: state.status,
          code: state.code,
          message: 'SQL FOREIGN_OBJECT',
          requestId: 'FOREIGN_OBJECT',
          details: {
            fields: state.code === 'CURRENT_PASSWORD_INVALID' ? ['currentPassword'] : ['amount'],
            comment: 'SQL FOREIGN_OBJECT',
          },
        },
      });
    }
    external.push(request.method() + ' ' + url.pathname);
    return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => browserErrors.push(error.message));
  return { context, page, state };
}
try {
  const { page, state } = await setup();
  await page.goto(`${origin}/manager-fixture?case=manager&ui.k8k=1`);
  const amount = page.getByRole('textbox', { name: 'Sumă', exact: true });
  await page.getByRole('button', { name: names.ro.save }).click();
  await expect(amount).toHaveAttribute('aria-invalid', 'true');
  await expect(amount).toHaveAccessibleDescription(
    'Introdu o sumă pozitivă cu punct și cel mult 4 zecimale.',
  );
  await expect(amount).toBeFocused();
  await expect(amount).toHaveValue('9007199254740993.0001');
  await expect(page.getByRole('textbox', { name: 'Comentariu' })).toHaveValue(
    'Synthetic unchanged note',
  );
  await expect(page.getByText('Suma introdusă este 9.007.199.254.740.993,0001 MDL.')).toBeVisible();
  assert.equal(state.writes, 1);
  assert(state.csrf && state.idempotency);
  for (const width of [360, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const locale of ['ru', 'ro']) {
      const current = await page.locator('html').getAttribute('lang');
      await page.getByRole('combobox', { name: names[current].language }).selectOption(locale);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      assert.equal(await page.locator('html').evaluate((element) => element.scrollWidth), width);
      assert.doesNotMatch(await page.locator('body').innerText(), /SQL|FOREIGN_OBJECT/u);
      await page.screenshot({
        path: fileURLToPath(new URL(`validation-${locale}-${width}.png`, out)),
      });
    }
  }
  assert.equal(state.writes, 1);
  checks.push(
    'Server field error preserves exact money, note and focus, no repeat on RU/RO x four widths',
  );

  await amount.fill('');
  await page.getByRole('button', { name: names.ro.save }).click();
  await expect(amount).toHaveAccessibleDescription('Completează acest câmp.');
  await expect(amount).toBeFocused();
  assert.equal(state.writes, 1);
  await amount.fill('1.0001');
  await expect(amount).not.toHaveAttribute('aria-invalid', 'true');
  checks.push('Native required validation has a localized aria description and prevents commands');

  state.status = 503;
  state.code = 'INTERNAL_ERROR';
  await page.getByRole('button', { name: names.ro.save }).click();
  await expect(page.locator('[data-outcome="unknown"]')).toBeVisible();
  await expect(page.getByRole('button', { name: names.ro.save })).toBeDisabled();
  await page.getByRole('combobox', { name: names.ro.language }).selectOption('ru');
  await expect(page.getByRole('button', { name: names.ru.save })).toBeDisabled();
  await page
    .locator('form')
    .evaluate((form) =>
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
    );
  assert.equal(state.writes, 2);
  checks.push(
    'Unknown command outcome blocks blind repeat and stays unknown through locale switch',
  );

  for (const mode of ['manager-denied', 'student-denied']) {
    const test = await setup();
    await test.page.goto(`${origin}/cached?case=${mode}&ui.k8k=1`);
    await expect(test.page.locator('[data-private]')).toHaveText('PRIVATE_SYNTHETIC_BODY');
    test.state.denied = true;
    await test.page.getByRole('button', { name: 'Reîncearcă încărcarea' }).click();
    await expect(test.page.locator('[data-private]')).toHaveCount(0);
    await expect(test.page.getByText('Nu ai acces la această secțiune.')).toBeVisible();
    assert(test.page.url().includes('/cached'));
    checks.push(mode + ' hides cached private body without logging out');
    await test.context.close();
  }

  const password = await setup();
  password.state.status = 401;
  password.state.code = 'CURRENT_PASSWORD_INVALID';
  await password.page.goto(`${origin}/student/security/change-password?case=student&ui.k8k=1`);
  const current = password.page.locator('input[name="currentPassword"]');
  await current.fill('a'.repeat(9) + '1');
  await password.page.locator('input[name="newPassword"]').fill('b'.repeat(9) + '2');
  await password.page.locator('input[name="confirmPassword"]').fill('b'.repeat(9) + '2');
  await password.page.getByRole('button', { name: 'Изменить пароль' }).click();
  await expect(current).toHaveAccessibleDescription('Parola curentă este incorectă.');
  await expect(current).toBeFocused();
  assert(password.page.url().includes('/student/security/change-password'));
  assert.equal(password.state.writes, 1);
  await password.page.getByRole('combobox', { name: names.ro.language }).selectOption('ru');
  await expect(current).toHaveAccessibleDescription('Текущий пароль указан неверно.');
  assert.equal(password.state.writes, 1);
  assert.equal((await current.inputValue()).length, 10);
  checks.push(
    'Actual student password form keeps session, field values and focus on CURRENT_PASSWORD_INVALID',
  );
  await password.context.close();

  const queued = await setup();
  queued.state.status = 202;
  await queued.page.goto(`${origin}/notification?case=queued&ui.k8k=1`);
  await queued.page.getByRole('button', { name: names.ro.save }).click();
  await expect(queued.page.getByRole('status')).toHaveText(
    'Solicitarea este în coadă. Executarea nu este încă confirmată.',
  );
  assert.equal(queued.state.writes, 1);
  checks.push('Actual notification SDK response 202 QUEUED is displayed as queued');
  await queued.context.close();

  assert.equal(
    await page.evaluate(() =>
      fetch('https://example.invalid/error-sentinel').then(
        () => 'unexpected',
        () => 'blocked',
      ),
    ),
    'blocked',
  );
  assert.deepEqual(external, ['https://example.invalid/error-sentinel']);
  assert.deepEqual(browserErrors, []);
  await writeFile(
    new URL('browser.json', out),
    JSON.stringify(
      {
        checks,
        browserErrors,
        external,
        budgets: budgets.map(({ route, total, pass }) => ({ route, total, pass })),
      },
      null,
      2,
    ) + '\n',
  );
  assert(
    budgets.every(({ pass }) => pass),
    'Targeted route budget exceeded',
  );
  console.log(`Error feedback smoke passed (${checks.length} scenarios).`);
} finally {
  await browser.close();
}

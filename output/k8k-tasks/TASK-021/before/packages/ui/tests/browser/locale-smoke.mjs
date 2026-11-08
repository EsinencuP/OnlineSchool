// Local synthetic browser target. Vite builds in memory and every network request is intercepted.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { build } from 'vite';
import { evaluateRoute } from '../../../../scripts/k8k-route-budget-core.mjs';

const root = fileURLToPath(new URL('../../../../apps/platform/', import.meta.url));
const out = new URL('../../dist/locale-evidence/', import.meta.url);
await mkdir(out, { recursive: true });
const result = await build({
  root,
  envDir: false,
  build: { write: false, manifest: true },
  logLevel: 'error',
});
assert(!Array.isArray(result) && 'output' in result);
const assets = new Map(
  result.output.map((file) => [
    `/${file.fileName}`,
    file.type === 'chunk' ? file.code : Buffer.from(file.source),
  ]),
);
const manifest = JSON.parse(assets.get('/.vite/manifest.json').toString());
const budget = evaluateRoute({
  manifest,
  seeds: ['index.html'],
  assets: new Map([...assets].map(([key, value]) => [key.slice(1), Buffer.from(value)])),
  requiredFonts: ['cyrillic', 'latin', 'romanian'],
});
assert(budget.pass, JSON.stringify(budget));
const contentTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
};
const origin = 'http://127.0.0.1:4179';
const syntheticAccount = {
  key: 'locale-fixture',
  login: 'locale-fixture@example.invalid',
  name: 'Ștefan Sintetic',
  home: '/student',
  role: 'STUDENT',
};
const cases = [];
const unexpected = [];
const errors = [];
let loginWrites = 0;
const browser = await chromium.launch();

async function setup() {
  const context = await browser.newContext({
    locale: 'en-US',
    timezoneId: 'America/New_York',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    viewport: { width: 360, height: 900 },
  });
  await context.route('**/*', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) {
      unexpected.push(url.origin + url.pathname);
      return route.abort('blockedbyclient');
    }
    if (request.method() === 'GET') {
      if (url.pathname === '/api/v1/platform/accounts')
        return route.fulfill({
          json: { enabled: true, currentKey: null, items: [syntheticAccount] },
        });
      if (url.pathname === '/api/v1/auth/session')
        return route.fulfill({ status: 401, json: { code: 'UNAUTHENTICATED' } });
      const path =
        url.pathname === '/' || url.pathname === '/account' ? '/index.html' : url.pathname;
      const body = assets.get(path);
      if (body !== undefined)
        return route.fulfill({
          body,
          contentType: contentTypes[extname(path)] ?? 'application/octet-stream',
        });
    }
    if (request.method() === 'POST' && url.pathname === '/api/v1/auth/session') loginWrites++;
    unexpected.push(`${request.method()} ${url.pathname}`);
    return route.abort('blockedbyclient');
  });
  context.on('page', (page) => page.on('pageerror', (error) => errors.push(error.message)));
  return context;
}
const names = {
  ru: {
    welcome: 'С возвращением',
    selector: 'Язык интерфейса',
    submit: 'Войти в кабинет →',
    title: 'Личный кабинет',
  },
  ro: {
    welcome: 'Bine ai revenit',
    selector: 'Limba interfeței',
    submit: 'Intră în cabinet →',
    title: 'Cabinet personal',
  },
};
async function localeIs(page, locale) {
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  await expect(page.getByRole('heading', { name: names[locale].welcome })).toBeVisible();
  await expect(page.getByLabel(names[locale].selector)).toHaveValue(locale);
  await expect(page).toHaveTitle(`Academy · ${names[locale].title}`);
}

try {
  const context = await setup();
  const page = await context.newPage();
  await page.goto(`${origin}/account`);
  await localeIs(page, 'ru');
  await page
    .getByRole('combobox', { name: 'Тестовый пользователь' })
    .selectOption(syntheticAccount.login);
  await expect(page.getByRole('option', { name: syntheticAccount.name })).toHaveCount(1);

  const login = page.locator('input[name="email"]');
  const password = page.locator('input[name="password"]');
  await page.getByRole('button', { name: names.ru.submit }).click();
  await expect(password).toBeFocused();
  await expect(password).toHaveAccessibleDescription('Заполните поле «Пароль».');
  await page.getByLabel(names.ru.selector).focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await localeIs(page, 'ro');
  await expect(password).toHaveAccessibleDescription('Completează câmpul „Parolă”.');
  await expect(login).toHaveValue(syntheticAccount.login);
  await expect(page.getByRole('option', { name: syntheticAccount.name })).toHaveCount(1);
  await expect(page.getByLabel('Utilizator de test')).toHaveAccessibleName('Utilizator de test');
  await login.fill('invalid-address');
  await page.getByRole('button', { name: names.ro.submit }).click();
  await expect(login).toBeFocused();
  await expect(login).toHaveAttribute('aria-invalid', 'true');
  await expect(login).toHaveAccessibleDescription('Introdu o adresă de e-mail validă.');
  await login.fill(syntheticAccount.login);
  await expect(login).not.toHaveAttribute('aria-invalid');
  cases.push(
    'Keyboard locale change updates labels and existing validation, preserves draft and literal name',
  );

  await page.reload();
  await localeIs(page, 'ro');
  await page.goto(`${origin}/`);
  await localeIs(page, 'ro');
  const second = await context.newPage();
  await second.goto(`${origin}/account`);
  await localeIs(second, 'ro');
  await second.getByLabel(names.ro.selector).selectOption('ru');
  await localeIs(page, 'ru');
  await page.getByLabel(names.ru.selector).selectOption('ro');
  await localeIs(second, 'ro');
  const persisted = await page.evaluate(() => ({
    keys: Object.keys(globalThis.localStorage),
    language: globalThis.localStorage.getItem('k8k.locale'),
  }));
  assert.deepEqual(persisted, { keys: ['k8k.locale'], language: 'ro' });
  await second.evaluate(() => globalThis.localStorage.removeItem('k8k.locale'));
  await localeIs(page, 'ru');
  await second.evaluate(() => globalThis.localStorage.setItem('k8k.locale', 'unsupported'));
  await second.reload();
  await localeIs(second, 'ru');
  cases.push(
    'Reload, full navigation, bidirectional cross-tab, removal and unknown locale fallback',
  );

  for (const width of [360, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const locale of ['ru', 'ro']) {
      const selector = page.locator('select').first();
      await selector.selectOption(locale);
      await localeIs(page, locale);
      await expect(page.locator('.login-help')).toBeVisible();
      assert.equal(await page.locator('html').evaluate((html) => html.scrollWidth), width);
      await page.screenshot({
        path: fileURLToPath(new URL(`login-${locale}-${width}.png`, out)),
        fullPage: true,
      });
      cases.push({ route: '/', role: 'unauthenticated', width, locale, fixture: 'platform login' });
    }
  }

  const denied = await setup();
  await denied.addInitScript(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      get() {
        throw new DOMException('Storage denied for locale fixture', 'SecurityError');
      },
    });
  });
  const offline = await denied.newPage();
  await offline.goto(`${origin}/account`);
  await localeIs(offline, 'ru');
  await offline.getByLabel(names.ru.selector).selectOption('ro');
  await localeIs(offline, 'ro');
  await offline.reload();
  await localeIs(offline, 'ru');
  cases.push('Blocked storage uses memory for the document, reload defaults to RU');

  assert.equal(
    await page.evaluate(() =>
      fetch('https://example.invalid/locale-sentinel').then(
        () => 'unexpected',
        () => 'blocked',
      ),
    ),
    'blocked',
  );
  assert.equal(loginWrites, 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(unexpected, ['https://example.invalid/locale-sentinel']);
  await writeFile(
    new URL('browser.json', out),
    JSON.stringify({ cases, loginWrites, errors, blocked: unexpected, budget }, null, 2) + '\n',
  );
  console.log(`Locale browser smoke passed (${cases.length} cases).`);
} finally {
  await browser.close();
}

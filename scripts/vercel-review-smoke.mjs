// Owner-authorized live review smoke. No business mutations, fixtures or provisioning.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium, expect } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.join(root, 'output/vercel-release-2026-11-08');
await mkdir(out, { recursive: true });
const origin = 'https://onlineschool-xi.vercel.app';
const readme = await readFile(path.join(root, 'README.md'), 'utf8');
const access = readme.split('\n').find((line) => line.includes('`tamara.demo@'));
assert(access, 'Owner-published demo login must exist');
const credentials = [...access.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  serviceWorkers: 'block',
});
const page = await context.newPage();
const evidence = {
  origin,
  scope: 'Published real UI/API + synthetic accounts; read-only except login/switch/logout',
  routes: [],
  switches: [],
  apiErrors: [],
  pageErrors: [],
  blockedBusinessMutations: [],
  status: 'RUNNING',
};
await context.route('**/*', (route) => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.origin !== origin) return route.abort();
  if (
    url.pathname.startsWith('/api/') &&
    !['GET', 'HEAD', 'OPTIONS'].includes(request.method()) &&
    !['/api/v1/auth/session', '/api/v1/auth/switch-user'].includes(url.pathname)
  ) {
    evidence.blockedBusinessMutations.push({ method: request.method(), path: url.pathname });
    return route.abort();
  }
  return route.continue();
});
page.on('pageerror', (error) => evidence.pageErrors.push(error.name + ': ' + error.message));
page.on('response', (response) => {
  const url = new URL(response.url());
  if (url.pathname.startsWith('/api/') && response.status() >= 500)
    evidence.apiErrors.push({ path: url.pathname, status: response.status() });
});
async function visit(role, url, screenshot = false) {
  const response = await page.goto(origin + url, { waitUntil: 'networkidle', timeout: 60000 });
  await expect(page.locator('main')).toBeVisible();
  const ui = await page.evaluate(() => ({
    path: globalThis.location.pathname + globalThis.location.search,
    theme: globalThis.document.documentElement.dataset.k8k,
    locale: globalThis.document.documentElement.lang,
    headings: [...globalThis.document.querySelectorAll('h1')].map((n) => n.textContent),
    overflow: globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
  }));
  assert.equal(response.status(), 200);
  assert.equal(ui.theme, 'provisional');
  assert(!ui.overflow, role + ' horizontal overflow');
  evidence.routes.push({ role, ...ui, status: response.status() });
  if (screenshot)
    await page.screenshot({
      path: path.join(out, role.toLowerCase() + '.png'),
      fullPage: true,
      mask: [page.locator('input[type=password]')],
    });
}
try {
  await visit('LOGIN', '/account?ui.k8k=1', true);
  await page.locator('input[name=email]').fill(credentials[0]);
  await page.locator('input[name=password]').fill(credentials[1]);
  await page.locator('form button[type=submit]').click();
  await expect(page).toHaveURL(/\/manager(?:\?|$)/, { timeout: 60000 });
  await visit('MANAGER', '/manager?ui.k8k=1', true);
  for (const section of ['leads', 'students', 'schedule', 'tasks'])
    await visit('MANAGER', '/manager/' + section + '?ui.k8k=1');
  const catalog = await page.evaluate(async () =>
    (await fetch('/api/v1/platform/accounts', { cache: 'no-store' })).json(),
  );
  assert(catalog.enabled && catalog.items.length >= 9, 'Fixed demo catalog must be enabled');
  const roles = [
    [
      'STUDENT',
      '/student',
      [
        '/student/subjects',
        '/student/lessons',
        '/student/homework',
        '/student/skills',
        '/student/reports',
        '/student/materials',
        '/student/subscription',
        '/student/help',
        '/student/profile',
        '/student/security',
      ],
    ],
    [
      'TEACHER',
      '/teacher',
      ['/teacher?section=lessons', '/teacher?section=students', '/teacher?section=homework'],
    ],
    [
      'DIRECTOR',
      '/director',
      ['/director?section=lessons', '/director?section=students', '/director?section=tasks'],
    ],
    ['TECH_OPERATOR', '/operator', []],
  ];
  for (const [role, home, routes] of roles) {
    const target = catalog.items.find((a) => a.role === role);
    assert(target, role + ' demo target missing');
    await page.locator('.account-menu > summary').click();
    await page.locator('.account-choices button').filter({ hasText: target.name }).click();
    await expect(page).toHaveURL(new RegExp(home + '(?:\\?|$)'), { timeout: 60000 });
    evidence.switches.push({ role, key: target.key, status: 'PASS' });
    await visit(role, home + '?ui.k8k=1', true);
    for (const route of routes)
      await visit(role, route + (route.includes('?') ? '&' : '?') + 'ui.k8k=1');
    await page.setViewportSize({ width: 360, height: 800 });
    await visit(role, home + '?ui.k8k=1');
    await page.screenshot({
      path: path.join(out, role.toLowerCase() + '-360.png'),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  await page.locator('.account-menu > summary').click();
  await page.locator('.account-logout').click();
  await expect(page).toHaveURL(/\/account(?:\?|$)/, { timeout: 60000 });
  evidence.logout = 'PASS';
  assert.equal(evidence.pageErrors.length, 0, 'Browser runtime exception');
  assert.equal(evidence.apiErrors.length, 0, 'Server API error');
  assert.equal(evidence.blockedBusinessMutations.length, 0, 'Unexpected business mutation');
  evidence.status = 'PASS';
} catch (error) {
  evidence.status = 'FAIL';
  evidence.error = error.name + ': ' + error.message;
  process.exitCode = 1;
} finally {
  await writeFile(path.join(out, 'live-smoke.json'), JSON.stringify(evidence, null, 2) + '\n');
  await browser.close();
}
console.log({
  status: evidence.status,
  routes: evidence.routes.length,
  switches: evidence.switches.length,
  apiErrors: evidence.apiErrors.length,
  browserErrors: evidence.pageErrors.length,
});

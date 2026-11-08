// Synthetic browser target. Both bundles are built in memory and every request is intercepted.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import react from '@vitejs/plugin-react';
import { build } from 'vite';
import { evaluateRoute } from '../../../../scripts/k8k-route-budget-core.mjs';

const out = new URL('../../dist/account-chrome-evidence/', import.meta.url);
const screenshots = new URL('screenshots/', out);
await mkdir(screenshots, { recursive: true });
async function bundle(root, config) {
  const result = await build({
    root: fileURLToPath(root),
    envDir: false,
    logLevel: 'error',
    build: { write: false, manifest: true },
    ...config,
  });
  assert(!Array.isArray(result) && 'output' in result);
  return new Map(
    result.output.map((file) => [
      file.fileName,
      Buffer.from(file.type === 'chunk' ? file.code : file.source),
    ]),
  );
}
const platform = await bundle(new URL('../../', import.meta.url), {});
const fixture = await bundle(new URL('./', import.meta.url), {
  configFile: false,
  plugins: [react()],
});
const budget = evaluateRoute({
  manifest: JSON.parse(platform.get('.vite/manifest.json').toString()),
  seeds: ['index.html'],
  assets: platform,
  requiredFonts: ['cyrillic', 'latin', 'romanian'],
});
assert(budget.pass, JSON.stringify(budget));
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
};
const origin = 'http://127.0.0.1:4189';
const currentName = 'Ștefan Exemplu';
const targetName = 'Profesor Exemplu';
const cases = [];
const errors = [];
const blocked = [];
const browser = await chromium.launch();
const language = { ru: 'Язык интерфейса', ro: 'Limba interfeței' };
const signOut = { ru: 'Выйти из аккаунта', ro: 'Deconectează-te' };

async function setup({ catalogEnabled = true, storageDenied = false, teacherRace = false } = {}) {
  const context = await browser.newContext({
    viewport: { width: 360, height: 900 },
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  });
  const state = {
    switchOutcome: 503,
    currentKey: 'active-fixture',
    waitsForSwitch: false,
    sessionActive: true,
    writes: [],
    catalogReads: 0,
    mfa: true,
    passwordOnly: false,
    oldReads: [],
    navigations: [],
    holdReads: false,
    holdNavigation: false,
    workspaceReads: 0,
  };
  const actorId = () =>
    state.currentKey === 'active-fixture' && teacherRace
      ? '10000000-0000-4000-8000-000000000001'
      : '10000000-0000-4000-8000-000000000002';
  if (teacherRace)
    await context.addInitScript(() => {
      // Simulate a transport completing a read even after its AbortSignal fires.
      const fetchOriginal = globalThis.fetch;
      globalThis.fixtureCompletedReads = 0;
      globalThis.fetch = async (url, options) => {
        if (!String(url).includes('/api/v1/platform/workspace')) return fetchOriginal(url, options);
        const response = await fetchOriginal(url, { ...options, signal: undefined });
        globalThis.fixtureCompletedReads++;
        return response;
      };
    });
  if (storageDenied)
    await context.addInitScript(() => {
      Object.defineProperty(globalThis, 'localStorage', {
        get() {
          throw new DOMException('Storage denied for account fixture', 'SecurityError');
        },
      });
    });
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    if (url.origin === origin) {
      if (request.method() === 'GET') {
        if (pathname === '/api/v1/platform/accounts') {
          state.catalogReads++;
          return route.fulfill({
            json: {
              enabled: catalogEnabled,
              currentKey: catalogEnabled && state.sessionActive ? state.currentKey : null,
              items: catalogEnabled
                ? [
                    {
                      key: 'active-fixture',
                      name: currentName,
                      role: teacherRace ? 'TEACHER' : 'STUDENT',
                      login: 'student@example.invalid',
                      home: teacherRace ? '/teacher' : '/student',
                    },
                    {
                      key: 'teacher-fixture',
                      name: targetName,
                      role: 'TEACHER',
                      login: 'teacher@example.invalid',
                      home: '/teacher',
                    },
                  ]
                : [],
            },
          });
        }
        if (pathname === '/api/v1/auth/session') {
          return state.sessionActive
            ? route.fulfill({
                json: {
                  account: {
                    id: actorId(),
                    kind: state.role === 'DIRECTOR' ? 'STAFF' : 'TEACHER',
                    roles: [state.role ?? 'TEACHER'],
                  },
                  mfa_completed: state.mfa,
                  password_only: state.passwordOnly,
                  recovery_only: false,
                  expires_at: '2026-11-05T00:00:00Z',
                },
              })
            : route.fulfill({ status: 401, json: { code: 'UNAUTHENTICATED' } });
        }
        if (pathname === '/api/v1/platform/workspace') {
          state.workspaceReads++;
          const first = state.currentKey === 'active-fixture';
          const subject = first ? 'Synthetic class A' : 'Synthetic class B';
          const accountId = actorId();
          if (state.holdReads) await new Promise((resolve) => state.oldReads.push(resolve));
          return route.fulfill({
            json: {
              name: teacherRace && first ? currentName : targetName,
              role: state.role ?? 'TEACHER',
              ...(teacherRace
                ? {
                    actorContext: {
                      accountId,
                      role: state.role ?? 'TEACHER',
                      timezone: 'Europe/Chisinau',
                      asOf: '2026-11-06T08:00:00Z',
                    },
                  }
                : {}),
              lessons: teacherRace
                ? [
                    {
                      id: 'synthetic',
                      subject,
                      student: 'Synthetic student',
                      teacher: 'Synthetic teacher',
                      startsAt: '2026-11-06T10:00:00Z',
                      endsAt: '2026-11-06T11:00:00Z',
                      status: 'SCHEDULED',
                      meetUrl: null,
                    },
                  ]
                : [],
              students: [],
              homework: [],
              tasks: [],
            },
          });
        }
        if (pathname === '/api/v1/auth/csrf')
          return route.fulfill({ json: { csrfToken: 'local-fixture' } });
        const key = pathname.slice(1);
        const body =
          pathname === '/fixture'
            ? fixture.get('index.html')
            : ['/', '/account', '/teacher', '/director'].includes(pathname)
              ? platform.get('index.html')
              : (platform.get(key) ?? fixture.get(key));
        if (body) {
          if (state.holdNavigation && request.isNavigationRequest()) {
            state.navigations.push(request.url());
            // Keep the retiring document alive without freezing it during navigation.
            return route.fulfill({ status: 204 });
          }
          return route.fulfill({
            body,
            contentType: mime[extname(pathname) || '.html'] ?? 'application/octet-stream',
          });
        }
      }
      if (request.method() === 'POST' && pathname === '/api/v1/auth/switch-user') {
        const hasCsrf = request.headers()['x-csrf-token'] === 'local-fixture';
        const targetsTeacher = request.postDataJSON().key === 'teacher-fixture';
        state.writes.push({ action: 'switch', hasCsrf, targetsTeacher });
        if (state.waitsForSwitch)
          await new Promise((resolve) => {
            state.settle = resolve;
          });
        if (state.switchOutcome === 200) {
          state.currentKey = 'teacher-fixture';
          return route.fulfill({ json: { home: '/teacher' } });
        }
        return route.fulfill({ status: state.switchOutcome, json: { code: 'FIXTURE_ERROR' } });
      }
      if (request.method() === 'DELETE' && pathname === '/api/v1/auth/session') {
        state.writes.push({
          action: 'logout',
          hasCsrf: request.headers()['x-csrf-token'] === 'local-fixture',
        });
        state.sessionActive = false;
        return route.fulfill({ json: { loggedOut: true } });
      }
    }
    blocked.push(`${request.method()} ${url.origin}${pathname}`);
    return route.abort('blockedbyclient');
  });
  context.on('page', (page) => page.on('pageerror', (error) => errors.push(error.message)));
  return { context, state };
}
const summary = (page) => page.locator('.account-menu > summary');
const menu = (page) => page.locator('.account-menu');
async function openMenu(page) {
  await summary(page).focus();
  await page.keyboard.press('Enter');
  await expect(menu(page)).toHaveAttribute('open', '');
}
async function changeLanguage(page, current, next) {
  await page.getByRole('combobox', { name: language[current] }).selectOption(next);
  await expect(page.locator('html')).toHaveAttribute('lang', next);
  await expect(page.getByRole('combobox', { name: language[next] })).toHaveCount(1);
  await expect(page.getByRole('button', { name: signOut[next], exact: true })).toHaveCount(1);
}
const fixturePath = '/fixture?ui.k8k=1&role=STUDENT&section=homework';
const cabinetLabels = {
  STUDENT: ['Домашние задания', 'Teme pentru acasă'],
  MANAGER: ['Обзор', 'Prezentare'],
  TEACHER: ['Мои ученики', 'Elevii mei'],
  DIRECTOR: ['Задачи менеджеров', 'Sarcinile managerilor'],
  TECH_OPERATOR: ['Состояние платформы', 'Starea platformei'],
};
try {
  const { context, state } = await setup();
  const page = await context.newPage();
  await page.goto(origin + fixturePath);
  await page.locator('#draft').fill('Ciornă sintetică');
  await page.locator('#object').selectOption('b');
  const before = page.url();
  await openMenu(page);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('combobox', { name: language.ru })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ro');
  await expect(page.getByRole('heading', { name: 'Schimbă utilizatorul' })).toBeVisible();
  await expect(
    menu(page).getByRole('button', { name: new RegExp(currentName, 'u') }),
  ).toBeDisabled();
  await expect(menu(page).getByRole('button', { name: new RegExp(targetName, 'u') })).toBeEnabled();
  await expect(page.getByRole('button', { name: signOut.ro, exact: true })).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Intră în alt cont cu parola' })).toHaveCount(1);
  await expect(page.locator('#draft')).toHaveValue('Ciornă sintetică');
  await expect(page.locator('#object')).toHaveValue('b');
  assert.equal(page.url(), before);
  assert.equal(state.catalogReads, 1);
  assert.deepEqual(state.writes, []);
  await page.getByRole('button', { name: signOut.ro, exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(menu(page)).not.toHaveAttribute('open');
  await expect(summary(page)).toBeFocused();
  const mobileNav = page.getByRole('navigation', { name: 'Navigare mobilă' });
  await mobileNav.getByRole('button', { name: 'Mai multe' }).focus();
  await page.keyboard.press('Enter');
  const fullNav = page.getByRole('navigation', { name: 'Toate secțiunile' });
  await expect(fullNav.getByRole('link', { name: 'Teme pentru acasă' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(fullNav.getByRole('link', { name: 'Acasă', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(mobileNav.getByRole('button', { name: 'Mai multe' })).toBeFocused();
  cases.push(
    'Keyboard locale switch preserves account, catalog, active route, dirty draft and selected object, with Escape focus return for both menus',
  );

  for (const width of [360, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await openMenu(page);
    for (const locale of ['ru', 'ro']) {
      const current = await page.locator('html').getAttribute('lang');
      await changeLanguage(page, current, locale);
      const popover = await page.locator('.account-popover').boundingBox();
      assert(popover && popover.x >= 0 && popover.x + popover.width <= width + 1);
      assert.equal(await page.locator('html').evaluate((html) => html.scrollWidth), width);
      if (width < 1024)
        assert(
          await page
            .locator('.k8k-bottom-nav')
            .evaluate((nav) =>
              [...nav.querySelectorAll('.k8k-nav-link')].every(
                (link) => link.scrollWidth <= link.clientWidth,
              ),
            ),
        );
      await page.screenshot({
        path: fileURLToPath(new URL(`student-${locale}-${width}.png`, screenshots)),
      });
      cases.push({
        route: fixturePath,
        role: 'STUDENT',
        locale,
        width,
        fixture: 'AppShell and AccountMenu',
      });
    }
    await page.getByRole('button', { name: signOut.ro, exact: true }).focus();
    await page.keyboard.press('Escape');
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  for (const [role, labels] of Object.entries(cabinetLabels)) {
    await page.goto(`${origin}/fixture?ui.k8k=1&role=${role}`);
    await openMenu(page);
    await changeLanguage(page, 'ro', 'ru');
    await expect(page.locator('.k8k-sidebar').getByText(labels[0], { exact: true })).toBeVisible();
    await changeLanguage(page, 'ru', 'ro');
    await expect(page.locator('.k8k-sidebar').getByText(labels[1], { exact: true })).toBeVisible();
  }
  cases.push('Five cabinet navigation surfaces in both locales');

  await page.goto(`${origin}${fixturePath}&denied`);
  await expect(page.getByText('Nu ai acces la această secțiune.')).toBeVisible();
  await expect(page.locator('#draft')).toHaveCount(0);
  cases.push('Forbidden story removes the private body');

  state.currentKey = 'teacher-fixture';
  await page.goto(`${origin}/teacher?ui.k8k=1&section=homework`);
  await expect(page.locator('.k8k-sidebar [aria-current="page"]')).toHaveText('Teme pentru acasă');
  await openMenu(page);
  await changeLanguage(page, 'ro', 'ru');
  await expect(page.locator('.k8k-sidebar [aria-current="page"]')).toHaveText('Домашние задания');
  assert.equal(new URL(page.url()).searchParams.get('section'), 'homework');
  assert.deepEqual(state.writes, []);
  cases.push('Actual platform route retains teacher section without an account command');

  state.currentKey = 'active-fixture';
  await page.goto(origin + fixturePath);
  await openMenu(page);
  state.waitsForSwitch = true;
  await menu(page)
    .getByRole('button', { name: new RegExp(targetName, 'u') })
    .press('Enter');
  await expect.poll(() => state.writes.length).toBe(1);
  await changeLanguage(page, 'ru', 'ro');
  await expect(menu(page).getByRole('status')).toHaveText('Se deschide cabinetul tău…');
  assert.deepEqual(state.writes, [{ action: 'switch', hasCsrf: true, targetsTeacher: true }]);
  state.settle();
  await expect(page.getByRole('alert')).toContainText('Rezultatul este încă necunoscut.');
  await expect(menu(page)).toHaveCount(0);
  await expect(page.locator('#draft')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Verifică sesiunea curentă' })).toHaveAttribute(
    'href',
    '/',
  );
  for (const locale of ['ro', 'ru']) {
    await page.evaluate((value) => {
      globalThis.localStorage.setItem('k8k.locale', value);
      globalThis.dispatchEvent(
        new globalThis.StorageEvent('storage', {
          key: 'k8k.locale',
          newValue: value,
          storageArea: globalThis.localStorage,
        }),
      );
    }, locale);
    for (const width of [360, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.getByRole('link')).toBeFocused();
      assert.equal(await page.locator('html').evaluate((el) => el.scrollWidth), width);
      await page.screenshot({
        path: fileURLToPath(new URL(`session-verify-${locale}-${width}.png`, screenshots)),
      });
    }
  }
  assert.equal(state.writes.length, 1);
  cases.push(
    'Pending locale switch keeps one CSRF-protected command; unknown outcome blocks repeat',
  );

  const disabled = await setup({ catalogEnabled: false, storageDenied: true });
  const deniedPage = await disabled.context.newPage();
  await deniedPage.goto(origin + fixturePath);
  await openMenu(deniedPage);
  await expect.poll(() => disabled.state.catalogReads).toBe(1);
  await changeLanguage(deniedPage, 'ru', 'ro');
  await expect(deniedPage.getByRole('heading', { name: 'Schimbă utilizatorul' })).toHaveCount(0);
  await expect(deniedPage.getByText(targetName)).toHaveCount(0);
  await deniedPage.reload();
  await expect(deniedPage.locator('html')).toHaveAttribute('lang', 'ru');
  assert.deepEqual(disabled.state.writes, []);
  cases.push('Blocked storage is in-memory, disabled catalog has no demo actions');

  const success = await setup();
  success.state.switchOutcome = 200;
  const changed = await success.context.newPage();
  await changed.goto(origin + fixturePath);
  const otherTab = await success.context.newPage();
  await otherTab.goto(origin + fixturePath);
  await expect(summary(otherTab)).toBeVisible();
  await openMenu(changed);
  await changeLanguage(changed, 'ru', 'ro');
  await menu(changed)
    .getByRole('button', { name: new RegExp(targetName, 'u') })
    .click();
  await expect(changed).toHaveURL(origin + '/teacher');
  await expect(otherTab).toHaveURL(origin + '/teacher');
  await openMenu(changed);
  await expect(menu(changed).getByRole('button', { name: signOut.ro, exact: true })).toHaveCount(1);
  await menu(changed).getByRole('button', { name: signOut.ro, exact: true }).click();
  await expect(changed).toHaveURL(origin + '/account');
  await expect(changed.getByRole('combobox', { name: language.ro })).toHaveCount(1);
  await expect(otherTab).toHaveURL(origin + '/');
  await expect(otherTab.getByRole('combobox', { name: language.ro })).toHaveCount(1);
  assert.deepEqual(success.state.writes, [
    { action: 'switch', hasCsrf: true, targetsTeacher: true },
    { action: 'logout', hasCsrf: true },
  ]);
  cases.push(
    'Synthetic successful switch and logout navigate the current tab and refresh another tab with one CSRF-protected command per action',
  );

  const race = await setup({ teacherRace: true });
  const teacherA = await race.context.newPage(),
    peer = await race.context.newPage();
  await teacherA.goto(origin + '/teacher?ui.k8k=1');
  await peer.goto(origin + '/teacher?ui.k8k=1');
  const classA = (tab) => tab.getByRole('heading', { name: 'Synthetic class A' });
  const classB = (tab) => tab.getByRole('heading', { name: 'Synthetic class B' });
  await expect(classA(teacherA)).toBeVisible();
  await expect(classA(peer)).toBeVisible();

  const tabs = [teacherA, peer];
  const privateCount = () =>
    Promise.all(tabs.map((tab) => tab.locator('.lesson, .account-menu').count()));
  const completedReads = () =>
    Promise.all(tabs.map((tab) => tab.evaluate(() => globalThis.fixtureCompletedReads)));

  async function retireWithLateReads(change, destination) {
    race.state.holdReads = true;
    await teacherA.locator('.refresh').click();
    await peer.locator('.refresh').click();
    await expect.poll(() => race.state.oldReads.length).toBe(2);
    await openMenu(teacherA);
    const completed = await completedReads();
    race.state.holdNavigation = true;
    await change();
    await expect.poll(() => race.state.navigations.length).toBe(2);
    assert.deepEqual(race.state.navigations.sort(), [origin + '/', origin + destination]);
    await expect.poll(privateCount).toEqual([0, 0]);
    const reads = race.state.workspaceReads;
    await Promise.all(
      tabs.map((tab) =>
        tab.evaluate(() => {
          globalThis.dispatchEvent(new Event('focus'));
          globalThis.dispatchEvent(new Event('online'));
        }),
      ),
    );
    race.state.holdReads = false;
    for (const resolve of race.state.oldReads.splice(0)) resolve();
    await expect.poll(completedReads).toEqual(completed.map((n) => n + 1));
    assert.deepEqual(await privateCount(), [0, 0]);
    assert.equal(race.state.workspaceReads, reads);
    race.state.holdNavigation = false;
    race.state.navigations.length = 0;
    await Promise.all([teacherA.goto(origin + destination), peer.goto(origin + '/')]);
  }
  race.state.switchOutcome = 200;
  await retireWithLateReads(
    () =>
      menu(teacherA)
        .getByRole('button', { name: new RegExp(targetName, 'u') })
        .click({ noWaitAfter: true }),
    '/teacher',
  );
  for (const tab of [teacherA, peer]) {
    await expect(classB(tab)).toBeVisible();
    await expect(classA(tab)).toHaveCount(0);
  }
  cases.push(
    'Teacher A to B in two real workspace tabs: release old noncooperative reads during suspended navigation; no private DOM or focus/online refetch',
  );
  await retireWithLateReads(
    () =>
      menu(teacherA)
        .getByRole('button', { name: signOut.ru, exact: true })
        .click({ noWaitAfter: true }),
    '/account',
  );
  await expect(teacherA).toHaveURL(origin + '/account');
  await expect(peer).toHaveURL(origin + '/');
  assert.deepEqual(race.state.writes, [
    { action: 'switch', hasCsrf: true, targetsTeacher: true },
    { action: 'logout', hasCsrf: true },
  ]);
  cases.push(
    'Late workspace response after logout is discarded in both tabs; navigation issues no additional writes',
  );
  await race.context.close();

  const mfa = await setup({ teacherRace: true });
  mfa.state.role = 'DIRECTOR';
  mfa.state.mfa = false;
  const protectedPage = await mfa.context.newPage();
  await protectedPage.goto(origin + '/director?ui.k8k=1');
  await expect(protectedPage.getByRole('alert')).toBeVisible();
  await expect(protectedPage.locator('.stats')).toHaveCount(0);
  assert.equal(mfa.state.workspaceReads, 0);
  assert.deepEqual(mfa.state.writes, []);
  cases.push('Director with incomplete MFA and no server exception cannot mount workspace');
  mfa.state.passwordOnly = true;
  await protectedPage.reload();
  await expect(classA(protectedPage)).toBeVisible();
  cases.push('Explicit server password-only demo flag retains its existing workspace path');
  await mfa.context.close();
  assert.equal(
    await changed.evaluate(() =>
      fetch('https://example.invalid/account-sentinel').then(
        () => 'unexpected',
        () => 'blocked',
      ),
    ),
    'blocked',
  );
  assert.deepEqual(blocked, ['GET https://example.invalid/account-sentinel']);
  assert.deepEqual(errors, []);
  await writeFile(
    new URL('browser.json', out),
    JSON.stringify({ cases, budget, blocked, errors }, null, 2) + '\n',
  );
  console.log(`Account chrome smoke passed (${cases.length} cases).`);
} finally {
  await browser.close();
}

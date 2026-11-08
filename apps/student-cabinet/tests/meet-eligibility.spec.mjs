import { expect, test } from './gate-fixtures.mjs';
import { evidenceUrl } from './gate-fixtures.mjs';
import { fileURLToPath } from 'node:url';

const origin = 'http://127.0.0.1:4175';
const detail = '/student/lessons/10000000-0000-4000-8000-000000000001';
const home = '/student';
const calendar = '/student/lessons?view=calendar&month=2026-11';
const hero = (page) => page.locator('.k8k-lesson-hero');
const meet = (page) => page.locator('a[href^="https://meet.google.com/"]');
const reason = (scope, key) => scope.locator(`[data-reason="${key}"]`);
const patch = (request, data) => request.patch('/__fixture/state', { data });
const iso = (offset = 0) => new Date(Date.UTC(2026, 10, 7, 10, 0, 0) + offset).toISOString();
const snapshot = (changes) => ({ asOf: iso(), scheduledAt: iso(), ...changes });
const longName = 'Елена ' + 'ДлиннаяФамилия'.repeat(8).slice(0, 94);
const goto = (page, path) => page.goto(path + (path.includes('?') ? '&' : '?') + 'ui.k8k=1');
const calls = async (request) => (await (await request.get('/__fixture/state')).json()).calls;
const reads = async (request) =>
  (await calls(request)).filter(({ path }) => path === '/api/v1/student/dashboard').length;
const activate = (page, hidden = false) =>
  page.evaluate((hidden) => {
    Object.defineProperty(globalThis.document, 'visibilityState', {
      configurable: true,
      value: hidden ? 'hidden' : 'visible',
    });
    globalThis.document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);

async function setup({ request, context }, data = {}, locale = 'ru') {
  await request.post('/__fixture/reset', { data: { meetSnapshot: snapshot(), ...data } });
  await context.addCookies((await request.storageState()).cookies);
  await context.addInitScript((lang) => localStorage.setItem('k8k.locale', lang), locale);
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
  );
}

async function capture(page, name) {
  await page.evaluate(() => globalThis.document.fonts.ready);
  await page.screenshot({
    path: fileURLToPath(
      evidenceUrl(`../../../output/k8k-tasks/TASK-028/after/${name}.png`, import.meta.url),
    ),
    animations: 'disabled',
    fullPage: true,
  });
}

for (const locale of ['ru', 'ro']) {
  test('current lesson layout, focus and status ' + locale, async ({ page, request, context }) => {
    test.setTimeout(70_000);
    await setup(
      { request, context },
      {
        displayName: longName,
        meetSnapshot: snapshot({ teacherName: longName }),
        upcomingStatus: 'CANCELLED',
      },
      locale,
    );
    const ro = locale === 'ro';
    for (const width of [360, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: width === 360 ? 800 : 900 });
      for (const [name, path] of [
        ['hero', home],
        ['calendar', calendar],
        ['detail', detail],
      ]) {
        await goto(page, path);
        const scope = name === 'hero' ? hero(page) : page.locator('.lesson-row').first();
        const cta = meet(page);
        await expect(cta).toHaveCount(1);
        await expect(cta).toBeVisible();
        await expect(cta).toHaveText(ro ? 'Intră în Google Meet' : 'Войти в Google Meet');
        await expect(
          scope.getByText(ro ? 'Programată' : 'По расписанию', { exact: true }),
        ).toBeVisible();
        await expect(scope.getByText(longName, { exact: false })).toBeVisible();
        expect((await cta.boundingBox()).height).toBeGreaterThanOrEqual(48);
        expect(
          await page.evaluate(() => globalThis.document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        if (name === 'hero') {
          await expect(hero(page)).toContainText(ro ? 'Lecția a început' : 'Урок начался');
          await expect(hero(page).locator('.k8k-main-action')).toHaveCount(0);
        }
        if (width === 360) {
          await cta.focus();
          await page.keyboard.press('Tab');
          await page.keyboard.press('Shift+Tab');
          await expect(cta).toBeFocused();
          await page.evaluate(() => globalThis.scrollTo(0, 0));
        }
        await capture(page, `${locale}-${width}-${name}`);
      }
    }
  });
}

test('T−10 requests fresh capability after hidden tab and ignores Date.now skew', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context }, { meetSnapshot: snapshot({ asOf: iso(-601_000) }) });
  await page.clock.install();
  await goto(page, home);
  await expect(reason(hero(page), 'early')).toBeVisible();
  await page.clock.setSystemTime(new Date('2099-12-31'));
  await expect(meet(page)).toHaveCount(0);
  await activate(page, true);
  const before = await reads(request);
  await page.clock.runFor(1_500);
  await expect(meet(page)).toHaveCount(0);
  expect(await reads(request)).toBe(before);
  await patch(request, { meetSnapshot: snapshot({ asOf: iso(-600_000) }) });
  await activate(page);
  await expect(meet(page)).toBeVisible();
  expect(await reads(request)).toBeGreaterThan(before);
  await page.clock.setSystemTime(new Date('2200-01-01'));
  await page.clock.runFor(1_100);
  await expect(meet(page)).toBeVisible();
});

test('visible deadline refresh and invalid provider payload', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context }, { meetSnapshot: snapshot({ asOf: iso(-601_000) }) }, 'ro');
  await page.clock.install();
  await goto(page, home);
  await expect(reason(hero(page), 'early')).toBeVisible();
  const before = await reads(request);
  await patch(request, { meetSnapshot: snapshot({ asOf: iso(-600_000) }) });
  await page.clock.runFor(1_300);
  await expect(meet(page)).toBeVisible();
  expect(await reads(request)).toBeGreaterThan(before);

  await page.route(
    '**/api/v1/student/lessons/10000000-0000-4000-8000-000000000001',
    async (route) => {
      const response = await route.fetch();
      const data = await response.json();
      await route.fulfill({ response, json: { ...data, meetLink: 'https://meet.google.com/' } });
    },
  );
  await goto(page, detail);
  await expect(reason(page, 'noLink')).toBeVisible();
  await expect(meet(page)).toHaveCount(0);
  await capture(page, 'ro-1280-invalid-link');
});

test('expiry, revoked rights, other subject, reschedule, stale and forbidden', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context }, { meetSnapshot: snapshot({ asOf: iso(3_595_000) }) });
  await page.clock.install();
  await goto(page, home);
  await expect(meet(page)).toBeVisible();
  await patch(request, { meetSnapshot: snapshot({ asOf: iso(3_600_001) }) });
  await page.clock.runFor(5_050);
  await expect(meet(page)).toHaveCount(0);
  await expect(hero(page)).toContainText('Математика');

  await patch(request, {
    meetSnapshot: snapshot({ allowed: false, secondAt: iso(300_000), secondAllowed: true }),
  });
  await goto(page, calendar);
  const rows = page.locator('.lesson-row');
  await expect(reason(rows.first(), 'noLink')).toBeVisible();
  await expect(rows.first().locator('a[href^="https://meet.google.com/"]')).toHaveCount(0);
  await expect(rows.nth(1).locator('a[href^="https://meet.google.com/"]')).toBeVisible();
  await goto(page, detail);
  await expect(reason(page, 'noLink')).toBeVisible();
  await capture(page, 'ru-1280-no-link');

  await patch(request, { meetSnapshot: snapshot() });
  await goto(page, detail);
  await expect(meet(page)).toBeVisible();
  await patch(request, { meetError: 503 });
  await activate(page);
  await expect(reason(page, 'refresh')).toBeVisible();
  await expect(meet(page)).toHaveCount(0);
  await capture(page, 'ru-1280-stale');
  await patch(request, { meetError: 403 });
  await page.clock.runFor(1_100);
  await activate(page);
  await expect(page.locator('.lesson-row')).toHaveCount(0);
  await expect(meet(page)).toHaveCount(0);
  await capture(page, 'ru-1280-forbidden');

  await patch(request, { meetError: null, meetSnapshot: snapshot({ status: 'CANCELLED' }) });
  await goto(page, detail);
  await expect(reason(page, 'status')).toBeVisible();
  await expect(meet(page)).toHaveCount(0);
  await goto(page, home);
  await expect(hero(page)).toContainText('Математика');
  await patch(request, { meetSnapshot: snapshot({ scheduledAt: iso(1_200_000) }) });
  await activate(page);
  await expect(hero(page)).toContainText('Английский язык');
  await expect(reason(hero(page), 'early')).toBeVisible();
  await expect(meet(page)).toHaveCount(0);
});

test('keyboard Meet click opens the intercepted fixture and sends no command', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context });
  const navigations = [];
  await context.route('https://meet.google.com/**', (route) => {
    navigations.push(route.request().method());
    return route.fulfill({ status: 200, body: 'Intercepted local test response' });
  });
  await goto(page, home);
  const link = meet(page);
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  await link.focus();
  const popupPromise = page.waitForEvent('popup');
  await page.keyboard.press('Enter');
  const popup = await popupPromise;
  await expect(popup.getByText('Intercepted local test response')).toBeVisible();
  expect(navigations).toEqual(['GET']);
  expect((await calls(request)).filter(({ method }) => method !== 'GET')).toEqual([]);
});

import { expect, test } from './gate-fixtures.mjs';
import { evidenceUrl } from './gate-fixtures.mjs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { bellFixture, id, oldReport } from './bell-fixtures.mjs';
import { reportFixture } from './report-journey-fixtures.mjs';
import { anchors } from './k8k-subscriptions/data.mjs';
const require = createRequire(new URL('../../manager-web/package.json', import.meta.url));
const AxeBuilder = require('@axe-core/playwright').default;

const path = '/student?events=1&view=list&ui.k8k=1';
const state = async (request) => (await request.get('/__fixture/state')).json();
const patch = (request, data) => request.patch('/__fixture/state', { data });
const calls = async (request, suffix) =>
  (await state(request)).calls.filter((call) => call.path.endsWith(suffix));
const drawer = (page) => page.locator('.k8k-notification-drawer');
const rows = (page) => drawer(page).locator('[data-notification-id]');
async function setup({ request, context }, locale = 'ru', data = {}) {
  await request.post('/__fixture/reset', {
    data: { ...reportFixture(), ...bellFixture(), ...data },
  });
  await context.addCookies((await request.storageState()).cookies);
  await context.addInitScript((value) => localStorage.setItem('k8k.locale', value), locale);
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === 'http://127.0.0.1:4175'
      ? route.continue()
      : route.abort(),
  );
}
async function shot(page, name) {
  await page.evaluate(() => globalThis.document.fonts.ready);
  await page.screenshot({
    path: fileURLToPath(
      evidenceUrl('../../../output/k8k-tasks/TASK-033/after/' + name + '.png', import.meta.url),
    ),
    animations: 'disabled',
  });
}
const button = (page, name) => drawer(page).getByRole('button', { name, exact: true });
async function ready(page) {
  await expect(rows(page)).toHaveCount(5);
  await expect(button(page, 'Обновить события')).toBeEnabled();
  await expect(button(page, 'Прочитать все')).toBeEnabled();
}
test.afterEach(async ({ request }) => {
  expect((await state(request)).missingRoutes).toEqual([]);
});

for (const locale of ['ru', 'ro'])
  test(
    'TASK-033 bell pagination, global counters, layout and empty page ' + locale,
    async ({ page, request, context }) => {
      test.setTimeout(60_000);
      const ro = locale === 'ro';
      await setup({ request, context }, locale);
      for (const width of [360, 768, 1024, 1280]) {
        await patch(request, bellFixture());
        await page.setViewportSize({ width, height: width === 360 ? 800 : 900 });
        await page.goto(path);
        await expect(rows(page)).toHaveCount(5);
        await expect(drawer(page).locator('h2 span')).toBeFocused();
        await expect(drawer(page).locator('.k8k-notification-counts')).toContainText(/7.*12/);
        await expect(page.locator('.k8k-bell')).toHaveAttribute('aria-label', /7/);
        await expect(rows(page).first().locator('h3')).toHaveText(
          ro ? 'Raportul educațional este gata' : 'Образовательный отчёт готов',
        );
        await expect(rows(page).nth(4)).toContainText(
          'Salut! Это сообщение менеджера остаётся исходным.',
        );
        const box = await drawer(page).boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
        expect(box.y + box.height).toBeLessThanOrEqual((width === 360 ? 800 : 900) - 80);
        expect(
          (await button(page, ro ? 'Marchează toate ca citite' : 'Прочитать все').boundingBox())
            .height,
        ).toBeGreaterThanOrEqual(48);
        expect(
          await drawer(page)
            .locator('.k8k-notification-scroll')
            .evaluate((el) => el.scrollHeight > el.clientHeight),
        ).toBe(true);
        expect(await drawer(page).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
        await shot(page, `${locale}-${width}-page1`);
        if (width === 360) {
          const result = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
            .analyze();
          writeFileSync(
            fileURLToPath(
              evidenceUrl(
                '../../../output/k8k-tasks/TASK-033/axe-' + locale + '.json',
                import.meta.url,
              ),
            ),
            JSON.stringify(
              {
                locale,
                route: path,
                viewport: { width, height: 800 },
                violations: result.violations,
                passes: result.passes.map(({ id }) => id),
              },
              null,
              2,
            ),
          );
          expect(
            result.violations.map(({ id, nodes }) => ({
              id,
              targets: nodes.map(({ target }) => target),
            })),
          ).toEqual([]);
        }
        await drawer(page).locator('.pager button').last().click();
        await expect(rows(page).first()).toHaveAttribute('data-notification-id', id(6));
        await expect(drawer(page).locator('.k8k-notification-counts')).toContainText(/7.*12/);
        expect(await rows(page).first().locator('.preserve-lines').textContent()).toBe(
          '  Готовый текст без template key/params\n  не переводится.',
        );
        await expect(rows(page).getByRole('button')).toHaveCount(0);
        await shot(page, `${locale}-${width}-page2`);
        await patch(request, { notificationRows: bellFixture().notificationRows.slice(0, 5) });
        await button(page, ro ? 'Actualizează evenimentele' : 'Обновить события').click();
        await expect(rows(page)).toHaveCount(0);
        await expect(drawer(page).locator('.k8k-notification-counts')).toContainText(/5.*5/);
        await expect(
          drawer(page).getByText(
            ro ? 'Nu există evenimente pe această pagină.' : 'На этой странице событий нет.',
          ),
        ).toBeVisible();
        await shot(page, `${locale}-${width}-empty-page`);
        await button(page, ro ? 'La prima pagină' : 'К первой странице').click();
        await expect(rows(page)).toHaveCount(5);
        await page.keyboard.press('Escape');
        await expect(drawer(page)).toHaveCount(0);
        await expect(page.locator('.k8k-bell')).toBeFocused();
        expect(new URL(page.url()).searchParams.has('events')).toBe(false);
        expect(new URL(page.url()).searchParams.get('view')).toBe('list');
      }
      expect(
        (await calls(request, '/student/notifications')).every(
          (call) => new URLSearchParams(call.query).get('locale') === locale,
        ),
      ).toBe(true);
    },
  );

test('TASK-033 closed preview, loading, page cancellation and outside close', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context });
  await page.clock.install();
  await page.goto('/student?view=list&ui.k8k=1');
  await expect(page.locator('.k8k-bell')).toHaveAttribute('aria-label', /7/);
  expect(await calls(request, '/student/notifications')).toHaveLength(0);
  await page.clock.runFor(65_000);
  expect(await calls(request, '/student/notifications')).toHaveLength(0);
  expect((await calls(request, '/notifications/count')).length).toBeGreaterThanOrEqual(1);
  await patch(request, { notificationsDelay: 1200 });
  await page.locator('.k8k-bell').click();
  await expect(drawer(page)).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
  await expect(drawer(page).getByText('Событий пока нет.', { exact: true })).toHaveCount(0);
  await expect(rows(page)).toHaveCount(5);
  await drawer(page).locator('.pager button').last().click();
  await expect(rows(page)).toHaveCount(0);
  await page.keyboard.press('Escape');
  const count = (await calls(request, '/student/notifications')).length;
  await page.clock.runFor(65_000);
  expect(await calls(request, '/student/notifications')).toHaveLength(count);
  await expect(drawer(page)).toHaveCount(0);
  await patch(request, { notificationsDelay: 0 });
  await page.locator('.k8k-bell').click();
  await expect(rows(page).first()).toHaveAttribute('data-notification-id', id(6));
  await page.mouse.click(5, 200);
  await expect(drawer(page)).toHaveCount(0);
  await expect(page.locator('.k8k-bell')).toBeFocused();
});

test('TASK-033 unknown read-all retries same key without consuming a concurrent arrival', async ({
  page,
  request,
  context,
}) => {
  const arriving = {
    ...bellFixture().notificationRows[0],
    notificationId: id(99),
    title: 'Новое событие после команды',
  };
  await setup({ request, context }, 'ru', {
    afterReadAllEvent: arriving,
    loseNotificationReadResponse: true,
  });
  await page.goto(path);
  await ready(page);
  await button(page, 'Прочитать все').evaluate((el) => {
    el.click();
    el.click();
  });
  await expect(button(page, 'Повторить ту же отметку')).toBeDisabled();
  await expect(button(page, 'Прочитать все')).toBeDisabled();
  expect(await calls(request, '/notifications/read-all')).toHaveLength(1);
  const first = (await state(request)).notificationRows.find(
    (row) => row.notificationId === id(1),
  ).readAt;
  await shot(page, 'ru-unknown-read-all');
  await button(page, 'Проверить отметку').click();
  await expect(button(page, 'Повторить ту же отметку')).toBeEnabled();
  await expect(drawer(page).locator('.k8k-notification-counts')).toContainText(/1.*13/);
  await button(page, 'Повторить ту же отметку').click();
  await expect(button(page, 'Прочитать все')).toBeEnabled();
  await expect(page.locator('.k8k-bell')).toHaveAttribute('aria-label', /1/);
  const writes = await calls(request, '/notifications/read-all');
  expect(writes).toHaveLength(2);
  expect(writes[0].key).toBe(writes[1].key);
  expect(writes.every((call) => call.csrf && Object.keys(call.body).length === 0)).toBe(true);
  const after = await state(request);
  expect(after.notificationRows.find((row) => row.notificationId === id(1)).readAt).toBe(first);
  expect(after.notificationRows.find((row) => row.notificationId === id(99)).isRead).toBe(false);
  await button(page, 'Прочитать все').click();
  await expect(button(page, 'Прочитать все')).toBeDisabled();
  await expect(drawer(page).locator('.k8k-notification-counts')).toContainText(/0.*13/);
  expect((await calls(request, '/notifications/read-all'))[2].key).not.toBe(writes[0].key);
  await drawer(page).locator('.pager button').last().click();
  await expect(rows(page)).toHaveCount(5);
  await expect(rows(page).getByRole('button')).toHaveCount(0);
  await expect(drawer(page).locator('.k8k-notification-counts')).toContainText(/0.*13/);
});

test('TASK-033 lesson, homework and financial subscription targets use existing detail reads', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context });
  for (const index of [2, 1, 3]) {
    await page.goto(path);
    await ready(page);
    const target = rows(page).nth(index).getByRole('link');
    const href = await target.getAttribute('href');
    if (index === 3) expect(href).toBe('/student/subscription?subscriptionId=' + anchors.math);
    await target.click();
    await expect(drawer(page)).toHaveCount(0);
    await expect(page).toHaveURL('http://127.0.0.1:4175' + href);
    if (index === 3) {
      await expect(
        page.locator('.k8k-subscription-access').getByText('Доступ ограничен', { exact: true }),
      ).toBeVisible();
      expect(
        (await calls(request, '/student/subscription')).some(
          (call) => new URLSearchParams(call.query).get('subscriptionId') === anchors.math,
        ),
      ).toBe(true);
    } else {
      const suffix =
        index === 2
          ? '/lessons/10000000-0000-4000-8000-000000000001'
          : '/homework/20000000-0000-4000-8000-000000000001';
      await expect.poll(async () => (await calls(request, suffix)).length).toBeGreaterThan(0);
    }
  }
  expect(
    (await state(request)).calls.filter(
      (call) => call.method !== 'GET' && call.path.startsWith('/api/v1/student/'),
    ),
  ).toEqual([]);
});

test('TASK-033 individual read and old report target keep report read command separate', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context });
  await page.goto(path);
  await ready(page);
  await rows(page)
    .first()
    .getByRole('button', { name: 'Отметить прочитанным', exact: true })
    .click();
  await expect(drawer(page).locator('.k8k-notification-counts')).toContainText(/6.*12/);
  const write = (await calls(request, '/' + id(1) + '/read'))[0];
  expect(write.method).toBe('PATCH');
  expect(write.csrf).toBeTruthy();
  expect(write.body).toEqual({});
  await rows(page).first().getByRole('link').click();
  await expect(page).toHaveURL(new RegExp('reportId=' + oldReport));
  await expect(
    page.getByRole('heading', { name: 'Отчёт старше первой страницы', exact: true }),
  ).toBeFocused();
  await expect(drawer(page)).toHaveCount(0);
  expect(await calls(request, '/student/reports')).toHaveLength(0);
  expect(await calls(request, '/' + oldReport + '/read')).toHaveLength(0);
  await expect(
    page.locator('.k8k-report').getByRole('button', { name: 'Я прочитал(а)', exact: true }),
  ).toBeEnabled();
});

test('TASK-033 stale, unavailable counter and empty feed remain distinct', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context });
  await page.goto(path);
  await ready(page);
  await patch(request, { previewError: 503, countError: 503 });
  await button(page, 'Обновить события').click();
  await expect(drawer(page).getByRole('alert')).toBeVisible();
  await expect(rows(page)).toHaveCount(5);
  await expect(button(page, 'Прочитать все')).toBeDisabled();
  await expect(drawer(page).getByText('Счётчик сейчас недоступен.')).toBeVisible();
  await expect(page.locator('.k8k-bell')).not.toHaveAttribute('aria-label', /, 0/);
  await shot(page, 'ru-stale-counter-unavailable');
  await patch(request, { previewError: 0, countError: 0, notificationRows: [] });
  await button(page, 'Обновить события').click();
  await expect(drawer(page).getByText('Событий пока нет.', { exact: true })).toBeVisible();
  await expect(drawer(page).locator('.k8k-notification-counts')).toContainText(/0.*0/);
  await shot(page, 'ru-empty-feed');
});

test('TASK-033 strict targets and scoped report forbid prevent unsafe navigation', async ({
  page,
  request,
  context,
}) => {
  const notificationRows = bellFixture()
    .notificationRows.slice(0, 4)
    .map((row, i) => ({
      ...row,
      payload: [
        { reportId: 'javascript:alert(1)', url: 'https://private.invalid/' },
        { reportId: oldReport, lessonId: id(15) },
        { lessonId: 'broken', url: '/student/reports?reportId=' + oldReport },
        { subscriptionId: null },
      ][i],
    }));
  await setup({ request, context }, 'ru', { notificationRows });
  await page.goto(path);
  await expect(rows(page)).toHaveCount(4);
  await expect(drawer(page).locator('li a')).toHaveCount(0);
  await patch(request, { notificationRows: bellFixture().notificationRows });
  for (const status of [403, 404]) {
    await patch(request, { reportError: status });
    await page.goto(path);
    await ready(page);
    const response = page.waitForResponse((value) =>
      value.url().endsWith('/student/reports/' + oldReport),
    );
    await rows(page).first().getByRole('link').click();
    expect((await response).status()).toBe(status);
    await expect(page.locator('.k8k-report')).toHaveCount(0);
    await expect(page.getByText('Отчёт старше первой страницы', { exact: true })).toHaveCount(0);
  }
  expect(await calls(request, '/student/reports')).toHaveLength(0);
  expect(await calls(request, '/' + oldReport + '/read')).toHaveLength(0);
});

test('TASK-033 count403 cancels a late preview and hides cached private rows', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context });
  await page.goto(path);
  await ready(page);
  let release,
    finish,
    intercepted = false;
  const gate = new Promise((done) => {
    release = done;
  });
  const finished = new Promise((done) => {
    finish = done;
  });
  await page.route('**/api/v1/student/notifications?*', async (pending) => {
    intercepted = true;
    await gate;
    await pending
      .fulfill({
        json: {
          items: bellFixture().notificationRows.slice(0, 5),
          page: 1,
          pageSize: 5,
          total: 12,
          unreadCount: 7,
        },
      })
      .catch(() => undefined);
    finish();
  });
  await patch(request, { countError: 403 });
  await button(page, 'Обновить события').click();
  await expect.poll(() => intercepted).toBe(true);
  await expect(rows(page)).toHaveCount(0);
  release();
  await finished;
  await expect(rows(page)).toHaveCount(0);
  await expect(button(page, 'Прочитать все')).toBeDisabled();
  await shot(page, 'ru-forbidden');
});

test('TASK-033 legacy URL, reload, locale replacement and short keyboard drawer', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context });
  await page.setViewportSize({ width: 360, height: 560 });
  await page.goto('/student/notifications?subjectId=' + id(20) + '&ui.k8k=1');
  await expect(page).toHaveURL(/\/student\?.*events=1/);
  await ready(page);
  await page.evaluate(() => {
    localStorage.setItem('k8k.locale', 'ro');
    globalThis.dispatchEvent(
      new globalThis.StorageEvent('storage', {
        key: 'k8k.locale',
        newValue: 'ro',
        storageArea: localStorage,
      }),
    );
  });
  await expect(rows(page).first().locator('h3')).toHaveText('Raportul educațional este gata');
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab');
    expect(
      await drawer(page).evaluate((el) => el.contains(globalThis.document.activeElement)),
    ).toBe(true);
  }
  expect(
    await drawer(page)
      .locator('.k8k-notification-scroll')
      .evaluate((el) => el.clientHeight),
  ).toBeGreaterThan(0);
  await shot(page, 'ro-360-short-keyboard');
  await page.keyboard.press('Escape');
  expect(new URL(page.url()).searchParams.get('subjectId')).toBe(id(20));
  await expect(page.locator('.k8k-bell')).toBeFocused();
  await page.reload();
  await expect(drawer(page)).toHaveCount(0);
  await page.goto('/student/homework?ui.k8k=1');
  await page.goBack();
  await expect(drawer(page)).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe('/student');
  await page.locator('.k8k-bell').focus();
  await page.keyboard.press('Enter');
  await expect(rows(page)).toHaveCount(5);
});

for (const action of ['logout', 'switch'])
  test('TASK-033 late preview discarded after ' + action, async ({ page, request, context }) => {
    await setup({ request, context }, 'ru', {
      demoContacts: true,
      demoAlternate: { displayName: 'Даниил', userId: '50000000-0000-4000-8000-000000000003' },
    });
    await page.goto('/student?ui.k8k=1');
    let release,
      finish,
      intercepted = false;
    const gate = new Promise((done) => {
      release = done;
    });
    const finished = new Promise((done) => {
      finish = done;
    });
    await page.route('**/api/v1/student/notifications?*', async (pending) => {
      intercepted = true;
      await gate;
      await pending
        .fulfill({
          json: {
            items: bellFixture().notificationRows,
            page: 1,
            pageSize: 5,
            total: 12,
            unreadCount: 7,
          },
        })
        .catch(() => undefined);
      finish();
    });
    await page.locator('.k8k-bell').click();
    await expect.poll(() => intercepted).toBe(true);
    await page.keyboard.press('Escape');
    const second = action === 'switch' ? await context.newPage() : page;
    if (action === 'switch') await second.goto('/student?ui.k8k=1');
    await second.locator('.account-menu > summary').click();
    await second
      .getByRole('button', {
        name: action === 'switch' ? /Демо Даниил/ : 'Выйти из аккаунта',
        exact: action !== 'switch',
      })
      .click();
    await expect(page).toHaveURL(action === 'switch' ? 'http://127.0.0.1:4175/' : /login/);
    release();
    await finished;
    await expect(rows(page)).toHaveCount(0);
    await expect(page.getByText('Образовательный отчёт готов', { exact: true })).toHaveCount(0);
    if (second !== page) await second.close();
  });

import { expect, test } from '@playwright/test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../../manager-web/package.json', import.meta.url));
const AxeBuilder = require('@axe-core/playwright').default;
const evidence = new URL('../../../output/k8k-tasks/TASK-025/', import.meta.url);
const widths = [360, 768, 1024, 1280];
const longName = 'Синтетическое имя ' + 'ДлиннаяФамилия'.repeat(7).slice(0, 82);

async function start({ request, context, page }, locale, state = {}) {
  await request.post('/__fixture/reset', { data: { displayName: longName, ...state } });
  await context.addCookies((await request.storageState()).cookies);
  await page.addInitScript((lang) => globalThis.localStorage.setItem('k8k.locale', lang), locale);
  const origin = 'http://127.0.0.1:4175';
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
  );
}

const screenshot = async (page, name) => {
  await page.evaluate(() => globalThis.document.fonts.ready);
  await page.screenshot({ path: fileURLToPath(new URL(name, evidence)), animations: 'disabled' });
};

for (const locale of ['ru', 'ro']) {
  test(`subject-baseline ${locale}`, async ({ request, context, page }) => {
    await start({ request, context, page }, locale);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/student?ui.k8k=1');
      await expect(page.locator('.k8k-lesson-hero')).toBeVisible();
      await expect(page.locator('.k8k-main h1')).toContainText(longName);
      await screenshot(page, `baseline/${locale}-${width}-home.png`);
      if (width < 1024) await page.locator('.k8k-menu-button').click();
      await screenshot(page, `baseline/${locale}-${width}-menu.png`);
    }
  });
}
const englishId = '60000000-0000-4000-8000-000000000001';
const mathId = '60000000-0000-4000-8000-000000000002';
const foreignId = '60000000-0000-4000-8000-000000000099';
const periodId = '61000000-0000-4000-8000-000000000001';
const hub = '/student/subjects';
const paths = [
  '/student',
  '/student/lessons',
  '/student/homework',
  hub,
  '/student/skills',
  '/student/help',
];
const subjectUrl = (id) => hub + '?subjectId=' + id;
const state = async (request) => (await request.get('/__fixture/state')).json();
const patch = (request, data) => request.patch('/__fixture/state', { data });
const card = (page, title) =>
  page
    .locator('.k8k-subject-card')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) });
const noOverflow = async (page) => {
  expect(
    await page.evaluate(() => globalThis.document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize().width);
};
async function checkAccessibility(page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) })),
  ).toEqual([]);
}

for (const locale of ['ru', 'ro']) {
  test(
    'subject-hub visual matrix and touch targets ' + locale,
    async ({ request, context, page }) => {
      test.setTimeout(65_000);
      await start({ request, context, page }, locale, { subjectHub: true });
      const ro = locale === 'ro';
      expect(longName).toHaveLength(100);
      for (const width of widths) {
        await page.setViewportSize({ width, height: width === 360 ? 800 : 900 });
        await page.goto('/student?ui.k8k=1');
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        await expect(page.locator('main h1')).toHaveText(
          (ro ? 'Salut' : 'Привет') + ', ' + longName + '!',
        );
        const primary = page
          .getByRole('link', {
            name: ro ? 'Intră în Google Meet' : 'Войти в Google Meet',
            exact: true,
          })
          .first();
        await expect(primary).toBeVisible();
        expect((await primary.boundingBox()).height).toBeGreaterThanOrEqual(48);
        await expect(page.locator('.k8k-student-shortcuts a')).toHaveCount(2);
        await expect(card(page, 'Математика')).toBeVisible();
        await noOverflow(page);
        if (width < 1024) {
          const bottom = page.locator('.k8k-bottom-nav');
          await expect(bottom).toBeVisible();
          expect(
            (await primary.boundingBox()).y + (await primary.boundingBox()).height,
          ).toBeLessThan((await bottom.boundingBox()).y);
        }
        await screenshot(page, 'after/' + locale + '-' + width + '-home.png');
        if (width === 360) await checkAccessibility(page);
        await page.goto(hub);
        await expect(card(page, 'Английский язык')).toBeVisible();
        await expect(page.locator('main h1')).toHaveText(ro ? 'Materiile mele' : 'Мои предметы');
        await noOverflow(page);
        for (const link of await page.locator('.k8k-subject-card a').all())
          expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
        await screenshot(page, 'after/' + locale + '-' + width + '-subjects.png');
        if (width === 360) await checkAccessibility(page);
        await page.goto('/student/help');
        await expect(page.locator('main h1')).toHaveText(ro ? 'Ajutor' : 'Помощь');
        await expect(page.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute(
          'href',
          'https://wa.me/37360000001',
        );
        await expect(page.getByRole('link', { name: 'Telegram' })).toHaveAttribute(
          'href',
          'https://t.me/academy_manager',
        );
        await noOverflow(page);
        await screenshot(page, 'after/' + locale + '-' + width + '-help.png');
        if (width === 360) await checkAccessibility(page);
      }
    },
  );
}

for (const width of [360, 1280]) {
  test(
    'subject-hub six menu destinations and active state at ' + width,
    async ({ request, context, page }) => {
      await start({ request, context, page }, 'ru', { subjectHub: true });
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/student?ui.k8k=1');
      const mobile = width === 360;
      const nav = page.locator(mobile ? '.k8k-mobile-menu nav' : '.k8k-sidebar nav');
      const trigger = page.locator('.k8k-menu-button');
      await expect(nav.locator('a')).toHaveCount(paths.length);
      for (const path of paths) {
        if (mobile) await trigger.click();
        expect(
          await nav
            .locator('a')
            .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href'))),
        ).toEqual(paths);
        await nav.locator('a[href="' + path + '"]').click();
        await expect(page).toHaveURL('http://127.0.0.1:4175' + path);
        if (mobile) await trigger.click();
        await expect(nav.locator('[aria-current="page"]')).toHaveAttribute('href', path);
        if (mobile) await page.keyboard.press('Escape');
      }
      const account = page.locator('.account-menu');
      await account.locator('summary').click();
      await account.getByRole('link', { name: 'Профиль', exact: true }).click();
      await expect(page).toHaveURL(/\/student\/profile$/);
      await account.locator('summary').click();
      await account.getByRole('link', { name: 'Безопасность', exact: true }).click();
      await expect(page).toHaveURL(/\/student\/security$/);
    },
  );
}

test('subject-hub independent permissions and scoped reads reject foreign or repeated selectors', async ({
  request,
  context,
  page,
}) => {
  await start({ request, context, page }, 'ru', { subjectHub: true, expiredSubject: true });
  const subjectsResponse = page.waitForResponse('**/api/v1/student/subjects');
  await page.goto(hub + '?ui.k8k=1');
  expect((await subjectsResponse).headers()['cache-control']).toContain('no-store');
  const english = card(page, 'Английский язык');
  const math = card(page, 'Математика');
  await expect(english.getByText('Активен', { exact: true })).toBeVisible();
  await expect(english.getByRole('link', { name: 'Открыть расписание' })).toBeVisible();
  await expect(math.getByText('Истёк', { exact: true })).toBeVisible();
  await expect(math.getByRole('link', { name: 'Материалы' })).toBeVisible();
  await expect(math.locator('a[href*="/lessons"]')).toHaveCount(0);
  await math.getByRole('link', { name: 'Открыть предмет' }).click();
  await expect(page).toHaveURL(new RegExp('subjectId=' + mathId));
  await expect(page.locator('.k8k-subject-card')).toHaveCount(1);
  await expect(math.locator('a[href*="/homework"]')).toHaveCount(0);
  await math.getByRole('link', { name: 'Материалы' }).click();
  await expect(page.getByRole('heading', { name: 'Алгебра.pdf' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Словарь/ })).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp('subjectId=' + mathId));
  await page.getByRole('link', { name: 'К предмету' }).click();
  await math.getByRole('link', { name: 'Мой путь знаний' }).click();
  await expect(page.getByRole('heading', { name: 'Математика' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Английский язык' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Все срезы навыков' })).toBeVisible();
  const readCalls = (await state(request)).calls;
  expect(readCalls).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        path: '/api/v1/student/materials',
        query: '?page=1&subjectId=' + mathId,
      }),
      expect.objectContaining({ path: '/api/v1/student/skills', query: '?subjectId=' + mathId }),
    ]),
  );
  expect(readCalls.some((call) => call.path.endsWith('/skills/snapshots'))).toBe(false);
  await page.getByRole('link', { name: 'К предмету' }).click();
  await page.getByRole('link', { name: 'Все предметы' }).click();
  await english.getByRole('link', { name: 'Открыть предмет' }).click();
  await english.getByRole('link', { name: 'Условия абонемента' }).click();
  await expect(page).toHaveURL(new RegExp('/subscription\\?subscriptionId=' + periodId));
  await expect(page.getByRole('heading', { name: 'Абонемент', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'К предмету' }).click();
  await expect(english).toBeVisible();
  // Exercise the rejected selector in the same running router with an own response already cached.
  await page.getByRole('link', { name: 'Все предметы' }).evaluate((_, url) => {
    // Supply a location change to the running router without reloading its query cache.
    globalThis.history.pushState({ ...globalThis.history.state, key: 'foreign-selection' }, '', url);
    globalThis.window.dispatchEvent(
      new globalThis.PopStateEvent('popstate', { state: globalThis.history.state }),
    );
  }, subjectUrl(foreignId));
  await expect(page.locator('.k8k-subject-page [data-state=forbidden]')).toBeVisible();
  await expect(page.locator('.k8k-subject-card')).toHaveCount(0);
  for (const route of ['/student/materials', '/student/skills', hub]) {
    await page.goto(route + '?subjectId=' + foreignId);
    await expect(page.locator('main [data-state=forbidden]')).toBeVisible();
  }
  await page.goto(subjectUrl(englishId) + '&subjectId=' + mathId);
  await expect(page.locator('main [data-state=forbidden]')).toBeVisible();
  await page.goto(subjectUrl('not-a-uuid'));
  await expect(page.locator('main [data-state=forbidden]')).toBeVisible();
  expect((await state(request)).calls.some((call) => call.query.includes(foreignId))).toBe(false);
});

test('subject-hub separates loading, empty, error, stale and revocation', async ({
  request,
  context,
  page,
}) => {
  await start({ request, context, page }, 'ro', {
    subjectHub: true,
    subjectDelay: 800,
    subjectEmpty: true,
  });
  const main = page.locator('main');
  await page.goto(hub + '?ui.k8k=1');
  await expect(main.locator('[data-state=loading]')).toBeVisible();
  await expect(main.locator('[data-state=empty]')).toHaveCount(0);
  await screenshot(page, 'states/ro-loading.png');
  await expect(main.locator('[data-state=empty]')).toContainText('Încă nu ai materii atribuite.');
  await screenshot(page, 'states/ro-empty.png');
  await patch(request, { subjectDelay: 0, subjectEmpty: false, subjectError: 503 });
  await page.reload();
  await expect(main.locator('[data-state=error]')).toBeVisible();
  await expect(main.locator('.k8k-subject-card')).toHaveCount(0);
  await screenshot(page, 'states/ro-error.png');
  await patch(request, { subjectError: 0 });
  await page.getByRole('button', { name: 'Reîncearcă încărcarea' }).click();
  const names = page.locator('.k8k-subject-card h2');
  await expect(names).toHaveText(['Английский язык', 'Математика']);
  const link = card(page, 'Математика').getByRole('link', { name: 'Deschide materia' });
  await link.focus();
  await patch(request, { subjectError: 503 });
  await page.evaluate(() => globalThis.window.dispatchEvent(new Event('online')));
  await expect(main.locator('[data-state=stale]')).toBeVisible();
  await expect(link).toBeFocused();
  await expect(names).toHaveText(['Английский язык', 'Математика']);
  await screenshot(page, 'states/ro-stale.png');
  await patch(request, { subjectError: 403 });
  await main.getByRole('button', { name: 'Reîncearcă încărcarea' }).click();
  await expect(main.locator('[data-state=forbidden]')).toBeVisible();
  await expect(names).toHaveCount(0);
  await screenshot(page, 'states/ro-forbidden.png');
});

test('subject-hub homework context, scroll, guard and saved draft', async ({
  request,
  context,
  page,
}) => {
  await start({ request, context, page }, 'ru', { subjectHub: true, draftDelay: 800 });
  await page.setViewportSize({ width: 360, height: 620 });
  await page.goto(subjectUrl(englishId) + '&ui.k8k=1');
  const action = page.getByRole('link', { name: 'Все задания', exact: true });
  await action.scrollIntoViewIfNeeded();
  await page.evaluate(() => globalThis.window.scrollBy(0, 170));
  const position = await page.evaluate(() => globalThis.scrollY);
  expect(position).toBeGreaterThan(0);
  await action.click();
  await expect(page).toHaveURL(new RegExp('/homework\\?fromSubjectId=' + englishId));
  await page.getByRole('link', { name: /Present Perfect/ }).click();
  const editor = page.getByLabel('Твой ответ');
  await editor.fill('Синтетический черновик');
  await page.getByRole('link', { name: 'К предмету' }).click();
  const dialog = page.getByRole('dialog', { name: 'Черновик ещё не сохранён' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Остаться' })).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'К предмету' })).toBeFocused();
  await expect(editor).toHaveValue('Синтетический черновик');
  await expect.poll(async () => (await state(request)).draft).toBe('Синтетический черновик');
  await expect(page.getByText('Черновик сохранён', { exact: true })).toBeVisible();
  await page.goBack();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp('subjectId=' + englishId));
  await expect.poll(() => page.evaluate(() => globalThis.scrollY)).toBe(position);
  await action.click();
  await page.getByRole('link', { name: /Present Perfect/ }).click();
  await expect(editor).toHaveValue('Синтетический черновик');
  await page.getByRole('link', { name: 'К предмету' }).click();
  await expect(page).toHaveURL(new RegExp('/subjects\\?subjectId=' + englishId + '$'));
  await expect.poll(() => page.evaluate(() => globalThis.scrollY)).toBe(position);
  expect(
    (await state(request)).calls
      .filter((call) => call.path.endsWith('/student/homework'))
      .every((call) => !/subjectId/i.test(call.query)),
  ).toBe(true);
});

test('subject-hub keyboard, focus on refresh, and safe absent contacts', async ({
  request,
  context,
  page,
}) => {
  await start({ request, context, page }, 'ru', {
    subjectHub: true,
    managerContacts: { whatsapp: null, telegram: null },
  });
  await page.setViewportSize({ width: 360, height: 720 });
  await page.goto(hub + '?ui.k8k=1');
  const skip = page.getByRole('link', { name: 'Перейти к содержимому' });
  await skip.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  const trigger = page.locator('.k8k-bottom-nav button');
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.k8k-mobile-menu nav a').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  const focus = card(page, 'Математика').getByRole('link', { name: 'Открыть предмет' });
  await focus.focus();
  await page.evaluate(() => globalThis.window.scrollBy(0, 30));
  const scroll = await page.evaluate(() => globalThis.scrollY);
  await patch(request, { expiredSubject: true });
  await page.evaluate(() => globalThis.window.dispatchEvent(new Event('online')));
  await expect(card(page, 'Математика').getByText('Истёк', { exact: true })).toBeVisible();
  await expect(focus).toBeFocused();
  await expect(page.locator('.k8k-subject-card h2')).toHaveText(['Английский язык', 'Математика']);
  expect(await page.evaluate(() => globalThis.scrollY)).toBe(scroll);
  const previousCalls = (await state(request)).calls.length;
  await page.goto('/student/help');
  await expect(page.getByText(/Контакты пока не указаны/)).toBeVisible();
  await expect(page.locator('main a[href^="https:"], main a[href^="tel:"]')).toHaveCount(0);
  const helpReads = (await state(request)).calls.slice(previousCalls).map(({ path }) => path);
  expect(helpReads).toContain('/api/v1/student/me');
  expect(helpReads.some((path) => /\/(subjects|dashboard)$/.test(path))).toBe(false);
});

for (const [guard, flags, destination] of [
  ['401', { auth: false }, /\/student\/login$/],
  ['402', { meSuspended: true }, /\/student\/suspended$/],
  ['403', { meForbidden: true }, null],
  ['first password', { mustChangePassword: true }, /\/student\/security\/change-password$/],
]) {
  test('subject-hub protected entrypoints ' + guard, async ({ request, context, page }) => {
    await start({ request, context, page }, 'ru', flags);
    for (const route of [hub, '/student/help']) {
      await page.goto(route + '?ui.k8k=1');
      if (destination) await expect(page).toHaveURL(destination);
      else await expect(page.locator('main [data-state=forbidden]')).toBeVisible();
      await expect(page.locator('.k8k-subject-card')).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Помощь', exact: true })).toHaveCount(0);
    }
    expect(
      (await state(request)).calls.some((call) => call.path.endsWith('/student/subjects')),
    ).toBe(false);
  });
}

test('subject-hub legacy notifications still opens the K8K bell', async ({
  request,
  context,
  page,
}) => {
  await start({ request, context, page }, 'ru');
  await page.goto('/student/notifications?ui.k8k=1');
  await expect(page).toHaveURL(/\/student\?events=1$/);
  const bell = page.locator('.k8k-notification-menu');
  await expect(bell).toHaveAttribute('open', '');
  await expect(bell.getByText('Преподаватель проверил работу')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(bell.locator('summary')).toBeFocused();
  await expect(bell).not.toHaveAttribute('open');
});

test('subject-hub main action opens the lesson while Meet eligibility is false', async ({
  request,
  context,
  page,
}) => {
  await start({ request, context, page }, 'ro', { canJoin: false });
  await page.goto('/student?ui.k8k=1');
  const hero = page.locator('.k8k-lesson-hero');
  await expect(hero.locator('a[href*="meet.google.com"]')).toHaveCount(0);
  const action = hero.getByRole('link', { name: 'Deschide lecția' });
  await expect(action).toHaveClass('k8k-main-action');
  expect((await action.boundingBox()).height).toBeGreaterThanOrEqual(48);
  await action.click();
  await expect(page).toHaveURL(/\/student\/lessons\/[0-9a-f-]+$/);
});

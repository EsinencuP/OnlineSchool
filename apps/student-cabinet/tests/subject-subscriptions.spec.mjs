import { expect, test } from './gate-fixtures.mjs';
import { evidenceUrl } from './gate-fixtures.mjs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { anchors, subjectIds } from './k8k-subscriptions/data.mjs';

const require = createRequire(new URL('../../manager-web/package.json', import.meta.url));
const AxeBuilder = require('@axe-core/playwright').default;
const root = evidenceUrl('../../../output/k8k-tasks/TASK-026/', import.meta.url);
const origin = 'http://127.0.0.1:4175';
const subscription = (id) => '/student/subscription?subscriptionId=' + id;
const hub = (id) => '/student/subjects?subjectId=' + id;
const state = async (request) => (await request.get('/__fixture/state')).json();
const patch = (request, data) => request.patch('/__fixture/state', { data });
const panel = (page, label) =>
  page
    .locator('main .panel')
    .filter({ has: page.getByRole('heading', { name: label, exact: true }) });
const row = (scope, label) =>
  scope.getByText(label, { exact: true }).locator('xpath=following-sibling::dd[1]');
const screenshot = (page, name, fullPage = false) =>
  page.screenshot({ path: fileURLToPath(new URL(name, root)), fullPage, animations: 'disabled' });

async function setup({ request, context, page }, locale = 'ru', flags = {}) {
  await request.post('/__fixture/reset', {
    data: { subscriptionScenario: 'ready', timeZone: 'America/New_York', ...flags },
  });
  await context.addCookies((await request.storageState()).cookies);
  await page.addInitScript((lang) => globalThis.localStorage.setItem('k8k.locale', lang), locale);
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
  );
}

async function layout(page, width) {
  await page.evaluate(() => globalThis.document.fonts.ready);
  expect(
    await page.evaluate(() => globalThis.document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(width);
  if (width === 360) {
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(
      violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) })),
    ).toEqual([]);
  }
}

for (const locale of ['ru', 'ro']) {
  test('subscriptions visual matrix ' + locale, async ({ request, context, page }) => {
    test.setTimeout(65_000);
    await setup({ request, context, page }, locale, {
      displayName: 'Имя ' + 'Д'.repeat(96),
      canJoin: false,
    });
    const ro = locale === 'ro';
    for (const width of [360, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: width === 360 ? 800 : 900 });
      await page.goto('/student?ui.k8k=1');
      const overview = page.locator('[data-module="DASH-STU-05"]');
      await expect(
        overview.getByRole('heading', {
          name: ro ? 'Abonamente pe materii' : 'Абонементы по предметам',
        }),
      ).toBeVisible();
      await expect(overview.locator('.k8k-subscription-summary')).toHaveCount(3);
      await layout(page, width);
      await screenshot(page, 'after/' + locale + '-' + width + '-dashboard.png', true);

      await page.goto(hub(subjectIds.english));
      const card = page.locator('.k8k-subject-card');
      await expect(
        card.getByText(ro ? 'Suspendat până la' : 'Заморожен до', { exact: true }),
      ).toBeVisible();
      const detailLink = card.getByRole('link', {
        name: ro ? 'Detalii despre abonament' : 'Условия абонемента',
      });
      expect((await detailLink.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await layout(page, width);
      await screenshot(page, 'after/' + locale + '-' + width + '-hub.png', true);

      await detailLink.click();
      await expect(page).toHaveURL(new RegExp('subscriptionId=' + anchors.english));
      await expect(
        page.getByRole('heading', { name: ro ? 'Plăți confirmate' : 'Подтверждённые платежи' }),
      ).toBeVisible();
      await expect(page.getByText(/25,00\s+EUR/)).toBeVisible();
      await layout(page, width);
      await screenshot(page, 'after/' + locale + '-' + width + '-details.png', true);
    }
  });
}

test('subscriptions Math active, Physics expired, and English frozen work stay independent', async ({
  request,
  context,
  page,
}) => {
  await setup({ request, context, page }, 'ru', { canJoin: false });
  await page.goto('/student?ui.k8k=1');
  const overview = page.locator('[data-module="DASH-STU-05"]');
  const card = (name) =>
    overview.locator('article').filter({ has: page.getByRole('heading', { name, exact: true }) });
  const math = card('Математика');
  const physics = card('Физика');
  const english = card('Английский язык');
  await expect(math.getByText('Активен', { exact: true })).toBeVisible();
  await expect(row(math, 'Остаток оплаченных занятий')).toHaveText('5');
  await expect(math.getByRole('link')).toHaveAttribute(
    'href',
    new RegExp('subscriptionId=' + anchors.math),
  );
  await expect(physics.getByText('Истёк', { exact: true })).toBeVisible();
  await expect(row(physics, 'Остаток оплаченных занятий')).toHaveText('Не зафиксировано');
  await expect(row(english, 'Заморожен до')).toHaveText('18 ноября');
  await page.goto(hub(subjectIds.math));
  await expect(
    page.locator('.k8k-subject-card').getByRole('link', { name: 'Открыть расписание' }),
  ).toBeVisible();
  await page.goto(hub(subjectIds.physics));
  await expect(page.locator('.k8k-subject-card a[href*="/lessons"]')).toHaveCount(0);
  await page.goto(hub(subjectIds.english));
  await page.locator('main').getByRole('link', { name: 'Условия абонемента' }).click();
  const work = page.locator('.k8k-frozen-work');
  await expect(work.getByRole('link', { name: 'Материалы' })).toHaveAttribute(
    'href',
    '/student/materials?subjectId=' + subjectIds.english,
  );
  await expect(work.getByRole('link', { name: 'Все задания' })).toHaveAttribute(
    'href',
    '/student/homework?fromSubjectId=' + subjectIds.english,
  );
  await expect(page.locator('main a[href*="meet.google.com"]')).toHaveCount(0);
});

test('subscriptions director admission and confirmed purchase are separate balances', async ({
  request,
  context,
  page,
}) => {
  await setup({ request, context, page }, 'ru', { subscriptionScenario: 'partial' });
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto(subscription(anchors.math) + '&ui.k8k=1');
  const access = page.locator('.k8k-subscription-access');
  await expect(access.getByText('Доступ ограничен', { exact: true })).toBeVisible();
  await expect(row(access, 'Остаток оплаченных занятий')).toHaveText('0');
  await expect(row(access, 'Осталось по допуску')).toHaveText('2');
  await expect(row(access, 'Лимит допуска')).toHaveText('3');
  await expect(row(access, 'Допуск действует до')).toContainText('14 ноября');
  const payments = panel(page, 'Подтверждённые платежи');
  await expect(payments.getByText(/600,1234\s+MDL/)).toBeVisible();
  await expect(row(payments, 'Начислено занятий')).toHaveText('Не зафиксировано');
  await screenshot(page, 'states/partial-with-admission.png', true);

  await patch(request, { subscriptionScenario: 'ready' });
  await page.evaluate(() => globalThis.dispatchEvent(new Event('online')));
  await expect(row(access, 'Остаток оплаченных занятий')).toHaveText('5');
  await expect(access.getByText('Временный допуск', { exact: true })).toHaveCount(0);
  await expect(payments.getByText(/600,1234\s+MDL/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Оплатить|Пополнить|Выдать право/ })).toHaveCount(
    0,
  );
});

test('subscriptions exact currencies, local dates and quantity history preserve meaning', async ({
  request,
  context,
  page,
}) => {
  await setup({ request, context, page }, 'ro');
  await page.goto(subscription(anchors.math) + '&ui.k8k=1');
  const payments = panel(page, 'Plăți confirmate');
  for (const amount of [/600,1234\s+MDL/, /1,005\s+EUR/, /^0,00\s+MDL$/, /10,00\s+USD/])
    await expect(payments.getByText(amount)).toBeVisible();
  await expect(payments.locator('time[datetime="2026-11-07T02:30:00Z"]').first()).toContainText(
    '6 noiembrie',
  );
  await expect(page.locator('main time[datetime="2026-11-30"]').first()).toHaveText('30 noiembrie');
  await expect(payments.getByText(/FIXTURE_MATH_1$/)).toBeVisible();
  const ledger = panel(page, 'Istoricul soldului de lecții');
  const operation = (name) =>
    ledger.locator('li').filter({ has: page.getByText(name, { exact: true }) });
  const deduction = operation('Deducerea unei lecții');
  await expect(row(deduction, 'Lecții înainte de operațiune')).toHaveText('Neînregistrat');
  await expect(row(deduction, 'Lecții după operațiune')).toHaveText('2');
  const cancellation = operation('Anularea deducerii unei lecții');
  await expect(row(cancellation, 'Lecții înainte de operațiune')).toHaveText('2');
  await expect(row(cancellation, 'Lecții după operațiune')).toHaveText('3');
  await expect(operation('Corectarea soldului de lecții')).toBeVisible();
  for (const text of ['Suspendare temporară', 'Reluare']) {
    const freeze = ledger
      .locator('li')
      .filter({ has: page.locator('strong').and(page.getByText(text, { exact: true })) });
    await expect(row(freeze, 'Lecții înainte de operațiune')).toHaveText('3');
    await expect(row(freeze, 'Lecții după operațiune')).toHaveText('3');
  }
  await expect(ledger.getByText(/MDL|EUR|USD/)).toHaveCount(0);
});

test('subscriptions future NONE keeps selected payments and no-plan is distinct from outage', async ({
  request,
  context,
  page,
}) => {
  await setup({ request, context, page }, 'ru', { subscriptionScenario: 'no-plan' });
  await page.goto(subscription(anchors.future) + '&ui.k8k=1');
  await expect(page.getByText(/Выбранный период ещё не начался/)).toBeVisible();
  await expect(panel(page, 'Подтверждённые платежи').getByText(/25,00\s+EUR/)).toBeVisible();
  await expect(panel(page, 'История остатка занятий').locator('[data-state=empty]')).toBeVisible();
  await expect(page.getByLabel('Выбранный абонемент')).toHaveValue(anchors.future);
  await screenshot(page, 'states/future-none.png', true);
  const reads = (await state(request)).calls.filter(({ path }) =>
    path.includes('/student/subscription'),
  );
  expect(reads).toHaveLength(3);
  expect(
    reads.every(({ query }) => new URLSearchParams(query).get('subscriptionId') === anchors.future),
  ).toBe(true);
  await page.goto(hub(subjectIds.physics));
  await expect(
    page.locator('.k8k-subject-card').getByText('Нет абонемента', { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.locator('.k8k-subject-card').getByRole('link', { name: 'Условия абонемента' }),
  ).toHaveCount(0);
  await patch(request, { subjectError: 503 });
  await page.goto('/student');
  const overview = page.locator('[data-module="DASH-STU-05"]');
  await expect(overview.locator('[data-state=error]')).toBeVisible();
  await expect(overview.locator('.k8k-subscription-summary, [data-state=empty]')).toHaveCount(0);
  await screenshot(page, 'states/subjects-error.png', true);
  await patch(request, { subjectError: 0, subjectDelay: 1200, subjectEmpty: true });
  await page.reload();
  await expect(overview.locator('[data-state=loading]')).toBeVisible();
  await expect(overview.locator('[data-state=empty]')).toHaveCount(0);
  await screenshot(page, 'states/subjects-loading.png', true);
  await expect(overview.locator('[data-state=empty]')).toContainText('Предметы пока не назначены.');
  await screenshot(page, 'states/subjects-empty.png', true);
});

test('subscriptions selecting Physics resets both pages and discards a late Math response', async ({
  request,
  context,
  page,
}) => {
  await setup({ request, context, page });
  await page.goto(subscription(anchors.math) + '&ui.k8k=1');
  const payments = panel(page, 'Подтверждённые платежи');
  const ledger = panel(page, 'История остатка занятий');
  await ledger.locator('.pager button').last().click();
  await expect(ledger.locator('.pager span')).toContainText('2');
  let reached, release, completed;
  const seen = new Promise((resolve) => {
    reached = resolve;
  });
  const hold = new Promise((resolve) => {
    release = resolve;
  });
  const finished = new Promise((resolve) => {
    completed = resolve;
  });
  const firstPage2 = (url) =>
    url.pathname.endsWith('/subscription/payments') &&
    url.searchParams.get('subscriptionId') === anchors.math &&
    url.searchParams.get('page') === '2';
  await page.route(firstPage2, async (route) => {
    const response = await route.fetch();
    reached();
    await hold;
    await route.fulfill({ response }).catch(() => {});
    completed();
  });
  try {
    await payments.locator('.pager button').last().click();
    await seen;
    const selector = page.getByLabel('Выбранный абонемент');
    await selector.focus();
    await selector.selectOption(anchors.physics);
    await expect(selector).toBeFocused();
    await expect(page).toHaveURL(new RegExp('subscriptionId=' + anchors.physics));
    await expect(payments.getByText(/FIXTURE_PHYSICS_1/)).toBeVisible();
    await expect(ledger.getByText('Отмена списания занятия', { exact: true })).toBeVisible();
    release();
    await finished;
    await expect(payments.getByText(/FIXTURE_MATH/)).toHaveCount(0);
    const reads = (await state(request)).calls.filter(
      ({ query }) => new URLSearchParams(query).get('subscriptionId') === anchors.physics,
    );
    const paths = reads.map(({ path }) => path);
    for (const suffix of ['', '/payments', '/ledger'])
      expect(paths).toContain('/api/v1/student/subscription' + suffix);
    expect(
      reads
        .filter(({ path }) => !path.endsWith('/subscription'))
        .every(({ query }) => new URLSearchParams(query).get('page') === '1'),
    ).toBe(true);
  } finally {
    release();
  }
});

test('subscriptions stale history is read-only and one 403 revokes all cached panels', async ({
  request,
  context,
  page,
}) => {
  await setup({ request, context, page });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto(subscription(anchors.english) + '&ui.k8k=1');
  const payments = panel(page, 'Подтверждённые платежи');
  const access = page.locator('.k8k-subscription-access');
  await expect(payments.getByText(/FIXTURE_ENGLISH_1/)).toBeVisible();
  await expect(page.locator('.k8k-frozen-work a')).toHaveCount(2);
  await patch(request, { subjectError: 503, subscriptionFailures: { english: { payments: 503 } } });
  await page.evaluate(() => globalThis.dispatchEvent(new Event('online')));
  await expect(payments.locator('[data-state=stale]')).toBeVisible();
  await expect(payments.getByText(/FIXTURE_ENGLISH_1/)).toBeVisible();
  await expect(access.locator('[data-state=stale]')).toBeVisible();
  await expect(page.locator('.k8k-frozen-work a')).toHaveCount(0);
  await expect(page.locator('.k8k-subscription-detail > [data-state=ready]')).toBeVisible();
  await screenshot(page, 'states/stale.png', true);

  await patch(request, { subjectError: 0, subscriptionFailures: { english: { payments: 403 } } });
  await payments.getByRole('button', { name: 'Повторить загрузку' }).click();
  await expect(page.locator('main [data-state=forbidden]')).toBeVisible();
  await expect(page.locator('main .history-list, main .k8k-subscription-access')).toHaveCount(0);
  await expect(page.getByText(/FIXTURE_ENGLISH_1|Синтетический замороженный план/)).toHaveCount(0);
  await screenshot(page, 'states/forbidden.png');

  await page.goto(subscription(anchors.foreign));
  await expect(page.locator('main [data-state=forbidden]')).toBeVisible();
  await expect(page.locator('main .history-list')).toHaveCount(0);
  await page.goto(subscription(anchors.wrapper));
  await expect(page.locator('main [data-state=forbidden]')).toBeVisible();
  await expect(page.locator('main .history-list')).toHaveCount(0);
});

for (const [label, flags, destination] of [
  ['401', { auth: false }, /\/student\/login$/],
  ['402', { meSuspended: true }, /\/student\/suspended$/],
]) {
  test('subscriptions protected deep link ' + label, async ({ request, context, page }) => {
    await setup({ request, context, page }, 'ru', flags);
    await page.goto(subscription(anchors.math) + '&ui.k8k=1');
    await expect(page).toHaveURL(destination);
    await expect(page.locator('.history-list, .k8k-subscription-access')).toHaveCount(0);
    expect(
      (await state(request)).calls.some(({ path }) => path.includes('/student/subscription')),
    ).toBe(false);
  });
}

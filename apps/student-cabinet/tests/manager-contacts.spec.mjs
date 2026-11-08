import { expect, test } from './gate-fixtures.mjs';
import { evidenceUrl } from './gate-fixtures.mjs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../../manager-web/package.json', import.meta.url));
const AxeBuilder = require('@axe-core/playwright').default;
const origin = 'http://127.0.0.1:4175';
const evidence = evidenceUrl('../../../output/k8k-tasks/TASK-027/', import.meta.url);
const manager = {
  displayName: 'Елена ' + 'ДлиннаяФамилия'.repeat(8).slice(0, 94),
  phoneE164: '+37360000123',
  whatsapp: 'https://wa.me/37360000123',
  telegram: 'https://t.me/assigned_manager',
};
const nextManager = {
  displayName: 'Ирина НовыйМенеджер',
  phoneE164: null,
  whatsapp: 'https://wa.me/37360000456',
  telegram: '',
};
const noManager = { whatsapp: '', telegram: '', displayName: null, phoneE164: null };
const card = (page) => page.locator('.k8k-manager-card');
const patch = (request, data) => request.patch('/__fixture/state', { data });
const reads = async (request) =>
  (await (await request.get('/__fixture/state')).json()).calls.filter(
    (call) => call.path === '/api/v1/student/me',
  );

async function setup({ request, context, page }, locale = 'ru', data = {}) {
  await request.post('/__fixture/reset', { data: { managerContacts: manager, ...data } });
  await context.addCookies((await request.storageState()).cookies);
  await context.addInitScript(
    (lang) => globalThis.localStorage.setItem('k8k.locale', lang),
    locale,
  );
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
  );
  await page.setViewportSize({ width: 360, height: 800 });
}

const refresh = (page) =>
  page.evaluate(() =>
    globalThis.document.dispatchEvent(new Event('visibilitychange', { bubbles: true })),
  );

async function shot(page, name, fullPage = false) {
  await page.evaluate(() => globalThis.document.fonts.ready);
  await page.screenshot({
    path: fileURLToPath(new URL(name, evidence)),
    animations: 'disabled',
    fullPage,
  });
}

for (const locale of ['ru', 'ro']) {
  test('manager contacts RU/RO matrix ' + locale, async ({ request, context, page }) => {
    test.setTimeout(70_000);
    await setup({ request, context, page }, locale);
    const ro = locale === 'ro';
    expect(manager.displayName).toHaveLength(100);
    for (const width of [360, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: width === 360 ? 800 : 900 });
      for (const [surface, path, active] of [
        ['dashboard', '/student', true],
        ['help', '/student/help', true],
        ['suspended', '/student/suspended', false],
      ]) {
        await patch(request, { active });
        const before = (await reads(request)).length;
        await page.goto(path + '?ui.k8k=1');
        const widget = card(page);
        await expect(widget).toHaveCount(1);
        await expect(
          widget.getByRole('heading', { name: ro ? 'Managerul meu' : 'Мой менеджер' }),
        ).toBeVisible();
        await expect(widget.locator('.k8k-manager-identity strong')).toHaveText(
          manager.displayName,
        );
        await expect(widget.locator('.k8k-avatar')).toHaveText('ЕД');
        await expect(widget.locator('img')).toHaveCount(0);
        const phone = widget.getByRole('link', {
          name: ro ? 'Sună managerul' : 'Позвонить менеджеру',
        });
        await expect(phone).toHaveAttribute('href', 'tel:+37360000123');
        expect((await phone.boundingBox()).height).toBeGreaterThanOrEqual(44);
        for (const [name, href] of [
          ['WhatsApp', manager.whatsapp],
          ['Telegram', manager.telegram],
        ]) {
          const channel = widget.getByRole('link', { name });
          await expect(channel).toHaveAttribute('href', href);
          await expect(channel).toHaveAttribute('rel', /noopener.*noreferrer/);
          await expect(channel).toHaveAttribute('target', '_blank');
          expect((await channel.boundingBox()).height).toBeGreaterThanOrEqual(44);
        }
        expect(
          await page.evaluate(() => globalThis.document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        expect((await reads(request)).length - before).toBe(1);
        if (surface === 'suspended') {
          await expect(page.locator('h1')).toHaveText(
            ro ? 'Acces suspendat' : 'Доступ приостановлен',
          );
          await expect(page.locator('.k8k-shell')).toHaveCount(0);
        }
        if (width === 360) {
          await widget.getByRole('link', { name: 'WhatsApp' }).focus();
          await page.keyboard.press('Tab');
          await expect(widget.getByRole('link', { name: 'Telegram' })).toBeFocused();
          await page.keyboard.press('Tab');
          await expect(phone).toBeFocused();
          const result = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
            .analyze();
          expect(
            result.violations.map(({ id, nodes }) => ({
              id,
              targets: nodes.map((node) => node.target),
            })),
          ).toEqual([]);
          await page.evaluate(() => globalThis.scrollTo(0, 0));
        }
        await shot(
          page,
          'after/' + locale + '-' + width + '-' + surface + '.png',
          surface === 'dashboard',
        );
      }
    }
  });
}

test('manager contacts missing official phone and invalid channels stay hidden', async ({
  request,
  context,
  page,
}) => {
  await setup({ request, context, page }, 'ru', {
    managerContacts: { ...manager, phoneE164: null, phone: '+37369999999' },
  });
  await page.goto('/student/help?ui.k8k=1');
  await expect(card(page).getByRole('link', { name: 'WhatsApp' })).toBeVisible();
  await expect(card(page).locator('a[href^="tel:"]')).toHaveCount(0);
  await expect(card(page)).not.toContainText('37369999999');
  await patch(request, {
    managerContacts: {
      displayName: 'Менеджер без каналов',
      phoneE164: '+0000000',
      whatsapp: 'http://wa.me/37360000123',
      telegram: 'javascript:alert(1)',
    },
  });
  await page.reload();
  await expect(card(page).getByText('Менеджер без каналов')).toBeVisible();
  await expect(card(page).getByText(/Контакты пока не указаны/)).toBeVisible();
  await expect(card(page).locator('a, img')).toHaveCount(0);
  await patch(request, {
    managerContacts: { ...noManager, whatsapp: 'https://wa.me.evil.invalid/37360000123' },
  });
  await page.reload();
  await expect(card(page).getByText(/Контакты пока не указаны/)).toBeVisible();
  await expect(card(page).locator('a, img, .k8k-manager-identity')).toHaveCount(0);
  await shot(page, 'states/ru-no-manager.png');
});

test('manager contacts reassign and suppress stale links on refresh error', async ({
  request,
  context,
  page,
}) => {
  await setup({ request, context, page }, 'ro');
  await page.goto('/student/help?ui.k8k=1');
  await expect(card(page).getByText(manager.displayName, { exact: true })).toBeVisible();
  await patch(request, { managerContacts: nextManager });
  await refresh(page);
  await expect(card(page).getByText(nextManager.displayName, { exact: true })).toBeVisible();
  await expect(card(page).getByRole('link', { name: 'WhatsApp' })).toHaveAttribute(
    'href',
    nextManager.whatsapp,
  );
  await expect(card(page).getByText(manager.displayName, { exact: true })).toHaveCount(0);
  await expect(card(page).locator('a[href^="tel:"]')).toHaveCount(0);
  await patch(request, { meError: true });
  await refresh(page);
  await expect(
    card(page).getByText('Datele de contact ale managerului nu au putut fi actualizate.'),
  ).toBeVisible();
  await expect(card(page).locator('a, .k8k-manager-identity')).toHaveCount(0);
  await shot(page, 'states/ro-refresh-error.png');
  await patch(request, { meError: false, managerContacts: noManager });
  await refresh(page);
  await expect(card(page).getByText(/Contactează școala/)).toBeVisible();
  await expect(card(page).locator('a')).toHaveCount(0);
});

test('manager contacts demo switch in a second tab discards a late old /me', async ({
  request,
  context,
  page,
}) => {
  await setup({ request, context, page }, 'ru', {
    demoContacts: true,
    demoAlternate: {
      managerContacts: nextManager,
      displayName: 'Даниил',
      userId: '50000000-0000-4000-8000-000000000003',
    },
  });
  await page.goto('/student/help?ui.k8k=1');
  await expect(card(page).getByText(manager.displayName, { exact: true })).toBeVisible();
  const secondTab = await context.newPage();
  await secondTab.goto('/student?ui.k8k=1');
  await expect(card(secondTab).getByText(manager.displayName, { exact: true })).toBeVisible();
  let reached, release, complete;
  const waiting = new Promise((resolve) => {
    reached = resolve;
  });
  const hold = new Promise((resolve) => {
    release = resolve;
  });
  const finished = new Promise((resolve) => {
    complete = resolve;
  });
  const matcher = '**/api/v1/student/me';
  await page.route(matcher, async (route) => {
    const response = await route.fetch();
    expect((await response.json()).managerContacts.displayName).toBe(manager.displayName);
    reached();
    await hold;
    await route.fulfill({ response }).catch(() => {});
    complete();
  });
  try {
    await page.bringToFront();
    await refresh(page);
    await waiting;
    await secondTab.locator('.account-menu summary').click();
    await secondTab.getByRole('button', { name: /Демо Даниил/ }).click();
    await expect(page).toHaveURL(origin + '/');
    await expect(page.getByText(manager.displayName, { exact: true })).toHaveCount(0);
    release();
    await finished;
    await page.unroute(matcher);
    await expect(card(secondTab).getByText(nextManager.displayName, { exact: true })).toBeVisible();
    await page.goto('/student/help');
    await expect(card(page).getByText(nextManager.displayName, { exact: true })).toBeVisible();
    await expect(page.getByText(manager.displayName, { exact: true })).toHaveCount(0);
    await expect(card(page).locator('a[href^="tel:"]')).toHaveCount(0);
  } finally {
    release();
  }
});

test('manager contacts suspended direct link, password guard and session expiration', async ({
  request,
  context,
  page,
}) => {
  await setup({ request, context, page }, 'ru', { active: false });
  await page.goto('/student/help?ui.k8k=1');
  await expect(page).toHaveURL(/\/student\/suspended$/);
  await expect(card(page).getByRole('link', { name: 'Позвонить менеджеру' })).toHaveAttribute(
    'href',
    'tel:+37360000123',
  );
  await expect(page.locator('.k8k-shell')).toHaveCount(0);
  await patch(request, { mustChangePassword: true });
  await page.reload();
  await expect(page).toHaveURL(/\/student\/security\/change-password$/);
  await expect(card(page)).toHaveCount(0);
  await patch(request, { mustChangePassword: false, auth: false });
  await page.goto('/student/suspended');
  await expect(page).toHaveURL(/\/student\/login$/);
  await expect(card(page)).toHaveCount(0);
});

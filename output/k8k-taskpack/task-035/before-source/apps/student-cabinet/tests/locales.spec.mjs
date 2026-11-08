import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { localeFixture, fileId, english, sessionId } from './locale-fixtures.mjs';
const require = createRequire(new URL('../../manager-web/package.json', import.meta.url));
const AxeBuilder = require('@axe-core/playwright').default;
const state = async (request) => (await request.get('/__fixture/state')).json();
const patch = (request, data) => request.patch('/__fixture/state', { data });
const calls = async (request, suffix) =>
  (await state(request)).calls.filter((call) => call.path.endsWith(suffix));
async function setup({ request, context }, locale = 'ru', data = {}) {
  await request.post('/__fixture/reset', { data: { ...localeFixture(), ...data } });
  await context.addCookies((await request.storageState()).cookies);
  await context.addInitScript((value) => {
    if (!localStorage.getItem('k8k.locale')) localStorage.setItem('k8k.locale', value);
  }, locale);
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === 'http://127.0.0.1:4175'
      ? route.continue()
      : route.abort(),
  );
}
async function language(page, value) {
  const selector = page.locator('.k8k-language select');
  if (!(await selector.isVisible())) await page.locator('.account-menu > summary').click();
  await selector.selectOption(value);
  await expect(page.locator('html')).toHaveAttribute('lang', value);
}
async function shot(page, name) {
  await page.evaluate(() => globalThis.document.fonts.ready);
  await page.screenshot({
    path: fileURLToPath(
      new URL('../../../output/k8k-tasks/TASK-034/after/' + name + '.png', import.meta.url),
    ),
    animations: 'disabled',
  });
}
async function layout(page, width) {
  expect(
    await page.evaluate(() => globalThis.document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(width);
}
const routes = [
  ['materials', 'Материалы', 'Materiale'],
  ['profile', 'Профиль и настройки', 'Profil și setări'],
  ['security', 'Безопасность аккаунта', 'Securitatea contului'],
  ['login', 'С возвращением', 'Bine ai revenit'],
  ['security/change-password', 'Задайте новый пароль', 'Setează o parolă nouă'],
];
test.afterEach(async ({ request }) => expect((await state(request)).missingRoutes).toEqual([]));
for (const locale of ['ru', 'ro'])
  test(
    'TASK-034 RU/RO route layouts and accessibility ' + locale,
    async ({ page, request, context }) => {
      test.setTimeout(120_000);
      await setup({ request, context }, locale);
      const axe = [];
      for (const width of [360, 768, 1024, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        for (const [route, ru, ro] of routes) {
          await page.goto('/student/' + route + '?ui.k8k=1');
          await expect(
            page.getByRole('heading', { name: locale === 'ro' ? ro : ru, exact: true }).first(),
          ).toBeVisible();
          await expect(page.locator('html')).toHaveAttribute('lang', locale);
          expect(await page.title()).not.toMatch(/student\.|undefined/);
          await layout(page, width);
          if (route === 'profile') {
            await expect(
              page.getByRole('textbox', {
                name: locale === 'ro' ? 'Cum să ne adresăm' : 'Как к тебе обращаться',
              }),
            ).toHaveValue(localeFixture().displayName);
            expect(
              (
                await page
                  .getByRole('button', {
                    name: locale === 'ro' ? 'Salvează profilul' : 'Сохранить профиль',
                    exact: true,
                  })
                  .boundingBox()
              ).height,
            ).toBeGreaterThanOrEqual(48);
          }
          if (route === 'materials') {
            await expect(page.locator('.k8k-material-list > li')).toHaveCount(30);
            await expect(
              page
                .getByRole('button', {
                  name: locale === 'ro' ? 'Descarcă' : 'Скачать',
                  exact: true,
                })
                .first(),
            ).toBeEnabled();
          }
          await shot(page, `${locale}-${width}-${route.replaceAll('/', '-')}`);
          if (width === 360) {
            const result = await new AxeBuilder({ page })
              .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
              .analyze();
            axe.push({ route, violations: result.violations });
            expect(
              result.violations.map(({ id, nodes }) => ({
                id,
                targets: nodes.map(({ target }) => target),
              })),
            ).toEqual([]);
          }
        }
        await patch(request, { active: false });
        await page.goto('/student/suspended?ui.k8k=1');
        await expect(
          page.getByRole('heading', {
            name: locale === 'ro' ? 'Acces suspendat' : 'Доступ приостановлен',
          }),
        ).toBeVisible();
        await expect(page.locator('.k8k-main,.account-menu,.k8k-material-list')).toHaveCount(0);
        await expect(
          page.getByRole('button', {
            name: locale === 'ro' ? 'Deconectează-te' : 'Выйти из аккаунта',
            exact: true,
          }),
        ).toBeVisible();
        await layout(page, width);
        await expect(page.locator('main')).toContainText('America/New_York');
        await shot(page, `${locale}-${width}-suspended`);
        await patch(request, { active: true });
      }
      writeFileSync(
        fileURLToPath(
          new URL('../../../output/k8k-tasks/TASK-034/axe-' + locale + '.json', import.meta.url),
        ),
        JSON.stringify(axe, null, 2),
      );
    },
  );

test('TASK-034 all current cabinet routes switch language and title without reload', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context });
  const paths = [
    '',
    'subjects',
    'help',
    'lessons',
    'lessons/10000000-0000-4000-8000-000000000001',
    'homework',
    'homework/20000000-0000-4000-8000-000000000001',
    'skills',
    'reports',
    'subscription',
    'materials',
    'profile',
    'security',
    'security/change-password',
    'login',
  ];
  for (const route of paths) {
    await page.goto('/student/' + route + '?ui.k8k=1');
    await expect(page.locator('.k8k-language select')).toHaveCount(1);
    await page.evaluate(() => (globalThis.LOCALE_MARKER = true));
    await language(page, 'ro');
    expect(await page.evaluate(() => globalThis.LOCALE_MARKER)).toBe(true);
    await expect(page.locator('body')).not.toContainText(
      /\b(?:student\.|chrome\.|errors\.|nav\.)[A-Za-z]/,
    );
    await expect
      .poll(() => page.title())
      .not.toMatch(/Кабинет|Материалы|Профиль|Безопасность|Расписание|Главная|Задания/);
    await language(page, 'ru');
  }
});

test('TASK-034 alias survives locale and authoritative background me refetch, PATCH whitelist', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context });
  await page.clock.install();
  await page.goto('/student/profile?ui.k8k=1');
  const input = page.locator('[name=displayName]');
  await input.fill('Редактируемый alias');
  await input.evaluate((el) => (el.dataset.identity = 'stable'));
  await language(page, 'ro');
  await expect(input).toHaveValue('Редактируемый alias');
  await expect(input).toHaveAttribute('data-identity', 'stable');
  await patch(request, { displayName: 'Другой ответ /me' });
  await page.clock.runFor(61000);
  await expect(page.locator('.account-menu > summary')).toContainText('Другой ответ /me');
  await expect(input).toHaveValue('Редактируемый alias');
  await page.locator('.account-menu > summary').click();
  await page.getByRole('button', { name: 'Salvează profilul', exact: true }).click();
  await expect(page.getByText('Profilul a fost salvat', { exact: true })).toBeVisible();
  const writes = await calls(request, '/student/profile');
  expect(writes).toHaveLength(1);
  expect(writes[0].body).toEqual({ displayName: 'Редактируемый alias' });
  expect(writes[0].csrf).toBeTruthy();
  expect((await state(request)).fullName).toBe(localeFixture().fullName);
  expect((await state(request)).email).toBe(localeFixture().email);
  await input.fill('N'.repeat(100));
  await shot(page, 'ro-alias100-dirty');
});

test('TASK-034 language persists after reload/cross-tab and works without storage', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context });
  await page.goto('/student/profile?ui.k8k=1');
  await language(page, 'ro');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Profil și setări', exact: true })).toBeVisible();
  const second = await context.newPage();
  await second.goto('/student/profile?ui.k8k=1');
  await expect(
    second.getByRole('heading', { name: 'Profil și setări', exact: true }),
  ).toBeVisible();
  await language(second, 'ru');
  await expect(
    page.getByRole('heading', { name: 'Профиль и настройки', exact: true }),
  ).toBeVisible();
  await second.close();
  await context.addInitScript(() =>
    Object.defineProperty(globalThis, 'localStorage', {
      get() {
        throw new Error('blocked storage');
      },
    }),
  );
  await page.goto('/student/login?ui.k8k=1');
  await language(page, 'ro');
  await expect(page.getByLabel('Adresă de e-mail')).toBeVisible();
  await shot(page, 'ro-storage-unavailable');
});

test('TASK-034 materials metadata, server filter/page and explicit signed action expiry', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context }, 'ro');
  await page.goto('/student/materials?ui.k8k=1');
  await expect(page.getByText('Fără disciplină', { exact: false })).toBeVisible();
  await expect(page.getByText('Fără legătură cu o lecție', { exact: true })).toBeVisible();
  await expect(page.locator('.k8k-material-list h3').nth(1)).toHaveText('Material');
  expect(await calls(request, '/url')).toHaveLength(0);
  await page.locator('.pager button').last().click();
  await expect(page.locator('.k8k-material-list > li')).toHaveCount(5);
  await page.locator('label.filter select').selectOption(english);
  expect(new URL(page.url()).searchParams.has('page')).toBe(false);
  await expect(page.locator('.k8k-material-list > li')).toHaveCount(18);
  const list = await calls(request, '/student/materials');
  expect(list.at(-1).query).toContain('subjectId=' + english);
  await patch(request, { materialUrlExpired: true });
  await page.getByRole('button', { name: 'Descarcă', exact: true }).first().click();
  await expect(
    page.getByText('Linkul a expirat. Solicită o permisiune nouă pentru a deschide fișierul.', {
      exact: true,
    }),
  ).toBeVisible();
  await shot(page, 'ro-material-expired');
  await patch(request, { materialUrlExpired: false, materialUrlError: 403 });
  await page.getByRole('button', { name: 'Descarcă', exact: true }).first().click();
  await expect(page.getByRole('alert')).toBeVisible();
  expect(await calls(request, '/' + fileId(1) + '/url')).toHaveLength(2);
  await shot(page, 'ro-material-revoked');
  await patch(request, {
    materialUrlError: 0,
    materialRows: [
      {
        ...localeFixture().materialRows[0],
        subjectName: 'Без предмета',
        fileName: 'Материал',
        fileNameIsFallback: false,
      },
    ],
  });
  await page.reload();
  await expect(page.locator('.k8k-material-list h3')).toHaveText('Материал');
  await expect(page.locator('.k8k-material-list small').first()).toContainText('Без предмета');
});

test('TASK-034 native validation, email and password input preserve the selected locale', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context }, 'ro');
  await page.goto('/student/login?ui.k8k=1');
  await page.getByRole('button', { name: 'Autentifică-te', exact: true }).click();
  await expect(page.getByText('Completează acest câmp.', { exact: true })).toHaveCount(2);
  expect(
    (await calls(request, '/auth/session')).filter((call) => call.method === 'POST'),
  ).toHaveLength(0);
  await language(page, 'ru');
  await expect(page.getByText('Заполните это поле.', { exact: true })).toHaveCount(2);
  await page.goto('/student/security?ui.k8k=1');
  await page.getByLabel('Новый email').fill('draft@example.invalid');
  await page.getByLabel('Текущий пароль').fill('SyntheticSecret9');
  await language(page, 'ro');
  await expect(page.getByLabel('Adresa nouă de e-mail')).toHaveValue('draft@example.invalid');
  expect(
    await page.getByLabel('Parola curentă').evaluate((input) => input.value === 'SyntheticSecret9'),
  ).toBe(true);
  await page.getByLabel('Parola curentă').fill('');
  await shot(page, 'ro-validation-and-dirty-email');
});

for (const kind of ['request-unknown', 'wrong-password', 'wrong-otp'])
  test(
    'TASK-034 security ' + kind + ' is localized and secrets are cleared',
    async ({ page, request, context }) => {
      await setup(
        { request, context },
        'ro',
        kind === 'request-unknown'
          ? { emailRequestError: { status: 503, code: 'EMAIL_DELIVERY_UNAVAILABLE' } }
          : kind === 'wrong-password'
            ? { emailRequestError: { status: 401, code: 'CURRENT_PASSWORD_INVALID' } }
            : { emailConfirmError: { status: 400, code: 'EMAIL_OTP_INVALID' } },
      );
      await page.goto('/student/security?ui.k8k=1');
      await page.getByLabel('Adresa nouă de e-mail').fill('new@example.invalid');
      await page.getByLabel('Parola curentă').fill('SyntheticSecret9');
      await page.getByRole('button', { name: 'Obține codul', exact: true }).click();
      if (kind === 'wrong-otp') {
        await expect(
          page.getByText('Introdu codul trimis la new@example.invalid.', { exact: true }),
        ).toBeVisible();
        await page.getByLabel('Cod de confirmare').fill('123456');
        await page.getByRole('button', { name: 'Confirmă adresa de e-mail', exact: true }).click();
        await expect(
          page.getByText('Codul este incorect sau a expirat. Verifică-l sau solicită unul nou.', {
            exact: true,
          }),
        ).toBeVisible();
        await expect(page.getByLabel('Cod de confirmare')).toHaveValue('');
      } else {
        await expect(page.locator('.k8k-error-feedback[role=alert]')).toBeVisible();
        await expect(page.getByLabel('Parola curentă')).toHaveValue('');
        await expect(
          page.getByText('Introdu codul trimis la new@example.invalid.', { exact: true }),
        ).toHaveCount(0);
        if (kind === 'request-unknown') {
          await expect(
            page.getByRole('button', { name: 'Obține codul', exact: true }),
          ).toBeDisabled();
          expect(await calls(request, '/change-email/request')).toHaveLength(1);
        }
      }
      for (const call of (await state(request)).calls.filter((call) =>
        call.path.includes('/change-email/'),
      )) {
        expect(call.body).toEqual({});
        expect(call.csrf).toBeTruthy();
      }
      expect(
        await page.evaluate(() =>
          [...Object.values(localStorage), ...Object.values(sessionStorage)].some((value) =>
            /SyntheticSecret9|123456/.test(value),
          ),
        ),
      ).toBe(false);
      await shot(page, 'ro-' + kind);
    },
  );

test('TASK-034 confirm email and password use rotated session bootstrap; suspended/password gates', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context });
  await page.goto('/student/security?ui.k8k=1');
  await page.getByLabel('Новый email').fill('new@example.invalid');
  await page.getByLabel('Текущий пароль').fill('SyntheticSecret9');
  await page.getByRole('button', { name: 'Получить код', exact: true }).click();
  await page.getByLabel('Код подтверждения').fill('123456');
  await page.getByRole('button', { name: 'Подтвердить email', exact: true }).click();
  await expect(page).toHaveURL(/\/student\/profile/);
  await expect(page.getByText('Email: new@example.invalid', { exact: true })).toBeVisible();
  await patch(request, { mustChangePassword: true, active: false });
  await page.goto('/student/materials?ui.k8k=1');
  await expect(page).toHaveURL(/change-password/);
  await page.getByLabel('Текущий пароль').fill('SyntheticSecret9');
  await page.getByLabel('Новый пароль', { exact: true }).fill('NewSynthetic9');
  await page.getByLabel('Повторите новый пароль').fill('NewSynthetic9');
  await page.getByRole('button', { name: 'Изменить пароль', exact: true }).click();
  await expect(page).toHaveURL(/suspended/);
  await expect(page.locator('.k8k-main,.account-menu')).toHaveCount(0);
  await page.getByRole('button', { name: 'Выйти из аккаунта', exact: true }).click();
  await expect(page).toHaveURL(/login/);
});

test('TASK-034 current409 and foreign404 revoke are safe; own other204 refreshes devices', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context }, 'ro');
  await page.goto('/student/security?ui.k8k=1');
  const other = page.getByRole('button', { name: 'Încheie sesiunea', exact: true });
  await expect(other).toHaveCount(1);
  let data = (await state(request)).sessionRows;
  data[1].isCurrent = true;
  await patch(request, { sessionRows: data });
  await other.click();
  await expect(
    page.getByText('Pentru a încheia sesiunea curentă, folosește deconectarea.', { exact: true }),
  ).toBeVisible();
  data[1].isCurrent = false;
  data[1].foreign = true;
  await patch(request, { sessionRows: data });
  await other.click();
  await expect(
    page.getByText('Sesiunea nu este disponibilă. Actualizează lista dispozitivelor.', {
      exact: true,
    }),
  ).toBeVisible();
  data[1].foreign = false;
  await patch(request, { sessionRows: data });
  await other.click();
  await expect(other).toHaveCount(0);
  expect((await calls(request, '/' + sessionId(2))).map((call) => call.method)).toEqual([
    'DELETE',
    'DELETE',
    'DELETE',
  ]);
});

test('TASK-034 reduced motion, 200% zoom and long text remain usable', async ({
  browser,
  request,
}) => {
  // 1280x1000 device pixels at 200%: 640x500 CSS pixels, DPR2.
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:4175',
    viewport: { width: 640, height: 500 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
  });
  await setup({ request, context }, 'ro');
  const page = await context.newPage();
  try {
    for (const route of ['materials', 'profile', 'security']) {
      await page.goto('/student/' + route + '?ui.k8k=1');
      expect(await page.evaluate(() => globalThis.innerWidth)).toBe(640);
      expect(await page.evaluate(() => globalThis.matchMedia('(max-width: 767px)').matches)).toBe(
        true,
      );
      await layout(page, 640);
      const account = await page.locator('.account-menu > summary').boundingBox();
      expect(account.x + account.width).toBeLessThanOrEqual(640);
      await page.locator('.account-menu > summary').click();
      await expect(page.locator('.k8k-language select')).toBeVisible();
      await page.locator('.account-menu > summary').click();
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => globalThis.document.activeElement?.tagName)).not.toBe(
        'BODY',
      );
      await shot(page, 'ro-zoom200-' + route);
    }
  } finally {
    await context.close();
  }
});

test('TASK-034 explicit file handoff uses fresh authorization and persists no capability', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context });
  await page.route('https://material.student.test/**', (route) =>
    route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="fixture.pdf"',
        'Cache-Control': 'no-store',
      },
      body: '%PDF-1.4 synthetic fixture',
    }),
  );
  await page.goto('/student/materials?ui.k8k=1');
  await expect(page.locator('.k8k-material-list > li')).toHaveCount(30);
  expect(await calls(request, '/url')).toHaveLength(0);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Скачать', exact: true }).first().click();
  expect((await download).suggestedFilename()).toBe('fixture.pdf');
  expect(await calls(request, '/' + fileId(1) + '/url')).toHaveLength(1);
  expect(
    await page.evaluate(() =>
      [...Object.values(localStorage), ...Object.values(sessionStorage)].some((value) =>
        /material\.student|capability/.test(value),
      ),
    ),
  ).toBe(false);
  await expect(page).toHaveURL(/\/student\/materials/);
});

test('TASK-034 pending profile, stale materials, forbidden and empty are separate localized states', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context }, 'ro', { profileDelay: 900 });
  await page.goto('/student/profile?ui.k8k=1');
  await page.locator('[name=displayName]').fill('Alias nou');
  await page.getByRole('button', { name: 'Salvează profilul', exact: true }).click();
  await expect(page.locator('[name=displayName]')).toBeDisabled();
  await shot(page, 'ro-profile-pending');
  await expect(page.getByText('Profilul a fost salvat', { exact: true })).toBeVisible();
  await page.clock.install();
  await page.goto('/student/materials?ui.k8k=1');
  await expect(page.locator('.k8k-material-list > li')).toHaveCount(30);
  await patch(request, { materialsError: 503 });
  await page.getByRole('button', { name: 'Actualizează materialele', exact: true }).click();
  await expect(
    page.getByText('Datele pot fi învechite. Verifică starea actuală înainte de a acționa.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator('.k8k-material-list > li')).toHaveCount(30);
  await expect(page.getByRole('button', { name: 'Descarcă', exact: true }).first()).toBeDisabled();
  await shot(page, 'ro-material-stale');
  await patch(request, { materialsError: 403 });
  await page.getByRole('button', { name: 'Reîncearcă încărcarea', exact: true }).click();
  await expect(page.locator('.k8k-material-list > li')).toHaveCount(0);
  await shot(page, 'ro-material-forbidden');
  await patch(request, { materialsError: 0, materialRows: [] });
  await page.reload();
  await expect(
    page.getByText('Profesorul nu a distribuit încă materiale.', { exact: true }),
  ).toBeVisible();
  await shot(page, 'ro-material-empty');
});

for (const action of ['logout', 'switch'])
  test(
    'TASK-034 late private material capability discarded after ' + action,
    async ({ page, request, context }) => {
      await setup({ request, context }, 'ru', {
        demoContacts: true,
        demoAlternate: { displayName: 'Даниил', userId: '50000000-0000-4000-8000-000000000003' },
      });

      await page.goto('/student/materials?ui.k8k=1');
      let release,
        finish,
        intercepted = false,
        external = 0;
      const gate = new Promise((done) => {
        release = done;
      });
      const finished = new Promise((done) => {
        finish = done;
      });
      await page.route('**/api/v1/student/materials/*/url', async (route) => {
        intercepted = true;
        await gate;
        await route
          .fulfill({
            json: {
              url: 'https://material.student.test/read?capability=late-fixture',
              expiresAt: new Date(Date.now() + 60000).toISOString(),
              fileName: 'synthetic.pdf',
            },
          })
          .catch(() => undefined);
        finish();
      });
      await page.route('https://material.student.test/**', (route) => {
        external++;
        return route.abort();
      });
      await page.getByRole('button', { name: 'Скачать', exact: true }).first().click();
      await expect.poll(() => intercepted).toBe(true);
      const second = action === 'switch' ? await context.newPage() : page;
      if (action === 'switch') await second.goto('/student?ui.k8k=1');
      await second.locator('.account-menu > summary').click();
      await second
        .getByRole('button', {
          name: action === 'switch' ? /Демо Даниил/ : 'Выйти из аккаунта',
          exact: action === 'logout',
        })
        .click();
      await expect(page).toHaveURL(action === 'switch' ? 'http://127.0.0.1:4175/' : /login/);
      release();
      await finished;
      expect(external).toBe(0);
      await expect(page.locator('.k8k-material-list')).toHaveCount(0);
      if (second !== page) await second.close();
    },
  );

test('TASK-034 unknown standalone logout retires the private view for explicit session verification', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context }, 'ro', { active: false });
  await page.goto('/student/suspended?ui.k8k=1');
  await page.route('**/api/v1/auth/session', (route) =>
    route.request().method() === 'DELETE'
      ? route.fulfill({ status: 503, json: { code: 'SERVICE_UNAVAILABLE' } })
      : route.continue(),
  );
  await page.getByRole('button', { name: 'Deconectează-te', exact: true }).click();
  await expect(page.locator('.account-session-status')).toBeVisible();
  await expect(page.locator('.k8k-access-screen,.account-menu')).toHaveCount(0);
  await expect(page.locator('.account-session-status a')).toBeFocused();
  await shot(page, 'ro-logout-unknown-verification');
});

test('TASK-034 expired temporary password shows the safe localized recovery message', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context }, 'ro');
  await page.goto('/student/login?ui.k8k=1');
  await page.route('**/api/v1/auth/session', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 403,
          json: { code: 'TEMPORARY_PASSWORD_EXPIRED', message: 'PRIVATE_DIAGNOSTIC_NOT_FOR_UI' },
        })
      : route.continue(),
  );
  await page.getByLabel('Adresă de e-mail').fill('student@example.invalid');
  await page.getByLabel('Parolă', { exact: true }).fill('SyntheticSecret9');
  await page.getByRole('button', { name: 'Autentifică-te', exact: true }).click();
  await expect(
    page.getByText('Parola temporară a expirat. Contactează managerul pentru o parolă nouă.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator('body')).not.toContainText('PRIVATE_DIAGNOSTIC_NOT_FOR_UI');
  expect(
    await page.getByLabel('Parolă', { exact: true }).evaluate((input) => input.value === ''),
  ).toBe(true);
  await shot(page, 'ro-temporary-password-expired');
});

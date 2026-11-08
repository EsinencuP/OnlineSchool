import { expect, test } from './gate-fixtures.mjs';
import { evidenceUrl } from './gate-fixtures.mjs';
import { fileURLToPath } from 'node:url';

const lessonId = '10000000-0000-4000-8000-000000000001';
const completedId = '10000000-0000-4000-8000-000000000003';
const english = '60000000-0000-4000-8000-000000000001';
const detail = (id = lessonId) => '/student/lessons/' + id;
const dialog = (page) => page.getByRole('dialog');
const state = async (request) => await (await request.get('/__fixture/state')).json();
const patch = (request, data) => request.patch('/__fixture/state', { data });
const commands = async (request) =>
  (await state(request)).calls.filter(({ method }) => method === 'POST');
const goto = (page, path) => page.goto(path + (path.includes('?') ? '&' : '?') + 'ui.k8k=1');
const refresh = (page) =>
  page.evaluate(() => {
    globalThis.document.dispatchEvent(new Event('visibilitychange'));
  });

async function setup({ request, context }, locale = 'ru', extra = {}) {
  await request.post('/__fixture/reset', {
    data: { lessonJourney: true, journeyAsOf: new Date().toISOString(), ...extra },
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
      evidenceUrl('../../../output/k8k-tasks/TASK-029/after/' + name + '.png', import.meta.url),
    ),
    animations: 'disabled',
  });
}

for (const locale of ['ru', 'ro']) {
  test(
    'calendar, history, lesson and accessible forms ' + locale,
    async ({ page, request, context }) => {
      test.setTimeout(90_000);
      const longName = 'Елена ' + 'ДлиннаяФамилия'.repeat(8).slice(0, 94);
      await setup({ request, context }, locale, {
        displayName: longName,
        journeyTeacher: longName,
      });
      const ro = locale === 'ro';
      for (const width of [360, 768, 1024, 1280]) {
        await page.setViewportSize({ width, height: width === 360 ? 800 : 900 });
        await goto(page, '/student/lessons?view=calendar');
        await expect(page.locator('.lesson-calendar .lesson-row').first()).toBeVisible();
        expect(
          await page.evaluate(() => globalThis.document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        await shot(page, locale + '-' + width + '-calendar');

        const history = page.locator('.k8k-lesson-history');
        await history.scrollIntoViewIfNeeded();
        await expect(history.getByText('9007199254740993', { exact: true })).toBeVisible();
        await expect(
          history
            .getByText(ro ? 'Soldul istoric este necunoscut' : 'Исторический остаток неизвестен')
            .first(),
        ).toBeVisible();
        await expect(history.locator('[role="tab"], [role="tablist"]')).toHaveCount(0);
        await shot(page, locale + '-' + width + '-history');

        await goto(page, detail());
        await expect(
          page.getByText(ro ? 'Ora inițială a lecției' : 'Первоначальное время урока', {
            exact: false,
          }),
        ).toBeVisible();
        await expect(
          page.getByRole('link', { name: 'Present Perfect. Рассказ о путешествии' }),
        ).toBeVisible();
        const reschedule = page.getByRole('button', {
          name: ro ? 'Cere reprogramarea' : 'Запросить перенос',
          exact: true,
        });
        await reschedule.focus();
        await page.keyboard.press('Enter');
        await expect(dialog(page)).toBeVisible();
        await expect(
          dialog(page).getByRole('textbox', {
            name: /Причина|Motiv|Что произошло|Ce s-a întâmplat/,
          }),
        ).toBeFocused();
        await dialog(page)
          .getByRole('textbox', { name: /Причина|Motiv|Что произошло|Ce s-a întâmplat/ })
          .fill('Нужно согласовать новую дату этого урока.');
        await dialog(page).locator('input[type="date"]').fill('2030-01-02');
        const submit = dialog(page).getByRole('button', {
          name: ro ? 'Trimite cererea' : 'Отправить запрос',
        });
        expect((await submit.boundingBox()).height).toBeGreaterThanOrEqual(48);
        expect(
          await page.evaluate(() => globalThis.document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        await shot(page, locale + '-' + width + '-reschedule');
        await page.keyboard.press('Escape');
        await expect(reschedule).toBeFocused();

        await goto(page, detail(completedId));
        await expect(page.getByText('9007199254740992', { exact: true })).toBeVisible();
        await expect(
          page.getByText('55 ' + (ro ? 'minute' : 'минут'), { exact: true }),
        ).toBeVisible();
        await shot(page, locale + '-' + width + '-detail');
        const dispute = page.getByRole('button', {
          name: ro ? 'Contestă deducerea' : 'Оспорить списание',
          exact: true,
        });
        await dispute.focus();
        await page.keyboard.press('Enter');
        await expect(
          dialog(page).getByRole('textbox', {
            name: /Причина|Motiv|Что произошло|Ce s-a întâmplat/,
          }),
        ).toBeFocused();
        await dialog(page)
          .getByRole('textbox')
          .fill('Прошу проверить списание за этот конкретный урок.');
        await shot(page, locale + '-' + width + '-dispute');
        await page.keyboard.press('Escape');
        await expect(dispute).toBeFocused();
      }
      expect(await commands(request)).toEqual([]);
    },
  );
}

test('calendar overflow keeps selected month and true total through paginated fallback', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context }, 'ro', { calendarOverflow: true });
  await goto(page, '/student/lessons?view=calendar&month=2026-11');
  await page.getByRole('button', { name: 'Deschide lista acestei luni' }).click();
  await expect(page).toHaveURL(/month=2026-11/);
  await expect(page).toHaveURL(/view=list/);
  await expect(page.getByText('Total 65', { exact: true })).toBeVisible();
  await expect(page.locator('.lesson-row')).toHaveCount(20);
  const secondPage = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === '/api/v1/student/lessons' && url.searchParams.get('page') === '2';
  });
  await page
    .locator('.panel')
    .filter({ has: page.locator('.lesson-table') })
    .getByRole('button', { name: 'Înainte' })
    .click();
  await expect(page).toHaveURL(/page=2/);
  expect((await secondPage).status()).toBe(200);
  await expect(page.locator('.lesson-row').first().locator('a').first()).toHaveAttribute(
    'href',
    /10000000-0000-4000-8000-000000000120/,
  );
  const calls = (await state(request)).calls;
  expect(
    calls.some(
      ({ path, query }) =>
        path.endsWith('/lessons') &&
        query.includes('month=2026-11') &&
        query.includes('view=list') &&
        query.includes('page=2'),
    ),
  ).toBe(true);
  await shot(page, 'ro-overflow-page2');
});

test('server history pagination, subject scope and safe lesson return URL', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context });
  await goto(page, '/student/lessons?period=week&view=list&page=2&month=2026-11&historyPage=2');
  const history = page.locator('.k8k-lesson-history');
  await expect(history.locator('.k8k-list-row')).toHaveCount(3);
  const link = history.locator('.k8k-list-row-title a').first();
  const expected = new URL(page.url()).searchParams;
  await link.click();
  await page.getByRole('link', { name: '← К расписанию' }).click();
  for (const [key, value] of expected)
    expect(new URL(page.url()).searchParams.get(key)).toBe(value);
  await goto(page, '/student/lessons?fromSubjectId=' + english);
  await expect(page.locator('.lesson-row')).toHaveCount(13);
  await expect(page.locator('.lesson-row').getByText('Математика', { exact: true })).toHaveCount(0);
  expect(
    (await state(request)).calls.some(
      ({ path, query }) =>
        path.endsWith('/lessons/history') && query.includes('subjectId=' + english),
    ),
  ).toBe(true);
  await goto(page, detail(completedId) + '?backTo=https%3A%2F%2Fevil.invalid');
  await expect(page.getByRole('link', { name: '← К расписанию' })).toHaveAttribute(
    'href',
    '/student/lessons',
  );
});

test('reschedule double submit creates one task and keeps the planned lesson and balances', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context }, 'ru', { commandDelay: 300 });
  await goto(page, detail());
  const before = await (await request.get('/api/v1/student/lessons/' + lessonId)).json();
  const balancesBefore = await (await request.get('/api/v1/student/lessons/history')).json();
  await page.getByRole('button', { name: 'Запросить перенос', exact: true }).click();
  await dialog(page)
    .getByRole('textbox', { name: /Причина|Motiv|Что произошло|Ce s-a întâmplat/ })
    .fill('Прошу перенести этот урок на указанную дату.');
  await dialog(page).locator('input[type="date"]').fill('2030-01-02');
  await dialog(page).getByRole('button', { name: 'Отправить запрос' }).dblclick();
  await expect(dialog(page)).toContainText('Урок остаётся в расписании до подтверждения.');
  await expect(dialog(page)).toContainText('Номер задачи');
  expect((await state(request)).lessonRequests).toHaveLength(1);
  expect(await commands(request)).toHaveLength(1);
  const after = await (await request.get('/api/v1/student/lessons/' + lessonId)).json();
  expect(after.scheduledAt).toBe(before.scheduledAt);
  expect(after.status).toBe(before.status);
  expect(await (await request.get('/api/v1/student/lessons/history')).json()).toEqual(
    balancesBefore,
  );
});

test('unknown result survives reopening and reconciles through GET using original key', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context }, 'ro', { lostResponse: true });
  await goto(page, detail(completedId));
  await page.getByRole('button', { name: 'Contestă deducerea', exact: true }).click();
  await dialog(page)
    .getByRole('textbox', { name: /Причина|Motiv|Что произошло|Ce s-a întâmplat/ })
    .fill('Прошу проверить списание за этот конкретный урок.');
  await dialog(page).getByRole('button', { name: 'Trimite cererea' }).click();
  await expect(dialog(page)).toContainText('Rezultatul trimiterii este încă necunoscut.');
  await shot(page, 'ro-unknown');
  await page.keyboard.press('Escape');
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).some((key) => key.startsWith('k8k.lesson-intent.')),
    ),
  ).toBe(true);
  await page.reload();
  await page.getByRole('button', { name: 'Verifică rezultatul', exact: true }).click();
  await expect(
    dialog(page).getByRole('textbox', { name: /Причина|Motiv|Что произошло|Ce s-a întâmplat/ }),
  ).toHaveCount(0);
  await dialog(page).getByRole('button', { name: 'Verifică rezultatul', exact: true }).click();
  await expect(dialog(page)).toContainText(
    'Contestația a fost transmisă managerului pentru analiză.',
  );
  expect(await commands(request)).toHaveLength(1);
  const data = await state(request);
  expect(data.lessonRequests).toHaveLength(1);
  const command = (await commands(request))[0];
  expect(
    data.calls.some(
      ({ method, path }) => method === 'GET' && path.endsWith('/requests/' + command.key),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).some((key) => key.startsWith('k8k.lesson-intent.')),
    ),
  ).toBe(false);
});

test('unknown absent receipt stays unknown without a new command', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context }, 'ru', { commandError: 503 });
  await goto(page, detail(completedId));
  await page.getByRole('button', { name: 'Оспорить списание', exact: true }).click();
  await dialog(page)
    .getByRole('textbox', { name: /Причина|Motiv|Что произошло|Ce s-a întâmplat/ })
    .fill('Прошу проверить списание за этот конкретный урок.');
  await dialog(page).getByRole('button', { name: 'Отправить запрос' }).click();
  await dialog(page).getByRole('button', { name: 'Проверить результат', exact: true }).click();
  await expect(dialog(page)).toContainText('Создание задачи пока не подтверждено.');
  await expect(dialog(page).getByRole('button', { name: 'Отправить запрос' })).toHaveCount(0);
  expect(await commands(request)).toHaveLength(1);
});

test('open-case conflict differs from success', async ({ page, request, context }) => {
  await setup({ request, context }, 'ru', { commandError: 409 });
  await goto(page, detail(completedId));
  await page.getByRole('button', { name: 'Оспорить списание', exact: true }).click();
  await dialog(page)
    .getByRole('textbox', { name: /Причина|Motiv|Что произошло|Ce s-a întâmplat/ })
    .fill('Прошу проверить списание за этот конкретный урок.');
  await dialog(page).getByRole('button', { name: 'Отправить запрос' }).click();
  await expect(dialog(page)).toContainText('уже есть открытый спор');
  await expect(dialog(page).getByRole('button', { name: 'Отправить запрос' })).toBeDisabled();
});

test('history stale and forbidden never expose cached dispute actions or snapshots', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context });
  await goto(page, detail(completedId));
  await expect(page.getByText('9007199254740993', { exact: true })).toBeVisible();
  await patch(request, { historyError: 503 });
  await page.getByRole('button', { name: 'Оспорить списание', exact: true }).click();
  await dialog(page)
    .getByRole('textbox', { name: /Причина|Motiv|Что произошло|Ce s-a întâmplat/ })
    .fill('Черновик сохраняется во время обновления.');
  await refresh(page);
  await expect(
    dialog(page).getByRole('textbox', { name: /Причина|Motiv|Что произошло|Ce s-a întâmplat/ }),
  ).toHaveValue('Черновик сохраняется во время обновления.');
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: '← К расписанию' }).click();
  await page.locator('.lesson-row a[href*="' + completedId + '"]').click();
  await expect(page.getByText('9007199254740993', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Оспорить списание', exact: true })).toBeDisabled();
  await patch(request, { historyError: 403 });
  await page.getByRole('link', { name: '← К расписанию' }).click();
  await page.locator('.lesson-row a[href*="' + completedId + '"]').click();
  await expect(page.getByText('9007199254740993', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Оспорить списание', exact: true })).toHaveCount(0);
  await shot(page, 'ru-history-forbidden');
});

test('command denial removes private context and invalid trimmed input sends nothing', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context }, 'ru', { commandError: 403 });
  await goto(page, detail(completedId));
  await expect(page.getByText('9007199254740993', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Оспорить списание', exact: true }).click();
  const input = dialog(page).locator('textarea');
  await input.fill('          ');
  await dialog(page).getByRole('button', { name: 'Отправить запрос' }).click();
  await expect(dialog(page)).toContainText('Проверь длину заполненного текста.');
  expect(await commands(request)).toHaveLength(0);
  await input.fill('Прошу проверить списание за этот конкретный урок.');
  await dialog(page).getByRole('button', { name: 'Отправить запрос' }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.getByText('9007199254740993', { exact: true })).toHaveCount(0);
});

test('session expiry clears unresolved key and discards an earlier private history response', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context }, 'ru', { commandError: 503 });
  await goto(page, detail(completedId));
  await page.getByRole('button', { name: 'Оспорить списание', exact: true }).click();
  await dialog(page).locator('textarea').fill('Прошу проверить списание за этот конкретный урок.');
  await dialog(page).getByRole('button', { name: 'Отправить запрос' }).click();
  await expect(dialog(page)).toContainText('Результат отправки пока неизвестен.');
  await page.keyboard.press('Escape');
  let release, entered, finished;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  const completed = new Promise((resolve) => {
    finished = resolve;
  });
  await page.route('**/api/v1/student/lessons/history?*', async (route) => {
    const response = await route.fetch();
    entered();
    await gate;
    try {
      await route.fulfill({ response });
    } catch {
      // Session revocation can abort the browser read before this response is released.
    } finally {
      finished();
    }
  });
  await page.getByRole('link', { name: '← К расписанию' }).click();
  await started;
  await patch(request, { auth: false });
  await page.evaluate(() => globalThis.dispatchEvent(new Event('focus')));
  await expect(page).toHaveURL(/\/student\/login/);
  release();
  await completed;
  await expect(page.getByText('9007199254740993', { exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).some((key) => key.startsWith('k8k.lesson-intent.')),
    ),
  ).toBe(false);
});

test('TASK-028 current Meet remains through T0 and closes at the server deadline', async ({
  page,
  request,
  context,
}) => {
  const start = new Date().toISOString();
  const nearClose = new Date(Date.parse(start) + 3_595_000).toISOString();
  await setup({ request, context }, 'ru', {
    lessonJourney: false,
    meetSnapshot: { asOf: nearClose, scheduledAt: start },
  });
  await page.clock.install();
  await goto(page, '/student');
  await expect(page.locator('.k8k-lesson-hero a[href^="https://meet.google.com/"]')).toBeVisible();
  await expect(page.locator('.k8k-lesson-hero')).toContainText('Урок начался');
  await goto(page, detail());
  await expect(page.locator('.lesson-row a[href^="https://meet.google.com/"]')).toBeVisible();
  await patch(request, {
    meetSnapshot: {
      asOf: new Date(Date.parse(start) + 3_600_001).toISOString(),
      scheduledAt: start,
    },
  });
  await page.clock.runFor(5_100);
  await expect(page.locator('a[href^="https://meet.google.com/"]')).toHaveCount(0);
  expect(await commands(request)).toHaveLength(0);
});

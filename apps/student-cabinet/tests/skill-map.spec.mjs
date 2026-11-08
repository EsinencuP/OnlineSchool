import { expect, test } from './gate-fixtures.mjs';
import { evidenceUrl } from './gate-fixtures.mjs';
import { fileURLToPath } from 'node:url';
import { english, math, historical, skillFixture } from './skill-journey-fixtures.mjs';
const route = '/student/skills';
const state = async (request) => (await request.get('/__fixture/state')).json();
const patch = (request, data) => request.patch('/__fixture/state', { data });
async function setup({ request, context }, locale = 'ru', data = {}) {
  await request.post('/__fixture/reset', { data: { ...skillFixture(), ...data } });
  await context.addCookies((await request.storageState()).cookies);
  await context.addInitScript((locale) => localStorage.setItem('k8k.locale', locale), locale);
  await context.route('**/*', (route) =>
    new URL(route.request().url()).origin === 'http://127.0.0.1:4175'
      ? route.continue()
      : route.abort(),
  );
}
const shot = async (page, name) => {
  await page.evaluate(() => globalThis.document.fonts.ready);
  await page.screenshot({
    path: fileURLToPath(
      evidenceUrl('../../../output/k8k-tasks/TASK-031/after/' + name + '.png', import.meta.url),
    ),
    animations: 'disabled',
  });
};
test.afterEach(async ({ request }) => {
  const value = await state(request);
  expect(value.missingRoutes).toEqual([]);
  expect(
    value.calls.filter(
      (call) => call.path.startsWith('/api/v1/student/skills') && call.method !== 'GET',
    ),
  ).toEqual([]);
});
for (const locale of ['ru', 'ro']) {
  test(
    'TASK-031 four states, goals, audit and snapshots layout ' + locale,
    async ({ page, request, context }) => {
      test.setTimeout(60_000);
      await setup({ request, context }, locale);
      const ro = locale === 'ro';
      for (const width of [360, 768, 1024, 1280]) {
        await page.setViewportSize({ width, height: width === 360 ? 800 : 900 });
        await page.goto(route + '?subjectId=' + english + '&ui.k8k=1');
        await expect(page.locator('.k8k-skill-list>li')).toHaveCount(4);
        await expect(page.locator('.k8k-stages li')).toHaveCount(3);
        await expect(page.locator('.k8k-stages [data-skill-status="NOT_STUDIED"]')).toHaveCount(0);
        for (const status of ['NOT_STUDIED', 'FAMILIARIZING', 'PRACTICING', 'APPLYING'])
          await expect(
            page.locator('.k8k-skill-list [data-skill-status="' + status + '"]'),
          ).toHaveCount(1);
        await expect(
          page.getByText(
            ro
              ? 'Evaluarea profesorului nu a fost încă publicată.'
              : 'Проверка преподавателя ещё не опубликована.',
          ),
        ).toBeVisible();
        await expect(
          page.getByText(ro ? 'Fără termen' : 'Без срока', { exact: true }),
        ).toBeVisible();
        await expect(page.locator('.k8k-skill-list>li').nth(1)).toContainText(
          ro ? '3 octombrie 2026' : '3 октября 2026',
        );
        await page.evaluate(() => globalThis.scrollTo(0, 0));
        await shot(page, locale + '-' + width + '-map');
        const history = page.locator('.k8k-skill-list>li').nth(1).locator('button[aria-expanded]');
        await history.focus();
        await expect(history).toBeFocused();
        expect((await history.boundingBox()).height).toBeGreaterThanOrEqual(44);
        await history.press('Enter');
        await expect(history).toHaveAttribute('aria-expanded', 'true');
        await expect(page.getByText('Возвращаемся к практике', { exact: true })).toBeVisible();
        await expect(page.getByText('Начинаем снова', { exact: true })).toBeVisible();
        await expect(page.getByText(/PRIVATE_BASIS|PRIVATE_NOTES/)).toHaveCount(0);
        await shot(page, locale + '-' + width + '-audit');
        await history.press('Enter');
        await expect(history).toHaveAttribute('aria-expanded', 'false');
        await expect(history).toBeFocused();
        const snapshot = page.locator('.k8k-skill-snapshot').first().locator('summary');
        await snapshot.focus();
        await snapshot.press('Enter');
        await expect(
          page
            .locator('.k8k-skill-snapshot')
            .first()
            .getByText('Старое название навыка', { exact: true }),
        ).toBeVisible();
        await expect(
          page
            .locator('.k8k-skill-snapshot')
            .first()
            .getByText('Публичный комментарий на момент среза', { exact: true }),
        ).toBeVisible();
        await shot(page, locale + '-' + width + '-snapshot');
        expect(
          await page.evaluate(() => globalThis.document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        await expect(
          page.locator(
            '.k8k-skills-page [role="progressbar"],.k8k-skills-page input[type="checkbox"]',
          ),
        ).toHaveCount(0);
        await page.goto('/student?ui.k8k=1');
        const preview = page.locator('[data-module="DASH-STU-04"]');
        await preview.scrollIntoViewIfNeeded();
        await expect(
          preview.getByRole('link', { name: 'Исторический предмет', exact: true }),
        ).toBeVisible();
        await shot(page, locale + '-' + width + '-home');
        expect(
          await page.evaluate(() => globalThis.document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
      }
    },
  );
}
test('TASK-031 audit pages preserve server total and beyond-end is empty, frozen titles survive rename', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context });
  await page.goto(route + '?subjectId=' + english + '&ui.k8k=1');
  const history = page.locator('.k8k-skill-list>li').nth(1).locator('button[aria-expanded]');
  await history.click();
  const panel = page
    .locator('[id=' + JSON.stringify(await history.getAttribute('aria-controls')) + ']')
    .filter({ visible: true });
  await expect(panel.locator('.versions>li')).toHaveCount(20);
  await panel.getByRole('button', { name: 'Далее', exact: true }).click();
  await expect(panel.locator('.versions>li')).toHaveCount(3);
  expect(
    (await state(request)).calls.some(
      (call) =>
        call.path.includes('/skills/audit') && new URLSearchParams(call.query).get('page') === '2',
    ),
  ).toBeTruthy();
  const data = skillFixture();
  data.skillMaps[0].skills[1].name = 'Переименовано сегодня';
  await patch(request, { skillMaps: data.skillMaps });
  await page.getByRole('button', { name: 'Обновить навыки', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Переименовано сегодня', exact: true }),
  ).toBeVisible();
  await page.locator('.k8k-skill-snapshot').first().locator('summary').click();
  await expect(
    page
      .locator('.k8k-skill-snapshot')
      .first()
      .getByText('Старое название навыка', { exact: true }),
  ).toBeVisible();
  await page.goto(route + '?subjectId=' + english + '&snapshotPage=99&ui.k8k=1');
  await expect(page.getByText('Подтверждённых срезов пока нет.', { exact: true })).toBeVisible();
  await expect(page.locator('.k8k-skill-snapshot')).toHaveCount(0);
  const last = (await state(request)).calls
    .filter((call) => call.path.endsWith('/skills/snapshots'))
    .at(-1);
  expect(Object.fromEntries(new URLSearchParams(last.query))).toMatchObject({
    subjectId: english,
    page: '99',
  });
  await expect(page.getByText('Подтверждённых срезов пока нет.', { exact: true })).toBeVisible();
});
test('TASK-031 subject URL includes historical study and does not silently choose first or filter global snapshot page', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context });
  await page.goto(route + '?subjectId=' + historical + '&ui.k8k=1');
  await expect(
    page.getByRole('heading', { name: 'Исторический предмет', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Навык прошлого курса', { exact: true })).toBeVisible();
  await expect(page.locator('.k8k-skill-snapshot')).toHaveCount(1);
  await expect(page.locator('.k8k-skill-snapshot summary')).toContainText('Исторический предмет');
  await page.getByLabel('Предмет', { exact: true }).selectOption(math);
  expect(new URL(page.url()).searchParams.get('subjectId')).toBe(math);
  await expect(page.getByText('Навыки ещё не добавлены.', { exact: true })).toBeVisible();
  await expect(page.getByText('Обсуди цели с преподавателем.', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Срок следующего пересмотра пока не указан.', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.k8k-skill-snapshot')).toHaveCount(0);
  await page.getByLabel('Предмет', { exact: true }).selectOption(english);
  await expect(page.locator('.k8k-skill-snapshot')).toHaveCount(20);
  const pages = page.locator('.panel').last();
  await pages.getByRole('button', { name: 'Далее', exact: true }).click();
  await expect(page.locator('.k8k-skill-snapshot')).toHaveCount(3);
  expect(new URL(page.url()).searchParams.get('snapshotPage')).toBe('2');
  const calls = (await state(request)).calls.filter((call) =>
    call.path.endsWith('/skills/snapshots'),
  );
  expect(Object.fromEntries(new URLSearchParams(calls.at(-1).query))).toMatchObject({
    subjectId: english,
    page: '2',
  });
});
test('TASK-031 unknown subject and forbidden cached read hide records without fallback', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context });
  await page.goto(route + '?subjectId=' + english + '&ui.k8k=1');
  await expect(page.locator('.k8k-skill-list>li')).toHaveCount(4);
  await patch(request, { skillsError: 403 });
  await page.getByRole('button', { name: 'Обновить навыки', exact: true }).click();
  await expect(page.locator('.k8k-skill-list>li')).toHaveCount(0);
  await expect(page.getByText('Рассказать о любимой книге', { exact: true })).toHaveCount(0);
  await patch(request, { skillsError: null });
  await page.goto(route + '?subjectId=60000000-0000-4000-8000-999999999999&ui.k8k=1');
  await expect(page.locator('.k8k-skill-list>li')).toHaveCount(0);
  await expect(page.locator('.k8k-skill-snapshot')).toHaveCount(0);
  await page.goto(route + '?subjectId=' + english + '&subjectId=' + math + '&ui.k8k=1');
  await expect(page.locator('.k8k-skill-list>li')).toHaveCount(0);
});
test('TASK-031 published refresh on return, stale read and session expiry keep meaning and private boundary', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context });
  await page.clock.install();
  await page.goto(route + '?subjectId=' + english + '&ui.k8k=1');
  await expect(page.locator('.k8k-skill-list>li')).toHaveCount(4);
  await patch(request, { skillsError: 503 });
  await page.getByRole('button', { name: 'Обновить навыки', exact: true }).click();
  await expect(page.locator('.k8k-skill-list>li')).toHaveCount(4);
  await expect(
    page
      .getByText('Данные могли устареть. Проверяйте актуальный статус перед действием.', {
        exact: true,
      })
      .first(),
  ).toBeVisible();
  await shot(page, 'ru-stale');
  const data = skillFixture();
  data.skillMaps[0].skills[1].status = 'APPLYING';
  await patch(request, { skillsError: null, skillMaps: data.skillMaps });
  await page.getByRole('link', { name: 'Отчёты после 8 уроков', exact: true }).click();
  await expect(page).toHaveURL(/\/student\/reports$/);
  await page.getByRole('link', { name: 'Мой путь знаний', exact: true }).click();
  await expect(page.locator('.k8k-skill-list [data-skill-status="APPLYING"]')).toHaveCount(2);
  await patch(request, { auth: false });
  await page.getByRole('button', { name: 'Обновить навыки', exact: true }).click();
  await expect(page).toHaveURL(/\/student\/login/);
  await expect(page.locator('.k8k-skill-list')).toHaveCount(0);
});
test('TASK-031 dashboard previews each subject goal, and skill reads never create an eight-lesson report', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context }, 'ro');
  await page.goto('/student?ui.k8k=1');
  const knowledge = page.locator('[data-module="DASH-STU-04"]');
  await expect(
    knowledge.getByRole('link', { name: 'Исторический предмет', exact: true }),
  ).toHaveAttribute('href', route + '?subjectId=' + historical);
  await expect(knowledge.getByText('Рассказать о любимой книге')).toBeVisible();
  await expect(knowledge.getByText('Старое название навыка', { exact: true })).toHaveCount(0);
  await expect(knowledge.locator('.k8k-stages li')).toHaveCount(3);
  await knowledge.scrollIntoViewIfNeeded();
  await shot(page, 'ro-dashboard');
  await knowledge.getByRole('link', { name: 'Исторический предмет', exact: true }).click();
  await expect(page.locator('.k8k-skill-snapshot')).toHaveCount(1);
  await page.locator('.k8k-skill-snapshot summary').click();
  const calls = (await state(request)).calls;
  expect(
    calls.filter((call) => call.method !== 'GET' && /skills|checkpoint|report/.test(call.path)),
  ).toEqual([]);
  expect(calls.some((call) => call.path.endsWith('/student/reports'))).toBe(false);
});

test('TASK-031 loading, initial error and owned empty maps remain distinct', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context }, 'ro', { skillsError: 503 });
  await page.goto(route + '?ui.k8k=1');
  await expect(page.locator('.k8k-skill-list')).toHaveCount(0);
  await expect(
    page.getByText('Solicitarea nu a putut fi executată.', { exact: true }).first(),
  ).toBeVisible();
  await patch(request, { skillsError: null, skillMaps: [], skillSnapshots: [], skillsDelay: 1000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Se încarcă datele…', { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText('Disciplinele nu au fost încă atribuite.', { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText('Disciplinele nu au fost încă atribuite.', { exact: true }),
  ).toBeVisible();
});

test('TASK-031 a late skill response cannot restore private content after session revocation', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context });
  await page.goto(route + '?subjectId=' + english + '&ui.k8k=1');
  await expect(page.locator('.k8k-skill-list>li')).toHaveCount(4);
  let release, finish;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const finished = new Promise((resolve) => {
    finish = resolve;
  });
  let intercepted = false;
  await page.route('**/api/v1/student/skills?subjectId=*', async (pending) => {
    intercepted = true;
    await gate;
    await pending.fulfill({ json: skillFixture().skillMaps.slice(0, 1) }).catch(() => undefined);
    finish();
  });
  await page.getByRole('button', { name: 'Обновить навыки', exact: true }).click();
  await expect.poll(() => intercepted).toBe(true);
  await patch(request, { auth: false });
  await page.goto('/student/reports?ui.k8k=1');
  await expect(page).toHaveURL(/\/student\/login/);
  release();
  await finished;
  await expect(page.locator('.k8k-skill-list')).toHaveCount(0);
  await expect(page.getByText('Рассказать о любимой книге', { exact: true })).toHaveCount(0);
});

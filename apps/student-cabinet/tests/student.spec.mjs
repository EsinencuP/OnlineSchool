import { test, expect } from '@playwright/test';
/* global document, innerWidth */
import { homeworkId, lessonId } from './fixture-server.mjs';
test.beforeEach(async ({ request, context }) => {
  await request.post('/__fixture/reset', { data: {} });
  await context.addCookies((await request.storageState()).cookies);
});
const state = async (request) => (await request.get('/__fixture/state')).json();
const patch = (request, data) => request.patch('/__fixture/state', { data });
test.afterEach(async ({ request }) => {
  expect((await state(request)).missingRoutes).toEqual([]);
});
test('login → forced password → dashboard → direct upload → submission → unchanged balance', async ({
  page,
  request,
}) => {
  await patch(request, { auth: false, mustChangePassword: true, submitDelay: 350 });
  await page.goto('/student/login');
  await page.getByLabel('Email', { exact: true }).fill('student@example.invalid');
  await page.getByLabel('Пароль', { exact: true }).fill('Temporary123');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/change-password$/);
  await page.getByLabel('Текущий пароль', { exact: true }).fill('Temporary123');
  await page.getByLabel('Новый пароль', { exact: true }).fill('StudentPassword123');
  await page.getByLabel('Повторите новый пароль').fill('StudentPassword123');
  await page.getByRole('button', { name: 'Изменить пароль', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Привет, София/ })).toBeVisible();
  await expect(page.locator('.summary-grid>.summary')).toHaveCount(4);
  await page.goto(`/student/homework/${homeworkId}`);
  await page.getByLabel('Твой ответ').fill('I have visited London.');
  let uploadHeaders;
  await page.route('https://upload.student.test/presigned', async (route) => {
    uploadHeaders = route.request().headers();
    await route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' });
  });
  await page
    .getByLabel('Прикрепить файл')
    .setInputFiles({ name: 'answer.txt', mimeType: 'text/plain', buffer: Buffer.from('answer') });
  await expect(page.getByRole('button', { name: 'Убрать answer.txt', exact: true })).toBeVisible();
  expect(uploadHeaders.cookie).toBeUndefined();
  expect(uploadHeaders['x-csrf-token']).toBeUndefined();
  await page.getByRole('button', { name: 'Сдать работу', exact: true }).click();
  await expect(page.getByLabel('Твой ответ')).toBeDisabled();
  await expect(page.getByText('Работа сдана. Ждём комментарий преподавателя.')).toBeVisible();
  await expect(page.getByText('Сдано с опозданием', { exact: true })).toBeVisible();
  const result = await state(request);
  expect(result.confirmed).toBe(true);
  expect(result.submitted).toBe(true);
  const writes = result.calls.filter((c) => !['GET', 'HEAD'].includes(c.method));
  expect(writes.every((c) => c.csrf === 'fixture-csrf')).toBe(true);
  expect(
    writes.filter((c) => c.path.includes('/homework/')).every((c) => /^[\da-f-]{36}$/.test(c.key)),
  ).toBe(true);
  await page.goto('/student/subscription');
  await expect(page.locator('#main-content>section .balance strong')).toHaveText('6');
  await expect(page.getByRole('button', { name: /Оплатить|Карта|Пополнить/ })).toHaveCount(0);
});
test('debounce, server draft restoration and chronological versions', async ({ page, request }) => {
  await page.goto(`/student/homework/${homeworkId}`);
  await page.getByLabel('Твой ответ').fill('Первый текст');
  await page.waitForTimeout(700);
  await page.getByLabel('Твой ответ').fill('Последний текст');
  expect((await state(request)).calls.filter((c) => c.path.endsWith('/draft'))).toHaveLength(0);
  await expect.poll(async () => (await state(request)).draft).toBe('Последний текст');
  await expect(page.getByText('Черновик сохранён', { exact: true })).toBeVisible();
  expect((await state(request)).calls.filter((c) => c.path.endsWith('/draft'))).toHaveLength(1);
  await page.reload();
  await expect(page.getByLabel('Твой ответ')).toHaveValue('Последний текст');
  const versions = await page.locator('.versions>li h3').allTextContents();
  expect(versions[0]).toContain('Версия 1');
  expect(versions[1]).toContain('Версия 2');
});
test('lesson periods, calendar and manager reschedule request', async ({ page, request }) => {
  await page.goto('/student/lessons');
  for (const [label, period] of [
    ['Сегодня', 'today'],
    ['Неделя', 'week'],
    ['Месяц', 'month'],
    ['Архив', 'archive'],
  ]) {
    await page.getByRole('button', { name: label, exact: true }).click();
    await expect
      .poll(async () =>
        (await state(request)).calls.some((c) => c.query.includes(`period=${period}`)),
      )
      .toBe(true);
  }
  await expect(page.getByText('В этом периоде уроков нет.')).toBeVisible();
  await page.getByRole('button', { name: 'Календарь', exact: true }).click();
  await expect(page.getByLabel('Месяц', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Запросить перенос', exact: true }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await modal.getByLabel('Причина').fill('В это время занят в школе');
  await modal.getByLabel('Желаемая дата').fill('2027-01-11');
  await modal.getByRole('button', { name: 'Отправить запрос' }).click();
  await expect(modal.getByText(/Запрос передан менеджеру/)).toBeVisible();
  expect(
    (await state(request)).calls.filter((c) => c.path.endsWith('/reschedule-request')),
  ).toHaveLength(1);
});
test('server canJoin authority and protected direct links', async ({ page }) => {
  await page.goto('/student/lessons');
  await expect(
    page.locator('.lesson-row').first().getByRole('link', { name: 'Подключиться', exact: true }),
  ).toHaveAttribute('href', /^https:\/\/meet.google.com/);
  await expect(
    page.locator('.lesson-row').nth(1).getByRole('button', { name: 'Подключиться', exact: true }),
  ).toBeDisabled();
  await page.goto(`/student/lessons/${lessonId}`);
  await expect(page.locator('main .lesson-row')).toHaveCount(1);
});
test('402 suspends without navigation and 403 forces password on any request', async ({
  page,
  request,
}) => {
  await page.goto('/student');
  await expect(page.getByRole('heading', { name: /Привет/ })).toBeVisible();
  await patch(request, { active: false });
  await page
    .getByRole('navigation', { name: 'Основная навигация' })
    .getByRole('link', { name: 'Абонемент', exact: true })
    .click();
  await expect(page).toHaveURL(/suspended$/);
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute(
    'href',
    /^https:\/\/wa.me/,
  );
  await patch(request, { active: true, mustChangePassword: true });
  await page.goto('/student/homework');
  await expect(page).toHaveURL(/change-password$/);
});
test('read-all resets both notification counters', async ({ page }) => {
  await page.goto('/student/notifications');
  await expect(page.getByText('Непрочитанных: 2')).toBeVisible();
  await expect(page.locator('.bell .badge')).toHaveText('2');
  await expect(
    page.getByRole('navigation', { name: 'Основная навигация' }).locator('.badge'),
  ).toHaveText('2');
  await page.getByRole('button', { name: 'Прочитать все' }).click();
  await expect(page.getByText('Непрочитанных: 0')).toBeVisible();
  await expect(page.locator('.bell .badge')).toHaveCount(0);
});
test('mobile five-item navigation, trapped drawer, tablet and desktop sizes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/student');
  await expect(page.getByRole('heading', { name: /Привет/ })).toBeVisible();
  await expect(page.locator('.bottom-nav>a,.bottom-nav>button')).toHaveCount(5);
  await expect(page.locator('.left-sidebar')).toBeHidden();
  await expect(page.locator('.content-grid>.right-sidebar')).toBeHidden();
  await page.getByRole('button', { name: 'Все разделы', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '../../output/stu12/mobile.png', fullPage: true });
  await page.setViewportSize({ width: 820, height: 1180 });
  await expect(page.getByRole('button', { name: 'Открыть меню' })).toBeVisible();
  await page.setViewportSize({ width: 1600, height: 1000 });
  await expect(page.locator('.left-sidebar')).toHaveCSS('width', '240px');
  await expect(page.locator('.content-grid>.right-sidebar')).toHaveCSS('width', '320px');
  await page.screenshot({ path: '../../output/stu12/desktop.png', fullPage: true });
});
test('failed save stays editable, blocks accidental navigation and retries', async ({
  page,
  request,
}) => {
  await patch(request, { failDraft: true });
  await page.goto(`/student/homework/${homeworkId}`);
  await page.getByLabel('Твой ответ').fill('Сохранить мою работу');
  await expect(page.getByRole('button', { name: 'Повторить сохранение' })).toBeVisible();
  await page.getByRole('link', { name: '← Все задания' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Остаться', exact: true }).click();
  await patch(request, { failDraft: false });
  await page.getByRole('button', { name: 'Повторить сохранение' }).click();
  await expect(page.getByText('Черновик сохранён', { exact: true })).toBeVisible();
});

test('confirmation and submission retry the same intent after provider/server failures', async ({
  page,
  request,
}) => {
  await patch(request, { failConfirm: true, failSubmit: true });
  await page.goto(`/student/homework/${homeworkId}`);
  await page.getByLabel('Твой ответ').fill('My answer for retry.');
  let puts = 0;
  await page.route('https://upload.student.test/presigned', async (route) => {
    puts++;
    await route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' });
  });
  await page
    .getByLabel('Прикрепить файл')
    .setInputFiles({ name: 'retry.txt', mimeType: 'text/plain', buffer: Buffer.from('answer') });
  await expect(page.getByRole('button', { name: 'Повторить загрузку' })).toBeVisible();
  await patch(request, { failConfirm: false });
  await page.getByRole('button', { name: 'Повторить загрузку' }).click();
  await expect(page.getByRole('button', { name: 'Убрать retry.txt' })).toBeVisible();
  expect(puts).toBe(1);
  let calls = (await state(request)).calls.filter((c) => c.path.endsWith('/confirm'));
  expect(calls).toHaveLength(2);
  expect(calls[0].key).toBe(calls[1].key);
  await page.getByRole('button', { name: 'Сдать работу', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await patch(request, { failSubmit: false });
  await page.getByRole('button', { name: 'Сдать работу', exact: true }).click();
  await expect(page.getByText('Работа сдана. Ждём комментарий преподавателя.')).toBeVisible();
  calls = (await state(request)).calls.filter((c) => c.path.endsWith('/submit'));
  expect(calls).toHaveLength(2);
  expect(calls[0].key).toBe(calls[1].key);
});

test('serialized slow draft writes preserve the latest edit', async ({ page, request }) => {
  await patch(request, { draftDelay: 800 });
  await page.goto(`/student/homework/${homeworkId}`);
  await page.getByLabel('Твой ответ').fill('Первая правка');
  await expect
    .poll(async () => (await state(request)).calls.filter((c) => c.path.endsWith('/draft')).length)
    .toBe(1);
  await page.getByLabel('Твой ответ').fill('Вторая правка');
  await expect.poll(async () => (await state(request)).draft).toBe('Вторая правка');
  const calls = (await state(request)).calls.filter((c) => c.path.endsWith('/draft'));
  expect(calls.map((c) => c.body.content)).toEqual(['Первая правка', 'Вторая правка']);
  expect(calls[0].key).not.toBe(calls[1].key);
});

test('suspension is public and offers no navigation or unrelated actions', async ({
  page,
  request,
}) => {
  await patch(request, { auth: false });
  await page.goto('/student/suspended');
  await expect(page.getByRole('heading', { name: 'Доступ приостановлен' })).toBeVisible();
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await expect(page.getByRole('button')).toHaveCount(0);
  await expect(page).toHaveURL(/suspended$/);
});

test('all cabinet pages fit a narrow viewport and expose the four skill states', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const path of [
    '',
    '/lessons',
    `/lessons/${lessonId}`,
    '/homework',
    `/homework/${homeworkId}`,
    '/skills',
    '/materials',
    '/subscription',
    '/notifications',
    '/profile',
    '/security',
    '/security/change-password',
    '/suspended',
    '/login',
  ]) {
    await page.goto(`/student${path}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      path,
    ).toBe(true);
  }
  await page.goto('/student/skills');
  for (const name of ['Ещё не изучали', 'Знакомлюсь', 'Практикую', 'Применяю'])
    await expect(page.locator('main .skill-list').getByText(name, { exact: true })).toBeVisible();
});

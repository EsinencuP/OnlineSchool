import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const id = '20000000-0000-4000-8000-000000000001';
const path = '/student/homework/' + id;
const state = async (request) => await (await request.get('/__fixture/state')).json();
const patch = (request, data) => request.patch('/__fixture/state', { data });
const calls = async (request, suffix) =>
  (await state(request)).calls.filter((call) => call.path.endsWith(suffix));
const answer = (page) => page.locator('.k8k-homework-answer textarea');
async function setup({ request, context }, locale = 'ru', data = {}) {
  await request.post('/__fixture/reset', { data });
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
      new URL('../../../output/k8k-tasks/TASK-030/after/' + name + '.png', import.meta.url),
    ),
    animations: 'disabled',
  });
};
const refresh = (page, ro = false) =>
  page.getByRole('button', { name: ro ? 'Actualizează tema' : 'Обновить задание' }).click();

for (const locale of ['ru', 'ro']) {
  test('TASK-030 list/editor/history layout ' + locale, async ({ page, request, context }) => {
    test.setTimeout(60_000);
    const longName = 'Елена ' + 'ДлиннаяФамилия'.repeat(8).slice(0, 94);
    await setup({ request, context }, locale, { homeworkTeacher: longName, homeworkDueAt: null });
    const ro = locale === 'ro';
    for (const width of [360, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: width === 360 ? 800 : 900 });
      await page.goto('/student/homework?status=NEEDS_REVISION&page=1&ui.k8k=1');
      await expect(page.locator('.k8k-homework-list .k8k-list-row')).toHaveCount(1);
      await expect(
        page.getByText(ro ? 'Fără termen de predare' : 'Без срока сдачи', { exact: true }),
      ).toBeVisible();
      await expect(page.locator('[role="tablist"], input[type="checkbox"]')).toHaveCount(0);
      await shot(page, locale + '-' + width + '-list');
      await page
        .getByRole('link', { name: 'Present Perfect. Рассказ о путешествии', exact: true })
        .click();
      await expect(answer(page)).toBeVisible();
      expect(
        (await page.locator('.k8k-homework-submit').boundingBox()).height,
      ).toBeGreaterThanOrEqual(48);
      const attach = page.getByRole('button', {
        name: ro ? 'Atașează un fișier' : 'Прикрепить файл',
        exact: true,
      });
      await attach.focus();
      await expect(attach).toBeFocused();
      expect((await attach.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await expect(
        page.getByText(ro ? 'Ciorna este salvată' : 'Черновик сохранён', { exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole('button', { name: ro ? 'Predă tema' : 'Сдать работу', exact: true }),
      ).toBeDisabled();
      await answer(page).focus();
      await expect(answer(page)).toBeFocused();
      await shot(page, locale + '-' + width + '-editor');
      await page
        .getByRole('heading', { name: ro ? 'Istoricul versiunilor' : 'История версий' })
        .scrollIntoViewIfNeeded();
      await expect(page.locator('.versions > li')).toHaveCount(2);
      await shot(page, locale + '-' + width + '-history');
      expect(
        await page.evaluate(() => globalThis.document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await page.getByRole('link', { name: ro ? '← Toate temele' : '← Все задания' }).click();
      expect(new URL(page.url()).searchParams.get('status')).toBe('NEEDS_REVISION');
      expect(new URL(page.url()).searchParams.get('page')).toBe('1');
    }
  });
}

test('TASK-030 refetch preserves text/selection and expired draft cannot replace unsaved input', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context }, 'ru', { draft: 'Исходный черновик', failDraft: true });
  await page.clock.install();
  await page.goto(path + '?ui.k8k=1');
  const text = '  Неподтверждённая редакция\nс пробелами  ';
  await answer(page).fill(text);
  await page.clock.runFor(2100);
  await expect(page.getByRole('button', { name: 'Повторить сохранение' })).toBeVisible();
  await patch(request, { expiredDraft: true });
  await answer(page).evaluate((node) => {
    node.focus();
    node.setSelectionRange(4, 12);
  });
  await page.getByRole('button', { name: 'Обновить задание' }).evaluate((node) => node.click());
  await expect(answer(page)).toHaveValue(text);
  await expect(answer(page)).toBeFocused();
  expect(await answer(page).evaluate((node) => [node.selectionStart, node.selectionEnd])).toEqual([
    4, 12,
  ]);
  await shot(page, 'ru-save-failed');
  await patch(request, { failDraft: false });
  await page.getByRole('button', { name: 'Повторить сохранение' }).click();
  await expect(page.getByText('Черновик сохранён', { exact: true })).toBeVisible();
  await expect(answer(page)).toBeFocused();
  expect((await state(request)).draft).toBe(text);
});

test('TASK-030 an expired saved draft remains in the editor and loses its saved claim', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context }, 'ru', { draft: 'Сохранённый текст' });
  await page.clock.install();
  await page.goto(path + '?ui.k8k=1');
  await expect(page.getByText('Черновик сохранён', { exact: true })).toBeVisible();
  await patch(request, { expiredDraft: true, failDraft: true });
  await refresh(page);
  await expect(answer(page)).toHaveValue('Сохранённый текст');
  await expect(page.getByText('Черновик сохранён', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Изменения не сохранены', { exact: true })).toBeVisible();
});

test('TASK-030 committed lost submit response is reconciled without a second command and revision keeps history', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context }, 'ro', { loseSubmitResponse: true });
  await page.goto(path + '?ui.k8k=1');
  const first = '  Răspunsul meu\nТекст с пробелами  ';
  await answer(page).fill(first);
  await page.getByRole('button', { name: 'Predă tema', exact: true }).click();
  await expect(page.getByText(/Rezultatul trimiterii este încă necunoscut/)).toBeVisible();
  await expect(answer(page)).toBeDisabled();
  await shot(page, 'ro-submit-unknown');
  await page.getByRole('button', { name: 'Verifică rezultatul', exact: true }).click();
  await expect(answer(page)).toHaveCount(0);
  expect(await calls(request, '/submit')).toHaveLength(1);
  await expect(page.locator('.versions > li')).toHaveCount(3);
  const data = await state(request);
  await patch(request, {
    loseSubmitResponse: false,
    homeworkStatus: 'NEEDS_REVISION',
    homeworkVersions: data.homeworkVersions.map((version, i) =>
      i
        ? version
        : {
            ...version,
            teacherStatus: 'NEEDS_REVISION',
            teacherComment: '<script>Нужна доработка</script>',
          },
    ),
  });
  await refresh(page, true);
  await expect(answer(page)).toBeEnabled();
  await expect(page.getByText('<script>Нужна доработка</script>', { exact: true })).toBeVisible();
  await expect(page.locator('.versions script')).toHaveCount(0);
  await answer(page).fill(first + '\nДополнение');
  await page.getByRole('button', { name: 'Predă tema', exact: true }).click();
  await expect(page.locator('.versions > li')).toHaveCount(4);
  const final = await state(request);
  expect(final.homeworkVersions.find((version) => version.versionNumber === 3).content).toBe(first);
  const submissions = await calls(request, '/submit');
  expect(submissions).toHaveLength(2);
  expect(submissions[0].key).not.toBe(submissions[1].key);
});

test('TASK-030 submit waits for queued save and double click creates one version', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context }, 'ru', { draftDelay: 500, submitDelay: 300 });
  await page.clock.install();
  await page.goto(path + '?ui.k8k=1');
  await answer(page).fill('Первая редакция');
  await page.clock.runFor(2100);
  await expect.poll(async () => (await calls(request, '/draft')).length).toBe(1);
  await answer(page).fill('Последняя редакция без ожидания debounce');
  await page.getByRole('button', { name: 'Сдать работу', exact: true }).dblclick();
  await expect(
    page.getByText('Работа сдана. Ждём комментарий преподавателя.', { exact: true }),
  ).toBeVisible();
  expect(await calls(request, '/submit')).toHaveLength(1);
  expect((await state(request)).homeworkVersions[0].content).toBe(
    'Последняя редакция без ожидания debounce',
  );
  expect((await state(request)).draft).toBe('');
});

test('TASK-030 expired upload renews intent and confirmation retry does not repeat successful PUT', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context }, 'ru', { failConfirm: true });
  let puts = 0;
  const bytes = Buffer.from('  Răspuns\nточные байты\0');
  await context.route('https://upload.student.test/**', async (route) => {
    puts++;
    const headers = route.request().headers();
    expect(headers.cookie).toBeUndefined();
    expect(headers['x-csrf-token']).toBeUndefined();
    expect(headers['idempotency-key']).toBeUndefined();
    expect(route.request().postDataBuffer()).toEqual(bytes);
    await route.fulfill({
      status: puts === 1 ? 403 : 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: '',
    });
  });
  await page.goto(path + '?ui.k8k=1');
  await page
    .getByLabel('Прикрепить файл')
    .setInputFiles({ name: 'ответ.txt', mimeType: 'text/plain', buffer: bytes });
  await expect(page.getByText(/Срок загрузки истёк/)).toBeVisible();
  await page.getByRole('button', { name: 'Повторить загрузку' }).click();
  await expect.poll(async () => (await calls(request, '/confirm')).length).toBe(1);
  await expect(page.locator('.k8k-homework-files li')).toHaveCount(0);
  await patch(request, { failConfirm: false });
  await page.getByRole('button', { name: 'Повторить загрузку' }).click();
  await expect(page.getByRole('button', { name: 'Убрать ответ.txt' })).toBeVisible();
  expect(puts).toBe(2);
  const intents = await calls(request, '/upload-url');
  const confirms = await calls(request, '/confirm');
  expect(intents).toHaveLength(2);
  expect(intents[0].key).not.toBe(intents[1].key);
  expect(confirms).toHaveLength(2);
  expect(confirms[0].key).toBe(confirms[1].key);
  expect(confirms[0].key).not.toBe(intents[1].key);
});

test('TASK-030 file bounds, twenty verified attachments and blocker cancel restore focus', async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(50_000);
  await setup({ request, context });
  await context.route('https://upload.student.test/**', (route) =>
    route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' }),
  );
  await page.goto(path + '?ui.k8k=1');
  const input = page.getByLabel('Прикрепить файл');
  await input.setInputFiles({ name: 'empty.txt', mimeType: 'text/plain', buffer: Buffer.alloc(0) });
  await expect(page.getByText(/Выбери непустой файл/)).toBeVisible();
  await input.evaluate((node) => {
    const transfer = new globalThis.DataTransfer();
    transfer.items.add(
      new File([new Uint8Array(52_428_801)], 'too-large.txt', { type: 'text/plain' }),
    );
    node.files = transfer.files;
    node.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page.getByText(/Выбери непустой файл/)).toBeVisible();
  expect(await calls(request, '/upload-url')).toHaveLength(0);
  for (let i = 1; i <= 20; i++) {
    await input.setInputFiles({
      name: 'file-' + i + '.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('x'),
    });
    await expect(page.locator('.k8k-homework-files li')).toHaveCount(i);
  }
  await expect(input).toBeDisabled();
  expect(await calls(request, '/upload-url')).toHaveLength(20);
  await page.getByRole('link', { name: '← Все задания' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button', { name: 'Остаться', exact: true }).click();
  await expect(answer(page)).toBeFocused();
  await expect(page.locator('.k8k-homework-files li')).toHaveCount(20);
});

test('TASK-030 forbidden read hides private answer and suspension bypasses dirty blocker', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context }, 'ru', { draft: 'Приватный ответ ученика' });
  await page.goto(path + '?ui.k8k=1');
  await expect(answer(page)).toHaveValue('Приватный ответ ученика');
  await patch(request, { homeworkError: 403 });
  await refresh(page);
  await expect(answer(page)).toHaveCount(0);
  await expect(page.getByText('Приватный ответ ученика')).toHaveCount(0);
  await setup({ request, context }, 'ru', {});
  await page.goto(path + '?ui.k8k=1');
  await answer(page).fill('Несохранённый ответ');
  await patch(request, { active: false });
  await refresh(page);
  await expect(page).toHaveURL(/\/student\/suspended/);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(answer(page)).toHaveCount(0);
  await setup({ request, context }, 'ru', {});
  await page.goto(path + '?ui.k8k=1');
  await answer(page).fill('Ответ перед истечением сессии');
  await patch(request, { auth: false });
  await refresh(page);
  await expect(page).toHaveURL(/\/student\/login/);
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(answer(page)).toHaveCount(0);
  await expect(page.getByText('Ответ перед истечением сессии')).toHaveCount(0);
});

test('TASK-030 submitted and reviewed stay read-only after authoritative refresh', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context }, 'ro', { homeworkStatus: 'SUBMITTED' });
  await page.goto(path + '?ui.k8k=1');
  await expect(answer(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Predă tema', exact: true })).toHaveCount(0);
  await patch(request, { homeworkStatus: 'REVIEWED' });
  await refresh(page, true);
  await expect(page.getByText('Tema este verificată.', { exact: true })).toBeVisible();
  await expect(answer(page)).toHaveCount(0);
  await expect(page.locator('.versions > li')).toHaveCount(2);
  expect(await calls(request, '/submit')).toHaveLength(0);
});

test('TASK-030 pagination follows issued chronology without sorting by due date', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context });
  const template = await (await request.get('/api/v1/student/homework/' + id)).json();
  const items = Array.from({ length: 23 }, (_, i) => ({
    ...template,
    homeworkId: '20000000-0000-4000-8000-' + String(i + 1).padStart(12, '0'),
    title: 'Задание ' + (i + 1),
    assignedAt: new Date(Date.UTC(2026, 10, 30 - i)).toISOString(),
    dueAt: new Date(Date.UTC(2026, 10, i + 1)).toISOString(),
  }));
  await patch(request, { homeworkItems: items });
  await page.goto('/student/homework?ui.k8k=1');
  await expect(page.locator('.k8k-homework-list .k8k-list-row')).toHaveCount(20);
  await expect(page.locator('.k8k-list-row-title').first()).toHaveText('Задание 1');
  await page.getByRole('button', { name: 'Далее', exact: true }).click();
  await expect(page.locator('.k8k-homework-list .k8k-list-row')).toHaveCount(3);
  await expect(page.locator('.k8k-list-row-title').first()).toHaveText('Задание 21');
  await expect(page).toHaveURL(/page=2/);
});

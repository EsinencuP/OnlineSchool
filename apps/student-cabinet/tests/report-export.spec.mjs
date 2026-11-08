import { expect, test } from './gate-fixtures.mjs';
import { evidenceUrl } from './gate-fixtures.mjs';
import { fileURLToPath } from 'node:url';
import { english, oldReport, reportId, reportFixture } from './report-journey-fixtures.mjs';
const path = '/student/reports';
const state = async (request) => (await request.get('/__fixture/state')).json();
const patch = (request, data) => request.patch('/__fixture/state', { data });
const calls = async (request, suffix) =>
  (await state(request)).calls.filter((call) => call.path.endsWith(suffix));
async function setup({ request, context }, locale = 'ru', data = {}) {
  await request.post('/__fixture/reset', { data: { ...reportFixture(), ...data } });
  await context.addCookies((await request.storageState()).cookies);
  await context.addInitScript((locale) => localStorage.setItem('k8k.locale', locale), locale);
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
      evidenceUrl('../../../output/k8k-tasks/TASK-032/after/' + name + '.png', import.meta.url),
    ),
    animations: 'disabled',
  });
}
const exporter = (page) => page.locator('.k8k-pdf-export');
async function create(page, request, ro = false) {
  await exporter(page)
    .getByRole('button', { name: ro ? 'Pregătește PDF' : 'Подготовить PDF', exact: true })
    .evaluate((button) => {
      button.click();
      button.click();
    });
  await expect(
    exporter(page).getByText(ro ? 'În așteptare' : 'В очереди', { exact: true }),
  ).toBeVisible();
  return new URL(page.url()).searchParams.get('pdfJobId');
}
async function ready(request, id, extra = {}) {
  const jobs = (await state(request)).pdfJobs;
  const expiresAt = new Date(Date.now() + 3600000).toISOString();
  jobs[id] = {
    ...jobs[id],
    status: 'READY',
    downloadUrl: 'https://pdf.student.test/private-fixture.pdf',
    expiresAt,
    ...extra,
  };
  await patch(request, { pdfJobs: jobs });
}
test.afterEach(async ({ request }) => {
  expect((await state(request)).missingRoutes).toEqual([]);
});
for (const locale of ['ru', 'ro'])
  test(
    'TASK-032 deep link and PDF form/job layout ' + locale,
    async ({ page, request, context }) => {
      test.setTimeout(60_000);
      await setup({ request, context }, locale);
      const ro = locale === 'ro';
      for (const width of [360, 768, 1024, 1280]) {
        await page.setViewportSize({ width, height: width === 360 ? 800 : 900 });
        const listReads = (await calls(request, '/student/reports')).length;
        await page.goto(path + '?reportId=' + oldReport + '&page=3&ui.k8k=1');
        const heading = page.getByRole('heading', {
          name: 'Отчёт старше первой страницы',
          exact: true,
        });
        await expect(heading).toBeFocused();
        await expect(page.locator('.k8k-report')).toHaveCount(1);
        expect(await calls(request, '/student/reports')).toHaveLength(listReads);
        expect(await page.locator('.k8k-report .preserve-lines').first().textContent()).toBe(
          '  Достижения\nСтрока с пробелами  ',
        );
        expect(await page.evaluate(() => globalThis.BAD_REPORT)).toBeUndefined();
        await expect(page.getByText('PRIVATE_TEACHER_NOTE', { exact: true })).toHaveCount(0);
        await shot(page, locale + '-' + width + '-detail');
        await exporter(page).scrollIntoViewIfNeeded();
        const button = exporter(page).getByRole('button', {
          name: ro ? 'Pregătește PDF' : 'Подготовить PDF',
          exact: true,
        });
        await expect(button).toBeEnabled();
        await button.focus();
        await expect(button).toBeFocused();
        expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(48);
        await shot(page, locale + '-' + width + '-form');
        const id = await create(page, request, ro);
        await shot(page, locale + '-' + width + '-queued');
        await ready(request, id);
        await exporter(page)
          .getByRole('button', {
            name: ro ? 'Verifică dacă este gata' : 'Проверить готовность',
            exact: true,
          })
          .click();
        await expect(
          exporter(page).getByRole('button', {
            name: ro ? 'Descarcă PDF' : 'Скачать PDF',
            exact: true,
          }),
        ).toBeVisible();
        await shot(page, locale + '-' + width + '-ready');
        expect(
          await page.evaluate(() => globalThis.document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        expect(
          await page.evaluate(() =>
            [...Object.values(localStorage), ...Object.values(sessionStorage)].some((value) =>
              value.includes('pdf.student.test'),
            ),
          ),
        ).toBe(false);
        await exporter(page)
          .getByRole('button', { name: ro ? 'Export nou' : 'Новый экспорт', exact: true })
          .click();
        await page
          .getByRole('link', {
            name: ro ? '← La lista rapoartelor' : '← К списку отчётов',
            exact: true,
          })
          .click();
        await expect(page.locator('.k8k-report-summary')).toHaveCount(10);
        const open = page.locator('.k8k-report-summary').first().getByRole('link');
        await open.focus();
        await expect(open).toBeFocused();
        expect((await open.boundingBox()).height).toBeGreaterThanOrEqual(48);
        await shot(page, locale + '-' + width + '-list');
        expect(
          await page.evaluate(() => globalThis.document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
      }
    },
  );

test('TASK-032 explicit mark-read returns empty response and list back keeps page, new version unread', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context });
  await page.goto(path + '?reportId=' + oldReport + '&page=3&ui.k8k=1');
  expect(await calls(request, '/' + oldReport + '/read')).toHaveLength(0);
  await page
    .locator('.k8k-report')
    .getByRole('button', { name: 'Я прочитал(а)', exact: true })
    .click();
  await expect(page.getByText('Прочтение отмечено', { exact: true })).toBeVisible();
  expect(await calls(request, '/' + oldReport + '/read')).toHaveLength(1);
  await page.getByRole('link', { name: '← К списку отчётов', exact: true }).click();
  expect(new URL(page.url()).searchParams.get('page')).toBe('3');
  await expect(page.locator('.k8k-report-summary')).toHaveCount(10);
  await page
    .locator('.k8k-report-summary')
    .filter({ hasText: 'Отчёт старше первой страницы' })
    .getByRole('link')
    .click();
  await expect(page.getByText('Прочтение отмечено', { exact: true })).toBeVisible();
  const data = reportFixture();
  data.reportRows[0].subjectName = 'Новая опубликованная версия';
  await patch(request, data);
  await page.goto(path + '?reportId=' + reportId(1) + '&ui.k8k=1');
  await expect(page.getByRole('button', { name: 'Я прочитал(а)', exact: true })).toBeVisible();
});
test('TASK-032 unavailable deep link and cached denial never substitute another report', async ({
  page,
  request,
  context,
}) => {
  const data = reportFixture();
  data.reportRows[24].visible = false;
  await setup({ request, context }, 'ru', data);
  await page.goto(path + '?reportId=' + oldReport + '&ui.k8k=1');
  await expect(page.locator('.k8k-report')).toHaveCount(0);
  expect(await calls(request, '/student/reports')).toHaveLength(0);
  await page.goto(path + '?reportId=' + reportId(1) + '&ui.k8k=1');
  await expect(page.locator('.k8k-report')).toHaveCount(1);
  await patch(request, { reportError: 403 });
  await page.getByRole('button', { name: 'Обновить отчёт', exact: true }).click();
  await expect(page.locator('.k8k-report')).toHaveCount(0);
  await page.goto(path + '?reportId=bad&ui.k8k=1');
  await expect(page.locator('.k8k-report')).toHaveCount(0);
});
test('TASK-032 export filters are date-only, reversed range is blocked and CSRF/key sent once', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context });
  await page.goto(path + '?ui.k8k=1');
  const form = exporter(page);
  await form.getByLabel('Предмет', { exact: true }).selectOption(english);
  await form.getByLabel('С даты', { exact: true }).fill('2026-10-26');
  await form.getByLabel('По дату включительно', { exact: true }).fill('2026-10-25');
  await form.getByRole('button', { name: 'Подготовить PDF', exact: true }).click();
  await expect(form.getByRole('alert')).toContainText('Дата начала');
  expect(await calls(request, '/export-pdf')).toHaveLength(0);
  await form.getByLabel('С даты', { exact: true }).fill('2026-10-25');
  await create(page, request);
  const commands = await calls(request, '/export-pdf');
  expect(commands).toHaveLength(1);
  expect(commands[0].body).toEqual({
    subjectId: english,
    periodFrom: '2026-10-25',
    periodTo: '2026-10-25',
  });
  expect(commands[0].csrf).toBeTruthy();
  expect(commands[0].key).toMatch(/^[0-9a-f-]{36}$/);
});
test('TASK-032 lost committed enqueue response is recovered by GET and reload resumes same job', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context }, 'ro', { loseEnqueueResponse: true });
  await page.goto(path + '?ui.k8k=1');
  await exporter(page).getByRole('button', { name: 'Pregătește PDF', exact: true }).click();
  await expect(exporter(page).getByText(/Rezultatul cererii este încă necunoscut/)).toBeVisible();
  await shot(page, 'ro-enqueue-unknown');
  const savedUrl = page.url();
  expect(Object.keys((await state(request)).pdfJobs)).toHaveLength(1);
  await page.reload();
  await exporter(page).getByRole('button', { name: 'Verifică rezultatul', exact: true }).click();
  await expect(exporter(page).getByText('În așteptare', { exact: true })).toBeVisible();
  expect(await calls(request, '/export-pdf')).toHaveLength(1);
  expect(new URL(savedUrl).searchParams.get('pdfRequestId')).toBeTruthy();
  expect(new URL(page.url()).searchParams.get('pdfJobId')).toBeTruthy();
  await page.reload();
  await expect(exporter(page).getByText('În așteptare', { exact: true })).toBeVisible();
  expect(await calls(request, '/export-pdf')).toHaveLength(1);
});
test('TASK-032 unknown before enqueue explicitly retries same key/body after receipt without duplicate job', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context }, 'ru', { enqueueError: 503 });
  await page.goto(path + '?ui.k8k=1');
  await exporter(page).getByRole('button', { name: 'Подготовить PDF', exact: true }).click();
  await expect(exporter(page).getByText(/Результат запроса пока неизвестен/)).toBeVisible();
  await patch(request, { enqueueError: null });
  await exporter(page)
    .getByRole('button', { name: 'Повторить тот же запрос', exact: true })
    .click();
  await expect(exporter(page).getByText('В очереди', { exact: true })).toBeVisible();
  const commands = await calls(request, '/export-pdf');
  expect(commands).toHaveLength(2);
  expect(commands[1].key).toBe(commands[0].key);
  expect(commands[1].body).toEqual(commands[0].body);
  expect(Object.keys((await state(request)).pdfJobs)).toHaveLength(1);
  expect(
    (await state(request)).calls.some((call) => call.path.includes('/export-pdf/requests/')),
  ).toBe(true);
});
test('TASK-032 polling stops at sixty seconds, resumes same job and no new command on return', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context });
  await page.clock.install();
  await page.goto(path + '?ui.k8k=1');
  const id = await create(page, request);
  await page.clock.pauseAt(new Date(Date.now() + 100));
  const initial = (await calls(request, '/export-pdf/' + id)).length;
  await page.clock.runFor(900);
  expect((await calls(request, '/export-pdf/' + id)).length).toBe(initial);
  await page.clock.runFor(1100);
  await expect
    .poll(async () => (await calls(request, '/export-pdf/' + id)).length)
    .toBe(initial + 1);
  await page.clock.runFor(58_001);
  await expect(exporter(page).getByText(/Автопроверка приостановлена/)).toBeVisible();
  const count = (await calls(request, '/export-pdf/' + id)).length;
  expect(count).toBeLessThanOrEqual(30);
  await page.clock.runFor(10_000);
  expect((await calls(request, '/export-pdf/' + id)).length).toBe(count);
  await ready(request, id, { status: 'PROCESSING', downloadUrl: null, expiresAt: null });
  await exporter(page).getByRole('button', { name: 'Проверить готовность', exact: true }).click();
  await expect(exporter(page).getByText('Готовим PDF', { exact: true })).toBeVisible();
  await shot(page, 'ru-processing');
  const url = page.url();
  await page.locator('main').getByRole('link', { name: 'Мой путь знаний', exact: true }).click();
  const off = (await calls(request, '/export-pdf/' + id)).length;
  await page.clock.runFor(5000);
  expect((await calls(request, '/export-pdf/' + id)).length).toBe(off);
  await page.goto(url);
  await expect(exporter(page).getByText('Готовим PDF', { exact: true })).toBeVisible();
  expect(await calls(request, '/export-pdf')).toHaveLength(1);
});
test('TASK-032 expired and malformed READY never offer a download, new export stays explicit and limit is clear', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context });
  await page.clock.install();
  await page.goto(path + '?ui.k8k=1');
  const id = await create(page, request);
  const deadline = Date.now() + 5000;
  await ready(request, id, { expiresAt: new Date(deadline).toISOString() });
  await exporter(page).getByRole('button', { name: 'Проверить готовность', exact: true }).click();
  await expect(
    exporter(page).getByRole('button', { name: 'Скачать PDF', exact: true }),
  ).toBeVisible();
  await page.clock.runFor(5000);
  await expect(
    exporter(page).getByRole('button', { name: 'Скачать PDF', exact: true }),
  ).toHaveCount(0);
  expect(await calls(request, '/export-pdf')).toHaveLength(1);
  await ready(request, id, {
    downloadUrl: 'javascript:alert(1)',
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  });
  await exporter(page).getByRole('button', { name: 'Проверить готовность', exact: true }).click();
  await expect(
    exporter(page).getByText('Ссылка для скачивания пока недоступна. Проверь готовность ещё раз.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    exporter(page).getByRole('button', { name: 'Скачать PDF', exact: true }),
  ).toHaveCount(0);
  await ready(request, id, {
    status: 'FAILED',
    downloadUrl: null,
    failureReason: 'PDF_EXPORT_FAILED',
  });
  await exporter(page).getByRole('button', { name: 'Проверить готовность', exact: true }).click();
  await expect(exporter(page).getByText('PDF не подготовлен', { exact: true })).toBeVisible();
  await exporter(page).getByRole('button', { name: 'Новый экспорт', exact: true }).click();
  await patch(request, { enqueueError: 429 });
  await exporter(page).getByRole('button', { name: 'Подготовить PDF', exact: true }).click();
  await expect(exporter(page).getByRole('alert')).toContainText('готовятся два PDF');
  await shot(page, 'ru-limit');
});
test('TASK-032 download rechecks current status and 403/401 conceal private URL and stop polling', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context });
  await page.clock.install();
  await page.goto(path + '?ui.k8k=1');
  const id = await create(page, request);
  await ready(request, id);
  await exporter(page).getByRole('button', { name: 'Проверить готовность', exact: true }).click();
  const download = exporter(page).getByRole('button', { name: 'Скачать PDF', exact: true });
  await expect(download).toBeVisible();
  const before = (await calls(request, '/export-pdf/' + id)).length;
  await patch(request, { pdfError: 403 });
  await download.click();
  await expect(download).toHaveCount(0);
  expect((await calls(request, '/export-pdf/' + id)).length).toBe(before + 1);
  await patch(request, { pdfError: null, auth: false });
  await page.goto(path + '?pdfJobId=' + id + '&ui.k8k=1');
  await expect(page).toHaveURL(/\/student\/login/);
  const count = (await calls(request, '/export-pdf/' + id)).length;
  await page.clock.runFor(10000);
  expect((await calls(request, '/export-pdf/' + id)).length).toBe(count);
  await expect(page.locator('.k8k-pdf-job')).toHaveCount(0);
});

test('TASK-032 READY download performs fresh GET before requesting the private fixture', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context });
  await page.goto(path + '?ui.k8k=1');
  const id = await create(page, request);
  await ready(request, id);
  await exporter(page).getByRole('button', { name: 'Проверить готовность', exact: true }).click();
  const button = exporter(page).getByRole('button', { name: 'Скачать PDF', exact: true });
  await expect(button).toBeVisible();
  const count = (await calls(request, '/export-pdf/' + id)).length;
  await page.route('https://pdf.student.test/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      headers: { 'Content-Disposition': 'attachment; filename="history.pdf"' },
      body: 'SYNTHETIC-DOWNLOAD-BODY',
    }),
  );
  const download = page.waitForEvent('download');
  await button.click();
  expect((await download).suggestedFilename()).toBe('history.pdf');
  expect((await calls(request, '/export-pdf/' + id)).length).toBe(count + 1);
  expect(await calls(request, '/export-pdf')).toHaveLength(1);
});

test('TASK-032 logout during polling discards a late READY and cancels further reads', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context });
  await page.clock.install();
  await page.goto(path + '?ui.k8k=1');
  const id = await create(page, request);
  let release, finish;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const finished = new Promise((resolve) => {
    finish = resolve;
  });
  let intercepted = false;
  await page.route('**/api/v1/student/reports/export-pdf/' + id, async (pending) => {
    intercepted = true;
    await gate;
    await pending
      .fulfill({
        json: {
          jobId: id,
          status: 'READY',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          downloadUrl: 'https://pdf.student.test/private-fixture.pdf',
          failureReason: null,
        },
      })
      .catch(() => undefined);
    finish();
  });
  await exporter(page).getByRole('button', { name: 'Проверить готовность', exact: true }).click();
  await expect.poll(() => intercepted).toBe(true);
  await page.locator('.account-menu > summary').click();
  await page.getByRole('button', { name: 'Выйти из аккаунта', exact: true }).click();
  await expect(page).toHaveURL(/\/student\/login$/);
  release();
  await finished;
  const count = (await calls(request, '/export-pdf/' + id)).length;
  await page.clock.runFor(10_000);
  expect((await calls(request, '/export-pdf/' + id)).length).toBe(count);
  await expect(page.locator('.k8k-pdf-job')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Скачать PDF', exact: true })).toHaveCount(0);
});

test('TASK-032 demo switch in another tab removes a late old PDF reply', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context }, 'ru', {
    demoContacts: true,
    demoAlternate: { displayName: 'Даниил', userId: '50000000-0000-4000-8000-000000000003' },
  });
  await page.goto(path + '?ui.k8k=1');
  const id = await create(page, request);
  const second = await context.newPage();
  await second.goto('/student?ui.k8k=1');
  let release, finish;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const finished = new Promise((resolve) => {
    finish = resolve;
  });
  let intercepted = false;
  await page.route('**/api/v1/student/reports/export-pdf/' + id, async (pending) => {
    intercepted = true;
    await gate;
    await pending
      .fulfill({
        json: {
          jobId: id,
          status: 'READY',
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          downloadUrl: 'https://pdf.student.test/private-fixture.pdf',
          failureReason: null,
        },
      })
      .catch(() => undefined);
    finish();
  });
  await page.bringToFront();
  await exporter(page).getByRole('button', { name: 'Проверить готовность', exact: true }).click();
  await expect.poll(() => intercepted).toBe(true);
  await second.locator('.account-menu > summary').click();
  await second.getByRole('button', { name: /Демо Даниил/ }).click();
  await expect(page).toHaveURL('http://127.0.0.1:4175/');
  release();
  await finished;
  await expect(page.locator('.k8k-pdf-job')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Скачать PDF', exact: true })).toHaveCount(0);
  await second.close();
});

test('TASK-032 unknown read receipt is verified through detail before any same-key retry', async ({
  page,
  request,
  context,
}) => {
  await setup({ request, context }, 'ru', { loseReportReadResponse: true });
  await page.goto(path + '?reportId=' + oldReport + '&ui.k8k=1');
  const button = page
    .locator('.k8k-report')
    .getByRole('button', { name: 'Я прочитал(а)', exact: true });
  await button.click();
  await expect(page.locator('.k8k-report').getByRole('alert')).toBeVisible();
  expect(await calls(request, '/' + oldReport + '/read')).toHaveLength(1);
  await button.click();
  await expect(page.getByText('Прочтение отмечено', { exact: true })).toBeVisible();
  expect(await calls(request, '/' + oldReport + '/read')).toHaveLength(1);
  expect((await calls(request, '/' + oldReport)).length).toBeGreaterThanOrEqual(2);
});

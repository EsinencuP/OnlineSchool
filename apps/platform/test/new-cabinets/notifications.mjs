import assert from 'node:assert/strict';

const endpoint = '/api/v1/student/notifications';
const firstId = '00000000-0000-4000-8000-000000000511';
const secondId = '00000000-0000-4000-8000-000000000512';
const newId = '00000000-0000-4000-8000-000000000513';
const unsafeUrl = 'https://untrusted-notification.example.test/';

export function notificationFixture({ date, reportId, homeworkId, planId }) {
  const rows = [
    {
      notificationId: firstId,
      type: 'REPORT_READY',
      title: 'Опубликован отчёт по математике',
      body: 'Преподаватель опубликовал отчёт.',
      payload: { reportId },
      isRead: false,
    },
    {
      notificationId: secondId,
      type: 'HOMEWORK_REVIEWED',
      title: 'Проверено задание по математике',
      body: 'Откройте работу и комментарий.',
      payload: { homeworkId },
      isRead: false,
    },
    {
      notificationId: '00000000-0000-4000-8000-000000000514',
      type: 'MANUAL_MESSAGE',
      title: 'Сообщение о занятиях',
      body: 'Менеджер ответит в рабочее время.',
      payload: { reportId, url: unsafeUrl },
      isRead: true,
    },
    ...Array.from({ length: 29 }, (_, index) => ({
      notificationId: '00000000-0000-4000-8000-' + String(550 + index).padStart(12, '0'),
      type: 'MANUAL_MESSAGE',
      title: 'Архивное сообщение ' + (index + 1),
      body: 'Сообщение из истории.',
      payload: {},
      isRead: true,
    })),
  ];
  const commands = [];
  const accepted = new Set();
  const unread = () => rows.filter((item) => !item.isRead).length;

  return {
    commands,
    match: (path) => path === endpoint || path.startsWith(endpoint + '/'),
    handle(route, url) {
      const path = url.pathname;
      const req = route.request();
      if (path === endpoint + '/count') return route.fulfill({ json: { unreadCount: unread() } });
      if (path === endpoint) {
        assert.equal(req.method(), 'GET');
        const page = Number(url.searchParams.get('page') ?? '1');
        const pageSize = Number(url.searchParams.get('pageSize') ?? '30');
        const locale = url.searchParams.get('locale');
        const start = (page - 1) * pageSize;
        const items = rows.slice(start, start + pageSize).map((row) => ({
          ...row,
          createdAt: date,
          ...(locale === 'ro' && row.notificationId === newId
            ? { title: 'Abonamentul a fost prelungit' }
            : {}),
        }));
        return route.fulfill({
          json: { items, total: rows.length, unreadCount: unread(), page, pageSize },
        });
      }
      const all = path === endpoint + '/read-all';
      assert.equal(req.method(), all ? 'POST' : 'PATCH');
      assert.equal(req.headers()['x-csrf-token'], 'synthetic-csrf-fixture');
      const key = req.headers()['idempotency-key'];
      assert.match(key, /^[0-9a-f-]{36}$/);
      commands.push({ path, key });
      if (accepted.has(key)) return route.fulfill({ status: 204 });
      accepted.add(key);
      if (all) {
        rows.forEach((item) => {
          item.isRead = true;
        });
        rows.unshift({
          notificationId: newId,
          type: 'SUBSCRIPTION_RENEWED',
          title: 'Абонемент продлён',
          body: 'Проверьте новый срок действия.',
          payload: { subscriptionId: planId },
          isRead: false,
        });
        return route.fulfill({ status: 503, json: { code: 'SERVICE_UNAVAILABLE' } });
      }
      const id = path.split('/')[5];
      const item = rows.find((candidate) => candidate.notificationId === id);
      if (!item) return route.fulfill({ status: 404, json: { code: 'NOTIFICATION_NOT_FOUND' } });
      item.isRead = true;
      return route.fulfill({ status: 204 });
    },
  };
}

export async function verifyNotifications({ page, base, reportId, planId, commands }) {
  const link = base + '/student/notifications';
  const bell = page.locator('button.cab-bell');
  await page.goto(base + '/student');
  await page.getByRole('heading', { name: 'Последние уведомления' }).waitFor();
  await page.locator('.cab-notice-compact').getByText('Опубликован отчёт по математике').waitFor();
  await bell.getByText('2', { exact: true }).waitFor();

  await bell.click();
  const drawer = page.getByRole('dialog', { name: 'Уведомления' });
  await drawer.getByText('Опубликован отчёт по математике').waitFor();
  assert.match(page.url(), /events=1$/);
  const message = drawer.locator('.cab-notice-row').filter({ hasText: 'Сообщение о занятиях' });
  assert.equal(await message.getByRole('link').count(), 0);
  assert.equal(await drawer.locator('a[href^="' + unsafeUrl + '"]').count(), 0);
  await page.keyboard.press('Escape');
  await drawer.waitFor({ state: 'hidden' });
  assert.equal(
    await bell.evaluate((button) => button.ownerDocument.activeElement === button),
    true,
  );

  await bell.click();
  await drawer.getByRole('link', { name: 'Открыть отчёт' }).click();
  await page.waitForURL(base + '/student/reports/' + reportId);
  await page.getByRole('button', { name: 'Отметить прочитанным' }).waitFor();
  assert.equal(commands.length, 0);

  await bell.click();
  const report = drawer
    .locator('.cab-notice-row')
    .filter({ hasText: 'Опубликован отчёт по математике' });
  await report.getByRole('button', { name: 'Отметить прочитанным' }).click();
  await drawer.getByText('Непрочитано 1', { exact: true }).waitFor();
  assert.equal(await report.getAttribute('data-unread'), 'false');
  await drawer.getByRole('link', { name: 'Вся лента' }).click();
  await page.waitForURL(link);
  await bell.getByText('1', { exact: true }).waitFor();

  await page.getByRole('button', { name: 'Следующая страница' }).click();
  await page.waitForURL(link + '?page=2');
  await page.getByText('Архивное сообщение 29', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Предыдущая страница' }).click();
  await page.getByRole('button', { name: 'Прочитать все' }).click();
  await page.getByText(/Результат отметки пока неизвестен/).waitFor();
  await page.getByRole('button', { name: 'Проверить отметку' }).click();
  await page.getByRole('button', { name: 'Повторить исходную отметку' }).click();
  await page.getByText('Статус прочтения обновлён.', { exact: true }).waitFor();
  const renewal = page.locator('.cab-notice-row').filter({ hasText: 'Абонемент продлён' });
  await renewal.waitFor();
  assert.equal(await renewal.getAttribute('data-unread'), 'true');
  assert.equal(
    await renewal.getByRole('link').getAttribute('href'),
    '/student/subscription?subscriptionId=' + planId,
  );
  assert.equal(commands.length, 3);
  assert.deepEqual(commands[1], commands[2]);

  await page.locator('.cab-account-button').click();
  await page.locator('.k8k-language select').selectOption('ro');
  await page.getByText('Abonamentul a fost prelungit', { exact: true }).waitFor();
  await page.locator('.cab-account-button').click();
  await page.locator('.k8k-language select').selectOption('ru');
  await renewal.waitFor();
  await renewal.getByRole('button', { name: 'Отметить прочитанным' }).click();
  await page.getByText('Непрочитано 0', { exact: true }).waitFor();
  assert.equal(await bell.locator('.cab-bell-count').count(), 0);
  assert.ok(
    await page.evaluate(
      () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
    ),
  );
}

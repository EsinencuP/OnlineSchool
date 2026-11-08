# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: student.spec.mjs >> all cabinet pages fit a narrow viewport and expose the four skill states
- Location: tests\student.spec.mjs:240:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  -  1
+ Received  + 14

- Array []
+ Array [
+   "/api/v1/platform/accounts",
+   "/api/v1/platform/accounts",
+   "/api/v1/platform/accounts",
+   "/api/v1/platform/accounts",
+   "/api/v1/platform/accounts",
+   "/api/v1/platform/accounts",
+   "/api/v1/platform/accounts",
+   "/api/v1/platform/accounts",
+   "/api/v1/platform/accounts",
+   "/api/v1/platform/accounts",
+   "/api/v1/platform/accounts",
+   "/api/v1/platform/accounts",
+ ]
```

# Page snapshot

```yaml
- generic [ref=f14e4]:
  - link "Перейти к содержимому" [ref=f14e5] [cursor=pointer]:
    - /url: "#main-content"
  - generic [ref=f14e6]:
    - banner [ref=f14e7]:
      - strong [ref=f14e8]: Личный кабинет
      - generic [ref=f14e9]:
        - link "Уведомления, непрочитанных 2" [ref=f14e10] [cursor=pointer]:
          - /url: /student/notifications
          - generic [ref=f14e13]: "2"
        - group [ref=f14e14]:
          - generic "София Ученик" [ref=f14e15] [cursor=pointer]:
            - generic [aria-hidden] [ref=f14e16]: С
            - generic [ref=f14e17]:
              - text: София
              - generic [ref=f14e18]: Ученик
            - generic [aria-hidden] [ref=f14e19]: ⌄
    - main [ref=f14e21]:
      - heading "Мой путь знаний" [level=1] [ref=f14e22]
      - paragraph [ref=f14e23]: Каждый навык — ещё один шаг к твоей цели
      - generic [ref=f14e24]:
        - text: Предмет
        - combobox "Предмет" [ref=f14e25]:
          - option "Все предметы" [selected]
          - option "Английский язык"
      - generic [ref=f14e26]:
        - heading "Английский язык" [level=2] [ref=f14e28]
        - list [ref=f14e29]:
          - listitem [ref=f14e30]:
            - generic [ref=f14e31]:
              - strong [ref=f14e32]: Past Perfect
              - generic [ref=f14e33]: Общий английский
            - generic [ref=f14e34]:
              - generic [ref=f14e35]: Ещё не изучали
              - button "История навыка" [ref=f14e36] [cursor=pointer]
          - listitem [ref=f14e37]:
            - generic [ref=f14e38]:
              - strong [ref=f14e39]: Present Perfect
              - generic [ref=f14e40]: Общий английский
            - generic [ref=f14e41]:
              - generic [ref=f14e42]: Знакомлюсь
              - button "История навыка" [ref=f14e43] [cursor=pointer]
          - listitem [ref=f14e44]:
            - generic [ref=f14e45]:
              - strong [ref=f14e46]: Аудирование
              - generic [ref=f14e47]: Общий английский
            - generic [ref=f14e48]:
              - generic [ref=f14e49]: Практикую
              - button "История навыка" [ref=f14e50] [cursor=pointer]
          - listitem [ref=f14e51]:
            - generic [ref=f14e52]:
              - strong [ref=f14e53]: Знакомство
              - generic [ref=f14e54]: Общий английский
            - generic [ref=f14e55]:
              - generic [ref=f14e56]: Применяю
              - button "История навыка" [ref=f14e57] [cursor=pointer]
        - heading "Цели обучения" [level=3] [ref=f14e58]
        - list [ref=f14e59]:
          - listitem [ref=f14e60]:
            - generic [aria-hidden] [ref=f14e61]: ○
            - generic [ref=f14e62]:
              - text: Уверенно рассказывать о себе
              - generic [ref=f14e63]: "Срок: 1 декабря"
        - paragraph [ref=f14e64]: "Последний срез: Не указан · Следующий через 2 занятий"
      - generic [ref=f14e65]:
        - heading "История срезов" [level=2] [ref=f14e67]
        - paragraph [ref=f14e68]: Подтверждённых срезов пока нет.
      - group [ref=f14e69]:
        - generic "Календарь, абонемент и контакты" [ref=f14e70] [cursor=pointer]
  - navigation "Мобильная навигация" [ref=f14e71]:
    - link "Главная" [ref=f14e72] [cursor=pointer]:
      - /url: /student
    - link "Уроки" [ref=f14e77] [cursor=pointer]:
      - /url: /student/lessons
    - link "Задания" [ref=f14e82] [cursor=pointer]:
      - /url: /student/homework
    - link "Мой путь" [ref=f14e87] [cursor=pointer]:
      - /url: /student/skills
    - button "Все разделы" [ref=f14e91] [cursor=pointer]:
      - generic [ref=f14e96]: Ещё
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | /* global document, innerWidth */
  3   | import { homeworkId, lessonId } from './fixture-server.mjs';
  4   | test.beforeEach(async ({ request, context }) => {
  5   |   await request.post('/__fixture/reset', { data: {} });
  6   |   await context.addCookies((await request.storageState()).cookies);
  7   | });
  8   | const state = async (request) => (await request.get('/__fixture/state')).json();
  9   | const patch = (request, data) => request.patch('/__fixture/state', { data });
  10  | test.afterEach(async ({ request }) => {
> 11  |   expect((await state(request)).missingRoutes).toEqual([]);
      |                                                ^ Error: expect(received).toEqual(expected) // deep equality
  12  | });
  13  | test('login → forced password → dashboard → direct upload → submission → unchanged balance', async ({
  14  |   page,
  15  |   request,
  16  | }) => {
  17  |   await patch(request, { auth: false, mustChangePassword: true, submitDelay: 350 });
  18  |   await page.goto('/student/login');
  19  |   await page.getByLabel('Email', { exact: true }).fill('student@example.invalid');
  20  |   await page.getByLabel('Пароль', { exact: true }).fill('Temporary123');
  21  |   await page.getByRole('button', { name: 'Войти', exact: true }).click();
  22  |   await expect(page).toHaveURL(/change-password$/);
  23  |   await page.getByLabel('Текущий пароль', { exact: true }).fill('Temporary123');
  24  |   await page.getByLabel('Новый пароль', { exact: true }).fill('StudentPassword123');
  25  |   await page.getByLabel('Повторите новый пароль').fill('StudentPassword123');
  26  |   await page.getByRole('button', { name: 'Изменить пароль', exact: true }).click();
  27  |   await expect(page.getByRole('heading', { name: /Привет, София/ })).toBeVisible();
  28  |   await expect(page.locator('.summary-grid>.summary')).toHaveCount(4);
  29  |   await page.goto(`/student/homework/${homeworkId}`);
  30  |   await page.getByLabel('Твой ответ').fill('I have visited London.');
  31  |   let uploadHeaders;
  32  |   await page.route('https://upload.student.test/presigned', async (route) => {
  33  |     uploadHeaders = route.request().headers();
  34  |     await route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' });
  35  |   });
  36  |   await page
  37  |     .getByLabel('Прикрепить файл')
  38  |     .setInputFiles({ name: 'answer.txt', mimeType: 'text/plain', buffer: Buffer.from('answer') });
  39  |   await expect(page.getByRole('button', { name: 'Убрать answer.txt', exact: true })).toBeVisible();
  40  |   expect(uploadHeaders.cookie).toBeUndefined();
  41  |   expect(uploadHeaders['x-csrf-token']).toBeUndefined();
  42  |   await page.getByRole('button', { name: 'Сдать работу', exact: true }).click();
  43  |   await expect(page.getByLabel('Твой ответ')).toBeDisabled();
  44  |   await expect(page.getByText('Работа сдана. Ждём комментарий преподавателя.')).toBeVisible();
  45  |   await expect(page.getByText('Сдано с опозданием', { exact: true })).toBeVisible();
  46  |   const result = await state(request);
  47  |   expect(result.confirmed).toBe(true);
  48  |   expect(result.submitted).toBe(true);
  49  |   const writes = result.calls.filter((c) => !['GET', 'HEAD'].includes(c.method));
  50  |   expect(writes.every((c) => c.csrf === 'fixture-csrf')).toBe(true);
  51  |   expect(
  52  |     writes.filter((c) => c.path.includes('/homework/')).every((c) => /^[\da-f-]{36}$/.test(c.key)),
  53  |   ).toBe(true);
  54  |   await page.goto('/student/subscription');
  55  |   await expect(page.locator('#main-content>section .balance strong')).toHaveText('6');
  56  |   await expect(page.getByRole('button', { name: /Оплатить|Карта|Пополнить/ })).toHaveCount(0);
  57  | });
  58  | test('debounce, server draft restoration and chronological versions', async ({ page, request }) => {
  59  |   await page.goto(`/student/homework/${homeworkId}`);
  60  |   await page.getByLabel('Твой ответ').fill('Первый текст');
  61  |   await page.waitForTimeout(700);
  62  |   await page.getByLabel('Твой ответ').fill('Последний текст');
  63  |   expect((await state(request)).calls.filter((c) => c.path.endsWith('/draft'))).toHaveLength(0);
  64  |   await expect.poll(async () => (await state(request)).draft).toBe('Последний текст');
  65  |   await expect(page.getByText('Черновик сохранён', { exact: true })).toBeVisible();
  66  |   expect((await state(request)).calls.filter((c) => c.path.endsWith('/draft'))).toHaveLength(1);
  67  |   await page.reload();
  68  |   await expect(page.getByLabel('Твой ответ')).toHaveValue('Последний текст');
  69  |   const versions = await page.locator('.versions>li h3').allTextContents();
  70  |   expect(versions[0]).toContain('Версия 1');
  71  |   expect(versions[1]).toContain('Версия 2');
  72  | });
  73  | test('lesson periods, calendar and manager reschedule request', async ({ page, request }) => {
  74  |   await page.goto('/student/lessons');
  75  |   for (const [label, period] of [
  76  |     ['Сегодня', 'today'],
  77  |     ['Неделя', 'week'],
  78  |     ['Месяц', 'month'],
  79  |     ['Архив', 'archive'],
  80  |   ]) {
  81  |     await page.getByRole('button', { name: label, exact: true }).click();
  82  |     await expect
  83  |       .poll(async () =>
  84  |         (await state(request)).calls.some((c) => c.query.includes(`period=${period}`)),
  85  |       )
  86  |       .toBe(true);
  87  |   }
  88  |   await expect(page.getByText('В этом периоде уроков нет.')).toBeVisible();
  89  |   await page.getByRole('button', { name: 'Календарь', exact: true }).click();
  90  |   await expect(page.getByLabel('Месяц', { exact: true })).toBeVisible();
  91  |   await page.getByRole('button', { name: 'Запросить перенос', exact: true }).click();
  92  |   const modal = page.getByRole('dialog');
  93  |   await expect(modal).toBeVisible();
  94  |   await modal.getByLabel('Причина').fill('В это время занят в школе');
  95  |   await modal.getByLabel('Желаемая дата').fill('2027-01-11');
  96  |   await modal.getByRole('button', { name: 'Отправить запрос' }).click();
  97  |   await expect(modal.getByText(/Запрос передан менеджеру/)).toBeVisible();
  98  |   expect(
  99  |     (await state(request)).calls.filter((c) => c.path.endsWith('/reschedule-request')),
  100 |   ).toHaveLength(1);
  101 | });
  102 | test('server canJoin authority and protected direct links', async ({ page }) => {
  103 |   await page.goto('/student/lessons');
  104 |   await expect(
  105 |     page.locator('.lesson-row').first().getByRole('link', { name: 'Подключиться', exact: true }),
  106 |   ).toHaveAttribute('href', /^https:\/\/meet.google.com/);
  107 |   await expect(
  108 |     page.locator('.lesson-row').nth(1).getByRole('button', { name: 'Подключиться', exact: true }),
  109 |   ).toBeDisabled();
  110 |   await page.goto(`/student/lessons/${lessonId}`);
  111 |   await expect(page.locator('main .lesson-row')).toHaveCount(1);
```
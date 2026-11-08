# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: student.spec.mjs >> login → forced password → dashboard → direct upload → submission → unchanged balance
- Location: tests\student.spec.mjs:13:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 5

- Array []
+ Array [
+   "/api/v1/platform/accounts",
+   "/api/v1/platform/accounts",
+   "/api/v1/platform/accounts",
+ ]
```

# Page snapshot

```yaml
- generic [ref=f2e4]:
  - link "Перейти к содержимому" [ref=f2e5] [cursor=pointer]:
    - /url: "#main-content"
  - complementary [ref=f2e6]:
    - link "Academy Кабинет ученика" [ref=f2e7] [cursor=pointer]:
      - /url: /student
      - generic [ref=f2e12]:
        - text: Academy
        - generic [ref=f2e13]: Кабинет ученика
    - navigation "Основная навигация" [ref=f2e14]:
      - link "Главная" [ref=f2e15] [cursor=pointer]:
        - /url: /student
      - link "Уроки" [ref=f2e20] [cursor=pointer]:
        - /url: /student/lessons
      - link "Домашние задания" [ref=f2e25] [cursor=pointer]:
        - /url: /student/homework
      - link "Мой путь знаний" [ref=f2e30] [cursor=pointer]:
        - /url: /student/skills
      - link "Материалы" [ref=f2e34] [cursor=pointer]:
        - /url: /student/materials
      - link "Абонемент" [ref=f2e38] [cursor=pointer]:
        - /url: /student/subscription
      - link "Уведомления 2 непрочитанных" [ref=f2e43] [cursor=pointer]:
        - /url: /student/notifications
        - generic [ref=f2e46]: Уведомления
        - generic "2 непрочитанных" [ref=f2e47]: "2"
      - link "Профиль и настройки" [ref=f2e48] [cursor=pointer]:
        - /url: /student/profile
    - link "Связаться с менеджером" [ref=f2e53] [cursor=pointer]:
      - /url: "#manager-contacts"
    - button "Выйти" [ref=f2e58] [cursor=pointer]
  - generic [ref=f2e59]:
    - banner [ref=f2e60]:
      - strong [ref=f2e61]: Личный кабинет
      - time [ref=f2e62]: 3 ноября
      - generic [ref=f2e63]:
        - link "Уведомления, непрочитанных 2" [ref=f2e64] [cursor=pointer]:
          - /url: /student/notifications
          - generic [ref=f2e67]: "2"
        - group [ref=f2e68]:
          - generic "София Ученик" [ref=f2e69] [cursor=pointer]:
            - generic [aria-hidden] [ref=f2e70]: С
            - generic [ref=f2e71]:
              - text: София
              - generic [ref=f2e72]: Ученик
            - generic [aria-hidden] [ref=f2e73]: ⌄
    - generic [ref=f2e74]:
      - main [ref=f2e75]:
        - heading "Абонемент" [level=1] [ref=f2e76]
        - paragraph [ref=f2e77]: Занятия, срок действия и история операций
        - generic [ref=f2e78]:
          - heading "Твой абонемент" [level=2] [ref=f2e80]
          - generic [ref=f2e81]: Активен
          - heading "Английский язык · 8 занятий" [level=3] [ref=f2e82]
          - generic [ref=f2e83]:
            - strong [ref=f2e84]: "6"
            - generic [ref=f2e85]: занятий осталось из 8
          - paragraph [ref=f2e86]: "Период: 1 октября — 30 ноября"
          - paragraph [ref=f2e87]: По вопросам абонемента обращайся к менеджеру.
        - generic [ref=f2e88]:
          - heading "Подтверждённые платежи" [level=2] [ref=f2e90]
          - list [ref=f2e91]:
            - listitem [ref=f2e92]:
              - strong [ref=f2e93]: 1600.0000 MDL
              - generic [ref=f2e94]: Оплата абонемента
              - generic [ref=f2e95]: "20 октября в 12:00 · Добавлено занятий: 8"
        - generic [ref=f2e96]:
          - heading "История занятий и баланса" [level=2] [ref=f2e98]
          - list [ref=f2e99]:
            - listitem [ref=f2e100]:
              - strong [ref=f2e101]: Проведённый урок
              - generic [ref=f2e102]: 7 → 6 занятий
              - generic [ref=f2e103]: 21 октября
      - complementary "Календарь и полезное" [ref=f2e104]:
        - generic [ref=f2e105]:
          - heading "Мой календарь" [level=2] [ref=f2e107]
          - generic [ref=f2e108]:
            - strong [ref=f2e109]: ноябрь 2026 г.
            - generic [ref=f2e110]:
              - button "Предыдущий месяц" [ref=f2e111] [cursor=pointer]: ‹
              - button "Следующий месяц" [ref=f2e112] [cursor=pointer]: ›
          - generic [ref=f2e113]:
            - generic [ref=f2e114]: Пн
            - generic [ref=f2e115]: Вт
            - generic [ref=f2e116]: Ср
            - generic [ref=f2e117]: Чт
            - generic [ref=f2e118]: Пт
            - generic [ref=f2e119]: Сб
            - generic [ref=f2e120]: Вс
            - button "1 ноября" [ref=f2e121] [cursor=pointer]: "1"
            - button "2 ноября" [ref=f2e122] [cursor=pointer]: "2"
            - button "3 ноября, есть урок" [pressed] [ref=f2e123] [cursor=pointer]: "3"
            - button "4 ноября" [ref=f2e124] [cursor=pointer]: "4"
            - button "5 ноября" [ref=f2e125] [cursor=pointer]: "5"
            - button "6 ноября, есть урок" [ref=f2e126] [cursor=pointer]: "6"
            - button "7 ноября" [ref=f2e127] [cursor=pointer]: "7"
            - button "8 ноября" [ref=f2e128] [cursor=pointer]: "8"
            - button "9 ноября" [ref=f2e129] [cursor=pointer]: "9"
            - button "10 ноября" [ref=f2e130] [cursor=pointer]: "10"
            - button "11 ноября" [ref=f2e131] [cursor=pointer]: "11"
            - button "12 ноября" [ref=f2e132] [cursor=pointer]: "12"
            - button "13 ноября" [ref=f2e133] [cursor=pointer]: "13"
            - button "14 ноября" [ref=f2e134] [cursor=pointer]: "14"
            - button "15 ноября" [ref=f2e135] [cursor=pointer]: "15"
            - button "16 ноября" [ref=f2e136] [cursor=pointer]: "16"
            - button "17 ноября" [ref=f2e137] [cursor=pointer]: "17"
            - button "18 ноября" [ref=f2e138] [cursor=pointer]: "18"
            - button "19 ноября" [ref=f2e139] [cursor=pointer]: "19"
            - button "20 ноября" [ref=f2e140] [cursor=pointer]: "20"
            - button "21 ноября" [ref=f2e141] [cursor=pointer]: "21"
            - button "22 ноября" [ref=f2e142] [cursor=pointer]: "22"
            - button "23 ноября" [ref=f2e143] [cursor=pointer]: "23"
            - button "24 ноября" [ref=f2e144] [cursor=pointer]: "24"
            - button "25 ноября" [ref=f2e145] [cursor=pointer]: "25"
            - button "26 ноября" [ref=f2e146] [cursor=pointer]: "26"
            - button "27 ноября" [ref=f2e147] [cursor=pointer]: "27"
            - button "28 ноября" [ref=f2e148] [cursor=pointer]: "28"
            - button "29 ноября" [ref=f2e149] [cursor=pointer]: "29"
            - button "30 ноября" [ref=f2e150] [cursor=pointer]: "30"
          - link "3 ноября в 01:02 Английский язык" [ref=f2e151] [cursor=pointer]:
            - /url: /student/lessons/10000000-0000-4000-8000-000000000001
            - strong [ref=f2e152]: 3 ноября в 01:02
            - generic [ref=f2e153]: Английский язык
        - generic [ref=f2e154]:
          - generic [ref=f2e155]:
            - heading "Абонемент" [level=2] [ref=f2e156]
            - link "Все →" [ref=f2e157] [cursor=pointer]:
              - /url: /student/subscription
          - generic [ref=f2e158]:
            - strong [ref=f2e162]: "6"
            - generic [ref=f2e163]: занятий осталось
          - paragraph [ref=f2e164]: Действует до 30 ноября
        - generic [ref=f2e165]:
          - generic [ref=f2e166]:
            - heading "Материалы" [level=2] [ref=f2e167]
            - link "Все →" [ref=f2e168] [cursor=pointer]:
              - /url: /student/materials
          - link "Словарь — Present Perfect.pdf Английский язык" [ref=f2e169] [cursor=pointer]:
            - /url: /student/materials
            - generic [ref=f2e172]:
              - text: Словарь — Present Perfect.pdf
              - generic [ref=f2e173]: Английский язык
        - generic [ref=f2e174]:
          - heading "Ваш менеджер" [level=2] [ref=f2e179]
          - paragraph [ref=f2e180]: Поможет с расписанием и вопросами по обучению.
          - generic [ref=f2e181]:
            - link "WhatsApp ↗" [ref=f2e182] [cursor=pointer]:
              - /url: https://wa.me/37360000001
            - link "Telegram ↗" [ref=f2e183] [cursor=pointer]:
              - /url: https://t.me/academy_manager
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
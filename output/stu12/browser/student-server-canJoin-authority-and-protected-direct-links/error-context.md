# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: student.spec.mjs >> server canJoin authority and protected direct links
- Location: tests\student.spec.mjs:102:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 4

- Array []
+ Array [
+   "/api/v1/platform/accounts",
+   "/api/v1/platform/accounts",
+ ]
```

# Page snapshot

```yaml
- generic [ref=f1e4]:
  - link "Перейти к содержимому" [ref=f1e5] [cursor=pointer]:
    - /url: "#main-content"
  - complementary [ref=f1e6]:
    - link "Academy Кабинет ученика" [ref=f1e7] [cursor=pointer]:
      - /url: /student
      - generic [ref=f1e12]:
        - text: Academy
        - generic [ref=f1e13]: Кабинет ученика
    - navigation "Основная навигация" [ref=f1e14]:
      - link "Главная" [ref=f1e15] [cursor=pointer]:
        - /url: /student
      - link "Уроки" [ref=f1e20] [cursor=pointer]:
        - /url: /student/lessons
      - link "Домашние задания" [ref=f1e25] [cursor=pointer]:
        - /url: /student/homework
      - link "Мой путь знаний" [ref=f1e30] [cursor=pointer]:
        - /url: /student/skills
      - link "Материалы" [ref=f1e34] [cursor=pointer]:
        - /url: /student/materials
      - link "Абонемент" [ref=f1e38] [cursor=pointer]:
        - /url: /student/subscription
      - link "Уведомления 2 непрочитанных" [ref=f1e43] [cursor=pointer]:
        - /url: /student/notifications
        - generic [ref=f1e46]: Уведомления
        - generic "2 непрочитанных" [ref=f1e47]: "2"
      - link "Профиль и настройки" [ref=f1e48] [cursor=pointer]:
        - /url: /student/profile
    - link "Связаться с менеджером" [ref=f1e53] [cursor=pointer]:
      - /url: "#manager-contacts"
    - button "Выйти" [ref=f1e58] [cursor=pointer]
  - generic [ref=f1e59]:
    - banner [ref=f1e60]:
      - strong [ref=f1e61]: Личный кабинет
      - time [ref=f1e62]: 3 ноября
      - generic [ref=f1e63]:
        - link "Уведомления, непрочитанных 2" [ref=f1e64] [cursor=pointer]:
          - /url: /student/notifications
          - generic [ref=f1e67]: "2"
        - group [ref=f1e68]:
          - generic "София Ученик" [ref=f1e69] [cursor=pointer]:
            - generic [aria-hidden] [ref=f1e70]: С
            - generic [ref=f1e71]:
              - text: София
              - generic [ref=f1e72]: Ученик
            - generic [aria-hidden] [ref=f1e73]: ⌄
    - generic [ref=f1e74]:
      - main [ref=f1e75]:
        - link "← Все уроки" [ref=f1e76] [cursor=pointer]:
          - /url: /student/lessons
        - heading "Урок" [level=1] [ref=f1e77]
        - generic [ref=f1e78]:
          - heading "Информация об уроке" [level=2] [ref=f1e80]
          - generic [ref=f1e81]:
            - generic [ref=f1e82]:
              - generic [ref=f1e83]: Дата и время
              - generic [ref=f1e84]: Преподаватель / Предмет
              - generic [ref=f1e85]: Статус
              - generic [ref=f1e86]: Действия
            - article [ref=f1e87]:
              - generic [ref=f1e88]:
                - link [ref=f1e89] [cursor=pointer]:
                  - /url: /student/lessons/10000000-0000-4000-8000-000000000001
                  - strong [ref=f1e90]: 3 ноября в 01:03
                - generic [ref=f1e91]: 50 минут
              - generic [ref=f1e92]:
                - strong [ref=f1e93]: Английский язык
                - generic [ref=f1e94]: Елизавета К.
              - generic [ref=f1e95]: По расписанию
              - link "Подключиться" [ref=f1e97] [cursor=pointer]:
                - /url: https://meet.google.com/abc-defg-hij
      - complementary "Календарь и полезное" [ref=f1e101]:
        - generic [ref=f1e102]:
          - heading "Мой календарь" [level=2] [ref=f1e104]
          - generic [ref=f1e105]:
            - strong [ref=f1e106]: ноябрь 2026 г.
            - generic [ref=f1e107]:
              - button "Предыдущий месяц" [ref=f1e108] [cursor=pointer]: ‹
              - button "Следующий месяц" [ref=f1e109] [cursor=pointer]: ›
          - generic [ref=f1e110]:
            - generic [ref=f1e111]: Пн
            - generic [ref=f1e112]: Вт
            - generic [ref=f1e113]: Ср
            - generic [ref=f1e114]: Чт
            - generic [ref=f1e115]: Пт
            - generic [ref=f1e116]: Сб
            - generic [ref=f1e117]: Вс
            - button "1 ноября" [ref=f1e118] [cursor=pointer]: "1"
            - button "2 ноября" [ref=f1e119] [cursor=pointer]: "2"
            - button "3 ноября, есть урок" [pressed] [ref=f1e120] [cursor=pointer]: "3"
            - button "4 ноября" [ref=f1e121] [cursor=pointer]: "4"
            - button "5 ноября" [ref=f1e122] [cursor=pointer]: "5"
            - button "6 ноября, есть урок" [ref=f1e123] [cursor=pointer]: "6"
            - button "7 ноября" [ref=f1e124] [cursor=pointer]: "7"
            - button "8 ноября" [ref=f1e125] [cursor=pointer]: "8"
            - button "9 ноября" [ref=f1e126] [cursor=pointer]: "9"
            - button "10 ноября" [ref=f1e127] [cursor=pointer]: "10"
            - button "11 ноября" [ref=f1e128] [cursor=pointer]: "11"
            - button "12 ноября" [ref=f1e129] [cursor=pointer]: "12"
            - button "13 ноября" [ref=f1e130] [cursor=pointer]: "13"
            - button "14 ноября" [ref=f1e131] [cursor=pointer]: "14"
            - button "15 ноября" [ref=f1e132] [cursor=pointer]: "15"
            - button "16 ноября" [ref=f1e133] [cursor=pointer]: "16"
            - button "17 ноября" [ref=f1e134] [cursor=pointer]: "17"
            - button "18 ноября" [ref=f1e135] [cursor=pointer]: "18"
            - button "19 ноября" [ref=f1e136] [cursor=pointer]: "19"
            - button "20 ноября" [ref=f1e137] [cursor=pointer]: "20"
            - button "21 ноября" [ref=f1e138] [cursor=pointer]: "21"
            - button "22 ноября" [ref=f1e139] [cursor=pointer]: "22"
            - button "23 ноября" [ref=f1e140] [cursor=pointer]: "23"
            - button "24 ноября" [ref=f1e141] [cursor=pointer]: "24"
            - button "25 ноября" [ref=f1e142] [cursor=pointer]: "25"
            - button "26 ноября" [ref=f1e143] [cursor=pointer]: "26"
            - button "27 ноября" [ref=f1e144] [cursor=pointer]: "27"
            - button "28 ноября" [ref=f1e145] [cursor=pointer]: "28"
            - button "29 ноября" [ref=f1e146] [cursor=pointer]: "29"
            - button "30 ноября" [ref=f1e147] [cursor=pointer]: "30"
          - link "3 ноября в 01:03 Английский язык" [ref=f1e148] [cursor=pointer]:
            - /url: /student/lessons/10000000-0000-4000-8000-000000000001
            - strong [ref=f1e149]: 3 ноября в 01:03
            - generic [ref=f1e150]: Английский язык
        - generic [ref=f1e151]:
          - generic [ref=f1e152]:
            - heading "Абонемент" [level=2] [ref=f1e153]
            - link "Все →" [ref=f1e154] [cursor=pointer]:
              - /url: /student/subscription
          - generic [ref=f1e155]:
            - strong [ref=f1e159]: "6"
            - generic [ref=f1e160]: занятий осталось
          - paragraph [ref=f1e161]: Действует до 30 ноября
        - generic [ref=f1e162]:
          - generic [ref=f1e163]:
            - heading "Материалы" [level=2] [ref=f1e164]
            - link "Все →" [ref=f1e165] [cursor=pointer]:
              - /url: /student/materials
          - link "Словарь — Present Perfect.pdf Английский язык" [ref=f1e166] [cursor=pointer]:
            - /url: /student/materials
            - generic [ref=f1e169]:
              - text: Словарь — Present Perfect.pdf
              - generic [ref=f1e170]: Английский язык
        - generic [ref=f1e171]:
          - heading "Ваш менеджер" [level=2] [ref=f1e176]
          - paragraph [ref=f1e177]: Поможет с расписанием и вопросами по обучению.
          - generic [ref=f1e178]:
            - link "WhatsApp ↗" [ref=f1e179] [cursor=pointer]:
              - /url: https://wa.me/37360000001
            - link "Telegram ↗" [ref=f1e180] [cursor=pointer]:
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
# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: student.spec.mjs >> read-all resets both notification counters
- Location: tests\student.spec.mjs:134:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "/api/v1/platform/accounts",
+ ]
```

# Page snapshot

```yaml
- generic [ref=e4]:
  - link "Перейти к содержимому" [ref=e5] [cursor=pointer]:
    - /url: "#main-content"
  - complementary [ref=e6]:
    - link "Academy Кабинет ученика" [ref=e7] [cursor=pointer]:
      - /url: /student
      - generic [ref=e12]:
        - text: Academy
        - generic [ref=e13]: Кабинет ученика
    - navigation "Основная навигация" [ref=e14]:
      - link "Главная" [ref=e15] [cursor=pointer]:
        - /url: /student
      - link "Уроки" [ref=e20] [cursor=pointer]:
        - /url: /student/lessons
      - link "Домашние задания" [ref=e25] [cursor=pointer]:
        - /url: /student/homework
      - link "Мой путь знаний" [ref=e30] [cursor=pointer]:
        - /url: /student/skills
      - link "Материалы" [ref=e34] [cursor=pointer]:
        - /url: /student/materials
      - link "Абонемент" [ref=e38] [cursor=pointer]:
        - /url: /student/subscription
      - link "Уведомления" [ref=e43] [cursor=pointer]:
        - /url: /student/notifications
      - link "Профиль и настройки" [ref=e47] [cursor=pointer]:
        - /url: /student/profile
    - link "Связаться с менеджером" [ref=e52] [cursor=pointer]:
      - /url: "#manager-contacts"
    - button "Выйти" [ref=e57] [cursor=pointer]
  - generic [ref=e58]:
    - banner [ref=e59]:
      - strong [ref=e60]: Личный кабинет
      - time [ref=e61]: 3 ноября
      - generic [ref=e62]:
        - link "Уведомления" [ref=e63] [cursor=pointer]:
          - /url: /student/notifications
        - group [ref=e66]:
          - generic "София Ученик" [ref=e67] [cursor=pointer]:
            - generic [aria-hidden] [ref=e68]: С
            - generic [ref=e69]:
              - text: София
              - generic [ref=e70]: Ученик
            - generic [aria-hidden] [ref=e71]: ⌄
    - generic [ref=e72]:
      - main [ref=e73]:
        - heading "Уведомления" [level=1] [ref=e74]
        - generic [ref=e75]:
          - paragraph [ref=e76]: "Непрочитанных: 0"
          - button "Прочитать все" [disabled] [ref=e77]
        - generic [ref=e78]:
          - heading "События обучения" [level=2] [ref=e80]
          - list [ref=e81]:
            - listitem [ref=e82]:
              - generic [ref=e83]:
                - heading "Преподаватель проверил работу" [level=3] [ref=e84]
                - paragraph [ref=e85]: Добавь ещё один пример и отправь новую версию.
                - generic [ref=e86]: 3 ноября в 00:58
      - complementary "Календарь и полезное" [ref=e87]:
        - generic [ref=e88]:
          - heading "Мой календарь" [level=2] [ref=e90]
          - generic [ref=e91]:
            - strong [ref=e92]: ноябрь 2026 г.
            - generic [ref=e93]:
              - button "Предыдущий месяц" [ref=e94] [cursor=pointer]: ‹
              - button "Следующий месяц" [ref=e95] [cursor=pointer]: ›
          - generic [ref=e96]:
            - generic [ref=e97]: Пн
            - generic [ref=e98]: Вт
            - generic [ref=e99]: Ср
            - generic [ref=e100]: Чт
            - generic [ref=e101]: Пт
            - generic [ref=e102]: Сб
            - generic [ref=e103]: Вс
            - button "1 ноября" [ref=e104] [cursor=pointer]: "1"
            - button "2 ноября" [ref=e105] [cursor=pointer]: "2"
            - button "3 ноября, есть урок" [pressed] [ref=e106] [cursor=pointer]: "3"
            - button "4 ноября" [ref=e107] [cursor=pointer]: "4"
            - button "5 ноября" [ref=e108] [cursor=pointer]: "5"
            - button "6 ноября, есть урок" [ref=e109] [cursor=pointer]: "6"
            - button "7 ноября" [ref=e110] [cursor=pointer]: "7"
            - button "8 ноября" [ref=e111] [cursor=pointer]: "8"
            - button "9 ноября" [ref=e112] [cursor=pointer]: "9"
            - button "10 ноября" [ref=e113] [cursor=pointer]: "10"
            - button "11 ноября" [ref=e114] [cursor=pointer]: "11"
            - button "12 ноября" [ref=e115] [cursor=pointer]: "12"
            - button "13 ноября" [ref=e116] [cursor=pointer]: "13"
            - button "14 ноября" [ref=e117] [cursor=pointer]: "14"
            - button "15 ноября" [ref=e118] [cursor=pointer]: "15"
            - button "16 ноября" [ref=e119] [cursor=pointer]: "16"
            - button "17 ноября" [ref=e120] [cursor=pointer]: "17"
            - button "18 ноября" [ref=e121] [cursor=pointer]: "18"
            - button "19 ноября" [ref=e122] [cursor=pointer]: "19"
            - button "20 ноября" [ref=e123] [cursor=pointer]: "20"
            - button "21 ноября" [ref=e124] [cursor=pointer]: "21"
            - button "22 ноября" [ref=e125] [cursor=pointer]: "22"
            - button "23 ноября" [ref=e126] [cursor=pointer]: "23"
            - button "24 ноября" [ref=e127] [cursor=pointer]: "24"
            - button "25 ноября" [ref=e128] [cursor=pointer]: "25"
            - button "26 ноября" [ref=e129] [cursor=pointer]: "26"
            - button "27 ноября" [ref=e130] [cursor=pointer]: "27"
            - button "28 ноября" [ref=e131] [cursor=pointer]: "28"
            - button "29 ноября" [ref=e132] [cursor=pointer]: "29"
            - button "30 ноября" [ref=e133] [cursor=pointer]: "30"
          - link "3 ноября в 01:03 Английский язык" [ref=e134] [cursor=pointer]:
            - /url: /student/lessons/10000000-0000-4000-8000-000000000001
            - strong [ref=e135]: 3 ноября в 01:03
            - generic [ref=e136]: Английский язык
        - generic [ref=e137]:
          - generic [ref=e138]:
            - heading "Абонемент" [level=2] [ref=e139]
            - link "Все →" [ref=e140] [cursor=pointer]:
              - /url: /student/subscription
          - generic [ref=e141]:
            - strong [ref=e145]: "6"
            - generic [ref=e146]: занятий осталось
          - paragraph [ref=e147]: Действует до 30 ноября
        - generic [ref=e148]:
          - generic [ref=e149]:
            - heading "Материалы" [level=2] [ref=e150]
            - link "Все →" [ref=e151] [cursor=pointer]:
              - /url: /student/materials
          - link "Словарь — Present Perfect.pdf Английский язык" [ref=e152] [cursor=pointer]:
            - /url: /student/materials
            - generic [ref=e155]:
              - text: Словарь — Present Perfect.pdf
              - generic [ref=e156]: Английский язык
        - generic [ref=e157]:
          - heading "Ваш менеджер" [level=2] [ref=e162]
          - paragraph [ref=e163]: Поможет с расписанием и вопросами по обучению.
          - generic [ref=e164]:
            - link "WhatsApp ↗" [ref=e165] [cursor=pointer]:
              - /url: https://wa.me/37360000001
            - link "Telegram ↗" [ref=e166] [cursor=pointer]:
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
# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: student.spec.mjs >> mobile five-item navigation, trapped drawer, tablet and desktop sizes
- Location: tests\student.spec.mjs:145:1

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
      - link "Уведомления 2 непрочитанных" [ref=e43] [cursor=pointer]:
        - /url: /student/notifications
        - generic [ref=e46]: Уведомления
        - generic "2 непрочитанных" [ref=e47]: "2"
      - link "Профиль и настройки" [ref=e48] [cursor=pointer]:
        - /url: /student/profile
    - link "Связаться с менеджером" [ref=e53] [cursor=pointer]:
      - /url: "#manager-contacts"
    - button "Выйти" [ref=e58] [cursor=pointer]
  - generic [ref=e59]:
    - banner [ref=e60]:
      - strong [ref=e61]: Личный кабинет
      - time [ref=e62]: 3 ноября
      - generic [ref=e63]:
        - link "Уведомления, непрочитанных 2" [ref=e64] [cursor=pointer]:
          - /url: /student/notifications
          - generic [ref=e67]: "2"
        - group [ref=e68]:
          - generic "София Ученик" [ref=e69] [cursor=pointer]:
            - generic [aria-hidden] [ref=e70]: С
            - generic [ref=e71]:
              - text: София
              - generic [ref=e72]: Ученик
            - generic [aria-hidden] [ref=e73]: ⌄
    - generic [ref=e74]:
      - main [ref=e75]:
        - generic [ref=e76]:
          - generic [ref=e77]:
            - paragraph [ref=e78]: Твой следующий шаг
            - heading "Привет, София!" [level=1] [ref=e79]: Привет, София! 👋
            - paragraph [ref=e80]: Продолжаем идти к большим целям. Всё начинается с одного урока.
          - generic [ref=e85]: ⚑
        - generic [ref=e86]:
          - generic [ref=e92]:
            - heading "Следующий урок" [level=2] [ref=e93]
            - link "3 ноября в 01:03" [ref=e94] [cursor=pointer]:
              - /url: /student/lessons/10000000-0000-4000-8000-000000000001
            - generic [ref=e95]: Английский язык
            - generic [ref=e96]: Через 5 мин.
            - link "Подключиться" [ref=e97] [cursor=pointer]:
              - /url: https://meet.google.com/abc-defg-hij
          - 'link "Домашние задания 1 задание Не сдано: 0 · Сдано: 0 На доработку: 1" [ref=e101] [cursor=pointer]':
            - /url: /student/homework
            - generic [ref=e106]:
              - heading "Домашние задания" [level=2] [ref=e107]
              - strong [ref=e108]: 1 задание
              - generic [ref=e109]: "Не сдано: 0 · Сдано: 0"
              - generic [ref=e110]: "На доработку: 1"
          - link "Мой путь знаний 1 применяю 1 4 навыков в карте" [ref=e111] [cursor=pointer]:
            - /url: /student/skills
            - generic [ref=e115]:
              - heading "Мой путь знаний" [level=2] [ref=e116]
              - strong [ref=e117]: 1 применяю
              - progressbar "Навыки на уровне «Применяю»" [ref=e118]
              - generic [ref=e119]: 4 навыков в карте
          - link "Осталось занятий 6 До 30 ноября" [ref=e120] [cursor=pointer]:
            - /url: /student/subscription
            - generic [ref=e125]:
              - heading "Осталось занятий" [level=2] [ref=e126]
              - strong [ref=e127]: "6"
              - generic [ref=e128]: До 30 ноября
        - generic [ref=e129]:
          - generic [ref=e130]:
            - heading "Ближайшие уроки" [level=2] [ref=e131]
            - link "Все →" [ref=e132] [cursor=pointer]:
              - /url: /student/lessons
          - generic [ref=e133]:
            - generic [ref=e134]:
              - generic [ref=e135]: Дата и время
              - generic [ref=e136]: Преподаватель / Предмет
              - generic [ref=e137]: Статус
              - generic [ref=e138]: Действия
            - article [ref=e139]:
              - generic [ref=e140]:
                - link [ref=e141] [cursor=pointer]:
                  - /url: /student/lessons/10000000-0000-4000-8000-000000000001
                  - strong [ref=e142]: 3 ноября в 01:03
                - generic [ref=e143]: 50 минут
              - generic [ref=e144]:
                - strong [ref=e145]: Английский язык
                - generic [ref=e146]: Елизавета К.
              - generic [ref=e147]: По расписанию
              - link "Подключиться" [ref=e149] [cursor=pointer]:
                - /url: https://meet.google.com/abc-defg-hij
            - article [ref=e153]:
              - generic [ref=e154]:
                - link [ref=e155] [cursor=pointer]:
                  - /url: /student/lessons/10000000-0000-4000-8000-000000000002
                  - strong [ref=e156]: 6 ноября в 00:58
                - generic [ref=e157]: 50 минут
              - generic [ref=e158]:
                - strong [ref=e159]: Математика
                - generic [ref=e160]: Александр Константинопольский — преподаватель математики
              - generic [ref=e161]: По расписанию
              - generic [ref=e162]:
                - button "Подключиться" [disabled] [ref=e163]
                - button "Запросить перенос" [ref=e167] [cursor=pointer]
        - generic [ref=e168]:
          - generic [ref=e169]:
            - generic [ref=e170]:
              - heading "Домашние задания" [level=2] [ref=e171]
              - link "Все →" [ref=e172] [cursor=pointer]:
                - /url: /student/homework
            - list [ref=e173]:
              - listitem [ref=e174]:
                - generic [ref=e175]:
                  - generic [ref=e176]: Английский язык
                  - link "Present Perfect. Рассказ о путешествии" [ref=e177] [cursor=pointer]:
                    - /url: /student/homework/20000000-0000-4000-8000-000000000001
                  - generic [ref=e178]: Сдать до 3 ноября
                - generic [ref=e179]: На доработку
          - generic [ref=e180]:
            - generic [ref=e181]:
              - heading "Мой путь знаний" [level=2] [ref=e182]
              - link "Все →" [ref=e183] [cursor=pointer]:
                - /url: /student/skills
            - generic [ref=e184]:
              - heading "Английский язык" [level=3] [ref=e185]
              - list [ref=e186]:
                - listitem [ref=e187]:
                  - generic [ref=e188]: Past Perfect
                  - generic [ref=e189]: Ещё не изучали
                - listitem [ref=e190]:
                  - generic [ref=e191]: Present Perfect
                  - generic [ref=e192]: Знакомлюсь
                - listitem [ref=e193]:
                  - generic [ref=e194]: Аудирование
                  - generic [ref=e195]: Практикую
                - listitem [ref=e196]:
                  - generic [ref=e197]: Знакомство
                  - generic [ref=e198]: Применяю
      - complementary "Календарь и полезное" [ref=e199]:
        - generic [ref=e200]:
          - heading "Мой календарь" [level=2] [ref=e202]
          - generic [ref=e203]:
            - strong [ref=e204]: ноябрь 2026 г.
            - generic [ref=e205]:
              - button "Предыдущий месяц" [ref=e206] [cursor=pointer]: ‹
              - button "Следующий месяц" [ref=e207] [cursor=pointer]: ›
          - generic [ref=e208]:
            - generic [ref=e209]: Пн
            - generic [ref=e210]: Вт
            - generic [ref=e211]: Ср
            - generic [ref=e212]: Чт
            - generic [ref=e213]: Пт
            - generic [ref=e214]: Сб
            - generic [ref=e215]: Вс
            - button "1 ноября" [ref=e216] [cursor=pointer]: "1"
            - button "2 ноября" [ref=e217] [cursor=pointer]: "2"
            - button "3 ноября, есть урок" [pressed] [ref=e218] [cursor=pointer]: "3"
            - button "4 ноября" [ref=e219] [cursor=pointer]: "4"
            - button "5 ноября" [ref=e220] [cursor=pointer]: "5"
            - button "6 ноября, есть урок" [ref=e221] [cursor=pointer]: "6"
            - button "7 ноября" [ref=e222] [cursor=pointer]: "7"
            - button "8 ноября" [ref=e223] [cursor=pointer]: "8"
            - button "9 ноября" [ref=e224] [cursor=pointer]: "9"
            - button "10 ноября" [ref=e225] [cursor=pointer]: "10"
            - button "11 ноября" [ref=e226] [cursor=pointer]: "11"
            - button "12 ноября" [ref=e227] [cursor=pointer]: "12"
            - button "13 ноября" [ref=e228] [cursor=pointer]: "13"
            - button "14 ноября" [ref=e229] [cursor=pointer]: "14"
            - button "15 ноября" [ref=e230] [cursor=pointer]: "15"
            - button "16 ноября" [ref=e231] [cursor=pointer]: "16"
            - button "17 ноября" [ref=e232] [cursor=pointer]: "17"
            - button "18 ноября" [ref=e233] [cursor=pointer]: "18"
            - button "19 ноября" [ref=e234] [cursor=pointer]: "19"
            - button "20 ноября" [ref=e235] [cursor=pointer]: "20"
            - button "21 ноября" [ref=e236] [cursor=pointer]: "21"
            - button "22 ноября" [ref=e237] [cursor=pointer]: "22"
            - button "23 ноября" [ref=e238] [cursor=pointer]: "23"
            - button "24 ноября" [ref=e239] [cursor=pointer]: "24"
            - button "25 ноября" [ref=e240] [cursor=pointer]: "25"
            - button "26 ноября" [ref=e241] [cursor=pointer]: "26"
            - button "27 ноября" [ref=e242] [cursor=pointer]: "27"
            - button "28 ноября" [ref=e243] [cursor=pointer]: "28"
            - button "29 ноября" [ref=e244] [cursor=pointer]: "29"
            - button "30 ноября" [ref=e245] [cursor=pointer]: "30"
          - link "3 ноября в 01:03 Английский язык" [ref=e246] [cursor=pointer]:
            - /url: /student/lessons/10000000-0000-4000-8000-000000000001
            - strong [ref=e247]: 3 ноября в 01:03
            - generic [ref=e248]: Английский язык
        - generic [ref=e249]:
          - generic [ref=e250]:
            - heading "Абонемент" [level=2] [ref=e251]
            - link "Все →" [ref=e252] [cursor=pointer]:
              - /url: /student/subscription
          - generic [ref=e253]:
            - strong [ref=e257]: "6"
            - generic [ref=e258]: занятий осталось
          - paragraph [ref=e259]: Действует до 30 ноября
        - generic [ref=e260]:
          - generic [ref=e261]:
            - heading "Материалы" [level=2] [ref=e262]
            - link "Все →" [ref=e263] [cursor=pointer]:
              - /url: /student/materials
          - link "Словарь — Present Perfect.pdf Английский язык" [ref=e264] [cursor=pointer]:
            - /url: /student/materials
            - generic [ref=e267]:
              - text: Словарь — Present Perfect.pdf
              - generic [ref=e268]: Английский язык
        - generic [ref=e269]:
          - heading "Ваш менеджер" [level=2] [ref=e274]
          - paragraph [ref=e275]: Поможет с расписанием и вопросами по обучению.
          - generic [ref=e276]:
            - link "WhatsApp ↗" [ref=e277] [cursor=pointer]:
              - /url: https://wa.me/37360000001
            - link "Telegram ↗" [ref=e278] [cursor=pointer]:
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
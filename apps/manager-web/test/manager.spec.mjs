import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir } from 'node:fs/promises';
const sid = '11111111-1111-4111-8111-111111111111',
  tid = '99999999-9999-4999-8999-999999999999';
const card = `/manager/students/${sid}`;
async function ready(page, path = '/manager/') {
  await page.goto(path);
  await expect(page.getByRole('navigation', { name: 'Меню' })).toBeVisible();
}
async function mutate(page, fn) {
  await page.evaluate(fn);
  await page.evaluate(() => window.__managerMock.invalidate());
}
async function noLeaks(page) {
  expect(await page.evaluate(() => window.__managerMock.secretInCaches())).toBe(false);
  expect(
    await page.evaluate(() =>
      JSON.stringify([localStorage, sessionStorage, location.href]).includes(
        'Fixture-Only-Password',
      ),
    ),
  ).toBe(false);
}

test('СЦ-М-01: CRM → receipt → director publication → subscription → one-time account', async ({
  page,
}) => {
  await ready(page, '/manager/students');
  await page.getByRole('button', { name: 'Новый ученик' }).click();
  await page.getByLabel('Имя и фамилия', { exact: true }).fill('Иван Тестовый');
  await page.getByLabel('Email', { exact: true }).fill('new@example.test');
  await page.getByRole('button', { name: 'Создать', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Иван Тестовый' })).toBeVisible();
  await page.getByRole('link', { name: 'Платежи', exact: true }).first().click();
  await page.getByRole('button', { name: 'Зарегистрировать поступление' }).click();
  await page.getByLabel('Сумма, MDL', { exact: true }).fill('1600.0001');
  await page.getByLabel('Способ оплаты').selectOption('BANK_TRANSFER');
  await page.getByLabel('Назначение', { exact: true }).selectOption('FIRST_PAYMENT');
  await page.getByLabel('Дата и время поступления').fill('2026-11-01T12:00');
  await page
    .getByRole('button', { name: 'Зарегистрировать поступление', exact: true })
    .last()
    .click();
  await page.getByRole('button', { name: 'Готово', exact: true }).click();
  await page.getByRole('button', { name: 'Передать директору', exact: true }).click();
  await page.getByLabel('Я понимаю последствия и подтверждаю действие').check();
  await page.getByRole('button', { name: 'Передать директору', exact: true }).last().click();
  await expect(page.getByRole('status')).toContainText('Запрос передан директору');
  await page.getByRole('button', { name: 'Готово', exact: true }).click();
  await mutate(page, () => {
    window.__managerMock.payments.forEach((p) => {
      p.status = 'CONFIRMED';
    });
  });
  await page.getByRole('button', { name: 'Подготовить новый пакет', exact: true }).click();
  await page
    .getByLabel('Учебное направление', { exact: true })
    .selectOption('33333333-3333-4333-8333-333333333333');
  await page
    .getByLabel('Тариф', { exact: true })
    .selectOption('44444444-4444-4444-8444-444444444444');
  await page.getByLabel('Сумма, MDL', { exact: true }).fill('1600.0001');
  await page.getByRole('button', { name: 'Подготовить новый пакет', exact: true }).last().click();
  await expect(page.getByRole('status')).toContainText('Распределение подготовлено');
  await page.getByRole('button', { name: 'Готово', exact: true }).click();
  await mutate(page, () => window.__managerMock.approvePayment());
  await page.getByRole('link', { name: 'Абонементы', exact: true }).click();
  await page.getByRole('button', { name: 'Активировать абонемент' }).click();
  await page
    .getByLabel('Готовое распределение')
    .selectOption('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  await page.getByRole('button', { name: 'Активировать абонемент', exact: true }).last().click();
  await page.getByRole('link', { name: 'Аккаунт', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill('new@example.test');
  await page.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Передайте пароль ученику' })).toBeVisible();
  await noLeaks(page);
  await page.getByRole('link', { name: 'Карточка ученика' }).click();
  await expect(page.getByRole('heading', { name: 'Иван Тестовый' })).toBeVisible();
  await expect(page.getByText('Fixture-Only-Password!47', { exact: true })).toHaveCount(0);
  await noLeaks(page);
  const commands = await page.evaluate(() =>
    window.__managerMock.commands.map(({ op, key, csrf, body }) => ({
      op,
      key,
      csrf,
      amount: body.amount,
    })),
  );
  expect(commands.find((c) => c.op === 'createManagerPayment')?.amount).toBe('1600.0001');
  for (const c of commands) {
    expect(c.key).toMatch(/^[0-9a-f-]{36}$/);
    expect(c.csrf).toBe('fixture-csrf');
  }
});
test('СЦ-М-02: renew uses a published allocation and leaves immutable package history to Finance', async ({
  page,
}) => {
  await ready(page, `${card}?tab=subscriptions`);
  await page.getByRole('button', { name: 'Продлить', exact: true }).click();
  await page
    .getByLabel('Готовое распределение')
    .selectOption('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  await page.getByRole('button', { name: 'Продлить', exact: true }).last().click();
  await expect(page.getByText('14 / 16', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__managerMock.commands.at(-1).body)).toMatchObject({
    distributionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  });
});
test('СЦ-М-03: reschedule task → claim → explicit school time → director exception', async ({
  page,
}) => {
  await ready(page, '/manager/tasks');
  await mutate(page, () => window.__managerMock.rescheduleTask());
  await page.getByRole('link', { name: 'Запрос переноса', exact: true }).click();
  await page.getByRole('button', { name: 'Взять в работу', exact: true }).click();
  await page.getByLabel('Дата и время', { exact: true }).fill('2026-11-05T18:00');
  await page.getByLabel('Причина', { exact: true }).fill('По просьбе ученика');
  await page.getByLabel('Запросить исключение у директора').check();
  await page.getByRole('button', { name: 'Перенести', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Запрос передан директору');
  expect(await page.evaluate(() => window.__managerMock.commands.at(-1).body.newStartsAt)).toBe(
    '2026-11-05T18:00:00+02:00',
  );
});
test('СЦ-М-04: dispute → CAS conflict keeps reason → director proposal, text is never HTML', async ({
  page,
}) => {
  await ready(page, `/manager/tasks/${tid}`);
  await expect(page.locator('img')).toHaveCount(0);
  await expect(
    page.getByText('<img src=x onerror=alert(1)> Урок не состоялся.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Взять в работу', exact: true }).click();
  await page.getByLabel('Решение', { exact: true }).selectOption('ACCEPT');
  await page.getByLabel('Причина', { exact: true }).fill('Проверено: урок не состоялся');
  await page.getByLabel('Я понимаю последствия и подтверждаю действие').check();
  await page.evaluate(() => {
    window.__managerMock.conflict = true;
  });
  await page.getByRole('button', { name: 'Принять решение', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Данные изменились' })).toBeVisible();
  await page.getByRole('button', { name: 'Загрузить актуальную версию' }).click();
  await expect(page.getByLabel('Причина', { exact: true })).toHaveValue(
    'Проверено: урок не состоялся',
  );
  await page.getByRole('button', { name: 'Принять решение', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Запрос передан директору');
  expect(await page.evaluate(() => window.__managerMock.task.approvalStatus)).toBe(
    'AWAITING_DIRECTOR',
  );
});
test('СЦ-М-05: freeze explicit consent and independent lesson cancellation', async ({ page }) => {
  await ready(page, `${card}?tab=subscriptions`);
  await page.getByRole('button', { name: 'Заморозить', exact: true }).click();
  await page.getByLabel('Начало заморозки').fill('2026-11-02');
  await page.getByLabel('Дата возобновления', { exact: true }).fill('2026-11-09');
  await page.getByLabel('Причина', { exact: true }).selectOption('ILLNESS');
  await page.getByRole('button', { name: 'Заморозить', exact: true }).last().click();
  expect(await page.evaluate(() => window.__managerMock.commands.length)).toBe(0);
  await page.getByLabel('Я понимаю последствия и подтверждаю действие').check();
  await page.getByRole('button', { name: 'Заморозить', exact: true }).last().click();
  await expect(page.getByText('Заморожен', { exact: true }).last()).toBeVisible();
  expect(
    await page.evaluate(() => window.__managerMock.commands.at(-1).body.cancelConflictingLessons),
  ).toBe(false);
  await page.getByRole('button', { name: 'Разморозить', exact: true }).click();
  await page.getByLabel('Я понимаю последствия и подтверждаю действие').check();
  await page.getByRole('button', { name: 'Разморозить', exact: true }).last().click();
  await expect(page.getByRole('button', { name: 'Заморозить', exact: true })).toBeVisible();
});
test('notifications report QUEUED202, calendar cancel/Meet and session termination', async ({
  page,
}) => {
  await ready(page, `${card}?tab=notifications`);
  await page.getByRole('button', { name: /Отправить уведомление/ }).click();
  await page.getByLabel('Текст сообщения').fill('Напоминаем о занятии.');
  await page.getByRole('button', { name: 'Отправить уведомление', exact: true }).last().click();
  await expect(page.getByRole('status')).toContainText('поставлено в очередь');
  await page.getByRole('button', { name: 'Готово', exact: true }).click();
  await expect(page.getByRole('listitem').getByText('В очереди', { exact: true })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Меню' })
    .getByRole('link', { name: 'Расписание', exact: true })
    .click();
  await page.getByRole('combobox', { name: 'Расписание', exact: true }).selectOption('list');
  await page.getByRole('button', { name: 'Google Meet', exact: true }).first().click();
  await page.getByLabel('Ссылка Google Meet').fill('https://meet.google.com/xyz-abcd-efg');
  await page.getByRole('button', { name: 'Google Meet', exact: true }).last().click();
  await page.getByRole('button', { name: 'Готово', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Открыть Google Meet' }).first()).toHaveAttribute(
    'href',
    'https://meet.google.com/xyz-abcd-efg',
  );
  await page.evaluate(() => {
    window.__managerMock.session = 'anonymous';
  });
  await page
    .getByRole('navigation', { name: 'Меню' })
    .getByRole('link', { name: 'Задачи', exact: true })
    .click();
  await expect(page).toHaveURL(/\/manager\/login/);
  await noLeaks(page);
});
test('no-access, error and empty states are explicit', async ({ page }) => {
  await ready(page);
  await mutate(page, () => {
    window.__managerMock.empty = true;
  });
  await expect(page.getByText('Просроченных задач нет', { exact: true })).toBeVisible();
  await mutate(page, () => {
    window.__managerMock.fail = true;
  });
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('Internal detail must never be displayed')).toHaveCount(0);
  await mutate(page, () => {
    window.__managerMock.fail = false;
    window.__managerMock.session = 'forbidden';
  });
  await expect(page.getByRole('heading', { name: 'Нет доступа' })).toBeVisible();
});
for (const width of [360, 768, 1280])
  test(`accessibility and responsive ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await ready(page, '/manager/students');
    await expect(page.getByRole('link', { name: 'Александра Русу', exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    if (width === 360) {
      await expect(page.locator('.table-head')).toBeHidden();
      expect(
        await page
          .locator('.table-row')
          .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length),
      ).toBe(1);
    }
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
    await mkdir('../../output/mgr10/screenshots', { recursive: true });
    await page.screenshot({
      path: `../../output/mgr10/screenshots/students-${width}.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Новый ученик' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

test('staff password login stops at MFA and never grants access itself', async ({ page }) => {
  await page.goto('/manager/login');
  await page.getByLabel('Email', { exact: true }).fill('manager@example.test');
  await page.getByLabel('Пароль', { exact: true }).fill('Fixture-Password!47');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Подтвердите вход ключом доступа' }),
  ).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Меню' })).toHaveCount(0);
  await noLeaks(page);
});

test('owner-enabled password-only manager login opens the cabinet without passkey', async ({
  page,
}) => {
  await page.goto('/manager/login');
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await page.evaluate(() => {
    window.__managerMock.passwordOnly = true;
  });
  await page.getByLabel('Email', { exact: true }).fill('manager@example.test');
  await page.getByLabel('Пароль', { exact: true }).fill('Fixture-Password!47');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Меню' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Подтвердите вход ключом доступа' })).toHaveCount(
    0,
  );
  await noLeaks(page);
});

test('leaving account page before completion suppresses a late password; logout clears every cache', async ({
  page,
}) => {
  await ready(page, `${card}/account`);
  await page.evaluate(() => {
    window.__managerMock.accountDelay = 500;
  });
  await page.getByLabel('Email', { exact: true }).fill('student@example.test');
  await page.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  await page.getByRole('link', { name: 'Карточка ученика' }).click();
  await expect(page.getByRole('heading', { name: 'Александра Русу', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__managerMock.student.hasAccount)).toBe(true);
  await expect(page.getByRole('heading', { name: 'Передайте пароль ученику' })).toHaveCount(0);
  await noLeaks(page);
  await page.getByRole('button', { name: 'Выйти', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Вход в кабинет' })).toBeVisible();
  expect(await page.evaluate(() => window.__managerMock.cacheEmpty())).toBe(true);
});

test('accessibility on dashboard, student tabs, schedule, tasks and task decision', async ({
  page,
}) => {
  for (const path of [
    '/manager/',
    card,
    `${card}?tab=subscriptions`,
    `${card}?tab=payments`,
    `${card}?tab=notifications`,
    '/manager/schedule',
    '/manager/tasks',
    `/manager/tasks/${tid}`,
  ]) {
    await ready(page, path);
    await expect(page.locator('main').getByRole('heading', { level: 1 }).first()).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
  }
});

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('lead list masks phone; claim and schedule trial use CSRF and generated commands', async ({
  page,
}) => {
  await page.goto('/manager/leads');
  await expect(page.getByRole('heading', { name: 'Заявки', exact: true })).toBeVisible();
  await expect(page.getByText('+37360000123', { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Виктория Мирон', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Виктория Мирон', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Взять в работу', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Назначить пробный', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Назначить пробный', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByLabel('Преподаватель', { exact: true })
    .selectOption({ label: 'Андрей Чобану' });
  await dialog.getByLabel('Дата', { exact: true }).fill('2030-11-01T16:00');
  await dialog.getByRole('button', { name: 'Назначить пробный', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Ожидает обработки', { exact: true }).first()).toBeVisible();
  const commands = await page.evaluate(() =>
    window.__managerMock.commands.filter((c) =>
      ['claimManagerLead', 'scheduleManagerTrial'].includes(c.op),
    ),
  );
  expect(commands).toHaveLength(2);
  expect(commands.every((c) => c.csrf && c.key)).toBeTruthy();
});
test('duplicate requires explicit force choice; lost lead can be reopened; comments remain text', async ({
  page,
}) => {
  await page.goto('/manager/leads');
  await expect(page.getByRole('heading', { name: 'Заявки', exact: true })).toBeVisible();
  await page.evaluate(() => {
    window.__managerMock.duplicateLead = true;
  });
  await page.getByRole('button', { name: /Новая заявка$/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Имя будущего ученика', { exact: true }).fill('Тестовая заявка');
  await dialog.getByLabel('Имя родителя или представителя', { exact: true }).fill('Родитель');
  await dialog.getByLabel('Телефон', { exact: true }).fill('+37360000123');
  await dialog.getByLabel('Предмет', { exact: true }).selectOption({ label: 'Математика' });
  await dialog.getByLabel('Комментарий', { exact: true }).fill('<img src=x onerror=alert(1)>');
  await dialog.getByRole('button', { name: 'Новая заявка', exact: true }).click();
  await expect(dialog.getByText(/В вашем портфолио уже есть/)).toBeVisible();
  await dialog
    .getByLabel('Создать отдельную заявку, несмотря на совпадение контактов', { exact: true })
    .check();
  await dialog.getByRole('button', { name: 'Новая заявка', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Тестовая заявка', exact: true })).toBeVisible();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  await expect(page.getByText('<img src=x onerror=alert(1)>', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Закрыть без оплаты', exact: true }).click();
  const lose = page.getByRole('dialog');
  await lose.getByLabel('Причина закрытия', { exact: true }).selectOption('PRICE');
  await lose.getByRole('button', { name: 'Закрыть без оплаты', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Возобновить заявку', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Возобновить заявку', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Назначить пробный', exact: true })).toBeVisible();
});
for (const width of [360, 768, 1536])
  test(`lead screens accessibility and layout at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/manager/leads');
    await expect(page.getByRole('heading', { name: 'Заявки', exact: true })).toBeVisible();
    for (const mode of ['list', 'board', 'card']) {
      if (mode === 'board')
        await page.getByRole('button', { name: 'По стадиям', exact: true }).click();
      if (mode === 'card')
        await page.getByRole('link', { name: 'Виктория Мирон', exact: true }).click();
      const scan = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(
        scan.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      ).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
    }
  });

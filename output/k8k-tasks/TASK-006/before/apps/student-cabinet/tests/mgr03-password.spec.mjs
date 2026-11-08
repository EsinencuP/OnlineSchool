import { test, expect } from '@playwright/test';

test('MGR-03 browser: temporary login, forced password change and cabinet bootstrap', async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(120_000);
  await request.post('/__fixture/reset', { data: { auth: false, mustChangePassword: true } });
  await context.addCookies((await request.storageState()).cookies);
  await page.goto('/student/login');
  await page.getByLabel('Email', { exact: true }).fill('student@example.invalid');
  await page.getByLabel('Пароль', { exact: true }).fill('Temporary123');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/change-password$/, { timeout: 30_000 });
  await page.getByLabel('Текущий пароль', { exact: true }).fill('Temporary123');
  await page.getByLabel('Новый пароль', { exact: true }).fill('StudentPassword123');
  await page.getByLabel('Повторите новый пароль').fill('StudentPassword123');
  await page.getByRole('button', { name: 'Изменить пароль', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Привет, София/ })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page).toHaveURL(/\/student\/?$/);
  const state = await (await request.get('/__fixture/state')).json();
  expect(state.mustChangePassword).toBe(false);
  expect(state.missingRoutes).toEqual([]);
  const calls = state.calls;
  const login = calls.findIndex((c) => c.path === '/api/v1/auth/session');
  const change = calls.findIndex((c) => c.path.endsWith('/security/change-password'));
  expect(change).toBeGreaterThan(login);
  expect(calls.slice(login + 1, change).some((c) => c.path === '/api/v1/auth/csrf')).toBe(false);
  expect(calls[change].csrf).toBe('fixture-csrf');
  expect(calls[login].body).toEqual({});
  expect(calls[change].body).toEqual({});
});

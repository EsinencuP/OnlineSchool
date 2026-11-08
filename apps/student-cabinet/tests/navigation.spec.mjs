import { expect, test } from './gate-fixtures.mjs';

test('legacy student notifications opens the K8K bell', async ({ request, context, page }) => {
  await request.post('/__fixture/reset', { data: {} });
  await context.addCookies((await request.storageState()).cookies);
  await page.goto('/student/notifications?ui.k8k=1');
  await expect.poll(() => new URL(page.url()).pathname).toBe('/student');
  expect(new URL(page.url()).searchParams.get('events')).toBe('1');
  expect(new URL(page.url()).searchParams.get('ui.k8k')).toBe('1');
  const bell = page.locator('.k8k-notification-drawer');
  await expect(bell).toBeVisible();
  await expect(bell.getByText('Преподаватель проверил работу')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.k8k-bell')).toBeFocused();
  await expect(bell).toHaveCount(0);
});

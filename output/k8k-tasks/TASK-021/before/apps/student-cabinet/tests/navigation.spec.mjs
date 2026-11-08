import { expect, test } from '@playwright/test';

test('legacy student notifications opens the K8K bell', async ({ request, context, page }) => {
  await request.post('/__fixture/reset', { data: {} });
  await context.addCookies((await request.storageState()).cookies);
  await page.goto('/student/notifications?ui.k8k=1');
  await expect(page).toHaveURL(/\/student\?events=1$/);
  const bell = page.locator('.k8k-notification-menu');
  await expect(bell).toHaveAttribute('open', '');
  await expect(bell.getByText('Преподаватель проверил работу')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(bell.locator('summary')).toBeFocused();
  await expect(bell).not.toHaveAttribute('open');
});

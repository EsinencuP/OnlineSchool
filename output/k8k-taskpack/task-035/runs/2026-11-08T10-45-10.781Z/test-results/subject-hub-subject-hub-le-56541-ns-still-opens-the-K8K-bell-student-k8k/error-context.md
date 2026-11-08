# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: subject-hub.spec.mjs >> subject-hub legacy notifications still opens the K8K bell
- Location: tests\subject-hub.spec.mjs:389:1

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/student\?events=1$/
Received string:  "http://127.0.0.1:4175/student?ui.k8k=1&events=1"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    - locator resolved to <html lang="ru" data-k8k="provisional">…</html>
    - unexpected value "http://127.0.0.1:4175/student/notifications?ui.k8k=1"
    13 × locator resolved to <html lang="ru" data-k8k="provisional">…</html>
       - unexpected value "http://127.0.0.1:4175/student?ui.k8k=1&events=1"

```

```yaml
- dialog "Последние события":
  - banner:
    - heading "Последние события" [level=2]
    - button "Закрыть окно"
  - paragraph: Событие ведёт к исходному объекту. Отметка прочтения не выполняет действие по нему.
  - button "Прочитать все"
  - button "Обновить события"
  - status: "Непрочитанных во всей ленте: 2 · Всего событий: 1"
  - paragraph:
    - text: Получено в
    - time: 8 ноября в 12:47
    - text: · Europe/Chisinau
  - list:
    - listitem:
      - paragraph: ДЗ на доработке
      - heading "Преподаватель проверил работу" [level=3]
      - paragraph: Добавь ещё один пример и отправь новую версию.
      - time: 8 ноября 2026 г. в 12:47
      - paragraph: Не прочитано
      - button "Отметить прочитанным"
```

# Test source

```ts
  296 |   await action.click();
  297 |   await expect(page).toHaveURL(new RegExp('/homework\\?fromSubjectId=' + englishId));
  298 |   await page.getByRole('link', { name: /Present Perfect/ }).click();
  299 |   const editor = page.getByLabel('Твой ответ');
  300 |   await editor.fill('Синтетический черновик');
  301 |   await page.getByRole('link', { name: 'К предмету' }).click();
  302 |   const dialog = page.getByRole('dialog', { name: 'Черновик ещё не сохранён' });
  303 |   await expect(dialog).toBeVisible();
  304 |   await expect(dialog.getByRole('button', { name: 'Остаться' })).toBeInViewport();
  305 |   await page.keyboard.press('Escape');
  306 |   await expect(dialog).toHaveCount(0);
  307 |   await expect(page.getByRole('link', { name: 'К предмету' })).toBeFocused();
  308 |   await expect(editor).toHaveValue('Синтетический черновик');
  309 |   await expect.poll(async () => (await state(request)).draft).toBe('Синтетический черновик');
  310 |   await expect(page.getByText('Черновик сохранён', { exact: true })).toBeVisible();
  311 |   await page.goBack();
  312 |   await page.goBack();
  313 |   await expect(page).toHaveURL(new RegExp('subjectId=' + englishId));
  314 |   await expect.poll(() => page.evaluate(() => globalThis.scrollY)).toBe(position);
  315 |   await action.click();
  316 |   await page.getByRole('link', { name: /Present Perfect/ }).click();
  317 |   await expect(editor).toHaveValue('Синтетический черновик');
  318 |   await page.getByRole('link', { name: 'К предмету' }).click();
  319 |   await expect(page).toHaveURL(new RegExp('/subjects\\?subjectId=' + englishId + '$'));
  320 |   await expect.poll(() => page.evaluate(() => globalThis.scrollY)).toBe(position);
  321 |   expect(
  322 |     (await state(request)).calls
  323 |       .filter((call) => call.path.endsWith('/student/homework'))
  324 |       .every((call) => !/subjectId/i.test(call.query)),
  325 |   ).toBe(true);
  326 | });
  327 | 
  328 | test('subject-hub keyboard, focus on refresh, and safe absent contacts', async ({
  329 |   request,
  330 |   context,
  331 |   page,
  332 | }) => {
  333 |   await start({ request, context, page }, 'ru', {
  334 |     subjectHub: true,
  335 |     managerContacts: { whatsapp: null, telegram: null },
  336 |   });
  337 |   await page.setViewportSize({ width: 360, height: 720 });
  338 |   await page.goto(hub + '?ui.k8k=1');
  339 |   const skip = page.getByRole('link', { name: 'Перейти к содержимому' });
  340 |   await skip.focus();
  341 |   await page.keyboard.press('Enter');
  342 |   await expect(page.locator('#main-content')).toBeFocused();
  343 |   const trigger = page.locator('.k8k-bottom-nav button');
  344 |   await trigger.focus();
  345 |   await page.keyboard.press('Enter');
  346 |   await expect(page.locator('.k8k-mobile-menu nav a').first()).toBeFocused();
  347 |   await page.keyboard.press('Escape');
  348 |   await expect(trigger).toBeFocused();
  349 |   const focus = card(page, 'Математика').getByRole('link', { name: 'Открыть предмет' });
  350 |   await focus.focus();
  351 |   await page.evaluate(() => globalThis.window.scrollBy(0, 30));
  352 |   const scroll = await page.evaluate(() => globalThis.scrollY);
  353 |   await patch(request, { expiredSubject: true });
  354 |   await page.evaluate(() => globalThis.window.dispatchEvent(new Event('online')));
  355 |   await expect(card(page, 'Математика').getByText('Истёк', { exact: true })).toBeVisible();
  356 |   await expect(focus).toBeFocused();
  357 |   await expect(page.locator('.k8k-subject-card h2')).toHaveText(['Английский язык', 'Математика']);
  358 |   expect(await page.evaluate(() => globalThis.scrollY)).toBe(scroll);
  359 |   const previousCalls = (await state(request)).calls.length;
  360 |   await page.goto('/student/help');
  361 |   await expect(page.getByText(/Контакты пока не указаны/)).toBeVisible();
  362 |   await expect(page.locator('main a[href^="https:"], main a[href^="tel:"]')).toHaveCount(0);
  363 |   const helpReads = (await state(request)).calls.slice(previousCalls).map(({ path }) => path);
  364 |   expect(helpReads).toContain('/api/v1/student/me');
  365 |   expect(helpReads.some((path) => /\/(subjects|dashboard)$/.test(path))).toBe(false);
  366 | });
  367 | 
  368 | for (const [guard, flags, destination] of [
  369 |   ['401', { auth: false }, /\/student\/login$/],
  370 |   ['402', { meSuspended: true }, /\/student\/suspended$/],
  371 |   ['403', { meForbidden: true }, null],
  372 |   ['first password', { mustChangePassword: true }, /\/student\/security\/change-password$/],
  373 | ]) {
  374 |   test('subject-hub protected entrypoints ' + guard, async ({ request, context, page }) => {
  375 |     await start({ request, context, page }, 'ru', flags);
  376 |     for (const route of [hub, '/student/help']) {
  377 |       await page.goto(route + '?ui.k8k=1');
  378 |       if (destination) await expect(page).toHaveURL(destination);
  379 |       else await expect(page.locator('main [data-state=forbidden]')).toBeVisible();
  380 |       await expect(page.locator('.k8k-subject-card')).toHaveCount(0);
  381 |       await expect(page.getByRole('heading', { name: 'Помощь', exact: true })).toHaveCount(0);
  382 |     }
  383 |     expect(
  384 |       (await state(request)).calls.some((call) => call.path.endsWith('/student/subjects')),
  385 |     ).toBe(false);
  386 |   });
  387 | }
  388 | 
  389 | test('subject-hub legacy notifications still opens the K8K bell', async ({
  390 |   request,
  391 |   context,
  392 |   page,
  393 | }) => {
  394 |   await start({ request, context, page }, 'ru');
  395 |   await page.goto('/student/notifications?ui.k8k=1');
> 396 |   await expect(page).toHaveURL(/\/student\?events=1$/);
      |                      ^ Error: expect(page).toHaveURL(expected) failed
  397 |   const bell = page.locator('.k8k-notification-menu');
  398 |   await expect(bell).toHaveAttribute('open', '');
  399 |   await expect(bell.getByText('Преподаватель проверил работу')).toBeVisible();
  400 |   await page.keyboard.press('Escape');
  401 |   await expect(bell.locator('summary')).toBeFocused();
  402 |   await expect(bell).not.toHaveAttribute('open');
  403 | });
  404 | 
  405 | test('subject-hub main action opens the lesson while Meet eligibility is false', async ({
  406 |   request,
  407 |   context,
  408 |   page,
  409 | }) => {
  410 |   await start({ request, context, page }, 'ro', { canJoin: false });
  411 |   await page.goto('/student?ui.k8k=1');
  412 |   const hero = page.locator('.k8k-lesson-hero');
  413 |   await expect(hero.locator('a[href*="meet.google.com"]')).toHaveCount(0);
  414 |   const action = hero.getByRole('link', { name: 'Deschide lecția' });
  415 |   await expect(action).toHaveClass('k8k-main-action');
  416 |   expect((await action.boundingBox()).height).toBeGreaterThanOrEqual(48);
  417 |   await action.click();
  418 |   await expect(page).toHaveURL(/\/student\/lessons\/[0-9a-f-]+$/);
  419 | });
  420 | 
```
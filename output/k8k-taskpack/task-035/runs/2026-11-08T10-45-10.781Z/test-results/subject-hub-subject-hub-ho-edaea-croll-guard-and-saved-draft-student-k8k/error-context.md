# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: subject-hub.spec.mjs >> subject-hub homework context, scroll, guard and saved draft
- Location: tests\subject-hub.spec.mjs:283:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('dialog', { name: 'Черновик ещё не сохранён' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('dialog', { name: 'Черновик ещё не сохранён' }) with timeout 5000ms
  - waiting for getByRole('dialog', { name: 'Черновик ещё не сохранён' })

```

```yaml
- link "Перейти к содержимому":
  - /url: "#main-content"
- banner:
  - button "Все разделы"
  - 'button "Уведомления, непрочитанных: 2"'
  - group: Синтетическое имя ДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамил Ученик
- main:
  - link "← Все задания":
    - /url: /student/homework?fromSubjectId=60000000-0000-4000-8000-000000000001
  - link "К предмету":
    - /url: /student/subjects?subjectId=60000000-0000-4000-8000-000000000001
  - heading "Present Perfect. Рассказ о путешествии" [level=1]
  - button "Обновить задание"
  - heading "Английский язык" [level=2]
  - paragraph:
    - text: Получено в
    - time: 8 ноября в 12:47
    - text: · Europe/Chisinau
  - text: На доработку
  - heading "Задание преподавателя" [level=2]
  - paragraph: Напиши короткий рассказ о своём путешествии. Используй Present Perfect.
  - paragraph: Елизавета К. · Сдать до 8 ноября в 12:46
  - group:
    - text: Твой ответ
    - textbox "Твой ответ": Синтетический черновик
    - paragraph: До 10 000 символов. Черновик сохраняется автоматически.
    - status: Черновик сохранён
    - button "Прикрепить файл"
    - paragraph: До 50 МБ на файл, до 20 файлов. Отправка доступна после завершения загрузки.
    - list
  - button "Сдать работу"
  - region "История версий":
    - heading "История версий" [level=2]
    - list:
      - listitem:
        - heading "Версия 1 26 октября в 14:00" [level=3]
        - paragraph: Первая версия
        - text: На доработку
        - paragraph: Проверь время глагола.
      - listitem:
        - heading "Версия 2 27 октября в 14:00" [level=3]
        - paragraph: Вторая версия
        - text: На доработку
        - paragraph: Добавь ещё один пример.
- navigation "Мобильная навигация":
  - link "Главная":
    - /url: /student
  - link "Уроки":
    - /url: /student/lessons
  - link "Задания":
    - /url: /student/homework
  - link "Предметы":
    - /url: /student/subjects
  - button "Ещё"
```

# Test source

```ts
  203 |   expect(readCalls).toEqual(
  204 |     expect.arrayContaining([
  205 |       expect.objectContaining({
  206 |         path: '/api/v1/student/materials',
  207 |         query: '?page=1&subjectId=' + mathId,
  208 |       }),
  209 |       expect.objectContaining({ path: '/api/v1/student/skills', query: '?subjectId=' + mathId }),
  210 |     ]),
  211 |   );
  212 |   expect(readCalls.some((call) => call.path.endsWith('/skills/snapshots'))).toBe(false);
  213 |   await page.getByRole('link', { name: 'К предмету' }).click();
  214 |   await page.getByRole('link', { name: 'Все предметы' }).click();
  215 |   await english.getByRole('link', { name: 'Открыть предмет' }).click();
  216 |   await english.getByRole('link', { name: 'Условия абонемента' }).click();
  217 |   await expect(page).toHaveURL(new RegExp('/subscription\\?subscriptionId=' + periodId));
  218 |   await expect(page.getByRole('heading', { name: 'Абонемент', exact: true })).toBeVisible();
  219 |   await page.getByRole('link', { name: 'К предмету' }).click();
  220 |   await expect(english).toBeVisible();
  221 |   // Exercise the rejected selector in the same running router with an own response already cached.
  222 |   await page.getByRole('link', { name: 'Все предметы' }).evaluate((_, url) => {
  223 |     // Supply a location change to the running router without reloading its query cache.
  224 |     globalThis.history.pushState({ ...globalThis.history.state, key: 'foreign-selection' }, '', url);
  225 |     globalThis.window.dispatchEvent(
  226 |       new globalThis.PopStateEvent('popstate', { state: globalThis.history.state }),
  227 |     );
  228 |   }, subjectUrl(foreignId));
  229 |   await expect(page.locator('.k8k-subject-page [data-state=forbidden]')).toBeVisible();
  230 |   await expect(page.locator('.k8k-subject-card')).toHaveCount(0);
  231 |   for (const route of ['/student/materials', '/student/skills', hub]) {
  232 |     await page.goto(route + '?subjectId=' + foreignId);
  233 |     await expect(page.locator('main [data-state=forbidden]')).toBeVisible();
  234 |   }
  235 |   await page.goto(subjectUrl(englishId) + '&subjectId=' + mathId);
  236 |   await expect(page.locator('main [data-state=forbidden]')).toBeVisible();
  237 |   await page.goto(subjectUrl('not-a-uuid'));
  238 |   await expect(page.locator('main [data-state=forbidden]')).toBeVisible();
  239 |   expect((await state(request)).calls.some((call) => call.query.includes(foreignId))).toBe(false);
  240 | });
  241 | 
  242 | test('subject-hub separates loading, empty, error, stale and revocation', async ({
  243 |   request,
  244 |   context,
  245 |   page,
  246 | }) => {
  247 |   await start({ request, context, page }, 'ro', {
  248 |     subjectHub: true,
  249 |     subjectDelay: 800,
  250 |     subjectEmpty: true,
  251 |   });
  252 |   const main = page.locator('main');
  253 |   await page.goto(hub + '?ui.k8k=1');
  254 |   await expect(main.locator('[data-state=loading]')).toBeVisible();
  255 |   await expect(main.locator('[data-state=empty]')).toHaveCount(0);
  256 |   await screenshot(page, 'states/ro-loading.png');
  257 |   await expect(main.locator('[data-state=empty]')).toContainText('Încă nu ai materii atribuite.');
  258 |   await screenshot(page, 'states/ro-empty.png');
  259 |   await patch(request, { subjectDelay: 0, subjectEmpty: false, subjectError: 503 });
  260 |   await page.reload();
  261 |   await expect(main.locator('[data-state=error]')).toBeVisible();
  262 |   await expect(main.locator('.k8k-subject-card')).toHaveCount(0);
  263 |   await screenshot(page, 'states/ro-error.png');
  264 |   await patch(request, { subjectError: 0 });
  265 |   await page.getByRole('button', { name: 'Reîncearcă încărcarea' }).click();
  266 |   const names = page.locator('.k8k-subject-card h2');
  267 |   await expect(names).toHaveText(['Английский язык', 'Математика']);
  268 |   const link = card(page, 'Математика').getByRole('link', { name: 'Deschide materia' });
  269 |   await link.focus();
  270 |   await patch(request, { subjectError: 503 });
  271 |   await page.evaluate(() => globalThis.window.dispatchEvent(new Event('online')));
  272 |   await expect(main.locator('[data-state=stale]')).toBeVisible();
  273 |   await expect(link).toBeFocused();
  274 |   await expect(names).toHaveText(['Английский язык', 'Математика']);
  275 |   await screenshot(page, 'states/ro-stale.png');
  276 |   await patch(request, { subjectError: 403 });
  277 |   await main.getByRole('button', { name: 'Reîncearcă încărcarea' }).click();
  278 |   await expect(main.locator('[data-state=forbidden]')).toBeVisible();
  279 |   await expect(names).toHaveCount(0);
  280 |   await screenshot(page, 'states/ro-forbidden.png');
  281 | });
  282 | 
  283 | test('subject-hub homework context, scroll, guard and saved draft', async ({
  284 |   request,
  285 |   context,
  286 |   page,
  287 | }) => {
  288 |   await start({ request, context, page }, 'ru', { subjectHub: true, draftDelay: 800 });
  289 |   await page.setViewportSize({ width: 360, height: 620 });
  290 |   await page.goto(subjectUrl(englishId) + '&ui.k8k=1');
  291 |   const action = page.getByRole('link', { name: 'Все задания', exact: true });
  292 |   await action.scrollIntoViewIfNeeded();
  293 |   await page.evaluate(() => globalThis.window.scrollBy(0, 170));
  294 |   const position = await page.evaluate(() => globalThis.scrollY);
  295 |   expect(position).toBeGreaterThan(0);
  296 |   await action.click();
  297 |   await expect(page).toHaveURL(new RegExp('/homework\\?fromSubjectId=' + englishId));
  298 |   await page.getByRole('link', { name: /Present Perfect/ }).click();
  299 |   const editor = page.getByLabel('Твой ответ');
  300 |   await editor.fill('Синтетический черновик');
  301 |   await page.getByRole('link', { name: 'К предмету' }).click();
  302 |   const dialog = page.getByRole('dialog', { name: 'Черновик ещё не сохранён' });
> 303 |   await expect(dialog).toBeVisible();
      |                        ^ Error: expect(locator).toBeVisible() failed
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
  396 |   await expect(page).toHaveURL(/\/student\?events=1$/);
  397 |   const bell = page.locator('.k8k-notification-menu');
  398 |   await expect(bell).toHaveAttribute('open', '');
  399 |   await expect(bell.getByText('Преподаватель проверил работу')).toBeVisible();
  400 |   await page.keyboard.press('Escape');
  401 |   await expect(bell.locator('summary')).toBeFocused();
  402 |   await expect(bell).not.toHaveAttribute('open');
  403 | });
```
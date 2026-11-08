# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: subject-hub.spec.mjs >> subject-hub homework context, scroll, guard and saved draft
- Location: tests\subject-hub.spec.mjs:288:1

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
- alertdialog "Черновик ещё не сохранён":
  - heading "Черновик ещё не сохранён" [level=2]
  - paragraph: Дождитесь сохранения или вернитесь к заданию. Выбранные файлы и неопределённая отправка также требуют внимания.
  - contentinfo:
    - button "Остаться"
    - button "Уйти без сохранения"
```

# Test source

```ts
  214 |   expect(snapshotReads.every(call => new URLSearchParams(call.query).get('subjectId') === mathId)).toBe(true);
  215 |   await page.getByRole('link', { name: 'К предмету' }).click();
  216 |   await page.getByRole('link', { name: 'Все предметы' }).click();
  217 |   await english.getByRole('link', { name: 'Открыть предмет' }).click();
  218 |   await english.getByRole('link', { name: 'Условия абонемента' }).click();
  219 |   await expect(page).toHaveURL(new RegExp('/subscription\\?subscriptionId=' + periodId));
  220 |   await expect(page.getByRole('heading', { name: 'Абонемент', exact: true })).toBeVisible();
  221 |   await page.getByRole('link', { name: 'К предмету' }).click();
  222 |   await expect(english).toBeVisible();
  223 |   // Exercise the rejected selector in the same running router with an own response already cached.
  224 |   await page.getByRole('link', { name: 'Все предметы' }).evaluate((_, url) => {
  225 |     // Supply a location change to the running router without reloading its query cache.
  226 |     globalThis.history.pushState({ ...globalThis.history.state, key: 'foreign-selection' }, '', url);
  227 |     globalThis.window.dispatchEvent(
  228 |       new globalThis.PopStateEvent('popstate', { state: globalThis.history.state }),
  229 |     );
  230 |   }, subjectUrl(foreignId));
  231 |   await expect(page.locator('.k8k-subject-page [data-state=forbidden]')).toBeVisible();
  232 |   await expect(page.locator('.k8k-subject-card')).toHaveCount(0);
  233 |   for (const route of ['/student/materials', '/student/skills', hub]) {
  234 |     await page.goto(route + '?subjectId=' + foreignId);
  235 |     await expect(page.locator('main [data-state=forbidden]')).toBeVisible();
  236 |   }
  237 |   await page.goto(subjectUrl(englishId) + '&subjectId=' + mathId);
  238 |   await expect(page.locator('main [data-state=forbidden]')).toBeVisible();
  239 |   await page.goto(subjectUrl('not-a-uuid'));
  240 |   await expect(page.locator('main [data-state=forbidden]')).toBeVisible();
  241 |   const foreignReads = (await state(request)).calls.filter(call => call.query.includes(foreignId));
  242 |   expect(foreignReads.length).toBeGreaterThan(0);
  243 |   expect(foreignReads.every(call => call.method === 'GET' && ['/api/v1/student/skills','/api/v1/student/skills/snapshots'].includes(call.path))).toBe(true);
  244 |   expect((await state(request)).calls.some(call => call.query.includes('not-a-uuid'))).toBe(false);
  245 | });
  246 | 
  247 | test('subject-hub separates loading, empty, error, stale and revocation', async ({
  248 |   request,
  249 |   context,
  250 |   page,
  251 | }) => {
  252 |   await start({ request, context, page }, 'ro', {
  253 |     subjectHub: true,
  254 |     subjectDelay: 800,
  255 |     subjectEmpty: true,
  256 |   });
  257 |   const main = page.locator('main');
  258 |   await page.goto(hub + '?ui.k8k=1');
  259 |   await expect(main.locator('[data-state=loading]')).toBeVisible();
  260 |   await expect(main.locator('[data-state=empty]')).toHaveCount(0);
  261 |   await screenshot(page, 'states/ro-loading.png');
  262 |   await expect(main.locator('[data-state=empty]')).toContainText('Încă nu ai materii atribuite.');
  263 |   await screenshot(page, 'states/ro-empty.png');
  264 |   await patch(request, { subjectDelay: 0, subjectEmpty: false, subjectError: 503 });
  265 |   await page.reload();
  266 |   await expect(main.locator('[data-state=error]')).toBeVisible();
  267 |   await expect(main.locator('.k8k-subject-card')).toHaveCount(0);
  268 |   await screenshot(page, 'states/ro-error.png');
  269 |   await patch(request, { subjectError: 0 });
  270 |   await page.getByRole('button', { name: 'Reîncearcă încărcarea' }).click();
  271 |   const names = page.locator('.k8k-subject-card h2');
  272 |   await expect(names).toHaveText(['Английский язык', 'Математика']);
  273 |   const link = card(page, 'Математика').getByRole('link', { name: 'Deschide materia' });
  274 |   await link.focus();
  275 |   await patch(request, { subjectError: 503 });
  276 |   await page.evaluate(() => globalThis.window.dispatchEvent(new Event('online')));
  277 |   await expect(main.locator('[data-state=stale]')).toBeVisible();
  278 |   await expect(link).toBeFocused();
  279 |   await expect(names).toHaveText(['Английский язык', 'Математика']);
  280 |   await screenshot(page, 'states/ro-stale.png');
  281 |   await patch(request, { subjectError: 403 });
  282 |   await main.getByRole('button', { name: 'Reîncearcă încărcarea' }).click();
  283 |   await expect(main.locator('[data-state=forbidden]')).toBeVisible();
  284 |   await expect(names).toHaveCount(0);
  285 |   await screenshot(page, 'states/ro-forbidden.png');
  286 | });
  287 | 
  288 | test('subject-hub homework context, scroll, guard and saved draft', async ({
  289 |   request,
  290 |   context,
  291 |   page,
  292 | }) => {
  293 |   await start({ request, context, page }, 'ru', { subjectHub: true, draftDelay: 800 });
  294 |   await page.setViewportSize({ width: 360, height: 620 });
  295 |   await page.goto(subjectUrl(englishId) + '&ui.k8k=1');
  296 |   const action = page.getByRole('link', { name: 'Все задания', exact: true });
  297 |   await action.scrollIntoViewIfNeeded();
  298 |   await page.evaluate(() => globalThis.window.scrollBy(0, 170));
  299 |   const position = await page.evaluate(() => globalThis.scrollY);
  300 |   expect(position).toBeGreaterThan(0);
  301 |   await action.click();
  302 |   await expect(page).toHaveURL(new RegExp('/homework\\?fromSubjectId=' + englishId));
  303 |   await page.getByRole('link', { name: /Present Perfect/ }).click();
  304 |   const editor = page.getByLabel('Твой ответ');
  305 |   await expect(editor).toBeVisible();
  306 |   let releaseDraft;
  307 |   await page.route('**/api/v1/student/homework/*/draft', async route => {
  308 |     await new Promise(resolve => { releaseDraft = resolve; });
  309 |     await route.continue();
  310 |   });
  311 |   await editor.fill('Синтетический черновик');
  312 |   await page.getByRole('link', { name: 'К предмету' }).click();
  313 |   const dialog = page.getByRole('dialog', { name: 'Черновик ещё не сохранён' });
> 314 |   await expect(dialog).toBeVisible();
      |                        ^ Error: expect(locator).toBeVisible() failed
  315 |   await expect(dialog.getByRole('button', { name: 'Остаться' })).toBeInViewport();
  316 |   await page.keyboard.press('Escape');
  317 |   await expect(dialog).toHaveCount(0);
  318 |   await expect(editor).toBeFocused();
  319 |   await expect(editor).toHaveValue('Синтетический черновик');
  320 |   await expect.poll(() => typeof releaseDraft).toBe('function');
  321 |   releaseDraft();
  322 |   await page.unroute('**/api/v1/student/homework/*/draft');
  323 |   await expect.poll(async () => (await state(request)).draft).toBe('Синтетический черновик');
  324 |   await expect(page.getByText('Черновик сохранён', { exact: true })).toBeVisible();
  325 |   await page.goBack();
  326 |   await page.goBack();
  327 |   await expect(page).toHaveURL(new RegExp('subjectId=' + englishId));
  328 |   await expect.poll(() => page.evaluate(() => globalThis.scrollY)).toBe(position);
  329 |   await action.click();
  330 |   await page.getByRole('link', { name: /Present Perfect/ }).click();
  331 |   await expect(editor).toHaveValue('Синтетический черновик');
  332 |   await page.getByRole('link', { name: 'К предмету' }).click();
  333 |   await expect(page).toHaveURL(new RegExp('/subjects\\?subjectId=' + englishId + '$'));
  334 |   await expect.poll(() => page.evaluate(() => globalThis.scrollY)).toBe(position);
  335 |   expect(
  336 |     (await state(request)).calls
  337 |       .filter((call) => call.path.endsWith('/student/homework'))
  338 |       .every((call) => !/subjectId/i.test(call.query)),
  339 |   ).toBe(true);
  340 | });
  341 | 
  342 | test('subject-hub keyboard, focus on refresh, and safe absent contacts', async ({
  343 |   request,
  344 |   context,
  345 |   page,
  346 | }) => {
  347 |   await start({ request, context, page }, 'ru', {
  348 |     subjectHub: true,
  349 |     managerContacts: { whatsapp: null, telegram: null },
  350 |   });
  351 |   await page.setViewportSize({ width: 360, height: 720 });
  352 |   await page.goto(hub + '?ui.k8k=1');
  353 |   const skip = page.getByRole('link', { name: 'Перейти к содержимому' });
  354 |   await skip.focus();
  355 |   await page.keyboard.press('Enter');
  356 |   await expect(page.locator('#main-content')).toBeFocused();
  357 |   const trigger = page.locator('.k8k-bottom-nav button');
  358 |   await trigger.focus();
  359 |   await page.keyboard.press('Enter');
  360 |   await expect(page.locator('.k8k-mobile-menu nav a').first()).toBeFocused();
  361 |   await page.keyboard.press('Escape');
  362 |   await expect(trigger).toBeFocused();
  363 |   const focus = card(page, 'Математика').getByRole('link', { name: 'Открыть предмет' });
  364 |   await focus.focus();
  365 |   await page.evaluate(() => globalThis.window.scrollBy(0, 30));
  366 |   const scroll = await page.evaluate(() => globalThis.scrollY);
  367 |   await patch(request, { expiredSubject: true });
  368 |   await page.evaluate(() => globalThis.window.dispatchEvent(new Event('online')));
  369 |   await expect(card(page, 'Математика').getByText('Истёк', { exact: true })).toBeVisible();
  370 |   await expect(focus).toBeFocused();
  371 |   await expect(page.locator('.k8k-subject-card h2')).toHaveText(['Английский язык', 'Математика']);
  372 |   expect(await page.evaluate(() => globalThis.scrollY)).toBe(scroll);
  373 |   const previousCalls = (await state(request)).calls.length;
  374 |   await page.goto('/student/help');
  375 |   await expect(page.getByText(/Контакты пока не указаны/)).toBeVisible();
  376 |   await expect(page.locator('main a[href^="https:"], main a[href^="tel:"]')).toHaveCount(0);
  377 |   const helpReads = (await state(request)).calls.slice(previousCalls).map(({ path }) => path);
  378 |   expect(helpReads).toContain('/api/v1/student/me');
  379 |   expect(helpReads.some((path) => /\/(subjects|dashboard)$/.test(path))).toBe(false);
  380 | });
  381 | 
  382 | for (const [guard, flags, destination] of [
  383 |   ['401', { auth: false }, /\/student\/login$/],
  384 |   ['402', { meSuspended: true }, /\/student\/suspended$/],
  385 |   ['403', { meForbidden: true }, null],
  386 |   ['first password', { mustChangePassword: true }, /\/student\/security\/change-password$/],
  387 | ]) {
  388 |   test('subject-hub protected entrypoints ' + guard, async ({ request, context, page }) => {
  389 |     await start({ request, context, page }, 'ru', flags);
  390 |     for (const route of [hub, '/student/help']) {
  391 |       await page.goto(route + '?ui.k8k=1');
  392 |       if (destination) await expect(page).toHaveURL(destination);
  393 |       else await expect(page.locator('main [data-state=forbidden]')).toBeVisible();
  394 |       await expect(page.locator('.k8k-subject-card')).toHaveCount(0);
  395 |       await expect(page.getByRole('heading', { name: 'Помощь', exact: true })).toHaveCount(0);
  396 |     }
  397 |     expect(
  398 |       (await state(request)).calls.some((call) => call.path.endsWith('/student/subjects')),
  399 |     ).toBe(false);
  400 |   });
  401 | }
  402 | 
  403 | test('subject-hub legacy notifications still opens the K8K bell', async ({
  404 |   request,
  405 |   context,
  406 |   page,
  407 | }) => {
  408 |   await start({ request, context, page }, 'ru');
  409 |   await page.goto('/student/notifications?ui.k8k=1');
  410 |   await expect.poll(() => new URL(page.url()).pathname).toBe('/student');
  411 |   expect(new URL(page.url()).searchParams.get('events')).toBe('1');
  412 |   expect(new URL(page.url()).searchParams.get('ui.k8k')).toBe('1');
  413 |   const bell = page.locator('.k8k-notification-drawer');
  414 |   await expect(bell).toBeVisible();
```
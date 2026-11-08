# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: subject-hub.spec.mjs >> subject-hub homework context, scroll, guard and saved draft
- Location: tests\subject-hub.spec.mjs:285:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByLabel('Твой ответ')

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - link "Перейти к содержимому" [ref=e5] [cursor=pointer]:
    - /url: "#main-content"
  - generic [ref=e6]:
    - banner [ref=e7]:
      - button "Все разделы" [ref=e8] [cursor=pointer]
      - generic [ref=e11]:
        - 'button "Уведомления, непрочитанных: 2" [ref=e12] [cursor=pointer]':
          - generic [aria-hidden] [ref=e16]: "2"
        - group [ref=e17]:
          - generic "Синтетическое имя ДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамил Ученик" [ref=e18] [cursor=pointer]:
            - generic [aria-hidden] [ref=e19]: С
            - generic [ref=e20]:
              - text: Синтетическое имя ДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамил
              - generic [ref=e21]: Ученик
            - generic [aria-hidden] [ref=e22]: ⌄
          - option "Русский" [selected]
          - option "Română"
    - main [active] [ref=e24]:
      - link "← Все задания" [ref=e25] [cursor=pointer]:
        - /url: /student/homework?fromSubjectId=60000000-0000-4000-8000-000000000001
      - link "К предмету" [ref=e26] [cursor=pointer]:
        - /url: /student/subjects?subjectId=60000000-0000-4000-8000-000000000001
      - heading "Домашнее задание" [level=1] [ref=e27]
      - button "Обновить задание" [disabled] [ref=e28]
      - generic [ref=e32]:
        - heading "Твоё задание" [level=2] [ref=e34]
        - status [ref=e37]: Загружаем данные…
  - navigation "Мобильная навигация" [ref=e45]:
    - link "Главная" [ref=e47] [cursor=pointer]:
      - /url: /student
    - link "Уроки" [ref=e53] [cursor=pointer]:
      - /url: /student/lessons
    - link "Задания" [ref=e58] [cursor=pointer]:
      - /url: /student/homework
    - link "Предметы" [ref=e65] [cursor=pointer]:
      - /url: /student/subjects
    - button "Ещё" [ref=e69] [cursor=pointer]
```

# Test source

```ts
  204 |     expect.arrayContaining([
  205 |       expect.objectContaining({
  206 |         path: '/api/v1/student/materials',
  207 |         query: '?page=1&subjectId=' + mathId,
  208 |       }),
  209 |       expect.objectContaining({ path: '/api/v1/student/skills', query: '?subjectId=' + mathId }),
  210 |     ]),
  211 |   );
  212 |   const snapshotReads = readCalls.filter(call => call.path.endsWith('/skills/snapshots'));
  213 |   expect(snapshotReads.length).toBeGreaterThan(0);
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
  241 |   expect((await state(request)).calls.some((call) => call.query.includes(foreignId))).toBe(false);
  242 | });
  243 | 
  244 | test('subject-hub separates loading, empty, error, stale and revocation', async ({
  245 |   request,
  246 |   context,
  247 |   page,
  248 | }) => {
  249 |   await start({ request, context, page }, 'ro', {
  250 |     subjectHub: true,
  251 |     subjectDelay: 800,
  252 |     subjectEmpty: true,
  253 |   });
  254 |   const main = page.locator('main');
  255 |   await page.goto(hub + '?ui.k8k=1');
  256 |   await expect(main.locator('[data-state=loading]')).toBeVisible();
  257 |   await expect(main.locator('[data-state=empty]')).toHaveCount(0);
  258 |   await screenshot(page, 'states/ro-loading.png');
  259 |   await expect(main.locator('[data-state=empty]')).toContainText('Încă nu ai materii atribuite.');
  260 |   await screenshot(page, 'states/ro-empty.png');
  261 |   await patch(request, { subjectDelay: 0, subjectEmpty: false, subjectError: 503 });
  262 |   await page.reload();
  263 |   await expect(main.locator('[data-state=error]')).toBeVisible();
  264 |   await expect(main.locator('.k8k-subject-card')).toHaveCount(0);
  265 |   await screenshot(page, 'states/ro-error.png');
  266 |   await patch(request, { subjectError: 0 });
  267 |   await page.getByRole('button', { name: 'Reîncearcă încărcarea' }).click();
  268 |   const names = page.locator('.k8k-subject-card h2');
  269 |   await expect(names).toHaveText(['Английский язык', 'Математика']);
  270 |   const link = card(page, 'Математика').getByRole('link', { name: 'Deschide materia' });
  271 |   await link.focus();
  272 |   await patch(request, { subjectError: 503 });
  273 |   await page.evaluate(() => globalThis.window.dispatchEvent(new Event('online')));
  274 |   await expect(main.locator('[data-state=stale]')).toBeVisible();
  275 |   await expect(link).toBeFocused();
  276 |   await expect(names).toHaveText(['Английский язык', 'Математика']);
  277 |   await screenshot(page, 'states/ro-stale.png');
  278 |   await patch(request, { subjectError: 403 });
  279 |   await main.getByRole('button', { name: 'Reîncearcă încărcarea' }).click();
  280 |   await expect(main.locator('[data-state=forbidden]')).toBeVisible();
  281 |   await expect(names).toHaveCount(0);
  282 |   await screenshot(page, 'states/ro-forbidden.png');
  283 | });
  284 | 
  285 | test('subject-hub homework context, scroll, guard and saved draft', async ({
  286 |   request,
  287 |   context,
  288 |   page,
  289 | }) => {
  290 |   await start({ request, context, page }, 'ru', { subjectHub: true, draftDelay: 800 });
  291 |   await page.setViewportSize({ width: 360, height: 620 });
  292 |   await page.goto(subjectUrl(englishId) + '&ui.k8k=1');
  293 |   const action = page.getByRole('link', { name: 'Все задания', exact: true });
  294 |   await action.scrollIntoViewIfNeeded();
  295 |   await page.evaluate(() => globalThis.window.scrollBy(0, 170));
  296 |   const position = await page.evaluate(() => globalThis.scrollY);
  297 |   expect(position).toBeGreaterThan(0);
  298 |   await action.click();
  299 |   await expect(page).toHaveURL(new RegExp('/homework\\?fromSubjectId=' + englishId));
  300 |   await page.getByRole('link', { name: /Present Perfect/ }).click();
  301 |   const editor = page.getByLabel('Твой ответ');
  302 |   await page.clock.install();
  303 |   await page.clock.pauseAt(new Date(Date.now() + 1000));
> 304 |   await editor.fill('Синтетический черновик');
      |                ^ Error: locator.fill: Test timeout of 30000ms exceeded.
  305 |   await page.getByRole('link', { name: 'К предмету' }).click();
  306 |   const dialog = page.getByRole('dialog', { name: 'Черновик ещё не сохранён' });
  307 |   await expect(dialog).toBeVisible();
  308 |   await expect(dialog.getByRole('button', { name: 'Остаться' })).toBeInViewport();
  309 |   await page.keyboard.press('Escape');
  310 |   await expect(dialog).toHaveCount(0);
  311 |   await expect(editor).toBeFocused();
  312 |   await expect(editor).toHaveValue('Синтетический черновик');
  313 |   await page.clock.runFor(2100);
  314 |   await expect.poll(async () => (await state(request)).draft).toBe('Синтетический черновик');
  315 |   await expect(page.getByText('Черновик сохранён', { exact: true })).toBeVisible();
  316 |   await page.goBack();
  317 |   await page.goBack();
  318 |   await expect(page).toHaveURL(new RegExp('subjectId=' + englishId));
  319 |   await expect.poll(() => page.evaluate(() => globalThis.scrollY)).toBe(position);
  320 |   await action.click();
  321 |   await page.getByRole('link', { name: /Present Perfect/ }).click();
  322 |   await expect(editor).toHaveValue('Синтетический черновик');
  323 |   await page.getByRole('link', { name: 'К предмету' }).click();
  324 |   await expect(page).toHaveURL(new RegExp('/subjects\\?subjectId=' + englishId + '$'));
  325 |   await expect.poll(() => page.evaluate(() => globalThis.scrollY)).toBe(position);
  326 |   expect(
  327 |     (await state(request)).calls
  328 |       .filter((call) => call.path.endsWith('/student/homework'))
  329 |       .every((call) => !/subjectId/i.test(call.query)),
  330 |   ).toBe(true);
  331 | });
  332 | 
  333 | test('subject-hub keyboard, focus on refresh, and safe absent contacts', async ({
  334 |   request,
  335 |   context,
  336 |   page,
  337 | }) => {
  338 |   await start({ request, context, page }, 'ru', {
  339 |     subjectHub: true,
  340 |     managerContacts: { whatsapp: null, telegram: null },
  341 |   });
  342 |   await page.setViewportSize({ width: 360, height: 720 });
  343 |   await page.goto(hub + '?ui.k8k=1');
  344 |   const skip = page.getByRole('link', { name: 'Перейти к содержимому' });
  345 |   await skip.focus();
  346 |   await page.keyboard.press('Enter');
  347 |   await expect(page.locator('#main-content')).toBeFocused();
  348 |   const trigger = page.locator('.k8k-bottom-nav button');
  349 |   await trigger.focus();
  350 |   await page.keyboard.press('Enter');
  351 |   await expect(page.locator('.k8k-mobile-menu nav a').first()).toBeFocused();
  352 |   await page.keyboard.press('Escape');
  353 |   await expect(trigger).toBeFocused();
  354 |   const focus = card(page, 'Математика').getByRole('link', { name: 'Открыть предмет' });
  355 |   await focus.focus();
  356 |   await page.evaluate(() => globalThis.window.scrollBy(0, 30));
  357 |   const scroll = await page.evaluate(() => globalThis.scrollY);
  358 |   await patch(request, { expiredSubject: true });
  359 |   await page.evaluate(() => globalThis.window.dispatchEvent(new Event('online')));
  360 |   await expect(card(page, 'Математика').getByText('Истёк', { exact: true })).toBeVisible();
  361 |   await expect(focus).toBeFocused();
  362 |   await expect(page.locator('.k8k-subject-card h2')).toHaveText(['Английский язык', 'Математика']);
  363 |   expect(await page.evaluate(() => globalThis.scrollY)).toBe(scroll);
  364 |   const previousCalls = (await state(request)).calls.length;
  365 |   await page.goto('/student/help');
  366 |   await expect(page.getByText(/Контакты пока не указаны/)).toBeVisible();
  367 |   await expect(page.locator('main a[href^="https:"], main a[href^="tel:"]')).toHaveCount(0);
  368 |   const helpReads = (await state(request)).calls.slice(previousCalls).map(({ path }) => path);
  369 |   expect(helpReads).toContain('/api/v1/student/me');
  370 |   expect(helpReads.some((path) => /\/(subjects|dashboard)$/.test(path))).toBe(false);
  371 | });
  372 | 
  373 | for (const [guard, flags, destination] of [
  374 |   ['401', { auth: false }, /\/student\/login$/],
  375 |   ['402', { meSuspended: true }, /\/student\/suspended$/],
  376 |   ['403', { meForbidden: true }, null],
  377 |   ['first password', { mustChangePassword: true }, /\/student\/security\/change-password$/],
  378 | ]) {
  379 |   test('subject-hub protected entrypoints ' + guard, async ({ request, context, page }) => {
  380 |     await start({ request, context, page }, 'ru', flags);
  381 |     for (const route of [hub, '/student/help']) {
  382 |       await page.goto(route + '?ui.k8k=1');
  383 |       if (destination) await expect(page).toHaveURL(destination);
  384 |       else await expect(page.locator('main [data-state=forbidden]')).toBeVisible();
  385 |       await expect(page.locator('.k8k-subject-card')).toHaveCount(0);
  386 |       await expect(page.getByRole('heading', { name: 'Помощь', exact: true })).toHaveCount(0);
  387 |     }
  388 |     expect(
  389 |       (await state(request)).calls.some((call) => call.path.endsWith('/student/subjects')),
  390 |     ).toBe(false);
  391 |   });
  392 | }
  393 | 
  394 | test('subject-hub legacy notifications still opens the K8K bell', async ({
  395 |   request,
  396 |   context,
  397 |   page,
  398 | }) => {
  399 |   await start({ request, context, page }, 'ru');
  400 |   await page.goto('/student/notifications?ui.k8k=1');
  401 |   await expect.poll(() => new URL(page.url()).pathname).toBe('/student');
  402 |   expect(new URL(page.url()).searchParams.get('events')).toBe('1');
  403 |   expect(new URL(page.url()).searchParams.get('ui.k8k')).toBe('1');
  404 |   const bell = page.locator('.k8k-notification-drawer');
```
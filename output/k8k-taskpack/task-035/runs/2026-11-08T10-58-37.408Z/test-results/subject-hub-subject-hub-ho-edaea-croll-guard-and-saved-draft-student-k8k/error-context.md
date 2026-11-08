# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: subject-hub.spec.mjs >> subject-hub homework context, scroll, guard and saved draft
- Location: tests\subject-hub.spec.mjs:288:1

# Error details

```
Error: route.continue: Route is already handled!
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
    - main [ref=e24]:
      - link "← Все задания" [ref=e25] [cursor=pointer]:
        - /url: /student/homework?fromSubjectId=60000000-0000-4000-8000-000000000001
      - link "К предмету" [ref=e26] [cursor=pointer]:
        - /url: /student/subjects?subjectId=60000000-0000-4000-8000-000000000001
      - heading "Present Perfect. Рассказ о путешествии" [level=1] [ref=e27]
      - button "Обновить задание" [ref=e28] [cursor=pointer]
      - generic [ref=e29]:
        - heading "Английский язык" [level=2] [ref=e31]
        - generic [ref=e32]:
          - paragraph [ref=e34]:
            - generic [ref=e35]:
              - text: Получено в
              - time [ref=e36]: 8 ноября в 12:58
            - text: · Europe/Chisinau
          - generic [ref=e38]:
            - generic [ref=e39]: На доработку
            - generic [ref=e43]:
              - heading "Задание преподавателя" [level=2] [ref=e44]
              - paragraph [ref=e45]: Напиши короткий рассказ о своём путешествии. Используй Present Perfect.
              - paragraph [ref=e46]: Елизавета К. · Сдать до 8 ноября в 12:57
            - generic [ref=e47]:
              - group [ref=e48]:
                - generic [ref=e49]:
                  - generic [ref=e50]: Твой ответ
                  - textbox "Твой ответ" [active] [ref=e51]: Синтетический черновик
                - paragraph [ref=e52]: До 10 000 символов. Черновик сохраняется автоматически.
                - status [ref=e53]: Сохраняем черновик…
                - button "Прикрепить файл" [ref=e55] [cursor=pointer]
                - paragraph [ref=e56]: До 50 МБ на файл, до 20 файлов. Отправка доступна после завершения загрузки.
                - list
              - button "Сдать работу" [ref=e57] [cursor=pointer]
            - region "История версий" [ref=e58]:
              - heading "История версий" [level=2] [ref=e59]
              - list [ref=e60]:
                - listitem [ref=e61]:
                  - heading "Версия 1 26 октября в 14:00" [level=3] [ref=e62]:
                    - text: Версия 1
                    - generic [ref=e63]: 26 октября в 14:00
                  - paragraph [ref=e64]: Первая версия
                  - generic [ref=e65]: На доработку
                  - paragraph [ref=e68]: Проверь время глагола.
                - listitem [ref=e69]:
                  - heading "Версия 2 27 октября в 14:00" [level=3] [ref=e70]:
                    - text: Версия 2
                    - generic [ref=e71]: 27 октября в 14:00
                  - paragraph [ref=e72]: Вторая версия
                  - generic [ref=e73]: На доработку
                  - paragraph [ref=e76]: Добавь ещё один пример.
  - navigation "Мобильная навигация" [ref=e77]:
    - link "Главная" [ref=e79] [cursor=pointer]:
      - /url: /student
    - link "Уроки" [ref=e85] [cursor=pointer]:
      - /url: /student/lessons
    - link "Задания" [ref=e90] [cursor=pointer]:
      - /url: /student/homework
    - link "Предметы" [ref=e97] [cursor=pointer]:
      - /url: /student/subjects
    - button "Ещё" [ref=e101] [cursor=pointer]
```

# Test source

```ts
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
> 309 |     await route.continue();
      |                         ^ Error: route.continue: Route is already handled!
  310 |   });
  311 |   await editor.fill('Синтетический черновик');
  312 |   await page.getByRole('link', { name: 'К предмету' }).click();
  313 |   const dialog = page.getByRole('alertdialog', { name: 'Черновик ещё не сохранён' });
  314 |   await expect(dialog).toBeVisible();
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
```
# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: subject-hub.spec.mjs >> subject-hub independent permissions and scoped reads reject foreign or repeated selectors
- Location: tests\subject-hub.spec.mjs:173:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: false
Received: true
```

# Page snapshot

```yaml
- generic [ref=f5e4]:
  - link "Перейти к содержимому" [ref=f5e5] [cursor=pointer]:
    - /url: "#main-content"
  - complementary [ref=f5e6]:
    - generic [ref=f5e10]:
      - text: K8K Academy
      - generic [ref=f5e11]: Кабинет ученика
    - navigation "Основная навигация" [ref=f5e12]:
      - link "Главная" [ref=f5e14] [cursor=pointer]:
        - /url: /student
      - link "Расписание" [ref=f5e20] [cursor=pointer]:
        - /url: /student/lessons
      - link "Задания" [ref=f5e25] [cursor=pointer]:
        - /url: /student/homework
      - link "Мои предметы" [ref=f5e32] [cursor=pointer]:
        - /url: /student/subjects
      - link "Мой путь знаний" [ref=f5e37] [cursor=pointer]:
        - /url: /student/skills
      - link "Помощь" [ref=f5e41] [cursor=pointer]:
        - /url: /student/help
  - generic [ref=f5e46]:
    - banner [ref=f5e47]:
      - generic [ref=f5e48]: Кабинет ученика
      - generic [ref=f5e49]:
        - 'button "Уведомления, непрочитанных: 2" [ref=f5e50] [cursor=pointer]':
          - generic [aria-hidden] [ref=f5e54]: "2"
        - group [ref=f5e55]:
          - generic "Синтетическое имя ДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамил Ученик" [ref=f5e56] [cursor=pointer]:
            - generic [aria-hidden] [ref=f5e57]: С
            - generic [ref=f5e58]:
              - text: Синтетическое имя ДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамил
              - generic [ref=f5e59]: Ученик
            - generic [aria-hidden] [ref=f5e60]: ⌄
          - option "Русский" [selected]
          - option "Română"
    - main [ref=f5e62]:
      - generic [ref=f5e63]:
        - heading "Мои предметы" [level=1] [ref=f5e64]
        - generic [ref=f5e65]:
          - paragraph [ref=f5e67]:
            - generic [ref=f5e68]:
              - text: Данные сервера на
              - time [ref=f5e69]: 8 ноября в 12:54
            - text: ·
            - generic [ref=f5e70]:
              - text: Получено в
              - time [ref=f5e71]: 8 ноября в 12:54
            - text: · Europe/Chisinau
          - generic [ref=f5e72]:
            - alert [ref=f5e75]: Нет доступа к этому разделу.
            - link "Все предметы" [ref=f5e78] [cursor=pointer]:
              - /url: /student/subjects
```

# Test source

```ts
  141 |     async ({ request, context, page }) => {
  142 |       await start({ request, context, page }, 'ru', { subjectHub: true });
  143 |       await page.setViewportSize({ width, height: 900 });
  144 |       await page.goto('/student?ui.k8k=1');
  145 |       const mobile = width === 360;
  146 |       const nav = page.locator(mobile ? '.k8k-mobile-menu nav' : '.k8k-sidebar nav');
  147 |       const trigger = page.locator('.k8k-menu-button');
  148 |       await expect(nav.locator('a')).toHaveCount(paths.length);
  149 |       for (const path of paths) {
  150 |         if (mobile) await trigger.click();
  151 |         expect(
  152 |           await nav
  153 |             .locator('a')
  154 |             .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href'))),
  155 |         ).toEqual(paths);
  156 |         await nav.locator('a[href="' + path + '"]').click();
  157 |         await expect(page).toHaveURL('http://127.0.0.1:4175' + path);
  158 |         if (mobile) await trigger.click();
  159 |         await expect(nav.locator('[aria-current="page"]')).toHaveAttribute('href', path);
  160 |         if (mobile) await page.keyboard.press('Escape');
  161 |       }
  162 |       const account = page.locator('.account-menu');
  163 |       await account.locator('summary').click();
  164 |       await account.getByRole('link', { name: 'Профиль', exact: true }).click();
  165 |       await expect(page).toHaveURL(/\/student\/profile$/);
  166 |       await account.locator('summary').click();
  167 |       await account.getByRole('link', { name: 'Безопасность', exact: true }).click();
  168 |       await expect(page).toHaveURL(/\/student\/security$/);
  169 |     },
  170 |   );
  171 | }
  172 | 
  173 | test('subject-hub independent permissions and scoped reads reject foreign or repeated selectors', async ({
  174 |   request,
  175 |   context,
  176 |   page,
  177 | }) => {
  178 |   await start({ request, context, page }, 'ru', { subjectHub: true, expiredSubject: true });
  179 |   const subjectsResponse = page.waitForResponse('**/api/v1/student/subjects');
  180 |   await page.goto(hub + '?ui.k8k=1');
  181 |   expect((await subjectsResponse).headers()['cache-control']).toContain('no-store');
  182 |   const english = card(page, 'Английский язык');
  183 |   const math = card(page, 'Математика');
  184 |   await expect(english.getByText('Активен', { exact: true })).toBeVisible();
  185 |   await expect(english.getByRole('link', { name: 'Открыть расписание' })).toBeVisible();
  186 |   await expect(math.getByText('Истёк', { exact: true })).toBeVisible();
  187 |   await expect(math.getByRole('link', { name: 'Материалы' })).toBeVisible();
  188 |   await expect(math.locator('a[href*="/lessons"]')).toHaveCount(0);
  189 |   await math.getByRole('link', { name: 'Открыть предмет' }).click();
  190 |   await expect(page).toHaveURL(new RegExp('subjectId=' + mathId));
  191 |   await expect(page.locator('.k8k-subject-card')).toHaveCount(1);
  192 |   await expect(math.locator('a[href*="/homework"]')).toHaveCount(0);
  193 |   await math.getByRole('link', { name: 'Материалы' }).click();
  194 |   await expect(page.getByRole('heading', { name: 'Алгебра.pdf' })).toBeVisible();
  195 |   await expect(page.getByRole('heading', { name: /Словарь/ })).toHaveCount(0);
  196 |   await expect(page).toHaveURL(new RegExp('subjectId=' + mathId));
  197 |   await page.getByRole('link', { name: 'К предмету' }).click();
  198 |   await math.getByRole('link', { name: 'Мой путь знаний' }).click();
  199 |   await expect(page.getByRole('heading', { name: 'Математика' })).toBeVisible();
  200 |   await expect(page.getByRole('heading', { name: 'Английский язык' })).toHaveCount(0);
  201 |   await expect(page.getByRole('heading', { name: 'Срезы навыков после 4 уроков', exact: true })).toBeVisible();
  202 |   const readCalls = (await state(request)).calls;
  203 |   expect(readCalls).toEqual(
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
> 241 |   expect((await state(request)).calls.some((call) => call.query.includes(foreignId))).toBe(false);
      |                                                                                       ^ Error: expect(received).toBe(expected) // Object.is equality
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
  304 |   await editor.fill('Синтетический черновик');
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
```
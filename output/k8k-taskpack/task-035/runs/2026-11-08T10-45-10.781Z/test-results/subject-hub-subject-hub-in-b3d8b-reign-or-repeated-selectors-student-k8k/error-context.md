# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: subject-hub.spec.mjs >> subject-hub independent permissions and scoped reads reject foreign or repeated selectors
- Location: tests\subject-hub.spec.mjs:173:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('link', { name: 'Все срезы навыков' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('link', { name: 'Все срезы навыков' }) with timeout 5000ms
  - waiting for getByRole('link', { name: 'Все срезы навыков' })

```

```yaml
- link "Перейти к содержимому":
  - /url: "#main-content"
- complementary:
  - text: K8K Academy Кабинет ученика
  - navigation "Основная навигация":
    - link "Главная":
      - /url: /student
    - link "Расписание":
      - /url: /student/lessons
    - link "Задания":
      - /url: /student/homework
    - link "Мои предметы":
      - /url: /student/subjects
    - link "Мой путь знаний":
      - /url: /student/skills
    - link "Помощь":
      - /url: /student/help
- banner:
  - text: Кабинет ученика
  - 'button "Уведомления, непрочитанных: 2"'
  - group: Синтетическое имя ДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамил Ученик
- main:
  - heading "Мой путь знаний" [level=1]
  - paragraph: Навыки и цели, которые вы обсуждаете с преподавателем
  - list "Учебные этапы":
    - listitem: Знакомлюсь
    - listitem: Практикую
    - listitem: Применяю
  - paragraph: Этап определяет преподаватель. «Ещё не изучали» — отдельное состояние до начала изучения.
  - paragraph:
    - text: Получено в
    - time: 8 ноября в 12:47
    - text: · Europe/Chisinau
  - text: Предмет
  - combobox "Предмет":
    - option "Все предметы, включая историю"
    - option "Английский язык"
    - option "Математика" [selected]
  - paragraph:
    - text: Получено в
    - time: 8 ноября в 12:47
    - text: · Europe/Chisinau
  - link "К предмету":
    - /url: /student/subjects?subjectId=60000000-0000-4000-8000-000000000002
  - button "Обновить навыки"
  - heading "Математика" [level=2]
  - paragraph: "Навыков в карте: 0"
  - list
  - paragraph: Навыки ещё не добавлены.
  - heading "Цели обучения" [level=3]
  - paragraph: Обсуди цели с преподавателем.
  - paragraph: По этому предмету срез пока не опубликован.
  - paragraph: Срок следующего пересмотра пока не указан.
  - heading "Срезы навыков после 4 уроков" [level=2]
  - paragraph: Преподаватель пересматривает навыки каждые 4 подтверждённых проведённых урока по предмету. Отчёт после 8 уроков публикуется отдельно.
  - paragraph: Срез сохраняет названия и комментарии на момент подтверждения. История предмета не означает текущий допуск к занятиям.
  - link "Отчёты после 8 уроков":
    - /url: /student/reports
  - paragraph:
    - text: Получено в
    - time: 8 ноября в 12:47
    - text: · Europe/Chisinau
  - paragraph: Подтверждённых срезов пока нет.
```

# Test source

```ts
  101 |         await expect(card(page, 'Математика')).toBeVisible();
  102 |         await noOverflow(page);
  103 |         if (width < 1024) {
  104 |           const bottom = page.locator('.k8k-bottom-nav');
  105 |           await expect(bottom).toBeVisible();
  106 |           expect(
  107 |             (await primary.boundingBox()).y + (await primary.boundingBox()).height,
  108 |           ).toBeLessThan((await bottom.boundingBox()).y);
  109 |         }
  110 |         await screenshot(page, 'after/' + locale + '-' + width + '-home.png');
  111 |         if (width === 360) await checkAccessibility(page);
  112 |         await page.goto(hub);
  113 |         await expect(card(page, 'Английский язык')).toBeVisible();
  114 |         await expect(page.locator('main h1')).toHaveText(ro ? 'Materiile mele' : 'Мои предметы');
  115 |         await noOverflow(page);
  116 |         for (const link of await page.locator('.k8k-subject-card a').all())
  117 |           expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
  118 |         await screenshot(page, 'after/' + locale + '-' + width + '-subjects.png');
  119 |         if (width === 360) await checkAccessibility(page);
  120 |         await page.goto('/student/help');
  121 |         await expect(page.locator('main h1')).toHaveText(ro ? 'Ajutor' : 'Помощь');
  122 |         await expect(page.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute(
  123 |           'href',
  124 |           'https://wa.me/37360000001',
  125 |         );
  126 |         await expect(page.getByRole('link', { name: 'Telegram' })).toHaveAttribute(
  127 |           'href',
  128 |           'https://t.me/academy_manager',
  129 |         );
  130 |         await noOverflow(page);
  131 |         await screenshot(page, 'after/' + locale + '-' + width + '-help.png');
  132 |         if (width === 360) await checkAccessibility(page);
  133 |       }
  134 |     },
  135 |   );
  136 | }
  137 | 
  138 | for (const width of [360, 1280]) {
  139 |   test(
  140 |     'subject-hub six menu destinations and active state at ' + width,
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
> 201 |   await expect(page.getByRole('link', { name: 'Все срезы навыков' })).toBeVisible();
      |                                                                       ^ Error: expect(locator).toBeVisible() failed
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
```
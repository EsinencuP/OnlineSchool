# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: locales.spec.mjs >> TASK-034 RU/RO route layouts and accessibility ro
- Location: tests\locales.spec.mjs:54:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Bine ai revenit', exact: true }).first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: 'Bine ai revenit', exact: true }).first() with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Bine ai revenit', exact: true }).first()

```

```yaml
- main:
  - heading "Autentificare" [level=1]
  - paragraph: Autentifică-te pentru a continua studiile.
  - text: Limba interfeței
  - combobox "Limba interfeței":
    - option "Русский"
    - option "Română" [selected]
  - group:
    - text: Adresă de e-mail
    - textbox "Adresă de e-mail"
    - text: Parolă
    - textbox "Parolă"
    - button "Autentifică-te"
```

# Test source

```ts
  1   | import { expect, test } from './gate-fixtures.mjs';
  2   | import { evidenceUrl } from './gate-fixtures.mjs';
  3   | import { fileURLToPath } from 'node:url';
  4   | import { createRequire } from 'node:module';
  5   | import { writeFileSync } from 'node:fs';
  6   | import { localeFixture, fileId, english, sessionId } from './locale-fixtures.mjs';
  7   | const require = createRequire(new URL('../../manager-web/package.json', import.meta.url));
  8   | const AxeBuilder = require('@axe-core/playwright').default;
  9   | const state = async (request) => (await request.get('/__fixture/state')).json();
  10  | const patch = (request, data) => request.patch('/__fixture/state', { data });
  11  | const calls = async (request, suffix) =>
  12  |   (await state(request)).calls.filter((call) => call.path.endsWith(suffix));
  13  | async function setup({ request, context }, locale = 'ru', data = {}) {
  14  |   await request.post('/__fixture/reset', { data: { ...localeFixture(), ...data } });
  15  |   await context.addCookies((await request.storageState()).cookies);
  16  |   await context.addInitScript((value) => {
  17  |     if (!localStorage.getItem('k8k.locale')) localStorage.setItem('k8k.locale', value);
  18  |   }, locale);
  19  |   await context.route('**/*', (route) =>
  20  |     new URL(route.request().url()).origin === 'http://127.0.0.1:4175'
  21  |       ? route.continue()
  22  |       : route.abort(),
  23  |   );
  24  | }
  25  | async function language(page, value) {
  26  |   const selector = page.locator('.k8k-language select');
  27  |   if (!(await selector.isVisible())) await page.locator('.account-menu > summary').click();
  28  |   await selector.selectOption(value);
  29  |   await expect(page.locator('html')).toHaveAttribute('lang', value);
  30  | }
  31  | async function shot(page, name) {
  32  |   await page.evaluate(() => globalThis.document.fonts.ready);
  33  |   await page.screenshot({
  34  |     path: fileURLToPath(
  35  |       evidenceUrl('../../../output/k8k-tasks/TASK-034/after/' + name + '.png', import.meta.url),
  36  |     ),
  37  |     animations: 'disabled',
  38  |   });
  39  | }
  40  | async function layout(page, width) {
  41  |   expect(
  42  |     await page.evaluate(() => globalThis.document.documentElement.scrollWidth),
  43  |   ).toBeLessThanOrEqual(width);
  44  | }
  45  | const routes = [
  46  |   ['materials', 'Материалы', 'Materiale'],
  47  |   ['profile', 'Профиль и настройки', 'Profil și setări'],
  48  |   ['security', 'Безопасность аккаунта', 'Securitatea contului'],
  49  |   ['login', 'С возвращением', 'Bine ai revenit'],
  50  |   ['security/change-password', 'Задайте новый пароль', 'Setează o parolă nouă'],
  51  | ];
  52  | test.afterEach(async ({ request }) => expect((await state(request)).missingRoutes).toEqual([]));
  53  | for (const locale of ['ru', 'ro'])
  54  |   test(
  55  |     'TASK-034 RU/RO route layouts and accessibility ' + locale,
  56  |     async ({ page, request, context }) => {
  57  |       test.setTimeout(120_000);
  58  |       await setup({ request, context }, locale);
  59  |       const axe = [];
  60  |       for (const width of [360, 768, 1024, 1280]) {
  61  |         await page.setViewportSize({ width, height: 900 });
  62  |         for (const [route, ru, ro] of routes) {
  63  |           await page.goto('/student/' + route + '?ui.k8k=1');
  64  |           await expect(
  65  |             page.getByRole('heading', { name: locale === 'ro' ? ro : ru, exact: true }).first(),
> 66  |           ).toBeVisible();
      |             ^ Error: expect(locator).toBeVisible() failed
  67  |           await expect(page.locator('html')).toHaveAttribute('lang', locale);
  68  |           expect(await page.title()).not.toMatch(/student\.|undefined/);
  69  |           await layout(page, width);
  70  |           if (route === 'profile') {
  71  |             await expect(
  72  |               page.getByRole('textbox', {
  73  |                 name: locale === 'ro' ? 'Cum să ne adresăm' : 'Как к тебе обращаться',
  74  |               }),
  75  |             ).toHaveValue(localeFixture().displayName);
  76  |             expect(
  77  |               (
  78  |                 await page
  79  |                   .getByRole('button', {
  80  |                     name: locale === 'ro' ? 'Salvează profilul' : 'Сохранить профиль',
  81  |                     exact: true,
  82  |                   })
  83  |                   .boundingBox()
  84  |               ).height,
  85  |             ).toBeGreaterThanOrEqual(48);
  86  |           }
  87  |           if (route === 'materials') {
  88  |             await expect(page.locator('.k8k-material-list > li')).toHaveCount(30);
  89  |             await expect(
  90  |               page
  91  |                 .getByRole('button', {
  92  |                   name: locale === 'ro' ? 'Descarcă' : 'Скачать',
  93  |                   exact: true,
  94  |                 })
  95  |                 .first(),
  96  |             ).toBeEnabled();
  97  |           }
  98  |           await shot(page, `${locale}-${width}-${route.replaceAll('/', '-')}`);
  99  |           if (width === 360) {
  100 |             const result = await new AxeBuilder({ page })
  101 |               .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
  102 |               .analyze();
  103 |             axe.push({ route, violations: result.violations });
  104 |             expect(
  105 |               result.violations.map(({ id, nodes }) => ({
  106 |                 id,
  107 |                 targets: nodes.map(({ target }) => target),
  108 |               })),
  109 |             ).toEqual([]);
  110 |           }
  111 |         }
  112 |         await patch(request, { active: false });
  113 |         await page.goto('/student/suspended?ui.k8k=1');
  114 |         await expect(
  115 |           page.getByRole('heading', {
  116 |             name: locale === 'ro' ? 'Acces suspendat' : 'Доступ приостановлен',
  117 |           }),
  118 |         ).toBeVisible();
  119 |         await expect(page.locator('.k8k-main,.account-menu,.k8k-material-list')).toHaveCount(0);
  120 |         await expect(
  121 |           page.getByRole('button', {
  122 |             name: locale === 'ro' ? 'Deconectează-te' : 'Выйти из аккаунта',
  123 |             exact: true,
  124 |           }),
  125 |         ).toBeVisible();
  126 |         await layout(page, width);
  127 |         await expect(page.locator('main')).toContainText('America/New_York');
  128 |         await shot(page, `${locale}-${width}-suspended`);
  129 |         await patch(request, { active: true });
  130 |       }
  131 |       writeFileSync(
  132 |         fileURLToPath(
  133 |           evidenceUrl('../../../output/k8k-tasks/TASK-034/axe-' + locale + '.json', import.meta.url),
  134 |         ),
  135 |         JSON.stringify(axe, null, 2),
  136 |       );
  137 |     },
  138 |   );
  139 | 
  140 | test('TASK-034 all current cabinet routes switch language and title without reload', async ({
  141 |   page,
  142 |   request,
  143 |   context,
  144 | }) => {
  145 |   await setup({ request, context });
  146 |   const paths = [
  147 |     '',
  148 |     'subjects',
  149 |     'help',
  150 |     'lessons',
  151 |     'lessons/10000000-0000-4000-8000-000000000001',
  152 |     'homework',
  153 |     'homework/20000000-0000-4000-8000-000000000001',
  154 |     'skills',
  155 |     'reports',
  156 |     'subscription',
  157 |     'materials',
  158 |     'profile',
  159 |     'security',
  160 |     'security/change-password',
  161 |     'login',
  162 |   ];
  163 |   for (const route of paths) {
  164 |     await page.goto('/student/' + route + '?ui.k8k=1');
  165 |     await expect(page.locator('.k8k-language select')).toHaveCount(1);
  166 |     await page.evaluate(() => (globalThis.LOCALE_MARKER = true));
```
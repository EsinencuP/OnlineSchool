# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: student-gate.spec.mjs >> TASK-035 complete student journey preserves rights, commands and session boundaries
- Location: tests\student-gate.spec.mjs:85:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('[data-skill-status]')
Expected: 4
Received: 24
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" locator('[data-skill-status]') with timeout 5000ms
  - waiting for locator('[data-skill-status]')
    - locator resolved to 0 elements
    - unexpected value "0"
    13 × locator resolved to 24 elements
       - unexpected value "24"

```

# Page snapshot

```yaml
- generic [ref=f4e4]:
  - link "Перейти к содержимому" [ref=f4e5] [cursor=pointer]:
    - /url: "#main-content"
  - complementary [ref=f4e6]:
    - generic [ref=f4e10]:
      - text: K8K Academy
      - generic [ref=f4e11]: Кабинет ученика
    - navigation "Основная навигация" [ref=f4e12]:
      - link "Главная" [ref=f4e14] [cursor=pointer]:
        - /url: /student
      - link "Расписание" [ref=f4e20] [cursor=pointer]:
        - /url: /student/lessons
      - link "Задания" [ref=f4e25] [cursor=pointer]:
        - /url: /student/homework
      - link "Мои предметы" [ref=f4e32] [cursor=pointer]:
        - /url: /student/subjects
      - link "Мой путь знаний" [ref=f4e37] [cursor=pointer]:
        - /url: /student/skills
      - link "Помощь" [ref=f4e41] [cursor=pointer]:
        - /url: /student/help
  - generic [ref=f4e46]:
    - banner [ref=f4e47]:
      - generic [ref=f4e48]: Кабинет ученика
      - generic [ref=f4e49]:
        - 'button "Уведомления, непрочитанных: 7" [ref=f4e50] [cursor=pointer]':
          - generic [aria-hidden] [ref=f4e54]: "7"
        - group [ref=f4e55]:
          - generic "София ДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФам Ученик" [ref=f4e56] [cursor=pointer]:
            - generic [aria-hidden] [ref=f4e57]: С
            - generic [ref=f4e58]:
              - text: София ДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФам
              - generic [ref=f4e59]: Ученик
            - generic [aria-hidden] [ref=f4e60]: ⌄
          - option "Русский" [selected]
          - option "Română"
    - main [ref=f4e62]:
      - generic [ref=f4e63]:
        - heading "Мой путь знаний" [level=1] [ref=f4e64]
        - paragraph [ref=f4e65]: Навыки и цели, которые вы обсуждаете с преподавателем
        - generic [ref=f4e66]:
          - list "Учебные этапы" [ref=f4e67]:
            - listitem [ref=f4e68]:
              - generic [ref=f4e69]: Знакомлюсь
            - listitem [ref=f4e70]:
              - generic [ref=f4e71]: Практикую
            - listitem [ref=f4e72]:
              - generic [ref=f4e73]: Применяю
          - paragraph [ref=f4e74]: Этап определяет преподаватель. «Ещё не изучали» — отдельное состояние до начала изучения.
        - generic [ref=f4e75]:
          - paragraph [ref=f4e77]:
            - generic [ref=f4e78]:
              - text: Получено в
              - time [ref=f4e79]: 8 ноября в 05:52
            - text: · America/New_York
          - generic [ref=f4e81]:
            - generic [ref=f4e82]: Предмет
            - combobox "Предмет" [ref=f4e83]:
              - option "Все предметы, включая историю" [selected]
              - option "Английский язык"
              - option "Математика"
              - option "Исторический предмет"
        - generic [ref=f4e84]:
          - paragraph [ref=f4e86]:
            - generic [ref=f4e87]:
              - text: Получено в
              - time [ref=f4e88]: 8 ноября в 05:52
            - text: · America/New_York
          - generic [ref=f4e89]:
            - button "Обновить навыки" [ref=f4e91] [cursor=pointer]
            - generic [ref=f4e92]:
              - heading "Английский язык" [level=2] [ref=f4e94]
              - paragraph [ref=f4e95]: "Навыков в карте: 4"
              - list [ref=f4e96]:
                - listitem [ref=f4e97]:
                  - generic [ref=f4e98]:
                    - heading "Новый навык" [level=3] [ref=f4e100]
                    - generic [ref=f4e101]: Ещё не изучали
                  - paragraph [ref=f4e104]: Проверка преподавателя ещё не опубликована.
                  - paragraph [ref=f4e105]: "Добавлено в карту: 2 октября 2026 г."
                  - button "История навыка" [ref=f4e106] [cursor=pointer]
                - listitem [ref=f4e107]:
                  - generic [ref=f4e108]:
                    - generic [ref=f4e109]:
                      - heading "Навык с очень длинным названием ДлинноеНазваниеДлинноеНазваниеДлинноеНазваниеДлинноеНазваниеДлинноеНазваниеДлинноеНазваниеДлинноеНазваниеДлинноеНазваниеДлинноеНазваниеДлинноеНазваниеДлинноеНазваниеДлинноеНазвание" [level=3] [ref=f4e110]
                      - paragraph [ref=f4e111]: Практика языка
                    - generic [ref=f4e112]: Знакомлюсь
                  - paragraph [ref=f4e115]: "Последняя проверка: 2 октября 2026 г. в 17:30 · Елена Преподаватель"
                  - button "История навыка" [ref=f4e116] [cursor=pointer]
                - listitem [ref=f4e117]:
                  - generic [ref=f4e118]:
                    - generic [ref=f4e119]:
                      - heading "Разговорная речь" [level=3] [ref=f4e120]
                      - paragraph [ref=f4e121]: Практика языка
                    - generic [ref=f4e122]: Практикую
                  - paragraph [ref=f4e125]: "Последняя проверка: 2 октября 2026 г. в 17:30 · Елена Преподаватель"
                  - button "История навыка" [ref=f4e126] [cursor=pointer]
                - listitem [ref=f4e127]:
                  - generic [ref=f4e128]:
                    - generic [ref=f4e129]:
                      - heading "Чтение" [level=3] [ref=f4e130]
                      - paragraph [ref=f4e131]: Практика языка
                    - generic [ref=f4e132]: Применяю
                  - paragraph [ref=f4e135]: "Последняя проверка: 2 октября 2026 г. в 17:30 · Елена Преподаватель"
                  - button "История навыка" [ref=f4e136] [cursor=pointer]
              - heading "Цели обучения" [level=3] [ref=f4e137]
              - list [ref=f4e138]:
                - listitem [ref=f4e139]:
                  - paragraph [ref=f4e140]: Рассказать о любимой книге
                  - generic [ref=f4e141]: В работе
                  - paragraph [ref=f4e144]: Без срока
                - listitem [ref=f4e145]:
                  - paragraph [ref=f4e146]: Обсудить путешествие
                  - generic [ref=f4e147]: Достигнута
                  - paragraph [ref=f4e150]: "Срок: 1 декабря 2026 г."
              - paragraph [ref=f4e151]: "Последний подтверждённый срез: 28 октября 2026 г."
              - paragraph [ref=f4e152]: "До следующего пересмотра, уроков: 2"
            - generic [ref=f4e153]:
              - heading "Математика" [level=2] [ref=f4e155]
              - paragraph [ref=f4e156]: "Навыков в карте: 0"
              - list
              - paragraph [ref=f4e157]: Навыки ещё не добавлены.
              - heading "Цели обучения" [level=3] [ref=f4e158]
              - paragraph [ref=f4e159]: Обсуди цели с преподавателем.
              - paragraph [ref=f4e160]: По этому предмету срез пока не опубликован.
              - paragraph [ref=f4e161]: Срок следующего пересмотра пока не указан.
            - generic [ref=f4e162]:
              - heading "Исторический предмет" [level=2] [ref=f4e164]
              - paragraph [ref=f4e165]: "Навыков в карте: 1"
              - list [ref=f4e166]:
                - listitem [ref=f4e167]:
                  - generic [ref=f4e168]:
                    - heading "Навык прошлого курса" [level=3] [ref=f4e170]
                    - generic [ref=f4e171]: Практикую
                  - paragraph [ref=f4e174]: "Последняя проверка: 2 октября 2025 г. в 08:00 · Прошлый преподаватель"
                  - button "История навыка" [ref=f4e175] [cursor=pointer]
              - heading "Цели обучения" [level=3] [ref=f4e176]
              - paragraph [ref=f4e177]: Обсуди цели с преподавателем.
              - paragraph [ref=f4e178]: По этому предмету срез пока не опубликован.
              - paragraph [ref=f4e179]: "До следующего пересмотра, уроков: 4"
            - generic [ref=f4e180]:
              - heading "Срезы навыков после 4 уроков" [level=2] [ref=f4e182]
              - paragraph [ref=f4e183]: Преподаватель пересматривает навыки каждые 4 подтверждённых проведённых урока по предмету. Отчёт после 8 уроков публикуется отдельно.
              - paragraph [ref=f4e184]: Срез сохраняет названия и комментарии на момент подтверждения. История предмета не означает текущий допуск к занятиям.
              - link "Отчёты после 8 уроков" [ref=f4e185] [cursor=pointer]:
                - /url: /student/reports
              - generic [ref=f4e186]:
                - paragraph [ref=f4e188]:
                  - generic [ref=f4e189]:
                    - text: Получено в
                    - time [ref=f4e190]: 8 ноября в 05:52
                  - text: · America/New_York
                - generic [ref=f4e191]:
                  - group [ref=f4e192]:
                    - generic "Английский язык · 28 октября 2026 г. · После урока 92" [ref=f4e193] [cursor=pointer]
                  - group [ref=f4e194]:
                    - generic "Исторический предмет · 1 октября 2025 г. · После урока 4" [ref=f4e195] [cursor=pointer]
                  - group [ref=f4e196]:
                    - generic "Английский язык · 27 октября 2026 г. · После урока 88" [ref=f4e197] [cursor=pointer]
                  - group [ref=f4e198]:
                    - generic "Английский язык · 26 октября 2026 г. · После урока 84" [ref=f4e199] [cursor=pointer]
                  - group [ref=f4e200]:
                    - generic "Английский язык · 25 октября 2026 г. · После урока 80" [ref=f4e201] [cursor=pointer]
                  - group [ref=f4e202]:
                    - generic "Английский язык · 24 октября 2026 г. · После урока 76" [ref=f4e203] [cursor=pointer]
                  - group [ref=f4e204]:
                    - generic "Английский язык · 23 октября 2026 г. · После урока 72" [ref=f4e205] [cursor=pointer]
                  - group [ref=f4e206]:
                    - generic "Английский язык · 22 октября 2026 г. · После урока 68" [ref=f4e207] [cursor=pointer]
                  - group [ref=f4e208]:
                    - generic "Английский язык · 21 октября 2026 г. · После урока 64" [ref=f4e209] [cursor=pointer]
                  - group [ref=f4e210]:
                    - generic "Английский язык · 20 октября 2026 г. · После урока 60" [ref=f4e211] [cursor=pointer]
                  - group [ref=f4e212]:
                    - generic "Английский язык · 19 октября 2026 г. · После урока 56" [ref=f4e213] [cursor=pointer]
                  - group [ref=f4e214]:
                    - generic "Английский язык · 18 октября 2026 г. · После урока 52" [ref=f4e215] [cursor=pointer]
                  - group [ref=f4e216]:
                    - generic "Английский язык · 17 октября 2026 г. · После урока 48" [ref=f4e217] [cursor=pointer]
                  - group [ref=f4e218]:
                    - generic "Английский язык · 16 октября 2026 г. · После урока 44" [ref=f4e219] [cursor=pointer]
                  - group [ref=f4e220]:
                    - generic "Английский язык · 15 октября 2026 г. · После урока 40" [ref=f4e221] [cursor=pointer]
                  - group [ref=f4e222]:
                    - generic "Английский язык · 14 октября 2026 г. · После урока 36" [ref=f4e223] [cursor=pointer]
                  - group [ref=f4e224]:
                    - generic "Английский язык · 13 октября 2026 г. · После урока 32" [ref=f4e225] [cursor=pointer]
                  - group [ref=f4e226]:
                    - generic "Английский язык · 12 октября 2026 г. · После урока 28" [ref=f4e227] [cursor=pointer]
                  - group [ref=f4e228]:
                    - generic "Английский язык · 11 октября 2026 г. · После урока 24" [ref=f4e229] [cursor=pointer]
                  - group [ref=f4e230]:
                    - generic "Английский язык · 10 октября 2026 г. · После урока 20" [ref=f4e231] [cursor=pointer]
                  - navigation "Страницы списка" [ref=f4e232]:
                    - button "Назад" [disabled] [ref=f4e233]
                    - generic [ref=f4e234]: Страница 1 из 2
                    - button "Далее" [ref=f4e235] [cursor=pointer]
```

# Test source

```ts
  15  | const state = request => request.get('/__fixture/state').then(response => response.json());
  16  | const fixture = () => ({ ...localeFixture(), ...skillFixture(), ...reportFixture(), ...bellFixture(),
  17  |   displayName: 'София ' + 'ДлиннаяФамилия'.repeat(8).slice(0,94), subjectHub: true, subscriptionScenario: 'ready',
  18  |   meetSnapshot: { asOf: new Date().toISOString(), scheduledAt: new Date(Date.now()+300000).toISOString(), subjectName: 'Математика' } });
  19  | async function setup({ request, context }, locale='ru', extra={}) {
  20  |   await request.post('/__fixture/reset',{data:{...fixture(),...extra}});
  21  |   await context.addCookies((await request.storageState()).cookies);
  22  |   await context.addInitScript(lang=>globalThis.localStorage.setItem('k8k.locale',lang),locale);
  23  | }
  24  | async function capture(page,name) {
  25  |   await page.evaluate(()=>globalThis.document.fonts.ready);
  26  |   await page.screenshot({path:path.join(output(),'matrix',name+'.png'),animations:'disabled'});
  27  | }
  28  | const routes = [
  29  |   ['home','/student'], ['subjects','/student/subjects'], ['help','/student/help'],
  30  |   ['schedule','/student/lessons?view=list'], ['calendar','/student/lessons?view=calendar&month=2026-11'],
  31  |   ['lesson','/student/lessons/'+lesson], ['homework','/student/homework'], ['editor','/student/homework/'+homework],
  32  |   ['skills','/student/skills'], ['reports','/student/reports'], ['report-detail','/student/reports?reportId='+oldReport+'&page=3'],
  33  |   ['subscriptions','/student/subscription?subscriptionId='+anchors.math], ['materials','/student/materials'],
  34  |   ['profile','/student/profile'], ['security','/student/security'], ['bell','/student?events=1'],
  35  |   ['login','/student/login'], ['first-password','/student/security/change-password'], ['suspended','/student/suspended'],
  36  | ];
  37  | for(const locale of ['ru','ro']) for(const [name,route]of routes) {
  38  |   test(`TASK-035 screen matrix ${locale} ${name}`,async({page,request,context})=>{
  39  |     test.setTimeout(90_000);
  40  |     await setup({request,context},locale,name==='suspended'?{active:false}:{});
  41  |     await page.goto(route+(route.includes('?')?'&':'?')+'ui.k8k=1');
  42  |     await expect(page.getByRole('heading',{level:1}).first()).toBeVisible();
  43  |     await page.waitForLoadState('networkidle');
  44  |     for(const width of [360,768,1024,1280]) {
  45  |       await page.setViewportSize({width,height:900});
  46  |       expect(await page.evaluate(()=>globalThis.document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  47  |       await expect(page.locator('html')).toHaveAttribute('lang',locale);
  48  |       await expect(page.locator('body')).not.toContainText(/\b(?:student\.|chrome\.|errors\.|nav\.)[A-Za-z]/);
  49  |       await capture(page,`${locale}-${name}-${width}-ready`);
  50  |       if(width===360) {
  51  |         const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
  52  |         const failures=axe.violations.map(({id,nodes})=>({id,targets:nodes.map(n=>n.target)}));
  53  |         appendFileSync(path.join(output(),'axe.jsonl'),JSON.stringify({taskId:'TASK-035',route,locale,width,failures})+'\n');
  54  |         expect(failures).toEqual([]);
  55  |       }
  56  |     }
  57  |     expect((await state(request)).missingRoutes).toEqual([]);
  58  |   });
  59  | }
  60  | 
  61  | for(const locale of ['ru','ro']) for(const status of ['loading','empty','error','forbidden','limited','stale','session-expired']) {
  62  |   test(`TASK-035 critical state matrix ${locale} ${status}`,async({page,request,context})=>{
  63  |     test.setTimeout(60_000);
  64  |     const extra=status==='loading'?{subjectDelay:10000}:status==='empty'?{subjectEmpty:true}:status==='error'?{subjectError:503}:status==='forbidden'?{subjectError:403}:status==='limited'?{subscriptionScenario:'partial'}:{};
  65  |     await setup({request,context},locale,extra);
  66  |     await page.goto('/student/subjects?ui.k8k=1');
  67  |     await expect(page.getByRole('heading',{level:1})).toBeVisible();
  68  |     if(status==='stale'||status==='session-expired') {
  69  |       await expect(page.locator('.k8k-subject-grid')).toBeVisible();
  70  |       await request.patch('/__fixture/state',{data:status==='stale'?{subjectError:503}:{auth:false}});
  71  |       await page.evaluate(()=>globalThis.dispatchEvent(new Event('online')));
  72  |     }
  73  |     if(status==='session-expired') { await expect(page).toHaveURL(/\/student\/login$/); await expect(page.locator('.k8k-shell')).toHaveCount(0); }
  74  |     else if(status!=='limited')await expect(page.locator(`.k8k-state[data-state=${status}]`)).toBeVisible();
  75  |     else await expect(page.locator('.k8k-subject-grid')).toBeVisible();
  76  |     for(const width of [360,768,1024,1280]) {
  77  |       await page.setViewportSize({width,height:900});
  78  |       expect(await page.evaluate(()=>globalThis.document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  79  |       await capture(page,`${locale}-subjects-${width}-${status}`);
  80  |     }
  81  |     expect((await state(request)).missingRoutes).toEqual([]);
  82  |   });
  83  | }
  84  | 
  85  | test('TASK-035 complete student journey preserves rights, commands and session boundaries',async({page,request,context})=>{
  86  |   test.setTimeout(100_000);
  87  |   await setup({request,context},'ru',{auth:false,mustChangePassword:true,demoContacts:true,demoAlternate:{displayName:'Другой ученик'}});
  88  |   await page.goto('/student/login?ui.k8k=1');
  89  |   await page.getByLabel('Email',{exact:true}).fill('student@example.invalid');
  90  |   await page.getByLabel('Пароль',{exact:true}).fill('Fixture-Temporary-2026!');
  91  |   await page.getByRole('button',{name:'Войти',exact:true}).click();
  92  |   await expect(page).toHaveURL(/change-password$/);
  93  |   await page.getByLabel('Текущий пароль',{exact:true}).fill('Fixture-Temporary-2026!');
  94  |   await page.getByLabel('Новый пароль',{exact:true}).fill('Fixture-New-2026!');
  95  |   await page.getByLabel('Повторите новый пароль').fill('Fixture-New-2026!');
  96  |   await page.getByRole('button',{name:'Изменить пароль',exact:true}).click();
  97  |   await expect(page.locator('.k8k-lesson-hero')).toBeVisible();
  98  |   await page.goto('/student/subjects');
  99  |   await expect(page.locator('.k8k-subject-grid')).toBeVisible();
  100 |   await expect(page.locator('main')).toContainText('Математика');
  101 |   await expect(page.locator('main')).toContainText('Физика');
  102 |   await page.goto('/student');
  103 |   await context.route('https://meet.google.com/**',route=>route.fulfill({contentType:'text/html',body:'<title>Synthetic Meet boundary</title>'}));
  104 |   const join=page.getByRole('link',{name:'Войти в Google Meet',exact:true});
  105 |   await expect(join).toBeEnabled();
  106 |   const [popup]=await Promise.all([context.waitForEvent('page'),join.click()]);await popup.close();
  107 |   await page.goto('/student/homework/'+homework);
  108 |   const answer=page.locator('.k8k-homework-answer textarea');await answer.fill('Сквозной учебный черновик');
  109 |   await expect.poll(async()=>(await state(request)).draft).toBe('Сквозной учебный черновик');
  110 |   await page.route('https://upload.student.test/**',route=>route.fulfill({status:200,headers:{'Access-Control-Allow-Origin':'*'},body:''}));
  111 |   await page.locator('input[type=file]').setInputFiles({name:'gate-answer.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic answer')});
  112 |   await expect(page.getByRole('button',{name:'Убрать gate-answer.txt',exact:true})).toBeVisible();
  113 |   await page.locator('.k8k-homework-submit').click();
  114 |   await expect.poll(async()=>(await state(request)).submitted).toBe(true);
> 115 |   await page.goto('/student/skills');await expect(page.locator('[data-skill-status]')).toHaveCount(4);
      |                                                                                        ^ Error: expect(locator).toHaveCount(expected) failed
  116 |   await page.goto('/student/reports?reportId='+oldReport+'&page=3');
  117 |   await expect(page.locator('[data-report-id="'+oldReport+'"]')).toBeVisible();
  118 |   await page.getByRole('button',{name:'Подготовить PDF',exact:true}).click();
  119 |   await expect.poll(async()=>Object.keys((await state(request)).pdfJobs??{}).length).toBe(1);
  120 |   await page.goto('/student/subscription?subscriptionId='+anchors.math);
  121 |   await expect(page.locator('main')).toContainText('Математика');
  122 |   await page.goto('/student/help');await expect(page.locator('a[href^="https://wa.me/"]')).toBeVisible();
  123 |   const beforeSwitch=await state(request);
  124 |   expect(beforeSwitch.calls.filter(c=>/attendance|ledger|finance/.test(c.path)&&c.method!=='GET')).toHaveLength(0);
  125 |   expect(beforeSwitch.calls.filter(c=>c.path.endsWith('/submit'))).toHaveLength(1);
  126 |   await page.locator('.account-menu > summary').click();
  127 |   await page.getByRole('button',{name:/Демо Даниил/}).click();
  128 |   await expect(page.locator('main h1')).toContainText('Другой ученик');
  129 |   await page.locator('.account-menu > summary').click();
  130 |   await page.getByRole('button',{name:'Выйти из аккаунта',exact:true}).click();
  131 |   await expect(page).toHaveURL(/\/student\/login$/);
  132 |   await expect(page.locator('.k8k-shell')).toHaveCount(0);
  133 | });
  134 | 
  135 | test('TASK-035 keyboard, 200% reflow and motion preference preserve the main action',async({page,request,context})=>{
  136 |   await setup({request,context});await page.goto('/student?ui.k8k=1');
  137 |   await expect(page.locator('.k8k-lesson-hero')).toBeVisible();
  138 |   await page.keyboard.press('Tab');await expect(page.locator('.k8k-skip')).toBeFocused();
  139 |   await page.keyboard.press('Enter');await expect(page.locator('main.k8k-main')).toBeFocused();
  140 |   await page.setViewportSize({width:360,height:900});
  141 |   await page.locator('.k8k-menu-button').click();await page.keyboard.press('Escape');
  142 |   await expect(page.locator('.k8k-menu-button')).toBeFocused();
  143 |   await page.locator('.k8k-bell').click();await expect(page.getByRole('dialog')).toBeVisible();
  144 |   await page.keyboard.press('Escape');await expect(page.locator('.k8k-bell')).toBeFocused();
  145 |   await page.setViewportSize({width:1280,height:900});
  146 |   await page.evaluate(()=>{globalThis.document.documentElement.style.zoom='2';});
  147 |   expect(await page.evaluate(()=>globalThis.document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
  148 |   await capture(page,'ru-home-200-percent');
  149 |   await page.evaluate(()=>{globalThis.document.documentElement.style.zoom='1';});
  150 |   await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:360,height:900});
  151 |   await page.locator('.k8k-menu-button').click();await page.keyboard.press('Escape');
  152 |   await page.emulateMedia({reducedMotion:'reduce'});
  153 |   expect(await page.locator('.k8k-menu-button').evaluate(el=>globalThis.getComputedStyle(el).transitionDuration)).toBe('0s');
  154 |   await expect(page.getByRole('link',{name:'Войти в Google Meet',exact:true})).toBeVisible();
  155 | });
  156 | 
  157 | for(const locale of ['ru','ro']) for(const outcome of ['pending','unknown-result']) {
  158 |   test(`TASK-035 command state matrix ${locale} ${outcome}`,async({page,request,context})=>{
  159 |     test.setTimeout(60_000);
  160 |     await setup({request,context},locale,{loseSubmitResponse:outcome==='unknown-result'});
  161 |     let release, complete;
  162 |     const pending=new Promise(resolve=>{release=resolve;});
  163 |     const finished=new Promise(resolve=>{complete=resolve;});
  164 |     let started=false;
  165 |     if(outcome==='pending')await page.route('**/api/v1/student/homework/*/submit',async route=>{
  166 |       started=true;await pending;await route.continue();complete();
  167 |     });
  168 |     try {
  169 |       await page.goto('/student/homework/'+homework+'?ui.k8k=1');
  170 |       await page.locator('.k8k-homework-answer textarea').fill('Учебный ответ для проверки исхода');
  171 |       await page.locator('.k8k-homework-submit').click();
  172 |       if(outcome==='pending')await expect.poll(()=>started).toBe(true);
  173 |       else await expect(page.getByText(locale==='ro'?/Rezultatul trimiterii este încă necunoscut/:/Результат отправки пока неизвестен/)).toBeVisible();
  174 |       await expect(page.locator('.k8k-homework-answer textarea')).toBeDisabled();
  175 |       for(const width of [360,768,1024,1280]) {
  176 |         await page.setViewportSize({width,height:900});
  177 |         expect(await page.evaluate(()=>globalThis.document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  178 |         await capture(page,`${locale}-homework-${width}-${outcome}`);
  179 |       }
  180 |     } finally { release();if(started)await finished; }
  181 |   });
  182 | }
  183 | 
```
# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: student-gate.spec.mjs >> TASK-035 keyboard, 200% reflow and motion preference preserve the main action
- Location: tests\student-gate.spec.mjs:135:1

# Error details

```
Error: expect(received).toBeLessThanOrEqual(expected)

Expected: <= 1280
Received:    1832
```

# Page snapshot

```yaml
- generic [ref=e4]:
  - link "Перейти к содержимому" [ref=e5] [cursor=pointer]:
    - /url: "#main-content"
  - complementary [ref=e6]:
    - generic [ref=e10]:
      - text: K8K Academy
      - generic [ref=e11]: Кабинет ученика
    - navigation "Основная навигация" [ref=e12]:
      - link "Главная" [ref=e14] [cursor=pointer]:
        - /url: /student
      - link "Расписание" [ref=e20] [cursor=pointer]:
        - /url: /student/lessons
      - link "Задания" [ref=e25] [cursor=pointer]:
        - /url: /student/homework
      - link "Мои предметы" [ref=e32] [cursor=pointer]:
        - /url: /student/subjects
      - link "Мой путь знаний" [ref=e37] [cursor=pointer]:
        - /url: /student/skills
      - link "Помощь" [ref=e41] [cursor=pointer]:
        - /url: /student/help
  - generic [ref=e46]:
    - banner [ref=e47]:
      - generic: Кабинет ученика
      - generic [ref=e48]:
        - 'button "Уведомления, непрочитанных: 7" [active] [ref=e49] [cursor=pointer]':
          - generic [aria-hidden] [ref=e53]: "7"
        - group [ref=e54]:
          - generic "София ДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФам Ученик" [ref=e55] [cursor=pointer]:
            - generic [aria-hidden] [ref=e56]: С
            - generic [ref=e57]:
              - text: София ДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФам
              - generic [ref=e58]: Ученик
            - generic [aria-hidden] [ref=e59]: ⌄
          - option "Русский" [selected]
          - option "Română"
    - main [ref=e61]:
      - generic [ref=e62]:
        - heading "Привет, София ДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФам!" [level=1] [ref=e64]
        - generic [ref=e65]:
          - generic [ref=e66]:
            - paragraph [ref=e68]:
              - generic [ref=e69]:
                - text: Данные сервера на
                - time [ref=e70]: 8 ноября в 05:52
              - text: ·
              - generic [ref=e71]:
                - text: Получено в
                - time [ref=e72]: 8 ноября в 05:52
              - text: · America/New_York
            - region [ref=e74]:
              - heading "Следующий урок" [level=2] [ref=e75]
              - heading "Математика" [level=3] [ref=e76]
              - paragraph [ref=e77]:
                - time [ref=e80]: 8 ноября в 05:57
                - text: · 50 мин
              - paragraph [ref=e81]: "Преподаватель: Елизавета К."
              - generic [ref=e82]: По расписанию
              - paragraph [ref=e85]: Через 5 мин.
              - generic [ref=e90]:
                - link "Войти в Google Meet" [ref=e91] [cursor=pointer]:
                  - /url: https://meet.google.com/abc-defg-hij
                - link "Открыть урок" [ref=e95] [cursor=pointer]:
                  - /url: /student/lessons/10000000-0000-4000-8000-000000000001
          - navigation "Быстрые входы" [ref=e98]:
            - link "Задания" [ref=e99] [cursor=pointer]:
              - /url: /student/homework
            - link "Мои предметы" [ref=e107] [cursor=pointer]:
              - /url: /student/subjects
        - generic [ref=e113]:
          - generic [ref=e114]:
            - generic [ref=e115]:
              - generic [ref=e116]:
                - heading "Мои предметы" [level=2] [ref=e117]
                - link "Все предметы" [ref=e118] [cursor=pointer]:
                  - /url: /student/subjects
              - generic [ref=e121]:
                - paragraph [ref=e123]:
                  - generic [ref=e124]:
                    - text: Данные сервера на
                    - time [ref=e125]: 8 ноября в 05:52
                  - text: ·
                  - generic [ref=e126]:
                    - text: Получено в
                    - time [ref=e127]: 8 ноября в 05:52
                  - text: · America/New_York
                - generic [ref=e129]:
                  - article [ref=e130]:
                    - generic [ref=e131]:
                      - heading "Математика" [level=2] [ref=e132]
                      - generic [ref=e133]: Активен
                    - paragraph [ref=e136]: Есть подтверждённые права на занятия.
                    - generic [ref=e137]:
                      - paragraph [ref=e138]: Следующее действие
                      - link "Открыть расписание" [ref=e139] [cursor=pointer]:
                        - /url: /student/lessons?fromSubjectId=60000000-0000-4000-8000-000000000002
                      - paragraph [ref=e142]: Открывается расписание по этому предмету.
                    - link "Открыть предмет" [ref=e143] [cursor=pointer]:
                      - /url: /student/subjects?subjectId=60000000-0000-4000-8000-000000000002
                  - article [ref=e146]:
                    - generic [ref=e147]:
                      - heading "Физика" [level=2] [ref=e148]
                      - generic [ref=e149]: Истёк
                    - paragraph [ref=e152]: Срок абонемента закончился.
                    - generic [ref=e153]:
                      - paragraph [ref=e154]: Следующее действие
                      - link "Вопросы по предмету" [ref=e155] [cursor=pointer]:
                        - /url: /student/help
                    - link "Открыть предмет" [ref=e158] [cursor=pointer]:
                      - /url: /student/subjects?subjectId=60000000-0000-4000-8000-000000000003
                  - article [ref=e161]:
                    - generic [ref=e162]:
                      - heading "Английский язык" [level=2] [ref=e163]
                      - generic [ref=e164]: Заморожен
                    - paragraph [ref=e167]: Действует заморозка.
                    - generic [ref=e168]:
                      - paragraph [ref=e169]: Следующее действие
                      - link "Все задания" [ref=e170] [cursor=pointer]:
                        - /url: /student/homework?fromSubjectId=60000000-0000-4000-8000-000000000001
                      - paragraph [ref=e173]: Открывается общий список заданий.
                    - link "Открыть предмет" [ref=e174] [cursor=pointer]:
                      - /url: /student/subjects?subjectId=60000000-0000-4000-8000-000000000001
            - generic [ref=e177]:
              - generic [ref=e178]:
                - generic [ref=e179]:
                  - heading "Ближайшие занятия" [level=2] [ref=e180]
                  - link "Всё расписание" [ref=e181] [cursor=pointer]:
                    - /url: /student/lessons
                - generic [ref=e184]:
                  - paragraph [ref=e186]:
                    - generic [ref=e187]:
                      - text: Получено в
                      - time [ref=e188]: 8 ноября в 05:52
                    - text: · America/New_York
                  - list [ref=e190]:
                    - listitem [ref=e191]:
                      - generic [ref=e192]:
                        - heading [level=3] [ref=e193]:
                          - link "Математика" [ref=e194] [cursor=pointer]:
                            - /url: /student/lessons/10000000-0000-4000-8000-000000000001
                        - time [ref=e195]: 8 ноября в 05:57
                        - paragraph [ref=e196]: Елизавета К.
                      - generic [ref=e197]: По расписанию
                    - listitem [ref=e200]:
                      - generic [ref=e201]:
                        - heading [level=3] [ref=e202]:
                          - link "Математика" [ref=e203] [cursor=pointer]:
                            - /url: /student/lessons/10000000-0000-4000-8000-000000000002
                        - time [ref=e204]: 11 ноября в 05:52
                        - paragraph [ref=e205]: Александр Константинопольский — преподаватель математики
                      - generic [ref=e206]: По расписанию
              - generic [ref=e209]:
                - generic [ref=e210]:
                  - heading "Задания" [level=2] [ref=e211]
                  - link "Все задания" [ref=e212] [cursor=pointer]:
                    - /url: /student/homework
                - generic [ref=e215]:
                  - paragraph [ref=e217]:
                    - generic [ref=e218]:
                      - text: Получено в
                      - time [ref=e219]: 8 ноября в 05:52
                    - text: · America/New_York
                  - generic [ref=e220]:
                    - paragraph [ref=e221]: Последние выданные работы
                    - list [ref=e222]:
                      - listitem [ref=e223]:
                        - generic [ref=e224]:
                          - paragraph [ref=e225]: Английский язык
                          - heading [level=3] [ref=e226]:
                            - link "Present Perfect. Рассказ о путешествии" [ref=e227] [cursor=pointer]:
                              - /url: /student/homework/20000000-0000-4000-8000-000000000001
                          - paragraph [ref=e228]:
                            - text: "Срок:"
                            - time [ref=e229]: 8 ноября в 05:51
                        - generic [ref=e230]: На доработку
            - generic [ref=e233]:
              - generic [ref=e234]:
                - heading "Мой путь знаний" [level=2] [ref=e235]
                - link "Открыть карту" [ref=e236] [cursor=pointer]:
                  - /url: /student/skills
              - paragraph [ref=e239]: Этап каждого навыка подтверждает преподаватель.
              - generic [ref=e240]:
                - list "Учебные этапы" [ref=e241]:
                  - listitem [ref=e242]:
                    - generic [ref=e243]: Знакомлюсь
                  - listitem [ref=e244]:
                    - generic [ref=e245]: Практикую
                  - listitem [ref=e246]:
                    - generic [ref=e247]: Применяю
                - paragraph [ref=e248]: Этап определяет преподаватель. «Ещё не изучали» — отдельное состояние до начала изучения.
              - generic [ref=e249]:
                - paragraph [ref=e251]:
                  - generic [ref=e252]:
                    - text: Получено в
                    - time [ref=e253]: 8 ноября в 05:52
                  - text: · America/New_York
                - list [ref=e255]:
                  - listitem [ref=e256]:
                    - generic [ref=e257]:
                      - heading [level=3] [ref=e258]:
                        - link "Английский язык" [ref=e259] [cursor=pointer]:
                          - /url: /student/skills?subjectId=60000000-0000-4000-8000-000000000001
                      - paragraph [ref=e260]: "Цель: Рассказать о любимой книге"
                  - listitem [ref=e261]:
                    - generic [ref=e262]:
                      - heading [level=3] [ref=e263]:
                        - link "Математика" [ref=e264] [cursor=pointer]:
                          - /url: /student/skills?subjectId=60000000-0000-4000-8000-000000000002
                      - paragraph [ref=e265]: Обсуди цели с преподавателем.
                  - listitem [ref=e266]:
                    - generic [ref=e267]:
                      - heading [level=3] [ref=e268]:
                        - link "Исторический предмет" [ref=e269] [cursor=pointer]:
                          - /url: /student/skills?subjectId=60000000-0000-4000-8000-000000000003
                      - paragraph [ref=e270]: Обсуди цели с преподавателем.
              - generic [ref=e271]:
                - paragraph [ref=e273]:
                  - generic [ref=e274]:
                    - text: Получено в
                    - time [ref=e275]: 8 ноября в 05:52
                  - text: · America/New_York
                - paragraph [ref=e277]: "Последний подтверждённый срез: Английский язык · 28 октября 2026 г. · После урока 92"
              - paragraph [ref=e278]: Преподаватель пересматривает навыки каждые 4 подтверждённых проведённых урока по предмету. Отчёт после 8 уроков публикуется отдельно.
            - link "Опубликованные отчёты" [ref=e279] [cursor=pointer]:
              - /url: /student/reports
          - complementary [ref=e280]:
            - generic [ref=e281]:
              - heading "Мой менеджер" [level=2] [ref=e282]
              - paragraph [ref=e284]: Поможет с расписанием и вопросами по обучению.
              - generic [ref=e285]:
                - link "WhatsApp" [ref=e286] [cursor=pointer]:
                  - /url: https://wa.me/37360000001
                - link "Telegram" [ref=e291] [cursor=pointer]:
                  - /url: https://t.me/academy_manager
            - generic [ref=e296]:
              - heading "Абонементы по предметам" [level=2] [ref=e297]
              - generic [ref=e298]:
                - paragraph [ref=e300]:
                  - generic [ref=e301]:
                    - text: Данные сервера на
                    - time [ref=e302]: 8 ноября в 05:52
                  - text: ·
                  - generic [ref=e303]:
                    - text: Получено в
                    - time [ref=e304]: 8 ноября в 05:52
                  - text: · America/New_York
                - generic [ref=e305]:
                  - article [ref=e306]:
                    - heading "Математика" [level=3] [ref=e307]
                    - generic [ref=e308]:
                      - generic [ref=e309]: Активен
                      - paragraph [ref=e312]: Есть подтверждённые права на занятия.
                      - generic [ref=e313]:
                        - term [ref=e314]: Остаток оплаченных занятий
                        - definition [ref=e315]: "5"
                        - term [ref=e316]: Действует до
                        - definition [ref=e317]:
                          - time [ref=e318]: 30 ноября
                      - link "Условия абонемента" [ref=e319] [cursor=pointer]:
                        - /url: /student/subscription?subscriptionId=71000000-0000-4000-8000-000000000001&fromSubjectId=60000000-0000-4000-8000-000000000002
                  - article [ref=e322]:
                    - heading "Физика" [level=3] [ref=e323]
                    - generic [ref=e324]:
                      - generic [ref=e325]: Истёк
                      - paragraph [ref=e328]: Срок абонемента закончился.
                      - generic [ref=e329]:
                        - term [ref=e330]: Остаток оплаченных занятий
                        - definition [ref=e331]: Не зафиксировано
                        - term [ref=e332]: Действует до
                        - definition [ref=e333]:
                          - time [ref=e334]: 29 октября
                      - link "Условия абонемента" [ref=e335] [cursor=pointer]:
                        - /url: /student/subscription?subscriptionId=71000000-0000-4000-8000-000000000002&fromSubjectId=60000000-0000-4000-8000-000000000003
                  - article [ref=e338]:
                    - heading "Английский язык" [level=3] [ref=e339]
                    - generic [ref=e340]:
                      - generic [ref=e341]: Заморожен
                      - paragraph [ref=e344]: Действует заморозка.
                      - generic [ref=e345]:
                        - term [ref=e346]: Остаток оплаченных занятий
                        - definition [ref=e347]: "3"
                        - term [ref=e348]: Действует до
                        - definition [ref=e349]:
                          - time [ref=e350]: 30 ноября
                        - term [ref=e351]: Заморожен до
                        - definition [ref=e352]:
                          - time [ref=e353]: 18 ноября
                      - link "Условия абонемента" [ref=e354] [cursor=pointer]:
                        - /url: /student/subscription?subscriptionId=71000000-0000-4000-8000-000000000003&fromSubjectId=60000000-0000-4000-8000-000000000001
```

# Test source

```ts
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
  115 |   await page.goto('/student/skills');await expect(page.locator('[data-skill-status]')).toHaveCount(4);
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
> 147 |   expect(await page.evaluate(()=>globalThis.document.documentElement.scrollWidth)).toBeLessThanOrEqual(1280);
      |                                                                                    ^ Error: expect(received).toBeLessThanOrEqual(expected)
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
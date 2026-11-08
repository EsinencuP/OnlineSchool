# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: student-gate-extra.acceptance.mjs >> TASK-035 actual third-page report link ro
- Location: tests\student-gate-extra.acceptance.mjs:54:34

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('.k8k-report-summary')
Expected: 15
Received: 10
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" locator('.k8k-report-summary') with timeout 5000ms
  - waiting for locator('.k8k-report-summary')
    - locator resolved to 0 elements
    - unexpected value "0"
    13 × locator resolved to 10 elements
       - unexpected value "10"

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - link "Sari la conținut" [ref=e5] [cursor=pointer]:
    - /url: "#main-content"
  - complementary [ref=e6]:
    - generic [ref=e10]:
      - text: K8K Academy
      - generic [ref=e11]: Cabinetul elevului
    - navigation "Navigare principală" [ref=e12]:
      - link "Acasă" [ref=e14] [cursor=pointer]:
        - /url: /student
      - link "Orar" [ref=e20] [cursor=pointer]:
        - /url: /student/lessons
      - link "Teme" [ref=e25] [cursor=pointer]:
        - /url: /student/homework
      - link "Materiile mele" [ref=e32] [cursor=pointer]:
        - /url: /student/subjects
      - link "Parcursul meu" [ref=e37] [cursor=pointer]:
        - /url: /student/skills
      - link "Ajutor" [ref=e41] [cursor=pointer]:
        - /url: /student/help
  - generic [ref=e46]:
    - banner [ref=e47]:
      - generic [ref=e48]: Cabinetul elevului
      - generic [ref=e49]:
        - 'button "Notificări, necitite: 2" [ref=e50] [cursor=pointer]':
          - generic [aria-hidden] [ref=e54]: "2"
        - group [ref=e55]:
          - generic "Alias NumeNumeNumeNumeNumeNumeNumeNumeNumeNumeNumeNumeNumeNumeNumeNumeNumeNume Elev" [ref=e56] [cursor=pointer]:
            - generic [aria-hidden] [ref=e57]: A
            - generic [ref=e58]:
              - text: Alias NumeNumeNumeNumeNumeNumeNumeNumeNumeNumeNumeNumeNumeNumeNumeNumeNumeNume
              - generic [ref=e59]: Elev
            - generic [aria-hidden] [ref=e60]: ⌄
          - option "Русский"
          - option "Română" [selected]
    - main [ref=e62]:
      - generic [ref=e63]:
        - heading "Rapoarte publicate" [level=1] [ref=e64]
        - paragraph [ref=e65]: Profesorul confirmă raportul după opt lecții desfășurate. Evaluarea competențelor după patru lecții este un document separat.
        - link "Parcursul meu" [ref=e66] [cursor=pointer]:
          - /url: /student/skills
        - generic [ref=e67]:
          - paragraph [ref=e69]:
            - generic [ref=e70]:
              - text: Recepționat la
              - time [ref=e71]: 8 noiembrie la 06:08
            - text: · America/New_York
          - generic [ref=e72]:
            - generic [ref=e73]:
              - heading "Предмет 21" [level=2] [ref=e74]
              - paragraph [ref=e75]: 1 septembrie 2026 — 30 septembrie 2026
              - paragraph [ref=e76]: Преподаватель ДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилия
              - link "Deschide raportul" [ref=e77] [cursor=pointer]:
                - /url: /student/reports?page=3&ui.k8k=1&reportId=80000000-0000-4000-8000-000000000021
            - generic [ref=e78]:
              - heading "Предмет 22" [level=2] [ref=e79]
              - paragraph [ref=e80]: 1 septembrie 2026 — 30 septembrie 2026
              - paragraph [ref=e81]: Преподаватель ДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилия
              - link "Deschide raportul" [ref=e82] [cursor=pointer]:
                - /url: /student/reports?page=3&ui.k8k=1&reportId=80000000-0000-4000-8000-000000000022
            - generic [ref=e83]:
              - heading "Предмет 23" [level=2] [ref=e84]
              - paragraph [ref=e85]: 1 septembrie 2026 — 30 septembrie 2026
              - paragraph [ref=e86]: Преподаватель ДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилия
              - link "Deschide raportul" [ref=e87] [cursor=pointer]:
                - /url: /student/reports?page=3&ui.k8k=1&reportId=80000000-0000-4000-8000-000000000023
            - generic [ref=e88]:
              - heading "Предмет 24" [level=2] [ref=e89]
              - paragraph [ref=e90]: 1 septembrie 2026 — 30 septembrie 2026
              - paragraph [ref=e91]: Преподаватель ДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилия
              - link "Deschide raportul" [ref=e92] [cursor=pointer]:
                - /url: /student/reports?page=3&ui.k8k=1&reportId=80000000-0000-4000-8000-000000000024
            - generic [ref=e93]:
              - heading "Предмет 25" [level=2] [ref=e94]
              - paragraph [ref=e95]: 1 septembrie 2026 — 30 septembrie 2026
              - paragraph [ref=e96]: Преподаватель ДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилия
              - link "Deschide raportul" [ref=e97] [cursor=pointer]:
                - /url: /student/reports?page=3&ui.k8k=1&reportId=80000000-0000-4000-8000-000000000025
            - generic [ref=e98]:
              - heading "Предмет 26" [level=2] [ref=e99]
              - paragraph [ref=e100]: 1 septembrie 2026 — 30 septembrie 2026
              - paragraph [ref=e101]: Преподаватель ДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилия
              - link "Deschide raportul" [ref=e102] [cursor=pointer]:
                - /url: /student/reports?page=3&ui.k8k=1&reportId=80000000-0000-4000-8000-000000000026
            - generic [ref=e103]:
              - heading "Предмет 27" [level=2] [ref=e104]
              - paragraph [ref=e105]: 1 septembrie 2026 — 30 septembrie 2026
              - paragraph [ref=e106]: Преподаватель ДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилия
              - link "Deschide raportul" [ref=e107] [cursor=pointer]:
                - /url: /student/reports?page=3&ui.k8k=1&reportId=80000000-0000-4000-8000-000000000027
            - generic [ref=e108]:
              - heading "Предмет 28" [level=2] [ref=e109]
              - paragraph [ref=e110]: 1 septembrie 2026 — 30 septembrie 2026
              - paragraph [ref=e111]: Преподаватель ДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилия
              - link "Deschide raportul" [ref=e112] [cursor=pointer]:
                - /url: /student/reports?page=3&ui.k8k=1&reportId=80000000-0000-4000-8000-000000000028
            - generic [ref=e113]:
              - heading "Предмет 29" [level=2] [ref=e114]
              - paragraph [ref=e115]: 1 septembrie 2026 — 30 septembrie 2026
              - paragraph [ref=e116]: Преподаватель ДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилия
              - link "Deschide raportul" [ref=e117] [cursor=pointer]:
                - /url: /student/reports?page=3&ui.k8k=1&reportId=80000000-0000-4000-8000-000000000029
            - generic [ref=e118]:
              - heading "Предмет 30" [level=2] [ref=e119]
              - paragraph [ref=e120]: 1 septembrie 2026 — 30 septembrie 2026
              - paragraph [ref=e121]: Преподаватель ДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилияДлиннаяФамилия
              - link "Deschide raportul" [ref=e122] [cursor=pointer]:
                - /url: /student/reports?page=3&ui.k8k=1&reportId=80000000-0000-4000-8000-000000000030
            - navigation "Paginile listei" [ref=e123]:
              - button "Înapoi" [ref=e124] [cursor=pointer]
              - generic [ref=e125]: Pagina 3 din 6
              - button "Înainte" [ref=e126] [cursor=pointer]
        - generic [ref=e127]:
          - heading "PDF al istoricului educațional" [level=2] [ref=e128]
          - paragraph [ref=e129]: Extrasul include istoricul educațional permis. Alege disciplina și perioada sau lasă câmpurile goale pentru întregul istoric.
          - generic [ref=e130]:
            - paragraph [ref=e132]:
              - generic [ref=e133]:
                - text: Recepționat la
                - time [ref=e134]: 8 noiembrie la 06:08
              - text: · America/New_York
            - group [ref=e137]:
              - generic [ref=e138]:
                - generic [ref=e139]: Disciplina
                - combobox "Disciplina" [ref=e140]:
                  - option "Întregul istoric, toate disciplinele" [selected]
                  - option "Математика"
                  - option "Физика"
                  - option "Английский язык"
              - generic [ref=e141]:
                - generic [ref=e142]: De la data
                - textbox "De la data" [ref=e143]
              - generic [ref=e144]:
                - generic [ref=e145]: Până la data inclusiv
                - textbox "Până la data inclusiv" [ref=e146]
              - button "Pregătește PDF" [ref=e147] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from './gate-fixtures.mjs';
  2  | import { appendFileSync } from 'node:fs';
  3  | import path from 'node:path';
  4  | import { createRequire } from 'node:module';
  5  | import { localeFixture } from './locale-fixtures.mjs';
  6  | import { reportFixture, reportId } from './report-journey-fixtures.mjs';
  7  | const require = createRequire(new URL('../../manager-web/package.json', import.meta.url));
  8  | const AxeBuilder = require('@axe-core/playwright').default;
  9  | const homework = '20000000-0000-4000-8000-000000000001';
  10 | async function setup({ request, context }, locale, extra={}) {
  11 |   await request.post('/__fixture/reset',{data:{...localeFixture(),subscriptionScenario:'ready',...extra}});
  12 |   await context.addCookies((await request.storageState()).cookies);
  13 |   await context.addInitScript(lang=>globalThis.localStorage.setItem('k8k.locale',lang),locale);
  14 | }
  15 | async function audit(page,locale,state) {
  16 |   const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
  17 |   const failures=axe.violations.map(({id,nodes})=>({id,targets:nodes.map(n=>n.target)}));
  18 |   appendFileSync(path.join(process.env.K8K_STUDENT_GATE_OUTPUT,'axe.jsonl'),JSON.stringify({taskId:'TASK-035',route:new URL(page.url()).pathname,locale,state,width:360,failures})+'\n');
  19 |   await page.screenshot({path:path.join(process.env.K8K_STUDENT_GATE_OUTPUT,'states',locale+'-'+state+'.png'),animations:'disabled'});
  20 |   expect(failures).toEqual([]);
  21 | }
  22 | for(const locale of ['ru','ro']) for(const state of ['loading','empty','ready','error','stale','forbidden','subscription-limited','session-expired','pending','unknown-result']) {
  23 |   test(`TASK-035 composed-state accessibility ${locale} ${state}`,async({page,request,context})=>{
  24 |     test.setTimeout(45_000);await page.setViewportSize({width:360,height:900});
  25 |     const extra=state==='loading'?{subjectDelay:20000}:state==='empty'?{subjectEmpty:true}:state==='error'?{subjectError:503}:state==='forbidden'?{subjectError:403}:state==='subscription-limited'?{subscriptionScenario:'partial'}:state==='unknown-result'?{loseSubmitResponse:true}:{};
  26 |     await setup({request,context},locale,extra);
  27 |     let release,finished,started=false;
  28 |     const wait=new Promise(resolve=>{release=resolve;});const done=new Promise(resolve=>{finished=resolve;});
  29 |     if(state==='pending')await page.route('**/api/v1/student/homework/*/submit',async route=>{started=true;await wait;await route.continue();finished();});
  30 |     try {
  31 |       if(state==='pending'||state==='unknown-result') {
  32 |         await page.goto('/student/homework/'+homework+'?ui.k8k=1');
  33 |         await page.locator('.k8k-homework-answer textarea').fill('Синтетический ответ');
  34 |         await page.locator('.k8k-homework-submit').click();
  35 |         if(state==='pending')await expect.poll(()=>started).toBe(true);
  36 |         else await expect(page.getByText(locale==='ro'?/Rezultatul trimiterii este încă necunoscut/:/Результат отправки пока неизвестен/)).toBeVisible();
  37 |         await expect(page.locator('.k8k-homework-answer textarea')).toBeDisabled();
  38 |       } else {
  39 |         await page.goto('/student/subjects?ui.k8k=1');
  40 |         await expect(page.getByRole('heading',{level:1})).toBeVisible();
  41 |         if(state==='stale'||state==='session-expired') {
  42 |           await expect(page.locator('.k8k-subject-grid')).toBeVisible();
  43 |           await request.patch('/__fixture/state',{data:state==='stale'?{subjectError:503}:{auth:false}});
  44 |           await page.evaluate(()=>globalThis.dispatchEvent(new Event('online')));
  45 |         }
  46 |         if(state==='session-expired')await expect(page).toHaveURL(/\/student\/login$/);
  47 |         else if(state==='subscription-limited')await expect(page.locator('.k8k-subject-grid')).toBeVisible();
  48 |         else await expect(page.locator(`.k8k-state[data-state=${state}]`)).toBeVisible();
  49 |       }
  50 |       await audit(page,locale,state);
  51 |     } finally {release();if(started)await done;}
  52 |   });
  53 | }
  54 | for(const locale of ['ru','ro']) test(`TASK-035 actual third-page report link ${locale}`,async({page,request,context})=>{
  55 |   const original=reportFixture().reportRows;
  56 |   const rows=Array.from({length:55},(_,index)=>({...original[index%original.length],reportId:reportId(index+1),subjectName:index===44?'Отчёт с третьей страницы':'Предмет '+(index+1)}));
  57 |   await setup({request,context},locale,{reportRows:rows});
  58 |   await page.goto('/student/reports?page=3&ui.k8k=1');
> 59 |   await expect(page.locator('.k8k-report-summary')).toHaveCount(15);
     |                                                     ^ Error: expect(locator).toHaveCount(expected) failed
  60 |   await page.locator('a[href*="reportId='+reportId(45)+'"]').click();
  61 |   await expect(page.getByRole('heading',{name:'Отчёт с третьей страницы',exact:true})).toBeFocused();
  62 |   expect(new URL(page.url()).searchParams.get('page')).toBe('3');
  63 |   await page.locator('.k8k-reports-page > a[href^="/student/reports?"]').click();
  64 |   await expect(page.locator('.k8k-report-summary')).toHaveCount(15);
  65 |   expect(new URL(page.url()).searchParams.get('page')).toBe('3');
  66 | });
  67 | 
```
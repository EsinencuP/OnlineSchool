// Real app bundles; loopback synthetic API only. No .env, DB or live provider.
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {extname} from 'node:path';
import assert from 'node:assert/strict';
import {startFixture} from '../../apps/student-cabinet/tests/fixture-server.mjs';
import {me as managerMe} from '../../apps/manager-web/src/test/fixtures.ts';
const require=createRequire(new URL('../../apps/manager-web/package.json',import.meta.url));
const {build}=await import(pathToFileURL(require.resolve('vite')));
const {chromium,expect}=require('@playwright/test');
const AxeBuilder=require('@axe-core/playwright').default;
const root=new URL('../../',import.meta.url),stage=process.argv.includes('--after')?'after':'before';
const output=new URL(stage+'/',import.meta.url);await mkdir(output,{recursive:true});
const alias=[['@online-school/ui/style.css','packages/ui/src/style.css'],['@online-school/account-ui/style.css','packages/account-ui/src/style.css'],['@online-school/ui','packages/ui/src/index.ts'],['@online-school/account-ui','packages/account-ui/src/index.tsx']].map(([find,path])=>({find,replacement:fileURLToPath(new URL(path,root))}));
const apps={};
for(const name of ['student-cabinet','manager-web','platform']) {
  const result=await build({root:fileURLToPath(new URL('apps/'+name+'/',root)),envDir:false,publicDir:false,logLevel:'error',resolve:{alias},build:{write:false}});
  apps[name]=new Map(result.output.map(item=>[item.fileName,Buffer.from(item.type==='chunk'?item.code:item.source)]));
}
const server=startFixture(4197),origin='http://127.0.0.1:4197';
const browser=await chromium.launch(),records=[],errors=[],unknown=[],checks=[];
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.woff2':'font/woff2'};
try {
  for(const role of ['STUDENT','MANAGER','TEACHER','DIRECTOR','TECH_OPERATOR','LOGIN']) {
    const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
    await context.addInitScript(()=>localStorage.setItem('k8k.locale','ru'));
    if(role==='STUDENT')await context.request.post(origin+'/__fixture/reset',{data:{displayName:'София Пример',active:true}});
    const app=role==='STUDENT'?'student-cabinet':role==='MANAGER'?'manager-web':'platform';
    const actor={accountId:'10000000-0000-4000-8000-000000000001',role,staffProfileId:role==='DIRECTOR'?'20000000-0000-4000-8000-000000000001':null,teacherProfileId:role==='TEACHER'?'30000000-0000-4000-8000-000000000001':null,displayName:'Пример '+role,timezone:'Europe/Chisinau',timezoneSource:'SCHOOL_CONFIGURATION',asOf:new Date().toISOString(),accountUpdatedAt:null,profileUpdatedAt:null};
    const coverage=(returned)=>({scope:role==='TEACHER'?'OWN_TEACHER':'SCHOOL',windowFrom:null,windowTo:null,sourceUpdatedAt:null,pageInfo:{returned,limit:100,hasMore:false,total:returned}});
    const workspace={name:actor.displayName,role,actorContext:actor,lessons:[{id:'40000000-0000-4000-8000-000000000001',startsAt:new Date().toISOString(),endsAt:new Date(Date.now()+3600000).toISOString(),status:'SCHEDULED',subject:'Математика',student:'Анна Пример',teacher:'Преподаватель Пример',meetUrl:null}],students:[],homework:[],tasks:[],coverage:{lessons:coverage(1),students:coverage(0),homework:coverage(0),tasks:coverage(0)}};
    await context.route('**/*',async route=>{
      const url=new URL(route.request().url()),path=url.pathname;
      if(url.origin!==origin)return route.abort();
      if(path.startsWith('/api/')) {
        if(role==='STUDENT')return route.continue();
        if(path==='/api/v1/platform/accounts')return route.fulfill({json:{enabled:false,currentKey:null,items:[]}});
        if(path==='/api/v1/auth/session')return role==='LOGIN'?route.fulfill({status:401,json:{code:'UNAUTHENTICATED'}}):route.fulfill({json:{account:{id:actor.accountId,kind:role==='TEACHER'?'TEACHER':'STAFF',roles:[role]},mfa_completed:true,password_only:false,recovery_only:false,expires_at:'2027-01-01T12:00:00Z'}});
        if(path==='/api/v1/manager/me')return route.fulfill({json:managerMe});
        if(path==='/api/v1/manager/dashboard')return route.fulfill({json:{generatedAt:new Date().toISOString(),students:{active:0,frozen:0,leads:0},pendingPayments:{count:0,totalsByCurrency:[]},upcomingLessons:[],overdueTasks:{count:0,top:[]},expiringSubscriptions:[],leads:{countsByStage:{NEW:0,IN_PROGRESS:0,TRIAL:0,AWAITING_PAYMENT:0},createdToday:0,trialsToday:0,awaitingPayment:0,overdue:0}}});
        if(path==='/api/v1/platform/workspace')return route.fulfill({json:workspace});
        if(path==='/api/v1/qa/components')return route.fulfill({json:{api:'ok',db:'ok',worker:'ok'}});
        unknown.push({role,path});return route.fulfill({status:503,json:{code:'FIXTURE_MISSING'}});
      }
      const key=path.replace(/^\/(student|manager)\//,'').replace(/^\//,'');
      const assets=apps[app],asset=assets.get(key)||(!extname(path)?assets.get('index.html'):null);
      if(asset)return route.fulfill({body:asset,contentType:mime[extname(key)]||'text/html'});
      if(path==='/favicon.ico')return route.fulfill({status:204});
      unknown.push({role,path});return route.abort();
    });
    const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push({role,message:error.message}));
    const path=role==='LOGIN'?'/':role==='TECH_OPERATOR'?'/operator':role==='MANAGER'?'/manager':'/'+role.toLowerCase();
    await page.goto(origin+path+'?ui.k8k=1');
    await expect(page.getByRole('heading').first()).toBeVisible();
    if(role==='STUDENT')await expect(page.getByRole('heading',{name:/Привет/})).toBeVisible();
    else if(role!=='LOGIN')await expect(page.locator('.k8k-main')).toBeVisible();
    await page.evaluate(()=>document.fonts.ready);
    for(const width of stage==='before'?[360,1280]:[360,768,1024,1280]) {
      await page.setViewportSize({width,height:900});await page.evaluate(()=>{document.activeElement?.blur();return document.fonts.ready;});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),role+' overflow '+width);
      const file=role.toLowerCase()+'-'+width+'.png';await page.screenshot({path:fileURLToPath(new URL(file,output)),animations:'disabled'});
      const record={role,width,file};
      if(stage==='after') {
        assert.equal(await page.locator('.eyebrow,.k8k-sidebar-label,.k8k-stage-number').count(),0,role+' decorative label');
        if(width===360){const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();record.violations=result.violations.map(({id,nodes})=>({id,targets:nodes.map(({target})=>target)}));}
        const status=page.locator('.k8k-status-chip,.k8k-student-status').first();
        if(await status.count())assert.equal(await status.evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
        const focusable=page.locator('button,a,input,select').filter({visible:true}).first();await focusable.focus();await expect(focusable).toBeFocused();
      }
      records.push(record);
    }

    if(stage==='after') {
      if(role==='MANAGER') {const selected=page.locator('.panel-tabs .selected').first();assert((await selected.evaluate(el=>getComputedStyle(el).textDecorationLine)).includes('underline'));checks.push({role,check:'selected task filter remains visible without pill',pass:true});}
      if(role!=='LOGIN') {
        await page.setViewportSize({width:360,height:900});await page.evaluate(()=>document.activeElement?.blur());
        const trigger=page.locator('.k8k-menu-button');await trigger.click();
        await expect(trigger).toHaveAttribute('aria-expanded','true');
        await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
        await expect(trigger).toHaveAttribute('aria-expanded','false');
        checks.push({role,check:'mobile navigation / Escape / focus return',pass:true});
        await page.locator('.account-menu > summary').click();
      }
      const language=page.locator('.k8k-language select').filter({visible:true}).first();
      await language.selectOption('ro');await expect(language).toHaveValue('ro');
      if(role!=='LOGIN')await page.keyboard.press('Escape');
      await page.setViewportSize({width:1280,height:900});
      await page.evaluate(()=>{document.activeElement?.blur();return document.fonts.ready;});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),role+' RO overflow');
      const roFile=role.toLowerCase()+'-ro-1280.png';await page.screenshot({path:fileURLToPath(new URL(roFile,output)),animations:'disabled'});
      records.push({role,locale:'ro',width:1280,file:roFile});checks.push({role,check:'RU/RO selector',pass:true});
      if(role==='LOGIN') {
        await language.selectOption('ru');await page.locator('input[type=email]').fill('invalid');
        await page.locator('input[type=password]').fill('synthetic-form-check');
        await page.locator('button[type=submit]').click();
        await expect(page.getByRole('alert')).toBeVisible();await expect(page.locator('input[type=email]')).toBeFocused();
        checks.push({role,check:'email validation stays local and returns focus',pass:true});
      }
      if(role==='LOGIN'||role==='STUDENT') {
        await page.goto(origin+path+'?ui.k8k=0');
        await expect(page.getByRole('heading').first()).toBeVisible();
        assert.equal(await page.evaluate(()=>document.documentElement.hasAttribute('data-k8k')),false);
        for(const width of [360,1280]) {
          await page.setViewportSize({width,height:900});await page.evaluate(()=>document.fonts.ready);
          assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),role+' fallback overflow');
          const file=role.toLowerCase()+'-fallback-'+width+'.png';await page.screenshot({path:fileURLToPath(new URL(file,output)),animations:'disabled'});
          records.push({role,flag:0,width,file});
        }
        checks.push({role,check:'flag-off presentation and viewport containment',pass:true});
      }
    }
    await context.close();
  }
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
await writeFile(new URL('visual-'+stage+'.json',import.meta.url),JSON.stringify({stage,records,checks,errors,unknown},null,2)+'\n');
assert.deepEqual(errors,[]);assert.deepEqual(unknown,[]);if(stage==='after')assert(records.every(record=>!record.violations?.length),'Axe violations; see visual-after.json');
console.log({stage,screenshots:records.length,errors:errors.length,unknown:unknown.length});

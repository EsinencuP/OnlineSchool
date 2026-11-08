import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const folder='output/k8k-tasks/TASK-033/',pack='output/k8k-taskpack/task-033/';
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const screenshots=readdirSync(folder+'after').filter(name=>name.endsWith('.png')).sort().map(name=>{
  const bytes=readFileSync(folder+'after/'+name);
  const matrix=/^(ru|ro)-(360|768|1024|1280)-(page1|page2|empty-page)\.png$/.test(name);
  return {path:'after/'+name,role:'STUDENT',locale:name.slice(0,2),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),
    view:name.replace(/^(ru|ro)-(?:\d+-)?/,'').replace(/\.png$/,''),matrix,
    route:name.includes('short-keyboard')?'/student?subjectId=73000000-0000-4000-8000-000000000020&ui.k8k=1&events=1':'/student?events=1&view=list&ui.k8k=1',
    fixture:matrix&&name.includes('empty-page')?'synthetic feed shrunk to5; page2 empty, total5/unread5':
      name.includes('unknown')?'synthetic read-all committed, arrival13, lost503 response; before reconciliation':
      name.includes('empty-feed')?'synthetic feed empty, total0/unread0':
      name.includes('forbidden')?'synthetic count403 and held preview response':
      name.includes('stale')?'synthetic preview503/count503 with previous successful rows':
      'synthetic12 notifications/6 existing types, global7; synthetic35 published reports, no live source/provider',
    sha256:createHash('sha256').update(bytes).digest('hex')};
});
assert.equal(screenshots.length,29);
assert.equal(screenshots.filter(item=>item.matrix).length,24);
for(const locale of ['ru','ro'])for(const width of [360,768,1024,1280])for(const view of ['page1','page2','empty-page'])
  assert(screenshots.some(item=>item.path===`after/${locale}-${width}-${view}.png`&&item.width===width));
save(folder+'screenshots.json',{task:'TASK-033',screenshots});
const budgets=json(folder+'budgets.json');assert.equal(budgets.rows.length,50);assert(budgets.rows.every(row=>row.pass));
const browser=json(folder+'playwright.json');assert.equal(browser.stats.expected,13);assert.equal(browser.stats.unexpected,0);assert.equal(browser.stats.skipped,0);
for(const locale of ['ru','ro'])assert.deepEqual(json(folder+'axe-'+locale+'.json').violations,[]);
for(const file of ['contracts.json','preservation.json','changes.json'])assert.equal(json(folder+file).status,'PASS');
const acceptance=json(pack+'acceptance.json');assert(acceptance.checks.every(item=>['PASS','NOT_RUN'].includes(item.status)));
assert(acceptance.checks.every(item=>item.passed===(item.status==='PASS'?true:null)));
const report=readFileSync(folder+'report.md','utf8');
writeFileSync(pack+'report.md',report.replace(/\]\(([^)]+)\)/g,(full,link)=>/^https?:/.test(link)?full:']('+(link.startsWith('../../k8k-taskpack/task-033/')?link.slice('../../k8k-taskpack/task-033/'.length):'../../k8k-tasks/TASK-033/'+link)+')'));
save(folder+'artifacts-check.json',{status:'CHECKING'});
const links=[];
for(const path of [folder+'report.md',folder+'handoff.md',pack+'report.md'])for(const match of readFileSync(path,'utf8').matchAll(/\]\(([^)]+)\)/g)){
  if(/^https?:/.test(match[1]))continue;
  links.push({from:path,link:match[1],exists:existsSync(resolve(dirname(path),match[1].split('#')[0]))});
}
for(const check of acceptance.checks)links.push({from:pack+'acceptance.json',link:check.evidence,exists:existsSync(resolve(pack,check.evidence))});
assert(links.every(item=>item.exists),JSON.stringify(links.filter(item=>!item.exists)));
save(folder+'artifacts-check.json',{status:'PASS',screenshots:29,matrixScreenshots:24,browserTests:13,budgetsPassed:50,
  studentRouteBytes:budgets.rows.find(row=>row.route==='/student').total,maxRouteBytes:Math.max(...budgets.rows.map(row=>row.total)),
  acceptance:{pass:acceptance.checks.filter(item=>item.status==='PASS').length,notRun:acceptance.checks.filter(item=>item.status==='NOT_RUN').length},links});
console.log({status:'PASS',screenshots:29,browserTests:13,budgets:50,links:links.length});

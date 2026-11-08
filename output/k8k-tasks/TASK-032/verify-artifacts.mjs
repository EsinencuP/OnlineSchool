import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const folder='output/k8k-tasks/TASK-032/',pack='output/k8k-taskpack/task-032/';
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const screenshots=readdirSync(folder+'after').filter(name=>name.endsWith('.png')).sort().map(name=>{
  const bytes=readFileSync(folder+'after/'+name),view=name.replace(/\.png$/,'').split('-').at(-1);
  return {path:'after/'+name,role:'STUDENT',locale:name.slice(0,2),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),view,
    route:view==='list'?'/student/reports?page=3&ui.k8k=1':['detail','form','queued','ready'].includes(view)?'/student/reports?reportId=80000000-0000-4000-8000-000000000025&page=3&ui.k8k=1':'/student/reports?ui.k8k=1',
    fixture:'synthetic35 published reports; original-request replay and private job fixtures; dynamic job/request UUID omitted here; no live DB/provider',sha256:createHash('sha256').update(bytes).digest('hex')};
});
assert.equal(screenshots.length,43);
assert.equal(screenshots.filter(item=>/\d+-(list|detail|form|queued|ready)\.png$/.test(item.path)).length,40);
save(folder+'screenshots.json',{task:'TASK-032',screenshots});
const budgets=json(folder+'budgets.json');assert.equal(budgets.rows.length,50);assert(budgets.rows.every(row=>row.pass));
const browser=json(folder+'playwright.json');assert.equal(browser.stats.expected,14);assert.equal(browser.stats.unexpected,0);assert.equal(browser.stats.skipped,0);
const acceptance=json(pack+'acceptance.json');assert(acceptance.checks.every(item=>['PASS','NOT_RUN'].includes(item.status)));
assert.equal(json(folder+'contracts.json').status,'PASS');assert.equal(json(folder+'preservation.json').status,'PASS');
const report=readFileSync(folder+'report.md','utf8');
writeFileSync(pack+'report.md',report.replace(/\]\(([^)]+)\)/g,(full,link)=>/^https?:/.test(link)?full:']('+(link.startsWith('../../k8k-taskpack/task-032/')?link.slice('../../k8k-taskpack/task-032/'.length):'../../k8k-tasks/TASK-032/'+link)+')'));
save(folder+'artifacts-check.json',{status:'CHECKING'});
const links=[];
for(const path of [folder+'report.md',folder+'handoff.md',pack+'report.md'])for(const match of readFileSync(path,'utf8').matchAll(/\]\(([^)]+)\)/g)){
  if(/^https?:/.test(match[1]))continue;
  links.push({from:path,link:match[1],exists:existsSync(resolve(dirname(path),match[1].split('#')[0]))});
}
for(const check of acceptance.checks)links.push({from:pack+'acceptance.json',link:check.evidence,exists:existsSync(resolve(pack,check.evidence))});
assert(links.every(item=>item.exists));
save(folder+'artifacts-check.json',{status:'PASS',screenshots:43,matrixScreenshots:40,browserTests:14,budgetsPassed:50,
  reportsRouteBytes:budgets.rows.find(row=>row.route==='/student/reports').total,maxRouteBytes:Math.max(...budgets.rows.map(row=>row.total)),
  acceptance:{pass:acceptance.checks.filter(item=>item.status==='PASS').length,notRun:acceptance.checks.filter(item=>item.status==='NOT_RUN').length},links});
console.log({status:'PASS',screenshots:43,browserTests:14,budgets:50,links:links.length});

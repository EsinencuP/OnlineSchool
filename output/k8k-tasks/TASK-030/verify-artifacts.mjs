import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const folder = 'output/k8k-tasks/TASK-030/';
const pack = 'output/k8k-taskpack/task-030/';
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
const save = (path, data) => writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
const screenshots = readdirSync(folder + 'after').filter((name) => name.endsWith('.png')).sort().map((name) => {
  const bytes = readFileSync(folder + 'after/' + name);
  return {path:'after/' + name, role:'STUDENT', locale:name.slice(0,2), width:bytes.readUInt32BE(16), height:bytes.readUInt32BE(20),
    view:name.replace(/\.png$/, '').split('-').slice(2).join('-'),
    route:name.endsWith('-list.png')?'/student/homework?status=NEEDS_REVISION&page=1&ui.k8k=1':'/student/homework/20000000-0000-4000-8000-000000000001?ui.k8k=1',
    fixture:'synthetic local fixture; no live provider',sha256:createHash('sha256').update(bytes).digest('hex')};
});
assert.equal(screenshots.length, 26);
assert.equal(screenshots.filter((item)=>/\d+-(list|editor|history)\.png$/.test(item.path)).length,24);
save(folder+'screenshots.json', {task:'TASK-030',screenshots});
const budgets=json(folder+'budgets.json');
assert.equal(budgets.rows.length,50);
assert(budgets.rows.every((item)=>item.pass));
const browser=json(folder+'playwright.json');
assert.equal(browser.stats.expected,16);
assert.equal(browser.stats.unexpected,0);
assert.equal(browser.stats.skipped,0);
const acceptance=json(pack+'acceptance.json');
assert(acceptance.checks.every((item)=>['PASS','NOT_RUN'].includes(item.status)));
assert.equal(json(folder+'preservation.json').status,'PASS');
assert.equal(json(folder+'contracts.json').status,'PASS');
const report=readFileSync(folder+'report.md','utf8');
writeFileSync(pack+'report.md', report.replace(/\]\(([^)]+)\)/g,(full,link)=>
  ']('+(link.startsWith('../../k8k-taskpack/task-030/')?link.slice('../../k8k-taskpack/task-030/'.length):'../../k8k-tasks/TASK-030/'+link)+')'));
save(folder+'artifacts-check.json',{status:'CHECKING'});
const links=[];
for(const path of [folder+'report.md',folder+'handoff.md',pack+'report.md']) {
  for(const match of readFileSync(path,'utf8').matchAll(/\]\(([^)]+)\)/g)) {
    const target=resolve(dirname(path),match[1].split('#')[0]);
    links.push({from:path,link:match[1],exists:existsSync(target)});
  }
}
for(const check of acceptance.checks) links.push({from:pack+'acceptance.json',link:check.evidence,exists:existsSync(resolve(pack,check.evidence))});
assert(links.every((item)=>item.exists));
save(folder+'artifacts-check.json',{status:'PASS',screenshots:26,matrixScreenshots:24,browserTests:16,budgetsPassed:50,
  studentHomeworkBytes:budgets.rows.find((item)=>item.route==='/student/homework').total,
  maxRouteBytes:Math.max(...budgets.rows.map((item)=>item.total)),
  acceptance:{pass:acceptance.checks.filter((item)=>item.status==='PASS').length,notRun:acceptance.checks.filter((item)=>item.status==='NOT_RUN').length},links});
console.log({status:'PASS',screenshots:26,browserTests:16,budgets:50,links:links.length});

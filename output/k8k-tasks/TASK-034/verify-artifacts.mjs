import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const folder='output/k8k-tasks/TASK-034/',pack='output/k8k-taskpack/task-034/';
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const views=['materials','profile','security','login','security-change-password','suspended'];
const screenshots=readdirSync(folder+'after').filter(name=>name.endsWith('.png')).sort().map(name=>{
  const bytes=readFileSync(folder+'after/'+name),match=/^(ru|ro)-(360|768|1024|1280)-(.+)\.png$/.exec(name);
  const matrix=!!match&&views.includes(match[3]),zoom=name.includes('zoom200');
  const route=matrix?match[3].replace('security-change-password','security/change-password'):
    name.includes('profile')||name.includes('alias')?'profile':name.includes('material')?'materials':
    name.includes('logout')?'suspended':name.includes('temporary')||name.includes('storage')?'login':'security';
  return {path:'after/'+name,role:'STUDENT',locale:name.slice(0,2),width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),
    cssViewport:zoom?{width:640,height:500}: {width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)},deviceScaleFactor:zoom?2:1,
    zoomEquivalent:zoom?'200% at1280x1000 device output; responsive CSS640x500, DPR2':null,matrix,
    route:'/student/'+route+'?ui.k8k=1',view:name.replace(/^(ru|ro)-(?:\d+-)?/,'').replace(/\.png$/,''),
    fixture:'synthetic35 explicit material grants/2 sessions; authored names and contextless labels; no live DB/S3/OTP/email; secret inputs cleared or masked',
    sha256:createHash('sha256').update(bytes).digest('hex')};
});
assert.equal(screenshots.length,65);assert.equal(screenshots.filter(item=>item.matrix).length,48);
for(const locale of ['ru','ro'])for(const width of [360,768,1024,1280])for(const view of views)
  assert(screenshots.some(item=>item.path===`after/${locale}-${width}-${view}.png`&&item.width===width));
assert(screenshots.filter(item=>item.zoomEquivalent).every(item=>item.width===1280&&item.height===1000));
save(folder+'screenshots.json',{task:'TASK-034',screenshots});
const browser=json(folder+'playwright.json');assert.equal(browser.stats.expected,19);assert.equal(browser.stats.unexpected,0);assert.equal(browser.stats.skipped,0);
const budgets=json(folder+'budgets.json');assert.equal(budgets.rows.length,50);assert(budgets.rows.every(row=>row.pass));
const previous=json('output/k8k-tasks/TASK-033/budgets.json');
// SHARED account-menu row uses the student bundle; classify bundles by app, not role label.
const staff=budgets.rows.filter(row=>row.app!=='student-cabinet');
assert(staff.every(row=>row.total===previous.rows.find(old=>old.role===row.role&&old.route===row.route).total));
let scans=0;for(const locale of ['ru','ro'])for(const item of json(folder+'axe-'+locale+'.json')){assert.deepEqual(item.violations,[]);scans++;}assert.equal(scans,10);
for(const file of ['contracts.json','preservation.json','changes.json'])assert.equal(json(folder+file).status,'PASS');
const acceptance=json(pack+'acceptance.json');assert(acceptance.checks.every(item=>['PASS','NOT_RUN'].includes(item.status)));
assert(acceptance.checks.every(item=>item.passed===(item.status==='PASS'?true:null)));
const report=readFileSync(folder+'report.md','utf8');
writeFileSync(pack+'report.md',report.replace(/\]\(([^)]+)\)/g,(full,link)=>/^https?:/.test(link)?full:']('+(link.startsWith('../../k8k-taskpack/task-034/')?link.slice('../../k8k-taskpack/task-034/'.length):'../../k8k-tasks/TASK-034/'+link)+')'));
save(folder+'artifacts-check.json',{status:'CHECKING'});
const links=[];
for(const path of [folder+'report.md',folder+'handoff.md',folder+'coverage.md',pack+'report.md'])for(const match of readFileSync(path,'utf8').matchAll(/\]\(([^)]+)\)/g)){
  if(/^https?:/.test(match[1]))continue;
  links.push({from:path,link:match[1],exists:existsSync(resolve(dirname(path),match[1].split('#')[0]))});
}
for(const check of acceptance.checks)links.push({from:pack+'acceptance.json',link:check.evidence,exists:existsSync(resolve(pack,check.evidence))});
assert(links.every(item=>item.exists),JSON.stringify(links.filter(item=>!item.exists)));
save(folder+'artifacts-check.json',{status:'PASS',screenshots:65,matrix:48,browser:19,axeScans:10,violations:0,budgets:50,
  studentBytes:budgets.rows.find(row=>row.route==='/student').total,maxBytes:Math.max(...budgets.rows.map(row=>row.total)),staffTotals:'unchanged',
  acceptance:{pass:acceptance.checks.filter(item=>item.status==='PASS').length,notRun:acceptance.checks.filter(item=>item.status==='NOT_RUN').length},links});
console.log({status:'PASS',screenshots:65,browser:19,scans,budgets:50,links:links.length});

import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const folder='output/k8k-tasks/TASK-033/';
const before=JSON.parse(readFileSync(folder+'before.json'));
const added=['apps/api/src/student/notifications/notification-locale.ts','apps/student-cabinet/src/notification-copy.ts',
  'apps/student-cabinet/tests/bell.spec.mjs','apps/student-cabinet/tests/bell-fixtures.mjs','apps/student-cabinet/playwright.bell.config.mjs'];
writeFileSync(folder+'empty-baseline.txt','');
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const rows=[...before.paths.map(({path,sha256})=>({path,before:sha256,baseline:folder+'before/'+path})),
  ...added.map(path=>({path,before:null,baseline:folder+'empty-baseline.txt'}))].map(item=>{
    const result=spawnSync('git',['-c','core.autocrlf=false','diff','--no-index','--check','--',item.baseline,item.path],{encoding:'utf8'});
    assert([0,1].includes(result.status),item.path+' '+result.stderr);
    assert.equal(result.stdout,'',item.path+' whitespace: '+result.stdout);
    assert.equal(result.stderr,'',item.path+' '+result.stderr);
    return {path:item.path,before:item.before,after:sha(item.path),changed:sha(item.path)!==item.before,whitespace:'PASS'};
  });
writeFileSync(folder+'changes.json',JSON.stringify({status:'PASS',basis:'task snapshots, not the whole pre-existing dirty diff',rows},null,2)+'\n');
console.log({status:'PASS',checked:rows.length,changed:rows.filter(row=>row.changed).length});

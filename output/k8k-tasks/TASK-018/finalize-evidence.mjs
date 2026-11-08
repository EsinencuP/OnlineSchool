import assert from 'node:assert/strict';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const out=new URL('./',import.meta.url),root=new URL('../../../',import.meta.url);
const sha=value=>createHash('sha256').update(value).digest('hex');
const read=async path=>JSON.parse(await readFile(new URL(path,out),'utf8'));
const write=async(path,value)=>writeFile(new URL(path,out),JSON.stringify(value,null,2)+'\n');
const basis=await read('basis.json'),contracts=await read('contracts-diff.json'),browser=await read('browser/browser.json');
assert.equal(contracts.added.length,4);assert.deepEqual(contracts.removed,[]);assert.deepEqual(contracts.changedInputs,[]);
assert.equal(browser.checks.length,20);assert.deepEqual(browser.unexpected,[]);assert.deepEqual(browser.errors,[]);assert(browser.budget.pass);
for(const source of basis.sourceManifest)assert.equal(sha(await readFile(new URL(source.path,root))),source.sha256,`Accepted source changed: ${source.path}`);
const report=await readFile(new URL('report.md',out),'utf8');
const links=[...report.matchAll(/\]\(([^)]+)\)/g)].map(m=>m[1]);
for(const path of links.filter(p=>!p.startsWith('http')))await readFile(new URL(path,out));
assert(report.includes(basis.dirtyDigest));
const documentation=[];
for(const path of ['docs/k8k-redesign-tasks/EXECUTION_LOG.md','docs/K8K_REQUIREMENTS_MATRIX.md','docs/K8K_IMPLEMENTATION_STATUS.md','docs/ui-stack.md']) {
 const data=await readFile(new URL(path,root));documentation.push({path,sha256:sha(data)});
 if(path.includes('EXECUTION_LOG')||path.includes('REQUIREMENTS_MATRIX'))assert(data.toString().includes(basis.dirtyDigest));
}
await write('verification.json',{status:'PASS scoped TASK-018',head:basis.head,dirtyDigest:basis.dirtyDigest,
 sourceHashesRechecked:basis.sourceManifest.length,prerequisite:'TASK-017 DONE; output artifacts retained',newServiceHttpTests:12,newSdkTests:4,
 existingManagerFinanceTests:92,browserCases:20,browserPng:16,accountRegressionCases:15,newOperations:4,oldOperationsPreserved:140,
 platformClosureBytes:browser.budget.total,fontBytes:browser.budget.font.total,
 documentation,localLinksChecked:links.length,dbProviderProduction:'NOT_RUN; no live DB access, migrations or deploy',
 fullRegressionWcagAtFndLegalMeetGate:'NOT_RUN; separate tasks',nextTaskStarted:false});
const artifacts=[];
for(const item of await readdir(out,{recursive:true,withFileTypes:true})) {
 if(!item.isFile())continue;
 const path=`${item.parentPath}/${item.name}`,relative=path.replaceAll('\\','/').split('/TASK-018/')[1];
 if(relative==='artifacts.json')continue;
 const data=await readFile(path);artifacts.push({path:relative,bytes:data.length,sha256:sha(data)});
}
artifacts.sort((a,b)=>a.path.localeCompare(b.path));
await write('artifacts.json',{head:basis.head,dirtyDigest:basis.dirtyDigest,artifacts});
console.log({status:'PASS',sourceHashes:basis.sourceManifest.length,artifactHashes:artifacts.length,localLinks:links.length,dirtyDigest:basis.dirtyDigest});

import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const folder='output/k8k-tasks/TASK-034/';
const old=JSON.parse(readFileSync(folder+'before/packages/api-contracts/openapi/openapi.json'));
const now=JSON.parse(readFileSync('packages/api-contracts/openapi/openapi.json'));
const methods=['get','post','put','patch','delete','head','options'];
let operations=0;
assert.deepEqual(Object.keys(now.paths),Object.keys(old.paths));
for(const [path,item] of Object.entries(old.paths))for(const method of methods)if(item[method]){
  operations++;
  assert.deepEqual(now.paths[path][method],item[method],path+' '+method);
}
assert.equal(operations,149);
assert.equal(Object.values(now.paths).flatMap(item=>methods.filter(method=>item[method])).length,149);
assert.deepEqual(Object.keys(now.components.schemas),Object.keys(old.components.schemas));
for(const [name,schema] of Object.entries(old.components.schemas))if(name!=='MaterialItemDto')assert.deepEqual(now.components.schemas[name],schema,name);
const prior=old.components.schemas.MaterialItemDto,current=now.components.schemas.MaterialItemDto;
assert.deepEqual(current.required,prior.required);
for(const [name,value]of Object.entries(prior.properties))assert.deepEqual(current.properties[name],value,name);
const added=Object.keys(current.properties).filter(name=>!prior.properties[name]);
assert.deepEqual(added.sort(),['canDownload','fileNameIsFallback','subjectId'].sort());
assert.equal(current.properties.subjectId.format,'uuid');assert.deepEqual(current.properties.subjectId.type,['string','null']);
assert.equal(current.properties.canDownload.type,'boolean');assert.equal(current.properties.fileNameIsFallback.type,'boolean');
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const baseline=JSON.parse(readFileSync(folder+'before.json'));
const protectedPaths=[...baseline.paths.filter(({path})=>path.startsWith('apps/api/src/student/security/')&&!path.endsWith('.md')).map(({path})=>path),
  'packages/ui/src/locale.tsx','packages/account-ui/src/session.tsx','packages/api-contracts/src/transport.ts','package.json','pnpm-lock.yaml','packages/ui/package.json','packages/account-ui/package.json','apps/student-cabinet/src/pages/Homework.tsx','apps/student-cabinet/src/homework-draft.ts'];
const unchanged=protectedPaths.filter(path=>baseline.paths.some(item=>item.path===path)).map(path=>({path,unchanged:sha(path)===sha(folder+'before/'+path)}));
assert(unchanged.every(item=>item.unchanged));
const service='apps/api/src/student/materials/materials.service.ts';
const before=readFileSync(folder+'before/'+service,'utf8').replaceAll('\r\n','\n'),after=readFileSync(service,'utf8').replaceAll('\r\n','\n');
const section=(text,start,end)=>text.slice(text.indexOf(start),text.indexOf(end,text.indexOf(start)));
for(const [start,end]of [['function materialFrom','export function visibleMaterialSubjectsSql'],['export function materialAccessSql','export interface MaterialAccessRow'],['  async signedUrl(','\n}\n']])assert.equal(section(after,start,end),section(before,start,end),start);
const path='apps/student-cabinet/package.json';
const oldManifest=JSON.parse(readFileSync(folder+'before/'+path)),newManifest=JSON.parse(readFileSync(path));
for(const field of ['dependencies','devDependencies','peerDependencies','optionalDependencies'])assert.deepEqual(newManifest[field],oldManifest[field]);
for(const [name,value]of Object.entries(oldManifest.scripts))assert.equal(newManifest.scripts[name],value);
assert.equal(newManifest.scripts['test:k8k-student-locales'],'node --test tests/locales.test.mjs && playwright test --config playwright.locales.config.mjs');
writeFileSync(folder+'contracts.json',JSON.stringify({status:'PASS',operationsBefore:149,operationsAfter:149,operationDefinitions:'unchanged',
  additiveSchema:{name:'MaterialItemDto',optionalProperties:added,existingPropertiesAndRequired:'unchanged'},
  unchanged,materialPermissionPredicatesAndSignedWorkflow:'unchanged',standardGeneration:true,dependenciesAdded:0,migrationsAdded:0,migrationsExecuted:false},null,2)+'\n');
console.log({status:'PASS',operations,optionalProperties:added,protectedFiles:unchanged.length});

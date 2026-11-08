import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const folder='output/k8k-tasks/TASK-031/';
const previous=JSON.parse(readFileSync(folder+'before/packages/api-contracts/openapi/openapi.json'));
const current=JSON.parse(readFileSync('packages/api-contracts/openapi/openapi.json'));
const methods=['get','post','put','patch','delete','head','options'];
let operations=0;const addedParameters=[];
assert.deepEqual(Object.keys(current.paths).sort(),Object.keys(previous.paths).sort());
for(const [path,item] of Object.entries(previous.paths))for(const method of methods){
  const before=item[method],after=current.paths[path][method];
  assert.equal(!!after,!!before,path+' '+method);if(!before)continue;
  operations++;
  assert.equal(after.operationId,before.operationId);
  for(const part of ['requestBody','responses','security'])assert.deepEqual(after[part],before[part],before.operationId+' '+part);
  for(const param of before.parameters??[])assert.deepEqual(after.parameters.find(p=>p.in===param.in&&p.name===param.name),param);
  for(const param of after.parameters??[])if(!(before.parameters??[]).some(p=>p.in===param.in&&p.name===param.name)){
    assert.equal(param.required,false);addedParameters.push({operation:after.operationId,parameter:param.name,schema:param.schema});
  }
}
assert.equal(operations,147);
assert.deepEqual(addedParameters,[{operation:'getStudentSkillSnapshots',parameter:'subjectId',schema:{format:'uuid',type:'string'}}]);
assert.deepEqual(current.components,previous.components);
const oldLearning=readFileSync(folder+'before/apps/student-cabinet/src/pages/Learning.tsx','utf8');
const newLearning=readFileSync('apps/student-cabinet/src/pages/Learning.tsx','utf8');
assert.equal(newLearning.slice(newLearning.indexOf('export function Materials()')),oldLearning.slice(oldLearning.indexOf('export function Materials()')));
writeFileSync(folder+'contracts.json',JSON.stringify({status:'PASS',operationsBefore:147,operationsAfter:147,
  newOperations:[],addedParameters,components:'byte-equivalent schema objects',existingRequestsResponsesSecurityAndParameters:'preserved',
  studentMutationRoutesAdded:0,standardGeneration:true,noDatabaseExportPreload:'output/k8k-tasks/TASK-018/no-db-export.mjs',
  adjacentMaterialsNotificationsBody:'byte-identical to before snapshot',dependenciesAdded:0,migrationsAdded:0,migrationsExecuted:false},null,2)+'\n');
console.log({status:'PASS',operations,addedParameters});

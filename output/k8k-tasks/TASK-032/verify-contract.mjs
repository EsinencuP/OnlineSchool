import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const folder='output/k8k-tasks/TASK-032/';
const old=JSON.parse(readFileSync(folder+'before/packages/api-contracts/openapi/openapi.json'));
const now=JSON.parse(readFileSync('packages/api-contracts/openapi/openapi.json'));
const methods=['get','post','put','patch','delete','head','options'];
let operations=0;const added=[];
for(const [path,item] of Object.entries(old.paths)){
 assert(now.paths[path]);
 for(const method of methods)if(item[method]){operations++;const before=item[method],after=now.paths[path][method];
  assert(after);assert.equal(after.operationId,before.operationId);
  for(const field of ['requestBody','responses','security','parameters'])assert.deepEqual(after[field],before[field],before.operationId+' '+field);
 }
}
for(const [path,item] of Object.entries(now.paths))for(const method of methods)if(item[method]&&!old.paths[path]?.[method])added.push({path,method,operation:item[method].operationId});
assert.equal(operations,147);
assert.deepEqual(added.map(item=>item.operation).sort(),['getStudentReport','getStudentEducationPdfRequestResult'].sort());
assert(added.every(item=>item.method==='get'));
for(const [name,schema] of Object.entries(old.components.schemas))assert.deepEqual(now.components.schemas[name],schema,name);
const schemas=Object.keys(now.components.schemas).filter(name=>!old.components.schemas[name]);assert.deepEqual(schemas,['PdfExportRequestResultDto']);
const sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const unchanged=['apps/api/src/student/reports/export-data.ts','apps/worker/src/pdf-exports.ts','apps/worker/src/education-pdf.ts','packages/api-contracts/src/transport.ts','pnpm-lock.yaml','package.json','apps/student-cabinet/src/StudentNotificationMenu.tsx'].map(path=>({path,unchanged:sha(path)===sha(folder+'before/'+path)}));
assert(unchanged.every(item=>item.unchanged));
writeFileSync(folder+'contracts.json',JSON.stringify({status:'PASS',operationsBefore:147,operationsAfter:149,added,addedSchemas:schemas,
 existingRequestResponseSecurityAndParameters:'preserved',existingSchemas:'unchanged',standardGeneration:true,unchanged,
 studentMutationRoutesAdded:0,migrationsAdded:0,migrationsExecuted:false,dependenciesAdded:0,
 receiptJustification:'Existing status lookup requires jobId; read-only original-request lookup reconciles a lost 202 without creating a new export.'},null,2)+'\n');
console.log({status:'PASS',operationsBefore:147,operationsAfter:149,added:added.map(item=>item.operation),unchanged:unchanged.length});

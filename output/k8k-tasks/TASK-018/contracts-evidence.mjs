import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root=new URL('../../../',import.meta.url),out=new URL('./',import.meta.url);
const previous=JSON.parse(await readFile(new URL('output/k8k-tasks/TASK-017/basis.json',root),'utf8'));
const git=(...a)=>execFileSync('git',['--no-optional-locks',...a],{cwd:root});
const originals={};
for(const path of ['packages/api-contracts/openapi/openapi.json','packages/api-contracts/src/generated/client.ts',
 'packages/api-contracts/src/generated/openapi.ts','packages/api-contracts/src/generated/manager-error-codes.ts']) {
 const data=git('show',`HEAD:${path}`);
 assert.equal(createHash('sha256').update(data).digest('hex'),previous.sourceManifest.find(e=>e.path===path).sha256,`HEAD is not TASK-017 original: ${path}`);
 const target=new URL('before/'+path,out);await mkdir(new URL('./',target),{recursive:true});await writeFile(target,data);originals[path]=data.toString();
}
const old=JSON.parse(originals['packages/api-contracts/openapi/openapi.json']);
const current=JSON.parse(await readFile(new URL('packages/api-contracts/openapi/openapi.json',root),'utf8'));
const added=[],removed=[],changedInputs=[];
const verbs=['get','post','patch','put','delete'];
for(const [path,methods] of Object.entries(old.paths))for(const [method,operation] of Object.entries(methods).filter(([m])=>verbs.includes(m))) {
 const next=current.paths[path]?.[method];
 if(!next) {removed.push({path,method});continue;}
 assert.equal(next.operationId,operation.operationId);
 if(JSON.stringify([operation.requestBody,operation.parameters])!==JSON.stringify([next.requestBody,next.parameters])) changedInputs.push({path,method});
}
for(const [path,methods] of Object.entries(current.paths))for(const [method,operation] of Object.entries(methods).filter(([m])=>verbs.includes(m)))
 if(!old.paths[path]?.[method])added.push({path,method,operationId:operation.operationId});
assert.equal(added.length,4);assert.deepEqual(removed,[]);assert.deepEqual(changedInputs,[]);
const removedProperties=[];
for(const [name,schema] of Object.entries(old.components.schemas))for(const key of Object.keys(schema.properties??{}))
 if(!current.components.schemas[name]?.properties?.[key])removedProperties.push({name,key});
assert.deepEqual(removedProperties,[]);
const result={oldOperations:Object.values(old.paths).reduce((n,p)=>n+Object.keys(p).filter(m=>verbs.includes(m)).length,0),
 newOperations:Object.values(current.paths).reduce((n,p)=>n+Object.keys(p).filter(m=>verbs.includes(m)).length,0),
 added,removed,changedInputs,removedProperties,
 newSchemas:Object.keys(current.components.schemas).filter(n=>!old.components.schemas[n]),
 generatedBy:['api export:openapi with DatabaseService.client hard denied','api-contracts generate:client','api-contracts build'],
 compatibility:'Old operation IDs, paths, methods, request body and parameter metadata retained; additive response fields and capability enum.'};
await writeFile(new URL('contracts-diff.json',out),JSON.stringify(result,null,2)+'\n');console.log(result);

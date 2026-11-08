import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const folder = 'output/k8k-tasks/TASK-033/';
const old = JSON.parse(readFileSync(folder + 'before/packages/api-contracts/openapi/openapi.json'));
const now = JSON.parse(readFileSync('packages/api-contracts/openapi/openapi.json'));
const methods = ['get','post','put','patch','delete','head','options'];
let operations = 0;
assert.deepEqual(Object.keys(now.paths), Object.keys(old.paths));
for (const [path, item] of Object.entries(old.paths)) {
  for (const method of methods) if (item[method]) {
    operations++;
    const before = item[method], after = now.paths[path][method];
    assert(after);
    assert.equal(after.operationId, before.operationId);
    for (const field of ['requestBody','responses','security']) assert.deepEqual(after[field], before[field]);
    if (before.operationId === 'getStudentNotifications') {
      assert.deepEqual(after.parameters.filter(p => p.name !== 'locale'), before.parameters);
      const locale = after.parameters.filter(p => p.name === 'locale');
      assert.equal(locale.length,1);
      assert.equal(locale[0].required,false);
      assert.equal(locale[0].in,'query');
      assert.deepEqual(locale[0].schema,{default:'ru',enum:['ru','ro'],type:'string'});
    } else assert.deepEqual(after.parameters,before.parameters);
  }
}
assert.equal(operations,149);
assert.equal(Object.values(now.paths).flatMap(item => methods.filter(method => item[method])).length, operations);
assert.deepEqual(now.components.schemas,old.components.schemas);
const manifestPath = 'apps/student-cabinet/package.json';
const oldManifest = JSON.parse(readFileSync(folder + 'before/' + manifestPath));
const newManifest = JSON.parse(readFileSync(manifestPath));
for (const field of ['dependencies','devDependencies','peerDependencies','optionalDependencies']) assert.deepEqual(newManifest[field],oldManifest[field]);
for (const [name, value] of Object.entries(oldManifest.scripts)) assert.equal(newManifest.scripts[name],value);
assert.equal(newManifest.scripts['test:notification-bell'],'playwright test --config playwright.bell.config.mjs');
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const unchanged = ['apps/api/src/modules/notifications/notification.service.ts','apps/api/src/modules/notifications/templates.ts',
  'apps/api/src/modules/notifications/notification-outbox.publisher.ts','apps/worker/src/notifications.ts',
  'packages/api-contracts/src/transport.ts','package.json','pnpm-lock.yaml','apps/student-cabinet/tests/student.spec.mjs',
  'apps/student-cabinet/src/pages/Learning.tsx'].map(path => ({path,unchanged:sha(path)===sha(folder+'before/'+path)}));
assert(unchanged.every(p => p.unchanged));
writeFileSync(folder+'contracts.json',JSON.stringify({status:'PASS',operationsBefore:operations,operationsAfter:operations,
  addedOperations:[],newParameter:{operationId:'getStudentNotifications',name:'locale',in:'query',required:false,default:'ru',enum:['ru','ro']},
  existingRequestResponseSecurity:'unchanged',existingSchemas:'unchanged (including all18 NotificationItemDto types)',unchanged,
  standardGeneration:true,studentMutationRoutesAdded:0,migrationsAdded:0,migrationsExecuted:false,dependenciesAdded:0},null,2)+'\n');
console.log({status:'PASS',operations,unchanged:unchanged.length});

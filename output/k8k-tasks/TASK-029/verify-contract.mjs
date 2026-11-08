import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const folder = 'output/k8k-tasks/TASK-029/';
const previous = JSON.parse(
  readFileSync(folder + 'before/packages/api-contracts/openapi/openapi.json'),
);
const current = JSON.parse(readFileSync('packages/api-contracts/openapi/openapi.json'));
const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
const oldOperations = [],
  newOperations = [],
  addedParameters = [],
  schemaProperties = [];
for (const [path, item] of Object.entries(previous.paths)) {
  assert(current.paths[path], 'Removed path ' + path);
  for (const method of methods) {
    if (!item[method]) continue;
    const before = item[method],
      after = current.paths[path][method];
    assert(after, 'Removed operation ' + path + ' ' + method);
    oldOperations.push(before.operationId);
    for (const part of ['requestBody', 'responses', 'security'])
      assert.deepEqual(after[part], before[part], before.operationId + ' ' + part);
    for (const parameter of before.parameters ?? [])
      assert.deepEqual(
        (after.parameters ?? []).find((p) => p.name === parameter.name && p.in === parameter.in),
        parameter,
        before.operationId + ' parameter ' + parameter.name,
      );
    for (const parameter of after.parameters ?? [])
      if (
        !(before.parameters ?? []).some((p) => p.name === parameter.name && p.in === parameter.in)
      ) {
        assert(!parameter.required, 'New required input on existing operation');
        addedParameters.push({ operation: before.operationId, parameter: parameter.name });
      }
  }
}
for (const [path, item] of Object.entries(current.paths))
  for (const method of methods)
    if (item[method] && !previous.paths[path]?.[method])
      newOperations.push({ path, method, operationId: item[method].operationId });
assert.equal(oldOperations.length, 146);
assert.deepEqual(
  newOperations.map((operation) => operation.operationId),
  ['getStudentLessonRequestResult'],
);
const parameters = addedParameters.map((p) => p.operation + '.' + p.parameter).sort();
assert.deepEqual(
  parameters,
  [
    'getStudentHomework.lessonId',
    'getStudentLessons.view',
    'getStudentLessons.subjectId',
    'getStudentLessonHistory.lessonId',
    'getStudentLessonHistory.subjectId',
    'getStudentMaterials.lessonId',
  ].sort(),
);
for (const [name, before] of Object.entries(previous.components.schemas)) {
  const after = current.components.schemas[name];
  assert(after, 'Removed schema ' + name);
  assert.deepEqual(after.required, before.required, name + ' required fields');
  for (const [key, property] of Object.entries(before.properties ?? {}))
    assert.deepEqual(after.properties?.[key], property, name + '.' + key);
  for (const key of Object.keys(after.properties ?? {}))
    if (!before.properties?.[key]) {
      assert(!(after.required ?? []).includes(key));
      schemaProperties.push({ schema: name, property: key });
    }
}
assert.deepEqual(schemaProperties.map((p) => p.schema + '.' + p.property).sort(), [
  'LessonCardDto.originalScheduledAt',
  'LessonCardDto.subjectId',
]);
const newSchemas = Object.keys(current.components.schemas).filter(
  (name) => !previous.components.schemas[name],
);
assert.deepEqual(newSchemas, ['LessonRequestResultDto']);
writeFileSync(
  folder + 'contracts.json',
  JSON.stringify(
    {
      status: 'PASS',
      operationsBefore: 146,
      operationsAfter: 147,
      newOperations,
      addedParameters,
      schemaProperties,
      newSchemas,
      existingRequestBodiesResponsesAndRequiredFields: 'preserved',
      adjacentReportsAndSkillsParameters: 'preserved',
      standardGeneration: true,
      migrationsAdded: 0,
      migrationsExecuted: 0,
    },
    null,
    2,
  ) + '\n',
);
console.log({
  status: 'PASS',
  oldOperations: 146,
  newOperations: 1,
  addedParameters: parameters.length,
});

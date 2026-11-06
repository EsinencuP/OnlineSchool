// Generated SDK transport and schema tests only. Fetch is replaced, no network target.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  getStaffActorContext,
  getTeacherLessonStartEligibility,
  getDirectorPaymentConfirmationEligibility,
  getManagerPaymentApprovalEligibility,
  getPlatformWorkspace,
} from '../../../packages/api-contracts/dist/index.js';

test('generated staff reads keep credentials, cancellation and no-store options, without commands', async () => {
  const original = globalThis.fetch;
  const signal = new AbortController().signal;
  const response = {
    allowed: false,
    objectId: null,
    revision: null,
    reason: 'UNAVAILABLE',
    sourceUpdatedAt: null,
    asOf: '2026-11-04T12:00:00Z',
  };
  const paths = [];
  globalThis.fetch = async (url, options) => {
    paths.push(url);
    assert.equal(options.method, 'GET');
    assert.equal(options.credentials, 'include');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.signal, signal);
    assert.equal(options.body, undefined);
    return new Response(JSON.stringify(response));
  };
  try {
    const options = { cache: 'no-store', signal };
    assert.deepEqual(await getStaffActorContext(options), { ok: true, value: response });
    for (const call of [
      getTeacherLessonStartEligibility,
      getDirectorPaymentConfirmationEligibility,
      getManagerPaymentApprovalEligibility,
    ])
      assert.deepEqual(await call('synthetic-id', options), { ok: true, value: response });
    assert.deepEqual(paths, [
      '/api/v1/platform/actor-context',
      '/api/v1/platform/lessons/synthetic-id/start-eligibility',
      '/api/v1/platform/payments/synthetic-id/confirm-eligibility',
      '/api/v1/manager/payments/synthetic-id/approval-eligibility',
    ]);
  } finally {
    globalThis.fetch = original;
  }
});
test('SDK preserves unknown total and server context without substituting clock or teacher identity', async () => {
  const original = globalThis.fetch;
  const response = {
    actorContext: {
      accountId: 'director-account',
      teacherProfileId: null,
      staffProfileId: 'staff-profile',
      asOf: '2026-11-04T12:00:00Z',
      accountUpdatedAt: null,
      profileUpdatedAt: null,
    },
    lessons: [],
    students: [],
    homework: [],
    tasks: [],
    coverage: {
      lessons: {
        pageInfo: { total: null, returned: 0, hasMore: false, limit: 100 },
        sourceUpdatedAt: null,
      },
    },
  };
  globalThis.fetch = async () => new Response(JSON.stringify(response));
  try {
    assert.deepEqual(await getPlatformWorkspace(), { ok: true, value: response });
  } finally {
    globalThis.fetch = original;
  }
});
test('generated metadata read preserves HTTP denial and does not retry', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ code: 'FORBIDDEN', message: 'FORBIDDEN' }), {
      status: 403,
    });
  };
  try {
    const result = await getTeacherLessonStartEligibility('synthetic-id');
    assert.equal(result.ok, false);
    assert.equal(result.error.status, 403);
    assert.equal(result.error.code, 'FORBIDDEN');
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});
test('OpenAPI has authenticated metadata operations, nullable identity/revision and explicit unknown total', async () => {
  const doc = JSON.parse(
    await readFile(
      new URL('../../../packages/api-contracts/openapi/openapi.json', import.meta.url),
      'utf8',
    ),
  );
  const paths = [
    '/api/v1/platform/actor-context',
    '/api/v1/platform/lessons/{id}/start-eligibility',
    '/api/v1/platform/payments/{id}/confirm-eligibility',
    '/api/v1/manager/payments/{paymentId}/approval-eligibility',
  ];
  for (const path of paths) {
    const operation = doc.paths[path].get;
    assert.deepEqual(operation.security, [{ sessionCookie: [] }]);
    assert(operation.responses['200']);
    assert(operation.responses['401']);
    assert(operation.responses['403']);
    assert.equal(operation.requestBody, undefined);
  }
  const schemas = doc.components.schemas;
  for (const [name, key] of [
    ['StaffActorContextDto', 'teacherProfileId'],
    ['StaffActorContextDto', 'profileUpdatedAt'],
    ['StaffActionEligibilityDto', 'revision'],
    ['WorkspacePageInfoDto', 'total'],
  ])
    assert(schemas[name].properties[key].type.includes('null'));
  assert(
    schemas.ManagerMeResponseDto.properties.capabilities.items.enum.includes(
      'PAYMENTS_REQUEST_APPROVAL',
    ),
  );
  assert(schemas.StaffActorContextDto.required.includes('accountId'));
  assert(schemas.PlatformWorkspaceDto.required.includes('coverage'));
});

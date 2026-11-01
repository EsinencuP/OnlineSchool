import test from 'node:test';
import assert from 'node:assert/strict';
import {
  managerSetupInput,
  provisionOwnerManager,
} from '../../scripts/provision-owner-manager.mjs';
const hash = '$scrypt$v=1$N=131072,r=8,p=1$' + 'a'.repeat(22) + '$' + 'b'.repeat(86);
const input = { login: 'manager@onlineschool.test', hash };
const env = {
  VERCEL_ENV: 'production',
  VERCEL_PROJECT_ID: 'prj_XusYmdwL1Y0478T09RNKmBQMldgZ',
  MANAGER_SETUP_UNTIL: '110000',
  MANAGER_SETUP_LOGIN: input.login,
  MANAGER_SETUP_PASSWORD_HASH: hash,
};
test('owner setup is restricted to the existing production project and a 30minute request', () => {
  assert.deepEqual(managerSetupInput(env, 100000), input);
  for (const patch of [
    { VERCEL_ENV: 'preview' },
    { VERCEL_PROJECT_ID: 'another-project' },
    { MANAGER_SETUP_UNTIL: '1' },
    { MANAGER_SETUP_UNTIL: '999999999999' },
    { MANAGER_SETUP_UNTIL: undefined },
  ])
    assert.equal(managerSetupInput({ ...env, ...patch }, 100000), null);
  assert.throws(
    () => managerSetupInput({ ...env, MANAGER_SETUP_LOGIN: 'another@example.test' }, 100000),
    /MANAGER_SETUP_INVALID/,
  );
  assert.throws(
    () => managerSetupInput({ ...env, MANAGER_SETUP_PASSWORD_HASH: 'plain-password' }, 100000),
    /MANAGER_SETUP_INVALID/,
  );
});
function fixture(existing = null, director = { id: 'director-id' }) {
  const writes = [];
  const create = (type) => async (args) => {
    writes.push({ type, data: args.data });
    return { id: 'audit-id', ...args.data };
  };
  const tx = {
    $queryRaw: async () => [{ now: new Date('2026-11-01T12:00:00Z') }],
    authAccount: { findUnique: async () => existing, create: create('account') },
    staffAccount: { findFirst: async () => director, create: create('profile') },
    role: { findUnique: async () => ({ id: 'manager-role' }) },
    roleAssignment: { create: create('role') },
    auditEvent: { create: create('audit') },
    outboxEvent: { create: create('outbox') },
  };
  return { tx, writes };
}
test('new access grants MANAGER only with audit/outbox and no MFA bypass or business data', async () => {
  const { tx, writes } = fixture();
  const result = await provisionOwnerManager(tx, input);
  assert.equal(result.status, 'provisioned');
  assert.deepEqual(
    writes.map((w) => w.type),
    ['account', 'profile', 'role', 'audit', 'outbox'],
  );
  assert.equal(writes[0].data.kind, 'STAFF');
  assert.equal(writes[0].data.password_hash, hash);
  assert.equal(writes[0].data.recovery_registration_required, undefined);
  assert.equal(writes[2].data.role_id, 'manager-role');
  assert.equal(writes[2].data.assigned_by_staff_id, 'director-id');
  assert.deepEqual(writes[3].data.metadata, { role: 'MANAGER', mfaRequired: true });
  assert.equal(writes[4].data.audit_event_id, 'audit-id');
  assert.equal(writes[4].data.source_operation_id, writes[3].data.source_operation_id);
  assert.equal(JSON.stringify(writes[4]).includes(hash), false);
});
test('idempotent redeploy never resets the account, sessions or enrolled credentials', async () => {
  const { tx, writes } = fixture({
    id: 'existing',
    kind: 'STAFF',
    password_hash: hash,
    staff_profile: { deactivated_at: null },
    role_assignments: [{ role: { code: 'MANAGER' } }],
  });
  assert.deepEqual(await provisionOwnerManager(tx, input), {
    status: 'already-provisioned',
    accountId: 'existing',
  });
  assert.equal(writes.length, 0);
});
test('login collision or missing director rejects without account writes', async () => {
  for (const existing of [
    { kind: 'STUDENT' },
    { kind: 'STAFF', staff_profile: {}, role_assignments: [{ role: { code: 'DIRECTOR' } }] },
  ]) {
    const { tx, writes } = fixture(existing);
    await assert.rejects(provisionOwnerManager(tx, input), /MANAGER_SETUP_LOGIN_COLLISION/);
    assert.equal(writes.length, 0);
  }
  const { tx, writes } = fixture(null, null);
  await assert.rejects(provisionOwnerManager(tx, input), /MANAGER_SETUP_DIRECTOR_UNAVAILABLE/);
  assert.equal(writes.length, 0);
});

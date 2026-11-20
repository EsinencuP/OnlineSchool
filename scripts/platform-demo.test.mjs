import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accounts,
  demoSetupInput,
  demoId,
  marker,
  railwayTestDatabase,
} from './platform-demo-plan.mjs';
import { provisionBase, provisionPaid } from './provision-platform-demo.mjs';

test('Railway demo migrations are restricted to the isolated test database and separate roles', () => {
  const target = {
    APP_ENV: 'qa',
    RAILWAY_ENVIRONMENT_NAME: 'test',
    RAILWAY_PROJECT_ID: 'fixture',
    DIRECT_URL:
      'postgresql://app_migrate:fixture@postgres.railway.internal:5432/online_school_qa_railway',
    DATABASE_URL:
      'postgresql://app_runtime:fixture@postgres.railway.internal:5432/online_school_qa_railway',
  };
  assert.equal(railwayTestDatabase(target), true);
  for (const change of [
    { RAILWAY_ENVIRONMENT_NAME: 'production' },
    { APP_ENV: 'production' },
    { VERCEL_ENV: 'production' },
    { DATABASE_URL: target.DIRECT_URL },
    {
      DIRECT_URL: target.DIRECT_URL.replace(
        'postgres.railway.internal',
        'postgres.example.invalid',
      ),
    },
    { DIRECT_URL: target.DIRECT_URL.replace('online_school_qa_railway', 'online_school') },
  ])
    assert.equal(railwayTestDatabase({ ...target, ...change }), false);
});

const now = Date.UTC(2026, 10, 1, 16);
const rows = accounts.map((a) => ({
  ...a,
  hash: `$scrypt$v=1$N=131072,r=8,p=1$${'a'.repeat(22)}$${'b'.repeat(86)}`,
}));
const env = {
  VERCEL_ENV: 'production',
  VERCEL_PROJECT_ID: 'prj_XusYmdwL1Y0478T09RNKmBQMldgZ',
  QA_PASSWORD_ONLY_LOGIN: 'true',
  PLATFORM_DEMO_SETUP_UNTIL: String(now + 120000),
  PLATFORM_DEMO_MARKER: marker,
  PLATFORM_DEMO_ACCOUNT_HASHES: JSON.stringify(rows),
};
test('one-off guard requires exact target, password policy and bounded live window', () => {
  assert.equal(demoSetupInput(env, now).paid, false);
  for (const change of [
    { VERCEL_ENV: 'preview' },
    { VERCEL_PROJECT_ID: 'another-project' },
    { QA_PASSWORD_ONLY_LOGIN: 'false' },
    { PLATFORM_DEMO_SETUP_UNTIL: '0' },
    { PLATFORM_DEMO_SETUP_UNTIL: String(now + 31 * 60000) },
  ])
    assert.equal(demoSetupInput({ ...env, ...change }, now), null);
});
test('no implicit finance approval; an incorrect approval or account payload stops setup', () => {
  assert.throws(
    () => demoSetupInput({ ...env, PLATFORM_DEMO_FINANCE_APPROVAL: 'true' }, now),
    /INVALID_FINANCE_APPROVAL/,
  );
  assert.equal(
    demoSetupInput(
      { ...env, PLATFORM_DEMO_FINANCE_APPROVAL: `${marker}:8500.0000-MDL:22-LESSONS` },
      now,
    ).paid,
    true,
  );
  for (const bad of [
    rows.slice(1),
    [...rows.slice(1), rows[1]],
    rows.map((r, i) => (i ? r : { ...r, login: 'existing@example.com' })),
    rows.map((r, i) => (i ? r : { ...r, hash: 'plaintext' })),
  ])
    assert.throws(
      () => demoSetupInput({ ...env, PLATFORM_DEMO_ACCOUNT_HASHES: JSON.stringify(bad) }, now),
      /INVALID_ACCOUNTS/,
    );
});
test('completed phases perform no account, lesson or financial writes, even without services', async () => {
  const calls = [];
  const tx = {
    $executeRaw: async () => calls.push('lock'),
    auditEvent: { findUnique: async () => ({ recorded_at: new Date(now) }) },
  };
  assert.equal((await provisionBase(tx, rows)).status, 'already-provisioned');
  assert.equal((await provisionPaid(tx, rows, null)).status, 'already-provisioned');
  assert.deepEqual(calls, ['lock', 'lock']);
});
test('existing login is a collision, never a password reset or an upsert', async () => {
  const tx = {
    $executeRaw: async () => {},
    $queryRaw: async () => [{ now: new Date(now) }],
    auditEvent: { findUnique: async () => null },
    staffAccount: { findFirst: async () => ({ id: demoId('bootstrap') }) },
    authAccount: { findUnique: async () => ({ id: 'some-existing-account' }) },
  };
  await assert.rejects(() => provisionBase(tx, rows), /LOGIN_COLLISION/);
});

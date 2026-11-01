import { createRequire } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
const require = createRequire(new URL('../apps/api/package.json', import.meta.url));
require('reflect-metadata');
const { IdentityService } = await import('../apps/api/dist/modules/identity/identity.service.js');
const { PlatformController } = await import('../apps/api/dist/modules/platform/platform.module.js');
const { demoAccounts, demoAccountId, demoSwitchAllowed } =
  await import('../apps/api/dist/modules/identity/demo-accounts.js');
const { accounts, demoId } = await import('./platform-demo-plan.mjs');
const previous = {
  switch: process.env.PLATFORM_DEMO_SWITCHING,
  password: process.env.QA_PASSWORD_ONLY_LOGIN,
};
test.after(() => {
  for (const [key, value] of [
    ['PLATFORM_DEMO_SWITCHING', previous.switch],
    ['QA_PASSWORD_ONLY_LOGIN', previous.password],
  ]) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
test.beforeEach(() => {
  process.env.PLATFORM_DEMO_SWITCHING = 'true';
  process.env.QA_PASSWORD_ONLY_LOGIN = 'true';
});
const actor = (key = 'anna', role = 'STUDENT') => ({
  accountId: demoAccountId(key),
  kind: role === 'STUDENT' ? 'STUDENT' : 'STAFF',
  role,
  roles: [role],
  sessionId: 'old-session',
  recoveryOnly: false,
});
function identityFixture() {
  const service = Object.create(IdentityService.prototype);
  const writes = [];
  service.actor = async () => actor();
  service.account = async (_tx, id) =>
    id === demoAccountId('anna')
      ? { id, login_id: 'anna.demo@onlineschool.test', kind: 'STUDENT' }
      : { id, login_id: 'pasha.demo@onlineschool.test', kind: 'STAFF' };
  service.roles = async () => ['DIRECTOR'];
  service.execute = async (_req, action, work) => ({ action, outcome: await work({}) });
  service.revoke = async (...args) => writes.push(['revoke', ...args.slice(1)]);
  service.sessions = {
    issue: async (_tx, id, mfa, recovery) => {
      writes.push(['issue', id, mfa, recovery]);
      return { sessionId: 'new-session' };
    },
  };
  return { service, writes };
}
test('switch catalog uses exactly the provisioned demo identities and no passwords', () => {
  for (const a of accounts) {
    const entry = demoAccounts.find((d) => d.key === a.key);
    assert.equal(entry.login, a.login);
    assert.equal(entry.role, a.role);
    assert.equal(demoAccountId(a.key), demoId(`account:${a.key}`));
    assert.equal('password' in entry, false);
  }
});
test('switch is disabled by default, forbidden to real identities, recovery sessions and forged roles', () => {
  const a = actor();
  const login = 'anna.demo@onlineschool.test';
  assert.equal(demoSwitchAllowed(a, login), true);
  for (const bad of [
    undefined,
    { ...a, accountId: demoAccountId('pasha') },
    { ...a, recoveryOnly: true },
    { ...a, role: 'DIRECTOR' },
    { ...a, roles: ['STUDENT', 'DIRECTOR'] },
  ])
    assert.equal(demoSwitchAllowed(bad, login), false);
  assert.equal(demoSwitchAllowed(a, 'real@example.com'), false);
  process.env.PLATFORM_DEMO_SWITCHING = 'false';
  assert.equal(demoSwitchAllowed(a, login), false);
  process.env.PLATFORM_DEMO_SWITCHING = 'true';
  process.env.QA_PASSWORD_ONLY_LOGIN = 'false';
  assert.equal(demoSwitchAllowed(a, login), false);
});
test('switch revokes only the source session and issues target session with truthful MFA state', async () => {
  const { service, writes } = identityFixture();
  const result = await service.switchDemo({ body: { key: 'pasha' } });
  assert.equal(result.action, 'auth.demo.switch');
  assert.equal(result.outcome.actorId, demoAccountId('anna'));
  assert.deepEqual(result.outcome.body, { home: '/director' });
  assert.deepEqual(writes, [
    [
      'revoke',
      demoAccountId('anna'),
      demoAccountId('anna'),
      'DEMO_USER_SWITCH',
      false,
      'old-session',
    ],
    ['issue', demoAccountId('pasha'), null, false],
  ]);
});
test('invalid source and disabled target fail before revocation or session issuance', async () => {
  const { service, writes } = identityFixture();
  service.actor = async () => ({ ...actor(), recoveryOnly: true });
  await assert.rejects(
    () => service.switchDemo({ body: { key: 'pasha' } }),
    /DEMO_SWITCH_FORBIDDEN/,
  );
  assert.deepEqual(writes, []);
  service.actor = async () => actor();
  service.roles = async () => ['MANAGER'];
  await assert.rejects(
    () => service.switchDemo({ body: { key: 'pasha' } }),
    /DEMO_ACCOUNT_UNAVAILABLE/,
  );
  assert.deepEqual(writes, []);
});
test('arbitrary account IDs, roles and unlisted keys are never accepted as a switch target', async () => {
  const { service, writes } = identityFixture();
  for (const key of ['director', 'another-person', demoAccountId('pasha'), '__proto__'])
    assert.equal((await service.switchDemo({ body: { key } })).ok, false);
  assert.throws(
    () => service.switchDemo({ body: { key: 'pasha', role: 'DIRECTOR' } }),
    /INVALID_INPUT/,
  );
  assert.deepEqual(writes, []);
});
test('teacher workspace scopes lessons, assignments and homework to its profile; no CRM tasks queried', async () => {
  const calls = [];
  const client = {
    teacherAccount: {
      findFirstOrThrow: async () => ({ id: 'teacher-profile', full_name: 'Teacher' }),
    },
    lessonOccurrence: {
      findMany: async (args) => {
        calls.push(['lessons', args.where]);
        return [];
      },
    },
    teachingAssignment: {
      findMany: async (args) => {
        calls.push(['students', args.where]);
        return [];
      },
    },
    homeworkAssignment: {
      findMany: async (args) => {
        calls.push(['homework', args.where]);
        return [];
      },
    },
    crmTask: { findMany: async () => assert.fail('Teacher must not read manager tasks') },
  };
  const controller = new PlatformController({ client });
  const result = await controller.workspace(
    { account: { ...actor(), role: 'TEACHER' } },
    { setHeader() {} },
  );
  assert.equal(calls[0][1].scheduled_teacher_id, 'teacher-profile');
  assert.equal(calls[1][1].teacher_id, 'teacher-profile');
  assert.equal(calls[2][1].issued_by, 'teacher-profile');
  assert.deepEqual(result.tasks, []);
});

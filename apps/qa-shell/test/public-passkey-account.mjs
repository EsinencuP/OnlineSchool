// Explicit maintenance fixture for the published-domain passkey smoke; no application bypass.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createDirectClient } from '../../../packages/db/dist/index.js';
import { Passwords } from '../../api/dist/modules/identity/passwords.js';

async function main() {
  const target = new URL(process.env.DIRECT_URL);
  assert.equal(target.pathname, '/online_school');
  assert.equal(target.hostname, 'ep-royal-king-b9rn54v0.c-7.eu-central-1.aws.neon.tech');
  assert.ok(['create', 'disable'].includes(process.argv[2]));
  const file = new URL('../../../.identity-ops/public-passkey-smoke.json', import.meta.url);
  let input;
  try {
    input = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT' || process.argv[2] !== 'create') throw error;
    input = {
      accountId: randomUUID(),
      email: `task12-passkey-${randomUUID()}@online-school.invalid`,
      password: randomBytes(24).toString('base64url'),
    };
    await writeFile(file, JSON.stringify(input), { flag: 'wx' });
  }
  assert.match(input.email, /^task12-passkey-[a-f0-9-]+@online-school\.invalid$/);
  const connection = createDirectClient();
  assert.ok(connection.ok);
  const db = connection.value;
  try {
    if (process.argv[2] === 'create') {
      const hash = await new Passwords().hash(input.password);
      assert.ok(hash.ok);
      await db.$transaction(async (tx) => {
        const existing = await tx.authAccount.findUnique({ where: { id: input.accountId } });
        if (existing) {
          assert.equal(existing.login_id, input.email);
          assert.equal(existing.disabled_at, null);
          return;
        }
        const role = await tx.role.findUniqueOrThrow({ where: { code: 'TEACHER' } });
        await tx.authAccount.create({
          data: {
            id: input.accountId,
            kind: 'TEACHER',
            login_id: input.email,
            password_hash: hash.value,
          },
        });
        await tx.teacherAccount.create({
          data: {
            account_id: input.accountId,
            full_name: 'Synthetic TASK-12 published passkey smoke',
          },
        });
        await tx.roleAssignment.create({
          data: { account_id: input.accountId, role_id: role.id, valid_from: new Date() },
        });
        await tx.auditEvent.create({
          data: {
            actor_kind: 'SYSTEM',
            system_actor_ref: 'task12-passkey-smoke',
            action: 'qa.passkey-smoke.created',
            resource_type: 'AuthAccount',
            resource_id: input.accountId,
            result: 'SUCCESS',
            request_id: randomUUID(),
            event_key: `task12.smoke.created:${input.accountId}`,
          },
        });
      });
      console.log('Synthetic teacher provisioned with normal password, role and MFA requirements.');
    } else {
      await db.$transaction(async (tx) => {
        const account = await tx.authAccount.findUniqueOrThrow({ where: { id: input.accountId } });
        assert.equal(account.login_id, input.email);
        if (account.disabled_at) return;
        const at = (await tx.$queryRaw`SELECT clock_timestamp() AS now`)[0].now;
        await tx.authAccount.update({ where: { id: input.accountId }, data: { disabled_at: at } });
        await tx.webAuthnCredential.updateMany({
          where: { account_id: input.accountId, revoked_at: null },
          data: { revoked_at: at },
        });
        await tx.session.updateMany({
          where: { account_id: input.accountId, revoked_at: null },
          data: { revoked_at: at },
        });
        await tx.roleAssignment.updateMany({
          where: { account_id: input.accountId, valid_to: null },
          data: { valid_to: at },
        });
        await tx.accessRevocation.create({
          data: {
            account_id: input.accountId,
            source: 'QA_SMOKE_COMPLETED',
            reason: 'Published-domain TASK-12 passkey smoke completed',
            revoked_at: at,
          },
        });
        await tx.auditEvent.create({
          data: {
            actor_kind: 'SYSTEM',
            system_actor_ref: 'task12-passkey-smoke',
            action: 'qa.passkey-smoke.disabled',
            resource_type: 'AuthAccount',
            resource_id: input.accountId,
            result: 'SUCCESS',
            request_id: randomUUID(),
            event_key: `task12.smoke.disabled:${input.accountId}`,
          },
        });
      });
      console.log('Synthetic teacher disabled; passkey and sessions revoked. Audit retained.');
    }
  } finally {
    await db.$disconnect();
  }
}
void main().catch(() => {
  console.error('PUBLISHED_PASSKEY_FIXTURE_FAILED');
  process.exitCode = 1;
});

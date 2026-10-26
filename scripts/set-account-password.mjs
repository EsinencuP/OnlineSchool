// Trusted maintenance provisioning for an existing account; never grants roles or resets MFA.
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createDirectClient } from '../packages/db/dist/index.js';
import { Passwords } from '../apps/api/dist/modules/identity/passwords.js';

async function main() {
  if (process.argv.length !== 4 || process.argv[2] !== '--protected-input-file') {
    console.error(
      'Usage: node scripts/set-account-password.mjs --protected-input-file <protected-json-file>',
    );
    process.exitCode = 1;
    return;
  }
  const input = JSON.parse(await readFile(process.argv[3], 'utf8'));
  if (
    !input ||
    Object.keys(input).some((k) => !['accountId', 'password'].includes(k)) ||
    typeof input.accountId !== 'string' ||
    !/^[0-9a-f-]{36}$/i.test(input.accountId) ||
    typeof input.password !== 'string'
  ) {
    console.error('INVALID_INPUT');
    process.exitCode = 1;
    return;
  }
  const hash = await new Passwords().hash(input.password);
  if (!hash.ok) {
    console.error(hash.error.code);
    process.exitCode = 1;
    return;
  }
  const connection = createDirectClient();
  if (!connection.ok) {
    console.error(connection.error.code);
    process.exitCode = 1;
    return;
  }
  try {
    await connection.value.$transaction(async (tx) => {
      const at = (await tx.$queryRaw`SELECT clock_timestamp() AS now`)[0].now;
      await tx.authAccount.update({
        where: { id: input.accountId },
        data: { password_hash: hash.value },
      });
      await tx.session.updateMany({
        where: { account_id: input.accountId, revoked_at: null },
        data: { revoked_at: at },
      });
      await tx.accessRevocation.create({
        data: {
          account_id: input.accountId,
          source: 'PASSWORD_PROVISIONED',
          reason: 'Trusted maintenance password provisioning',
          revoked_at: at,
          created_at: at,
          updated_at: at,
        },
      });
      await tx.auditEvent.create({
        data: {
          actor_kind: 'SYSTEM',
          system_actor_ref: 'identity-maintenance',
          action: 'account.password.provisioned',
          resource_type: 'AuthAccount',
          resource_id: input.accountId,
          result: 'SUCCESS',
          request_id: randomUUID(),
          event_key: `password.provisioned:${randomUUID()}`,
        },
      });
    });
    console.log('Password provisioned; prior sessions revoked.');
  } finally {
    await connection.value.$disconnect();
  }
}
void main().catch(() => {
  console.error('PASSWORD_PROVISIONING_FAILED');
  process.exitCode = 1;
});

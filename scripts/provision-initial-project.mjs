// One-time trusted maintenance setup. Never imported by the application or deployed handler.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import pg from '../packages/db/node_modules/pg/lib/index.js';
import { createDirectClient } from '../packages/db/dist/index.js';
import { seedReferenceData } from '../packages/db/prisma/seed.mjs';
import { Passwords } from '../apps/api/dist/modules/identity/passwords.js';

async function main() {
  const email = process.argv[2];
  assert.ok(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Director email required');
  const direct = new URL(process.env.DIRECT_URL);
  assert.equal(direct.pathname, '/online_school');
  assert.ok(direct.hostname.endsWith('.neon.tech') && !direct.hostname.includes('-pooler'));
  const runtimeFile = new URL('../.identity-ops/onlineschool-runtime.env.local', import.meta.url);
  let env;
  try {
    env = parseEnv(await readFile(runtimeFile, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const runtime = new URL(direct);
    runtime.username = 'app_runtime';
    runtime.password = randomBytes(32).toString('hex');
    runtime.hostname = runtime.hostname.replace('.c-', '-pooler.c-');
    env = {
      DATABASE_URL: runtime.toString(),
      CSRF_SIGNING_SECRET: randomBytes(48).toString('base64url'),
      WEBAUTHN_RP_ID: 'onlineschool-xi.vercel.app',
      WEBAUTHN_ALLOWED_ORIGIN: 'https://onlineschool-xi.vercel.app',
    };
    await writeFile(
      runtimeFile,
      Object.entries(env)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n') + '\n',
      { flag: 'wx' },
    );
  }
  const admin = new pg.Client({ connectionString: direct.toString() });
  await admin.connect();
  try {
    const role = await admin.query("SELECT rolname FROM pg_roles WHERE rolname='app_runtime'");
    if (!role.rowCount) {
      const password = new URL(env.DATABASE_URL).password;
      assert.match(password, /^[a-f0-9]{64}$/);
      await admin.query(
        `CREATE ROLE app_runtime LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`,
      );
      await admin.query('GRANT online_school_runtime TO app_runtime');
    }
    const flags = (
      await admin.query(
        "SELECT rolsuper,rolcreatedb,rolcreaterole,rolbypassrls,pg_has_role('app_runtime','online_school_runtime','MEMBER') AS runtime_member FROM pg_roles WHERE rolname='app_runtime'",
      )
    ).rows[0];
    assert.deepEqual(flags, {
      rolsuper: false,
      rolcreatedb: false,
      rolcreaterole: false,
      rolbypassrls: false,
      runtime_member: true,
    });
  } finally {
    await admin.end();
  }
  const connection = createDirectClient();
  assert.ok(connection.ok);
  const db = connection.value;
  try {
    assert.ok((await seedReferenceData(db)).ok);
    const existing = await db.authAccount.findUnique({ where: { login_id: email } });
    if (existing) {
      console.log('Initial account already exists; password, roles and MFA preserved.');
      return;
    }
    assert.equal(
      await db.authAccount.count(),
      0,
      'Initial provisioning requires an empty account registry',
    );
    const inputFile = new URL('../.identity-ops/initial-director.json', import.meta.url);
    let input;
    try {
      input = JSON.parse(await readFile(inputFile, 'utf8'));
      assert.equal(input.email, email);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      input = { email, accountId: randomUUID(), password: randomBytes(24).toString('base64url') };
      await writeFile(inputFile, JSON.stringify(input), { flag: 'wx' });
    }
    const hash = await new Passwords().hash(input.password);
    assert.ok(hash.ok);
    await db.$transaction(async (tx) => {
      const now = (await tx.$queryRaw`SELECT clock_timestamp() AS now`)[0].now;
      const role = await tx.role.findUniqueOrThrow({ where: { code: 'DIRECTOR' } });
      await tx.authAccount.create({
        data: { id: input.accountId, kind: 'STAFF', login_id: email, password_hash: hash.value },
      });
      await tx.staffAccount.create({
        data: { account_id: input.accountId, full_name: 'Директор' },
      });
      await tx.roleAssignment.create({
        data: { account_id: input.accountId, role_id: role.id, valid_from: now },
      });
      await tx.auditEvent.create({
        data: {
          actor_kind: 'SYSTEM',
          system_actor_ref: 'initial-project-maintenance',
          action: 'account.initial-director.provisioned',
          resource_type: 'AuthAccount',
          resource_id: input.accountId,
          result: 'SUCCESS',
          request_id: randomUUID(),
          event_key: `initial-director:${input.accountId}`,
        },
      });
    });
    console.log(
      'Initial director provisioned. Password is in .identity-ops/initial-director.json; MFA enrollment is required.',
    );
  } finally {
    await db.$disconnect();
  }
}
void main().catch(() => {
  console.error('INITIAL_PROJECT_PROVISIONING_FAILED');
  process.exitCode = 1;
});

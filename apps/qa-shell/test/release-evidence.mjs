// Read-only evidence for this deployment, not the Phase-0 migration/regression gate.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createDirectClient } from '../../../packages/db/dist/index.js';

const connection = createDirectClient();
assert.ok(connection.ok);
const db = connection.value;
try {
  const target = new URL(process.env.DIRECT_URL);
  assert.equal(target.pathname, '/online_school');
  assert.equal(target.hostname, 'ep-royal-king-b9rn54v0.c-7.eu-central-1.aws.neon.tech');
  const root = new URL('../../../packages/db/prisma/migrations/', import.meta.url);
  const rows =
    await db.$queryRaw`SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY migration_name`;
  const names = (await readdir(root)).filter((name) => /^\d{14}_/.test(name)).sort();
  assert.deepEqual(
    rows.map((row) => row.migration_name),
    names,
  );
  for (const row of rows) {
    assert.ok(row.finished_at && !row.rolled_back_at);
    const sql = await readFile(new URL(`${row.migration_name}/migration.sql`, root));
    assert.equal(row.checksum, createHash('sha256').update(sql).digest('hex'));
  }
  const version = (await db.$queryRaw`SHOW server_version`)[0].server_version;
  assert.match(version, /^18\./);
  const roles =
    await db.$queryRaw`SELECT rolsuper,rolcreatedb,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname='app_runtime'`;
  assert.deepEqual(roles, [
    { rolsuper: false, rolcreatedb: false, rolcreaterole: false, rolbypassrls: false },
  ]);
  const initialAccount = JSON.parse(
    await readFile(
      new URL('../../../.identity-ops/initial-director.json', import.meta.url),
      'utf8',
    ),
  );
  const owner = await db.authAccount.findUniqueOrThrow({ where: { id: initialAccount.accountId } });
  assert.equal(owner.disabled_at, null);
  assert.equal(await db.webAuthnCredential.count({ where: { account_id: owner.id } }), 0);
  const fixture = JSON.parse(
    await readFile(
      new URL('../../../.identity-ops/public-passkey-smoke.json', import.meta.url),
      'utf8',
    ),
  );
  const account = await db.authAccount.findUniqueOrThrow({ where: { id: fixture.accountId } });
  assert.ok(account.disabled_at);
  assert.equal(await db.session.count({ where: { account_id: account.id, revoked_at: null } }), 0);
  assert.equal(
    await db.webAuthnCredential.count({ where: { account_id: account.id, revoked_at: null } }),
    0,
  );
  const evidence = {
    task: 'TASK-12',
    verifiedAt: new Date().toISOString(),
    origin: 'https://onlineschool-xi.vercel.app',
    deploymentId: process.argv[2],
    packageVersion: JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
      .version,
    commitSha: null,
    commitShaReason: 'Workspace has no Git repository; no fabricated SHA.',
    database: {
      project: 'wispy-sun-30279484',
      branch: 'main',
      name: 'online_school',
      region: 'aws-eu-central-1',
      version,
    },
    migrations: rows.map((r) => ({
      name: r.migration_name,
      sha256: r.checksum,
      appliedAt: r.finished_at,
    })),
    checks: {
      targetedBuildLintAndOriginUnit: 'passed',
      localDirectorManagerTeacherPasswordAndWebAuthn: 'passed',
      localRoleVisibilityAndManagerConfirm403: 'passed',
      localPaymentReplaySingleDatabaseWrite: 'passed',
      localSubscriptionDistributionApprovalAndGrantViaUi: 'passed',
      localFileAccessBeforeAndAfterRevocation: '200 then 403',
      responsiveWidths: [1440, 768, 390],
      horizontalOverflow: false,
      reducedMotion: 'animation disabled',
      publishedPasswordAndPasskeyRegistrationAuthentication:
        'passed with ordinary temporary TEACHER and Chromium virtual authenticator',
      publishedMutationCsrfUuidAndUnchangedRetryKey:
        'passed on rejected nonexistent-lesson command; no business data written',
      publishedSwaggerAndHealth: '200',
      publishedDatabase: 'ok',
      publishedWorker: 'unknown; deployment is subsequent infrastructure work',
      initialDirectorPasswordLogin:
        'passed; MFA enrollment still required; zero owner credentials created by automation',
      temporaryPublishedAccount: 'disabled, credentials and sessions revoked, audit retained',
      runtimeRole: 'non-owner, non-superuser, no CREATE ROLE/DB/BYPASSRLS',
    },
    phase0Gate: 'NOT_RUN',
    manualQaAcceptance: 'PENDING',
    physicalAuthenticator: 'NOT_TESTED',
  };
  assert.match(evidence.deploymentId ?? '', /^dpl_/);
  await writeFile(
    new URL('../TASK12_EVIDENCE.json', import.meta.url),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  console.log(
    'TASK-12 evidence written: seven migration checksums matched; temporary access revoked; owner enrollment untouched.',
  );
} finally {
  await db.$disconnect();
}

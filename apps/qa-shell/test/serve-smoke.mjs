// Test-only fixture server. No routes, role overrides or fixture credentials enter the shipped app.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createPoolClient } from '../../../packages/db/dist/index.js';
import { Passwords } from '../../api/dist/modules/identity/passwords.js';
import { WorkerHeartbeat } from '../../worker/dist/heartbeat.js';
import { fundedSubscription } from '../../../packages/db/test/integration/finance-fixtures.mjs';

const url = process.env.QA_SHELL_TEST_DATABASE_URL;
assert.ok(url);
const target = new URL(url);
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname));
assert.match(target.pathname, /^\/online_school_test_task12[a-z0-9_]*$/);
assert.notEqual(process.env.APP_ENV, 'production');
process.env.DATABASE_URL = url;
process.env.CSRF_SIGNING_SECRET = randomBytes(48).toString('base64url');
process.env.WEBAUTHN_RP_ID = 'onlineschool-xi.vercel.app';
process.env.WEBAUTHN_ALLOWED_ORIGIN = 'https://onlineschool-xi.vercel.app';
const db = createPoolClient({ DATABASE_URL: url }).value;
const fixturePath = new URL('../../../.codex/task12-smoke.json', import.meta.url);
if (process.argv.includes('--revoke-file')) {
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
  await db.filePermission.update({
    where: { id: fixture.permissionId },
    data: { revoked_at: new Date(), revoked_by: fixture.directorAccountId },
  });
  await db.$disconnect();
  console.log('Synthetic file permission revoked');
  process.exit(0);
}
const password = 'Synthetic-QA-shell-test-2026!';
const hash = await new Passwords().hash(password);
assert.ok(hash.ok);
const users = {};
for (const role of ['DIRECTOR', 'MANAGER', 'TEACHER']) {
  const account = await db.authAccount.create({
    data: {
      kind: role === 'TEACHER' ? 'TEACHER' : 'STAFF',
      login_id: `task12-${role.toLowerCase()}-${randomUUID()}@online-school.invalid`,
      password_hash: hash.value,
    },
  });
  const profile =
    role === 'TEACHER'
      ? await db.teacherAccount.create({
          data: { account_id: account.id, full_name: 'Synthetic QA teacher' },
        })
      : await db.staffAccount.create({
          data: { account_id: account.id, full_name: `Synthetic QA ${role}` },
        });
  const row = await db.role.findUniqueOrThrow({ where: { code: role } });
  await db.roleAssignment.create({
    data: { account_id: account.id, role_id: row.id, valid_from: new Date('2026-01-01') },
  });
  users[role] = { accountId: account.id, profileId: profile.id, email: account.login_id };
}
const student = await db.student.create({ data: { full_name: 'Synthetic QA shell student' } });
await db.assignedManager.create({
  data: {
    student_id: student.id,
    manager_id: users.MANAGER.profileId,
    assigned_at: new Date('2026-10-01'),
  },
});
const requireDb = createRequire(new URL('../../../packages/db/package.json', import.meta.url));
const { Pool } = requireDb('pg');
const pool = new Pool({ connectionString: url });
const finance = await fundedSubscription(pool, users.DIRECTOR.profileId, student.id);
await pool.end();
const when = new Date('2026-10-01');
const object = await db.s3Object.create({
  data: {
    bucket: 'synthetic-task12',
    key: randomUUID(),
    size: 1n,
    content_type: 'text/plain',
    status: 'VERIFIED',
    uploaded_at: when,
    verified_at: when,
    uploaded_by: users.DIRECTOR.accountId,
    source_operation_id: randomUUID(),
  },
});
const permission = await db.filePermission.create({
  data: {
    s3_object_id: object.id,
    subject_id: users.MANAGER.accountId,
    subject_type: 'STAFF',
    granted_by: users.DIRECTOR.accountId,
    granted_at: when,
    source_operation_id: randomUUID(),
  },
});
await writeFile(
  fixturePath,
  JSON.stringify({
    users,
    studentId: student.id,
    objectId: object.id,
    permissionId: permission.id,
    directorAccountId: users.DIRECTOR.accountId,
    enrollmentId: finance.enrollment.id,
    saleConditionId: finance.condition.id,
  }),
);
const heartbeat = new WorkerHeartbeat(db, () => console.error('SMOKE_HEARTBEAT_FAILED'));
await heartbeat.start();
const { handler } = await import('../../api/dist/serverless.js');
const assets = new URL('../dist/', import.meta.url);
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path.startsWith('/api/') || path === '/health') {
    void handler(req, res);
    return;
  }
  const relative = path.startsWith('/assets/') ? path.slice(1) : 'index.html';
  if (relative.includes('..')) {
    res.writeHead(400).end();
    return;
  }
  const file = new URL(relative, assets);
  const mime = relative.endsWith('.js')
    ? 'text/javascript'
    : relative.endsWith('.css')
      ? 'text/css'
      : 'text/html';
  void readFile(fileURLToPath(file)).then(
    (data) => {
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
      res.end(data);
    },
    () => res.writeHead(404).end(),
  );
});
server.listen(3012, '127.0.0.1', () =>
  console.log(
    'QA smoke server on http://127.0.0.1:3012; synthetic fixture in .codex/task12-smoke.json',
  ),
);
process.once('SIGTERM', () => {
  void heartbeat.stop().finally(() => server.close(() => process.exit(0)));
});

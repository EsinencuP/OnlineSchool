// Run inside api: Get-Content -Raw infra/compose-smoke.mjs | docker compose exec -T api node --input-type=module
import assert from 'node:assert/strict';
import { createPoolClient } from '/workspace/packages/db/dist/index.js';

const result = createPoolClient();
assert.ok(result.ok);
try {
  const [identity] = await result.value.$queryRaw`SELECT current_user AS runtime,
    (SELECT rolname FROM pg_roles WHERE oid=(SELECT datdba FROM pg_database WHERE datname=current_database())) AS owner,
    (SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls FROM pg_roles WHERE rolname=current_user) AS elevated,
    pg_has_role(current_user,'app_migrate','MEMBER') AS migration_member,
    has_table_privilege(current_user,'audit_events','UPDATE') AS audit_update,
    has_table_privilege(current_user,'audit_events','DELETE') AS audit_delete,
    has_table_privilege(current_user,'file_audit_logs','UPDATE') AS file_audit_update,
    has_table_privilege(current_user,'ledger_entries','UPDATE') AS ledger_update,
    (SELECT relrowsecurity FROM pg_class WHERE oid='ledger_entries'::regclass) AS ledger_rls,
    runtime_migration_version() AS migration,
    (SELECT count(*)::int FROM roles) AS reference_roles,
    EXISTS(SELECT 1 FROM runtime_heartbeats WHERE stopped_at IS NULL AND last_seen_at>clock_timestamp()-interval '30 seconds') AS worker_live`;
  assert.equal(identity.runtime, 'app_runtime');
  assert.equal(identity.owner, 'app_migrate');
  for (const field of [
    'elevated',
    'migration_member',
    'audit_update',
    'audit_delete',
    'file_audit_update',
  ])
    assert.equal(identity[field], false);
  assert.equal(identity.ledger_update, true);
  assert.equal(identity.ledger_rls, true);
  assert.equal(identity.reference_roles, 5);
  assert.equal(identity.worker_live, true);
  assert.equal(identity.migration, '20261026080000_task12_qa_runtime');
  for (const endpoint of ['http://api:3000/health', 'http://nginx/health']) {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(5000) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).status, 'ok');
  }
  console.log(JSON.stringify({ task: 'TASK-13', runtime: identity, api: 200, nginx: 200 }));
} finally {
  await result.value.$disconnect();
}

// Owner-requested access setup. Runs only during a time-limited protected production build.
// Password plaintext is never supplied to Vercel, Git, audit, outbox or build logs.
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createDirectClient } from '../packages/db/dist/index.js';

export function managerSetupInput(env, now = Date.now()) {
  const until = Number(env.MANAGER_SETUP_UNTIL);
  if (
    env.VERCEL_ENV !== 'production' ||
    env.VERCEL_PROJECT_ID !== 'prj_XusYmdwL1Y0478T09RNKmBQMldgZ' ||
    !Number.isSafeInteger(until) ||
    until <= now ||
    until > now + 30 * 60_000
  )
    return null;
  const login = env.MANAGER_SETUP_LOGIN,
    hash = env.MANAGER_SETUP_PASSWORD_HASH;
  if (
    login !== 'manager@onlineschool.test' ||
    !/^\$scrypt\$v=1\$N=131072,r=8,p=1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{86}$/.test(hash ?? '')
  )
    throw new Error('MANAGER_SETUP_INVALID');
  return { login, hash };
}
export async function provisionOwnerManager(tx, input) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(120061240)`;
  const existing = await tx.authAccount.findUnique({
    where: { login_id: input.login },
    include: {
      staff_profile: true,
      role_assignments: { where: { valid_to: null }, include: { role: true } },
    },
  });
  if (existing) {
    if (
      existing.kind !== 'STAFF' ||
      existing.disabled_at ||
      !existing.staff_profile ||
      existing.staff_profile.deactivated_at ||
      existing.role_assignments.length !== 1 ||
      existing.role_assignments[0].role.code !== 'MANAGER' ||
      existing.password_hash !== input.hash
    )
      throw new Error('MANAGER_SETUP_LOGIN_COLLISION');
    return { status: 'already-provisioned', accountId: existing.id };
  }
  const [{ now }] = await tx.$queryRaw`SELECT clock_timestamp() AS now`;
  const director = await tx.staffAccount.findFirst({
    where: {
      deactivated_at: null,
      account: {
        disabled_at: null,
        role_assignments: {
          some: {
            role: { code: 'DIRECTOR' },
            valid_from: { lte: now },
            OR: [{ valid_to: null }, { valid_to: { gt: now } }],
          },
        },
      },
    },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  if (!director) throw new Error('MANAGER_SETUP_DIRECTOR_UNAVAILABLE');
  const role = await tx.role.findUnique({ where: { code: 'MANAGER' } });
  if (!role) throw new Error('MANAGER_SETUP_ROLE_UNAVAILABLE');
  const accountId = randomUUID(),
    operationId = randomUUID(),
    requestId = randomUUID();
  await tx.authAccount.create({
    data: { id: accountId, kind: 'STAFF', login_id: input.login, password_hash: input.hash },
  });
  await tx.staffAccount.create({
    data: { account_id: accountId, full_name: 'Менеджер академии', email: input.login },
  });
  await tx.roleAssignment.create({
    data: {
      account_id: accountId,
      role_id: role.id,
      assigned_by_staff_id: director.id,
      valid_from: now,
    },
  });
  const audit = await tx.auditEvent.create({
    data: {
      actor_kind: 'SYSTEM',
      system_actor_ref: 'owner-requested-manager-setup',
      action: 'identity.manager.provisioned',
      resource_type: 'AuthAccount',
      resource_id: accountId,
      result: 'SUCCESS',
      request_id: requestId,
      source_operation_id: operationId,
      event_key: `manager-owner-setup:${accountId}`,
      metadata: { role: 'MANAGER', mfaRequired: true },
    },
  });
  await tx.outboxEvent.create({
    data: {
      topic: 'identity.manager.provisioned.v1',
      aggregate_type: 'AuthAccount',
      aggregate_id: accountId,
      source_operation_id: operationId,
      audit_event_id: audit.id,
      event_key: `manager-owner-setup:${accountId}`,
      payload: { schemaVersion: 1, resourceId: accountId },
    },
  });
  return { status: 'provisioned', accountId };
}
async function main() {
  const input = managerSetupInput(process.env);
  if (!input) {
    console.log('Manager access setup skipped: no live scoped owner request');
    return;
  }
  const connection = createDirectClient();
  if (!connection.ok) throw new Error('MANAGER_SETUP_DATABASE_UNAVAILABLE');
  try {
    const result = await connection.value.$transaction((tx) => provisionOwnerManager(tx, input), {
      isolationLevel: 'Serializable',
      timeout: 15000,
    });
    console.log(
      `Owner manager ${result.status}; MANAGER only, first-device MFA enrollment required`,
    );
  } finally {
    await connection.value.$disconnect();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void main().catch(() => {
    console.error('MANAGER_SETUP_FAILED');
    process.exitCode = 1;
  });

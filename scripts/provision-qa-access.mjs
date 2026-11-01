// Explicit owner-requested QA logins. No student, lesson, payment or ledger records are created.
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createDirectClient } from '../packages/db/dist/index.js';

const allowed = new Map([
  ['DIRECTOR', 'qa.director@onlineschool.test'],
  ['TEACHER', 'qa.teacher@onlineschool.test'],
  ['TECH_OPERATOR', 'qa.tech@onlineschool.test'],
]);
export function qaSetupInput(env, now = Date.now()) {
  const until = Number(env.QA_ACCESS_SETUP_UNTIL);
  if (
    env.VERCEL_ENV !== 'production' ||
    env.VERCEL_PROJECT_ID !== 'prj_XusYmdwL1Y0478T09RNKmBQMldgZ' ||
    env.QA_PASSWORD_ONLY_LOGIN !== 'true' ||
    !Number.isSafeInteger(until) ||
    until <= now ||
    until > now + 30 * 60_000
  )
    return null;
  const rows = JSON.parse(env.QA_ACCESS_SETUP_HASHES ?? 'null');
  if (
    !Array.isArray(rows) ||
    rows.length !== allowed.size ||
    new Set(rows.map((r) => r.role)).size !== allowed.size ||
    rows.some(
      (r) =>
        allowed.get(r.role) !== r.login ||
        !/^\$scrypt\$v=1\$N=131072,r=8,p=1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{86}$/.test(
          r.hash ?? '',
        ),
    )
  )
    throw new Error('QA_ACCESS_SETUP_INVALID');
  return rows;
}

export async function provisionQaAccess(tx, rows) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(120061241)`;
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
    select: { id: true },
    orderBy: { id: 'asc' },
  });
  if (!director) throw new Error('QA_ACCESS_SETUP_DIRECTOR_UNAVAILABLE');
  const results = [];
  for (const row of rows) {
    const kind = row.role === 'TEACHER' ? 'TEACHER' : 'STAFF';
    const old = await tx.authAccount.findUnique({
      where: { login_id: row.login },
      include: {
        staff_profile: true,
        teacher_profile: true,
        role_assignments: { where: { valid_to: null }, include: { role: true } },
      },
    });
    if (old) {
      const profile = kind === 'TEACHER' ? old.teacher_profile : old.staff_profile;
      if (
        old.kind !== kind ||
        old.disabled_at ||
        old.password_hash !== row.hash ||
        !profile ||
        profile.deactivated_at ||
        old.role_assignments.length !== 1 ||
        old.role_assignments[0].role.code !== row.role
      )
        throw new Error('QA_ACCESS_SETUP_LOGIN_COLLISION');
      results.push({ role: row.role, status: 'already-provisioned' });
      continue;
    }
    const role = await tx.role.findUnique({ where: { code: row.role } });
    if (!role) throw new Error('QA_ACCESS_SETUP_ROLE_UNAVAILABLE');
    const id = randomUUID(),
      operationId = randomUUID();
    await tx.authAccount.create({
      data: { id, kind, login_id: row.login, password_hash: row.hash },
    });
    const data = { account_id: id, full_name: `QA ${row.role}`, email: row.login };
    if (kind === 'TEACHER') await tx.teacherAccount.create({ data });
    else await tx.staffAccount.create({ data });
    await tx.roleAssignment.create({
      data: {
        account_id: id,
        role_id: role.id,
        assigned_by_staff_id: director.id,
        valid_from: now,
      },
    });
    const audit = await tx.auditEvent.create({
      data: {
        actor_kind: 'SYSTEM',
        system_actor_ref: 'owner-requested-qa-access',
        action: 'identity.qa-access.provisioned',
        resource_type: 'AuthAccount',
        resource_id: id,
        result: 'SUCCESS',
        request_id: randomUUID(),
        source_operation_id: operationId,
        event_key: `qa-access:${id}`,
        metadata: { role: row.role, passwordOnly: true },
      },
    });
    await tx.outboxEvent.create({
      data: {
        topic: 'identity.qa-access.provisioned.v1',
        aggregate_type: 'AuthAccount',
        aggregate_id: id,
        source_operation_id: operationId,
        audit_event_id: audit.id,
        event_key: `qa-access:${id}`,
        payload: { schemaVersion: 1, resourceId: id },
      },
    });
    results.push({ role: row.role, status: 'provisioned' });
  }
  return results;
}

async function main() {
  const rows = qaSetupInput(process.env);
  if (!rows) return;
  const connection = createDirectClient();
  if (!connection.ok) throw new Error('QA_ACCESS_SETUP_DATABASE_UNAVAILABLE');
  try {
    const result = await connection.value.$transaction((tx) => provisionQaAccess(tx, rows), {
      isolationLevel: 'Serializable',
      timeout: 15000,
    });
    console.log(JSON.stringify({ qaAccess: result }));
  } finally {
    await connection.value.$disconnect();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void main().catch((error) => {
    const code = /^QA_ACCESS_SETUP_[A-Z_]+$/.test(error?.message ?? '')
      ? error.message
      : 'QA_ACCESS_SETUP_FAILED';
    console.error(code);
    process.exitCode = 1;
  });

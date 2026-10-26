// Privileged maintenance tool. This records an operator's completed out-of-band verification.
// The HTTP runtime role cannot insert recovery_authorizations.
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createDirectClient } from '../packages/db/dist/index.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function main() {
  if (process.argv.length !== 4 || process.argv[2] !== '--verified-evidence-file') {
    console.error(
      'Usage: node scripts/authorize-recovery.mjs --verified-evidence-file <protected-json-file>',
    );
    process.exitCode = 1;
    return;
  }
  const input = JSON.parse(await readFile(process.argv[3], 'utf8'));
  if (
    !input ||
    Object.keys(input).some(
      (k) =>
        ![
          'subjectAccountId',
          'authorizedActorId',
          'identityEvidenceRef',
          'ownerInstructionRef',
          'reason',
        ].includes(k),
    ) ||
    ![input.subjectAccountId, input.authorizedActorId].every(
      (id) => typeof id === 'string' && uuid.test(id),
    ) ||
    ![input.identityEvidenceRef, input.reason].every(
      (v) => typeof v === 'string' && v.trim().length >= 5 && v.length <= 200,
    ) ||
    (input.ownerInstructionRef !== undefined &&
      (typeof input.ownerInstructionRef !== 'string' ||
        input.ownerInstructionRef.length < 5 ||
        input.ownerInstructionRef.length > 200))
  ) {
    console.error('INVALID_VERIFIED_EVIDENCE');
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
    const result = await connection.value.$transaction(async (tx) => {
      const at = (await tx.$queryRaw`SELECT clock_timestamp() AS now`)[0].now;
      const record = await tx.recoveryAuthorization.create({
        data: {
          subject_account_id: input.subjectAccountId,
          authorized_actor_id: input.authorizedActorId,
          identity_evidence_ref: input.identityEvidenceRef,
          owner_instruction_ref: input.ownerInstructionRef ?? null,
          reason: input.reason,
          verified_at: at,
          expires_at: new Date(+at + 3600000),
          created_at: at,
          updated_at: at,
        },
      });
      await tx.auditEvent.create({
        data: {
          actor_kind: 'SYSTEM',
          system_actor_ref: 'verified-recovery-maintenance',
          action: 'recovery.authorization.recorded',
          resource_type: 'RecoveryAuthorization',
          resource_id: record.id,
          result: 'SUCCESS',
          request_id: randomUUID(),
          event_key: `recovery.authorization:${record.id}`,
        },
      });
      return record;
    });
    console.log(
      JSON.stringify({ authorizationId: result.id, expiresAt: result.expires_at.toISOString() }),
    );
  } finally {
    await connection.value.$disconnect();
  }
}
void main().catch(() => {
  console.error('RECOVERY_AUTHORIZATION_FAILED');
  process.exitCode = 1;
});

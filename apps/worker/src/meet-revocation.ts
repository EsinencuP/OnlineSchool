import { err, ok } from '@online-school/shared';
import {
  GoogleMeetOAuthClient,
  MeetSecretStore,
  readMeetOAuthConfig,
} from '@online-school/api/google-meet';
import type { Handler } from './contracts.js';
import { dbNow, systemAudit } from './contracts.js';

export const revokeDeactivatedMeetGrant: Handler = async (tx, event, now) => {
  const payload = event.payload as { teacherId?: unknown; generation?: unknown };
  if (
    payload?.teacherId !== event.aggregate_id ||
    typeof payload.generation !== 'number' ||
    !Number.isSafeInteger(payload.generation) ||
    payload.generation <= 0
  )
    return err({ code: 'MEET_REVOCATION_EVENT_INVALID' });

  await tx.$queryRaw`SELECT id FROM teacher_accounts WHERE id=${event.aggregate_id}::uuid FOR UPDATE`;
  const grant = await tx.teacherMeetOAuthGrant.findUnique({
    where: { teacher_id: event.aggregate_id },
  });
  if (
    !grant?.refresh_ciphertext ||
    !grant.disconnected_at ||
    grant.generation !== payload.generation
  )
    return ok(undefined);

  // The authenticated disconnect command may already hold a short external revocation claim.
  if (grant.revocation_claimed_at && +now - +grant.revocation_claimed_at < 30_000)
    return err({ code: 'MEET_REVOCATION_IN_PROGRESS' });
  const config = readMeetOAuthConfig(process.env);
  const secrets = MeetSecretStore.fromEnvironment(process.env);
  if (!config.ok || !secrets.ok) return err({ code: 'MEET_PROVIDER_NOT_CONFIGURED' });
  const token = secrets.value.open(grant.refresh_ciphertext, {
    purpose: 'refresh',
    teacherId: grant.teacher_id,
    googleSubject: grant.google_subject,
    generation: grant.generation,
  });
  if (!token.ok) return token;
  const provider = await new GoogleMeetOAuthClient(config.value).revoke(token.value);
  if (!provider.ok && provider.error.code !== 'OAUTH_AUTHORIZATION_REQUIRED') return provider;
  await tx.teacherMeetOAuthGrant.update({
    where: { teacher_id: grant.teacher_id },
    data: {
      refresh_ciphertext: null,
      provider_revoked_at: await dbNow(tx),
      revocation_claim_id: null,
      revocation_claimed_at: null,
    },
  });
  await systemAudit(tx, {
    key: `worker:meet-deactivation-revoked:${event.id}`,
    action: 'worker.meet-oauth.deactivation-revoked',
    resourceType: 'TeacherMeetOAuthGrant',
    resourceId: grant.teacher_id,
    operationId: event.source_operation_id,
  });
  return ok(undefined);
};

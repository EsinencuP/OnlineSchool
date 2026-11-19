import type {
  OutboxEvent,
  TeacherMeetOperation,
  TeacherMeetOAuthGrant,
  TeacherMeetSpace,
} from '@online-school/db';
import { err } from '@online-school/shared';
import type { Result } from '@online-school/shared';
import {
  activeMeetAssignment,
  GoogleMeetClient,
  GoogleMeetOAuthClient,
  MeetSecretStore,
  readMeetOAuthConfig,
} from '@online-school/api/google-meet';
import type { GoogleMeetSpace } from '@online-school/api/google-meet';
import type { Tx } from './contracts.js';
import { rollback, systemAudit } from './contracts.js';

type Grant = TeacherMeetOAuthGrant & { refresh_ciphertext: string };
export type MeetTicket = {
  op: TeacherMeetOperation;
  grant: Grant;
  space: TeacherMeetSpace | null;
  token: string;
};
type Failure = { code: string; retryAfterMs?: number };
export type MeetOutcome = Result<GoogleMeetSpace, Failure>;
const retryableRead = new Set([
  'RATE_LIMITED',
  'PROVIDER_UNAVAILABLE',
  'OAUTH_PROVIDER_UNAVAILABLE',
]);
const activeStates = ['QUEUED', 'DISPATCHING'];

function sameSource(
  op: TeacherMeetOperation | null,
  event: OutboxEvent,
): op is TeacherMeetOperation {
  return (
    !!op && op.id === event.aggregate_id && op.request_operation_id === event.source_operation_id
  );
}

async function lockOperation(tx: Tx, event: OutboxEvent): Promise<TeacherMeetOperation | null> {
  await tx.$queryRaw`SELECT id FROM teacher_meet_operations WHERE id=${event.aggregate_id}::uuid FOR UPDATE`;
  return tx.teacherMeetOperation.findUnique({ where: { id: event.aggregate_id } });
}

async function currentGrant(tx: Tx, op: TeacherMeetOperation, now: Date): Promise<Grant | null> {
  await tx.$queryRaw`SELECT id FROM teacher_accounts WHERE id=${op.teacher_id}::uuid FOR SHARE`;
  await tx.$queryRaw`SELECT id FROM teaching_assignments WHERE id=${op.assignment_id}::uuid FOR SHARE`;
  const assignment = await activeMeetAssignment(tx, op.assignment_id, op.teacher_id, now);
  if (assignment?.enrollment_ref.student_id !== op.student_id) return null;
  const credentials = await tx.teacherMeetOAuthGrant.findUnique({
    where: { teacher_id: op.teacher_id },
  });
  return credentials?.refresh_ciphertext &&
    !credentials.disconnected_at &&
    credentials.generation === op.grant_generation &&
    credentials.google_subject === op.google_subject
    ? { ...credentials, refresh_ciphertext: credentials.refresh_ciphertext }
    : null;
}

async function issue(
  tx: Tx,
  event: OutboxEvent,
  op: TeacherMeetOperation,
  now: Date,
  code: string,
) {
  const key = `meet-operation-review:${op.id}`;
  const manager = await tx.assignedManager.findFirst({
    where: {
      student_id: op.student_id,
      assigned_at: { lte: now },
      OR: [{ ended_at: null }, { ended_at: { gt: now } }],
    },
    orderBy: [{ assigned_at: 'desc' }, { id: 'asc' }],
    select: { manager_id: true },
  });
  await tx.crmTask.createMany({
    skipDuplicates: true,
    data: [
      {
        student_id: op.student_id,
        assigned_manager_id: manager?.manager_id ?? null,
        type: 'FOLLOW_UP',
        title: 'Сверить состояние ссылки Google Meet',
        due_at: now,
        source_event_id: event.id,
        idempotency_key: key,
        payload: { kind: 'MEET_OPERATION_REVIEW', operationId: op.id, code },
      },
    ],
  });
}

async function finish(
  tx: Tx,
  event: OutboxEvent,
  op: TeacherMeetOperation,
  now: Date,
  result: {
    state: 'SUCCEEDED' | 'FAILED' | 'UNKNOWN';
    code?: string;
    retryAt?: Date;
    spaceId?: string;
  },
) {
  await tx.teacherMeetOperation.update({
    where: { id: op.id },
    data: {
      state: result.state,
      finished_at: now,
      dispatch_token: null,
      diagnostic_code: result.code ?? null,
      retry_at: result.retryAt ?? null,
      ...(result.spaceId ? { space_id: result.spaceId } : {}),
    },
  });
  await systemAudit(tx, {
    key: `worker:meet:${op.id}:${result.state.toLowerCase()}`,
    action: `worker.meet-operation.${result.state.toLowerCase()}`,
    resourceType: 'TeacherMeetOperation',
    resourceId: op.id,
    operationId: op.request_operation_id,
    error: result.state !== 'SUCCEEDED',
  });
  if (
    result.state === 'UNKNOWN' ||
    (result.state === 'FAILED' &&
      !['RATE_LIMITED', 'AUTHORIZATION_REQUIRED', 'OAUTH_AUTHORIZATION_REQUIRED'].includes(
        result.code ?? '',
      ))
  )
    await issue(tx, event, op, now, result.code ?? 'MEET_REVIEW_REQUIRED');
}

/** Called in a separate committed transaction before any Google request. */
export async function prepareMeetOperation(
  tx: Tx,
  event: OutboxEvent,
  token: string,
  now: Date,
): Promise<MeetTicket | null> {
  const payload = event.payload as { resourceId?: unknown } | null;
  const op = await lockOperation(tx, event);
  if (payload?.resourceId !== event.aggregate_id || !sameSource(op, event))
    return rollback('MEET_EVENT_SOURCE_INVALID');
  if (!activeStates.includes(op.state)) return null;
  if (op.kind === 'CREATE' && op.state === 'DISPATCHING') {
    await finish(tx, event, op, now, {
      state: 'UNKNOWN',
      code: 'MEET_CREATE_DISPATCH_UNCONFIRMED',
    });
    return null;
  }
  const grant =
    process.env.GOOGLE_MEET_OAUTH_ENABLED === 'true' ? await currentGrant(tx, op, now) : null;
  if (!grant) {
    await finish(tx, event, op, now, {
      state: 'FAILED',
      code: 'MEET_GRANT_OR_ASSIGNMENT_UNAVAILABLE',
    });
    return null;
  }
  const space = op.space_id
    ? await tx.teacherMeetSpace.findFirst({
        where: {
          id: op.space_id,
          student_id: op.student_id,
          teacher_id: op.teacher_id,
          google_subject: op.google_subject,
          retired_at: null,
        },
      })
    : null;
  if (op.kind === 'VERIFY' && !space) {
    await finish(tx, event, op, now, { state: 'FAILED', code: 'MEET_SPACE_NOT_FOUND' });
    return null;
  }
  await tx.teacherMeetOperation.update({
    where: { id: op.id },
    data: { state: 'DISPATCHING', dispatch_token: token },
  });
  return { op, grant, space, token };
}

export async function confirmMeetDispatch(
  tx: Tx,
  ticket: MeetTicket,
  now: Date,
  rotated: string | null,
) {
  const op = await tx.teacherMeetOperation.findUnique({ where: { id: ticket.op.id } });
  if (op?.state !== 'DISPATCHING' || op.dispatch_token !== ticket.token) return false;
  const grant = await currentGrant(tx, op, now);
  if (!grant || grant.refresh_ciphertext !== ticket.grant.refresh_ciphertext) return false;
  if (rotated) {
    const changed = await tx.teacherMeetOAuthGrant.updateMany({
      where: {
        teacher_id: op.teacher_id,
        generation: op.grant_generation,
        disconnected_at: null,
        refresh_ciphertext: ticket.grant.refresh_ciphertext,
      },
      data: { refresh_ciphertext: rotated },
    });
    if (changed.count !== 1) return false;
  }
  return true;
}

export async function invokeMeetProvider(
  ticket: MeetTicket,
  confirm: (rotation: string | null) => Promise<boolean>,
): Promise<MeetOutcome> {
  const config = readMeetOAuthConfig(process.env);
  const secrets = MeetSecretStore.fromEnvironment(process.env);
  if (!config.ok || !secrets.ok) return err({ code: 'MEET_PROVIDER_NOT_CONFIGURED' });
  const op = ticket.op;
  const binding = {
    purpose: 'refresh' as const,
    teacherId: op.teacher_id,
    googleSubject: op.google_subject,
    generation: op.grant_generation,
  };
  const secret = secrets.value.open(ticket.grant.refresh_ciphertext, binding);
  if (!secret.ok) return secret;
  const oauth = new GoogleMeetOAuthClient(config.value);
  const refreshed = await oauth.refresh(secret.value);
  if (!refreshed.ok) return refreshed;
  const refresh = refreshed.value.refreshToken;
  const rotation =
    refresh && refresh !== secret.value ? secrets.value.seal(refresh, binding) : null;
  if (!(await confirm(rotation))) return err({ code: 'MEET_GRANT_OR_ASSIGNMENT_UNAVAILABLE' });
  const meet = new GoogleMeetClient();
  const access = refreshed.value.accessToken;
  if (op.kind === 'CREATE') return meet.createSpace(access);
  if (op.kind === 'VERIFY' && ticket.space)
    return meet.getSpace(access, ticket.space.resource_name);
  if (op.kind === 'RECONCILE' && op.candidate_code)
    return meet.checkMeetingCode(access, op.candidate_code);
  return err({ code: 'MEET_OPERATION_INVALID' });
}

const limitedDelay = (ms: number | undefined) => Math.min(86_400_000, Math.max(ms ?? 60_000, 1000));

/** Read-only provider calls are safe to retry. Ambiguous creates are settled for manual reconciliation. */
export function meetReadRetry(ticket: MeetTicket, result: MeetOutcome): Failure | null {
  if (ticket.op.kind === 'CREATE' || result.ok || !retryableRead.has(result.error.code))
    return null;
  return {
    code: result.error.code,
    ...(result.error.code === 'RATE_LIMITED'
      ? { retryAfterMs: limitedDelay(result.error.retryAfterMs) }
      : {}),
  };
}

export async function settleMeetOperation(
  tx: Tx,
  event: OutboxEvent,
  ticket: MeetTicket,
  now: Date,
  result: MeetOutcome,
) {
  const op = await lockOperation(tx, event);
  if (!sameSource(op, event) || op.state !== 'DISPATCHING' || op.dispatch_token !== ticket.token)
    return rollback('MEET_DISPATCH_LOST');
  if (!result.ok) {
    await finish(tx, event, op, now, {
      state: result.error.code === 'CREATE_OUTCOME_UNKNOWN' ? 'UNKNOWN' : 'FAILED',
      code: result.error.code,
      ...(result.error.code === 'RATE_LIMITED'
        ? { retryAt: new Date(+now + limitedDelay(result.error.retryAfterMs)) }
        : {}),
    });
    return;
  }
  const grant = await currentGrant(tx, op, now);
  const value = result.value;
  if (!grant || value.privacySettings !== 'DISABLED') {
    await finish(tx, event, op, now, {
      state: op.kind === 'CREATE' ? 'UNKNOWN' : 'FAILED',
      code: grant ? 'MEET_PRIVACY_NOT_CONFIRMED' : 'MEET_GRANT_OR_ASSIGNMENT_CHANGED',
    });
    return;
  }
  if (op.kind === 'VERIFY' && ticket.space) {
    if (ticket.space.meeting_uri !== value.meetingUri) {
      await finish(tx, event, op, now, { state: 'FAILED', code: 'MEET_URI_CHANGED' });
      return;
    }
    await tx.teacherMeetSpace.updateMany({
      where: { id: ticket.space.id, retired_at: null },
      data: { last_verified_at: now },
    });
    await finish(tx, event, op, now, { state: 'SUCCEEDED', spaceId: ticket.space.id });
    return;
  }
  const source = op.resolves_operation_id
    ? await tx.teacherMeetOperation.findFirst({
        where: { id: op.resolves_operation_id, state: 'UNKNOWN' },
      })
    : null;
  if (op.kind === 'RECONCILE' && !source) {
    await finish(tx, event, op, now, { state: 'FAILED', code: 'MEET_UNKNOWN_OPERATION_NOT_FOUND' });
    return;
  }

  const [space] = await tx.teacherMeetSpace.createManyAndReturn({
    skipDuplicates: true,
    data: [
      {
        student_id: op.student_id,
        teacher_id: op.teacher_id,
        google_subject: op.google_subject,
        resource_name: value.name,
        meeting_uri: value.meetingUri,
        published_at: now,
        last_verified_at: now,
      },
    ],
  });
  if (!space) {
    await finish(tx, event, op, now, {
      state: op.kind === 'CREATE' ? 'UNKNOWN' : 'FAILED',
      code: 'MEET_RESOURCE_IN_USE',
    });
    return;
  }
  if (source)
    await tx.teacherMeetOperation.update({
      where: { id: source.id },
      data: { state: 'RECONCILED', space_id: space.id },
    });
  await finish(tx, event, op, now, { state: 'SUCCEEDED', spaceId: space.id });
}

export async function deadMeetOperation(tx: Tx, event: OutboxEvent, now: Date, code: string) {
  const op = await lockOperation(tx, event);
  if (sameSource(op, event) && activeStates.includes(op.state))
    await finish(tx, event, op, now, {
      state: op.kind === 'CREATE' && op.state === 'DISPATCHING' ? 'UNKNOWN' : 'FAILED',
      code,
      ...(code === 'RATE_LIMITED' ? { retryAt: new Date(+now + limitedDelay(undefined)) } : {}),
    });
}

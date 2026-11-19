import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { randomBytes, randomUUID } from 'node:crypto';
import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { MeetSecretStore } from '../../apps/api/dist/modules/schedule/google-meet/meet-secret-store.js';
import {
  effectiveLessonMeetLinkSql,
  effectiveMeetLink,
} from '../../apps/api/dist/modules/schedule/meet-link.js';
import {
  meetReadRetry,
  prepareMeetOperation,
  settleMeetOperation,
} from '../../apps/worker/dist/meet-operations.js';
import { OutboxWorker } from '../../apps/worker/dist/outbox.js';
import { revokeDeactivatedMeetGrant } from '../../apps/worker/dist/meet-revocation.js';
import { TeacherMeetOperationsService } from '../../apps/api/dist/modules/teacher/teacher-meet-operations.service.js';
import { DirectorMeetController } from '../../apps/api/dist/modules/director/director-meet.controller.js';

const providerSpace = {
  name: 'spaces/GoogleResource123',
  meetingUri: 'https://meet.google.com/abc-defg-hij',
  meetingCode: 'abc-defg-hij',
};
const providerConfig = {
  accessType: 'RESTRICTED',
  attendanceReportGenerationType: 'DO_NOT_GENERATE',
  artifactConfig: {
    recordingConfig: { autoRecordingGeneration: 'OFF' },
    transcriptionConfig: { autoTranscriptionGeneration: 'OFF' },
    smartNotesConfig: { autoSmartNotesGeneration: 'OFF' },
  },
};

const environment = {
  GOOGLE_MEET_OAUTH_ENABLED: 'true',
  GOOGLE_MEET_CLIENT_ID: '1234-mock.apps.googleusercontent.com',
  GOOGLE_MEET_CLIENT_SECRET: 'mock-configuration',
  GOOGLE_MEET_REDIRECT_URI: 'https://school.example/callback',
  GOOGLE_MEET_ACTIVE_KEY_ID: 'test',
  GOOGLE_MEET_TOKEN_KEYS: JSON.stringify({ test: randomBytes(32).toString('base64url') }),
};
let prior;
beforeEach(() => {
  prior = Object.fromEntries(Object.keys(environment).map((key) => [key, process.env[key]]));
  Object.assign(process.env, environment);
});
afterEach(() => {
  jest.restoreAllMocks();
  for (const [key, value] of Object.entries(prior)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function fixture(kind = 'CREATE') {
  const now = new Date('2026-11-18T19:23:00Z');
  const op = {
    id: randomUUID(),
    student_id: randomUUID(),
    teacher_id: randomUUID(),
    assignment_id: randomUUID(),
    request_operation_id: randomUUID(),
    state: 'QUEUED',
    kind,
    queued_at: now,
    google_subject: 'google-teacher',
    grant_generation: 1,
    space_id: null,
    resolves_operation_id: null,
    candidate_code: null,
  };
  const event = {
    id: randomUUID(),
    topic: 'schedule.meet-operation.queued.v1',
    schema_version: 1,
    status: 'PENDING',
    aggregate_id: op.id,
    source_operation_id: op.request_operation_id,
    payload: { schemaVersion: 1, resourceId: op.id },
    attempts: 1,
    locked_by: 'first-claim',
    locked_until: new Date(+now + 30_000),
  };
  const grant = {
    generation: 1,
    google_subject: op.google_subject,
    teacher_id: op.teacher_id,
    disconnected_at: null,
    refresh_ciphertext: MeetSecretStore.fromEnvironment(process.env).value.seal('fake.refresh', {
      purpose: 'refresh',
      googleSubject: op.google_subject,
      teacherId: op.teacher_id,
      generation: 1,
    }),
  };
  const job = { id: randomUUID(), attempts: 1, max_attempts: 5 };
  const source = { id: randomUUID(), state: 'UNKNOWN' };
  const space = { id: randomUUID(), student_id: op.student_id, teacher_id: op.teacher_id };
  const phases = [];
  const tx = {
    $queryRaw: jest.fn(async (sql) => (sql.join('').includes('clock_timestamp') ? [{ now }] : [])),
    teachingAssignment: {
      findFirst: jest.fn(async () => ({
        id: op.assignment_id,
        enrollment_ref: { student_id: op.student_id },
      })),
    },
    teacherMeetOAuthGrant: {
      findUnique: jest.fn(async () => ({ ...grant })),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    teacherMeetOperation: {
      findUnique: jest.fn(async () => ({ ...op })),
      findFirst: jest.fn(async () => ({ ...source })),
      update: jest.fn(async ({ where, data }) =>
        Object.assign(where.id === source.id ? source : op, data),
      ),
    },
    teacherMeetSpace: {
      findFirst: jest.fn(async () => space),
      createManyAndReturn: jest.fn(async () => [space]),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    assignedManager: { findFirst: jest.fn(async () => null) },
    crmTask: { createMany: jest.fn() },
    auditEvent: { createMany: jest.fn() },
    outboxEvent: {
      findUniqueOrThrow: jest.fn(async () => ({ ...event })),
      update: jest.fn(async ({ data }) => Object.assign(event, data)),
    },
    jobAttempt: { update: jest.fn(), updateMany: jest.fn() },
    jobRecord: { update: jest.fn() },
  };
  let transactionOpen = false;
  const db = {
    $transaction: jest.fn(async (fn) => {
      transactionOpen = true;
      try {
        const result = await fn(tx);
        phases.push(op.state);
        return result;
      } finally {
        transactionOpen = false;
      }
    }),
  };
  return {
    tx,
    db,
    op,
    event,
    job,
    source,
    space,
    now,
    phases,
    isTransactionOpen: () => transactionOpen,
  };
}

test('the committed dispatch survives a crash after the creation response and a reclaimed event cannot create twice', async () => {
  const { tx, db, op, event, job, phases, isTransactionOpen } = fixture();
  tx.teacherMeetSpace.createManyAndReturn.mockRejectedValueOnce(
    new Error('failed before publication'),
  );
  const send = jest.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    expect(isTransactionOpen()).toBe(false);
    expect(phases).toContain('DISPATCHING');
    if (url === 'https://oauth2.googleapis.com/token') {
      return Response.json({ access_token: 'fake.access', token_type: 'Bearer', expires_in: 3600 });
    }
    expect(init.method).toBe('POST');
    return Response.json({ ...providerSpace, config: providerConfig });
  });
  const worker = new OutboxWorker(db, { maxAttempts: 5 });
  await worker.deliver({ event: { ...event }, job, token: 'first-claim' });
  expect(op.state).toBe('DISPATCHING');
  expect(event.status).toBe('PENDING');
  expect(send).toHaveBeenCalledTimes(2);
  Object.assign(event, {
    attempts: 2,
    locked_by: 'reclaimed',
    locked_until: new Date(+event.next_attempt_at + 30_000),
  });
  await worker.deliver({ event: { ...event }, job: { ...job, attempts: 2 }, token: 'reclaimed' });
  expect(op).toMatchObject({
    state: 'UNKNOWN',
    diagnostic_code: 'MEET_CREATE_DISPATCH_UNCONFIRMED',
  });
  expect(event.status).toBe('DELIVERED');
  expect(send).toHaveBeenCalledTimes(2);
  expect(tx.crmTask.createMany).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(tx.crmTask.createMany.mock.calls)).not.toContain(providerSpace.meetingUri);
});

test('an authorized reconciliation adopts the recovered resource and resolves the original attempt', async () => {
  const { tx, op, event, source, space, now } = fixture('RECONCILE');
  op.resolves_operation_id = source.id;
  op.candidate_code = providerSpace.meetingCode;
  const ticket = await prepareMeetOperation(tx, event, 'lease', now);
  await settleMeetOperation(tx, event, ticket, now, {
    ok: true,
    value: { ...providerSpace, privacySettings: 'DISABLED' },
  });
  expect(op).toMatchObject({ space_id: space.id, state: 'SUCCEEDED' });
  expect(source).toMatchObject({ space_id: space.id, state: 'RECONCILED' });
  expect(tx.teacherMeetSpace.createManyAndReturn).toHaveBeenCalledWith({
    skipDuplicates: true,
    data: [
      expect.objectContaining({
        student_id: op.student_id,
        teacher_id: op.teacher_id,
        resource_name: providerSpace.name,
        meeting_uri: providerSpace.meetingUri,
      }),
    ],
  });
});

test.each([
  [
    'changed assignment',
    (tx) => tx.teachingAssignment.findFirst.mockResolvedValue(null),
    'DISABLED',
  ],
  ['unverified privacy', () => {}, 'UNVERIFIED'],
])(
  'a created resource is held for review after %s instead of publishing',
  async (_, mutate, privacySettings) => {
    const { tx, op, event, now } = fixture();
    const ticket = await prepareMeetOperation(tx, event, 'lease', now);
    mutate(tx);
    await settleMeetOperation(tx, event, ticket, now, {
      ok: true,
      value: { ...providerSpace, privacySettings },
    });
    expect(tx.teacherMeetSpace.createManyAndReturn).not.toHaveBeenCalled();
    expect(op.state).toBe('UNKNOWN');
  },
);

test('retry honors the provider delay for a read and plans no automatic retry for a create', () => {
  const limited = { ok: false, error: { code: 'RATE_LIMITED', retryAfterMs: 90_000 } };
  expect(meetReadRetry({ op: { kind: 'CREATE' } }, limited)).toBeNull();
  expect(meetReadRetry({ op: { kind: 'VERIFY' } }, limited)).toMatchObject({
    code: 'RATE_LIMITED',
    retryAfterMs: 90_000,
  });
  expect(
    meetReadRetry(
      { op: { kind: 'RECONCILE' } },
      { ok: false, error: { code: 'PERMISSION_DENIED' } },
    ),
  ).toBeNull();
});

test('lesson link projection preserves an explicit null override, and selects the version by teacher and scheduled time', () => {
  const sql = effectiveLessonMeetLinkSql().sql;
  expect(sql).toMatch(/WHEN l\.meet_link_overridden THEN l\.google_meet_link/);
  expect(sql).toMatch(/m\.teacher_id=l\.scheduled_teacher_id/);
  expect(sql).toMatch(/m\.published_at<=l\.scheduled_at/);
  expect(sql).toMatch(/m\.retired_at>l\.scheduled_at/);
  expect(effectiveMeetLink(true, null, providerSpace.meetingUri)).toBeNull();
  expect(effectiveMeetLink(false, null, providerSpace.meetingUri)).toBe(providerSpace.meetingUri);
});

test('teacher creation requires a live owned assignment and a resolved previous attempt', async () => {
  const { tx, op } = fixture();
  const actor = {
    teacherId: op.teacher_id,
    sessionId: randomUUID(),
    accountId: randomUUID(),
    requestId: randomUUID(),
  };
  const service = new TeacherMeetOperationsService({});
  const unknown = { ...op, state: 'UNKNOWN' };
  tx.session = { findFirst: jest.fn(async () => ({ id: actor.sessionId })) };
  tx.teacherAccount = { findFirst: jest.fn(async () => ({ id: actor.teacherId })) };
  tx.teacherMeetSpace.findFirst.mockResolvedValue(null);
  tx.teacherMeetOperation.findFirst.mockImplementation(async ({ where }) =>
    where.state === 'UNKNOWN' ? unknown : null,
  );
  tx.teacherMeetOperation.create = jest.fn(async ({ data }) => ({ ...op, ...data }));
  const context = { tx, operationId: randomUUID() };

  await expect(
    service.queue(context, actor, op.assignment_id, { kind: 'CREATE' }),
  ).rejects.toMatchObject({
    domain: { code: 'MEET_CREATION_REQUIRES_RECONCILIATION' },
  });
  expect(tx.teacherMeetOperation.create).not.toHaveBeenCalled();
  await expect(
    service.queue(context, actor, op.assignment_id, {
      kind: 'RECONCILE',
      operationId: unknown.id,
      meetingUri: providerSpace.meetingUri,
    }),
  ).resolves.toMatchObject({ state: 'QUEUED', kind: 'RECONCILE' });
  expect(tx.teacherMeetOperation.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      teacher_id: actor.teacherId,
      student_id: op.student_id,
      resolves_operation_id: unknown.id,
      candidate_code: providerSpace.meetingCode,
      grant_generation: 1,
    }),
  });
  tx.teachingAssignment.findFirst.mockResolvedValueOnce(null);
  await expect(
    service.queue(context, { ...actor, teacherId: randomUUID() }, op.assignment_id, {
      kind: 'CREATE',
    }),
  ).rejects.toMatchObject({
    domain: { code: 'MEET_ASSIGNMENT_NOT_FOUND' },
  });
  expect(tx.teacherMeetOperation.create).toHaveBeenCalledTimes(1);
});

test('director decision records the basis for closing an unknown creation and cannot interfere with an active recovery', async () => {
  const { tx, op } = fixture();
  op.state = 'UNKNOWN';
  const staffId = randomUUID();
  const decision = new DirectorMeetController({}, { staff: async () => staffId });
  const context = { tx, actor: { role: 'DIRECTOR', mfaCompleted: true } };
  const dto = { basis: 'Reviewed test account history with organizer' };
  tx.teacherMeetOperation.updateMany = jest.fn(async () => ({ count: 1 }));
  await expect(decision.close(context, op.id, dto)).rejects.toMatchObject({
    domain: { code: 'MEET_OPERATION_PENDING' },
  });
  expect(tx.teacherMeetOperation.updateMany).not.toHaveBeenCalled();
  tx.teacherMeetOperation.findFirst.mockResolvedValue(null);
  await expect(decision.close(context, op.id, dto)).resolves.toEqual({
    id: op.id,
    state: 'CLOSED_WITHOUT_SPACE',
  });
  expect(tx.teacherMeetOperation.updateMany).toHaveBeenCalledWith({
    where: { id: op.id, state: 'UNKNOWN' },
    data: expect.objectContaining({ closed_by_id: staffId, closure_basis: dto.basis }),
  });
});

test('the departure event revokes only its disconnected credential generation and removes the encrypted token on confirmation', async () => {
  const { tx, op, event, now } = fixture();
  const stored = await tx.teacherMeetOAuthGrant.findUnique({});
  Object.assign(event, {
    aggregate_id: op.teacher_id,
    payload: { teacherId: op.teacher_id, generation: 1 },
  });
  const fetcher = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(null, { status: 200 }));
  tx.teacherMeetOAuthGrant.update = jest.fn();
  tx.teacherMeetOAuthGrant.findUnique.mockResolvedValueOnce({ ...stored, disconnected_at: null });
  expect((await revokeDeactivatedMeetGrant(tx, event, now)).ok).toBe(true);
  tx.teacherMeetOAuthGrant.findUnique.mockResolvedValueOnce({
    ...stored,
    disconnected_at: now,
    generation: 2,
  });
  expect((await revokeDeactivatedMeetGrant(tx, event, now)).ok).toBe(true);
  expect(fetcher).not.toHaveBeenCalled();
  tx.teacherMeetOAuthGrant.findUnique.mockResolvedValueOnce({ ...stored, disconnected_at: now });
  expect((await revokeDeactivatedMeetGrant(tx, event, now)).ok).toBe(true);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(tx.teacherMeetOAuthGrant.update).toHaveBeenCalledWith({
    where: { teacher_id: op.teacher_id },
    data: {
      refresh_ciphertext: null,
      provider_revoked_at: now,
      revocation_claim_id: null,
      revocation_claimed_at: null,
    },
  });
});

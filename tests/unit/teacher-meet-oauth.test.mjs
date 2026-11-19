import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { expect, jest, test } from '@jest/globals';
import { randomBytes, randomUUID } from 'node:crypto';
import { GoogleMeetOAuthClient } from '../../apps/api/dist/modules/schedule/google-meet/google-meet-oauth.js';
import { MeetSecretStore } from '../../apps/api/dist/modules/schedule/google-meet/meet-secret-store.js';
import { TeacherMeetOAuthService } from '../../apps/api/dist/modules/teacher/teacher-meet-oauth.service.js';

function fixture() {
  const now = new Date('2026-11-18T14:30:00Z');
  const actor = {
    teacherId: randomUUID(),
    accountId: randomUUID(),
    sessionId: randomUUID(),
    requestId: randomUUID(),
  };
  const data = { challenge: null, grant: null };
  const tx = {
    $queryRaw: jest.fn(async (sql) => (sql.join('').includes('clock_timestamp') ? [{ now }] : [])),
    session: { findFirst: jest.fn(async ({ where }) => ({ id: where.id })) },
    teacherAccount: { findFirst: jest.fn(async () => ({ id: actor.teacherId })) },
    teacherMeetOAuthChallenge: {
      upsert: jest.fn(async ({ create }) => (data.challenge = create)),
      findFirst: jest.fn(async ({ where }) => {
        const row = data.challenge;
        if (
          row?.session_id !== where.session_id ||
          row.state_hash !== where.state_hash ||
          row.expires_at <= now
        )
          return null;
        return (row.claimed_at === null) === (where.claimed_at === null) ? { ...row } : null;
      }),
      update: jest.fn(
        async ({ data: changes }) => (data.challenge = { ...data.challenge, ...changes }),
      ),
      delete: jest.fn(async () => {
        data.challenge = null;
      }),
      deleteMany: jest.fn(async () => {
        data.challenge = null;
      }),
    },
    teacherMeetOAuthGrant: {
      findUnique: jest.fn(async () => data.grant && { ...data.grant }),
      findFirst: jest.fn(async () => null),
      upsert: jest.fn(async ({ create }) => (data.grant = create)),
      update: jest.fn(async ({ data: changes }) => (data.grant = { ...data.grant, ...changes })),
      updateMany: jest.fn(async ({ where, data: changes }) => {
        if (data.grant?.revocation_claim_id !== where.revocation_claim_id) return { count: 0 };
        data.grant = { ...data.grant, ...changes };
        return { count: 1 };
      }),
    },
  };
  const run = async (fn) => ({ ok: true, value: await fn(tx) });
  const audit = { record: jest.fn() };
  const service = new TeacherMeetOAuthService(
    {
      runCritical: run,
      runReadOnly: async (fn) => fn(tx),
    },
    audit,
  );
  const client = new GoogleMeetOAuthClient({
    clientId: 'mock.apps.googleusercontent.com',
    clientSecret: 'mock-secret',
    redirectUri: 'https://school.example/callback',
  });
  const oauth = {
    authorization: jest.fn(() => client.authorization()),
    exchange: jest.fn(async () => ({
      ok: true,
      value: {
        subject: 'teacher-google',
        refreshToken: 'mock.refresh',
        accessToken: 'mock.access',
        expiresInSeconds: 3600,
      },
    })),
    revoke: jest.fn(async () => ({ ok: true, value: undefined })),
  };
  const secrets = MeetSecretStore.fromEnvironment({
    GOOGLE_MEET_ACTIVE_KEY_ID: 'test',
    GOOGLE_MEET_TOKEN_KEYS: JSON.stringify({ test: randomBytes(32).toString('base64url') }),
  }).value;
  jest.spyOn(service, 'available').mockReturnValue(true);
  jest.spyOn(service, 'runtime').mockReturnValue({ oauth, secrets });
  const start = async () => {
    const result = await service.start(actor);
    return new URL(result.authorizationUrl).searchParams.get('state');
  };
  return { service, actor, data, tx, oauth, audit, start, now, secrets };
}

test('OAuth requires the originating verified session and consumes its proof once', async () => {
  const { service, actor, data, tx, oauth, audit, start, secrets } = fixture();
  const state = await start();
  expect(JSON.stringify(data.challenge)).not.toContain(state);
  expect(data.challenge.verifier_ciphertext).not.toContain(
    oauth.authorization.mock.results[0].value.verifier,
  );
  await expect(
    service.complete({ ...actor, sessionId: randomUUID() }, state, 'mock-code'),
  ).rejects.toMatchObject({
    domain: { code: 'MEET_OAUTH_STATE_INVALID' },
  });
  expect(oauth.exchange).not.toHaveBeenCalled();
  await expect(service.complete(actor, state, 'mock-code')).resolves.toEqual({
    state: 'CONNECTED',
    available: true,
  });
  expect(tx.session.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        id: actor.sessionId,
        mfa_verified_at: { not: null },
        revoked_at: null,
      }),
    }),
  );
  expect(
    secrets.open(data.grant.refresh_ciphertext, {
      purpose: 'refresh',
      teacherId: actor.teacherId,
      googleSubject: 'teacher-google',
      generation: 1,
    }).value,
  ).toBe('mock.refresh');
  expect(JSON.stringify(data.grant)).not.toMatch(/mock\.refresh|mock\.access/);
  expect(JSON.stringify(audit.record.mock.calls)).not.toMatch(/mock\.refresh|mock\.access/);
  await expect(service.complete(actor, state, 'mock-code')).rejects.toMatchObject({
    domain: { code: 'MEET_OAUTH_STATE_INVALID' },
  });
  expect(oauth.exchange).toHaveBeenCalledTimes(1);
});

test('a session revoked during the provider exchange cannot install the returned credential', async () => {
  const { service, actor, tx, oauth, start, data } = fixture();
  const state = await start();
  tx.session.findFirst.mockResolvedValueOnce({ id: actor.sessionId }).mockResolvedValueOnce(null);
  await expect(service.complete(actor, state, 'mock-code')).rejects.toMatchObject({
    domain: { code: 'MEET_OAUTH_FORBIDDEN' },
  });
  expect(oauth.exchange).toHaveBeenCalledTimes(1);
  expect(data.grant).toBeNull();
});

test('disconnect marks local revocation first and a concurrent retry does not issue a second provider request', async () => {
  const { service, actor, data, oauth, start } = fixture();
  await service.complete(actor, await start(), 'mock-code');
  let finish;
  let observed;
  const dispatched = new Promise((resolve) => {
    observed = resolve;
  });
  oauth.revoke.mockImplementationOnce(() => {
    observed();
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const first = service.disconnect(actor);
  await dispatched;
  expect(data.grant.disconnected_at).toBeInstanceOf(Date);
  expect(data.grant.refresh_ciphertext).toBeTruthy();
  await expect(service.disconnect(actor)).resolves.toMatchObject({ state: 'REVOCATION_PENDING' });
  await expect(service.start(actor)).rejects.toMatchObject({
    domain: { code: 'MEET_OAUTH_REVOCATION_PENDING' },
  });
  expect(oauth.revoke).toHaveBeenCalledTimes(1);
  finish({ ok: true, value: undefined });
  await expect(first).resolves.toMatchObject({ state: 'DISCONNECTED' });
  expect(data.grant.refresh_ciphertext).toBeNull();
});

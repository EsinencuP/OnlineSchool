import { createHash, randomBytes } from 'node:crypto';
import { expect, jest, test } from '@jest/globals';
import {
  GoogleMeetClient,
  GOOGLE_MEET_CREATED_SCOPE,
} from '../../apps/api/dist/modules/schedule/google-meet/google-meet-client.js';
import {
  GoogleMeetOAuthClient,
  meetOAuthStateHash,
  readMeetOAuthConfig,
} from '../../apps/api/dist/modules/schedule/google-meet/google-meet-oauth.js';
import { MeetSecretStore } from '../../apps/api/dist/modules/schedule/google-meet/meet-secret-store.js';

const token = 'owner.test.token';
const space = {
  name: 'spaces/OwnedResource12',
  meetingCode: 'abc-defg-hij',
  meetingUri: 'https://meet.google.com/abc-defg-hij',
};
const config = {
  accessType: 'RESTRICTED',
  attendanceReportGenerationType: 'DO_NOT_GENERATE',
  artifactConfig: {
    recordingConfig: { autoRecordingGeneration: 'OFF' },
    transcriptionConfig: { autoTranscriptionGeneration: 'OFF' },
    smartNotesConfig: { autoSmartNotesGeneration: 'OFF' },
  },
};

test('space creation uses the owner token, sends only the privacy configuration and strips other metadata', async () => {
  const request = jest.fn(async () =>
    Response.json({
      ...space,
      config,
      activeConference: { conferenceRecord: 'private' },
      phoneAccess: [{ pin: 'private' }],
    }),
  );
  const result = await new GoogleMeetClient(request).createSpace(token);
  expect(result).toEqual({ ok: true, value: { ...space, privacySettings: 'DISABLED' } });
  expect(request).toHaveBeenCalledTimes(1);
  const [url, init] = request.mock.calls[0];
  expect(new URL(url).origin).toBe('https://meet.googleapis.com');
  expect(new URL(url).pathname).toBe('/v2/spaces');
  expect(init).toMatchObject({
    method: 'POST',
    redirect: 'error',
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(JSON.parse(init.body)).toEqual({ config });
});

test.each([
  [
    'timeout',
    () => {
      throw new DOMException('Timeout', 'TimeoutError');
    },
  ],
  [
    'network',
    () => {
      throw new Error('opaque transport failure');
    },
  ],
  ['503', () => new Response(null, { status: 503 })],
  ['409', () => new Response(null, { status: 409 })],
  ['malformed success', () => Response.json({ ...space, meetingUri: 'https://other.invalid' })],
])('a create with %s returns an unknown outcome after a single call', async (_, makeResponse) => {
  const request = jest.fn(async () => makeResponse());
  expect(await new GoogleMeetClient(request).createSpace(token)).toMatchObject({
    ok: false,
    error: { code: 'CREATE_OUTCOME_UNKNOWN' },
  });
  expect(request).toHaveBeenCalledTimes(1);
});

test('the adapter distinguishes revoked authorization, provider access denial, throttling and missing references', async () => {
  const request = jest
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(new Response(null, { status: 403 }))
    .mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '3' } }))
    .mockResolvedValueOnce(new Response(null, { status: 404 }))
    .mockResolvedValueOnce(new Response(null, { status: 404 }));
  const client = new GoogleMeetClient(request);
  expect((await client.createSpace(token)).error.code).toBe('AUTHORIZATION_REQUIRED');
  expect((await client.getSpace(token, space.name)).error.code).toBe('PERMISSION_DENIED');
  expect((await client.createSpace(token)).error).toEqual({
    code: 'RATE_LIMITED',
    httpStatus: 429,
    retryAfterMs: 3000,
  });
  expect((await client.getSpace(token, space.name)).error.code).toBe('RESOURCE_NOT_FOUND');
  expect((await client.checkMeetingCode(token, space.meetingCode)).error.code).toBe(
    'REFERENCE_UNVERIFIED',
  );
});

test('a space must match the requested identity, and missing privacy settings are unverified', async () => {
  const request = jest.fn(async () => Response.json(space));
  const client = new GoogleMeetClient(request);
  expect((await client.getSpace(token, 'spaces/../spaces/Other')).error.code).toBe(
    'INVALID_REFERENCE',
  );
  expect((await client.getSpace(token, `spaces/${space.meetingCode}`)).error.code).toBe(
    'INVALID_REFERENCE',
  );
  expect((await client.getSpace('invalid\nheader', space.name)).error.code).toBe(
    'AUTHORIZATION_REQUIRED',
  );
  expect(request).not.toHaveBeenCalled();
  expect((await client.getSpace(token, 'spaces/OtherSpace')).error.code).toBe(
    'UNEXPECTED_RESPONSE',
  );
  expect((await client.checkMeetingCode(token, 'xyz-wxyz-xyz')).error.code).toBe(
    'UNEXPECTED_RESPONSE',
  );
  expect((await client.getSpace(token, space.name)).value.privacySettings).toBe('UNVERIFIED');
});

const oauthConfig = {
  clientId: '1234-mock.apps.googleusercontent.com',
  clientSecret: 'mock-secret-value',
  redirectUri: 'https://school.example/oauth/google-meet',
};
const exchangeReply = {
  access_token: 'test.access',
  refresh_token: 'test.refresh',
  token_type: 'Bearer',
  expires_in: 3599,
  scope: `openid ${GOOGLE_MEET_CREATED_SCOPE}`,
};

test('authorization generates fresh state and S256 proof using only the requested Meet and identity scopes', () => {
  const oauth = new GoogleMeetOAuthClient(oauthConfig);
  const proof = oauth.authorization();
  const url = new URL(proof.authorizationUrl);
  expect(url.origin).toBe('https://accounts.google.com');
  expect(url.searchParams.get('scope')).toBe(`openid ${GOOGLE_MEET_CREATED_SCOPE}`);
  expect(url.searchParams.get('access_type')).toBe('offline');
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  expect(url.searchParams.get('code_challenge')).toBe(
    createHash('sha256').update(proof.verifier).digest('base64url'),
  );
  expect(proof.stateHash).toBe(meetOAuthStateHash(url.searchParams.get('state')));
  expect(proof.authorizationUrl).not.toContain(oauthConfig.clientSecret);
  expect(proof.authorizationUrl).not.toContain(proof.verifier);
  expect(oauth.authorization().stateHash).not.toBe(proof.stateHash);
  expect(readMeetOAuthConfig({}).error.code).toBe('OAUTH_NOT_CONFIGURED');
});

test('authorization exchange binds to the Google subject and keeps the proof and secret in the request body', async () => {
  const request = jest
    .fn()
    .mockResolvedValueOnce(Response.json(exchangeReply))
    .mockResolvedValueOnce(
      Response.json({ sub: 'google-owner-id', email: 'not-collected@example.invalid' }),
    );
  const oauth = new GoogleMeetOAuthClient(oauthConfig, request);
  const { verifier } = oauth.authorization();
  expect(await oauth.exchange('4/mock-code', verifier)).toEqual({
    ok: true,
    value: {
      accessToken: 'test.access',
      refreshToken: 'test.refresh',
      subject: 'google-owner-id',
      expiresInSeconds: 3599,
    },
  });
  const [url, init] = request.mock.calls[0];
  expect(url).toBe('https://oauth2.googleapis.com/token');
  expect(init.redirect).toBe('error');
  expect(init.body.get('code_verifier')).toBe(verifier);
  expect(init.body.get('redirect_uri')).toBe(oauthConfig.redirectUri);
  expect(request.mock.calls[1][0]).toBe('https://openidconnect.googleapis.com/v1/userinfo');
});

test('OAuth rejects unexpected scopes and reports expired refresh tokens, while revocation uses a POST body', async () => {
  const request = jest
    .fn()
    .mockResolvedValueOnce(
      Response.json({ ...exchangeReply, scope: exchangeReply.scope + ' profile' }),
    )
    .mockResolvedValueOnce(
      Response.json({ error: 'invalid_grant', error_description: 'not logged' }, { status: 400 }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 200 }));
  const oauth = new GoogleMeetOAuthClient(oauthConfig, request);
  expect((await oauth.exchange('4/mock-code', oauth.authorization().verifier)).error.code).toBe(
    'OAUTH_SCOPE_MISMATCH',
  );
  expect(await oauth.refresh('test.refresh')).toEqual({
    ok: false,
    error: { code: 'OAUTH_AUTHORIZATION_REQUIRED' },
  });
  expect(await oauth.revoke('test.refresh')).toEqual({ ok: true, value: undefined });
  expect(request.mock.calls[2][0]).toBe('https://oauth2.googleapis.com/revoke');
  expect(request.mock.calls[2][1].body.get('token')).toBe('test.refresh');
});

test('encrypted credentials cannot be moved to a different teacher, generation, Google identity or secret purpose', () => {
  const keys = {
    old: randomBytes(32).toString('base64url'),
    next: randomBytes(32).toString('base64url'),
  };
  const store = (keyId, source = keys) =>
    MeetSecretStore.fromEnvironment({
      GOOGLE_MEET_ACTIVE_KEY_ID: keyId,
      GOOGLE_MEET_TOKEN_KEYS: JSON.stringify(source),
    }).value;
  const original = store('old');
  const owner = {
    purpose: 'refresh',
    teacherId: 'teacher-1',
    googleSubject: 'google-owner',
    generation: 1,
  };
  const sealed = original.seal('private-refresh-token', owner);
  expect(original.seal('private-refresh-token', owner)).not.toBe(sealed);
  expect(sealed).not.toContain('private-refresh-token');
  const rotated = store('next');
  expect(rotated.open(sealed, owner)).toEqual({ ok: true, value: 'private-refresh-token' });
  expect(rotated.seal('private-refresh-token', owner)).toMatch(/^v1\.next\./);
  for (const binding of [
    { ...owner, teacherId: 'teacher-2' },
    { ...owner, googleSubject: 'other-google' },
    { ...owner, generation: 2 },
    { purpose: 'pkce', teacherId: owner.teacherId, sessionId: 'session', stateHash: 'hash' },
  ])
    expect(rotated.open(sealed, binding)).toMatchObject({
      ok: false,
      error: { code: 'MEET_SECRET_UNREADABLE' },
    });
  const tampered = sealed.replace(
    /\.([A-Za-z0-9_-])([A-Za-z0-9_-]+)$/,
    (_, first, rest) => `.${first === 'a' ? 'b' : 'a'}${rest}`,
  );
  expect(rotated.open(tampered, owner).ok).toBe(false);
  expect(store('next', { next: keys.next }).open(sealed, owner).ok).toBe(false);
});

import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { NestFactory } from '@nestjs/core';
import { createDirectClient } from '@online-school/db';
import { AppModule } from '../../dist/app.module.js';
import { Passwords } from '../../dist/modules/identity/passwords.js';
import { SessionStore, CSRF_COOKIE, tokenHash } from '../../dist/core/session/session.store.js';
import { QA, qaId, seedQA } from '../../../../packages/db/dist-tools/seed.js';
import { authenticator } from './webauthn-authenticator.mjs';

const url = process.env.IDENTITY_TEST_DATABASE_URL;
assert.ok(
  url,
  'IDENTITY_TEST_DATABASE_URL must name a separate disposable local PostgreSQL 18 database',
);
const target = new URL(url);
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname));
assert.match(target.pathname, /^\/online_school_test[a-z0-9_]*$/);
process.env.DATABASE_URL = url;
process.env.CSRF_SIGNING_SECRET = randomBytes(48).toString('base64url');
process.env.WEBAUTHN_RP_ID = 'qa.school.test';
process.env.WEBAUTHN_ALLOWED_ORIGIN = 'https://qa.school.test';
const client = createDirectClient({ DIRECT_URL: url }).value;
const password = 'Synthetic-identity-test-2026!';
let app, base, store, techId, directorId, otherDirectorId, passwordHash;
const jars = {},
  keys = {};
const loginFor = (label) => `${label}@online-school.invalid`;
class Jar {
  cookies = new Map();
  async call(path, { method = 'POST', body = {}, csrf = true, key, headers = {} } = {}) {
    const h = { ...headers, cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join(';') };
    if (method !== 'GET') {
      h['content-type'] = 'application/json';
      if (csrf && this.cookies.has(CSRF_COOKIE)) h['x-csrf-token'] = this.cookies.get(CSRF_COOKIE);
    }
    if (key) h['idempotency-key'] = key;
    const response = await fetch(base + path, {
      method,
      headers: h,
      ...(method !== 'GET' ? { body: JSON.stringify(body) } : {}),
    });
    for (const value of response.headers.getSetCookie()) {
      const first = value.split(';')[0],
        at = first.indexOf('=');
      const name = first.slice(0, at),
        token = first.slice(at + 1);
      if (/Max-Age=0(?:;|$)/i.test(value)) this.cookies.delete(name);
      else this.cookies.set(name, token);
    }
    assert.ok(response.headers.get('x-request-id'));
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const data = await response.json();
    return { status: response.status, body: data, headers: response.headers };
  }
  async bootstrap() {
    const response = await this.call('/api/v1/auth/csrf', { method: 'GET' });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    return this;
  }
  async login(login) {
    await this.bootstrap();
    const result = await this.call('/api/v1/auth/session', { body: { email: login, password } });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result;
  }
}
async function trustedSession(accountId) {
  const jar = new Jar();
  const issued = await client.$transaction(async (tx) =>
    store.issue(tx, accountId, (await tx.$queryRaw`SELECT clock_timestamp() AS now`)[0].now),
  );
  store.cookies(
    {
      setHeader: (_name, values) => {
        for (const value of values) {
          const [pair] = value.split(';');
          const at = pair.indexOf('=');
          jar.cookies.set(pair.slice(0, at), pair.slice(at + 1));
        }
      },
    },
    issued,
  );
  return jar;
}
async function profile(role, label) {
  const account = await client.authAccount.create({
    data: { kind: 'STAFF', login_id: loginFor(label), password_hash: passwordHash },
  });
  await client.staffAccount.create({
    data: { account_id: account.id, full_name: 'Synthetic recovery actor' },
  });
  const roleRow = await client.role.findUniqueOrThrow({ where: { code: role } });
  await client.roleAssignment.create({
    data: { account_id: account.id, role_id: roleRow.id, valid_from: new Date('2026-10-01Z') },
  });
  return account.id;
}
async function authorization(subject, actor, ownerInstruction) {
  const at = (await client.$queryRaw`SELECT clock_timestamp() AS now`)[0].now;
  return client.recoveryAuthorization.create({
    data: {
      subject_account_id: subject,
      authorized_actor_id: actor,
      identity_evidence_ref: 'synthetic-identity-case-001',
      owner_instruction_ref: ownerInstruction ?? null,
      reason: 'Synthetic verified recovery evidence',
      verified_at: at,
      expires_at: new Date(+at + 3600000),
      created_at: at,
      updated_at: at,
    },
  });
}
before(async () => {
  assert.equal((await seedQA(client)).ok, true);
  const hashed = await new Passwords().hash(password);
  assert.equal(hashed.ok, true);
  passwordHash = hashed.value;
  for (const label of [
    'seed-director-001',
    'seed-manager-001',
    'seed-manager-002',
    'seed-teacher-001',
    'seed-teacher-002',
  ])
    await client.authAccount.update({
      where: { id: qaId(`${label}/auth`) },
      data: { password_hash: passwordHash },
    });
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
  store = app.get(SessionStore);
  directorId = qaId('seed-director-001/auth');
  techId = await profile('TECH_OPERATOR', `tech-${randomUUID()}`);
  otherDirectorId = await profile('DIRECTOR', `director-${randomUUID()}`);
  jars.director = await trustedSession(directorId);
  jars.tech = await trustedSession(techId);
});
after(async () => {
  await app?.close();
  await client.$disconnect();
});

test('password login is stage one; current/logout work and no unauthenticated/MFA-free business access', async () => {
  const anonymous = await new Jar().bootstrap();
  assert.equal(
    (
      await anonymous.call('/api/v1/students', {
        body: { fullName: 'Synthetic unpaid' },
        key: randomUUID(),
      })
    ).status,
    401,
  );
  const invalid = await anonymous.call('/api/v1/auth/session', {
    body: { email: 'absent@online-school.invalid', password: 'incorrect' },
  });
  assert.equal(invalid.status, 401);
  assert.equal(invalid.body.code, 'INVALID_CREDENTIALS');
  const jar = new Jar();
  const logged = await jar.login(loginFor('seed-manager-001'));
  assert.equal(logged.body.mfa_completed, false);
  assert.match(logged.headers.getSetCookie()[0], /HttpOnly; Secure; SameSite=Strict/);
  assert.equal(
    (await jar.call('/api/v1/auth/session', { method: 'GET' })).body.mfa_completed,
    false,
  );
  assert.equal(
    (
      await jar.call('/api/v1/students', {
        key: randomUUID(),
        body: { fullName: 'Synthetic blocked' },
      })
    ).body.code,
    'MFA_REQUIRED',
  );
  assert.equal((await jar.call('/api/v1/auth/session', { method: 'DELETE' })).status, 200);
  assert.equal((await jar.call('/api/v1/auth/session', { method: 'GET' })).status, 401);
});
test('staff and teacher register genuine ES256 passkeys, authenticate, update counters and rotate sessions', async () => {
  for (const [name, label] of [
    ['manager', 'seed-manager-001'],
    ['teacher', 'seed-teacher-001'],
  ]) {
    const jar = new Jar();
    await jar.login(loginFor(label));
    const before = jar.cookies.get('__Host-school_session');
    const key = authenticator();
    const start = await jar.call('/api/v1/auth/webauthn/register/start');
    assert.equal(start.status, 200, JSON.stringify(start.body));
    assert.equal(start.body.options.authenticatorSelection.userVerification, 'required');
    assert.equal(Buffer.from(start.body.options.challenge, 'base64url').length, 32);
    const registered = await jar.call('/api/v1/auth/webauthn/register/finish', {
      body: key.registration(start.body),
    });
    assert.equal(registered.status, 200, JSON.stringify(registered.body));
    assert.equal(registered.body.mfa_completed, false);
    const auth = await jar.call('/api/v1/auth/webauthn/authenticate/start');
    assert.equal(auth.status, 200);
    const finished = await jar.call('/api/v1/auth/webauthn/authenticate/finish', {
      body: key.authentication(auth.body),
    });
    assert.equal(finished.status, 200, JSON.stringify(finished.body));
    assert.equal(finished.body.mfa_completed, true);
    assert.notEqual(jar.cookies.get('__Host-school_session'), before);
    const dbKey = await client.webAuthnCredential.findUniqueOrThrow({
      where: { credential_id: Buffer.from(key.id, 'base64url') },
    });
    assert.equal(dbKey.sign_count, 1n);
    assert.ok(
      (await client.session.findUniqueOrThrow({ where: { token_hash: tokenHash(before) } }))
        .revoked_at,
    );
    jars[name] = jar;
    keys[name] = key;
  }
});
test('wrong origin, RP, UV and signature fail with audit; failures do not consume challenge or mutate counter', async () => {
  const jar = jars.manager,
    key = keys.manager;
  const start = await jar.call('/api/v1/auth/webauthn/authenticate/start');
  for (const option of [
    { origin: 'https://preview-example.vercel.app' },
    { rpId: 'wrong.school.test' },
    { uv: false },
    { wrongSignature: true },
  ]) {
    const result = await jar.call('/api/v1/auth/webauthn/authenticate/finish', {
      body: key.authentication(start.body, { counter: 2, ...option }),
    });
    assert.equal(result.status, 400, JSON.stringify(result.body));
    const audit = await client.auditEvent.findFirst({
      where: { request_id: result.headers.get('x-request-id'), result: 'DENIED' },
    });
    assert.ok(audit);
    if (option.origin) assert.equal(audit.metadata.code, 'WEBAUTHN_ORIGIN_INVALID');
    assert.equal(
      (await client.mfaChallenge.findUniqueOrThrow({ where: { id: start.body.challengeId } }))
        .used_at,
      null,
    );
  }
  assert.equal(
    (
      await jar.call('/api/v1/auth/webauthn/authenticate/finish', {
        body: key.authentication(start.body, { counter: 2 }),
      })
    ).status,
    200,
  );
  const replay = await jar.call('/api/v1/auth/webauthn/authenticate/finish', {
    body: key.authentication(start.body, { counter: 3 }),
  });
  assert.equal(replay.status, 400);
  const next = await jar.call('/api/v1/auth/webauthn/authenticate/start');
  assert.equal(
    (
      await jar.call('/api/v1/auth/webauthn/authenticate/finish', {
        body: key.authentication(next.body, { counter: 2 }),
      })
    ).status,
    400,
  );
});
test('registration checks origin/UV and zero-counter passkeys remain protected against challenge replay', async () => {
  const jar = new Jar();
  await jar.login(loginFor('seed-teacher-002'));
  const key = authenticator();
  const start = await jar.call('/api/v1/auth/webauthn/register/start');
  assert.equal(start.status, 200);
  for (const options of [{ origin: 'https://untrusted.school.test' }, { uv: false }]) {
    const rejected = await jar.call('/api/v1/auth/webauthn/register/finish', {
      body: key.registration(start.body, options),
    });
    assert.equal(rejected.status, 400);
    assert.ok(
      await client.auditEvent.findFirst({
        where: { request_id: rejected.headers.get('x-request-id'), result: 'DENIED' },
      }),
    );
  }
  assert.equal(
    (
      await jar.call('/api/v1/auth/webauthn/register/finish', {
        body: key.registration(start.body),
      })
    ).status,
    200,
  );
  for (let n = 0; n < 2; n++) {
    const auth = await jar.call('/api/v1/auth/webauthn/authenticate/start');
    const body = key.authentication(auth.body, { counter: 0 });
    assert.equal(
      (await jar.call('/api/v1/auth/webauthn/authenticate/finish', { body })).status,
      200,
    );
    assert.equal(
      (await jar.call('/api/v1/auth/webauthn/authenticate/finish', { body })).status,
      400,
    );
  }
  assert.equal(
    (
      await client.webAuthnCredential.findUniqueOrThrow({
        where: { credential_id: Buffer.from(key.id, 'base64url') },
      })
    ).sign_count,
    0n,
  );
});
test('password-only login cannot add a key when an active staff key already exists', async () => {
  const jar = new Jar();
  await jar.login(loginFor('seed-manager-001'));
  assert.equal((await jar.call('/api/v1/auth/webauthn/register/start')).body.code, 'MFA_REQUIRED');
});
test('passkey-only login binds a public challenge to the issuing browser and checks userHandle', async () => {
  const jar = await new Jar().bootstrap();
  const start = await jar.call('/api/v1/auth/session', {
    body: { method: 'passkey', email: loginFor('seed-manager-001') },
  });
  assert.equal(start.status, 200);
  assert.ok(!start.body.options.allowCredentials?.length);
  const key = keys.manager,
    body = key.authentication(start.body, { counter: 3 });
  const other = await new Jar().bootstrap();
  assert.equal(
    (await other.call('/api/v1/auth/webauthn/authenticate/finish', { body })).status,
    400,
  );
  assert.equal(
    (
      await jar.call('/api/v1/auth/webauthn/authenticate/finish', {
        body: key.authentication(start.body, {
          counter: 3,
          userHandle: Buffer.from('wrong-user').toString('base64url'),
        }),
      })
    ).status,
    400,
  );
  const result = await jar.call('/api/v1/auth/webauthn/authenticate/finish', { body });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.mfa_completed, true);
  jars.manager = jar;
});
test('two concurrent signed assertions cannot reuse a challenge', async () => {
  const jar = jars.manager,
    start = await jar.call('/api/v1/auth/webauthn/authenticate/start');
  const body = keys.manager.authentication(start.body, { counter: 4 });
  const clone = new Jar();
  clone.cookies = new Map(jar.cookies);
  const results = await Promise.all(
    [jar, clone].map((j) => j.call('/api/v1/auth/webauthn/authenticate/finish', { body })),
  );
  assert.equal(results.filter((r) => r.status === 200).length, 1, JSON.stringify(results));
  assert.ok(results.some((r) => [400, 401].includes(r.status)));
  if (results[0].status !== 200) jars.manager = clone;
});
test('CRM creates stable Student only, with manager assignment; Household grants no unrelated access', async () => {
  const jar = jars.manager,
    key = randomUUID();
  const input = { fullName: 'Synthetic registry identity', email: 'family@online-school.invalid' };
  const student = await jar.call('/api/v1/students', { key, body: input });
  assert.equal(student.status, 200, JSON.stringify(student.body));
  assert.deepEqual((await jar.call('/api/v1/students', { key, body: input })).body, student.body);
  assert.equal(await client.studentAccount.count({ where: { student_id: student.body.id } }), 0);
  assert.equal(
    await client.assignedManager.count({
      where: { student_id: student.body.id, manager_id: QA.managers[0] },
    }),
    1,
  );
  assert.equal(
    (await jars.teacher.call('/api/v1/students', { key: randomUUID(), body: input })).status,
    403,
  );
  const household = await jar.call('/api/v1/households', {
    key: randomUUID(),
    body: { label: 'Synthetic household' },
  });
  assert.equal(household.status, 200);
  const member = await jar.call(`/api/v1/households/${household.body.id}/members`, {
    key: randomUUID(),
    body: { studentId: student.body.id, basis: 'Synthetic family grouping' },
  });
  assert.equal(member.status, 200, JSON.stringify(member.body));
  assert.equal(
    (
      await jar.call(`/api/v1/households/${household.body.id}/members`, {
        key: randomUUID(),
        body: { studentId: QA.students[1], basis: 'Unassigned child attempt' },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await jar.call(`/api/v1/households/${household.body.id}/members`, {
        key: randomUUID(),
        body: {
          studentId: student.body.id,
          representativeId: randomUUID(),
          basis: 'Invalid mixed member',
        },
      })
    ).status,
    400,
  );
});
test('staff recovery requires trusted evidence, revokes sessions/keys and yields registration-only single-use bootstrap', async () => {
  const subject = qaId('seed-manager-001/auth');
  const invalid = await jars.director.call('/api/v1/auth/recovery/initiate', {
    key: randomUUID(),
    body: { authorizationId: randomUUID() },
  });
  assert.equal(invalid.status, 403);
  assert.equal(
    (
      await jars.director.call('/api/v1/auth/recovery/initiate', {
        key: randomUUID(),
        body: { authorizationId: randomUUID(), ownerApproved: true },
      })
    ).status,
    400,
  );
  const evidence = await authorization(subject, directorId);
  assert.equal(
    (
      await jars.teacher.call('/api/v1/auth/recovery/initiate', {
        key: randomUUID(),
        body: { authorizationId: evidence.id },
      })
    ).status,
    403,
  );
  const recovery = await jars.director.call('/api/v1/auth/recovery/initiate', {
    key: randomUUID(),
    body: { authorizationId: evidence.id },
  });
  assert.equal(recovery.status, 200, JSON.stringify(recovery.body));
  assert.equal(await client.session.count({ where: { account_id: subject, revoked_at: null } }), 0);
  assert.equal(
    await client.webAuthnCredential.count({ where: { account_id: subject, revoked_at: null } }),
    0,
  );
  assert.equal((await jars.manager.call('/api/v1/auth/session', { method: 'GET' })).status, 401);
  assert.equal(
    (
      await jars.director.call('/api/v1/auth/recovery/initiate', {
        key: randomUUID(),
        body: { authorizationId: evidence.id },
      })
    ).status,
    409,
  );
  const request = await client.recoveryRequest.findUniqueOrThrow({
    where: { id: recovery.body.recoveryId },
  });
  assert.equal(request.token_hash, tokenHash(recovery.body.token));
  const recipient = await new Jar().bootstrap();
  const completed = await recipient.call('/api/v1/auth/recovery/complete', { body: recovery.body });
  // The completion DTO accepts only the recovery ID and token, never returned metadata.
  assert.equal(completed.status, 400);
  const proof = { recoveryId: recovery.body.recoveryId, token: recovery.body.token };
  const complete = await recipient.call('/api/v1/auth/recovery/complete', { body: proof });
  assert.equal(complete.status, 200, JSON.stringify(complete.body));
  assert.equal(complete.body.recovery_only, true);
  assert.equal(
    (
      await recipient.call('/api/v1/students', {
        key: randomUUID(),
        body: { fullName: 'Blocked recovery session' },
      })
    ).status,
    403,
  );
  assert.equal((await recipient.call('/api/v1/auth/webauthn/authenticate/start')).status, 403);
  const repeat = await (
    await new Jar().bootstrap()
  ).call('/api/v1/auth/recovery/complete', { body: proof });
  assert.equal(repeat.status, 400);
  const newKey = authenticator(),
    start = await recipient.call('/api/v1/auth/webauthn/register/start');
  assert.equal(start.status, 200, JSON.stringify(start.body));
  const registered = await recipient.call('/api/v1/auth/webauthn/register/finish', {
    body: newKey.registration(start.body),
  });
  assert.equal(registered.status, 200, JSON.stringify(registered.body));
  assert.equal(
    (await client.authAccount.findUniqueOrThrow({ where: { id: subject } }))
      .recovery_registration_required,
    false,
  );
  const next = await recipient.call('/api/v1/auth/webauthn/authenticate/start');
  assert.equal(
    (
      await recipient.call('/api/v1/auth/webauthn/authenticate/finish', {
        body: newKey.authentication(next.body),
      })
    ).body.mfa_completed,
    true,
  );
  const oldKey = await client.webAuthnCredential.findUniqueOrThrow({
    where: { credential_id: Buffer.from(keys.manager.id, 'base64url') },
  });
  assert.ok(oldKey.revoked_at);
});
test('password throttling persists independently of a rejected authentication transaction', async () => {
  const login = `limited-${randomUUID()}@online-school.invalid`,
    at = (await client.$queryRaw`SELECT clock_timestamp() AS now`)[0].now;
  const bucket = await client.authRateLimit.create({
    data: {
      bucket_key: tokenHash(`identity:auth.password:${login}`),
      attempts: 10,
      window_started_at: at,
      expires_at: new Date(+at + 900000),
    },
  });
  const jar = await new Jar().bootstrap();
  const response = await jar.call('/api/v1/auth/session', {
    body: { email: login, password: 'invalid' },
  });
  assert.equal(response.status, 429);
  assert.equal(
    (await client.authRateLimit.findUniqueOrThrow({ where: { id: bucket.id } })).attempts,
    11,
  );
  assert.ok(
    await client.auditEvent.findFirst({
      where: { request_id: response.headers.get('x-request-id'), result: 'DENIED' },
    }),
  );
});
test('director recovery requires tech operator plus recorded owner instruction; runtime cannot forge evidence', async () => {
  await assert.rejects(authorization(otherDirectorId, directorId, 'synthetic-owner-instruction'));
  await assert.rejects(authorization(otherDirectorId, techId));
  const evidence = await authorization(otherDirectorId, techId, 'synthetic-owner-instruction-001');
  const wrongActor = await jars.director.call('/api/v1/auth/recovery/initiate', {
    key: randomUUID(),
    body: { authorizationId: evidence.id },
  });
  assert.equal(wrongActor.status, 403);
  const result = await jars.tech.call('/api/v1/auth/recovery/initiate', {
    key: randomUUID(),
    body: { authorizationId: evidence.id },
  });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  const completed = await (
    await new Jar().bootstrap()
  ).call('/api/v1/auth/recovery/complete', {
    body: { recoveryId: result.body.recoveryId, token: result.body.token },
  });
  assert.equal(completed.status, 200, JSON.stringify(completed.body));
  const privileges =
    await client.$queryRaw`SELECT has_table_privilege('online_school_runtime','recovery_authorizations','INSERT') AS insert,has_table_privilege('online_school_runtime','audit_events','UPDATE') AS update_audit`;
  assert.equal(privileges[0].insert, false);
  assert.equal(privileges[0].update_audit, false);
  assert.ok(
    (await client.accessRevocation.count({
      where: { account_id: otherDirectorId, revoked_by_account_id: techId },
    })) >= 1,
  );
});

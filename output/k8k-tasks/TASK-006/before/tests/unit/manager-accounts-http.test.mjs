import { beforeAll, beforeEach, afterAll, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { managerAccountsFixture } from '../support/manager-accounts-fixture.mjs';
import { Passwords } from '../../apps/api/dist/modules/identity/passwords.js';
let fixture, f, own, foreign, finance;
const previousCsrf = process.env.CSRF_SIGNING_SECRET;
const path = (id, reset = false) => `/${id}/account${reset ? '/reset-password' : ''}`;
beforeAll(async () => {
  process.env.CSRF_SIGNING_SECRET = 'mgr03-csrf-fixture-secret-at-least-32-bytes';
  fixture = await managerAccountsFixture();
  f = fixture.f;
});
afterAll(async () => {
  await f?.app.close();
  if (previousCsrf === undefined) delete process.env.CSRF_SIGNING_SECRET;
  else process.env.CSRF_SIGNING_SECRET = previousCsrf;
});
beforeEach(async () => {
  await f.reset();
  own = f.addStudent();
  foreign = f.addStudent(1);
  finance = fixture.finance(own.id);
});
const create = (
  key = randomUUID(),
  id = own.id,
  body = { loginEmail: 'new-student@example.invalid' },
  index = 0,
) => f.api('post', path(id), index, { key, body });
const reset = (key = randomUUID(), id = own.id, body = {}, index = 0) =>
  f.api('post', path(id, true), index, { key, body });
function sessionCookies(response) {
  return (response.headers['set-cookie'] ?? []).map((c) => c.split(';')[0]).join('; ');
}
const anonymousCsrf = async () => {
  const response = await request(f.app.getHttpServer()).get('/api/v1/auth/csrf');
  expect(response.status).toBe(200);
  return { token: response.body.csrfToken, cookies: sessionCookies(response) };
};
async function login(email, password) {
  const csrf = await anonymousCsrf();
  return request(f.app.getHttpServer())
    .post('/api/v1/auth/session')
    .set('Cookie', csrf.cookies)
    .set('X-CSRF-Token', csrf.token)
    .send({ method: 'password', email, password });
}
test('create delivers a 16-character password once; cache and events never contain it', async () => {
  const key = randomUUID(),
    first = await create(key);
  expect(first.status).toBe(201);
  expect(first.body.passwordAlreadyIssued).toBe(false);
  expect(first.headers['cache-control']).toBe('no-store');
  expect(first.body.temporaryPassword).toMatch(/^[A-HJ-NP-Za-km-z2-9]{16}$/);
  const profile = [...f.state.profiles.values()][0];
  expect(profile).toMatchObject({
    student_id: own.id,
    must_change_password: true,
    activation_distribution_id: finance.distributionId,
    activation_payment_confirmation_id: finance.paymentId,
    activation_confirmed_by_staff_id: f.accounts[4].staffId,
  });
  expect(+profile.temporary_password_expires_at - +profile.temporary_password_issued_at).toBe(
    72 * 3600000,
  );
  const account = f.state.auth.get(first.body.accountId);
  expect(
    await f.app.get(Passwords).verify(first.body.temporaryPassword, account.password_hash),
  ).toBe(true);
  const replay = await create(key);
  expect(replay.status).toBe(200);
  expect(replay.body).toEqual({
    ...first.body,
    temporaryPassword: null,
    passwordAlreadyIssued: true,
  });
  expect(f.state.profiles.size).toBe(1);
  expect(f.state.roleRows).toHaveLength(1);
  const durable = JSON.stringify([...f.state.idem.values(), ...f.state.audit, ...f.state.outbox]);
  expect(durable).not.toContain(first.body.temporaryPassword);
  expect([...f.state.dispatches.values()]).toHaveLength(1);
  expect([...f.state.dispatches.values()][0]).toMatchObject({
    template_code: 'ACCOUNT_CREATED',
    status: 'QUEUED',
  });
  expect(JSON.stringify([...f.state.dispatches.values()])).not.toContain(
    first.body.temporaryPassword,
  );
  expect(
    f.state.outbox.find((e) => e.topic === 'manager.student.account-created.v1').payload,
  ).toMatchObject({
    loginEmail: 'new-student@example.invalid',
    instruction: 'CHANGE_TEMPORARY_PASSWORD',
  });
  const conflict = await create(key, own.id, { loginEmail: 'changed@example.invalid' });
  expect(conflict.status).toBe(409);
  expect(conflict.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
});
test.each(['confirmed', 'receiptPublished', 'distributed', 'distributionPublished'])(
  'missing %s fails the first allocated payment gate',
  async (field) => {
    finance[field] = false;
    const response = await create();
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('FIRST_PAYMENT_NOT_CONFIRMED');
    expect(f.state.profiles.size).toBe(0);
    expect(f.state.auth.size).toBe(f.accounts.length);
    expect(f.state.idem.size).toBe(0);
  },
);
test.each([
  undefined,
  { valid: false, afterPayment: true, remaining: true },
  { valid: true, afterPayment: false, remaining: true },
  { valid: true, afterPayment: true, remaining: false },
])('partial payment requires a separate current admission: %j', async (admission) => {
  finance.paid = '500.0000';
  finance.admission = admission ? { id: randomUUID(), ...admission } : undefined;
  const response = await create();
  expect(response.status).toBe(409);
  expect(response.body.code).toBe('FIRST_PAYMENT_NOT_CONFIRMED');
});
test('partial payment with a separate limited admission uses that exact evidence', async () => {
  finance.paid = '500.0000';
  finance.admission = { id: randomUUID(), valid: true, afterPayment: true, remaining: true };
  const response = await create();
  expect(response.status).toBe(201);
  expect([...f.state.profiles.values()][0]).toMatchObject({
    activation_basis: 'LIMITED_DIRECTOR_ADMISSION',
    activation_director_admission_id: finance.admission.id,
  });
});
test('concurrent requests with different keys create exactly one active account', async () => {
  const results = await Promise.all([
    create(),
    create(randomUUID(), own.id, { loginEmail: 'other-login@example.invalid' }),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  expect(results.find((r) => r.status === 409).body.code).toBe('ACCOUNT_ALREADY_EXISTS');
  expect(f.state.profiles.size).toBe(1);
});
test('concurrent same-key replay never returns the first password twice', async () => {
  const key = randomUUID(),
    results = await Promise.all([create(key), create(key)]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 201]);
  expect(results.filter((r) => r.body.temporaryPassword !== null)).toHaveLength(1);
});
test('duplicate email is generic and does not reveal its owner', async () => {
  const actor = [...f.state.auth.values()][0];
  actor.login_id = 'used@example.invalid';
  const response = await create(randomUUID(), own.id, { loginEmail: actor.login_id });
  expect(response.status).toBe(409);
  expect(response.body.code).toBe('EMAIL_ALREADY_USED');
  expect(JSON.stringify(response.body)).not.toContain(actor.id);
  expect(response.body.details).toBeUndefined();
  expect(f.state.profiles.size).toBe(0);
});
test.each([false, true])('foreign/nonexistent student are 404 for reset=%s', async (isReset) => {
  for (const id of [foreign.id, randomUUID(), 'invalid']) {
    const response = isReset ? await reset(randomUUID(), id) : await create(randomUUID(), id);
    expect(response.status).toBe(404);
    expect(response.body.code).toBe('STUDENT_NOT_FOUND');
  }
  expect(f.state.lockQueries).toHaveLength(0);
});
test.each([2, 3, 4, 5])('non-manager role %i cannot issue or reset', async (index) => {
  for (const isReset of [false, true])
    expect(
      (
        await f.api('post', path(own.id, isReset), index, {
          key: randomUUID(),
          body: isReset ? {} : { loginEmail: 'new@example.invalid' },
        })
      ).status,
    ).toBe(403);
});
test.each([false, true])('anonymous and missing CSRF rejected for reset=%s', async (isReset) => {
  for (const index of [null, 0]) {
    const response = await f.api('post', path(own.id, isReset), index, {
      csrf: false,
      key: randomUUID(),
      body: isReset ? {} : { loginEmail: 'new@example.invalid' },
    });
    expect(response.status).toBe(index === null ? 401 : 403);
  }
});
test('request DTOs reject caller passwords, ownership and unexpected reset fields', async () => {
  for (const body of [
    { loginEmail: 'not-an-email' },
    { loginEmail: 'new@example.invalid', password: 'DO NOT ACCEPT' },
    { loginEmail: 'new@example.invalid', managerId: foreign.managerId },
  ])
    expect((await create(randomUUID(), own.id, body)).status).toBe(422);
  expect((await reset(randomUUID(), own.id, { temporaryPassword: 'DO NOT ACCEPT' })).status).toBe(
    422,
  );
});
test.each(['audit', 'outbox'])(
  'create %s failure rolls back account, role and activation link',
  async (target) => {
    if (target === 'audit') f.state.failAudit = 'STUDENT_ACCOUNT_CREATED';
    else f.state.failOutbox = true;
    const response = await create();
    expect(response.status).toBe(503);
    expect(f.state.profiles.size).toBe(0);
    expect(f.state.auth.size).toBe(f.accounts.length);
    expect(f.state.roleRows).toHaveLength(0);
    expect(f.state.idem.size).toBe(0);
    expect(f.state.outbox).toHaveLength(0);
  },
);
test('reset revokes all sessions, keys and pending challenges; fourth reset is refused', async () => {
  const created = await create(),
    accountId = created.body.accountId;
  expect(created.status).toBe(201);
  f.state.credentials.push({ account_id: accountId, revoked_at: null });
  f.state.challenges.push({ account_id: accountId, used_at: null });
  f.state.emailChanges.push({ account_id: accountId, revoked_at: null });
  const signed = await login(created.body.loginEmail, created.body.temporaryPassword);
  expect(signed.status).toBe(200);
  let last;
  for (let i = 0; i < 3; i++) {
    last = await reset();
    expect(last.status).toBe(200);
    expect(last.body.temporaryPassword).toHaveLength(16);
  }
  expect(f.state.credentials[0].revoked_at).toBeInstanceOf(Date);
  expect(f.state.challenges[0].used_at).toBeInstanceOf(Date);
  expect(f.state.emailChanges[0].revoked_at).toBeInstanceOf(Date);
  expect(
    [...f.state.sessions.values()]
      .filter((s) => s.account_id === accountId)
      .every((s) => s.revoked_at),
  ).toBe(true);
  const fourth = await reset();
  expect(fourth.status).toBe(429);
  expect(fourth.body.code).toBe('RESET_LIMIT_EXCEEDED');
  expect(
    await f.app
      .get(Passwords)
      .verify(last.body.temporaryPassword, f.state.auth.get(accountId).password_hash),
  ).toBe(true);
  const old = await request(f.app.getHttpServer())
    .get('/api/v1/student/me')
    .set('Cookie', sessionCookies(signed));
  expect(old.status).toBe(401);
});
test('reset replay does not consume daily quota or reveal password', async () => {
  await create();
  const key = randomUUID(),
    first = await reset(key),
    again = await reset(key);
  expect(first.status).toBe(200);
  expect(again.status).toBe(200);
  expect(again.body.temporaryPassword).toBeNull();
  expect(again.body.passwordAlreadyIssued).toBe(true);
  expect(f.state.audit.filter((a) => a.action === 'STUDENT_PASSWORD_RESET')).toHaveLength(1);
  expect(
    JSON.stringify([...f.state.idem.values(), ...f.state.audit, ...f.state.outbox]),
  ).not.toContain(first.body.temporaryPassword);
});
test('expired temporary password cannot authenticate', async () => {
  const created = await create();
  const profile = [...f.state.profiles.values()][0];
  profile.temporary_password_expires_at = new Date(Date.now() - 1);
  const response = await login(created.body.loginEmail, created.body.temporaryPassword);
  expect(response.status).toBe(403);
  expect(response.body.code).toBe('TEMPORARY_PASSWORD_EXPIRED');
});

test('reset quota excludes successful resets outside the rolling 24-hour window', async () => {
  await create();
  for (let i = 0; i < 3; i++) expect((await reset()).status).toBe(200);
  for (const audit of f.state.audit) {
    if (audit.action === 'STUDENT_PASSWORD_RESET')
      audit.recorded_at = new Date(Date.now() - 25 * 3600000);
  }
  expect((await reset()).status).toBe(200);
});
test('СЦ-М-01: registry → published distribution → issue → login → force change → student cabinet', async () => {
  const issued = await create();
  expect(issued.status).toBe(201);
  const signed = await login(issued.body.loginEmail, issued.body.temporaryPassword);
  expect(signed.status).toBe(200);
  const cookies = sessionCookies(signed),
    csrf = signed.body.csrfToken;
  for (const route of [
    '/api/v1/student/me',
    '/api/v1/student/security/sessions',
    '/api/v1/auth/csrf',
    '/api/v1/auth/session',
  ]) {
    const blocked = await request(f.app.getHttpServer()).get(route).set('Cookie', cookies);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
  }
  const changed = await request(f.app.getHttpServer())
    .patch('/api/v1/student/security/change-password')
    .set('Cookie', cookies)
    .set('X-CSRF-Token', csrf)
    .send({
      currentPassword: issued.body.temporaryPassword,
      newPassword: 'ChangedStudentPassword2026',
    });
  expect(changed.status).toBe(200);
  expect(changed.body.mustChangePassword).toBe(false);
  const me = await request(f.app.getHttpServer())
    .get('/api/v1/student/me')
    .set('Cookie', sessionCookies(changed));
  expect(me.status).toBe(200);
  expect(me.body).toMatchObject({ id: own.id, mustChangePassword: false, hasActiveAccess: true });
  expect([...f.state.profiles.values()][0].temporary_password_expires_at).toBeNull();
  expect((await login(issued.body.loginEmail, issued.body.temporaryPassword)).status).toBe(401);
  expect(
    JSON.stringify([...f.state.idem.values(), ...f.state.audit, ...f.state.outbox]),
  ).not.toContain(issued.body.temporaryPassword);
});
test('initial-password session can use the real DELETE logout route', async () => {
  const issued = await create(),
    signed = await login(issued.body.loginEmail, issued.body.temporaryPassword);
  const response = await request(f.app.getHttpServer())
    .delete('/api/v1/auth/session')
    .set('Cookie', sessionCookies(signed))
    .set('X-CSRF-Token', signed.body.csrfToken)
    .send({});
  expect(response.status).toBe(200);
  expect(response.body.loggedOut).toBe(true);
});
test('initial password cannot be retained as the permanent password', async () => {
  const issued = await create(),
    signed = await login(issued.body.loginEmail, issued.body.temporaryPassword);
  const response = await request(f.app.getHttpServer())
    .patch('/api/v1/student/security/change-password')
    .set('Cookie', sessionCookies(signed))
    .set('X-CSRF-Token', signed.body.csrfToken)
    .send({
      currentPassword: issued.body.temporaryPassword,
      newPassword: issued.body.temporaryPassword,
    });
  expect(response.status).toBe(422);
  expect(response.body.code).toBe('PASSWORD_UNCHANGED');
  expect([...f.state.profiles.values()][0].must_change_password).toBe(true);
});
test.each(['audit', 'outbox'])(
  'failed reset %s preserves the old credential and live sessions',
  async (target) => {
    const issued = await create(),
      signed = await login(issued.body.loginEmail, issued.body.temporaryPassword),
      oldHash = f.state.auth.get(issued.body.accountId).password_hash;
    if (target === 'audit') f.state.failAudit = 'STUDENT_PASSWORD_RESET';
    else f.state.failOutbox = true;
    const response = await reset();
    expect(response.status).toBe(503);
    expect(f.state.auth.get(issued.body.accountId).password_hash).toBe(oldHash);
    expect(
      [...f.state.sessions.values()].find((s) => s.account_id === issued.body.accountId).revoked_at,
    ).toBeNull();
    expect(f.state.audit.filter((a) => a.action === 'STUDENT_PASSWORD_RESET')).toHaveLength(0);
    expect(
      (
        await request(f.app.getHttpServer())
          .get('/api/v1/student/me')
          .set('Cookie', sessionCookies(signed))
      ).body.code,
    ).toBe('PASSWORD_CHANGE_REQUIRED');
  },
);
test('per-manager/student throttling happens before any credential issue', async () => {
  f.state.rateAttempts = 31;
  const response = await create();
  expect(response.status).toBe(429);
  expect(response.body.code).toBe('AUTH_RATE_LIMITED');
  expect(f.state.profiles.size).toBe(0);
});
test('serialization retry issues only the final committed password and caches neither attempt', async () => {
  f.state.failCommit = 1;
  const passwords = f.app.get(Passwords),
    spy = jest.spyOn(passwords, 'temporary');
  const response = await create();
  expect(response.status).toBe(201);
  expect(spy).toHaveBeenCalledTimes(2);
  const attempts = await Promise.all(spy.mock.results.map((r) => r.value));
  expect(response.body.temporaryPassword).toBe(attempts[1].value.plaintext);
  expect(f.state.profiles.size).toBe(1);
  const durable = JSON.stringify([...f.state.idem.values(), ...f.state.audit, ...f.state.outbox]);
  for (const attempt of attempts) expect(durable).not.toContain(attempt.value.plaintext);
});
test('fresh attempt followed by a cached winner cannot expose an orphaned password projection', async () => {
  f.state.failCommit = 1;
  f.state.replayAfterFailure = true;
  const response = await create();
  expect(response.status).toBe(200);
  expect(response.body.temporaryPassword).toBeNull();
  expect(response.body.passwordAlreadyIssued).toBe(true);
  expect(f.state.profiles.size).toBe(1);
});

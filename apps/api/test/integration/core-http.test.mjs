import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { Controller, Delete, Get, Module, Patch, Post, Put, Req } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createDirectClient } from '@online-school/db';
import { HealthController } from '../../dist/app.module.js';
import { CoreModule } from '../../dist/core/core.module.js';
import {
  SessionStore,
  CSRF_COOKIE,
  SESSION_COOKIE,
  tokenHash,
} from '../../dist/core/session/session.store.js';
import { SessionService } from '../../dist/core/session/session.service.js';
import { WebAuthnChallengeStore } from '../../dist/core/session/webauthn-challenge.store.js';
import { AuditService } from '../../dist/core/audit/audit.service.js';
import {
  Authenticated,
  AllowPreMfa,
  RequireMfa,
  RequirePermission,
  RequireRole,
  RequireStudentAccess,
  Public,
} from '../../dist/core/rbac/decorators.js';
import {
  CriticalCommand,
  CurrentTransaction,
} from '../../dist/core/idempotency/idempotency.module.js';
import { fail, domainError, unwrap } from '../../dist/core/errors/domain-error.js';
import { seedQA, QA, qaId } from '../../../../packages/db/dist-tools/seed.js';

const url = process.env.TEST_DATABASE_URL;
assert.ok(url, 'TEST_DATABASE_URL required');
const target = new URL(url);
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname));
assert.match(target.pathname, /^\/online_school_test[a-z0-9_]*$/);
process.env.DATABASE_URL = url;
process.env.CSRF_SIGNING_SECRET = randomBytes(48).toString('base64url');
const client = createDirectClient({ DIRECT_URL: url }).value;
let app, base, store, challengeStore;
const sessions = {};
const prefix = `task06-${randomUUID()}`;

// These probes are registered only in this test module. They never ship as business endpoints.
class ProbeController {
  director() {
    return { allowed: true };
  }
  unspecified() {
    return { shouldNeverRun: true };
  }
  self(req) {
    return { id: req.account.accountId, mfa: req.account.mfaCompleted };
  }
  student(req) {
    return { id: req.params.id };
  }
  async command(req, ctx) {
    const name = req.body?.name;
    if (typeof name !== 'string' || name.length > 150)
      return fail(domainError('INVALID_INPUT', 400));
    const student = await ctx.tx.student.create({ data: { full_name: name } });
    if (req.body.fail) return fail(domainError('SYNTHETIC_ROLLBACK', 422));
    return { id: student.id, name: student.full_name };
  }
  async challengeFinish(req, ctx) {
    unwrap(await challengeStore.consume(ctx.tx, ctx.actor, 'AUTHENTICATION', req.body));
    return { id: ctx.actor.accountId, challengeAccepted: true };
  }
  async challengeStart() {
    return { onlyPreMfa: true };
  }
  mfa() {
    return { allowed: true };
  }
  publicMutation() {
    return { allowed: true };
  }
}
Controller('api/v1')(ProbeController);
function method(name, ...decorators) {
  for (const decorator of decorators)
    decorator(
      ProbeController.prototype,
      name,
      Object.getOwnPropertyDescriptor(ProbeController.prototype, name),
    );
}
method(
  'director',
  Get('probe/director'),
  RequireRole('DIRECTOR'),
  RequirePermission('payment:confirm'),
);
method('unspecified', Get('probe/unspecified'));
method('self', Get('probe/self'), Authenticated());
Req()(ProbeController.prototype, 'self', 0);
method(
  'student',
  Get('probe/students/:id'),
  RequireRole('DIRECTOR', 'MANAGER', 'TEACHER', 'STUDENT'),
  RequirePermission('student:read'),
  RequireStudentAccess(),
);
Req()(ProbeController.prototype, 'student', 0);
method(
  'command',
  Post('probe/command'),
  RequireRole('DIRECTOR'),
  RequirePermission('student:create'),
  RequireMfa(),
  CriticalCommand({
    type: 'test.student.create',
    resourceType: 'Student',
    topic: 'test.student.created.v1',
  }),
);
Req()(ProbeController.prototype, 'command', 0);
CurrentTransaction()(ProbeController.prototype, 'command', 1);
method(
  'challengeFinish',
  Post('auth/webauthn/authenticate/finish'),
  Authenticated(),
  AllowPreMfa(),
  CriticalCommand({
    type: 'test.webauthn.finish',
    resourceType: 'AuthAccount',
    topic: 'test.webauthn.finished.v1',
  }),
);
Req()(ProbeController.prototype, 'challengeFinish', 0);
CurrentTransaction()(ProbeController.prototype, 'challengeFinish', 1);
method('challengeStart', Post('auth/webauthn/authenticate/start'), Authenticated(), AllowPreMfa());
method('mfa', Get('probe/mfa'), Authenticated(), RequireMfa());
// Public mutations still require a signed anonymous double-submit token.
method('publicMutation', Post('probe/public'), Public());
for (const [name, verb] of [
  ['put', Put],
  ['patch', Patch],
  ['delete', Delete],
]) {
  ProbeController.prototype[name] = () => ({ allowed: true });
  method(name, verb('probe/public'), Public());
}
class TestModule {}
Module({ imports: [CoreModule], controllers: [ProbeController, HealthController] })(TestModule);

before(async () => {
  assert.equal((await seedQA(client)).ok, true);
  app = await NestFactory.create(TestModule, { logger: false, abortOnError: false });
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
  store = app.get(SessionStore);
  challengeStore = app.get(WebAuthnChallengeStore);
  for (const [key, label, mfa] of [
    ['director', 'seed-director-001', true],
    ['manager', 'seed-manager-001', true],
    ['manager2', 'seed-manager-002', true],
    ['teacher', 'seed-teacher-001', true],
    ['teacher2', 'seed-teacher-002', true],
    ['preMfa', 'seed-director-001', false],
  ]) {
    const account = await client.authAccount.findUniqueOrThrow({
      where: { login_id: `${label}@online-school.invalid` },
    });
    sessions[key] = await issue(account.id, mfa);
  }
  const student = await client.studentAccount.findFirstOrThrow({
    where: { student_id: QA.students[0] },
  });
  sessions.student = await issue(student.account_id, false);
});
after(async () => {
  await app?.close();
  await client.$disconnect();
});
async function issue(accountId, mfa) {
  return client.$transaction(async (tx) => {
    const now = (await tx.$queryRaw`SELECT clock_timestamp() AS now`)[0].now;
    return store.issue(tx, accountId, mfa ? now : null);
  });
}
async function request(
  path,
  { session, body, method = 'GET', csrf = true, key, headers = {} } = {},
) {
  const h = { ...headers };
  if (session) {
    h.cookie = `${SESSION_COOKIE}=${session.token}; ${CSRF_COOKIE}=${session.csrfToken}`;
    if (csrf) h['x-csrf-token'] = session.csrfToken;
  }
  if (body !== undefined) h['content-type'] = 'application/json';
  if (key) h['idempotency-key'] = key;
  const response = await fetch(base + path, {
    method,
    headers: h,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  assert.match(response.headers.get('x-request-id') ?? '', /^[0-9a-f-]{36}$/);
  const result = await response.json();
  if (response.status >= 400) {
    assert.equal(result.requestId, response.headers.get('x-request-id'));
    assert.ok(result.code);
    assert.ok(result.timestamp);
  }
  return { status: response.status, body: result, headers: response.headers };
}
test('401 without session, 403 wrong role/default deny; health/request ID and error envelope', async () => {
  assert.equal((await request('/api/v1/probe/director')).status, 401);
  assert.equal(
    (await request('/api/v1/probe/director', { session: sessions.manager })).status,
    403,
  );
  assert.equal(
    (await request('/api/v1/probe/director', { session: sessions.director })).status,
    200,
  );
  assert.equal(
    (await request('/api/v1/probe/unspecified', { session: sessions.director })).status,
    403,
  );
  const id = randomUUID();
  assert.equal(
    (await request('/health', { headers: { 'x-request-id': id } })).headers.get('x-request-id'),
    id,
  );
  assert.equal((await request('/missing')).status, 404);
  const malformed = await fetch(base + '/api/v1/probe/command', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{broken',
  });
  assert.equal(malformed.status, 400);
  assert.ok(malformed.headers.get('x-request-id'));
});
test('MFA is enforced before every protected staff/teacher endpoint; only explicit WebAuthn paths allow stage one', async () => {
  assert.equal(
    (await request('/api/v1/probe/mfa', { session: sessions.preMfa })).body.code,
    'MFA_REQUIRED',
  );
  assert.equal((await request('/api/v1/probe/self', { session: sessions.preMfa })).status, 403);
  assert.equal(
    (
      await request('/api/v1/auth/webauthn/authenticate/start', {
        session: sessions.preMfa,
        method: 'POST',
        body: {},
      })
    ).status,
    201,
  );
});
test('session/CSRF cookies are secure; all mutation verbs require signed or session-bound double submit', async () => {
  const headers = {};
  store.cookies(
    {
      setHeader: (name, value) => {
        headers[name] = value;
      },
    },
    sessions.director,
  );
  assert.match(headers['Set-Cookie'][0], /HttpOnly; Secure; SameSite=Strict/);
  assert.ok(headers['Set-Cookie'].every((s) => s.includes('Path=/') && !s.includes('Domain=')));
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal((await request('/api/v1/probe/public', { method })).body.code, 'CSRF_INVALID');
    assert.equal(
      (await request('/api/v1/probe/public', { method, session: sessions.director })).status,
      201 * (method === 'POST') + 200 * (method !== 'POST'),
    );
  }
  const bootstrap = await request('/api/v1/auth/csrf');
  const token = bootstrap.body.csrfToken;
  assert.match(bootstrap.headers.get('set-cookie'), /Secure; SameSite=Strict/);
  const h = { cookie: `${CSRF_COOKIE}=${token}`, 'x-csrf-token': token };
  assert.equal((await request('/api/v1/probe/public', { method: 'POST', headers: h })).status, 201);
  const forged = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
  assert.equal(
    (
      await request('/api/v1/probe/public', {
        method: 'POST',
        headers: { cookie: `${CSRF_COOKIE}=${forged}`, 'x-csrf-token': forged },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request('/api/v1/probe/command', {
        method: 'POST',
        session: sessions.director,
        csrf: false,
        key: randomUUID(),
        body: { name: prefix },
      })
    ).body.code,
    'CSRF_INVALID',
  );
});
test('same idempotency key returns cached 200, canonical payload replay, changed payload gives 422', async () => {
  const key = randomUUID();
  const name = `${prefix}-cached`;
  const first = await request('/api/v1/probe/command', {
    method: 'POST',
    session: sessions.director,
    key,
    body: { name, nested: { b: 2, a: 1 } },
  });
  assert.equal(first.status, 200, JSON.stringify(first.body));
  const replay = await request('/api/v1/probe/command', {
    method: 'POST',
    session: sessions.director,
    key,
    body: { nested: { a: 1, b: 2 }, name },
  });
  assert.equal(replay.status, 200);
  assert.deepEqual(replay.body, first.body);
  assert.equal(
    (
      await request('/api/v1/probe/command', {
        method: 'POST',
        session: sessions.director,
        key,
        body: { name: 'different' },
      })
    ).status,
    422,
  );
  assert.equal(await client.student.count({ where: { full_name: name } }), 1);
  assert.equal(
    await client.auditEvent.count({ where: { source_operation_id: key, result: 'SUCCESS' } }),
    1,
  );
  assert.equal(await client.outboxEvent.count({ where: { source_operation_id: key } }), 1);
  const record = await client.idempotencyRecord.findFirstOrThrow({ where: { key } });
  assert.equal(record.status, 'COMPLETED');
  assert.ok(+record.expires_at - +record.created_at >= 47 * 3600000);
  assert.equal(
    (
      await request('/api/v1/probe/command', {
        method: 'POST',
        session: sessions.director,
        body: { name },
      })
    ).body.code,
    'IDEMPOTENCY_KEY_REQUIRED',
  );
});
test('concurrent duplicate commands commit exactly one business write/audit/outbox', async () => {
  const key = randomUUID(),
    name = `${prefix}-concurrent`;
  const account = await client.authAccount.findUniqueOrThrow({
    where: { login_id: 'seed-director-001@online-school.invalid' },
  });
  const other = await issue(account.id, true);
  const results = await Promise.all(
    [sessions.director, other].map((session) =>
      request('/api/v1/probe/command', { method: 'POST', session, key, body: { name } }),
    ),
  );
  assert.deepEqual(
    results.map((r) => r.status),
    [200, 200],
    JSON.stringify(results),
  );
  assert.deepEqual(results[0].body, results[1].body);
  assert.equal(await client.student.count({ where: { full_name: name } }), 1);
  assert.equal(
    await client.auditEvent.count({ where: { source_operation_id: key, result: 'SUCCESS' } }),
    1,
  );
  assert.equal(await client.outboxEvent.count({ where: { source_operation_id: key } }), 1);
});
test('failed commands and failed audit writes roll back business, cache, audit and outbox', async () => {
  const key = randomUUID(),
    name = `${prefix}-rollback`;
  assert.equal(
    (
      await request('/api/v1/probe/command', {
        method: 'POST',
        session: sessions.director,
        key,
        body: { name, fail: true },
      })
    ).status,
    422,
  );
  assert.equal(await client.student.count({ where: { full_name: name } }), 0);
  assert.equal(await client.idempotencyRecord.count({ where: { key } }), 0);
  assert.equal(await client.outboxEvent.count({ where: { source_operation_id: key } }), 0);
  const audit = app.get(AuditService),
    original = audit.record;
  audit.record = async () => {
    throw new Error('Synthetic audit failure');
  };
  const auditKey = randomUUID();
  try {
    assert.equal(
      (
        await request('/api/v1/probe/command', {
          method: 'POST',
          session: sessions.director,
          key: auditKey,
          body: { name },
        })
      ).status,
      503,
    );
  } finally {
    audit.record = original;
  }
  assert.equal(await client.student.count({ where: { full_name: name } }), 0);
  assert.equal(await client.idempotencyRecord.count({ where: { key: auditKey } }), 0);
  assert.equal(await client.auditEvent.count({ where: { source_operation_id: auditKey } }), 0);
  assert.equal(await client.outboxEvent.count({ where: { source_operation_id: auditKey } }), 0);
  const outboxKey = randomUUID();
  // The database rejects an outbox referencing a non-success audit after the business/audit writes.
  audit.record = async (event, tx) => original.call(audit, { ...event, result: 'DENIED' }, tx);
  try {
    assert.equal(
      (
        await request('/api/v1/probe/command', {
          method: 'POST',
          session: sessions.director,
          key: outboxKey,
          body: { name },
        })
      ).status,
      503,
    );
  } finally {
    audit.record = original;
  }
  assert.equal(await client.student.count({ where: { full_name: name } }), 0);
  assert.equal(await client.auditEvent.count({ where: { source_operation_id: outboxKey } }), 0);
  assert.equal(await client.outboxEvent.count({ where: { source_operation_id: outboxKey } }), 0);
  assert.equal(await client.idempotencyRecord.count({ where: { key: outboxKey } }), 0);
});
test('student policy follows active manager/teacher assignments and own student account', async () => {
  const path = `/api/v1/probe/students/${QA.students[0]}`;
  await client.$executeRaw`UPDATE assigned_managers SET ended_at=clock_timestamp() WHERE student_id=${QA.students[0]}::uuid AND ended_at IS NULL`;
  assert.equal((await request(path, { session: sessions.manager })).status, 403);
  const assignedAt = (await client.$queryRaw`SELECT clock_timestamp() AS now`)[0].now;
  const link = await client.assignedManager.create({
    data: { manager_id: QA.managers[0], student_id: QA.students[0], assigned_at: assignedAt },
  });
  assert.equal((await request(path, { session: sessions.manager })).status, 200);
  assert.equal((await request(path, { session: sessions.manager2 })).status, 403);
  assert.equal((await request(path, { session: sessions.teacher })).status, 200);
  assert.equal((await request(path, { session: sessions.teacher2 })).status, 403);
  assert.equal((await request(path, { session: sessions.student })).status, 200);
  assert.equal(
    (await request(`/api/v1/probe/students/${QA.students[1]}`, { session: sessions.student }))
      .status,
    403,
  );
  await client.$executeRaw`UPDATE assigned_managers SET ended_at=clock_timestamp() WHERE id=${link.id}::uuid`;
  assert.equal((await request(path, { session: sessions.manager })).status, 403);
});
test('WebAuthn finish checks challenge ownership, lifetime, and atomic single consumption in addition to CSRF', async () => {
  const actor = unwrap(await store.resolve(sessions.preMfa.token));
  const challenge = await client.$transaction((tx) =>
    challengeStore.create(tx, actor, 'AUTHENTICATION'),
  );
  const body = {
    challengeId: challenge.id,
    response: {
      response: {
        clientDataJSON: Buffer.from(JSON.stringify({ challenge: challenge.challenge })).toString(
          'base64url',
        ),
      },
    },
  };
  const path = '/api/v1/auth/webauthn/authenticate/finish';
  assert.equal(
    (await request(path, { method: 'POST', session: sessions.manager, key: randomUUID(), body }))
      .status,
    400,
  );
  assert.equal(
    (await request(path, { method: 'POST', session: sessions.preMfa, key: randomUUID(), body }))
      .status,
    200,
  );
  assert.equal(
    (await request(path, { method: 'POST', session: sessions.preMfa, key: randomUUID(), body }))
      .body.code,
    'WEBAUTHN_CHALLENGE_INVALID',
  );
  assert.ok((await client.mfaChallenge.findUniqueOrThrow({ where: { id: challenge.id } })).used_at);
  for (const alias of [path + '/', path.toUpperCase()]) {
    assert.equal(
      (
        await request(alias, {
          method: 'POST',
          session: sessions.director,
          key: randomUUID(),
          body: {},
        })
      ).body.code,
      'WEBAUTHN_CHALLENGE_INVALID',
    );
  }
});
test('server rejects expired, idle, revoked sessions and revoked roles; logout has durable revocation/audit', async () => {
  const account = await client.authAccount.create({
    data: { kind: 'STAFF', login_id: `${randomUUID()}@online-school.invalid` },
  });
  await client.staffAccount.create({
    data: { account_id: account.id, full_name: 'Synthetic revocation manager' },
  });
  const roleType = await client.role.findUniqueOrThrow({ where: { code: 'MANAGER' } });
  await client.roleAssignment.create({
    data: { account_id: account.id, role_id: roleType.id, valid_from: new Date('2026-10-01Z') },
  });
  const temporary = await issue(account.id, true);
  const actor = unwrap(await store.resolve(temporary.token));
  const rid = randomUUID();
  assert.equal((await app.get(SessionService).revoke(actor, rid)).ok, true);
  assert.equal((await request('/api/v1/probe/self', { session: temporary })).status, 401);
  assert.equal(
    await client.accessRevocation.count({ where: { session_id: temporary.sessionId } }),
    1,
  );
  assert.equal(
    await client.auditEvent.count({ where: { request_id: rid, action: 'session.revoke' } }),
    1,
  );
  // Backdate the synthetic session consistently; production never extends an expired token.
  const expired = await issue(account.id, true);
  await client.$executeRaw`UPDATE sessions SET created_at=clock_timestamp()-interval '2 hours',last_seen_at=clock_timestamp()-interval '1 hour',mfa_verified_at=NULL,expires_at=clock_timestamp()-interval '1 minute' WHERE id=${expired.sessionId}::uuid`;
  assert.equal((await request('/api/v1/probe/self', { session: expired })).status, 401);
  const idle = await issue(account.id, true);
  await client.$executeRaw`UPDATE sessions SET created_at=clock_timestamp()-interval '2 hours',last_seen_at=clock_timestamp()-interval '31 minutes',mfa_verified_at=NULL WHERE id=${idle.sessionId}::uuid`;
  assert.equal((await request('/api/v1/probe/self', { session: idle })).status, 401);
  const role = await client.roleAssignment.findFirstOrThrow({
    where: { account_id: account.id, valid_to: null },
  });
  const roleSession = await issue(account.id, true);
  await client.$executeRaw`UPDATE role_assignments SET valid_to=clock_timestamp() WHERE id=${role.id}::uuid`;
  assert.equal((await request('/api/v1/probe/self', { session: roleSession })).status, 403);
  assert.ok((await client.auditEvent.count({ where: { result: 'DENIED' } })) > 0);
  assert.equal(
    await client.session.count({ where: { token_hash: tokenHash(sessions.director.token) } }),
    1,
  );
  assert.equal(await client.session.count({ where: { token_hash: sessions.director.token } }), 0);
  // IDs are UUIDv5, not the illustrative non-UUID labels from the task text.
  assert.equal(qaId('seed-director-001'), QA.director);
});

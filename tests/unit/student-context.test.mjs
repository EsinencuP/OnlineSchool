import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { beforeEach, afterEach, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { MeService } from '../../apps/api/dist/student/me/me.service.js';
import { StudentContextGuard } from '../../apps/api/dist/student/student-context.guard.js';
import { ActiveSubscriptionGuard } from '../../apps/api/dist/student/active-subscription.guard.js';
import { ErrorMapper } from '../../apps/api/dist/core/errors/error-mapper.js';
import {
  StudentSessionGuard,
  StudentCsrfGuard,
} from '../../apps/api/dist/student/student.module.js';
const userId = randomUUID(),
  studentId = randomUUID();
const context = (req) => ({ switchToHttp: () => ({ getRequest: () => req }) });
const actor = { accountId: userId, kind: 'STUDENT', roles: ['STUDENT'], sessionId: randomUUID() };
let profile, client, me, audit, guard, req;
const contacts = {
  whatsapp: process.env.STUDENT_MANAGER_WHATSAPP,
  telegram: process.env.STUDENT_MANAGER_TELEGRAM,
};
beforeEach(() => {
  profile = {
    id: randomUUID(),
    student_id: studentId,
    must_change_password: true,
    created_at: new Date('2026-10-27Z'),
    student: { full_name: 'Student' },
    account: { login_id: 'student@example.invalid' },
  };
  client = {
    studentAccount: { findFirst: jest.fn(async () => profile) },
    $queryRaw: jest.fn(async () => [{ subject_ids: [randomUUID()], has_active_access: true }]),
  };
  me = new MeService({ client });
  audit = { denial: jest.fn(async () => ({ ok: true, value: undefined })) };
  guard = new StudentContextGuard(me, audit);
  req = {
    method: 'GET',
    originalUrl: '/api/v1/student/me',
    account: actor,
    requestId: randomUUID(),
  };
});
afterEach(() => {
  for (const [key, value] of Object.entries({
    STUDENT_MANAGER_WHATSAPP: contacts.whatsapp,
    STUDENT_MANAGER_TELEGRAM: contacts.telegram,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
test('student context uses only verified session identity, maps existing Student, and returns initial flag', async () => {
  req.originalUrl += '?userId=' + randomUUID();
  await expect(guard.canActivate(context(req))).resolves.toBe(true);
  expect(client.studentAccount.findFirst.mock.calls[0][0].where.account_id).toBe(userId);
  expect(req.studentCtx).toMatchObject({
    userId,
    studentProfileId: studentId,
    mustChangePassword: true,
    hasActiveAccess: true,
  });
  expect(me.get(req.studentCtx, req)).toEqual({
    ok: true,
    value: {
      id: studentId,
      userId,
      displayName: 'Student',
      timeZone: 'Europe/Chisinau',
      managerContacts: { whatsapp: '', telegram: '' },
      email: 'student@example.invalid',
      avatarUrl: null,
      mustChangePassword: true,
      hasActiveAccess: true,
      createdAt: '2026-10-27T00:00:00.000Z',
    },
  });
});
test('repeated and concurrent guard calls share one profile load inside the same request', async () => {
  await Promise.all([
    guard.canActivate(context(req)),
    guard.canActivate(context(req)),
    guard.canActivate(context(req)),
  ]);
  await guard.canActivate(context(req));
  expect(client.studentAccount.findFirst).toHaveBeenCalledTimes(1);
  expect(client.$queryRaw).toHaveBeenCalledTimes(2);
});
test('context cache does not survive into a different HTTP request', async () => {
  await guard.canActivate(context(req));
  await guard.canActivate(context({ ...req, studentCtx: undefined, studentMe: undefined }));
  expect(client.studentAccount.findFirst).toHaveBeenCalledTimes(2);
});
test('cache cannot reuse another authenticated account', async () => {
  await guard.canActivate(context(req));
  req.account = { ...actor, accountId: randomUUID() };
  await guard.canActivate(context(req));
  expect(client.studentAccount.findFirst).toHaveBeenCalledTimes(2);
  expect(req.studentCtx.userId).toBe(req.account.accountId);
});
test('missing session is 401 and teacher or mixed-kind account is 403 before any profile query', async () => {
  delete req.account;
  await expect(guard.canActivate(context(req))).rejects.toMatchObject({ domain: { status: 401 } });
  for (const account of [
    { ...actor, kind: 'TEACHER', roles: ['TEACHER'] },
    { ...actor, kind: 'TEACHER' },
    { ...actor, roles: [] },
  ]) {
    req.account = account;
    await expect(guard.canActivate(context(req))).rejects.toMatchObject({
      domain: { status: 403, code: 'FORBIDDEN' },
    });
  }
  expect(client.studentAccount.findFirst).not.toHaveBeenCalled();
});
test('profile missing or archived/deactivated is denied and query requires active profile/person/account', async () => {
  client.studentAccount.findFirst.mockResolvedValue(null);
  await expect(guard.canActivate(context(req))).rejects.toMatchObject({
    domain: { status: 403, code: 'STUDENT_PROFILE_NOT_FOUND' },
  });
  expect(client.studentAccount.findFirst.mock.calls[0][0].where).toMatchObject({
    deactivated_at: null,
    student: { archived_at: null },
    account: { kind: 'STUDENT', disabled_at: null },
  });
  expect(client.$queryRaw).not.toHaveBeenCalled();
});
test('database failure is a sanitized 503 and failed audit denies access', async () => {
  client.studentAccount.findFirst.mockRejectedValue(new Error('private database credential'));
  await expect(guard.canActivate(context(req))).rejects.toMatchObject({
    domain: { status: 503, code: 'STUDENT_CONTEXT_UNAVAILABLE' },
  });
  audit.denial.mockResolvedValue({
    ok: false,
    error: { code: 'AUDIT_UNAVAILABLE', status: 503, message: 'AUDIT_UNAVAILABLE' },
  });
  await expect(
    guard.canActivate(context({ ...req, account: { ...actor, kind: 'TEACHER' } })),
  ).rejects.toMatchObject({ domain: { status: 503, code: 'AUDIT_UNAVAILABLE' } });
});
test('student global guards ignore other API modules', async () => {
  req.originalUrl = '/api/v1/payments/register';
  delete req.account;
  await expect(guard.canActivate(context(req))).resolves.toBe(true);
  await expect(new ActiveSubscriptionGuard(audit).canActivate(context(req))).resolves.toBe(true);
  expect(client.studentAccount.findFirst).not.toHaveBeenCalled();
});
test.each(['/me', '/security/change-password'])(
  'inactive access and initial password do not block bootstrap route %s',
  async (path) => {
    req.method = path.includes('password') ? 'PATCH' : 'GET';
    req.originalUrl = '/api/v1/student' + path + '?arbitrary=1';
    req.studentCtx = {
      userId,
      studentProfileId: studentId,
      hasActiveAccess: false,
      mustChangePassword: true,
      subjectIds: [],
    };
    await expect(new ActiveSubscriptionGuard(audit).canActivate(context(req))).resolves.toBe(true);
    expect(audit.denial).not.toHaveBeenCalled();
  },
);
test.each(['/dashboard', '/profile-other', '/security-other', '/me/foreign'])(
  'protected path %s returns 402 and configured manager contacts',
  async (path) => {
    process.env.STUDENT_MANAGER_WHATSAPP = 'https://wa.me/000000000';
    process.env.STUDENT_MANAGER_TELEGRAM = 'https://t.me/example';
    req.originalUrl = '/api/v1/student' + path + '?exception=/security';
    req.studentCtx = {
      userId,
      studentProfileId: studentId,
      hasActiveAccess: false,
      mustChangePassword: false,
      subjectIds: [],
    };
    let error;
    try {
      await new ActiveSubscriptionGuard(audit).canActivate(context(req));
    } catch (e) {
      error = e.domain;
    }
    expect(error).toMatchObject({
      status: 402,
      code: 'ACCESS_SUSPENDED',
      details: {
        managerContacts: { whatsapp: '', telegram: '' },
      },
    });
    const problem = new ErrorMapper().toProblemDetails(error, req.originalUrl, req.requestId);
    expect(problem).toMatchObject({
      status: 402,
      code: 'ACCESS_SUSPENDED',
      managerContacts: { whatsapp: '', telegram: '' },
    });
    expect(problem.instance).not.toContain('?');
  },
);
test('protected routes require initial password change, while paid access is accepted afterwards', async () => {
  req.originalUrl = '/api/v1/student/dashboard';
  req.studentCtx = {
    userId,
    studentProfileId: studentId,
    hasActiveAccess: true,
    mustChangePassword: true,
    subjectIds: [],
  };
  await expect(new ActiveSubscriptionGuard(audit).canActivate(context(req))).rejects.toMatchObject({
    domain: { status: 403, code: 'MUST_CHANGE_PASSWORD' },
  });
  req.studentCtx.mustChangePassword = false;
  await expect(new ActiveSubscriptionGuard(audit).canActivate(context(req))).resolves.toBe(true);
});
test('scoped session and CSRF adapters reuse successful core checks and call core when necessary', async () => {
  const session = { canActivate: jest.fn(async () => true) },
    csrf = { canActivate: jest.fn(async () => true) };
  expect(new StudentSessionGuard(session).canActivate(context(req))).toBe(true);
  req.csrfValidated = true;
  expect(new StudentCsrfGuard(csrf).canActivate(context(req))).toBe(true);
  expect(session.canActivate).not.toHaveBeenCalled();
  expect(csrf.canActivate).not.toHaveBeenCalled();
  delete req.account;
  delete req.csrfValidated;
  await new StudentSessionGuard(session).canActivate(context(req));
  await new StudentCsrfGuard(csrf).canActivate(context(req));
  expect(session.canActivate).toHaveBeenCalledTimes(1);
  expect(csrf.canActivate).toHaveBeenCalledTimes(1);
});

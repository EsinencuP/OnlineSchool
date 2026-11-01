import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { beforeEach, expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { ManagerScopeService } from '../../apps/api/dist/modules/manager/scope/manager-scope.service.js';
import { ManagerMeService } from '../../apps/api/dist/modules/manager/me/manager-me.service.js';
import { ManagerContextGuard } from '../../apps/api/dist/modules/manager/guards/manager-context.guard.js';
import { PolicyService } from '../../apps/api/dist/core/policy/policy.service.js';

const principal = {
  accountId: randomUUID(),
  sessionId: randomUUID(),
  requestId: randomUUID(),
  kind: 'STAFF',
  role: 'MANAGER',
  roles: ['MANAGER'],
  mfaCompleted: true,
};
let profile, db, scope, ctx;
beforeEach(async () => {
  profile = { id: randomUUID(), full_name: 'Manager A', deactivated_at: null };
  db = {
    staffAccount: { findFirst: jest.fn(async () => profile) },
    student: { findFirst: jest.fn(async () => null), count: jest.fn(async () => 2) },
  };
  scope = new ManagerScopeService({ client: db });
  ctx = (await scope.resolveContext(principal)).value;
});
test('context maps StaffAccount from session identity, carries immutable request/session ids', async () => {
  expect(ctx).toEqual({
    accountId: principal.accountId,
    managerId: profile.id,
    sessionId: principal.sessionId,
    requestId: principal.requestId,
  });
  expect(Object.isFrozen(ctx)).toBe(true);
  expect(db.staffAccount.findFirst.mock.calls[0][0]).toEqual({
    where: { account_id: principal.accountId, account_kind: 'STAFF' },
    select: { id: true, deactivated_at: true },
  });
});
test.each(['STUDENT', 'TEACHER', 'DIRECTOR', 'TECH_OPERATOR', 'ADMIN'])(
  'role %s is denied before DB access',
  async (role) => {
    db.staffAccount.findFirst.mockClear();
    expect(await scope.resolveContext({ ...principal, roles: [role], role })).toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN_ROLE', status: 403 },
    });
    expect(db.staffAccount.findFirst).not.toHaveBeenCalled();
  },
);
test('mixed role, mixed account kind, missing and inactive profiles fail closed', async () => {
  for (const actor of [
    { ...principal, roles: ['MANAGER', 'DIRECTOR'] },
    { ...principal, kind: 'TEACHER' },
  ])
    expect((await scope.resolveContext(actor)).error.code).toBe('FORBIDDEN_ROLE');
  profile.deactivated_at = new Date();
  expect((await scope.resolveContext(principal)).error.code).toBe('MANAGER_INACTIVE');
  profile = null;
  expect((await scope.resolveContext(principal)).error.code).toBe('MANAGER_PROFILE_NOT_FOUND');
});
test('portfolio predicate uses the real temporal relation and excludes future/ended assignments', () => {
  const where = scope.portfolioWhere(ctx).manager_assignments.some;
  expect(where.manager_id).toBe(ctx.managerId);
  expect(where.assigned_at.lte).toBeInstanceOf(Date);
  expect(where.OR).toEqual([{ ended_at: null }, { ended_at: { gt: where.assigned_at.lte } }]);
});
test('own student passes; foreign and missing use the identical scoped query/projection and error', async () => {
  const own = randomUUID(),
    foreign = randomUUID(),
    missing = randomUUID();
  db.student.findFirst.mockImplementation(async ({ where }) =>
    where.AND[0].id === own ? { id: own } : null,
  );
  expect(await scope.assertStudentInPortfolio(ctx, own)).toEqual({ ok: true, value: undefined });
  const denied = await scope.assertStudentInPortfolio(ctx, foreign);
  expect(await scope.assertStudentInPortfolio(ctx, missing)).toEqual(denied);
  expect(denied).toEqual({
    ok: false,
    error: { code: 'STUDENT_NOT_FOUND', status: 404, message: 'STUDENT_NOT_FOUND' },
  });
  expect(db.student.findFirst).toHaveBeenCalledTimes(3);
  for (const [query] of db.student.findFirst.mock.calls) {
    expect(query.select).toEqual({ id: true });
    expect(query.where.AND[1].manager_assignments.some.manager_id).toBe(ctx.managerId);
  }
  expect((await scope.assertStudentInPortfolio(ctx, 'invalid')).error.code).toBe(
    'STUDENT_NOT_FOUND',
  );
});
test('all data-access failures become generic Result errors without original details', async () => {
  const error = new Error('student B private phone SQL connection password');
  db.staffAccount.findFirst.mockRejectedValue(error);
  db.student.findFirst.mockRejectedValue(error);
  for (const result of [
    await scope.resolveContext(principal),
    await scope.assertStudentInPortfolio(ctx, randomUUID()),
  ]) {
    expect(result).toEqual({
      ok: false,
      error: { code: 'DATABASE_ERROR', status: 503, message: 'DATABASE_ERROR' },
    });
  }
});
test('me is scoped, uses configured timezone and policy capabilities without financial confirmation', async () => {
  const old = process.env.SCHOOL_TIMEZONE;
  try {
    process.env.SCHOOL_TIMEZONE = 'Asia/Tokyo';
    const me = new ManagerMeService({ client: db }, scope, new PolicyService({ client: db }));
    const result = await me.get(ctx, principal);
    expect(result.value).toEqual({
      managerId: ctx.managerId,
      displayName: 'Manager A',
      role: 'MANAGER',
      portfolioSize: 2,
      timezone: 'Asia/Tokyo',
      capabilities: ['STUDENTS_VIEW', 'ACCOUNTS_CREATE', 'SUBSCRIPTIONS_MANAGE', 'SCHEDULE_MANAGE'],
    });
    expect(db.student.count.mock.calls[0][0].where.manager_assignments.some.manager_id).toBe(
      ctx.managerId,
    );
    process.env.SCHOOL_TIMEZONE = 'invalid/timezone';
    expect((await me.get(ctx, principal)).error.code).toBe('MANAGER_CONFIGURATION_INVALID');
    process.env.SCHOOL_TIMEZONE = 'Europe/Chisinau';
    db.student.count.mockRejectedValue(new Error('private B'));
    expect((await me.get(ctx, principal)).error.code).toBe('DATABASE_ERROR');
  } finally {
    if (old === undefined) delete process.env.SCHOOL_TIMEZONE;
    else process.env.SCHOOL_TIMEZONE = old;
  }
});
test('guard clears stale context and loads only core session identity; no session is 401', async () => {
  const audit = { denial: jest.fn(async () => ({ ok: true, value: undefined })) };
  const guard = new ManagerContextGuard(scope, audit);
  const req = {
    account: principal,
    requestId: principal.requestId,
    managerCtx: { managerId: 'spoof' },
    body: { managerId: 'spoof' },
    query: { managerId: 'spoof' },
  };
  const host = { switchToHttp: () => ({ getRequest: () => req }) };
  expect(await guard.canActivate(host)).toBe(true);
  expect(req.managerCtx).toEqual(ctx);
  delete req.account;
  await expect(guard.canActivate(host)).rejects.toMatchObject({
    domain: { code: 'UNAUTHENTICATED', status: 401 },
  });
  expect(req.managerCtx).toBeUndefined();
});

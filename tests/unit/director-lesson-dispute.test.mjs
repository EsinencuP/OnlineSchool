import '../../apps/api/node_modules/reflect-metadata/Reflect.js';
import { expect, jest, test } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import { DirectorLessonDisputeService } from '../../apps/api/dist/modules/director/director-lesson-dispute.service.js';
import { PayrollService } from '../../apps/api/dist/modules/finance/payroll.service.js';
import { TeacherPayrollService } from '../../apps/api/dist/modules/teacher/teacher-payroll.service.js';
import { Decimal } from '../../apps/api/dist/modules/finance/finance-common.js';
import { domainError, fail } from '../../apps/api/dist/core/errors/domain-error.js';

function fixture() {
  const now = new Date('2026-11-17T10:00:00.000Z');
  const report = { id: randomUUID(), result: 'DISPUTED', lesson_occurrence_id: randomUUID() };
  const lesson = {
    id: report.lesson_occurrence_id,
    kind: 'REGULAR',
    status: 'DISPUTED',
    confirmed_report_id: report.id,
    scheduled_at: new Date('2026-10-22T12:00:00.000Z'),
    scheduled_end_at: new Date('2026-10-22T13:00:00.000Z'),
    scheduled_teacher_id: randomUUID(),
    teaching_assignment_id: randomUUID(),
    enrollment_id: randomUUID(),
    actual_start_at: null,
  };
  const origin = { id: randomUUID(), closed_at: new Date('2026-11-02T12:00:00.000Z') };
  const staffId = randomUUID();
  const outcomeId = randomUUID();
  const studentId = randomUUID();
  const tx = {
    $queryRaw: jest.fn(async (sql) => {
      const sqlText = sql.join('?');
      if (sqlText.includes('clock_timestamp()')) return [{ now }];
      if (sqlText.includes('SELECT EXISTS')) return [{ ok: false }];
      if (sqlText.includes('SELECT count(*)::int')) return [{ count: 1 }];
      return [];
    }),
    lessonOccurrence: {
      findUnique: jest.fn(async () => ({ ...lesson })),
      findUniqueOrThrow: jest.fn(async () => ({ ...lesson })),
      update: jest.fn(async ({ data }) => Object.assign(lesson, data)),
    },
    lessonOutcomeReport: { findUnique: jest.fn(async () => report) },
    lessonAdmissionStart: { findUnique: jest.fn(async () => null) },
    lessonActualOutcome: {
      findUnique: jest.fn(),
      create: jest.fn(async ({ data }) => ({ id: outcomeId, ...data })),
    },
    lessonOutcomeDisputeDecision: {
      create: jest.fn(async ({ data }) => ({ id: randomUUID(), ...data })),
      findUnique: jest.fn(),
    },
    studentSubjectEnrollment: {
      findUniqueOrThrow: jest.fn(async () => ({ student_id: studentId, subject_id: randomUUID() })),
    },
    teachingAssignment: { findFirst: jest.fn(async () => ({ id: lesson.teaching_assignment_id })) },
    teacherAccrual: { create: jest.fn() },
  };
  const access = {
    staff: jest.fn(async ({ actor }, director) => {
      if (director && !actor.roles.includes('DIRECTOR')) return fail(domainError('FORBIDDEN', 403));
      return staffId;
    }),
    student: jest.fn(),
  };
  const rates = {
    quote: jest.fn(async () => ({
      rate: new Decimal('220'),
      points: 5,
      basis: 'ORDINARY_POINTS',
      currency: 'MDL',
      context: { eligibleMonths: 10 },
    })),
  };
  const ledger = { periodState: jest.fn(async () => origin), period: jest.fn() };
  const events = { change: jest.fn(), task: jest.fn() };
  const service = new DirectorLessonDisputeService({}, access, rates, ledger, events);
  const ctx = {
    tx,
    actor: { roles: ['DIRECTOR'], mfaCompleted: true, accountId: randomUUID() },
    operationId: randomUUID(),
    requestId: randomUUID(),
  };
  const documented = {
    reportId: report.id,
    result: 'CONDUCTED',
    actualStartedAt: lesson.scheduled_at.toISOString(),
    durationMin: 35,
    evidenceReference: 'CASE-247',
    reason: 'Attendance verified against the referenced record',
  };
  return {
    service,
    ctx,
    tx,
    rates,
    ledger,
    events,
    access,
    lesson,
    origin,
    outcomeId,
    staffId,
    now,
    documented,
  };
}

test('a conducted dispute reuses the permission recorded at actual start', async () => {
  const { service, ctx, tx, lesson, documented } = fixture();
  const permission = randomUUID();
  tx.lessonAdmissionStart.findUnique.mockResolvedValue({ permission_id: permission });
  await expect(
    service.resolve(ctx, lesson.id, {
      ...documented,
      temporaryAccessPermissionId: randomUUID(),
    }),
  ).rejects.toMatchObject({ domain: { code: 'DIRECTOR_PERMISSION_NOT_APPLICABLE' } });
  expect(tx.lessonActualOutcome.create).not.toHaveBeenCalled();
  await service.resolve(ctx, lesson.id, documented);
  expect(tx.lessonActualOutcome.create.mock.calls[0][0].data).toMatchObject({
    temporary_access_permission_id: permission,
  });
  expect(tx.$queryRaw.mock.calls.map(([parts]) => parts.join('')).join('\n')).not.toContain(
    'FROM temporary_access_permissions',
  );
});

test('late confirmation reconstructs the rate at the verified start without accruing or replacing the report', async () => {
  const { service, ctx, tx, rates, events, lesson, origin, outcomeId, staffId, now, documented } =
    fixture();
  const result = await service.resolve(ctx, lesson.id, documented);
  expect(result).toMatchObject({
    outcomeId,
    reportId: documented.reportId,
    originPeriodId: origin.id,
    reconstructedSnapshot: true,
    requiresFinancialDecision: true,
  });
  expect(rates.quote).toHaveBeenCalledWith(tx, lesson.scheduled_teacher_id, lesson.scheduled_at);
  expect(tx.lessonOccurrence.update).toHaveBeenNthCalledWith(1, {
    where: { id: lesson.id },
    data: expect.objectContaining({
      rate_context_snapshot: expect.objectContaining({
        source: 'DIRECTOR_VERIFIED_RETROSPECTIVE',
        recordedAt: now.toISOString(),
        evidenceReference: 'CASE-247',
      }),
    }),
  });
  expect(tx.lessonActualOutcome.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      confirmed_by_id: staffId,
      duration_min: 35,
      rate_snapshot: new Decimal('220'),
    }),
  });
  expect(lesson.confirmed_report_id).toBe(documented.reportId);
  expect(lesson.status).toBe('CONDUCTED');
  expect(tx.teacherAccrual.create).not.toHaveBeenCalled();
  expect(events.task).toHaveBeenCalledTimes(1);
  await expect(service.resolve(ctx, lesson.id, documented)).rejects.toMatchObject({
    domain: { code: 'LESSON_DISPUTE_ALREADY_RESOLVED' },
  });
  expect(tx.lessonActualOutcome.create).toHaveBeenCalledTimes(1);
});

test('an existing actual-start snapshot is reused and a conflicting timestamp is denied', async () => {
  const { service, ctx, tx, rates, lesson, documented } = fixture();
  Object.assign(lesson, {
    actual_start_at: lesson.scheduled_at,
    actual_teacher_at_start_id: lesson.scheduled_teacher_id,
    rate_at_start_snapshot: new Decimal('250'),
    points_at_start_snapshot: 10,
    rate_basis_at_start: 'ORDINARY_POINTS',
    rate_currency_at_start: 'MDL',
  });
  await expect(
    service.resolve(ctx, lesson.id, {
      ...documented,
      actualStartedAt: '2026-10-22T12:01:00.000Z',
    }),
  ).rejects.toMatchObject({ domain: { code: 'ACTUAL_START_SNAPSHOT_MISMATCH' } });
  expect((await service.resolve(ctx, lesson.id, documented)).reconstructedSnapshot).toBe(false);
  expect(rates.quote).not.toHaveBeenCalled();
  expect(tx.lessonActualOutcome.create.mock.calls[0][0].data.rate_snapshot).toEqual(
    new Decimal('250'),
  );
});

test('a documented non-conducted decision changes the lesson and does not create a conducted fact', async () => {
  const { service, ctx, tx, lesson, documented } = fixture();
  const result = await service.resolve(ctx, lesson.id, {
    reportId: documented.reportId,
    reason: documented.reason,
    evidenceReference: documented.evidenceReference,
    result: 'NOT_CONDUCTED',
  });
  expect(result).toMatchObject({ outcomeId: null, requiresFinancialDecision: false });
  expect(lesson.status).toBe('CANCELLED');
  expect(tx.lessonActualOutcome.create).not.toHaveBeenCalled();
});

test.each([
  ['missing start', { actualStartedAt: undefined }, {}, 'DOCUMENTED_LESSON_START_REQUIRED'],
  ['wrong report', { reportId: randomUUID() }, {}, 'LESSON_DISPUTE_REPORT_CHANGED'],
  ['password-only director', {}, { mfaCompleted: false }, 'MFA_REQUIRED'],
  ['manager', {}, { roles: ['MANAGER'] }, 'FORBIDDEN'],
])('denies %s before recording a decision', async (_name, form, actor, code) => {
  const { service, ctx, tx, lesson, documented } = fixture();
  Object.assign(ctx.actor, actor);
  await expect(service.resolve(ctx, lesson.id, { ...documented, ...form })).rejects.toMatchObject({
    domain: { code },
  });
  expect(tx.lessonOutcomeDisputeDecision.create).not.toHaveBeenCalled();
  expect(tx.lessonOccurrence.update).not.toHaveBeenCalled();
});

test('a conducted disputed case cannot default to its rate as a payroll award', async () => {
  const { access, ledger, ctx, tx, lesson, outcomeId } = fixture();
  lesson.status = 'CONDUCTED';
  tx.lessonActualOutcome.findUnique.mockResolvedValue({ lesson_occurrence_id: lesson.id });
  tx.lessonOutcomeDisputeDecision.findUnique.mockResolvedValue({ id: randomUUID() });
  const service = new PayrollService(access, ledger, {}, {});
  await expect(
    service.accrue(ctx, { outcomeId, basis: 'Director reviewed evidence' }),
  ).rejects.toMatchObject({
    domain: { code: 'DISPUTED_LESSON_REQUIRES_DIRECTOR_AMOUNT' },
  });
  expect(tx.teacherAccrual.create).not.toHaveBeenCalled();
});

test('a separate director award recognizes the exact approved amount in the current period', async () => {
  const { access, ledger, ctx, tx, lesson, outcomeId, staffId, now } = fixture();
  const currentPeriodId = randomUUID(),
    accrualId = randomUUID(),
    obligationId = randomUUID();
  lesson.status = 'CONDUCTED';
  tx.lessonActualOutcome.findUnique.mockResolvedValue({
    lesson_occurrence_id: lesson.id,
    actual_teacher_id: lesson.scheduled_teacher_id,
    actual_started_at: lesson.scheduled_at,
    confirmed_at: now,
    rate_snapshot: new Decimal('220'),
    points_snapshot: 5,
    rate_basis: 'ORDINARY_POINTS',
    currency: 'MDL',
  });
  tx.lessonOutcomeDisputeDecision.findUnique.mockResolvedValue({ id: randomUUID() });
  tx.teacherAccrual.create.mockImplementation(async ({ data }) => ({ id: accrualId, ...data }));
  tx.payrollObligation = {
    create: jest.fn(async () => ({ id: obligationId })),
    update: jest.fn(),
  };
  ledger.period.mockResolvedValue(currentPeriodId);
  ledger.event = jest.fn(async () => ({ id: randomUUID() }));
  const service = new PayrollService(access, ledger, {}, {});
  const award = await service.accrue(ctx, {
    outcomeId,
    basis: 'Approved amount supported by settlement record',
    exceptionAmount: '110.2500',
  });
  expect(award).toMatchObject({
    amount: new Decimal('110.25'),
    rate_snapshot: new Decimal('220'),
    financial_period_id: currentPeriodId,
    exception_authorized_by_id: staffId,
    obligationId,
  });
  expect(ledger.period).toHaveBeenCalledWith(tx, now);
  expect(ledger.event).toHaveBeenCalledWith(
    ctx,
    expect.objectContaining({ accrual_id: accrualId }),
  );
});

test('a teacher statement exposes an open dispute without including an estimated award', async () => {
  const teacherId = randomUUID();
  const row = {
    lesson_id: randomUUID(),
    report_id: randomUUID(),
    lesson_at: new Date('2026-10-22T12:00:00Z'),
    student_name: 'Fixture student',
    subject_name: 'Fixture subject',
    status: 'AWAITING_DIRECTOR_ACCRUAL',
  };
  const $queryRaw = jest.fn(async (sql) => {
    if ((sql.text ?? sql.join('?')).includes('WITH m AS')) {
      return [{ month: '2026-10', start: new Date('2026-10-01Z'), end: new Date('2026-11-01Z') }];
    }
    if (sql.text.includes('AWAITING_DIRECTOR_ACCRUAL')) {
      expect(sql.values).toContain(teacherId);
      return [row];
    }
    return [];
  });
  const service = new TeacherPayrollService(
    { runReadOnly: (read) => read({ $queryRaw }) },
    { get: async () => ({ timezone: 'Europe/Chisinau' }) },
  );
  const result = await service.statement({ teacherId }, {}, '2026-10');
  expect(result).toMatchObject({
    ok: true,
    value: {
      totals: [],
      lines: [],
      reviewItems: [{ lessonId: row.lesson_id, status: row.status }],
    },
  });
  expect(result.value.reviewItems[0]).not.toHaveProperty('amount');
});

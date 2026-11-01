import { http, HttpResponse, delay } from 'msw';
import type { HttpResponseResolver } from 'msw';
import openapi from '../../../../packages/api-contracts/openapi/openapi.json';
import {
  me,
  lead,
  student,
  listItem,
  subscription,
  receipt,
  distribution,
  lesson,
  task,
  options,
  notification,
  ids,
} from './fixtures.js';
import { localInput } from '../lib/time.js';
import type {
  ManagerLessonDto,
  ManagerPaymentDto,
  ManagerNotificationDto,
  LeadDto,
} from '@online-school/api-contracts';
// Operation paths and DTOs come from the same checked-in OpenAPI as the production client.
const operations = Object.entries(openapi.paths).flatMap(([path, item]) =>
  Object.entries(item).map(([method, op]) => ({
    path: path.replace(/\{([^}]+)\}/g, ':$1'),
    method,
    operationId: 'operationId' in op ? op.operationId : '',
  })),
);
export const mockState = {
  passwordOnly: false,
  leads: [structuredClone(lead)] as LeadDto[],
  student: structuredClone(student),
  subscriptions: [structuredClone(subscription)],
  payments: [structuredClone(receipt)],
  distributions: [structuredClone(distribution)],
  lessons: [structuredClone(lesson)],
  task: structuredClone(task),
  notifications: [] as ManagerNotificationDto[],
  commands: [] as {
    op: string;
    body: Record<string, unknown>;
    key: string | null;
    csrf: string | null;
  }[],
  session: 'active',
  conflict: false,
  duplicateLead: false,
  empty: false,
  fail: false,
  accountDelay: 0,
  approvePayment() {
    this.payments.forEach((p) => (p.status = 'CONFIRMED'));
    this.distributions = [structuredClone(distribution)];
  },
  rescheduleTask() {
    this.task = {
      ...structuredClone(task),
      type: 'RESCHEDULE_REQUEST',
      payload: {
        kind: 'RESCHEDULE_REQUEST',
        lessonId: ids.lesson,
        currentStartsAt: lesson.startsAt,
        studentComment: 'Перенесите, пожалуйста.',
        preferredWindows: [],
        preferredDate: null,
      },
    };
  },
};
const failure = (code: string, status: number) =>
  HttpResponse.json(
    {
      code,
      status,
      message: 'Internal detail must never be displayed',
      requestId: 'fixture-request-id',
    },
    { status, headers: { 'x-request-id': 'fixture-request-id' } },
  );
function on(operationId: string, resolver: HttpResponseResolver) {
  const op = operations.find((entry) => entry.operationId === operationId)!;
  const method = op.method as 'get' | 'post' | 'patch' | 'delete';
  return http[method](`*${op.path}`, async (args) => {
    if (mockState.session === 'anonymous' && operationId !== 'getCsrfToken')
      return failure('UNAUTHENTICATED', 401);
    if (mockState.session === 'forbidden' && operationId === 'getManagerMe')
      return failure('FORBIDDEN_ROLE', 403);
    if (
      mockState.fail &&
      method === 'get' &&
      operationId !== 'getManagerMe' &&
      operationId !== 'getCsrfToken'
    )
      return failure('DATABASE_ERROR', 503);
    if (method !== 'get') {
      const raw = (await args.request.clone().json()) as Record<string, unknown>;
      const body = Object.fromEntries(Object.entries(raw).filter(([key]) => key !== 'password'));
      const key = args.request.headers.get('Idempotency-Key'),
        csrf = args.request.headers.get('X-CSRF-Token');
      mockState.commands.push({ op: operationId, body, key, csrf });
      if (!key || !csrf) return failure('CSRF_REQUIRED', 403);
    }
    return resolver(args);
  });
}
const page = <T>(items: T[], request: Request) => {
  const url = new URL(request.url);
  return {
    items,
    total: items.length,
    page: parseInt(url.searchParams.get('page') ?? '1', 10),
    pageSize: parseInt(url.searchParams.get('pageSize') ?? '20', 10),
  };
};
const json = (value: unknown) => HttpResponse.json(value as Record<string, unknown>);
function leadSummary() {
  const rows = mockState.empty ? [] : mockState.leads;
  return {
    countsByStage: Object.fromEntries(
      ['NEW', 'IN_PROGRESS', 'TRIAL', 'AWAITING_PAYMENT'].map((stage) => [
        stage,
        rows.filter((l) => l.stage === stage).length,
      ]),
    ),
    createdToday: rows.length,
    trialsToday: rows.filter((l) => l.trial).length,
    overdueFollowups: 0,
    conversion30dBp: rows.length
      ? Math.floor((rows.filter((l) => l.stage === 'CONVERTED').length * 10000) / rows.length)
      : 0,
  };
}
function mockLeadAction(op: string, to: LeadDto['stage']) {
  return on(op, async ({ request, params }) => {
    const body = (await request.json()) as {
      version: number;
      reason?: LeadDto['lostReason'];
      comment?: string;
    };
    const row = mockState.leads.find((l) => l.leadId === params.leadId);
    if (!row) return failure('LEAD_NOT_FOUND', 404);
    if (body.version !== row.version) return failure('LEAD_VERSION_CONFLICT', 409);
    const from = row.stage;
    row.stage = to;
    row.version++;
    row.stageChangedAt = new Date().toISOString();
    row.history.push({ from, to, at: row.stageChangedAt, byManager: true });
    if (to === 'LOST') {
      row.lostReason = body.reason ?? 'OTHER';
      row.lostComment = body.comment ?? null;
    }
    return json(row);
  });
}
export const handlers = [
  on('getManagerLeadSummary', () => json(leadSummary())),
  on('listManagerLeads', ({ request }) => {
    const q = new URL(request.url).searchParams;
    const rows = mockState.empty
      ? []
      : mockState.leads.filter(
          (l) =>
            (!q.get('stage') || q.get('stage')!.split(',').includes(l.stage)) &&
            (!q.get('search') || l.contactName.includes(q.get('search')!)),
        );
    const keys = [
      'leadId',
      'stage',
      'audience',
      'contactName',
      'subjectName',
      'grade',
      'maskedPhone',
      'source',
      'createdAt',
      'stageChangedAt',
      'trialAt',
      'nextActionAt',
      'isOverdue',
    ] as const;
    return json({
      items: rows.map((l) => Object.fromEntries(keys.map((k) => [k, l[k]]))),
      nextCursor: null,
    });
  }),
  on('getManagerLead', ({ params }) => {
    const row = mockState.leads.find((l) => l.leadId === params.leadId);
    return row ? json(row) : failure('LEAD_NOT_FOUND', 404);
  }),
  on('createManagerLead', async ({ request }) => {
    const body = (await request.json()) as Partial<LeadDto> & { forceCreate?: boolean };
    if (mockState.duplicateLead && !body.forceCreate)
      return HttpResponse.json(
        { code: 'LEAD_DUPLICATE_SUSPECTED', details: { existingId: ids.lead } },
        { status: 409 },
      );
    const row = {
      ...structuredClone(lead),
      ...body,
      leadId: crypto.randomUUID(),
      stage: 'NEW' as const,
      version: 1,
    };
    mockState.leads.push(row);
    return HttpResponse.json(row, { status: 201 });
  }),
  on('updateManagerLead', async ({ request, params }) => {
    const body = (await request.json()) as Partial<LeadDto>;
    const row = mockState.leads.find((l) => l.leadId === params.leadId);
    if (!row) return failure('LEAD_NOT_FOUND', 404);
    if (body.version !== row.version) return failure('LEAD_VERSION_CONFLICT', 409);
    Object.assign(row, body, { version: row.version + 1 });
    return json(row);
  }),
  mockLeadAction('claimManagerLead', 'IN_PROGRESS'),
  mockLeadAction('loseManagerLead', 'LOST'),
  mockLeadAction('reopenManagerLead', 'IN_PROGRESS'),
  on('transitionManagerLead', async ({ request, params }) => {
    const body = (await request.json()) as { to: LeadDto['stage']; version: number };
    const row = mockState.leads.find((l) => l.leadId === params.leadId);
    if (!row) return failure('LEAD_NOT_FOUND', 404);
    if (body.version !== row.version) return failure('LEAD_VERSION_CONFLICT', 409);
    row.stage = body.to;
    row.version++;
    row.studentId ??= ids.student;
    return json(row);
  }),
  on('scheduleManagerTrial', async ({ request, params }) => {
    const body = (await request.json()) as { startsAt: string; teacherId: string; version: number };
    const row = mockState.leads.find((l) => l.leadId === params.leadId);
    if (!row) return failure('LEAD_NOT_FOUND', 404);
    if (body.version !== row.version) return failure('LEAD_VERSION_CONFLICT', 409);
    row.version++;
    row.stage = 'TRIAL';
    row.studentId = ids.student;
    row.trialAt = body.startsAt;
    row.trial = {
      lessonId: ids.lesson,
      startsAt: body.startsAt,
      endsAt: new Date(+new Date(body.startsAt) + 50 * 60000).toISOString(),
      teacherName: lesson.teacherName,
      meetLink: null,
      outcome: 'PENDING',
      feedbackStatus: 'PENDING',
      feedbackSummary: null,
    };
    return json(row);
  }),
  on('getCsrfToken', () => json({ csrfToken: 'fixture-csrf' })),
  on('getManagerMe', () => json({ ...me, portfolioSize: mockState.empty ? 0 : 1 })),
  on('deleteSession', () => json({ loggedOut: true })),
  on('createSession', () =>
    json({
      account: { id: ids.manager, kind: 'STAFF', roles: ['MANAGER'] },
      mfa_completed: false,
      ...(mockState.passwordOnly ? { manager_password_only: true } : {}),
      recovery_only: false,
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    }),
  ),
  on('getManagerOptions', () =>
    json(
      mockState.empty
        ? { ...options, students: [], enrollments: [], financialSubscriptions: [] }
        : options,
    ),
  ),
  on('listManagerStudents', ({ request }) => {
    const q = new URL(request.url).searchParams;
    const item = {
      ...listItem,
      fullName: mockState.student.fullName,
      status: mockState.student.status,
      hasAccount: mockState.student.hasAccount,
    };
    return json({
      items:
        mockState.empty ||
        (q.get('search') && !item.fullName.includes(q.get('search')!)) ||
        (q.get('status') && q.get('status') !== item.status)
          ? []
          : [item],
      nextCursor: null,
    });
  }),
  on('getManagerStudentCard', () => json(mockState.student)),
  on('createManagerStudent', async ({ request }) => {
    const body = (await request.json()) as { fullName: string; email?: string };
    mockState.student = {
      ...structuredClone(student),
      fullName: body.fullName,
      status: 'LEAD',
      hasAccount: false,
      subscription: null,
      contacts: { ...student.contacts, email: body.email ?? null },
    };
    mockState.payments = [];
    mockState.distributions = [];
    mockState.subscriptions = [];
    return json(mockState.student);
  }),
  on('updateManagerStudentContacts', async ({ request }) => {
    const body = (await request.json()) as {
      version: number;
      email: string | null;
      phone: string | null;
      guardianName: string | null;
      managerNote: string | null;
    };
    if (mockState.conflict) {
      mockState.conflict = false;
      mockState.student.version++;
      return failure('VERSION_CONFLICT', 409);
    }
    mockState.student = {
      ...mockState.student,
      contacts: {
        ...mockState.student.contacts,
        email: body.email,
        phone: body.phone,
        guardianName: body.guardianName,
      },
      managerNote: body.managerNote,
      version: body.version + 1,
    };
    return json(mockState.student);
  }),
  on('createEnrollment', () =>
    json({
      id: ids.enrollment,
      student_id: ids.student,
      subject_id: ids.subject,
      status: 'ACTIVE',
      valid_from: new Date().toISOString(),
      valid_to: null,
    }),
  ),
  on('createManagerStudentAccount', async ({ request }) => {
    if (mockState.accountDelay) await delay(mockState.accountDelay);
    if (!mockState.distributions.some((d) => d.ledgerPublicationId))
      return failure('FIRST_PAYMENT_NOT_CONFIRMED', 422);
    const body = (await request.json()) as { loginEmail: string };
    mockState.student.hasAccount = true;
    return json({
      accountId: ids.student,
      loginEmail: body.loginEmail,
      temporaryPassword: 'Fixture-Only-Password!47',
      temporaryPasswordExpiresAt: new Date(Date.now() + 3600000).toISOString(),
      passwordAlreadyIssued: false,
    });
  }),
  on('resetManagerStudentPassword', () =>
    json({
      accountId: ids.student,
      loginEmail: 'student@example.test',
      temporaryPassword: 'Fixture-Only-Password!47',
      temporaryPasswordExpiresAt: new Date(Date.now() + 3600000).toISOString(),
      passwordAlreadyIssued: false,
    }),
  ),
  on('listManagerPayments', ({ request }) => {
    const status = new URL(request.url).searchParams.get('status');
    return json(
      page(
        mockState.empty ? [] : mockState.payments.filter((p) => !status || p.status === status),
        request,
      ),
    );
  }),
  on('createManagerPayment', async ({ request }) => {
    const body = (await request.json()) as Partial<ManagerPaymentDto>;
    const p = { ...structuredClone(receipt), ...body, status: 'PENDING' as const };
    mockState.payments.push(p);
    return json(p);
  }),
  on('confirmManagerPayment', () => {
    const p = mockState.payments[0]!;
    p.status = 'AWAITING_APPROVAL';
    return json(p);
  }),
  on('rejectManagerPayment', () => {
    const p = mockState.payments[0]!;
    p.status = 'REJECTED';
    return json(p);
  }),
  on('listManagerDistributions', ({ request }) =>
    json(page(mockState.empty ? [] : mockState.distributions, request)),
  ),
  on('prepareManagerPaymentSubscription', () => {
    const d = {
      ...structuredClone(distribution),
      status: 'AWAITING_APPROVAL' as const,
      ledgerPublicationId: null,
    };
    mockState.distributions = [d];
    return json(d);
  }),
  on('allocateManagerPayment', () => {
    const d = {
      ...structuredClone(distribution),
      status: 'AWAITING_APPROVAL' as const,
      ledgerPublicationId: null,
    };
    mockState.distributions = [d];
    return json(d);
  }),
  on('listManagerSubscriptions', () => json(mockState.empty ? [] : mockState.subscriptions)),
  on('createManagerSubscription', () => {
    mockState.subscriptions = [structuredClone(subscription)];
    mockState.distributions.forEach((d) => (d.consumed = true));
    mockState.student.status = 'ACTIVE';
    return json(subscription);
  }),
  on('renewManagerSubscription', () => {
    const s = mockState.subscriptions[0]!;
    s.remainingLessons += 8;
    s.totalLessons += 8;
    mockState.distributions.forEach((d) => (d.consumed = true));
    return json(s);
  }),
  on('freezeManagerSubscription', () => {
    const s = mockState.subscriptions[0]!;
    s.status = 'FROZEN';
    mockState.student.status = 'FROZEN';
    return json(s);
  }),
  on('unfreezeManagerSubscription', () => {
    const s = mockState.subscriptions[0]!;
    s.status = 'ACTIVE';
    return json(s);
  }),
  on('listManagerSchedule', ({ request }) => {
    const url = new URL(request.url);
    return json(
      mockState.empty
        ? []
        : mockState.lessons.filter(
            (l) =>
              (!url.searchParams.get('status') || url.searchParams.get('status') === l.status) &&
              (!url.searchParams.get('kind') || url.searchParams.get('kind') === l.kind) &&
              new Date(l.startsAt) >= new Date(url.searchParams.get('from')!) &&
              new Date(l.startsAt) < new Date(url.searchParams.get('to')!),
          ),
    );
  }),
  on('createManagerLesson', async ({ request }) => {
    const input = (await request.json()) as Partial<ManagerLessonDto>;
    const l = { ...structuredClone(lesson), ...input, lessonId: crypto.randomUUID() };
    mockState.lessons.push(l);
    return json(l);
  }),
  on('rescheduleManagerLesson', async ({ request }) => {
    const input = (await request.json()) as { newStartsAt: string; overrideLateRule?: boolean };
    const l = mockState.lessons[0]!;
    if (input.overrideLateRule) {
      l.requiresApproval = true;
      l.pendingChangeId = ids.task;
    } else l.startsAt = input.newStartsAt;
    return json(l);
  }),
  on('cancelManagerLesson', () => {
    const l = mockState.lessons[0]!;
    l.status = 'CANCELLED';
    return json(l);
  }),
  on('setManagerLessonMeetLink', async ({ request }) => {
    const input = (await request.json()) as { url: string };
    const l = mockState.lessons[0]!;
    l.meetLink = input.url;
    return json(l);
  }),
  on('clearManagerLessonMeetLink', () => {
    const l = mockState.lessons[0]!;
    l.meetLink = null;
    return json(l);
  }),
  on('listManagerTasks', ({ request }) => {
    const q = new URL(request.url).searchParams;
    return json({
      items:
        mockState.empty ||
        (q.get('type') && q.get('type') !== mockState.task.type) ||
        (q.get('status') && !q.get('status')!.split(',').includes(mockState.task.status))
          ? []
          : [mockState.task],
      nextCursor: null,
    });
  }),
  on('getManagerTask', () => json(mockState.task)),
  on('claimManagerTask', () => {
    mockState.task.status = 'IN_PROGRESS';
    mockState.task.version++;
    return json(mockState.task);
  }),
  on('resolveManagerTaskDispute', async ({ request }) => {
    const input = (await request.json()) as { decision: string; reason: string };
    if (mockState.conflict) {
      mockState.conflict = false;
      mockState.task.version++;
      return failure('TASK_VERSION_CONFLICT', 409);
    }
    mockState.task.resolution = input;
    if (input.decision === 'REJECT') mockState.task.status = 'REJECTED';
    else
      mockState.task.approvalStatus =
        input.decision === 'ACCEPT' ? 'AWAITING_DIRECTOR' : 'MANUAL_FINANCE_REVIEW';
    mockState.task.version++;
    return json(mockState.task);
  }),
  on('resolveManagerTaskReschedule', async ({ request }) => {
    const input = (await request.json()) as { decision: string; overrideLateRule?: boolean };
    mockState.task.status =
      input.decision === 'DECLINE'
        ? 'REJECTED'
        : input.overrideLateRule
          ? 'IN_PROGRESS'
          : 'RESOLVED';
    mockState.task.approvalStatus = input.overrideLateRule ? 'AWAITING_SCHEDULE_APPROVAL' : 'NONE';
    mockState.task.version++;
    return json(mockState.task);
  }),
  on('listManagerStudentNotifications', () =>
    json({ items: mockState.empty ? [] : mockState.notifications, nextCursor: null }),
  ),
  on('sendManagerStudentNotification', async ({ request }) => {
    const input = (await request.json()) as { channel: 'EMAIL' | 'IN_APP' };
    const n = { ...structuredClone(notification), channel: input.channel };
    mockState.notifications.push(n);
    return HttpResponse.json(n, { status: 202 });
  }),
  on('getManagerDashboard', () =>
    json({
      leads: leadSummary(),
      generatedAt: new Date().toISOString(),
      students: { active: mockState.empty ? 0 : 1, frozen: 0, leads: 0 },
      upcomingLessons: mockState.empty
        ? []
        : mockState.lessons.slice(0, 1).map((l) => ({
            lessonId: l.lessonId,
            studentId: l.studentId,
            studentName: mockState.student.fullName,
            startsAt: l.startsAt,
            teacherName: l.teacherName,
            hasMeetLink: !!l.meetLink,
          })),
      overdueTasks: {
        count: mockState.empty ? 0 : 1,
        top: mockState.empty
          ? []
          : [
              {
                taskId: ids.task,
                type: mockState.task.type,
                studentName: mockState.student.fullName,
                dueAt: mockState.task.dueAt,
              },
            ],
      },
      expiringSubscriptions: mockState.empty
        ? []
        : mockState.subscriptions
            .filter((s) => s.status === 'ACTIVE')
            .map((s) => ({
              subscriptionId: s.id,
              studentId: ids.student,
              studentName: mockState.student.fullName,
              endsAt: s.endsAt,
              remainingLessons: s.remainingLessons,
            })),
      pendingPayments: {
        count: mockState.empty ? 0 : 1,
        totalsByCurrency: mockState.empty ? [] : [{ currency: 'MDL', amount: '1600.0001' }],
      },
    }),
  ),
];
export const fixtureLocalTime = localInput(lesson.startsAt, me.timezone);

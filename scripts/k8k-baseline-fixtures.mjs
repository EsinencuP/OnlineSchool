// Test data adapters only. No production code imports this file.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ts from 'typescript';
export const ROOT = path.resolve(import.meta.dirname, '..');
export const NOW = '2026-11-03T10:30:30Z';
export const LONG =
  'ТЕСТ: очень длинная подпись предмета и синтетического участника / TEST: disciplină și participant cu etichetă foarte lungă';
export const uuid = (seed) => {
  const hex = crypto.createHash('sha256').update(seed).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
};
export async function managerData() {
  const p = path.join(ROOT, 'apps/manager-web/src/test/fixtures.ts');
  const original = fs.readFileSync(p, 'utf8');
  if (!original.includes('const now = new Date();'))
    throw new Error('Manager fixture clock changed; review adapter');
  const code = ts.transpileModule(
    original.replace('const now = new Date();', `const now = new Date('${NOW}');`),
    { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const data = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, structuredClone(value)]),
  );
}
const openapi = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'packages/api-contracts/openapi/openapi.json'), 'utf8'),
);
export const operations = Object.entries(openapi.paths).flatMap(([p, item]) =>
  Object.entries(item)
    .filter(([, op]) => op?.operationId)
    .map(([method, op]) => ({
      path: p,
      method: method.toUpperCase(),
      ...op,
      matcher: new RegExp(`^${p.replace(/\{[^}]+\}/g, '[^/]+')}$`),
    })),
);
export function operationFor(method, pathname) {
  return [...operations]
    .sort((a, b) => (a.path.match(/\{/g)?.length ?? 0) - (b.path.match(/\{/g)?.length ?? 0))
    .find((op) => op.method === method && op.matcher.test(pathname));
}
function deref(schema) {
  return schema?.$ref
    ? schema.$ref
        .split('/')
        .slice(1)
        .reduce((v, k) => v[k], openapi)
    : schema;
}
export function validate(value, raw, at = '$') {
  const s = deref(raw);
  if (!s) return [];
  if (value === null && (s.nullable || s.type === 'null')) return [];
  if (s.allOf) return s.allOf.flatMap((a) => validate(value, a, at));
  if (s.oneOf || s.anyOf) {
    const alternatives = (s.oneOf ?? s.anyOf).map((a) => validate(value, a, at));
    return alternatives.some((a) => a.length === 0) ? [] : [`${at}: no schema alternative`];
  }
  if (s.enum && !s.enum.includes(value)) return [`${at}: enum`];
  if (s.type === 'array')
    return Array.isArray(value)
      ? value.flatMap((v, i) => validate(v, s.items, `${at}[${i}]`))
      : [`${at}: array`];
  if (s.type === 'object' || s.properties) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [`${at}: object`];
    return [
      ...(s.required ?? [])
        .filter((k) => value[k] === undefined)
        .map((k) => `${at}.${k}: required`),
      ...Object.entries(value).flatMap(([k, v]) =>
        s.properties?.[k] ? validate(v, s.properties[k], `${at}.${k}`) : [],
      ),
    ];
  }
  if (s.type === 'string' && typeof value !== 'string') return [`${at}: string`];
  if (s.type === 'boolean' && typeof value !== 'boolean') return [`${at}: boolean`];
  if (['number', 'integer'].includes(s.type) && typeof value !== 'number')
    return [`${at}: numeric quantity`];
  if (s.pattern && typeof value === 'string' && !new RegExp(s.pattern).test(value))
    return [`${at}: pattern`];
  return [];
}
export function responseErrors(op, status, data) {
  const response = op?.responses?.[String(status)];
  if (!response) return [`${op?.operationId ?? 'unknown'}: status ${status} not documented`];
  return validate(data, response.content?.['application/json']?.schema);
}
export function transformStudent(data, op, scenario) {
  const keep = new Set([
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
  ]);
  function visit(value, keyPath = '') {
    if (Array.isArray(value)) return value.map((v, i) => visit(v, `${keyPath}.${i}`));
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, visit(v, `${keyPath}.${k}`)]),
      );
    if (typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value) && !keep.has(value))
      return uuid(`${op.operationId}:${keyPath}`);
    if (
      typeof value === 'string' &&
      /\.(displayName|teacherName|subjectName|fullName|fileName)$/.test(keyPath)
    )
      return scenario.long ? LONG : `TEST ${value}`;
    return value;
  }
  const result = visit(data);
  if (scenario.empty) {
    if (Array.isArray(result)) return [];
    if (Array.isArray(result?.items)) return { ...result, items: [], total: 0, unreadCount: 0 };
    if (op.operationId === 'getStudentDashboard')
      return {
        ...result,
        nextLesson: null,
        homework: { notSubmitted: 0, submitted: 0, needsRevision: 0, total: 0 },
        skillProgress: { familiarizing: 0, practicing: 0, applying: 0, notStudied: 0 },
      };
  }
  if (scenario.noMeet && result?.nextLesson)
    result.nextLesson = { ...result.nextLesson, meetLink: null, canJoin: false };
  if (scenario.frozen && op.operationId === 'getStudentSubscription')
    return {
      ...result,
      isFrozen: true,
      status: 'FROZEN',
      frozenFrom: '2026-11-02',
      frozenUntil: '2026-11-10',
    };
  if (scenario.long && Array.isArray(result?.items) && result.items.length) {
    const items = Array.from({ length: 18 }, (_, i) => ({
      ...result.items[i % result.items.length],
      ...(result.items[0].lessonId ? { lessonId: uuid(`long-lesson-${i}`) } : {}),
      ...(result.items[0].homeworkId ? { homeworkId: uuid(`long-homework-${i}`) } : {}),
      ...(result.items[0].fileId ? { fileId: uuid(`long-file-${i}`) } : {}),
    }));
    return { ...result, items, total: 18 };
  }
  return result;
}
export function managerResponse(op, m, scenario) {
  const x = structuredClone(m),
    empty = scenario.empty;
  x.lesson.startsAt = '2026-11-03T14:00:00Z';
  x.lesson.endsAt = '2026-11-03T15:00:00Z';
  x.student.fullName = scenario.long ? LONG : `TEST ${x.student.fullName}`;
  x.lead.contactName = scenario.long ? LONG : `TEST ${x.lead.contactName}`;
  x.lead.stage = scenario.leadStage ?? x.lead.stage;
  x.task.studentName = x.student.fullName;
  if (scenario.taskWorking) x.task.status = 'IN_PROGRESS';
  if (scenario.rescheduleTask)
    x.task.payload = {
      kind: 'RESCHEDULE_REQUEST',
      lessonId: x.ids.lesson,
      currentStartsAt: x.lesson.startsAt,
      studentComment: LONG,
      preferredWindows: [],
      preferredDate: null,
    };
  if (scenario.frozen) {
    x.subscription.status = 'FROZEN';
    x.subscription.frozenUntil = '2026-11-10T10:30:30Z';
  }
  const oldReceipt = {
    ...x.receipt,
    id: uuid('historical-confirmed-receipt'),
    status: 'CONFIRMED',
    ledgerPublicationId: uuid('historical-payment-ledger'),
  };
  const paidDistribution = { ...x.distribution, paymentId: oldReceipt.id };
  const page = (items) => ({ items, total: items.length, page: 1, pageSize: 20 });
  const cursor = (items) => ({ items, nextCursor: null });
  const rows = (value, key) =>
    empty
      ? []
      : scenario.long
        ? Array.from({ length: 18 }, (_, i) => ({
            ...value,
            [key]: i ? uuid(`${op.operationId}-${i}`) : value[key],
            ...(value.fullName ? { fullName: LONG } : {}),
          }))
        : [value];
  switch (op.operationId) {
    case 'getManagerMe':
      return { ...x.me, displayName: 'TEST manager' };
    case 'getManagerOptions':
      return x.options;
    case 'getManagerStudentCard':
      return x.student;
    case 'listManagerStudents':
      return cursor(rows({ ...x.listItem, fullName: x.student.fullName }, 'studentId'));
    case 'getManagerLead':
      return x.lead;
    case 'listManagerLeads':
      return cursor(rows(x.lead, 'leadId'));
    case 'getManagerLeadSummary':
      return {
        countsByStage: { NEW: empty ? 0 : 1, IN_PROGRESS: 0, TRIAL: 0, AWAITING_PAYMENT: 0 },
        createdToday: empty ? 0 : 1,
        trialsToday: 0,
        overdueFollowups: 0,
        conversion30dBp: 0,
      };
    case 'listManagerSchedule':
      return rows(x.lesson, 'lessonId');
    case 'listManagerSubscriptions':
      return rows(x.subscription, 'id');
    case 'listManagerDistributions':
      return page(empty ? [] : [paidDistribution]);
    case 'listManagerPayments':
      return page(empty ? [] : [x.receipt, oldReceipt]);
    case 'listManagerTasks':
      return cursor(rows(x.task, 'taskId'));
    case 'getManagerTask':
      return x.task;
    case 'listManagerStudentNotifications':
      return cursor(rows(x.notification, 'notificationId'));
    case 'getManagerDashboard':
      return {
        generatedAt: NOW,
        leads: {
          countsByStage: { NEW: empty ? 0 : 1, IN_PROGRESS: 0, TRIAL: 0, AWAITING_PAYMENT: 0 },
          createdToday: empty ? 0 : 1,
          trialsToday: 0,
          overdueFollowups: 0,
          conversion30dBp: 0,
        },
        students: { active: empty ? 0 : 1, frozen: 0, leads: 0 },
        upcomingLessons: empty
          ? []
          : [
              {
                lessonId: x.ids.lesson,
                studentId: x.ids.student,
                studentName: x.student.fullName,
                startsAt: x.lesson.startsAt,
                teacherName: x.lesson.teacherName,
                hasMeetLink: true,
              },
            ],
        overdueTasks: {
          count: empty ? 0 : 1,
          top: empty
            ? []
            : [
                {
                  taskId: x.ids.task,
                  type: x.task.type,
                  studentName: x.student.fullName,
                  dueAt: x.task.dueAt,
                },
              ],
        },
        expiringSubscriptions: empty
          ? []
          : [
              {
                subscriptionId: x.ids.subscription,
                studentId: x.ids.student,
                studentName: x.student.fullName,
                endsAt: x.subscription.endsAt,
                remainingLessons: x.subscription.remainingLessons,
              },
            ],
        pendingPayments: {
          count: empty ? 0 : 1,
          totalsByCurrency: empty ? [] : [{ currency: 'MDL', amount: '1600.0000' }],
        },
      };
    default:
      throw new Error(`No local manager response: ${op.operationId}`);
  }
}

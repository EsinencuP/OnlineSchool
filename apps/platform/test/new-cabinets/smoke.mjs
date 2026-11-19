import {
  teacherReportsFixture,
  verifyTeacherReportCommands,
  verifyTeacherReportDirectory,
} from './teacher-reports.mjs';
import {
  teacherStudentsFixture,
  verifyTeacherStudentOverview,
  verifyTeacherStudentWorkflows,
} from './teacher-students.mjs';
import { teacherHomeworkFixture, verifyTeacherHomework } from './teacher-homework.mjs';
import { paymentChecks } from './payments.mjs';
import { accountFixture, verifyLockedStudentPassword, verifyStudentAccount } from './account.mjs';
import { notificationFixture, verifyNotifications } from './notifications.mjs';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../../dist/', import.meta.url));
const output = process.env.CABINET_SMOKE_OUTPUT
  ? resolve(process.env.CABINET_SMOKE_OUTPUT)
  : fileURLToPath(new URL('../../../../output/new-cabinets/', import.meta.url));
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};
const server = createServer(async (req, res) => {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname;
  const absolute = path.startsWith('/assets/')
    ? resolve(dist, '.' + path)
    : resolve(dist, 'index.html');
  if (!absolute.startsWith(dist.endsWith(sep) ? dist : dist + sep)) {
    res.writeHead(404).end();
    return;
  }
  try {
    const bytes = await readFile(absolute);
    res
      .writeHead(200, {
        'content-type': contentTypes[extname(absolute)] ?? 'application/octet-stream',
      })
      .end(bytes);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((done, reject) => server.listen(0, '127.0.0.1', done).once('error', reject));
const base = 'http://127.0.0.1:' + server.address().port;
const screenshots = process.env.CABINET_SMOKE_SCREENSHOTS === '1';
if (screenshots) await mkdir(output, { recursive: true });
let browser;
const accountId = '00000000-0000-4000-8000-000000000007';
const lessonId = '00000000-0000-4000-8000-000000000008';
const priorLessonId = '00000000-0000-4000-8000-000000000108';
const reviewedHomeworkId = '00000000-0000-4000-8000-000000000109';
const fileId = '00000000-0000-4000-8000-000000000110';
const materialId = '00000000-0000-4000-8000-000000000111';
const foreignLessonId = '00000000-0000-4000-8000-000000000112';
const uploadUrl = 'https://lesson-files.example.test/staging/fixture';
const signedUrl = 'https://lesson-files.example.test/read/fixture';
const homeworkId = '00000000-0000-4000-8000-000000000009';
const taskId = '00000000-0000-4000-8000-000000000121';
const decisionId = '00000000-0000-4000-8000-000000000133';
const subjectId = '00000000-0000-4000-8000-000000000010';
const alternateSubjectId = '00000000-0000-4000-8000-000000000011';
const planId = '00000000-0000-4000-8000-000000000310';
const expiredPlanId = '00000000-0000-4000-8000-000000000312';
const futurePlanId = '00000000-0000-4000-8000-000000000313';
const reportId = '00000000-0000-4000-8000-000000000410';
const retryReportId = '00000000-0000-4000-8000-000000000411';
const pdfJobId = '00000000-0000-4000-8000-000000000412';
const expiredPdfId = '00000000-0000-4000-8000-000000000413';
const recoveryPdfId = '00000000-0000-4000-8000-000000000414';
const pdfUrl = 'https://education-files.example.test/student-history.pdf?signature=synthetic';
const date = new Date().toISOString();
const educationReport = {
  reportId,
  subjectName: 'Математика',
  createdAt: date,
  periodFrom: '2026-10-01',
  periodTo: '2026-11-17',
  lessonCount: 8,
  teacherName: 'Андрей Петров',
  content: {
    achievements: 'Решает квадратные уравнения.',
    growthAreas: 'Проверять корни.',
    recommendations: 'Записывать промежуточные шаги.',
    teacherSignature: 'А. Петров',
  },
};
const skillId = '00000000-0000-4000-8000-000000000311';
const teacherDay = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Chisinau' }).format(
  new Date(date),
);
const teacherStart = new Date(Date.parse(date) + 891).toISOString();
const teacherEnd = new Date(Date.parse(date) + 45 * 60_000).toISOString();
const teacherDeadline = new Date(Date.parse(teacherEnd) + 86400_000).toISOString();
const sentReports = [];
const requestedDays = new Set();
const lesson = {
  lessonId,
  scheduledAt: new Date(Date.parse(date) + 2 * 86400_000).toISOString(),
  durationMinutes: 45,
  teacherName: 'Андрей Петров',
  subjectName: 'Математика',
  subjectId,
  status: 'SCHEDULED',
  canJoin: false,
  meetLink: null,
  meetAsOf: date,
  canRequestReschedule: true,
};
const homework = {
  homeworkId,
  title: 'Квадратные уравнения',
  description: 'Решите уравнения и проверьте ответы.',
  subjectName: 'Математика',
  teacherName: 'Андрей Петров',
  status: 'NOT_SUBMITTED',
  draftContent: '',
  latestVersion: null,
  versions: [],
  attachments: [],
};
const attachment = { fileId, fileName: 'решение.txt', mimeType: 'text/plain', fileSizeBytes: 10 };
const graded = {
  versionNumber: 1,
  content: 'Ответ после проверки.',
  submittedAt: date,
  teacherComment: 'Проверьте дискриминант во втором примере.',
  teacherStatus: 'REVIEWED',
  attachments: [attachment],
};
const material = {
  fileId: materialId,
  fileName: 'Памятка по уравнениям.pdf',
  subjectId,
  subjectName: 'Математика',
  sharedAt: date,
  lessonTitle: 'Квадратные уравнения',
  sharedByTeacherName: 'Андрей Петров',
  canDownload: false,
};
const previous = {
  ...lesson,
  lessonId: priorLessonId,
  status: 'COMPLETED',
  scheduledAt: new Date(Date.parse(date) - 2 * 86400_000).toISOString(),
  canRequestReschedule: false,
};
const studentDashboard = {
  nextLesson: lesson,
  homework: { notSubmitted: 2, submitted: 1, needsRevision: 1, total: 4 },
  subscription: {
    lessonsRemaining: 8,
    validUntil: '2026-12-17',
    isFrozen: false,
    frozenUntil: null,
  },
  skillProgress: { familiarizing: 2, practicing: 1, applying: 1, notStudied: 0 },
  generatedAt: date,
};
const skill = {
  skillId,
  name: 'Дискриминант',
  category: 'Алгебра',
  status: 'PRACTICING',
  lastUpdatedAt: date,
  lastUpdatedByTeacherName: 'Андрей Петров',
};
const map = {
  subjectId,
  subjectName: 'Математика',
  totalSkills: 1,
  skills: [skill],
  learningGoals: [
    { goalId: taskId, text: 'Решать уравнения', targetDate: '2026-12-17', isAchieved: false },
  ],
  lastSnapshotAt: date,
  nextSnapshotIn: 3,
};
const fixture = {
  '/api/v1/student/dashboard': studentDashboard,
  '/api/v1/student/lessons/upcoming': { items: [lesson], total: 1, page: 1, pageSize: 5 },
  '/api/v1/student/lessons': { items: [lesson], total: 1, page: 1, pageSize: 20 },
  ['/api/v1/student/lessons/' + lessonId]: lesson,
  ['/api/v1/student/lessons/' + priorLessonId]: previous,
  ['/api/v1/student/homework/' + reviewedHomeworkId]: {
    ...homework,
    homeworkId: reviewedHomeworkId,
    status: 'REVIEWED',
    latestVersion: graded,
    versions: [graded],
  },
  '/api/v1/student/homework': { items: [homework], total: 1, page: 1, pageSize: 20 },
  ['/api/v1/student/homework/' + homeworkId]: homework,
  '/api/v1/student/subjects': {
    generatedAt: date,
    items: ['Математика', 'Английский', 'Программирование', 'Istorie', 'Fizică'].map(
      (subjectName, i) => ({
        subjectId: subjectId.slice(0, -1) + i,
        subjectName,
        enrollmentIds: [taskId],
        displayStatus: i === 0 ? 'ACTIVE' : 'FROZEN',
        reasonCode: i === 0 ? 'PAID_RIGHTS' : 'FROZEN',
        liveAccess: i === 0,
        capabilities: {
          canViewHomework: i === 0,
          canViewMaterials: i === 0,
          canOpenSubscription: i === 0 || i === 2,
          canOpenLessons: i === 0,
        },
        subscriptions:
          i === 0
            ? [
                {
                  subscriptionId: planId,
                  managerSubscriptionId: taskId,
                  displayStatus: 'FROZEN',
                  reasonCode: 'FROZEN',
                  enrollmentId: taskId,
                  validUntil: '2026-12-01T10:00:00.000Z',
                  frozenUntil: '2026-11-29T10:00:00.000Z',
                  paidLessonsRemaining: 0,
                  liveAccess: false,
                  temporaryAdmission: {
                    maxLessons: 2,
                    lessonsRemaining: 1,
                    validUntil: '2026-11-23T10:00:00.000Z',
                  },
                },
              ]
            : i === 2
              ? [
                  {
                    subscriptionId: expiredPlanId,
                    managerSubscriptionId: null,
                    displayStatus: 'EXPIRED',
                    reasonCode: 'PERIOD_EXPIRED',
                    enrollmentId: taskId,
                    validUntil: null,
                    frozenUntil: null,
                    paidLessonsRemaining: 0,
                    liveAccess: false,
                    temporaryAdmission: null,
                  },
                ]
              : [],
      }),
    ),
  },
  '/api/v1/teacher/today': {
    lessons: [
      {
        ...lesson,
        startsAt: date,
        endsAt: teacherEnd,
        studentName: 'Анна Мирова',
      },
    ],
  },
  '/api/v1/manager/dashboard': {
    leads: {},
    students: { active: 6 },
    pendingPayments: { count: 2 },
    overdueTasks: { count: 3 },
    upcomingLessons: [{ ...lesson, startsAt: date, studentName: 'Анна Мирова' }],
  },
  '/api/v1/manager/tasks': {
    items: [{ taskId, title: 'Связаться с семьёй', status: 'OPEN' }],
    total: 1,
  },
  ['/api/v1/manager/tasks/' + taskId]: {
    taskId,
    status: 'OPEN',
    type: 'GENERAL',
    version: 7,
    studentName: 'Анна Мирова',
  },
  '/api/v1/director/decisions/summary': { total: 4, payment: 2, refundRequest: 1 },
  '/api/v1/director/decisions': {
    items: [
      { id: decisionId, title: 'Подтверждение поступления', kind: 'PAYMENT', status: 'OPEN' },
    ],
  },
  ['/api/v1/director/decisions/PAYMENT/' + decisionId]: {
    id: decisionId,
    kind: 'PAYMENT',
    currency: 'MDL',
    amount: 915,
    ready: true,
    commands: [
      {
        operationId: 'directorConfirmPayment',
        method: 'POST',
        path: '/api/v1/director/payments/{id}/confirm',
        effect: 'Подтвердить платёж',
      },
    ],
  },
  '/api/v1/qa/components': { api: 'ok', db: 'ok', worker: 'ok' },
  '/api/v1/qa/queues': { ready: 0, dead: 0, checkedAt: date },
};
const cases = [
  ['STUDENT', 'student', 'Анна Мирова', 'Математика'],
  ['TEACHER', 'teacher', 'Андрей Петров', 'Задания к проверке'],
  ['MANAGER', 'manager', 'Тамара Светлова', 'Связаться с семьёй'],
  ['DIRECTOR', 'director', 'Павел Орлов', 'Подтверждение поступления'],
  ['TECH_OPERATOR', 'operator', 'Ирина Волкова', 'Очереди worker'],
];
const errors = [];
const finance = paymentChecks(decisionId, date);
let draft;
let claim;
async function open(role, slug, displayName, page, startSignedIn = true) {
  let signedIn = startSignedIn;
  let startAllowed = false;
  let started = false;
  let suspended = false;
  let responseVersion = null;
  let uploaded = false;
  let verified = false;
  const requests = [];
  const lessonCommands = [];
  const signedReads = [];
  const reports = [];
  const reportReads = [];
  const pdfWrites = [];
  const teacherHomework = teacherHomeworkFixture({ date, lessonId, subjectId, alternateSubjectId });
  const teacherStudents = teacherStudentsFixture({
    date,
    future: new Date(Date.parse(date) + 24 * 60 * 60 * 1000).toISOString(),
    lessonId,
    priorLessonId,
    homework: teacherHomework,
    alternateSubjectId,
  });
  const teacherReports = teacherReportsFixture({
    date,
    lessonId,
    priorLessonId,
    enrollmentId: teacherHomework.enrollmentId,
    studentId: teacherHomework.studentId,
  });
  const notices = notificationFixture({ date, reportId, homeworkId, planId });
  const studentAccount = accountFixture({ date, displayName, accountId });
  const markedReports = new Set();
  let pdfPolls = 0;
  await page.route(pdfUrl, (route) => {
    assert.equal(route.request().method(), 'GET');
    return route.fulfill({
      contentType: 'application/pdf',
      headers: { 'content-disposition': 'attachment; filename="student-history.pdf"' },
      body: '%PDF-1.4\n%%EOF',
    });
  });
  await page.route(uploadUrl, (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS')
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'PUT',
          'access-control-allow-headers': 'content-type',
        },
      });
    assert.equal(req.method(), 'PUT');
    assert.equal(req.headers().cookie, undefined);
    assert.equal(req.headers()['content-type'], 'text/plain');
    assert.equal(req.postData(), 'solution 1');
    uploaded = true;
    return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' } });
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    requests.push(path + url.search);
    const session = {
      account: {
        id: accountId,
        kind: role === 'STUDENT' || role === 'TEACHER' ? role : 'STAFF',
        roles: [role],
      },
      mfa_completed: true,
      recovery_only: false,
      expires_at: date,
    };
    const json = (value, status = 200) => route.fulfill({ status, json: value });
    if (path.endsWith('/auth/csrf')) return json({ csrfToken: 'synthetic-csrf-fixture' });
    if (path.endsWith('/auth/session')) {
      if (req.method() === 'POST') {
        assert.equal(req.headers()['x-csrf-token'], 'synthetic-csrf-fixture');
        assert.equal(req.postDataJSON().email, 'student@example.test');
        signedIn = true;
        return json(session);
      }
      return signedIn ? json(session) : json({ code: 'UNAUTHENTICATED' }, 401);
    }
    if (path.endsWith('/platform/accounts'))
      return json({ currentKey: null, enabled: false, items: [] });
    if (path.endsWith('/platform/actor-context') || path === '/api/v1/' + slug + '/me')
      return json({
        ...(role === 'STUDENT'
          ? studentAccount.view(suspended)
          : {
              displayName,
              timeZone: 'Europe/Chisinau',
              mustChangePassword: false,
              hasActiveAccess: true,
            }),
        ...(suspended
          ? {
              managerContacts: {
                displayName: 'Тамара Светлова',
                whatsapp: 'https://wa.me/37300000000',
                telegram: 'https://t.me/synthetic_fixture',
                phoneE164: '+37300000000',
              },
            }
          : {}),
      });
    if (role === 'TEACHER') {
      const reportReply = teacherReports.handle(url, req, json);
      if (reportReply) return reportReply;
      const studentReply = teacherStudents.handle(url, req, json);
      if (studentReply) return studentReply;
      const homeworkReply = teacherHomework.handle(url, req, json);
      if (homeworkReply) return homeworkReply;
    }
    if (role === 'TEACHER' && path === '/api/v1/teacher/today') {
      const asked = url.searchParams.get('date');
      if (asked) requestedDays.add(asked);
      return json({
        date: asked ?? teacherDay,
        timezone: 'Europe/Chisinau',
        asOf: date,
        lessons: !asked || asked === teacherDay ? fixture[path].lessons : [],
      });
    }
    if (role === 'TEACHER' && path === '/api/v1/teacher/lessons/' + lessonId) {
      return json({
        lessonId,
        kind: 'REGULAR',
        startsAt: date,
        endsAt: teacherEnd,
        state: reports.length ? 'AWAITING_CONFIRMATION' : 'AWAITING_REPORT',
        studentId: teacherHomework.studentId,
        studentName: 'Анна Мирова',
        subjectName: 'Математика',
        reportDeadlineAt: teacherDeadline,
        actualStartedAt: started ? teacherStart : null,
        canReport: started,
        overdue: false,
        reports,
        confirmedOutcome: null,
      });
    }
    if (role === 'TEACHER' && path.endsWith('/start-eligibility')) {
      return json({
        action: 'lesson.start',
        objectId: lessonId,
        allowed: startAllowed,
        reason: startAllowed ? null : 'PAID_ACCESS_OR_DIRECTOR_PERMISSION_REQUIRED',
        asOf: date,
      });
    }
    if (role === 'TEACHER' && path === '/api/v1/lessons/' + lessonId + '/start') {
      assert.equal(req.method(), 'POST');
      assert.equal(req.headers()['x-csrf-token'], 'synthetic-csrf-fixture');
      assert.match(req.headers()['idempotency-key'], /^[a-f0-9-]{36}$/);
      assert.deepEqual(req.postDataJSON(), {});
      started = true;
      return json({ id: lessonId, actual_start_at: teacherStart });
    }
    if (role === 'TEACHER' && path === '/api/v1/lessons/' + lessonId + '/outcome') {
      const body = req.postDataJSON();
      const key = req.headers()['idempotency-key'];
      assert.equal(req.headers()['x-csrf-token'], 'synthetic-csrf-fixture');
      assert.match(key, /^[a-f0-9-]{36}$/);
      sentReports.push({ body, key });
      if (sentReports.length === 1) return json({ code: 'SERVICE_UNAVAILABLE' }, 503);
      if (sentReports.length === 2) return json({ code: 'COMMAND_IN_PROGRESS' }, 409);
      reports.push({
        reportId: taskId,
        version: 1,
        result: body.result,
        note: body.note,
        actualStartedAt: body.actualStartedAt,
        durationMin: body.durationMin,
        studentNoShow: false,
        reportedAt: date,
        current: true,
      });
      return json({ id: taskId, result: body.result, version: 1, late: false });
    }
    if (role === 'STUDENT') {
      if (studentAccount.match(path)) return studentAccount.handle(route, path, suspended);
      if (notices.match(path)) return notices.handle(route, url);
      const reportsPath = '/api/v1/student/reports';
      if (path === reportsPath || path.startsWith(reportsPath + '/')) {
        const report = (id) => ({
          ...educationReport,
          reportId: id,
          subjectName: id === retryReportId ? 'Английский' : educationReport.subjectName,
          isNew: !markedReports.has(id),
        });
        if (path === reportsPath)
          return json({
            items: [report(reportId), report(retryReportId)],
            total: 2,
            page: 1,
            pageSize: 10,
          });
        if (path === reportsPath + '/export-pdf') {
          assert.equal(req.method(), 'POST');
          assert.equal(req.headers()['x-csrf-token'], 'synthetic-csrf-fixture');
          const key = req.headers()['idempotency-key'];
          assert.match(key, /^[a-f0-9-]{36}$/);
          pdfWrites.push({ key, body: req.postDataJSON() });
          return pdfWrites.length === 1
            ? json({ code: 'SERVICE_UNAVAILABLE' }, 503)
            : json({ jobId: pdfJobId, status: 'QUEUED', estimatedReadyAt: date }, 202);
        }
        if (path.startsWith(reportsPath + '/export-pdf/requests/')) {
          const id = path.split('/').at(-1);
          return json(
            id === recoveryPdfId
              ? { status: 'ACCEPTED', jobId: pdfJobId }
              : { status: 'UNKNOWN', jobId: null },
          );
        }
        if (path.startsWith(reportsPath + '/export-pdf/')) {
          const jobId = path.split('/').at(-1);
          if (jobId === expiredPdfId)
            return json({
              jobId,
              status: 'FAILED',
              downloadUrl: null,
              expiresAt: null,
              failureReason: 'PDF_EXPORT_EXPIRED',
            });
          if (jobId !== pdfJobId) return json({ code: 'REPORT_FORBIDDEN' }, 403);
          pdfPolls++;
          const ready = pdfPolls > 1;
          return json({
            jobId,
            status: ready ? 'READY' : 'PROCESSING',
            downloadUrl: ready ? pdfUrl : null,
            expiresAt: ready ? new Date(Date.now() + 60_000).toISOString() : null,
            failureReason: null,
          });
        }
        const id = path.split('/')[5];
        if (![reportId, retryReportId].includes(id)) return json({ code: 'REPORT_FORBIDDEN' }, 403);
        if (path.endsWith('/read')) {
          assert.equal(req.method(), 'POST');
          assert.equal(req.headers()['x-csrf-token'], 'synthetic-csrf-fixture');
          const key = req.headers()['idempotency-key'];
          assert.match(key, /^[a-f0-9-]{36}$/);
          reportReads.push({ id, key });
          if (id === retryReportId && reportReads.filter((item) => item.id === id).length === 1)
            return json({ code: 'SERVICE_UNAVAILABLE' }, 503);
          markedReports.add(id);
          return route.fulfill({ status: id === retryReportId ? 200 : 204 });
        }
        return json(report(id));
      }
      if (path === '/api/v1/student/lessons/' + foreignLessonId)
        return json({ code: 'LESSON_FORBIDDEN' }, 403);
      if (path === '/api/v1/student/lessons/history') {
        const requested = url.searchParams.get('lessonId');
        const items =
          requested === priorLessonId
            ? [
                {
                  ...previous,
                  attendanceStatus: 'COMPLETED',
                  lessonDeducted: true,
                  balanceBefore: null,
                  balanceAfter: '7.5',
                  canDispute: true,
                },
              ]
            : [];
        return json({ items, total: items.length, page: 1, pageSize: 1 });
      }
      if (path === '/api/v1/student/materials' && url.searchParams.get('lessonId')) {
        const items = url.searchParams.get('lessonId') === lessonId ? [material] : [];
        return json({ items, page: 1, pageSize: 10, total: items.length });
      }
      if (path === '/api/v1/student/materials') {
        const selected = url.searchParams.get('subjectId');
        const items = !selected || selected === subjectId ? [material] : [];
        return json({ items, page: 1, pageSize: 20, total: items.length });
      }
      if (path === '/api/v1/student/skills') {
        const selected = url.searchParams.get('subjectId');
        return !selected || selected === subjectId
          ? json([map])
          : json({ code: 'SKILLS_FORBIDDEN' }, 403);
      }
      if (path === '/api/v1/student/skills/snapshots') {
        const page = Number(url.searchParams.get('page'));
        return json({
          items: [
            {
              snapshotId: taskId,
              subjectName: 'Математика',
              createdAt: date,
              lessonNumber: page === 1 ? 8 : 4,
              teacherSummary:
                page === 1 ? 'Решает простые уравнения.' : 'Начал разбирать уравнения.',
              skills: [
                {
                  skillName: skill.name,
                  status: 'FAMILIARIZING',
                  teacherComment: 'Следующий шаг — практика.',
                },
              ],
            },
          ],
          total: 2,
          page,
          pageSize: 1,
        });
      }
      if (path === '/api/v1/student/skills/audit') {
        assert.equal(url.searchParams.get('skillId'), skillId);
        return json({
          items: [
            {
              auditId: taskId,
              skillId,
              skillName: skill.name,
              changedAt: date,
              teacherName: 'Андрей Петров',
              fromStatus: 'FAMILIARIZING',
              toStatus: 'PRACTICING',
              comment: 'Решил задачу самостоятельно.',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        });
      }
      if (path.startsWith('/api/v1/student/subscription')) {
        assert.equal(req.method(), 'GET');
        const selected = url.searchParams.get('subscriptionId');
        if (selected && ![planId, expiredPlanId, futurePlanId].includes(selected))
          return json({ code: 'SUBSCRIPTION_FORBIDDEN' }, 403);
        const future = selected === futurePlanId;
        const expired = selected === expiredPlanId;
        const page = Number(url.searchParams.get('page') ?? '1');
        if (path.endsWith('/payments')) {
          return json({
            items: expired
              ? []
              : [
                  {
                    paymentId: taskId,
                    confirmedAt: date,
                    amount: future ? '12.005' : page === 1 ? '600.1234' : '1.005',
                    currency: future || page === 2 ? 'USD' : 'MDL',
                    description: 'Подтверждённая оплата: Standard',
                    lessonsAdded: future ? null : 0,
                  },
                ],
            total: expired ? 0 : future ? 1 : 2,
            page,
            pageSize: 1,
          });
        }
        if (path.endsWith('/ledger')) {
          return json({
            items:
              future || expired
                ? []
                : [
                    {
                      entryId: taskId,
                      entryDate: '2026-11-18',
                      type: 'DEDUCTION',
                      description: 'Списание занятия',
                      balanceBefore: null,
                      balanceAfter: '0',
                      lessonId: priorLessonId,
                    },
                    {
                      entryId: lessonId,
                      entryDate: '2026-11-16',
                      type: 'UNFREEZE',
                      description: 'Разморозка абонемента',
                      balanceBefore: '1',
                      balanceAfter: '1',
                      lessonId: null,
                    },
                  ],
            total: future || expired ? 0 : 2,
            page,
            pageSize: 20,
          });
        }
        return json({
          subscriptionId: future ? null : expired ? expiredPlanId : taskId,
          planName: future ? null : 'Standard',
          status: future ? 'NONE' : expired ? 'EXPIRED' : 'FROZEN',
          lessonsTotal: future ? null : 8,
          lessonsRemaining: future ? null : 0,
          validFrom: future ? null : '2026-11-01',
          validUntil: future ? null : '2026-12-01',
          isFrozen: !future && !expired,
          frozenFrom: future || expired ? null : '2026-11-19',
          frozenUntil: future || expired ? null : '2026-11-29',
        });
      }
      if (path === '/api/v1/student/materials/' + materialId + '/url') {
        signedReads.push(path);
        return json({
          url: signedUrl,
          expiresAt: new Date(Date.now() + 120000).toISOString(),
          fileName: material.fileName,
        });
      }
      if (path.endsWith('/reschedule-request') || path.endsWith('/dispute')) {
        assert.equal(req.headers()['x-csrf-token'], 'synthetic-csrf-fixture');
        const key = req.headers()['idempotency-key'];
        assert.match(key, /^[a-f0-9-]{36}$/);
        lessonCommands.push({ key, path, body: req.postDataJSON() });
        return path.endsWith('/dispute')
          ? json({ crmTaskId: decisionId, status: 'CREATED' }, 201)
          : json({ code: 'SERVICE_UNAVAILABLE' }, 503);
      }
      if (path.includes('/requests/')) {
        const pending = lessonCommands[0];
        assert.equal(path, '/api/v1/student/lessons/' + lessonId + '/requests/' + pending.key);
        assert.equal(url.searchParams.get('type'), 'RESCHEDULE_REQUEST');
        return json({ crmTaskId: taskId, status: 'CREATED', type: 'RESCHEDULE_REQUEST' });
      }
      if (path.endsWith('/upload-url')) {
        assert.equal(req.headers()['x-csrf-token'], 'synthetic-csrf-fixture');
        assert.match(req.headers()['idempotency-key'], /^[a-f0-9-]{36}$/);
        assert.deepEqual(req.postDataJSON(), {
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          fileSizeBytes: 10,
        });
        return json({ fileId, uploadUrl }, 201);
      }
      if (path.endsWith('/files/' + fileId + '/confirm')) {
        assert.ok(uploaded);
        verified = true;
        return json({ fileId, status: 'VERIFIED' });
      }
      if (path.endsWith('/homework/' + homeworkId + '/submit')) {
        assert.ok(verified);
        assert.equal(responseVersion, null);
        assert.match(req.headers()['idempotency-key'], /^[a-f0-9-]{36}$/);
        assert.deepEqual(req.postDataJSON(), { content: 'Проверочный ответ', fileIds: [fileId] });
        responseVersion = {
          versionNumber: 1,
          content: 'Проверочный ответ',
          submittedAt: date,
          teacherComment: null,
          teacherStatus: null,
          attachments: [attachment],
        };
        return json({ code: 'SERVICE_UNAVAILABLE' }, 503);
      }
      if (path.endsWith('/homework/' + homeworkId) && responseVersion)
        return json({
          ...homework,
          status: 'SUBMITTED',
          latestVersion: responseVersion,
          versions: [responseVersion],
        });
    }
    if (path.endsWith('/draft')) {
      assert.equal(req.headers()['x-csrf-token'], 'synthetic-csrf-fixture');
      assert.match(req.headers()['idempotency-key'], /^[a-f0-9-]{36}$/);
      draft = req.postDataJSON();
      return json({ homeworkId, status: 'SAVED', expiresAt: teacherDeadline });
    }
    if (path === '/api/v1/manager/tasks/' + taskId + '/claim') {
      assert.equal(req.headers()['x-csrf-token'], 'synthetic-csrf-fixture');
      claim = req.postDataJSON();
      return json({ taskId, status: 'IN_PROGRESS', version: 8 });
    }
    return json(fixture[path] ?? { items: [] });
  });
  await finance.attach(page, role);
  return {
    requests,
    lessonCommands,
    signedReads,
    reportReads,
    pdfWrites,
    noticeCommands: notices.commands,
    studentAccount,
    teacherHomework,
    teacherStudents,
    teacherReports,
    suspend: () => {
      suspended = true;
    },
    allowStart: () => {
      startAllowed = true;
    },
  };
}
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const [role, slug, name, visible] of cases) {
    const page = await browser.newPage({ viewport: { width: 1410, height: 1020 } });
    const {
      allowStart,
      requests,
      reportReads,
      pdfWrites,
      noticeCommands,
      studentAccount,
      teacherHomework,
      teacherStudents,
      teacherReports,
    } = await open(role, slug, name, page);
    await page.goto(base + '/' + slug);
    await page
      .getByRole('heading', { level: 1 })
      .filter({ hasText: name.split(' ')[0] })
      .waitFor();
    await page.getByText(visible, { exact: true }).first().waitFor();
    await page.getByRole('link', { name: '2K Academy', exact: true }).waitFor();
    await page.waitForFunction(() => {
      const mark = globalThis.document.querySelector('.cab-brand-mark img');
      return mark?.complete && mark.naturalWidth > 0 && !mark.src.endsWith('.webp');
    });
    if (role === 'STUDENT') {
      await page.locator('[data-subject-symbol="math"]').waitFor();
      const tiles = page.locator('.cab-subject-tile');
      for (const subject of ['math', 'languages', 'it', 'history', 'science']) {
        await tiles.locator('[data-subject-art="' + subject + '"]').waitFor();
      }
      await page.waitForFunction(() => {
        const images = globalThis.document.querySelectorAll('.cab-subject-tile img');
        return (
          images.length === 5 &&
          Array.from(images).every(
            (image) => image.complete && image.naturalWidth > 0 && !image.src.endsWith('.webp'),
          )
        );
      });
    }
    if (screenshots)
      await page.screenshot({ path: resolve(output, slug + '-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Открыть навигацию' }).click();
    await page.getByRole('navigation').getByRole('link', { name: 'Обзор' }).waitFor();
    await page
      .getByRole('button', { name: 'Закрыть навигацию' })
      .click({ position: { x: 370, y: 110 } });
    await page.getByRole('navigation').waitFor({ state: 'hidden' });
    assert.equal(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
      ),
      true,
      slug + ' overflows on mobile',
    );
    if (screenshots && role === 'STUDENT')
      await page.screenshot({ path: resolve(output, 'student-mobile.png'), fullPage: true });
    if (role === 'STUDENT') {
      const subjectsUrl = base + '/student/subjects';
      const mathUrl = subjectsUrl + '?subjectId=' + subjectId;
      await page.locator('.cab-subject-tile').filter({ hasText: 'Математика' }).click();
      await page.waitForURL(mathUrl);
      await page.getByRole('heading', { name: 'Математика', exact: true }).waitFor();
      await page.getByText('Осталось оплаченных уроков').waitFor();
      assert.equal(await page.locator('.cab-subject-plans dd').first().textContent(), '0');

      await page.getByRole('link', { name: 'Все предметы', exact: true }).click();
      await page.waitForURL(subjectsUrl);
      await page.getByRole('link', { name: /Английский/ }).click();
      await page.waitForURL(subjectsUrl + '?subjectId=' + alternateSubjectId);
      await page.getByRole('heading', { name: 'Английский', exact: true }).waitFor();
      assert.equal(await page.getByRole('link', { name: 'Расписание предмета' }).count(), 0);
      assert.equal(await page.getByRole('link', { name: 'Материалы предмета' }).count(), 0);
      await page.goBack();
      await page.getByRole('link', { name: /Математика/ }).click();
      await page.getByRole('link', { name: 'Расписание предмета' }).click();
      await page.getByRole('heading', { name: 'Календарь занятий' }).waitFor();
      await Promise.all([
        page.waitForRequest(
          (request) =>
            request.url() === base + '/api/v1/student/lessons/history?subjectId=' + subjectId,
        ),
        page.getByRole('button', { name: 'История занятий' }).click(),
      ]);
      assert.ok(
        requests.some(
          (path) =>
            path.startsWith('/api/v1/student/lessons?') && path.includes('subjectId=' + subjectId),
        ),
      );
      await page.locator('.k8k-calendar-days').getByRole('link', { name: 'Математика' }).click();
      await page.waitForURL(base + '/student/lessons/' + lessonId + '?subjectId=' + subjectId);
      await page.getByRole('heading', { name: 'Математика' }).waitFor();
      await page.getByRole('link', { name: 'К расписанию' }).click();
      await page.waitForURL(base + '/student/lessons?subjectId=' + subjectId);
      await page.getByRole('link', { name: 'К предмету' }).click();
      await Promise.all([
        page.waitForRequest(
          (request) =>
            request.url().includes('/api/v1/student/materials?') &&
            new URL(request.url()).searchParams.get('subjectId') === subjectId,
        ),
        page.getByRole('link', { name: 'Материалы предмета' }).click(),
      ]);
      await page.getByRole('heading', { name: material.fileName }).waitFor();
      await page.getByRole('button', { name: 'Получить ссылку' }).click();
      const fileLink = page.getByRole('link', { name: 'Открыть файл' });
      await fileLink.waitFor();
      assert.equal(await fileLink.getAttribute('href'), signedUrl);

      await page.getByRole('link', { name: 'К предмету' }).click();
      await Promise.all([
        page.waitForRequest(
          (request) =>
            request.url() === base + '/api/v1/student/subscription?subscriptionId=' + planId,
        ),
        page.getByRole('link', { name: 'Абонемент', exact: true }).last().click(),
      ]);
      const subscriptionPath = '/student/subscription';
      const planUrl =
        base + subscriptionPath + '?subscriptionId=' + planId + '&fromSubjectId=' + subjectId;
      await page.getByText('Заморожен', { exact: true }).waitFor();
      await page.getByRole('heading', { name: 'Временный допуск' }).waitFor();
      assert.equal(await page.locator('.cab-subscription-balance strong').textContent(), '0');
      await page.getByText(/600[,.]1234\s+MDL/).waitFor();
      await page.getByRole('button', { name: 'Следующая страница' }).click();
      await page.getByText(/1[,.]005\s+USD/).waitFor();
      await page.getByRole('button', { name: 'Остаток уроков' }).click();
      await page.getByText('Разморозка абонемента', { exact: true }).waitFor();
      assert.equal(
        await page.locator('.cab-subscription-history dd').first().textContent(),
        'Не зафиксировано',
      );
      assert.equal(await page.locator('.cab-subscription-history dd').nth(1).textContent(), '0');
      assert.equal(
        await page.getByRole('link', { name: 'Открыть урок' }).getAttribute('href'),
        '/student/lessons/' + priorLessonId + '?subjectId=' + subjectId,
      );
      await page.locator('.cab-account-button').click();
      await page.locator('.k8k-language select').selectOption('ro');
      await page.getByText('Deducerea unei lecții', { exact: true }).waitFor();
      await page.locator('.cab-account-button').click();
      await page.locator('.k8k-language select').selectOption('ru');
      await page
        .getByRole('combobox', { name: 'Абонемент по предмету' })
        .selectOption(expiredPlanId);
      await page.getByText('Подтверждённых оплат пока нет.').waitFor();
      await page.getByText('Истёк', { exact: true }).waitFor();
      await page.goBack();
      await page.waitForURL(planUrl);
      await page.getByRole('link', { name: 'К предмету' }).click();
      await page.getByRole('link', { name: 'Карта навыков' }).click();
      await page.getByRole('heading', { name: skill.name }).waitFor();
      await page.getByText('История навыка', { exact: true }).click();
      await page.getByText('Решил задачу самостоятельно.').waitFor();
      await page.getByText('Цели обучения', { exact: true }).click();
      await page.getByText('Решать уравнения', { exact: true }).waitFor();
      await page.getByLabel('Этап', { exact: true }).selectOption('APPLYING');
      await page.getByText('На этом этапе пока нет навыков.').waitFor();
      await page.getByLabel('Этап', { exact: true }).selectOption('');
      await page.getByText(/После урока 8/).click();
      await page.getByText('Решает простые уравнения.').waitFor();
      await Promise.all([
        page.waitForRequest((request) => {
          const url = new URL(request.url());
          return (
            url.pathname === '/api/v1/student/skills/snapshots' &&
            url.searchParams.get('subjectId') === subjectId &&
            url.searchParams.get('page') === '2'
          );
        }),
        page.getByRole('button', { name: 'Следующая страница' }).click(),
      ]);
      await page.getByText(/После урока 4/).waitFor();
      assert.ok(
        await page.evaluate(
          () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
        ),
      );

      await page.goto(base + subscriptionPath + '?subscriptionId=' + futurePlanId);
      await page.getByText('Выбранный период ещё не начался.', { exact: false }).waitFor();
      await page.getByText(/12[,.]005\s+USD/).waitFor();
      assert.equal(await page.locator('.cab-subscription-balance').count(), 0);
      const defaultStart = requests.length;
      await page.goto(base + subscriptionPath);
      await page.getByText(/600[,.]1234\s+MDL/).waitFor();
      assert.ok(
        requests
          .slice(defaultStart)
          .includes('/api/v1/student/subscription/payments?subscriptionId=' + planId + '&page=1'),
      );
      await page.getByRole('link', { name: 'Связаться с менеджером' }).click();
      await page.getByRole('heading', { name: 'Контакты менеджера' }).waitFor();
      const beforeForeignPlan = requests.length;
      await page.goto(base + subscriptionPath + '?subscriptionId=' + foreignLessonId);
      await page.getByText('Абонемент недоступен.').waitFor();
      assert.equal(
        requests
          .slice(beforeForeignPlan)
          .some((path) => path.startsWith('/api/v1/student/subscription/payments')),
        false,
      );

      await verifyNotifications({ page, base, reportId, planId, commands: noticeCommands });
      const reportsPage = base + '/student/reports';
      await page.goto(reportsPage);
      await page.getByRole('link', { name: 'Открыть отчёт' }).first().click();
      await page.waitForURL(reportsPage + '/' + reportId);
      await page.getByText(educationReport.content.achievements).waitFor();
      await page.getByRole('button', { name: 'Отметить прочитанным' }).click();
      await page.getByText('Прочитан', { exact: true }).waitFor();
      await page.getByRole('link', { name: 'К отчётам' }).click();
      await page.getByRole('link', { name: 'Открыть отчёт' }).last().click();
      await page.waitForURL(reportsPage + '/' + retryReportId);
      await page.getByRole('button', { name: 'Отметить прочитанным' }).click();
      await page.getByText(/Не удалось подтвердить отметку/).waitFor();
      await page.getByRole('button', { name: 'Отметить прочитанным' }).click();
      await page.getByText('Прочитан', { exact: true }).waitFor();
      assert.equal(reportReads.length, 3);
      assert.equal(reportReads[1].key, reportReads[2].key);
      await page.getByRole('link', { name: 'К отчётам' }).click();
      await page.getByLabel('Предмет', { exact: true }).selectOption(subjectId);
      await page.getByLabel('С даты').fill('2026-10-01');
      await page.getByLabel('По дату').fill('2026-11-17');
      await page.getByRole('button', { name: 'Запросить PDF' }).click();
      await page.getByText('Постановка в очередь пока не подтверждена.').waitFor();
      assert.equal(pdfWrites.length, 1);
      assert.match(page.url(), /\?pdfRequestId=/);
      await page.getByRole('button', { name: 'Проверить запрос', exact: true }).click();
      await page.getByRole('button', { name: 'Повторить исходный запрос' }).click();
      await page.waitForURL(reportsPage + '?pdfJobId=' + pdfJobId);
      await page.getByRole('button', { name: 'Скачать PDF' }).waitFor();
      assert.equal(pdfWrites.length, 2);
      assert.deepEqual(pdfWrites[0], pdfWrites[1]);
      assert.deepEqual(pdfWrites[1].body, {
        subjectId,
        periodFrom: '2026-10-01',
        periodTo: '2026-11-17',
      });
      assert.ok(!(await page.content()).includes(pdfUrl));
      const downloadBegins = requests.length;
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Скачать PDF' }).click(),
      ]);
      assert.equal(download.suggestedFilename(), 'student-history.pdf');
      assert.ok(
        requests.slice(downloadBegins).includes('/api/v1/student/reports/export-pdf/' + pdfJobId),
      );

      await page.goto(reportsPage + '?reportId=' + reportId + '&pdfRequestId=' + recoveryPdfId);
      await page.getByText(educationReport.content.growthAreas).waitFor();
      assert.equal(
        await page.getByRole('button', { name: 'Повторить исходный запрос' }).count(),
        0,
      );
      await page.getByRole('button', { name: 'Проверить запрос', exact: true }).click();
      await page.getByRole('button', { name: 'Скачать PDF' }).waitFor();
      assert.match(page.url(), new RegExp('reportId=' + reportId + '&pdfJobId=' + pdfJobId));
      assert.equal(pdfWrites.length, 2);
      assert.ok(
        await page.evaluate(
          () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
        ),
      );

      await page.goto(reportsPage + '?pdfJobId=' + expiredPdfId);
      await page.getByText(/Срок ссылки истёк/).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Скачать PDF' }).count(), 0);
      await page.goto(reportsPage + '/' + foreignLessonId);
      await page.getByText('Эта запись недоступна.').waitFor();

      await verifyStudentAccount({ page, base, account: studentAccount });
      const before = requests.length;
      await page.goto(base + '/student/lessons?subjectId=' + foreignLessonId);
      await page.getByText('Предмет недоступен.').waitFor();
      assert.equal(
        requests.slice(before).some((path) => path.startsWith('/api/v1/student/lessons')),
        false,
      );
    }
    if (role === 'TEACHER') {
      await page.goto(base + '/teacher/lessons');
      await page
        .locator('.k8k-calendar-days')
        .getByRole('link', { name: /Математика/ })
        .click();
      assert.equal(requestedDays.size, 7);
      await page.waitForURL(base + '/teacher/lessons/' + lessonId);
      await page
        .getByText('Для начала требуется оплаченное право или разрешение руководителя.')
        .waitFor();
      assert.equal(await page.getByRole('button', { name: 'Начать урок' }).count(), 0);
      allowStart();
      await page.getByRole('button', { name: 'Обновить статус' }).click();
      await page.getByRole('button', { name: 'Начать урок' }).click();
      await page.getByText('Сервер зафиксировал начало урока.').waitFor();
      await page
        .getByRole('combobox', { name: 'Результат', exact: true })
        .selectOption('CONDUCTED');
      assert.equal(await page.locator('input[name="actualStartedAt"]').count(), 0);
      await page.getByLabel('Длительность, мин', { exact: true }).fill('35');
      await page.getByLabel('Комментарий', { exact: true }).fill('Задания выполнены на уроке.');
      await page.locator('.cab-account-button').click();
      await page.locator('.k8k-language select').selectOption('ro');
      await page.getByRole('heading', { name: 'Raportează rezultatul' }).waitFor();
      assert.equal(
        await page.getByLabel('Comentariu', { exact: true }).inputValue(),
        'Задания выполнены на уроке.',
      );
      await page.locator('.k8k-language select').selectOption('ru');
      await page.locator('.cab-account-button').click();
      for (const width of [360, 768, 1024, 1280]) {
        await page.setViewportSize({ width, height: 920 });
        assert.equal(
          await page.evaluate(
            () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
          ),
          true,
          'Teacher lesson overflows at ' + width,
        );
        if (screenshots && (width === 360 || width === 1280)) {
          await page.screenshot({
            path: resolve(output, 'teacher-lesson-' + width + '.png'),
            fullPage: true,
          });
        }
      }
      await page.getByRole('button', { name: 'Отправить отчёт' }).click();
      for (let attempt = 0; attempt < 2; attempt += 1) {
        await page.getByText(/Результат отправки пока неизвестен/).waitFor();
        assert.equal(await page.getByRole('button', { name: 'Повторить отправку' }).count(), 0);
        await page.getByRole('button', { name: 'Проверить статус' }).click();
        await page.getByRole('button', { name: 'Повторить отправку' }).click();
      }
      await page.getByText('Сервер принял отчёт преподавателя.').waitFor();
      await page.getByText('Ожидает подтверждения', { exact: true }).waitFor();
      assert.equal(await page.getByText('Подтверждённый итог', { exact: true }).count(), 0);
      assert.equal(sentReports.length, 3);
      assert.deepEqual(sentReports, Array(3).fill(sentReports[0]));
      assert.deepEqual(sentReports[0].body, {
        result: 'CONDUCTED',
        note: 'Задания выполнены на уроке.',
        actualStartedAt: teacherStart,
        durationMin: 35,
      });
      await verifyTeacherStudentOverview(
        page,
        base,
        teacherStudents,
        screenshots ? output : undefined,
      );
      await verifyTeacherStudentWorkflows(
        page,
        base,
        teacherStudents,
        screenshots ? output : undefined,
      );
      await verifyTeacherReportDirectory(
        page,
        base,
        teacherReports,
        screenshots ? output : undefined,
      );
      await verifyTeacherReportCommands(
        page,
        base,
        teacherReports,
        screenshots ? output : undefined,
      );
      await verifyTeacherHomework(
        page,
        base,
        lessonId,
        teacherHomework,
        screenshots ? output : undefined,
      );
    }
    if (role === 'MANAGER') {
      await page.getByRole('link', { name: /Связаться с семьёй/ }).click();
      await page.waitForURL(base + '/manager/tasks/' + taskId);
      await page.getByText('Анна Мирова', { exact: true }).waitFor();
      await page.getByText('Действия раздела', { exact: true }).click();
      await page.getByRole('button', { name: 'Взять в работу' }).click();
      await page.getByLabel('Версия').waitFor();
      assert.equal(await page.getByLabel('Версия').inputValue(), '7');
      await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
      await page.getByText('Команда подтверждена сервером.').waitFor();
      assert.deepEqual(claim, { version: 7 });
      await finance.manager(page, base, screenshots ? output : null);
    }
    if (role === 'DIRECTOR') await finance.director(page, base, screenshots ? output : null);
    await page.close();
  }
  const financialManager = await browser.newPage({ viewport: { width: 1350, height: 900 } });
  await open('MANAGER', 'manager', 'Тамара Светлова', financialManager);
  await finance.allocate(financialManager, base);
  await financialManager.close();
  const student = await browser.newPage({ viewport: { width: 1350, height: 900 } });
  const studentApi = await open('STUDENT', 'student', 'Анна Мирова', student, false);
  await student.goto(base + '/account');
  await student.getByRole('heading', { name: 'Вход в кабинет' }).waitFor();
  assert.match(await student.title(), /2K Academy/);
  await student.waitForFunction(() => {
    const logo = globalThis.document.querySelector('.cab-full-logo');
    return logo?.complete && logo.naturalWidth > 0 && logo.src.includes('2k-academy-logo');
  });
  if (screenshots) await student.screenshot({ path: resolve(output, 'login-desktop.png') });
  await student.getByRole('textbox', { name: 'Электронная почта' }).fill('student@example.test');
  await student.getByLabel('Пароль', { exact: true }).fill('synthetic-fixture-password');
  await student.getByRole('button', { name: 'Войти', exact: true }).click();
  await student.waitForURL(base + '/student');
  await student
    .getByRole('link', { name: /Квадратные уравнения/ })
    .first()
    .click();
  await student.waitForURL(base + '/student/homework/' + homeworkId);
  await student.getByLabel('Ответ', { exact: true }).fill('Проверочный ответ');
  await student.getByRole('button', { name: 'Сохранить черновик', exact: true }).click();
  await student.getByText('Черновик сохранён.', { exact: true }).waitFor();
  assert.deepEqual(draft, { content: 'Проверочный ответ' });
  await student.locator('input[type="file"]').setInputFiles({
    name: attachment.fileName,
    mimeType: attachment.mimeType,
    buffer: Buffer.from('solution 1'),
  });
  await student.getByRole('button', { name: 'Прикрепить файл' }).click();
  await student.getByText('Файл проверен и добавлен.').waitFor();
  await student.getByRole('button', { name: 'Сдать задание', exact: true }).click();
  await student.getByText(/Статус отправки неизвестен/).waitFor();
  await student.getByRole('button', { name: 'Проверить результат', exact: true }).click();
  await student.getByText('Задание сдано.', { exact: true }).waitFor();
  await student.getByText('Версия 1', { exact: true }).waitFor();
  await student.goto(base + '/student/homework/' + reviewedHomeworkId);
  await student.getByText(graded.teacherComment, { exact: true }).waitFor();
  assert.equal(await student.getByRole('button', { name: 'Сдать задание' }).count(), 0);
  if (screenshots)
    await student.screenshot({
      path: resolve(output, 'student-homework-review.png'),
      fullPage: true,
    });
  await student.goto(base + '/student/lessons/' + lessonId);
  await student
    .getByText('Когда вход в урок станет доступен, здесь появится кнопка подключения.', {
      exact: true,
    })
    .waitFor();
  assert.equal(await student.getByRole('link', { name: 'Войти в урок' }).count(), 0);
  await student.getByRole('link', { name: /Квадратные уравнения/ }).waitFor();
  await student.getByText(material.fileName, { exact: true }).waitFor();
  assert.equal(studentApi.signedReads.length, 0);
  await student.getByRole('button', { name: 'Получить ссылку' }).click();
  const fileLink = student.getByRole('link', { name: 'Открыть файл' });
  await fileLink.waitFor();
  assert.equal(await fileLink.getAttribute('href'), signedUrl);
  await student.getByRole('button', { name: 'Запросить перенос' }).click();
  await student.getByLabel('Причина', { exact: true }).fill('Не смогу прийти в это время.');
  const preferred = new Date(Date.parse(date) + 3 * 86400_000).toISOString().slice(0, 10);
  await student.getByLabel('Желаемая дата', { exact: true }).fill(preferred);
  await student.getByRole('button', { name: 'Отправить запрос' }).click();
  await student.getByText(/Результат отправки пока неизвестен/).waitFor();
  await student.reload();
  await student.getByRole('button', { name: 'Проверить результат' }).click();
  await student.getByRole('dialog').getByRole('button', { name: 'Проверить результат' }).click();
  await student.getByText('Запрос на перенос передан менеджеру.').waitFor();
  assert.equal(studentApi.lessonCommands.length, 1);
  assert.deepEqual(studentApi.lessonCommands[0].body, {
    reason: 'Не смогу прийти в это время.',
    preferredDate: preferred,
  });
  if (screenshots)
    await student.screenshot({
      path: resolve(output, 'student-lesson-request.png'),
      fullPage: true,
      animations: 'disabled',
    });
  await student
    .getByRole('dialog')
    .getByRole('button', { name: 'Закрыть', exact: true })
    .last()
    .click();
  await student.getByRole('button', { name: 'Обновить данные', exact: true }).click();
  await student.getByRole('button', { name: 'Номер обращения' }).click();
  await student.getByText('Запрос на перенос передан менеджеру.').waitFor();
  assert.equal(studentApi.lessonCommands.length, 1);
  await student.goto(base + '/student/lessons/' + priorLessonId);
  await student.getByText('Остаток неизвестен', { exact: true }).waitFor();
  await student.getByText('7.5', { exact: true }).waitFor();
  assert.equal(await student.getByRole('button', { name: 'Запросить перенос' }).count(), 0);
  await student.getByRole('button', { name: 'Оспорить списание' }).click();
  await student.getByLabel('Что произошло', { exact: true }).fill('Занятие было отменено заранее.');
  await student.getByRole('button', { name: 'Отправить запрос' }).click();
  await student.getByText('Спор передан менеджеру на рассмотрение.').waitFor();
  assert.deepEqual(studentApi.lessonCommands[1].body, {
    description: 'Занятие было отменено заранее.',
  });
  const beforeForeign = studentApi.requests.length;
  await student.goto(base + '/student/lessons/' + foreignLessonId);
  await student.getByText('Данные урока недоступны.').waitFor();
  assert.equal(
    studentApi.requests
      .slice(beforeForeign)
      .some((path) => path.includes('lessonId=' + foreignLessonId)),
    false,
  );
  studentApi.suspend();
  const beforeSuspend = studentApi.requests.length;
  await student.goto(base + '/student/homework/' + homeworkId);
  await student.waitForURL(base + '/student/suspended');
  await student.getByRole('heading', { name: 'Доступ к кабинету приостановлен' }).waitFor();
  await student.getByRole('link', { name: '+37300000000' }).waitFor();
  assert.equal(
    studentApi.requests
      .slice(beforeSuspend)
      .some((path) => path.startsWith('/api/v1/student/homework')),
    false,
  );
  const beforeSuspendedPlan = studentApi.requests.length;
  await student.goto(base + '/student/subscription?subscriptionId=' + planId);
  await student.waitForURL(base + '/student/suspended');
  await student.getByRole('heading', { name: 'Доступ к кабинету приостановлен' }).waitFor();
  assert.equal(
    studentApi.requests
      .slice(beforeSuspendedPlan)
      .some((path) => path.startsWith('/api/v1/student/subscription')),
    false,
  );
  const beforeSuspendedNotices = studentApi.requests.length;
  await student.goto(base + '/student/notifications?events=1');
  await student.waitForURL(base + '/student/suspended');
  await student.getByRole('heading', { name: 'Доступ к кабинету приостановлен' }).waitFor();
  assert.equal(
    studentApi.requests
      .slice(beforeSuspendedNotices)
      .some((path) => path.startsWith('/api/v1/student/notifications')),
    false,
  );
  await verifyLockedStudentPassword({ page: student, base, account: studentApi.studentAccount });
  assert.deepEqual(errors, []);
  console.log(
    'OK: profile and account security, notification drawer, inbox and read retries, published reports, PDF recovery and verified download, subscription balances, payment precision and ledger, subjects, scoped lessons and materials, skill maps and history, five cabinet dashboards, 2K brand and subject art, mobile menu and overflow, login, record deep links, weekly teacher schedule, journal pagination, checkpoints and report publication, scoped teacher student overview, goals and assessment, teacher homework issue and review, manager/director payment transitions and allocation, student file verification, homework recovery and review, lesson request recovery, deduction dispute and access suspension.',
  );
} finally {
  await browser?.close();
  server.close();
}

// Synthetic HTTP boundary for browser tests. Never connects to the working DB or S3.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { journeyHistory, journeyLessons } from './lesson-journey-fixtures.mjs';
import {
  anchors,
  subscriptionDetails,
  subscriptionLedger,
  subscriptionPayments,
  subscriptionSubjects,
} from './k8k-subscriptions/data.mjs';
export const lessonId = '10000000-0000-4000-8000-000000000001';
export const homeworkId = '20000000-0000-4000-8000-000000000001';
export const englishId = '60000000-0000-4000-8000-000000000001';
export const mathId = '60000000-0000-4000-8000-000000000002';
export const periodId = '61000000-0000-4000-8000-000000000001';
const skillId = '30000000-0000-4000-8000-000000000001';
const fileId = '40000000-0000-4000-8000-000000000001';
const now = () => new Date().toISOString();
const initial = () => ({
  auth: true,
  mustChangePassword: false,
  active: true,
  draft: '',
  submitted: false,
  unread: 2,
  calls: [],
  missingRoutes: [],
  uploads: 0,
  confirmed: false,
  draftDelay: 0,
  submitDelay: 0,
  failDraft: false,
  failSubmit: false,
  failConfirm: false,
});
const states = new Map();
const fallback = initial();
const root = resolve(import.meta.dirname, process.env.STUDENT_FIXTURE_DIST || '../dist');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.ico': 'image/x-icon',
};
const contacts = {
  whatsapp: 'https://wa.me/37360000001',
  telegram: 'https://t.me/academy_manager',
};
function subjects(state) {
  const enrollmentId = '62000000-0000-4000-8000-000000000001';
  return [
    {
      subjectId: englishId,
      subjectName: 'Английский язык',
      enrollmentIds: [enrollmentId],
      displayStatus: 'ACTIVE',
      reasonCode: 'PAID_RIGHTS',
      liveAccess: true,
      capabilities: {
        canViewHomework: true,
        canViewMaterials: true,
        canOpenSubscription: true,
        canOpenLessons: true,
      },
      subscriptions: [
        {
          subscriptionId: periodId,
          managerSubscriptionId: '63000000-0000-4000-8000-000000000001',
          enrollmentId,
          displayStatus: 'ACTIVE',
          reasonCode: 'PAID_RIGHTS',
          validUntil: '2026-11-30',
          frozenUntil: null,
          paidLessonsRemaining: 6,
          liveAccess: true,
          temporaryAdmission: null,
        },
      ],
    },
    {
      subjectId: mathId,
      subjectName: 'Математика',
      enrollmentIds: ['62000000-0000-4000-8000-000000000002'],
      displayStatus: state.expiredSubject ? 'EXPIRED' : 'FROZEN',
      reasonCode: state.expiredSubject ? 'PERIOD_EXPIRED' : 'FROZEN',
      liveAccess: false,
      capabilities: {
        canViewHomework: false,
        canViewMaterials: true,
        canOpenSubscription: false,
        canOpenLessons: false,
      },
      subscriptions: [],
    },
  ];
}
function list(items, url, defaultSize = 20) {
  const page = Number(url.searchParams.get('page') || 1),
    pageSize = Number(url.searchParams.get('pageSize') || defaultSize);
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total: items.length,
    page,
    pageSize,
  };
}
function lessons(state, meetAsOf = state.meetSnapshot?.asOf ?? now()) {
  if (state.lessonJourney) return journeyLessons(state);
  const sample = state.meetSnapshot;
  const asOf = Date.parse(meetAsOf);
  const scheduledAt = (offset) => new Date(asOf + offset).toISOString();
  return [
    {
      lessonId,
      scheduledAt: sample?.scheduledAt ?? scheduledAt(300_000),
      durationMinutes: 50,
      subjectName: 'Английский язык',
      teacherName: sample?.teacherName ?? 'Елизавета К.',
      status: sample?.status ?? 'SCHEDULED',
      allowed: sample?.allowed ?? state.canJoin ?? true,
      url: sample?.noLink ? null : 'https://meet.google.com/abc-defg-hij',
      canRequestReschedule: false,
    },
    {
      lessonId: '10000000-0000-4000-8000-000000000002',
      scheduledAt: sample?.secondAt ?? scheduledAt(3 * 86400_000),
      durationMinutes: 50,
      subjectName: 'Математика',
      teacherName: 'Александр Константинопольский — преподаватель математики',
      status: 'SCHEDULED',
      allowed: sample?.secondAllowed ?? false,
      url: 'https://meet.google.com/abc-defg-hij',
      canRequestReschedule: true,
    },
  ].map(({ allowed, url, ...item }) => {
    const elapsed = asOf - Date.parse(item.scheduledAt);
    const canJoin =
      item.status === 'SCHEDULED' &&
      allowed &&
      !!url &&
      elapsed >= -600_000 &&
      elapsed <= 3_600_000;
    return { ...item, meetAsOf, canJoin, meetLink: canJoin ? url : null };
  });
}
function homework(state) {
  return {
    homeworkId,
    assignedAt: new Date(Date.now() - 86400_000).toISOString(),
    dueAt: new Date(Date.now() - 60_000).toISOString(),
    subjectName: 'Английский язык',
    teacherName: 'Елизавета К.',
    title: 'Present Perfect. Рассказ о путешествии',
    description: 'Напиши короткий рассказ о своём путешествии. Используй Present Perfect.',
    status: state.submitted ? 'SUBMITTED' : 'NEEDS_REVISION',
    isLate: state.submitted,
    draftContent: state.draft || null,
    latestVersion: null,
    attachments: [],
    versions: [
      {
        versionNumber: 2,
        content: 'Вторая версия',
        submittedAt: '2026-10-27T12:00:00Z',
        teacherComment: 'Добавь ещё один пример.',
        teacherStatus: 'NEEDS_REVISION',
        attachments: [],
      },
      {
        versionNumber: 1,
        content: 'Первая версия',
        submittedAt: '2026-10-26T12:00:00Z',
        teacherComment: 'Проверь время глагола.',
        teacherStatus: 'NEEDS_REVISION',
        attachments: [],
      },
    ],
  };
}
export function startFixture(port = 4175) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://127.0.0.1:${port}`),
        path = url.pathname;
      const cookies = Object.fromEntries(
        (req.headers.cookie || '')
          .split(';')
          .filter(Boolean)
          .map((s) => s.trim().split('=')),
      );
      let state = states.get(cookies.stu_fixture) || fallback;
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString();
      const body =
        req.headers['content-type']?.includes('application/json') && raw ? JSON.parse(raw) : {};
      const json = (value, status = 200) => {
        res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify(value));
      };
      if (path === '/__fixture/reset') {
        const id = randomUUID();
        state = { ...initial(), ...body };
        states.set(id, state);
        res.setHeader('Set-Cookie', `stu_fixture=${id}; HttpOnly; Path=/; SameSite=Lax`);
        return json({ ok: true });
      }
      if (path === '/__fixture/state') {
        if (req.method === 'PATCH') Object.assign(state, body);
        return json(state);
      }
      if (path === '/__fixture/upload') {
        state.uploads++;
        return json({ ok: true });
      }
      if (path.startsWith('/api/')) {
        if (path === '/api/v1/platform/accounts' && req.method === 'GET') {
          const items = state.demoContacts
            ? [
                {
                  key: 'sofia',
                  name: 'Демо София',
                  role: 'STUDENT',
                  login: 'sofia@example.invalid',
                  home: '/student',
                },
                {
                  key: 'daniil',
                  name: 'Демо Даниил',
                  role: 'STUDENT',
                  login: 'daniil@example.invalid',
                  home: '/student',
                },
              ]
            : [];
          return json({
            enabled: !!state.demoContacts,
            currentKey: state.demoKey ?? (items.length ? 'sofia' : null),
            items,
          });
        }
        state.calls.push({
          path,
          query: url.search,
          method: req.method,
          body:
            path === '/api/v1/auth/session' || path.endsWith('/security/change-password')
              ? {}
              : body,
          csrf: req.headers['x-csrf-token'],
          key: req.headers['idempotency-key'],
        });
        if (
          state.auth &&
          state.mustChangePassword &&
          !(path === '/api/v1/auth/session' && req.method === 'DELETE') &&
          !path.endsWith('/security/change-password')
        )
          return json({ code: 'PASSWORD_CHANGE_REQUIRED' }, 403);
        if (path === '/api/v1/auth/csrf') {
          res.setHeader(
            'Set-Cookie',
            '__Host-school_csrf=fixture-csrf; Path=/; Secure; SameSite=Strict',
          );
          return json({ csrfToken: 'fixture-csrf' });
        }
        if (!['GET', 'HEAD'].includes(req.method) && req.headers['x-csrf-token'] !== 'fixture-csrf')
          return json({ code: 'CSRF_INVALID' }, 403);
        if (path === '/api/v1/auth/session') {
          if (req.method === 'POST') {
            state.auth = true;
            return json({
              account: { id: randomUUID(), kind: 'STUDENT', roles: ['STUDENT'] },
              expires_at: '2099-01-01T00:00:00Z',
              mfa_completed: false,
              recovery_only: false,
            });
          }
          if (req.method === 'DELETE') {
            state.auth = false;
            return json({ loggedOut: true });
          }
        }
        if (!state.auth) return json({ code: 'UNAUTHENTICATED' }, 401);
        if (
          path === '/api/v1/auth/switch-user' &&
          req.method === 'POST' &&
          state.demoContacts &&
          body.key === 'daniil' &&
          state.demoAlternate
        ) {
          const id = randomUUID();
          states.set(id, {
            ...initial(),
            ...state.demoAlternate,
            demoContacts: true,
            demoKey: 'daniil',
          });
          res.setHeader('Set-Cookie', `stu_fixture=${id}; HttpOnly; Path=/; SameSite=Lax`);
          return json({ home: '/student' });
        }
        if (path === '/api/v1/student/me' && state.meForbidden)
          return json({ code: 'FORBIDDEN' }, 403);
        if (path === '/api/v1/student/me' && state.meSuspended)
          return json({ code: 'ACCESS_SUSPENDED', managerContacts: contacts }, 402);
        if (path === '/api/v1/student/me' && state.meError)
          return json({ code: 'STUDENT_CONTEXT_UNAVAILABLE' }, 503);
        if (path === '/api/v1/student/me')
          return json({
            id: '50000000-0000-4000-8000-000000000001',
            userId: state.userId ?? '50000000-0000-4000-8000-000000000002',
            displayName: state.displayName || 'София',
            timeZone: state.timeZone ?? 'Europe/Chisinau',
            email: 'student@example.invalid',
            avatarUrl: null,
            hasActiveAccess: state.active,
            mustChangePassword: state.mustChangePassword,
            createdAt: now(),
            managerContacts: state.managerContacts ?? contacts,
          });
        if (path.endsWith('/security/change-password')) {
          state.mustChangePassword = false;
          return json({ changed: true });
        }
        if (state.mustChangePassword) return json({ code: 'PASSWORD_CHANGE_REQUIRED' }, 403);
        if (!state.active)
          return json(
            { code: 'ACCESS_SUSPENDED', managerContacts: state.managerContacts ?? contacts },
            402,
          );
        if (path === '/api/v1/student/subjects') {
          if (state.subjectDelay) await new Promise((r) => setTimeout(r, state.subjectDelay));
          if (state.subjectError) return json({ code: 'FORBIDDEN' }, state.subjectError);
          const items = state.subscriptionScenario
            ? subscriptionSubjects(state.subscriptionScenario)
            : subjects(state);
          return json({ generatedAt: now(), items: state.subjectEmpty ? [] : items });
        }
        if (state.meetError && /^\/api\/v1\/student\/(dashboard$|lessons(?:\/|$))/.test(path))
          return json({ code: 'UNAVAILABLE' }, state.meetError);
        if (path.endsWith('/student/dashboard')) {
          const generatedAt = state.meetSnapshot?.asOf ?? now();
          const items = lessons(state, generatedAt).filter((item) => item.status === 'SCHEDULED');
          items.sort(
            (a, b) =>
              a.scheduledAt.localeCompare(b.scheduledAt) || a.lessonId.localeCompare(b.lessonId),
          );
          const nextLesson =
            items.find((item) => item.canJoin && item.scheduledAt <= generatedAt) ??
            items.find((item) => item.scheduledAt > generatedAt) ??
            null;
          return json({
            nextLesson,
            homework: {
              notSubmitted: 0,
              submitted: state.submitted ? 1 : 0,
              needsRevision: state.submitted ? 0 : 1,
              total: 1,
            },
            subscription: {
              lessonsRemaining: 6,
              validUntil: '2026-11-30',
              isFrozen: false,
              frozenUntil: null,
            },
            skillProgress: { familiarizing: 1, practicing: 1, applying: 1, notStudied: 1 },
            generatedAt,
          });
        }
        if (path === '/api/v1/student/lessons' || path === '/api/v1/student/lessons/upcoming') {
          let items = url.searchParams.get('period') === 'archive' ? [] : lessons(state);
          const subject = url.searchParams.get('subjectId');
          if (subject) items = items.filter((item) => item.subjectId === subject);
          if (
            state.calendarOverflow &&
            url.searchParams.has('month') &&
            url.searchParams.get('view') !== 'list'
          )
            return json({ code: 'CALENDAR_MONTH_LIMIT_EXCEEDED' }, 422);
          if (path.endsWith('/upcoming') && state.upcomingStatus && items[0])
            items[0] = { ...items[0], status: state.upcomingStatus };
          return json(list(items, url));
        }
        if (path === '/api/v1/student/lessons/history') {
          if (state.historyDelay) await new Promise((done) => setTimeout(done, state.historyDelay));
          if (state.historyError)
            return json({ code: 'STUDENT_HISTORY_UNAVAILABLE' }, state.historyError);
          let items = journeyHistory(state).sort(
            (a, b) =>
              b.scheduledAt.localeCompare(a.scheduledAt) || b.lessonId.localeCompare(a.lessonId),
          );
          const id = url.searchParams.get('lessonId'),
            subject = url.searchParams.get('subjectId');
          if (id) items = items.filter((item) => item.lessonId === id);
          if (subject) items = items.filter((item) => item.subjectId === subject);
          return json(list(items, url));
        }
        if (path.match(/\/lessons\/[^/]+\/requests\/[^/]+$/)) {
          const [, id, key] = path.match(/\/lessons\/([^/]+)\/requests\/([^/]+)$/);
          if (!lessons(state).some((item) => item.lessonId === id))
            return json({ code: 'LESSON_FORBIDDEN' }, 403);
          const task = (state.lessonRequests ?? []).find(
            (item) =>
              item.lessonId === id &&
              item.key === key &&
              (!url.searchParams.has('type') || item.type === url.searchParams.get('type')),
          );
          return json(
            task
              ? { status: 'CREATED', crmTaskId: task.crmTaskId, type: task.type }
              : { status: 'UNKNOWN', crmTaskId: null, type: null },
          );
        }
        if (path.match(/\/lessons\/[^/]+\/(reschedule-request|dispute)$/)) {
          const [, id, action] = path.match(/\/lessons\/([^/]+)\/(reschedule-request|dispute)$/);
          if (!lessons(state).some((item) => item.lessonId === id))
            return json({ code: 'LESSON_FORBIDDEN' }, 403);
          const key = req.headers['idempotency-key'];
          state.lessonRequests ??= [];
          const previous = state.lessonRequests.find((item) => item.key === key);
          if (previous)
            return JSON.stringify(previous.body) === JSON.stringify(body)
              ? json({ crmTaskId: previous.crmTaskId, status: 'CREATED' }, 201)
              : json({ code: 'IDEMPOTENCY_PAYLOAD_MISMATCH' }, 422);
          if (state.commandError)
            return json(
              {
                code:
                  state.commandError === 409
                    ? 'ATTENDANCE_DISPUTE_ALREADY_OPEN'
                    : 'COMMAND_UNAVAILABLE',
              },
              state.commandError,
            );
          if (
            action === 'dispute' &&
            state.lessonRequests.some(
              (item) => item.lessonId === id && item.type === 'ATTENDANCE_DISPUTE',
            )
          )
            return json({ code: 'ATTENDANCE_DISPUTE_ALREADY_OPEN' }, 409);
          if (state.commandDelay) await new Promise((done) => setTimeout(done, state.commandDelay));
          const task = {
            lessonId: id,
            key,
            body,
            crmTaskId: randomUUID(),
            type: action === 'dispute' ? 'ATTENDANCE_DISPUTE' : 'RESCHEDULE_REQUEST',
          };
          state.lessonRequests.push(task);
          return state.lostResponse
            ? json({ code: 'COMMAND_RESPONSE_LOST' }, 503)
            : json({ crmTaskId: task.crmTaskId, status: 'CREATED' }, 201);
        }
        if (path.match(/\/lessons\/[^/]+$/)) {
          const item = lessons(state).find((l) => path.endsWith(l.lessonId));
          return json(item || { code: 'LESSON_NOT_FOUND' }, item ? 200 : 404);
        }
        if (path === '/api/v1/student/homework') {
          if (url.searchParams.has('lessonId') && url.searchParams.get('lessonId') !== lessonId)
            return json(list([], url));
          const item = homework(state);
          return json(
            list(
              !url.searchParams.get('status') || url.searchParams.get('status') === item.status
                ? [item]
                : [],
              url,
            ),
          );
        }
        if (path.endsWith('/draft')) {
          if (state.draftDelay) await new Promise((r) => setTimeout(r, state.draftDelay));
          if (state.failDraft) return json({ code: 'DRAFT_FAILED' }, 503);
          state.draft = body.content;
          return json({ homeworkId, status: 'SAVED', expiresAt: '2099-01-01T00:00:00Z' });
        }
        if (path.endsWith('/upload-url'))
          return json({ fileId, uploadUrl: 'https://upload.student.test/presigned' }, 201);
        if (path.endsWith('/confirm') && path.includes('/files/')) {
          if (state.failConfirm) return json({ code: 'CONFIRM_FAILED' }, 503);
          state.confirmed = true;
          return json({ fileId, status: 'VERIFIED' });
        }
        if (path.endsWith('/submit')) {
          if (state.submitDelay) await new Promise((r) => setTimeout(r, state.submitDelay));
          if (state.failSubmit) return json({ code: 'SUBMIT_FAILED' }, 503);
          state.submitted = true;
          state.draft = '';
          return json(
            { submissionId: randomUUID(), status: 'SUBMITTED', isLate: true, versionNumber: 3 },
            201,
          );
        }
        if (path === `/api/v1/student/homework/${homeworkId}`) return json(homework(state));
        if (path === '/api/v1/student/skills') {
          const maps = [
            {
              subjectId: englishId,
              subjectName: 'Английский язык',
              totalSkills: 4,
              skills: ['NOT_STUDIED', 'FAMILIARIZING', 'PRACTICING', 'APPLYING'].map(
                (status, i) => ({
                  skillId: i ? `30000000-0000-4000-8000-00000000000${i + 1}` : skillId,
                  name: ['Past Perfect', 'Present Perfect', 'Аудирование', 'Знакомство'][i],
                  category: 'Общий английский',
                  status,
                  lastUpdatedAt: now(),
                  lastUpdatedByTeacherName: 'Елизавета К.',
                }),
              ),
              learningGoals: [
                {
                  goalId: randomUUID(),
                  text: 'Уверенно рассказывать о себе',
                  targetDate: '2026-12-01',
                  isAchieved: false,
                },
              ],
              lastSnapshotAt: null,
              nextSnapshotIn: 2,
            },
          ];
          if (state.subjectHub)
            maps.push({
              subjectId: mathId,
              subjectName: 'Математика',
              totalSkills: 0,
              skills: [],
              learningGoals: [],
              lastSnapshotAt: null,
              nextSnapshotIn: null,
            });
          const filter = url.searchParams.get('subjectId');
          if (filter && !maps.some((item) => item.subjectId === filter))
            return json({ code: 'FORBIDDEN' }, 403);
          return json(filter ? maps.filter((item) => item.subjectId === filter) : maps);
        }
        if (path === '/api/v1/student/skills/snapshots' || path === '/api/v1/student/skills/audit')
          return json(list([], url));
        if (path === '/api/v1/student/materials') {
          if (url.searchParams.has('lessonId') && url.searchParams.get('lessonId') !== lessonId)
            return json(list([], url));
          const materials = [
            {
              fileId,
              subjectId: englishId,
              fileName: 'Словарь — Present Perfect.pdf',
              fileSizeBytes: 245000,
              mimeType: 'application/pdf',
              subjectName: 'Английский язык',
              uploadedAt: now(),
              sharedAt: now(),
              sharedByTeacherName: 'Елизавета К.',
              lessonTitle: 'Разговорная практика',
            },
          ];
          if (state.subjectHub)
            materials.push({
              ...materials[0],
              fileId: '40000000-0000-4000-8000-000000000002',
              subjectId: mathId,
              subjectName: 'Математика',
              fileName: 'Алгебра.pdf',
            });
          const filter = url.searchParams.get('subjectId');
          if (filter && !subjects(state).some((item) => item.subjectId === filter))
            return json({ code: 'FORBIDDEN' }, 403);
          return json(
            list(filter ? materials.filter((item) => item.subjectId === filter) : materials, url),
          );
        }
        if (
          state.subscriptionScenario &&
          /^\/api\/v1\/student\/subscription(?:\/(payments|ledger))?$/.test(path)
        ) {
          const anchor = url.searchParams.get('subscriptionId') ?? anchors.math;
          const key = ['math', 'physics', 'english', 'future'].find(
            (value) => anchors[value] === anchor,
          );
          if (!key || (key === 'physics' && state.subscriptionScenario === 'no-plan'))
            return json({ code: 'SUBSCRIPTION_FORBIDDEN' }, 403);
          const kind = path.split('/').at(-1);
          const failure = state.subscriptionFailures?.[key]?.[kind];
          if (failure)
            return json(
              { code: failure === 403 ? 'SUBSCRIPTION_FORBIDDEN' : 'SUBSCRIPTION_UNAVAILABLE' },
              failure,
            );
          if (kind === 'payments')
            return json(list(subscriptionPayments(key, state.subscriptionScenario), url));
          if (kind === 'ledger')
            return json(list(subscriptionLedger(key, state.subscriptionScenario), url));
          return json(subscriptionDetails(key, state.subscriptionScenario));
        }
        if (path === '/api/v1/student/subscription')
          return json({
            subscriptionId: url.searchParams.get('subscriptionId') ?? randomUUID(),
            planName: 'Английский язык · 8 занятий',
            lessonsTotal: 8,
            lessonsRemaining: 6,
            validFrom: '2026-10-01',
            validUntil: '2026-11-30',
            isFrozen: false,
            frozenFrom: null,
            frozenUntil: null,
            status: 'ACTIVE',
          });
        if (path.endsWith('/subscription/payments'))
          return json(
            list(
              [
                {
                  paymentId: randomUUID(),
                  confirmedAt: '2026-10-20T09:00:00Z',
                  amount: '1600.0000',
                  currency: 'MDL',
                  description: 'Оплата абонемента',
                  lessonsAdded: 8,
                },
              ],
              url,
            ),
          );
        if (path.endsWith('/subscription/ledger'))
          return json(
            list(
              [
                {
                  entryId: randomUUID(),
                  entryDate: '2026-10-21',
                  type: 'DEDUCTION',
                  balanceBefore: '7',
                  balanceAfter: '6',
                  description: 'Проведённый урок',
                  lessonId,
                },
              ],
              url,
            ),
          );
        if (path.endsWith('/student/reports'))
          return json(
            list(
              [
                {
                  reportId: '80000000-0000-4000-8000-000000000001',
                  subjectName: 'Математика',
                  createdAt: now(),
                  periodFrom: '2026-10-01',
                  periodTo: '2026-11-01',
                  lessonCount: 8,
                  teacherName: 'Преподаватель ДЕМО',
                  isNew: true,
                  content: {
                    achievements: 'Решает задачи',
                    growthAreas: 'Проверка ответа',
                    recommendations: 'Практиковаться',
                    teacherSignature: 'Подтверждено преподавателем',
                  },
                },
              ],
              url,
            ),
          );
        if (path.match(/\/reports\/[^/]+\/read$/)) {
          res.writeHead(204);
          return res.end();
        }
        if (path.endsWith('/notifications/count')) return json({ unreadCount: state.unread });
        if (
          path.endsWith('/notifications/read-all') ||
          path.match(/\/notifications\/[^/]+\/read$/)
        ) {
          state.unread = 0;
          res.writeHead(204);
          return res.end();
        }
        if (path.endsWith('/student/notifications'))
          return json({
            ...list(
              [
                {
                  notificationId: '70000000-0000-4000-8000-000000000001',
                  type: 'HOMEWORK_NEEDS_REVISION',
                  title: 'Преподаватель проверил работу',
                  body: 'Добавь ещё один пример и отправь новую версию.',
                  isRead: !state.unread,
                  createdAt: now(),
                  payload: {},
                },
              ],
              url,
            ),
            unreadCount: state.unread,
          });
        if (path.endsWith('/student/profile')) {
          state.displayName = body.displayName;
          return json({ ...body, avatarFileId: null });
        }
        if (path.endsWith('/security/sessions'))
          return json([
            {
              sessionId: randomUUID(),
              createdAt: now(),
              lastActiveAt: now(),
              userAgent: 'Chromium',
              ipAddress: '127.0.0.1',
              isCurrent: true,
            },
          ]);
        if (path.endsWith('/change-email/request')) return json({ message: 'OTP sent' });
        if (path.endsWith('/change-email/confirm')) return json({ email: body.newEmail });
        state.missingRoutes.push(path);
        return json({ code: 'FIXTURE_ROUTE_MISSING', path }, 501);
      }
      const staticPath = resolve(root, path.replace(/^\/student\/?/, ''));
      if (staticPath !== root && !staticPath.startsWith(root + sep)) {
        res.writeHead(403);
        return res.end();
      }
      let target = staticPath;
      if (!extname(path) || path.endsWith('/')) target = resolve(root, 'index.html');
      const content = await readFile(target);
      res.writeHead(200, { 'Content-Type': types[extname(target)] || 'application/octet-stream' });
      res.end(content);
    } catch {
      res.writeHead(500);
      res.end('Fixture failed');
    }
  });
  return server.listen(port, '127.0.0.1');
}
if (process.argv[1] === import.meta.filename) startFixture();

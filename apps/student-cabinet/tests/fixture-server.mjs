// Synthetic HTTP boundary for browser tests. Never connects to the working DB or S3.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
export const lessonId = '10000000-0000-4000-8000-000000000001';
export const homeworkId = '20000000-0000-4000-8000-000000000001';
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
const root = resolve(import.meta.dirname, '../dist');
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
function lessons() {
  return [
    {
      lessonId,
      scheduledAt: new Date(Date.now() + 300_000).toISOString(),
      durationMinutes: 50,
      subjectName: 'Английский язык',
      teacherName: 'Елизавета К.',
      status: 'SCHEDULED',
      canJoin: true,
      meetLink: 'https://meet.google.com/abc-defg-hij',
      canRequestReschedule: false,
    },
    {
      lessonId: '10000000-0000-4000-8000-000000000002',
      scheduledAt: new Date(Date.now() + 3 * 86400_000).toISOString(),
      durationMinutes: 50,
      subjectName: 'Математика',
      teacherName: 'Александр Константинопольский — преподаватель математики',
      status: 'SCHEDULED',
      canJoin: false,
      meetLink: null,
      canRequestReschedule: true,
    },
  ];
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
        state.calls.push({
          path,
          query: url.search,
          method: req.method,
          body,
          csrf: req.headers['x-csrf-token'],
          key: req.headers['idempotency-key'],
        });
        if (path === '/api/v1/auth/csrf') return json({ csrfToken: 'fixture-csrf' });
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
        if (path === '/api/v1/student/me')
          return json({
            id: '50000000-0000-4000-8000-000000000001',
            userId: '50000000-0000-4000-8000-000000000002',
            displayName: state.displayName || 'София',
            timeZone: 'Europe/Chisinau',
            email: 'student@example.invalid',
            avatarUrl: null,
            hasActiveAccess: state.active,
            mustChangePassword: state.mustChangePassword,
            createdAt: now(),
            managerContacts: contacts,
          });
        if (path.endsWith('/security/change-password')) {
          state.mustChangePassword = false;
          return json({ changed: true });
        }
        if (state.mustChangePassword) return json({ code: 'MUST_CHANGE_PASSWORD' }, 403);
        if (!state.active)
          return json({ code: 'ACCESS_SUSPENDED', managerContacts: contacts }, 402);
        if (path.endsWith('/student/dashboard')) {
          const l = lessons()[0];
          return json({
            nextLesson: l,
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
            generatedAt: now(),
          });
        }
        if (path === '/api/v1/student/lessons' || path === '/api/v1/student/lessons/upcoming')
          return json(list(url.searchParams.get('period') === 'archive' ? [] : lessons(), url));
        if (path.match(/\/lessons\/[^/]+\/reschedule-request$/))
          return json({ crmTaskId: randomUUID(), status: 'CREATED' }, 201);
        if (path.match(/\/lessons\/[^/]+$/)) {
          const item = lessons().find((l) => path.endsWith(l.lessonId));
          return json(item || { code: 'LESSON_NOT_FOUND' }, item ? 200 : 404);
        }
        if (path === '/api/v1/student/homework') {
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
        if (path === '/api/v1/student/skills')
          return json([
            {
              subjectId: '60000000-0000-4000-8000-000000000001',
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
          ]);
        if (path === '/api/v1/student/skills/snapshots' || path === '/api/v1/student/skills/audit')
          return json(list([], url));
        if (path === '/api/v1/student/materials')
          return json(
            list(
              [
                {
                  fileId,
                  fileName: 'Словарь — Present Perfect.pdf',
                  fileSizeBytes: 245000,
                  mimeType: 'application/pdf',
                  subjectName: 'Английский язык',
                  uploadedAt: now(),
                  sharedAt: now(),
                  sharedByTeacherName: 'Елизавета К.',
                  lessonTitle: 'Разговорная практика',
                },
              ],
              url,
            ),
          );
        if (path === '/api/v1/student/subscription')
          return json({
            subscriptionId: randomUUID(),
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

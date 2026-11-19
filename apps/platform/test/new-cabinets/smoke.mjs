import { paymentChecks } from './payments.mjs';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../../dist/', import.meta.url));
const output = fileURLToPath(new URL('../../../../output/new-cabinets/', import.meta.url));
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
const date = new Date().toISOString();
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
    items: ['Математика', 'Английский', 'Программирование', 'Istorie', 'Fizică'].map(
      (subjectName, i) => ({
        subjectId: subjectId.slice(0, -1) + i,
        subjectName,
        displayStatus: 'ACTIVE',
      }),
    ),
  },
  '/api/v1/student/notifications/count': { unread: 2 },
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
  '/api/v1/teacher/homework': {
    items: [{ ...homework, deliveryId: homeworkId, studentName: 'Анна Мирова' }],
    total: 1,
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
        displayName,
        timeZone: 'Europe/Chisinau',
        mustChangePassword: false,
        hasActiveAccess: !suspended,
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
    const { allowStart } = await open(role, slug, name, page);
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
  assert.deepEqual(errors, []);
  console.log(
    'OK: five cabinet dashboards, 2K brand and subject art, mobile menu and overflow, login, record deep links, weekly teacher schedule, manager/director payment transitions and allocation, student file verification, homework recovery and review, lesson request recovery, deduction dispute and access suspension.',
  );
} finally {
  await browser?.close();
  server.close();
}

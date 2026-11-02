// Phase 0 evidence only. Renders exact main sources with synthetic local API boundaries.
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const root = process.cwd();
const out = resolve(root, 'output/k8k-phase0');
const baseline = JSON.parse(await readFile(resolve(out, 'baseline.json'), 'utf8'));
const publicCatalog = JSON.parse(await readFile(resolve(out, 'demo-catalog.json'), 'utf8')).items;
const snapshot = resolve(root, '.codex/k8k-phase0-baseline');
const { startFixture, lessonId, homeworkId } = await import(
  pathToFileURL(resolve(snapshot, 'apps/student-cabinet/tests/fixture-server.mjs'))
);
const fixture = startFixture(55175);
const servers = [];
for (const [app, base, port] of [
  ['student-cabinet', '/student', 55174],
  ['platform', '', 55173],
]) {
  const dir = resolve(root, '.codex/k8k-phase0-dist', app);
  servers.push(
    createServer(async (req, res) => {
      const pathname = new URL(req.url, 'http://local').pathname;
      const rel = base ? pathname.replace(/^\/student\/?/, '') : pathname.slice(1);
      const target = rel.startsWith('assets/') ? resolve(dir, rel) : resolve(dir, 'index.html');
      if (!target.startsWith(dir + sep)) {
        res.writeHead(403).end();
        return;
      }
      try {
        res.writeHead(200, {
          'Content-Type':
            { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' }[
              extname(target)
            ] ?? 'application/octet-stream',
        });
        res.end(await readFile(target));
      } catch {
        res.writeHead(404).end();
      }
    }).listen(port, '127.0.0.1'),
  );
}
const sid = '11111111-1111-4111-8111-111111111111',
  lead = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  tid = '99999999-9999-4999-8999-999999999999';
const student = '/student',
  manager = '/manager',
  card = `${manager}/students/${sid}`,
  leadCard = `${manager}/leads/${lead}`;
const click =
  (name, role = 'button') =>
  async (p) =>
    p
      .getByRole(role, {
        name: new RegExp('^(?:\\+\\s*)?' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'),
      })
      .first()
      .click();
const mutate = (fn) => async (p) => {
  await p.evaluate(fn);
  await p.evaluate(() => globalThis.__managerMock.invalidate());
};
const screens = [];
const add = (id, role, url, options = {}) => screens.push({ id, role, url, ...options });
// Every implemented student page, plus distinct navigable calendar/learning/security views.
for (const [id, url] of [
  ['home', ''],
  ['lessons-list', '/lessons'],
  ['lesson-detail', `/lessons/${lessonId}`],
  ['homework-list', '/homework'],
  ['homework-detail', `/homework/${homeworkId}`],
  ['skills', '/skills'],
  ['materials', '/materials'],
  ['subscription', '/subscription'],
  ['notifications', '/notifications'],
  ['profile', '/profile'],
  ['security', '/security'],
  ['change-password', '/security/change-password'],
  ['login', '/login'],
  ['suspended', '/suspended'],
  ['not-found', '/audit-missing-route'],
])
  add(`stu-${id}`, 'student', student + url, {
    kind: 'route',
    ...(id === 'login' ? { state: { auth: false } } : {}),
    ...(id === 'suspended' ? { state: { active: false } } : {}),
    ...(id === 'change-password' ? { state: { mustChangePassword: true } } : {}),
  });
for (const [key, label] of [
  ['today', 'Сегодня'],
  ['week', 'Неделя'],
  ['archive', 'Архив'],
  ['calendar', 'Календарь'],
])
  add(`stu-lessons-${key}`, 'student', `${student}/lessons`, {
    kind: 'view',
    prepare: click(label),
  });
add('stu-skill-history', 'student', `${student}/skills`, {
  kind: 'view',
  prepare: click('История навыка'),
});
add('stu-snapshot', 'student', `${student}/skills`, {
  kind: 'view',
  syntheticOverride: 'published snapshot DTO',
  prepare: async (p) =>
    p
      .locator('.panel')
      .filter({ has: p.getByRole('heading', { name: 'История срезов', exact: true }) })
      .locator('details > summary')
      .first()
      .click(),
});
add('stu-homework-submitted', 'student', `${student}/homework/${homeworkId}`, {
  kind: 'state',
  state: { submitted: true },
});
add('stu-lesson-reschedule', 'student', `${student}/lessons/10000000-0000-4000-8000-000000000002`, {
  kind: 'dialog',
  prepare: click('Запросить перенос'),
});
add('stu-email-code', 'student', `${student}/security`, {
  kind: 'state',
  prepare: async (p) => {
    await p.getByLabel('Новый email', { exact: true }).fill('audit@example.invalid');
    await p.getByLabel('Текущий пароль', { exact: true }).fill('Synthetic-Audit123');
    await p.getByRole('button', { name: 'Получить код', exact: true }).click();
  },
});
add('stu-navigation-drawer', 'student', student, {
  kind: 'drawer',
  prepare: async (p) => {
    const mobile = p.getByRole('button', { name: 'Все разделы', exact: true });
    if (await mobile.isVisible()) await mobile.click();
    else {
      const menu = p.getByRole('button', { name: 'Открыть меню', exact: true });
      if (await menu.isVisible()) await menu.click();
      else return 'not-applicable';
    }
  },
});
add('stu-account-menu', 'student', student, {
  kind: 'popover',
  prepare: async (p) => p.locator('.account-menu > summary').click(),
});
add('stu-unsaved-dialog', 'student', `${student}/homework/${homeworkId}`, {
  kind: 'dialog',
  state: { failDraft: true },
  prepare: async (p) => {
    await p.getByLabel('Твой ответ', { exact: true }).fill('Синтетический черновик для аудита');
    await p.getByRole('link', { name: '← Все задания', exact: true }).click();
    await p.getByRole('dialog', { name: 'Черновик ещё не сохранён' }).waitFor();
  },
});
// Manager route catalog and every student card tab.
for (const [id, url] of [
  ['home', '/'],
  ['leads', '/leads'],
  ['lead-detail', `/leads/${lead}`],
  ['students', '/students'],
  ['student-detail', `/students/${sid}`],
  ['student-account', `/students/${sid}/account`],
  ['schedule', '/schedule'],
  ['tasks', '/tasks'],
  ['task-detail', `/tasks/${tid}`],
  ['login', '/login'],
  ['not-found', '/audit-missing-route'],
])
  add(`mgr-${id}`, 'manager', manager + url, { kind: 'route' });
for (const tab of ['subscriptions', 'payments', 'schedule', 'tasks', 'notifications'])
  add(`mgr-student-${tab}`, 'manager', `${card}?tab=${tab}`, { kind: 'tab' });
add('mgr-leads-board', 'manager', `${manager}/leads`, {
  kind: 'view',
  prepare: click('По стадиям'),
});
for (const view of ['day', 'week'])
  add(`mgr-schedule-${view}`, 'manager', `${manager}/schedule`, {
    kind: 'view',
    prepare: async (p) => p.locator('select[name="view"]').selectOption(view),
  });
add('mgr-create-student', 'manager', `${manager}/students?create=true`, { kind: 'dialog' });
add('mgr-create-lead', 'manager', `${manager}/leads?create=true`, { kind: 'dialog' });
for (const [id, label] of [
  ['contacts', 'Изменить контакты'],
  ['enrollment', 'Добавить направление'],
])
  add(`mgr-student-${id}`, 'manager', card, { kind: 'dialog', prepare: click(label) });
for (const [id, label] of [
  ['edit', 'Изменить заявку'],
  ['lose', 'Закрыть без оплаты'],
])
  add(`mgr-lead-${id}`, 'manager', leadCard, { kind: 'dialog', prepare: click(label) });
for (const [id, label] of [
  ['trial', 'Назначить пробный'],
  ['payment', 'Ожидать оплату'],
])
  add(`mgr-lead-${id}`, 'manager', leadCard, {
    kind: 'dialog',
    prepare: async (p) => {
      await mutate(() => {
        globalThis.__managerMock.leads[0].stage = 'IN_PROGRESS';
      })(p);
      await click(label)(p);
    },
  });
for (const [id, label] of [
  ['create', 'Активировать абонемент'],
  ['renew', 'Продлить'],
  ['freeze', 'Заморозить'],
])
  add(`mgr-subscription-${id}`, 'manager', `${card}?tab=subscriptions`, {
    kind: 'dialog',
    prepare: click(label),
  });
add('mgr-subscription-unfreeze', 'manager', `${card}?tab=subscriptions`, {
  kind: 'dialog',
  prepare: async (p) => {
    await mutate(() => {
      globalThis.__managerMock.subscriptions[0].status = 'FROZEN';
    })(p);
    await click('Разморозить')(p);
  },
});
for (const [id, label] of [
  ['create', 'Зарегистрировать поступление'],
  ['director', 'Передать директору'],
  ['reject', 'Отклонить поступление'],
])
  add(`mgr-payment-${id}`, 'manager', `${card}?tab=payments`, {
    kind: 'dialog',
    prepare: click(label),
  });
for (const [id, label] of [
  ['prepare', 'Подготовить новый пакет'],
  ['allocate', 'Распределить на абонемент'],
])
  add(`mgr-payment-${id}`, 'manager', `${card}?tab=payments`, {
    kind: 'dialog',
    prepare: async (p) => {
      await mutate(() => globalThis.__managerMock.approvePayment())(p);
      await click(label)(p);
    },
  });
add('mgr-notification-compose', 'manager', `${card}?tab=notifications`, {
  kind: 'dialog',
  prepare: click('Отправить уведомление'),
});
add('mgr-schedule-select-student', 'manager', `${manager}/schedule?create=true`, {
  kind: 'dialog',
});
add('mgr-schedule-create', 'manager', `${manager}/schedule?studentId=${sid}`, {
  kind: 'dialog',
  prepare: click('Назначить урок'),
});
for (const [id, label] of [
  ['reschedule', 'Перенести'],
  ['cancel', 'Отменить урок'],
  ['meet', 'Google Meet'],
])
  add(`mgr-schedule-${id}`, 'manager', `${manager}/schedule`, {
    kind: 'dialog',
    prepare: click(label),
  });
add('mgr-task-reschedule', 'manager', `${manager}/tasks/${tid}`, {
  kind: 'view',
  prepare: mutate(() => globalThis.__managerMock.rescheduleTask()),
});
add('mgr-task-reschedule-approve', 'manager', `${manager}/tasks/${tid}`, {
  kind: 'view',
  prepare: mutate(() => {
    globalThis.__managerMock.rescheduleTask();
    globalThis.__managerMock.task.status = 'IN_PROGRESS';
  }),
});
add('mgr-task-reschedule-decline', 'manager', `${manager}/tasks/${tid}`, {
  kind: 'view',
  prepare: async (p) => {
    await mutate(() => {
      globalThis.__managerMock.rescheduleTask();
      globalThis.__managerMock.task.status = 'IN_PROGRESS';
    })(p);
    await p.locator('select[name="rescheduleDecision"]').selectOption('DECLINE');
  },
});
for (const choice of ['REJECT', 'ACCEPT', 'ESCALATE'])
  add(`mgr-task-dispute-${choice.toLowerCase()}`, 'manager', `${manager}/tasks/${tid}`, {
    kind: 'view',
    prepare: async (p) => {
      await mutate(() => {
        globalThis.__managerMock.task.status = 'IN_PROGRESS';
      })(p);
      await p.locator('select[name="decision"]').selectOption(choice);
    },
  });
add('mgr-task-resolved', 'manager', `${manager}/tasks/${tid}`, {
  kind: 'state',
  prepare: mutate(() => {
    globalThis.__managerMock.task.status = 'RESOLVED';
  }),
});
add('mgr-account-secret', 'manager', `${card}/account`, {
  kind: 'state',
  prepare: async (p) => {
    const confirm = p.getByLabel('Я понимаю последствия и подтверждаю действие');
    if (await confirm.isVisible()) await confirm.check();
    const issue = p.getByRole('button', { name: 'Создать аккаунт', exact: true });
    if (await issue.count()) await issue.click();
    else
      await p.getByRole('button', { name: 'Выдать новый временный пароль', exact: true }).click();
    await p.locator('output.secret').waitFor();
  },
});
add('mgr-login-mfa', 'manager', `${manager}/login`, {
  kind: 'state',
  prepare: async (p) => {
    await p.getByLabel('Email', { exact: true }).fill('audit@example.invalid');
    await p.getByLabel('Пароль', { exact: true }).fill('Synthetic-Audit123');
    await p.getByRole('button', { name: 'Войти', exact: true }).click();
  },
});
add('mgr-account-menu', 'manager', `${manager}/`, {
  kind: 'popover',
  prepare: async (p) => p.locator('.account-menu > summary').click(),
});
add('mgr-forbidden', 'manager', `${manager}/students`, {
  kind: 'state',
  prepare: mutate(() => {
    globalThis.__managerMock.session = 'forbidden';
  }),
});
add('mgr-stale-error', 'manager', `${manager}/students`, {
  kind: 'state',
  prepare: mutate(() => {
    globalThis.__managerMock.fail = true;
  }),
});
// Staff tabs are screens with local state, not invented URL routes.
for (const role of ['teacher', 'director', 'operator']) {
  add(`${role}-overview`, role, `/${role}`, { kind: 'route' });
  if (role !== 'operator')
    for (const [id, title] of [
      ['lessons', 'Расписание'],
      ['students', role === 'director' ? 'Ученики школы' : 'Мои ученики'],
      ['work', role === 'director' ? 'Задачи менеджеров' : 'Домашние задания'],
    ])
      add(`${role}-${id}`, role, `/${role}`, {
        kind: 'tab',
        prepare: async (p) =>
          p
            .getByRole('navigation', { name: 'Разделы кабинета' })
            .getByRole('button', { name: title, exact: true })
            .click(),
      });
  add(`${role}-account-menu`, role, `/${role}`, {
    kind: 'popover',
    prepare: async (p) => p.locator('.account-menu > summary').click(),
  });
}
add('platform-account', 'platform', '/account', { kind: 'route' });
add('platform-session-error', 'platform', '/teacher', { kind: 'state', sessionError: true });
for (const role of ['student', 'manager', 'teacher', 'director', 'operator'])
  add(
    `${role}-demo-switcher`,
    role,
    role === 'student' ? student : role === 'manager' ? `${manager}/` : `/${role}`,
    {
      kind: 'popover',
      switcher: true,
      prepare: async (p) => p.locator('.account-menu > summary').click(),
    },
  );
const browser = await chromium.launch();
let rows = [],
  errors = [];
const now = Date.now(),
  staffData = {
    name: 'Анна Тестовая',
    role: 'TEACHER',
    lessons: [
      {
        id: 'audit-lesson',
        startsAt: new Date(now + 3600000).toISOString(),
        endsAt: new Date(now + 7200000).toISOString(),
        status: 'SCHEDULED',
        subject: 'Математика',
        student: 'София Тестовая',
        teacher: 'Анна Тестовая',
        meetUrl: null,
      },
    ],
    students: [{ id: 'audit-student', name: 'София Тестовая', subject: 'Математика' }],
    homework: [
      {
        id: 'audit-homework',
        title: 'Практика по теме урока',
        subject: 'Математика',
        dueAt: new Date(now + 86400000).toISOString(),
      },
    ],
    tasks: [
      {
        id: 'audit-task',
        title: 'Уточнить время занятия',
        status: 'OPEN',
        dueAt: new Date(now + 3600000).toISOString(),
        manager: 'Тамара Тестовая',
      },
    ],
  };
const origins = {
  student: 'http://127.0.0.1:55174',
  manager: 'http://127.0.0.1:55177',
  teacher: 'http://127.0.0.1:55173',
  director: 'http://127.0.0.1:55173',
  operator: 'http://127.0.0.1:55173',
  platform: 'http://127.0.0.1:55173',
};
const selected = process.argv.slice(2);
let previous = [];
if (selected.length) {
  for (const file of ['screenshots.json', 'capture-progress.json']) {
    try {
      const data = JSON.parse(await readFile(resolve(out, file), 'utf8'));
      previous = data.screens ?? data.rows;
      break;
    } catch {
      /* A fresh evidence directory has no previous manifest. */
    }
  }
}
const work = selected.includes('--pending')
  ? screens.filter((s) =>
      [360, 768, 1024, 1280].some(
        (w) =>
          !previous.some(
            (r) =>
              r.id === s.id && r.width === w && ['captured', 'not-applicable'].includes(r.status),
          ),
      ),
    )
  : selected.length
    ? screens.filter((s) => selected.includes(s.role) || selected.includes(s.id))
    : screens;
rows = previous.filter((r) => !work.some((s) => s.id === r.id));
errors = rows
  .filter((r) => r.status === 'failed')
  .map((r) => ({ id: r.id, width: r.width, message: r.reason }));
await writeFile(
  resolve(out, 'screen-inventory.json'),
  JSON.stringify(
    screens.map((s) => ({ ...s, widths: [360, 768, 1024, 1280] })),
    null,
    2,
  ),
);
try {
  for (const screen of work) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 1000 },
      locale: 'ru-RU',
      timezoneId: 'Europe/Chisinau',
    });
    const catalogResponse = {
      enabled: !!screen.switcher,
      currentKey: screen.switcher
        ? {
            student: 'anna',
            manager: 'tamara',
            teacher: 'andrei',
            director: 'pasha',
            operator: 'tech',
          }[screen.role]
        : null,
      items: screen.switcher ? publicCatalog : [],
    };
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    await context.route('**/*', async (route) => {
      const host = new URL(route.request().url()).hostname;
      if (!['127.0.0.1', 'localhost'].includes(host)) return route.abort();
      return route.continue();
    });
    await context.route('**/api/v1/platform/accounts', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(catalogResponse),
      }),
    );
    if (screen.role === 'student') {
      await context.request.post('http://127.0.0.1:55175/__fixture/reset', {
        data: { auth: true, mustChangePassword: false, active: true, ...screen.state },
      });
      await page.route('**/api/**', async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname === '/api/v1/platform/accounts')
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(catalogResponse),
          });
        if (screen.id === 'stu-snapshot' && url.pathname === '/api/v1/student/skills/snapshots')
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              items: [
                {
                  snapshotId: '30000000-0000-4000-8000-000000000010',
                  subjectName: 'Английский язык',
                  createdAt: new Date(now).toISOString(),
                  lessonNumber: 4,
                  teacherSummary: 'Синтетический опубликованный срез для аудита интерфейса.',
                  skills: [
                    {
                      skillName: 'Разговорная практика',
                      status: 'PRACTICING',
                      teacherComment: 'Синтетический комментарий',
                    },
                  ],
                },
              ],
              total: 1,
              page: 1,
              pageSize: 20,
            }),
          });
        const response = await context.request.fetch(
          'http://127.0.0.1:55175' + url.pathname + url.search,
          {
            method: route.request().method(),
            headers: route.request().headers(),
            ...(route.request().postData() ? { data: route.request().postData() } : {}),
          },
        );
        await route.fulfill({ response });
      });
    } else if (screen.role !== 'manager') {
      await page.route('**/api/**', async (route) => {
        const pathname = new URL(route.request().url()).pathname;
        const role = {
          teacher: 'TEACHER',
          director: 'DIRECTOR',
          operator: 'TECH_OPERATOR',
          platform: 'TEACHER',
        }[screen.role];
        const data = {
          '/api/v1/auth/session': {
            account: { id: 'audit-account', kind: 'STAFF', roles: [role] },
            mfa_completed: true,
            recovery_only: false,
            expires_at: new Date(now + 3600000).toISOString(),
          },
          '/api/v1/platform/accounts': catalogResponse,
          '/api/v1/platform/workspace': {
            ...staffData,
            role,
            name: screen.role === 'director' ? 'Елена Тестовая' : staffData.name,
          },
          '/api/v1/qa/components': { api: 'ok', db: 'ok', worker: 'ok' },
        };
        return route.fulfill({
          status:
            screen.sessionError && pathname === '/api/v1/auth/session'
              ? 503
              : data[pathname]
                ? 200
                : 404,
          contentType: 'application/json',
          body: JSON.stringify(data[pathname] ?? {}),
        });
      });
    }
    for (const width of [360, 768, 1024, 1280]) {
      const result = {
        id: screen.id,
        role: screen.role,
        kind: screen.kind,
        url: screen.url,
        width,
        height: 1000,
        source: baseline.source,
      };
      try {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(origins[screen.role] + screen.url, {
          waitUntil: 'networkidle',
          timeout: 60000,
        });
        await page.locator('h1').first().waitFor({ timeout: 30000 });
        if (screen.role === 'manager')
          await page.waitForFunction(() => !!globalThis.__managerMock, { timeout: 30000 });
        const applicability = screen.prepare ? await screen.prepare(page) : null;
        if (applicability === 'not-applicable') {
          rows.push({
            ...result,
            status: 'not-applicable',
            reason: 'This navigation drawer is not part of the desktop UI.',
          });
          continue;
        }
        await page.evaluate(() => globalThis.document.fonts.ready);
        await page.waitForTimeout(100);
        const file = `${screen.id}-${width}.png`;
        await page.screenshot({ path: resolve(out, file), fullPage: true, animations: 'disabled' });
        const dom = await page.evaluate(() => ({
          title: globalThis.document.title,
          k8k: globalThis.document.documentElement.dataset.k8k ?? null,
          overflow: globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
          h1: globalThis.document.querySelector('h1')?.textContent,
          checks: globalThis.document.querySelectorAll('input[type="checkbox"]').length,
          photos: globalThis.document.querySelectorAll('img').length,
          font: globalThis.getComputedStyle(globalThis.document.body).fontFamily,
        }));
        if (dom.k8k) throw Error('Redesign leaked into baseline');
        result.status = 'captured';
        result.file = file;
        result.sha256 = createHash('sha256')
          .update(await readFile(resolve(out, file)))
          .digest('hex');
        result.dom = dom;
        rows.push(result);
        if (screen.id === 'stu-unsaved-dialog')
          await page.getByRole('button', { name: 'Уйти без сохранения', exact: true }).click();
      } catch (e) {
        rows.push({ ...result, status: 'failed', reason: String(e.message) });
        errors.push({ id: screen.id, width, message: e.message });
      }
      await writeFile(
        resolve(out, 'capture-progress.json'),
        JSON.stringify({ rows, errors }, null, 2),
      );
    }
    console.log(
      `${screen.id}: ${rows
        .filter((r) => r.id === screen.id)
        .map((r) => r.width + '=' + r.status)
        .join(', ')}`,
    );
    await context.close();
  }
} finally {
  await writeFile(
    resolve(out, 'screenshots.json'),
    JSON.stringify(
      {
        source: baseline.source,
        fixtureOnly: true,
        boundary:
          'Exact main frontend; existing student/manager fixtures and explicit synthetic staff GET responses; no working API/DB/S3; no external requests.',
        screens: rows,
        errors,
      },
      null,
      2,
    ),
  );
  await browser.close();
  fixture.close();
  for (const server of servers) server.close();
}
if (errors.length) process.exitCode = 1;

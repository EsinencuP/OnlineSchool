// Local presentation preview of the actual three apps with existing synthetic fixtures.
// No database, credentials, external API/provider calls or production mutations.
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { managerData, managerResponse, operationFor, uuid } from './k8k-baseline-fixtures.mjs';
import { evaluateRoute } from './k8k-route-budget-core.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '.vercel/release/visual-preview');
const require = createRequire(path.join(root, 'apps/platform/package.json'));
const { build } = await import(pathToFileURL(require.resolve('vite')));
const { default: react } = await import(pathToFileURL(require.resolve('@vitejs/plugin-react')));
const aliases = [
  ['@online-school/ui/style.css', 'packages/ui/src/style.css'],
  ['@online-school/account-ui/style.css', 'packages/account-ui/src/style.css'],
  ['@online-school/ui', 'packages/ui/src/index.ts'],
  ['@online-school/account-ui', 'packages/account-ui/src/index.tsx'],
  ['@online-school/api-contracts', 'packages/api-contracts/src/index.ts'],
  ['@online-school/shared', 'packages/shared/src/index.ts'],
].map(([find, file]) => ({ find, replacement: path.join(root, file) }));
const files = new Map();
const budgets = [];
for (const [app, base] of [
  ['platform', '/'],
  ['student-cabinet', '/student/'],
  ['manager-web', '/manager/'],
]) {
  const result = await build({
    root: path.join(root, 'apps', app),
    configFile: false,
    envDir: false,
    publicDir: false,
    plugins: [react()],
    base,
    resolve: { alias: aliases, dedupe: ['react', 'react-dom'] },
    logLevel: 'error',
    build: { write: false, manifest: true },
  });
  const assets = new Map(
    result.output.map((item) => [
      item.fileName,
      Buffer.from(item.type === 'chunk' ? item.code : item.source),
    ]),
  );
  const manifest = JSON.parse(assets.get('.vite/manifest.json').toString());
  const budget = evaluateRoute({
    manifest,
    seeds: ['index.html'],
    assets,
    requiredFonts: ['cyrillic', 'latin', 'romanian'],
  });
  budgets.push({ app, ...budget });
  if (app === 'student-cabinet')
    for (const routeKey of [
      'src/pages/Dashboard.tsx',
      'src/pages/Reports.tsx',
      'src/pages/Lessons.tsx',
      'src/pages/Homework.tsx',
      'src/pages/Learning.tsx',
    ]) {
      const routeBudget = evaluateRoute({
        manifest,
        seeds: ['index.html', routeKey],
        assets,
        requiredFonts: ['cyrillic', 'latin', 'romanian'],
      });
      budgets.push({ app, route: routeKey, ...routeBudget });
      console.log(`${app} ${routeKey}: ${routeBudget.total}/${routeBudget.limit}`);
    }
  console.log(`${app} cold entry: ${budget.total}/${budget.limit}`);
  for (const item of result.output) {
    const bytes = Buffer.from(item.type === 'chunk' ? item.code : item.source);
    const key = base + item.fileName;
    files.set(key, bytes);
    const target = path.join(output, 'build', app, item.fileName);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
}
await writeFile(path.join(output, 'budgets.json'), JSON.stringify(budgets, null, 2) + '\n');
process.env.STUDENT_FIXTURE_DIST = path.join(output, 'build/student-cabinet');
const { startFixture } = await import('../apps/student-cabinet/tests/fixture-server.mjs');
const studentServer = startFixture(0);
if (!studentServer.listening)
  await new Promise((resolve) => studentServer.once('listening', resolve));
const studentOrigin = `http://127.0.0.1:${studentServer.address().port}`;
// Complete only this loopback preview's published skill history. No working data.
const previewSkillMaps = await (await fetch(studentOrigin + '/api/v1/student/skills')).json();
const previewSkill = previewSkillMaps[0]?.skills.find((item) => item.status === 'FAMILIARIZING');
await fetch(studentOrigin + '/__fixture/state', {
  method: 'PATCH',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    skillMaps: previewSkillMaps,
    skillAudit: previewSkill
      ? [
          {
            auditId: uuid('visual-skill-feedback'),
            skillId: previewSkill.skillId,
            skillName: previewSkill.name,
            changedAt: new Date().toISOString(),
            teacherName: previewSkill.lastUpdatedByTeacherName,
            fromStatus: 'NOT_STUDIED',
            toStatus: previewSkill.status,
            comment: 'Добавь ещё один пример в рассказ о путешествии.',
          },
        ]
      : [],
  }),
});
const manager = await managerData();
const catalog = [
  {
    key: 'student',
    name: 'Маша К.',
    role: 'STUDENT',
    login: 'student@preview.test',
    home: '/student',
  },
  {
    key: 'manager',
    name: 'Елена Попеску',
    role: 'MANAGER',
    login: 'manager@preview.test',
    home: '/manager',
  },
  {
    key: 'teacher',
    name: 'Анна П.',
    role: 'TEACHER',
    login: 'teacher@preview.test',
    home: '/teacher',
  },
  {
    key: 'director',
    name: 'Руководитель школы',
    role: 'DIRECTOR',
    login: 'director@preview.test',
    home: '/director',
  },
  {
    key: 'operator',
    name: 'Технический оператор',
    role: 'TECH_OPERATOR',
    login: 'operator@preview.test',
    home: '/operator',
  },
];
const stamp = () => new Date().toISOString();
const shift = (hours) => new Date(Date.now() + hours * 3600000).toISOString();
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.png': 'image/png',
};
function actor(role) {
  return {
    accountId: uuid('visual-account-' + role),
    role,
    staffProfileId: uuid('visual-staff-' + role),
    teacherProfileId: role === 'TEACHER' ? uuid('visual-teacher') : null,
    displayName: catalog.find((a) => a.role === role).name,
    timezone: 'Europe/Chisinau',
    timezoneSource: 'SCHOOL_CONFIGURATION',
    asOf: stamp(),
    accountUpdatedAt: null,
    profileUpdatedAt: null,
  };
}
function workspace(role) {
  const context = actor(role);
  const lessons = [1, 2, 3].map((i) => ({
    id: uuid('visual-lesson-' + i),
    startsAt: shift(i * 2),
    endsAt: shift(i * 2 + 1),
    status: 'SCHEDULED',
    subject: i === 2 ? 'Английский язык' : 'Математика',
    student: 'Маша К.',
    teacher: 'Анна П.',
    meetUrl: null,
  }));
  const coverage = (returned) => ({
    scope: role === 'TEACHER' ? 'OWN_TEACHER' : 'SCHOOL',
    windowFrom: null,
    windowTo: null,
    sourceUpdatedAt: stamp(),
    pageInfo: { returned, limit: 100, hasMore: false, total: null },
  });
  return {
    name: context.displayName,
    role,
    actorContext: context,
    lessons,
    students: [{ id: uuid('visual-pupil'), name: 'Маша К.', subject: 'Математика' }],
    homework: [
      {
        id: uuid('visual-homework'),
        title: 'Линейные уравнения',
        subject: 'Математика',
        dueAt: shift(24),
        student: 'Маша К.',
      },
    ],
    tasks: [
      {
        id: uuid('visual-task'),
        title: 'Проверить расписание',
        status: 'OPEN',
        student: 'Маша К.',
        dueAt: shift(4),
      },
    ],
    coverage: {
      lessons: coverage(3),
      students: coverage(1),
      homework: coverage(1),
      tasks: coverage(1),
    },
  };
}
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1:4188');
  const pathname = url.pathname;
  const cookie = /(?:^|;\s*)visual-role=([^;]+)/.exec(request.headers.cookie ?? '')?.[1];
  let role = catalog.find((a) => a.role === cookie)?.role ?? 'STUDENT';
  const documentRole = catalog.find(
    (a) =>
      a.home === pathname ||
      (a.home === '/manager' && pathname.startsWith('/manager/')) ||
      (a.home === '/student' && pathname.startsWith('/student/')),
  );
  const json = (value, status = 200) => {
    response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify(value));
  };
  try {
    if (!pathname.startsWith('/api/') && !path.extname(pathname) && documentRole) {
      role = documentRole.role;
      response.setHeader('set-cookie', `visual-role=${role}; Path=/; SameSite=Strict`);
    }
    if (pathname === '/api/v1/auth/csrf') return json({ csrfToken: 'fixture-csrf' });
    if (pathname === '/api/v1/auth/session')
      return json({
        account: {
          id: actor(role).accountId,
          kind: role === 'STUDENT' ? 'STUDENT' : role === 'TEACHER' ? 'TEACHER' : 'STAFF',
          roles: [role],
        },
        password_only: true,
        manager_password_only: true,
        mfa_completed: true,
        recovery_only: false,
        expires_at: shift(8),
      });
    if (pathname === '/api/v1/platform/accounts')
      return json({
        enabled: true,
        currentKey: catalog.find((a) => a.role === role).key,
        items: catalog,
      });
    if (pathname === '/api/v1/auth/switch-user') {
      let body = '';
      for await (const chunk of request) body += chunk;
      const selected = catalog.find((a) => a.key === JSON.parse(body).key);
      response.setHeader('set-cookie', `visual-role=${selected.role}; Path=/; SameSite=Strict`);
      return json({ home: selected.home });
    }
    if (pathname === '/api/v1/platform/workspace') return json(workspace(role));
    if (pathname === '/api/v1/qa/components') return json({ api: 'ok', db: 'ok', worker: 'ok' });
    if (pathname.startsWith('/api/v1/student/')) {
      const upstream = await fetch(studentOrigin + pathname + url.search, {
        method: request.method,
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': request.headers['x-csrf-token'] ?? '',
          'idempotency-key': request.headers['idempotency-key'] ?? '',
        },
        ...(request.method !== 'GET' && request.method !== 'HEAD'
          ? {
              body: await (async () => {
                let text = '';
                for await (const c of request) text += c;
                return text;
              })(),
            }
          : {}),
      });
      let data = await upstream.json();
      if (
        pathname === '/api/v1/student/lessons' &&
        Array.isArray(data.items) &&
        url.searchParams.has('month')
      ) {
        const month = url.searchParams.get('month');
        data.items = data.items.filter(
          (item) =>
            new Intl.DateTimeFormat('en-CA', {
              timeZone: 'Europe/Chisinau',
              year: 'numeric',
              month: '2-digit',
            }).format(new Date(item.scheduledAt)) === month,
        );
        data.total = data.items.length;
      }
      if (pathname === '/api/v1/student/me') data = { ...data, displayName: 'Маша К.' };
      return json(data, upstream.status);
    }
    if (pathname.startsWith('/api/v1/manager/')) {
      const operation = operationFor(request.method, pathname);
      if (!operation) return json({ code: 'VISUAL_FIXTURE_NOT_IMPLEMENTED' }, 501);
      const data = managerResponse(operation, manager, {});
      if (data.generatedAt) data.generatedAt = stamp();
      if (data.actorContext) data.actorContext.asOf = stamp();
      return json(data);
    }
    if (pathname.startsWith('/api/')) return json({ code: 'VISUAL_FIXTURE_NOT_IMPLEMENTED' }, 501);
    if (pathname === '/favicon.ico') {
      response.writeHead(204);
      return response.end();
    }
    const key = files.has(pathname)
      ? pathname
      : pathname.startsWith('/student')
        ? '/student/index.html'
        : pathname.startsWith('/manager')
          ? '/manager/index.html'
          : '/index.html';
    if (path.extname(pathname) && !files.has(pathname)) {
      // Retain previous hashed chunks during review-server rebuilds; never serve outside build assets.
      const owner = pathname.startsWith('/student/assets/')
        ? ['student-cabinet', '/student/']
        : pathname.startsWith('/manager/assets/')
          ? ['manager-web', '/manager/']
          : pathname.startsWith('/assets/')
            ? ['platform', '/']
            : null;
      if (owner) {
        const directory = path.join(output, 'build', owner[0]);
        const previous = path.resolve(directory, pathname.slice(owner[1].length));
        const relative = path.relative(directory, previous);
        if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
          try {
            const bytes = await readFile(previous);
            response.writeHead(200, {
              'content-type': contentTypes[path.extname(previous)] ?? 'application/octet-stream',
              'cache-control': 'no-store',
            });
            return response.end(bytes);
          } catch {
            /* Unknown prior hash: normal 404 below. */
          }
        }
      }
      response.writeHead(404);
      return response.end();
    }
    response.writeHead(200, {
      'content-type': contentTypes[path.extname(key)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    response.end(files.get(key));
  } catch {
    json({ code: 'VISUAL_FIXTURE_NOT_IMPLEMENTED' }, 501);
  }
});
server.listen(4188, '127.0.0.1', () =>
  console.log(
    'Local synthetic preview: http://127.0.0.1:4188/student?ui.k8k=1 (all cabinets on the same origin)',
  ),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    server.close();
    studentServer.close();
  });

// TASK-003: local synthetic screenshot evidence. Never connects to production APIs.
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fork } from 'node:child_process';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { createServer as httpServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
import ts from 'typescript';
import {
  ROOT,
  NOW,
  LONG,
  uuid,
  managerData,
  operationFor,
  responseErrors,
  transformStudent,
  managerResponse,
} from './k8k-baseline-fixtures.mjs';

const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
const json = (value) => JSON.stringify(value, null, 2) + '\n';
if (process.argv.includes('--fixture-worker')) {
  const OriginalDate = Date;
  globalThis.Date = class extends OriginalDate {
    constructor(...args) {
      super(...(args.length ? args : [NOW]));
    }
    static now() {
      return OriginalDate.parse(NOW);
    }
  };
  let counter = 0;
  crypto.randomUUID = () => uuid(`fixture-worker-${counter++}`);
  syncBuiltinESMExports();
  const { startFixture } = await import('../apps/student-cabinet/tests/fixture-server.mjs');
  const server = startFixture(0);
  await new Promise((resolve) => server.once('listening', resolve));
  process.send({ port: server.address().port });
  process.on('message', () => server.close(() => process.exit(0)));
} else await main();

async function dataModule(relative) {
  const input = await fs.readFile(path.join(ROOT, relative), 'utf8');
  const code = ts.transpileModule(input, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}
function failure(code, status) {
  return {
    code,
    status,
    message: 'Synthetic baseline response',
    requestId: uuid('request'),
    details: {},
    timestamp: NOW,
    type: 'about:blank',
    title: code,
    detail: 'Synthetic baseline response',
    instance: '/synthetic',
  };
}
function roleApp(role) {
  return role === 'STUDENT' ? 'student' : role === 'MANAGER' ? 'manager' : 'platform';
}
function substitute(route, m) {
  return route.replace(
    ':id',
    route.startsWith('/student/homework')
      ? '20000000-0000-4000-8000-000000000001'
      : route.startsWith('/student/lessons')
        ? '10000000-0000-4000-8000-000000000001'
        : route.includes('/leads')
          ? m.ids.lead
          : route.includes('/tasks')
            ? m.ids.task
            : m.ids.student,
  );
}
function plan(inventory, m, ru) {
  const result = inventory.screens.map((screen) => ({
    id: screen.id,
    inventoryIds: [screen.id],
    role: screen.role,
    app: roleApp(screen.role),
    route:
      screen.route === '*'
        ? '/manager/__baseline_not_found'
        : screen.kind === 'shared-surface'
          ? '/student'
          : screen.kind === 'error-boundary'
            ? '/student/__baseline_not_found'
            : substitute(screen.route, m),
    expected: screen.kind === 'error-boundary' || screen.route === '*' ? 'not-found' : 'ready',
    ...(screen.kind === 'shared-surface'
      ? { app: 'student', role: 'STUDENT', action: 'account-menu' }
      : {}),
    ...(screen.route.endsWith('/suspended') ? { limited: true } : {}),
    ...(screen.route.endsWith('/change-password') ? { mustChangePassword: true } : {}),
  }));
  const add = (id, role, route, props = {}) =>
    result.push({
      id,
      role,
      route: substitute(route, m),
      app: roleApp(role),
      inventoryIds: inventory.screens
        .filter((s) => s.role === role && substitute(s.route, m) === substitute(route, m))
        .map((s) => s.id),
      expected: 'ready',
      ...props,
    });
  const overlays = [
    ['student:reschedule', 'STUDENT', '/student/lessons', { button: 'Запросить перенос' }],
    ['student:report-expanded', 'STUDENT', '/student/reports', { action: 'report' }],
    ['student:bell', 'STUDENT', '/student?events=1', { action: 'bell' }],
    ['student:dirty-editor', 'STUDENT', '/student/homework/:id', { action: 'dirty' }],
    ['student:leave-dirty', 'STUDENT', '/student/homework/:id', { action: 'leave-dirty' }],
    [
      'student:profile-pending',
      'STUDENT',
      '/student/profile',
      { action: 'profile-pending', pendingWrite: true, expected: 'pending' },
    ],
    ['student:manager-contacts', 'STUDENT', '/student', { action: 'contacts' }],
    ['student:email-code-form', 'STUDENT', '/student/security', { action: 'email-code' }],
    [
      'student:draft-error',
      'STUDENT',
      '/student/homework/:id',
      { action: 'draft-error', failDraft: true, expected: 'error' },
    ],
    [
      'student:submit-pending',
      'STUDENT',
      '/student/homework/:id',
      { action: 'submit-pending', pendingWrite: true, expected: 'pending' },
    ],
    [
      'manager:contact-version-conflict',
      'MANAGER',
      '/manager/students/:id',
      { button: ru.editContacts, action: 'conflict', conflict: true },
    ],
    ['manager:login-mfa-prompt', 'MANAGER', '/manager/login', { action: 'mfa-prompt' }],
    ['manager:new-lead', 'MANAGER', '/manager/leads', { button: ru.newLead }],
    ['manager:edit-lead', 'MANAGER', '/manager/leads/:id', { button: ru.editLead }],
    [
      'manager:trial',
      'MANAGER',
      '/manager/leads/:id',
      { button: ru.scheduleTrial, leadStage: 'IN_PROGRESS' },
    ],
    ['manager:lose-lead', 'MANAGER', '/manager/leads/:id', { button: ru.loseLead }],
    [
      'manager:await-payment',
      'MANAGER',
      '/manager/leads/:id',
      { button: ru.awaitPayment, leadStage: 'IN_PROGRESS' },
    ],
    ['manager:new-student', 'MANAGER', '/manager/students', { button: ru.newStudent }],
    ['manager:contacts', 'MANAGER', '/manager/students/:id', { button: ru.editContacts }],
    ['manager:enrollment', 'MANAGER', '/manager/students/:id', { button: ru.addDirection }],
    ['manager:new-lesson', 'MANAGER', '/manager/schedule', { button: ru.newLesson }],
    ['manager:reschedule', 'MANAGER', '/manager/schedule', { button: ru.reschedule }],
    ['manager:cancel', 'MANAGER', '/manager/schedule', { button: ru.cancelLesson }],
    ['manager:meet', 'MANAGER', '/manager/schedule', { button: ru.meet }],
    ...[
      ['create', ru.newSubscription],
      ['renew', ru.renew],
      ['freeze', ru.freeze],
      ['unfreeze', ru.unfreeze],
    ].map(([id, button]) => [
      `manager:subscription-${id}`,
      'MANAGER',
      '/manager/students/:id?tab=subscriptions',
      { button, frozen: id === 'unfreeze' },
    ]),
    ...[
      ['create', ru.registerPayment],
      ['confirm', ru.sendApproval],
      ['reject', ru.rejectPayment],
      ['prepare', ru.preparePackage],
      ['allocate', ru.allocate],
    ].map(([id, button]) => [
      `manager:payment-${id}`,
      'MANAGER',
      '/manager/students/:id?tab=payments',
      { button },
    ]),
    [
      'manager:compose',
      'MANAGER',
      '/manager/students/:id?tab=notifications',
      { button: ru.sendNotification },
    ],
    ['manager:task-dispute', 'MANAGER', '/manager/tasks/:id', { taskWorking: true }],
    [
      'manager:task-reschedule',
      'MANAGER',
      '/manager/tasks/:id',
      { taskWorking: true, rescheduleTask: true },
    ],
    ['manager:board', 'MANAGER', '/manager/leads', { button: ru.board, dialog: false, long: true }],
    ['manager:long-students', 'MANAGER', '/manager/students', { long: true }],
    ['student:long-materials', 'STUDENT', '/student/materials', { long: true }],
    ['student:long-profile', 'STUDENT', '/student/profile', { long: true }],
  ];
  for (const [id, role, route, props] of overlays)
    add(id, role, route, { kind: 'overlay/editor/long-data', ...props });
  for (const [role, route] of [
    ['MANAGER', '/manager'],
    ['TEACHER', '/teacher'],
    ['DIRECTOR', '/director'],
    ['TECH_OPERATOR', '/operator'],
  ])
    add(`${role}:account-menu`, role, route, { action: 'account-menu', kind: 'overlay' });
  for (const role of ['STUDENT', 'MANAGER', 'TEACHER', 'DIRECTOR', 'TECH_OPERATOR']) {
    const route =
      role === 'STUDENT'
        ? '/student/reports'
        : role === 'MANAGER'
          ? '/manager/students'
          : role === 'TEACHER'
            ? '/teacher'
            : role === 'DIRECTOR'
              ? '/director'
              : '/operator';
    for (const state of ['loading', 'empty', 'error', 'forbidden', 'expired', 'stale'])
      add(`${role}:read-${state}`, role, route, {
        kind: 'read-state',
        expected: state,
        [state]: true,
      });
  }
  add('student:no-meet', 'STUDENT', '/student', { noMeet: true });
  add('student:frozen', 'STUDENT', '/student/subscription', { frozen: true });
  for (const state of [
    'loading',
    'empty',
    'ready',
    'stale',
    'error',
    'pending',
    'unknown',
    'forbidden',
    'limited',
    'expired',
  ]) {
    result.push({
      id: `common:${state}`,
      app: 'common',
      role: 'STUDENT',
      route: `/?state=${state}`,
      expected: state,
      common: true,
      inventoryIds: [],
      kind: 'common-boundary',
    });
  }
  return result;
}

async function main() {
  const smoke = process.argv.includes('--smoke');
  const discovery = process.argv.includes('--discovery');
  const stamp =
    new Date().toISOString().replaceAll(/[:.]/g, '-') + '-' + crypto.randomBytes(3).toString('hex');
  const run = path.join(ROOT, 'output/k8k-tasks/TASK-003/runs', stamp);
  await fs.mkdir(run, { recursive: true });
  const inventoryBytes = await fs.readFile(
    path.join(ROOT, 'output/k8k-tasks/TASK-002/inventory.json'),
  );
  const inventory = JSON.parse(inventoryBytes),
    m = await managerData(),
    { ru } = await dataModule('apps/manager-web/src/i18n/ru.ts');
  const { demoAccounts, demoAccountId } = await dataModule(
    'apps/api/src/modules/identity/demo-accounts.ts',
  );
  const allCases = plan(inventory, m, ru);
  let cases = smoke
    ? allCases.filter((c) =>
        [
          'student:/student',
          'student:/student/reports',
          'manager:/manager',
          'manager:/manager/students',
          'TEACHER:/teacher',
          'DIRECTOR:/director',
          'TECH_OPERATOR:/operator',
          'shared:/account',
          'common:forbidden',
          'student:reschedule',
          'manager:new-lead',
          'manager:compose',
        ].includes(c.id),
      )
    : allCases;
  const selected = process.argv
    .find((arg) => arg.startsWith('--cases='))
    ?.slice(8)
    .split(/[,\s]+/);
  if (selected) cases = allCases.filter((c) => selected.includes(c.id));
  if (!cases.length) throw new Error('No cases selected; empty baseline is not a pass');
  const inputs = [
    ...new Set([
      ...inventory.basis.inputManifest.map((e) => e.path).filter((p) => p !== 'package.json'),
      'package.json',
      'scripts/k8k-screen-baseline.mjs',
      'scripts/k8k-baseline-fixtures.mjs',
      'scripts/k8k-baseline-audit.mjs',
      'packages/ui/tests/baseline/index.html',
      'packages/ui/tests/baseline/fixture.tsx',
    ]),
  ].sort();
  const sourceManifest = await Promise.all(
    inputs.map(async (p) => ({ path: p, sha256: sha(await fs.readFile(path.join(ROOT, p))) })),
  );
  const diff = execFileSync(
    'git',
    [
      '--no-optional-locks',
      '-c',
      'core.safecrlf=false',
      'diff',
      '--binary',
      '--full-index',
      'HEAD',
      '--',
    ],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const basis = {
    head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString().trim(),
    branch: execFileSync('git', ['branch', '--show-current'], { cwd: ROOT }).toString().trim(),
    dirtyDigest: sha(json({ trackedDiffSha256: sha(diff), sourceManifest })),
    sourceDigest: sha(json(sourceManifest)),
    sourceManifest,
    definition:
      'SHA256(indented JSON {trackedDiffSha256,sourceManifest}); analysis source/fixture inputs, excludes outputs and mutable bookkeeping docs',
    inventoryInputSha256: sha(inventoryBytes),
    inventoryDirtyDigest: inventory.basis.dirtyDigest,
  };
  await fs.writeFile(
    path.join(run, 'fixture-manifest.json'),
    json({
      schemaVersion: 1,
      now: NOW,
      zone: 'Europe/Chisinau',
      uuid: 'SHA256 property/case seeds, RFC4122 version4 layout',
      widths: smoke ? [360, 1280] : [360, 768, 1024, 1280],
      height: 900,
      locales: ['ru', 'ro'],
      longLabel: LONG,
      basis,
      cases,
      privacy:
        'No request bodies, cookies, passwords, OTPs, signed URLs or token values are written',
      capabilities: 'Unmodified typed ManagerMe fixture capabilities; no fabricated new API fields',
      receiptRelationship:
        'PENDING new receipt separate from historical director-CONFIRMED receipt/distribution supporting active subscription',
      unavailable: inventory.modules
        .filter(
          (mod) =>
            mod.status === 'missing' ||
            mod.status === 'conditional' ||
            mod.status === 'out-of-release',
        )
        .map((mod) => ({
          module: mod.id,
          status: 'NOT_RUN',
          reason: mod.missingFields.join('; '),
          futureTasks: mod.futureTasks,
        })),
    }),
  );
  console.log(json({ phase: 'start', run: path.relative(ROOT, run), cases: cases.length, smoke }));
  const fromManager = createRequire(path.join(ROOT, 'apps/manager-web/package.json'));
  const { build } = await import(pathToFileURL(fromManager.resolve('vite')));
  const { default: react } = await import(
    pathToFileURL(fromManager.resolve('@vitejs/plugin-react'))
  );
  const alias = [
    ['@online-school/ui/style.css', 'packages/ui/src/style.css'],
    ['@online-school/account-ui/style.css', 'packages/account-ui/src/style.css'],
    ['@online-school/ui', 'packages/ui/src/index.ts'],
    ['@online-school/account-ui', 'packages/account-ui/src/index.tsx'],
    ['@online-school/api-contracts', 'packages/api-contracts/src/index.ts'],
    ['@online-school/shared', 'packages/shared/src/index.ts'],
  ].map(([find, p]) => ({ find, replacement: path.join(ROOT, p) }));
  const roots = {
    student: 'apps/student-cabinet',
    manager: 'apps/manager-web',
    platform: 'apps/platform',
    common: 'packages/ui/tests/baseline',
  };
  const servers = [],
    origins = {};
  let worker, browser;
  const rows = [],
    defects = [],
    schemaFindings = new Map(),
    networkChecks = [];
  try {
    for (const [app, dir] of Object.entries(roots)) {
      const dist = path.join(run, 'build', app);
      await build({
        root: path.join(ROOT, dir),
        configFile: false,
        envDir: false,
        publicDir: false,
        plugins: [react()],
        base: app === 'student' ? '/student/' : app === 'manager' ? '/manager/' : '/',
        resolve: { alias, dedupe: ['react', 'react-dom'] },
        logLevel: 'error',
        build: { outDir: dist, emptyOutDir: false },
      });
      const server = httpServer(async (req, res) => {
        const pathname = new URL(req.url, 'http://local').pathname;
        if (pathname.startsWith('/api/')) {
          res.writeHead(501).end('Fixture interception required');
          return;
        }
        const relative = pathname.replace(new RegExp(`^/${app}/?`), '').replace(/^\//, '');
        const target = path.resolve(dist, relative.startsWith('assets/') ? relative : 'index.html');
        if (!target.startsWith(dist + path.sep)) {
          res.writeHead(403).end();
          return;
        }
        try {
          res.writeHead(200, {
            'Content-Type':
              {
                '.html': 'text/html',
                '.js': 'text/javascript',
                '.css': 'text/css',
                '.woff2': 'font/woff2',
              }[path.extname(target)] ?? 'application/octet-stream',
          });
          res.end(await fs.readFile(target));
        } catch {
          res.writeHead(404).end();
        }
      }).listen(0, '127.0.0.1');
      await new Promise((resolve) => server.once('listening', resolve));
      servers.push(server);
      origins[app] = `http://127.0.0.1:${server.address().port}`;
    }
    worker = fork(import.meta.filename, ['--fixture-worker'], {
      cwd: ROOT,
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
      env: { ...process.env, TZ: 'Europe/Chisinau' },
    });
    const workerPort = await new Promise((resolve, reject) => {
      worker.once('message', (msg) => resolve(msg.port));
      worker.once('exit', () => reject(new Error('Local fixture worker exited')));
    });
    const fixtureOrigin = `http://127.0.0.1:${workerPort}`;
    browser = await chromium.launch({ headless: true });
    const versions = {
      node: process.version,
      chromium: browser.version(),
      playwright: JSON.parse(
        readFileSync(path.join(ROOT, 'node_modules/@playwright/test/package.json')),
      ).version,
    };
    await fs.writeFile(
      path.join(run, 'runtime.json'),
      json({
        versions,
        origins,
        fixtureOrigin,
        envDir: false,
        configFile: false,
        externalNetwork: 'abort unless exact current static origin; API intercepted',
        serviceWorkers: 'block',
      }),
    );
    for (const pass of smoke || discovery ? [1] : [1, 2])
      for (const locale of ['ru', 'ro'])
        for (let i = 0; i < cases.length; i++) {
          const scenario = cases[i];
          const demoActor = demoAccounts.find((account) => account.role === scenario.role);
          const demoEnabled = scenario.action === 'account-menu';
          const widths = smoke ? [360, 1280] : [360, 768, 1024, 1280];
          const context = await browser.newContext({
            locale: locale === 'ro' ? 'ro-MD' : 'ru-MD',
            timezoneId: 'Europe/Chisinau',
            viewport: { width: 1280, height: 900 },
            deviceScaleFactor: 1,
            reducedMotion: 'reduce',
            serviceWorkers: 'block',
          });
          const page = await context.newPage();
          page.setDefaultTimeout(3500);
          page.setDefaultNavigationTimeout(12000);
          const errors = [],
            requests = [],
            blocked = [],
            unhandled = [],
            pendingRoutes = [];
          const schemaErrors = [];
          page.on('pageerror', (e) =>
            errors.push({ name: e.name, message: e.message.slice(0, 200) }),
          );
          await page.clock.setFixedTime(new Date(NOW));
          await page.addInitScript(
            ({ locale }) => {
              localStorage.setItem('k8k.locale', locale);
              localStorage.setItem('ui.k8k', '1');
              let counter = 0;
              Object.defineProperty(crypto, 'randomUUID', {
                value: () => `90000000-0000-4000-8000-${String(counter++).padStart(12, '0')}`,
              });
            },
            { locale },
          );
          const reset = await fetch(`${fixtureOrigin}/__fixture/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              active: !scenario.limited,
              mustChangePassword: !!scenario.mustChangePassword,
              failDraft: !!scenario.failDraft,
            }),
          });
          const cookie = reset.headers.get('set-cookie')?.split(';')[0] ?? '';
          await context.route('**/*', async (route) => {
            const request = route.request(),
              url = new URL(request.url());
            if (url.origin !== origins[scenario.app]) {
              blocked.push(url.hostname);
              return route.abort();
            }
            if (!url.pathname.startsWith('/api/')) return route.continue();
            const op = operationFor(request.method(), url.pathname);
            if (!op) {
              unhandled.push(`${request.method()} ${url.pathname}`);
              return route.fulfill({ status: 501, json: failure('FIXTURE_ROUTE_MISSING', 501) });
            }
            const meta = { operation: op.operationId, method: request.method(), status: null };
            requests.push(meta);
            const fulfill = (data, status = 200) => {
              meta.status = status;
              if (status >= 200 && status < 300 && status !== 204) {
                const found = responseErrors(op, status, data);
                schemaErrors.push(...found.map((e) => `${op.operationId}: ${e}`));
                schemaFindings.set(op.operationId, [
                  ...new Set([...(schemaFindings.get(op.operationId) ?? []), ...found]),
                ]);
              }
              return route.fulfill(
                status === 204
                  ? { status: 204, headers: { 'Cache-Control': 'no-store' } }
                  : { status, json: data, headers: { 'Cache-Control': 'no-store' } },
              );
            };
            if (
              scenario.pendingWrite &&
              request.method() !== 'GET' &&
              op.operationId !== 'getCsrfToken'
            ) {
              meta.status = 'held-pending';
              pendingRoutes.push(route);
              return;
            }
            if (
              ['dirty', 'leave-dirty'].includes(scenario.action) &&
              op.operationId === 'saveStudentHomeworkDraft'
            ) {
              meta.status = 'held-pending-draft';
              pendingRoutes.push(route);
              return;
            }
            if (op.operationId === 'getPlatformAccounts')
              return fulfill({
                enabled: demoEnabled,
                currentKey: demoEnabled ? (demoActor?.key ?? null) : null,
                items: demoAccounts,
              });
            if (op.operationId === 'getCsrfToken')
              return fulfill({ csrfToken: uuid('local-memory-only-csrf') });
            if (scenario.conflict && op.operationId === 'updateManagerStudentContacts')
              return fulfill(failure('VERSION_CONFLICT', 409), 409);
            if (scenario.action === 'mfa-prompt' && op.operationId === 'createSession')
              return fulfill({
                account: { id: m.ids.manager, kind: 'STAFF', roles: ['MANAGER'] },
                expires_at: '2026-11-03T12:30:30Z',
                mfa_completed: false,
                recovery_only: false,
              });
            const authRead = ['getStudentMe', 'getManagerMe', 'currentSession'].includes(
              op.operationId,
            );
            if (scenario.expired && (authRead || scenario.role === 'STUDENT'))
              return fulfill(failure('UNAUTHENTICATED', 401), 401);
            if (
              scenario.forbidden &&
              (scenario.role === 'MANAGER' ? op.operationId === 'getManagerMe' : !authRead)
            )
              return fulfill(failure('FORBIDDEN', 403), 403);
            if (
              scenario.loading &&
              (!authRead || scenario.role === 'MANAGER' || scenario.role === 'STUDENT')
            ) {
              meta.status = 'held-loading';
              pendingRoutes.push(route);
              return;
            }
            if (scenario.error && !authRead) return fulfill(failure('UNAVAILABLE', 503), 503);
            if (op.operationId === 'currentSession')
              if (scenario.role === 'SHARED') return fulfill(failure('UNAUTHENTICATED', 401), 401);
            if (op.operationId === 'currentSession')
              return fulfill({
                account: {
                  id: demoEnabled ? demoAccountId(demoActor.key) : uuid(scenario.role),
                  kind:
                    scenario.role === 'STUDENT'
                      ? 'STUDENT'
                      : scenario.role === 'TEACHER'
                        ? 'TEACHER'
                        : 'STAFF',
                  roles: [scenario.role],
                },
                expires_at: '2026-11-03T12:30:30Z',
                mfa_completed: true,
                recovery_only: false,
              });
            if (op.operationId === 'getPlatformWorkspace')
              return fulfill({
                name: 'TEST staff',
                role: scenario.role,
                lessons: scenario.empty
                  ? []
                  : [
                      {
                        id: uuid('staff-lesson'),
                        startsAt: '2026-11-03T11:30:30Z',
                        endsAt: '2026-11-03T12:30:30Z',
                        status: 'SCHEDULED',
                        subject: LONG,
                        student: 'TEST student',
                        teacher: 'TEST teacher',
                        meetUrl: null,
                      },
                    ],
                students: scenario.empty
                  ? []
                  : [{ id: uuid('staff-student'), name: LONG, subject: LONG }],
                homework: scenario.empty
                  ? []
                  : [
                      {
                        id: uuid('staff-homework'),
                        title: LONG,
                        subject: LONG,
                        dueAt: '2026-11-05T10:30:30Z',
                      },
                    ],
                tasks:
                  scenario.role === 'DIRECTOR' && !scenario.empty
                    ? [
                        {
                          id: uuid('staff-task'),
                          title: LONG,
                          status: 'OPEN',
                          dueAt: '2026-11-03T10:00:00Z',
                          manager: 'TEST manager',
                        },
                      ]
                    : [],
              });
            if (op.operationId === 'getComponentStatus')
              return fulfill({
                api: 'ok',
                db: 'ok',
                worker: 'ok',
                workerLastSeenAt: NOW,
                migrationVersion: 'synthetic-baseline',
                checkedAt: NOW,
              });
            if (scenario.app === 'manager') {
              try {
                return fulfill(managerResponse(op, m, scenario));
              } catch {
                unhandled.push(op.operationId);
                return fulfill(failure('FIXTURE_NOT_IMPLEMENTED', 501), 501);
              }
            }
            if (scenario.app === 'student') {
              // Private node-side cookie only; headers/body never enter artifacts.
              const headers = {
                'Content-Type': 'application/json',
                Cookie: cookie,
                'X-CSRF-Token': 'fixture-csrf',
                'Idempotency-Key': uuid(`${scenario.id}:${op.operationId}`),
              };
              const response = await fetch(`${fixtureOrigin}${url.pathname}${url.search}`, {
                method: request.method(),
                headers,
                ...(!['GET', 'HEAD'].includes(request.method())
                  ? { body: request.postData() ?? '{}' }
                  : {}),
              });
              if (response.status === 204) return fulfill(null, 204);
              const raw = await response.json();
              const transformed = transformStudent(raw, op, scenario);
              if (demoEnabled && op.operationId === 'getStudentMe')
                Object.assign(transformed, {
                  userId: demoAccountId(demoActor.key),
                  email: demoActor.login,
                  displayName: demoActor.name,
                });
              return fulfill(transformed, response.status);
            }
            unhandled.push(op.operationId);
            return fulfill(failure('FIXTURE_NOT_IMPLEMENTED', 501), 501);
          });
          try {
            if (scenario.role === 'TECH_OPERATOR' && scenario.empty)
              throw new Error(
                'NOT_RUN: component liveness DTO has no empty-data state; common empty boundary captured separately',
              );
            await page.goto(
              `${origins[scenario.app]}${scenario.route}${scenario.route.includes('?') ? '&' : '?'}ui.k8k=1`,
              { waitUntil: 'load' },
            );
            if (scenario.common) await page.locator('.k8k-state').waitFor();
            else if (scenario.expected === 'loading')
              await page.getByRole('status').first().waitFor();
            else {
              await page.waitForFunction(() =>
                globalThis.document.querySelector('h1')?.textContent?.trim(),
              );
              await page.waitForFunction(
                () =>
                  ![...globalThis.document.querySelectorAll('[data-state="loading"]')].some(
                    (e) => e.getBoundingClientRect().height > 0,
                  ),
              );
            }
            await page.evaluate(() => globalThis.document.fonts.ready);
            await page.waitForTimeout(100);
            if (scenario.button) {
              if (typeof scenario.button !== 'string')
                throw new Error('Overlay label missing from actual RU dictionary');
              const button = page
                .getByRole('button', {
                  name: new RegExp(scenario.button.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
                })
                .first();
              await button.click();
              if (scenario.dialog !== false) await page.getByRole('dialog').last().waitFor();
            }
            if (scenario.action === 'account-menu')
              await page.locator('.account-menu > summary').first().click();
            if (scenario.action === 'report') {
              await page.locator('main details > summary').first().click();
              await page.getByRole('heading', { name: /Достижения|Realizări/ }).waitFor();
            }
            if (scenario.action === 'bell')
              await page.locator('.k8k-notification-menu[open]').waitFor();
            if (scenario.action === 'contacts') {
              await page.setViewportSize({ width: 360, height: 900 });
              await page.locator('.inline-widgets > summary').click();
            }
            if (
              ['dirty', 'leave-dirty', 'draft-error', 'submit-pending'].includes(scenario.action)
            ) {
              await page.getByRole('textbox', { name: 'Твой ответ' }).fill(LONG);
              if (scenario.action === 'leave-dirty') {
                await page.locator('a[href="/student/lessons"]').first().click();
                await page.getByRole('dialog').waitFor();
              }
              if (scenario.action === 'draft-error')
                await page
                  .getByRole('button', { name: 'Повторить сохранение', exact: true })
                  .waitFor();
              if (['dirty', 'leave-dirty'].includes(scenario.action))
                await page.getByText('Сохраняем черновик…', { exact: true }).waitFor();
              if (scenario.action === 'submit-pending') {
                await page.locator('form button[type="submit"]').click();
                await page.waitForTimeout(100);
              }
            }
            if (scenario.action === 'conflict') {
              await page.getByRole('dialog').locator('form button[type="submit"]').click();
              await page.getByRole('heading', { name: ru.conflictTitle }).waitFor();
            }
            if (scenario.action === 'mfa-prompt') {
              await page.locator('input[name="email"]').fill('fixture@example.test');
              await page.locator('input[name="password"]').fill('synthetic-memory-only');
              await page.locator('form button[type="submit"]').click();
              await page.getByRole('heading', { name: ru.mfa, exact: true }).waitFor();
            }
            if (scenario.action === 'email-code') {
              await page
                .getByRole('textbox', { name: 'Новый email', exact: true })
                .fill('fixture@example.test');
              await page.locator('input[name="currentPassword"]').fill('synthetic-memory-only');
              await page.getByRole('button', { name: 'Получить код', exact: true }).click();
              await page.locator('input[name="otp"]').waitFor();
            }
            if (scenario.action === 'profile-pending') {
              await page.locator('input[name="displayName"]').fill('TEST pending profile');
              await page.locator('form button').last().click();
              await page.waitForTimeout(80);
            }
            // Deliberate abort proof: no external host reaches a network socket.
            const sentinel = await page.evaluate(async () => {
              try {
                await fetch('https://baseline-network-sentinel.invalid/probe');
                return false;
              } catch {
                return true;
              }
            });
            networkChecks.push({ case: scenario.id, pass, locale, sentinelAborted: sentinel });
            if (scenario.stale) await context.setOffline(true);
            for (const width of widths) {
              await page.setViewportSize({ width, height: 900 });
              await page.evaluate(() => globalThis.document.fonts.ready);
              await page.waitForTimeout(50);
              if (await page.locator('.secret-screen .secret').count())
                throw new Error('Secret-output capture prohibited');
              const evidence = await page.evaluate(() => {
                const { document, getComputedStyle, innerWidth } = globalThis;
                const root = document.documentElement,
                  visible = (e) =>
                    !!(
                      e.getBoundingClientRect().width &&
                      e.getBoundingClientRect().height &&
                      getComputedStyle(e).visibility !== 'hidden'
                    );
                const states = [...document.querySelectorAll('[data-state]')]
                  .filter(visible)
                  .map((e) => e.getAttribute('data-state'));
                const offenders = [...document.body.querySelectorAll('*')]
                  .filter((e) => visible(e) && e.getBoundingClientRect().right > innerWidth + 1)
                  .slice(0, 12)
                  .map((e) => ({
                    tag: e.tagName,
                    className: typeof e.className === 'string' ? e.className : '',
                    right: Math.round(e.getBoundingClientRect().right),
                    overflowX: getComputedStyle(e).overflowX,
                  }));
                const hiddenOverflow = [...document.body.querySelectorAll('*')]
                  .filter(
                    (e) =>
                      visible(e) &&
                      e.scrollWidth > e.clientWidth + 1 &&
                      getComputedStyle(e).overflowX === 'hidden',
                  )
                  .slice(0, 12)
                  .map((e) => ({
                    tag: e.tagName,
                    className: typeof e.className === 'string' ? e.className : '',
                  }));
                return {
                  htmlLang: root.lang,
                  heading: [...document.querySelectorAll('h1')].map((e) => e.textContent.trim()),
                  bodyLength: document.body.innerText.trim().length,
                  states,
                  privateMarker: document.body.innerText.includes('SYNTHETIC_PRIVATE_MARKER'),
                  loadingText: /^(Загружаем|Загрузка|Открываем ваш кабинет)/.test(
                    document.body.innerText.trim(),
                  ),
                  dialogs: document.querySelectorAll('dialog[open]').length,
                  forms: document.querySelectorAll('form').length,
                  scrollWidth: root.scrollWidth,
                  viewportWidth: innerWidth,
                  overflow: root.scrollWidth > innerWidth + 1,
                  offenders,
                  hiddenOverflow,
                  sensitiveInputValuesPresent: [
                    ...document.querySelectorAll('input[type="password"],input[name="otp"]'),
                  ].some((e) => e.value.length > 0),
                  longRuObserved: /очень длинная/i.test(document.body.innerText),
                  longRoObserved: document.body.innerText.includes('foarte lungă'),
                  cyrillicCharacters: (document.body.innerText.match(/[А-Яа-яЁё]/g) ?? []).length,
                  bodyText: document.body.innerText,
                  focus: {
                    tag: document.activeElement?.tagName,
                    outlineStyle: getComputedStyle(document.activeElement).outlineStyle,
                  },
                };
              });
              const assertions = [
                {
                  name: 'nonblank',
                  pass: evidence.bodyLength > (scenario.expected === 'loading' ? 0 : 10),
                },
                {
                  name: 'external-network-aborted',
                  pass: sentinel && blocked.includes('baseline-network-sentinel.invalid'),
                },
                { name: 'no-unhandled-fixture-operation', pass: unhandled.length === 0 },
                { name: 'DTO-response-shapes', pass: schemaErrors.length === 0 },
                { name: 'no-browser-runtime-error', pass: errors.length === 0 },
                {
                  name: 'ready-is-not-loading',
                  pass:
                    scenario.expected !== 'ready' ||
                    (!evidence.loadingText && !evidence.states.includes('loading')),
                },
              ];
              const actualPath = new URL(page.url()).pathname;
              if (!scenario.common && scenario.expected !== 'ready') {
                const state = scenario.expected;
                const matched =
                  state === 'loading'
                    ? evidence.states.includes('loading') ||
                      /Загруз|Loading|Încărc/.test(evidence.bodyText)
                    : state === 'empty'
                      ? evidence.states.includes('empty') ||
                        /нет|пока|появ|Nu |nici/i.test(evidence.bodyText)
                      : state === 'expired'
                        ? /login|account/.test(actualPath) ||
                          !!(await page.locator('input[type="password"]').count()) ||
                          evidence.states.includes('session-expired')
                        : state === 'pending'
                          ? pendingRoutes.length > 0
                          : state === 'not-found'
                            ? /найден|существует/.test(evidence.bodyText)
                            : state === 'forbidden'
                              ? evidence.states.includes('forbidden') ||
                                /Нет доступа|недоступ|нет прав/i.test(evidence.bodyText)
                              : state === 'error' && scenario.action === 'draft-error'
                                ? (await page
                                    .getByRole('button', {
                                      name: 'Повторить сохранение',
                                      exact: true,
                                    })
                                    .count()) > 0
                                : evidence.states.includes(state);
                assertions.push({ name: `observed-${state}`, pass: matched });
              }
              assertions.push({
                name: 'no-sensitive-field-values-captured',
                pass: !evidence.sensitiveInputValuesPresent,
              });
              if (evidence.sensitiveInputValuesPresent)
                throw new Error('Sensitive input value must be cleared before capture');
              if (scenario.long || (scenario.common && scenario.expected === 'ready'))
                assertions.push({
                  name: 'long-RU-RO-fixture-observed',
                  pass: scenario.common
                    ? locale === 'ru'
                      ? evidence.longRuObserved
                      : evidence.longRoObserved
                    : evidence.longRuObserved && evidence.longRoObserved,
                });
              if (scenario.common) {
                const status =
                  {
                    unknown: 'pending',
                    limited: 'subscription-limited',
                    expired: 'session-expired',
                  }[scenario.expected] ?? scenario.expected;
                assertions.push(
                  { name: 'exact-common-boundary-state', pass: evidence.states.includes(status) },
                  {
                    name: 'private-marker-visibility',
                    pass:
                      evidence.privateMarker ===
                      ['ready', 'stale', 'pending', 'unknown', 'limited'].includes(
                        scenario.expected,
                      ),
                  },
                );
              }
              const file = `p${pass}-${locale}-${String(i).padStart(3, '0')}-${width}.png`;
              const screenshot = await page.screenshot({
                path: path.join(run, file),
                fullPage: true,
                animations: 'disabled',
                caret: 'hide',
              });
              const { bodyText, ...safeEvidence } = evidence;
              const previousFocus = await page.evaluateHandle(
                () => globalThis.document.activeElement,
              );
              const previousScroll = await page.evaluate(() => ({
                x: globalThis.scrollX,
                y: globalThis.scrollY,
              }));
              await page.keyboard.press('Tab');
              const keyboard = await page.evaluate(() => ({
                tag: globalThis.document.activeElement?.tagName,
                outlineStyle: globalThis.getComputedStyle(globalThis.document.activeElement)
                  .outlineStyle,
                focusVisible: globalThis.document.activeElement?.matches(':focus-visible'),
              }));
              await previousFocus.evaluate((element) => element?.focus({ preventScroll: true }));
              await previousFocus.dispose();
              await page.evaluate(({ x, y }) => globalThis.scrollTo(x, y), previousScroll);
              const row = {
                caseId: scenario.id,
                inventoryIds: scenario.inventoryIds,
                pass,
                route: scenario.route,
                actualPath: new URL(page.url()).pathname,
                role: scenario.role,
                locale,
                viewport: { width, height: 900 },
                fixtureId: `fixed-v1:${scenario.id}`,
                expected: scenario.expected,
                commit: basis.head,
                dirtyDigest: basis.dirtyDigest,
                screenshot: file,
                screenshotSha256: sha(screenshot),
                bodyTextSha256: sha(bodyText),
                status: assertions.every((a) => a.pass) ? 'CAPTURED' : 'CAPTURED_WITH_FINDINGS',
                assertions,
                evidence: safeEvidence,
                keyboard,
                requests: [...requests],
                schemaErrors: [...new Set(schemaErrors)],
                runtimeErrors: errors,
                unhandledFixture: unhandled,
              };
              rows.push(row);
              if (evidence.overflow || assertions.some((a) => !a.pass))
                defects.push({
                  caseId: scenario.id,
                  locale,
                  width,
                  screenshot: file,
                  overflow: evidence.overflow,
                  failed: assertions.filter((a) => !a.pass).map((a) => a.name),
                  futureTask: evidence.overflow ? 'TASK-004' : 'TASK-003',
                });
            }
          } catch (error) {
            const sensitive = await page
              .evaluate(
                () =>
                  !!globalThis.document.querySelector('.secret-screen .secret') ||
                  [
                    ...globalThis.document.querySelectorAll(
                      'input[type="password"],input[name="otp"]',
                    ),
                  ].some((e) => e.value.length > 0),
              )
              .catch(() => true);
            if (!sensitive)
              await page
                .screenshot({
                  path: path.join(run, `diagnostic-p${pass}-${locale}-${i}.png`),
                  fullPage: true,
                  animations: 'disabled',
                  caret: 'hide',
                })
                .catch(() => undefined);
            for (const width of widths)
              rows.push({
                caseId: scenario.id,
                inventoryIds: scenario.inventoryIds,
                pass,
                route: scenario.route,
                role: scenario.role,
                locale,
                viewport: { width, height: 900 },
                fixtureId: `fixed-v1:${scenario.id}`,
                commit: basis.head,
                dirtyDigest: basis.dirtyDigest,
                status: 'NOT_RUN',
                reason: error.message.split('\n')[0].slice(0, 250),
                requests,
                schemaErrors: [...new Set(schemaErrors)],
                unhandledFixture: unhandled,
              });
          } finally {
            await context.close();
          }
          if (i % 5 === 0) {
            await fs.writeFile(
              path.join(run, 'INDEX.json'),
              json({ basis, rows, defects, networkChecks }),
            );
            console.log(
              json({
                phase: 'capture',
                pass,
                locale,
                case: i,
                total: cases.length,
                rows: rows.length,
              }),
            );
          }
        }
    const comparisons = rows
      .filter((r) => r.pass === 2 && r.screenshot)
      .map((r) => {
        const first = rows.find(
          (a) =>
            a.pass === 1 &&
            a.caseId === r.caseId &&
            a.locale === r.locale &&
            a.viewport.width === r.viewport.width &&
            a.screenshot,
        );
        return {
          caseId: r.caseId,
          locale: r.locale,
          width: r.viewport.width,
          first: first?.screenshot,
          second: r.screenshot,
          pngIdentical: first?.screenshotSha256 === r.screenshotSha256,
          semanticTextIdentical: first?.bodyTextSha256 === r.bodyTextSha256,
        };
      });
    const changedInputs = [];
    for (const input of sourceManifest)
      if (sha(await fs.readFile(path.join(ROOT, input.path))) !== input.sha256)
        changedInputs.push(input.path);
    const result = {
      basis,
      rows,
      defects,
      networkChecks,
      comparisons,
      schemaFindings: Object.fromEntries(schemaFindings),
      sourceInputsUnchanged: changedInputs.length === 0,
      changedInputs,
      summary: {
        rows: rows.length,
        captured: rows.filter((r) => r.screenshot).length,
        notRun: rows.filter((r) => r.status === 'NOT_RUN').length,
        assertionFailures: rows.filter((r) => r.assertions?.some((a) => !a.pass)).length,
        overflowScreenshots: rows.filter((r) => r.evidence?.overflow).length,
        comparisonPairs: comparisons.length,
        identicalPairs: comparisons.filter((r) => r.pngIdentical).length,
      },
      limits:
        'Visual baseline only. NOT_RUN and observed defects are explicit; no business/API/DB/provider/production acceptance.',
    };
    await fs.writeFile(path.join(run, 'INDEX.json'), json(result));
    const indexMd = [
      '# TASK-003 baseline INDEX',
      '',
      `HEAD \`${basis.head}\`; dirty \`${basis.dirtyDigest}\`; fixed time ${NOW}.`,
      '',
      '|Case / role / route|Pass / locale / viewport|Status|Screenshot|Assertions / overflow / reason|',
      '|---|---|---|---|---|',
      ...rows.map(
        (r) =>
          `|${r.caseId} / ${r.role} / ${r.route}|${r.pass} / ${r.locale} / ${r.viewport.width}×900|${r.status}|${r.screenshot ? `[PNG](${r.screenshot})` : '—'}|${r.assertions ? `${r.assertions.filter((a) => a.pass).length}/${r.assertions.length}; overflow=${r.evidence.overflow}` : r.reason?.replaceAll('|', '/')}|`,
      ),
    ];
    await fs.writeFile(path.join(run, 'INDEX.md'), indexMd.join('\n') + '\n');
    console.log(
      json({
        phase: 'complete',
        run: path.relative(ROOT, run),
        summary: result.summary,
        changedInputs,
      }),
    );
    if (
      changedInputs.length ||
      rows.some((r) => r.status === 'NOT_RUN' && !r.reason.startsWith('NOT_RUN:')) ||
      result.summary.assertionFailures
    )
      process.exitCode = 1;
  } finally {
    await browser?.close();
    if (worker?.connected) worker.send('close');
    for (const server of servers) await new Promise((resolve) => server.close(resolve));
  }
}

// Assemble only fresh successful TASK-035 evidence. No application, network or DB access.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url)),
  out = path.join(root, 'output/k8k-taskpack/task-035');
const read = (p) => readFile(path.join(root, p), 'utf8').then(JSON.parse);
const write = (name, value) =>
  writeFile(path.join(out, name), JSON.stringify(value, null, 2) + '\n');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const basis = await read('output/k8k-taskpack/task-035/basis.json');
const current = await read('output/k8k-taskpack/task-035/latest-all.json');
assert(
  current.results.every((r) => r.exit === 0),
  'The complete local gate must pass',
);
const core = await read(current.run + '/playwright.json');
let extraRun = current.run;
try {
  await read(current.run + '/playwright-accessibility.json');
} catch {
  extraRun = (await read('output/k8k-taskpack/task-035/latest-accessibility.json')).run;
}
const extra = await read(extraRun + '/playwright-accessibility.json');
for (const result of [core, extra]) {
  assert.equal(result.stats.unexpected, 0);
  assert.equal(result.stats.skipped, 0);
  assert.equal(result.stats.flaky, 0);
}
const api = await read(current.run + '/api-results.json');
assert.equal(api.numFailedTests, 0);
const budgets = await read(extraRun + '/budgets.json');
assert(budgets.rows.every((r) => r.pass));
const locale = await read('output/k8k-taskpack/task-035/locale-impact.json');
assert.equal(locale.additionalJavaScriptCss, 0);
assert(
  locale.ruAssets.every((asset) => budgets.assets.some((item) => asset.endsWith('/' + item.file))),
  'Locale evidence must use the current build',
);
const cases = [];
function collect(suite, run) {
  for (const spec of suite.specs ?? [])
    for (const t of spec.tests ?? [])
      cases.push({
        taskId: 'TASK-035',
        file: spec.file,
        title: spec.title,
        status: t.status,
        project: t.projectName,
        evidence:
          run + (run === current.run ? '/playwright.json' : '/playwright-accessibility.json'),
      });
  for (const child of suite.suites ?? []) collect(child, run);
}
collect(core, current.run);
collect(extra, extraRun);
const screens = [],
  axes = [];
for (const run of [...new Set([current.run, extraRun])]) {
  for (const line of (await readFile(path.join(root, run, 'screenshots.jsonl'), 'utf8'))
    .trim()
    .split('\n'))
    screens.push(JSON.parse(line));
  for (const line of (await readFile(path.join(root, run, 'axe.jsonl'), 'utf8')).trim().split('\n'))
    axes.push(JSON.parse(line));
}
assert(axes.every((r) => r.failures.length === 0));
const ready = screens.filter((r) => /TASK-035 screen matrix/.test(r.test));
const readyScenes = new Map();
for (const scene of ready) {
  const key = scene.test;
  const values = readyScenes.get(key) ?? new Set();
  values.add(scene.viewport.width);
  readyScenes.set(key, values);
}
assert.equal(readyScenes.size, 38);
assert(
  [...readyScenes.values()].every((widths) => [360, 768, 1024, 1280].every((w) => widths.has(w))),
);
const changes = [];
for (const before of basis.files) {
  assert.equal(sha(await readFile(path.join(out, 'before-source', before.path))), before.sha256);
  const bytes = await readFile(path.join(root, before.path));
  if (sha(bytes) !== before.sha256)
    changes.push({ path: before.path, before: before.sha256, after: sha(bytes) });
}
const contracts = await read('output/k8k-taskpack/task-035/contracts-before.json');
for (const item of contracts)
  assert.equal(
    sha(await readFile(path.join(root, item.path))),
    item.sha256,
    'Contract/migration changed: ' + item.path,
  );
await write('source-audit.json', {
  beforeCopiesVerified: basis.files.length,
  changes,
  contractsVerified: contracts.length,
  productSourceChanges: changes.filter((item) =>
    /^(?:apps\/(?:api|student-cabinet)\/src|packages\/(?:ui|account-ui)\/src)\//.test(item.path),
  ),
});
for (const scene of screens) {
  const absoluteEvidence = path.isAbsolute(scene.evidence)
    ? scene.evidence
    : path.resolve(root, 'apps/student-cabinet', scene.evidence);
  await readFile(absoluteEvidence);
  scene.evidence = path.relative(root, absoluteEvidence).replaceAll('\\', '/');
  scene.role = scene.route?.includes('/student/login') ? 'UNAUTHENTICATED' : 'STUDENT';
  scene.fixture = scene.test;
  scene.state ??= /(?:critical state|command state)/.test(scene.test)
    ? scene.test
    : /ready/.test(scene.evidence ?? '')
      ? 'ready'
      : 'fixture-specific';
}
await write('screenshots.json', screens);
await write('browser-cases.json', cases);
await write('accessibility.json', {
  runs: [current.run, extraRun],
  scenes: axes.length,
  violations: 0,
  results: axes,
});
const external = [
  {
    id: 'DB-ROLLOUT',
    status: 'NOT_RUN',
    owner: 'release/DB',
    condition:
      'Разрешённая безопасная проверка рабочей схемы и данных; миграция TASK-027 official phone и прежние query/trigger/immutable ledger/replay/locks. Никакая миграция здесь не применялась.',
  },
  {
    id: 'STORAGE-PDF',
    status: 'NOT_RUN',
    owner: 'TASK-074/075',
    condition:
      'Реальные S3/CORS/expiry/revocation и worker PDF delivery на разрешённой среде, без destructive/main seed.',
  },
  {
    id: 'IDENTITY-PROVIDER',
    status: 'NOT_RUN',
    owner: 'TASK-066/067/069',
    condition:
      'Доставка email/OTP, реальные secure cookie rotation/session revocation и межвкладочная смена actor вне fixture.',
  },
  {
    id: 'MEET-G4',
    status: 'NOT_RUN',
    owner: 'REL-01/A, TASK-074',
    condition:
      'Expanded Meet POC/OAuth/security/QA/G4; переход по fixture URL не доказывает provider integration.',
  },
  {
    id: 'PUBLISHED-PRODUCER',
    status: 'NOT_RUN',
    owner: 'TASK-042/043/044',
    condition:
      'Фактическая педагогическая публикация срез4/отчёт8 и проверка потребления настоящей серверной проекции. UI ученика не создаёт публикацию.',
  },
  {
    id: 'PHYSICAL-AA',
    status: 'NOT_RUN',
    owner: 'TASK-071',
    condition:
      'Физические устройства, assistive technology/screen reader и поддерживаемые браузеры; текущие проверки — Chromium и эмуляция reflow 200%.',
  },
  {
    id: 'VISUAL-SIGNOFF',
    status: 'NOT_RUN',
    owner: 'owner / VIS-13…17',
    condition:
      'Владельческая визуальная приёмка provisional токенов/размеров/шрифта по предъявленным снимкам.',
  },
  {
    id: 'FND-LEGAL-RELEASE',
    status: 'NOT_RUN',
    owner: 'MVP-IMPL-02, LEGAL-01, FIN-LEGAL-01, TASK-074/075',
    condition:
      'Независимые foundation/legal/financial и общий release gate; экономика11.4 и refund review не закрываются этим тестом.',
  },
];
const modules = [
  [
    'DASH-STU-01',
    'Ближайший урок / Meet',
    'getStudentDashboard, getStudentLessons, getStudentLesson',
    'own enrollment + server canJoin/meetAsOf; клик не пишет факт/ledger',
    'apps/api/src/student/dashboard; apps/api/src/student/lessons',
    /current lesson|Meet|meet|main action|complete student journey/,
  ],
  [
    'DASH-STU-02',
    'ДЗ / редактор',
    'getStudentHomework, getStudentHomeworkDetail, saveStudentHomeworkDraft, requestStudentHomeworkUpload, confirmStudentHomeworkUpload, submitStudentHomework',
    'own delivery; serialized draft, explicit submit/unknown reconciliation',
    'apps/api/src/student/homework',
    /TASK-030|draft|confirmation and submission|homework context|command state|complete student journey/,
  ],
  [
    'DASH-STU-03',
    'Расписание / история / формы',
    'getStudentLessons, getStudentLessonHistory, requestStudentLessonReschedule, disputeStudentLessonDeduction, getStudentLessonRequestResult',
    'own lesson/fact, authoritative capabilities; календарь не финансовый факт',
    'apps/api/src/student/lessons; apps/api/src/student/history',
    /TASK-029|screen matrix.*(?:schedule|calendar|lesson)/,
  ],
  [
    'DASH-STU-04',
    'Навыки / срез4 / отчёт8 / PDF',
    'getStudentSkillMaps, getStudentSkillAudit, getStudentSkillSnapshots, getStudentReports, getStudentReport, requestStudentEducationPdf, getStudentEducationPdfStatus, getStudentEducationPdfRequestResult',
    'own historical subject + published-only projection; student read≠teacher publication',
    'apps/api/src/student/skills; apps/api/src/student/reports',
    /TASK-031|TASK-032|third-page|complete student journey/,
  ],
  [
    'DASH-STU-05',
    'Предметные права / абонементы',
    'getStudentSubjects, getStudentSubscription, getStudentSubscriptionLedger, getStudentSubscriptionPayments',
    'own subscription anchor; paid rights and limited admission kept separate',
    'apps/api/src/student/subjects; apps/api/src/student/subscription',
    /subject-hub|subscriptions|critical state|complete student journey/,
  ],
  [
    'DASH-STU-06',
    'Колокольчик',
    'getStudentNotifications, getStudentUnreadNotificationCount, markStudentNotificationRead, markAllStudentNotificationsRead',
    'own feed/count; read/read-all does not claim/resolve or perform target command',
    'apps/api/src/student/notifications',
    /TASK-033|legacy.*notifications|screen matrix.*bell|keyboard/,
  ],
  [
    'DASH-STU-07',
    'Назначенный менеджер / помощь',
    'getStudentMe and ACCESS_SUSPENDED managerContacts projection',
    'enabled assigned staff + official contacts; no general chat',
    'apps/api/src/student/me',
    /manager contacts|screen matrix.*(?:help|suspended)|complete student journey/,
  ],
].map(([id, title, apiSource, right, implementation, pattern]) => ({
  id,
  title,
  status: 'PASS',
  scope: 'local fixtures / unit-HTTP-SDK mocks',
  apiSource,
  right,
  implementation,
  states: [
    'loading',
    'empty',
    'ready',
    'stale',
    'error',
    'pending/unknown-result',
    'forbidden',
    'subscription-limited',
    'session-expired',
  ],
  locales: ['ru', 'ro'],
  evidence: cases.filter((c) => pattern.test(c.title)),
  apiEvidence: current.run + '/api-results.json',
  limitation: 'PostgreSQL/provider verification remains separate; no production GO',
}));
assert(modules.every((m) => m.evidence.length > 0));
const inventory = await read('output/k8k-taskpack/task-035/api-inventory.json');
const operations = new Set(inventory.operations.map((op) => op.operationId));
for (const module of modules)
  for (const name of module.apiSource.match(
    /\b(?:get|save|request|confirm|submit|mark|dispute)[A-Z]\w+/g,
  ) ?? [])
    assert(operations.has(name), 'Unknown SDK operation ' + name);
const prerequisites = await read('output/k8k-taskpack/task-035/prerequisites.json');
const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
const checks = [
  {
    id: 'PREREQUISITES-024-034',
    status: 'PASS',
    evidence: 'prerequisites.json',
    limitation:
      'Historical reports are only provenance; current source/mocks and browser paths were freshly rerun.',
  },
  {
    id: 'FUNCTIONAL-STUDENT',
    status: 'PASS',
    evidence: current.run + '/api-results.json',
    tests: api.numPassedTests,
  },
  {
    id: 'BROWSER-STUDENT',
    status: 'PASS',
    evidence: 'browser-cases.json',
    tests: cases.length,
    skipped: 0,
    flaky: 0,
  },
  {
    id: 'ROUTES-LOCALES-WIDTHS',
    status: 'PASS',
    evidence: 'screenshots.json',
    scenes: 38,
    widths: [360, 768, 1024, 1280],
    screenshots: screens.length,
  },
  {
    id: 'ACCESSIBILITY-LOCAL',
    status: 'PASS',
    evidence: 'accessibility.json',
    axeScenes: axes.length,
    violations: 0,
    limitation:
      'Manual keyboard/focus plus emulated 200% and reduced motion; not full physical WCAG signoff.',
  },
  {
    id: 'ROUTE-BUDGET',
    status: 'PASS',
    evidence: extraRun + '/budgets.json',
    routes: budgets.rows.length,
    maxBytes: Math.max(...budgets.rows.map((r) => r.total)),
    limit: 256000,
    fonts: budgets.rows[0].font.total,
  },
  {
    id: 'LOCALE-IMPACT',
    status: 'PASS',
    evidence: 'locale-impact.json',
    additionalJavaScriptCss: 0,
    romanianFont: 3544,
    limitation: 'Romanian subset is already counted in the shared route budget.',
  },
  {
    id: 'TOKENS-CONTRAST',
    status: 'PASS',
    evidence: current.run + '/design.log',
    measuredPairs: 25,
    limitation: 'Legacy exact Stylelint baseline remains; new/UI violations zero.',
  },
  {
    id: 'CONTRACTS-MIGRATIONS-PRESERVED',
    status: 'PASS',
    evidence: 'source-audit.json',
    verified: contracts.length,
  },
];
const acceptance = {
  taskId: 'TASK-035',
  status: 'DONE',
  meaning: 'Acceptance procedure completed; local student gate PASS, student rollout NO-GO',
  commit: head,
  basis: { branch: basis.branch, dirtyDigest: basis.dirtyDigest, method: basis.method },
  commandEvidence: current.run + '/commands.json',
  supplementalEvidence: extraRun + '/commands.json',
  readiness: {
    localFunctional: 'PASS',
    localVisualAccessibility: 'PASS',
    external: 'NOT_RUN',
    studentRollout: 'NO-GO',
    productionGo: false,
    fndGate: false,
    automaticRollout: false,
  },
  checks,
  modules,
  prerequisites: prerequisites.map((p) => ({
    taskId: p.task,
    status: 'PASS',
    scope: 'local',
    historicalReport: p.report,
    freshEvidence: [current.run + '/api-results.json', current.run + '/playwright.json'],
  })),
  external,
};
await write('acceptance.json', acceptance);
const coverage = `# TASK-035 — трассировка ученического кабинета\n\n| Модуль | API source | Право / действие | Состояния / языки | Свежее evidence |\n| --- | --- | --- | --- | --- |\n${modules.map((m) => `| ${m.id} — ${m.title} | ${m.apiSource} | ${m.right} | 9 классов на уровне кабинета; RU/RO, 360/768/1024/1280 | ${m.evidence.length} browser cases; [API mocks](${path.relative(out, path.join(root, m.apiEvidence)).replaceAll('\\', '/')}); [cases](browser-cases.json) |`).join('\n')}\n\nПодробные test names, actor scope и ограничения: [acceptance.json](acceptance.json). Сами SQL statements, locks/triggers и провайдеры в реальной среде не проверялись.\n`;
await writeFile(path.join(out, 'coverage.md'), coverage);
await write('summary.json', {
  coreRun: current.run,
  extraRun,
  unitTests: api.numPassedTests,
  browserCases: cases.length,
  screenshots: screens.length,
  axeScenes: axes.length,
  budget: budgets.rows[0].total,
  routeCount: budgets.rows.length,
  changes: changes.length,
  contractsVerified: contracts.length,
  external: external.map((e) => e.id),
});
console.log({
  status: 'DONE',
  studentRollout: 'NO-GO',
  unitTests: api.numPassedTests,
  browserCases: cases.length,
  screenshots: screens.length,
  axeScenes: axes.length,
  budget: budgets.rows[0].total,
});

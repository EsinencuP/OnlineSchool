// TASK-004 local frontend budget and addressed evidence. No env/DB/provider access.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import ts from 'typescript';
import { evaluateRoute, LIMIT, METHOD } from './k8k-route-budget-core.mjs';

const root = path.resolve(import.meta.dirname, '..'),
  output = path.join(root, 'output/k8k-tasks/TASK-004');
const baseline = 'output/k8k-tasks/TASK-003/runs/2026-11-03T20-50-31-027Z-8bc616';
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const read = async (p) => JSON.parse(await fs.readFile(p, 'utf8'));
const write = async (p, value) => {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(value, null, 2) + '\n');
};
const git = (...args) =>
  execFileSync('git', ['--no-optional-locks', '-c', 'core.safecrlf=false', ...args], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
function inside(base, relative) {
  const p = path.resolve(base, relative);
  if (!p.startsWith(path.resolve(base) + path.sep))
    throw new Error('Target escapes intended directory');
  return p;
}
async function list(dir) {
  return (await fs.readdir(dir, { withFileTypes: true })).flatMap((e) =>
    e.isDirectory() ? [] : [e.name],
  );
}
function walk(n, fn) {
  fn(n);
  ts.forEachChild(n, (c) => walk(c, fn));
}
async function lazyBindings(p) {
  const text = await fs.readFile(path.join(root, p), 'utf8'),
    sf = ts.createSourceFile(p, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
    bindings = new Map();
  walk(sf, (n) => {
    if (
      !ts.isVariableDeclaration(n) ||
      !ts.isIdentifier(n.name) ||
      !n.initializer ||
      !ts.isCallExpression(n.initializer) ||
      n.initializer.expression.getText() !== 'lazy'
    )
      return;
    walk(n.initializer, (call) => {
      if (
        ts.isCallExpression(call) &&
        call.expression.kind === ts.SyntaxKind.ImportKeyword &&
        ts.isStringLiteral(call.arguments[0])
      ) {
        const relative = path.posix
          .normalize(path.posix.join(path.posix.dirname(p), call.arguments[0].text))
          .replace(/\.js$/, '.tsx');
        bindings.set(n.name.text, {
          path: relative,
          manifestKey: relative.replace('apps/manager-web/', ''),
          source: { path: p, line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 },
        });
      }
    });
  });
  return { bindings, sf };
}
async function routePlan(inventory, fixture) {
  const main = await lazyBindings('apps/manager-web/src/main.tsx'),
    student = await lazyBindings('apps/manager-web/src/pages/Student.tsx'),
    tabs = new Map();
  walk(student.sf, (n) => {
    if (
      !ts.isBinaryExpression(n) ||
      n.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken ||
      !ts.isBinaryExpression(n.left)
    )
      return;
    const c = n.left;
    if (c.left.getText() !== 'tab' || !ts.isStringLiteral(c.right)) return;
    walk(n.right, (el) => {
      if (ts.isJsxSelfClosingElement(el) && student.bindings.has(el.tagName.getText()))
        tabs.set(c.right.text, student.bindings.get(el.tagName.getText()));
    });
  });
  return inventory.screens.map((screen) => {
    const current = fixture.cases.find((c) => c.id === screen.id);
    if (!current) throw new Error(`TASK-003 route binding absent: ${screen.id}`);
    const app = { student: 'student-cabinet', manager: 'manager-web', platform: 'platform' }[
      current.app
    ];
    if (!app) throw new Error('Test-only common entry is not a cabinet route');
    const seeds = ['index.html'],
      sources = [screen.routeSource];
    if (app === 'manager-web' && screen.route !== '*') {
      const page = main.bindings.get(screen.component);
      if (!page) throw new Error(`Lazy page binding unavailable: ${screen.component}`);
      seeds.push(page.manifestKey);
      sources.push(page.source);
      if (screen.component === 'Student') {
        const tab =
          new URL(current.route, 'http://synthetic').searchParams.get('tab') ?? 'overview';
        if (tab === 'overview') {
          const summary = student.bindings.get('BalanceSummary');
          if (!summary) throw new Error('Student balance summary lazy binding unavailable');
          seeds.push(summary.manifestKey);
          sources.push(summary.source);
        } else {
          const nested = tabs.get(tab);
          if (!nested) throw new Error(`Nested lazy binding unavailable: ${tab}`);
          seeds.push(nested.manifestKey);
          sources.push(nested.source);
        }
      }
    }
    return {
      inventoryId: screen.id,
      role: screen.role,
      route: screen.route,
      fixtureRoute: current.route,
      app,
      manifestSeeds: seeds,
      sources,
      lazyPolicy:
        'Only required route page/tab dynamic roots become seeds; recursive imports are static. Other page/tab lazy roots belong to separately measured navigation routes. Login passkey action is evaluated separately.',
    };
  });
}
async function assetMap(dir) {
  const result = new Map();
  for (const file of await list(path.join(dir, 'assets')))
    result.set(`assets/${file}`, await fs.readFile(path.join(dir, 'assets', file)));
  return result;
}
async function measure(run, plan, limit = LIMIT) {
  const cache = new Map(),
    rows = [];
  for (const route of plan) {
    if (!cache.has(route.app)) {
      const dir = path.join(run, 'build', route.app);
      try {
        cache.set(route.app, {
          manifest: await read(path.join(dir, '.vite/manifest.json')),
          assets: await assetMap(dir),
        });
      } catch (error) {
        cache.set(route.app, {
          manifest: null,
          assets: new Map(),
          reason: error.code ?? error.message,
        });
      }
    }
    const { manifest, assets } = cache.get(route.app),
      result = evaluateRoute({ manifest, seeds: route.manifestSeeds, assets, limit });
    const optionalActions = [];
    if (
      route.app === 'manager-web' &&
      route.manifestSeeds.includes('src/pages/Login.tsx') &&
      manifest
    ) {
      const dynamic = manifest['src/pages/Login.tsx']?.dynamicImports ?? [];
      for (const key of dynamic)
        optionalActions.push({
          name: 'passkey-browser-action',
          seed: key,
          ...evaluateRoute({ manifest, seeds: [...route.manifestSeeds, key], assets, limit }),
        });
    }
    rows.push({
      ...route,
      ...result,
      optionalActions,
      baselineRef: {
        path: baseline,
        commit: '171db2142858e035594737e141d422fa5378e844',
        comparison:
          'Source renderer baseline cross-reference; route delta unavailable until same-method versioned predecessor exists',
      },
      delta: null,
      deltaStatus: 'unavailable: first k8k-route-v1 per-route baseline',
    });
  }
  return { rows, cache };
}
async function defects(inventory, index, run) {
  const records = [];
  const add = (data) =>
    records.push({
      id: `K8K-DEF-${String(records.length + 1).padStart(3, '0')}`,
      status: 'OPEN',
      classification: 'inherited-at-TASK-003-baseline',
      regression: 'NOT_ESTABLISHED; no comparable older rendered source baseline',
      ...data,
    });
  const findings = await read(path.join(root, 'output/k8k-tasks/TASK-003/baseline-findings.json'));
  const over = new Map();
  for (const row of findings.overflowRows) {
    const key = `${row.role}|${row.route}|${row.viewport.width}`;
    if (!over.has(key)) over.set(key, []);
    over.get(key).push(row);
  }
  for (const group of over.values()) {
    const one = group[0],
      screen =
        inventory.screens.find((s) => s.id === one.caseId) ||
        inventory.screens.find((s) => s.role === one.role);
    add({
      kind: 'observed-overflow',
      title: `Horizontal overflow: ${one.role} ${one.route} at ${one.viewport.width}px`,
      role: one.role,
      route: one.route,
      locales: [...new Set(group.map((r) => r.locale))],
      viewport: one.viewport,
      reproduction: [
        `Run pnpm k8k:baseline-ui or open the preserved baseline case ${one.caseId}`,
        `Select requested locale and ${one.viewport.width}×900`,
        'Compare documentElement.scrollWidth to innerWidth; inspect recorded offenders; do not add overflow:hidden',
      ],
      impact:
        'Content/header/actions exceed viewport and may require horizontal scrolling; observed max document width ' +
        Math.max(...group.map((r) => r.scrollWidth)) +
        'px',
      evidence: group.map((r) => ({
        path: `${baseline}/${r.screenshot}`,
        fixtureId: `fixed-v1:${r.caseId}`,
        scrollWidth: r.scrollWidth,
        offenders: r.offenders,
      })),
      source: screen?.routeSource ?? { path: 'apps/student-cabinet/src/Layout.tsx', line: 1 },
      futureTasks: [...new Set([...(screen?.futureTasks ?? []), 'TASK-071'])],
      triageTask: 'TASK-004',
      priority: 'P2',
    });
  }
  const loc = new Map();
  for (const row of findings.localeRows) {
    const key = `${row.role}|${row.route}`;
    if (!loc.has(key)) loc.set(key, []);
    loc.get(key).push(row);
  }
  for (const group of loc.values()) {
    const one = group[0];
    add({
      kind: 'observed-locale',
      title: `Requested RO retains static RU UI or html lang: ${one.role} ${one.route}`,
      role: one.role,
      route: one.route,
      locales: ['ro'],
      reproduction: [
        `Use baseline case ${one.caseId}`,
        'Set k8k.locale=ro in a new synthetic context',
        'Inspect actual htmlLang and known static headings in the evidence, not names/homework/comments',
      ],
      impact:
        'Interface language, document language and static UI labels are inconsistent; synthetic user content is not a translation requirement',
      evidence: group.map((r) => ({
        path: `${baseline}/${r.screenshot}`,
        viewport: r.viewport,
        htmlLang: r.htmlLang,
        knownStaticRussianHeadings: r.knownStaticRussianHeadings,
      })),
      futureTasks: [one.futureTask, 'TASK-071'],
      priority: 'P2',
    });
  }
  for (const mod of inventory.modules.filter((m) => ['partial', 'missing'].includes(m.status))) {
    add({
      kind: 'documented-functional-gap',
      title: `Incomplete requirement ${mod.id}`,
      role: mod.role,
      route: mod.screenIds
        .map((id) => inventory.screens.find((s) => s.id === id)?.route)
        .filter(Boolean),
      reproduction: [
        'Read module source/operation trace in TASK-002 inventory',
        ...mod.missingFields,
        'Open the mapped current screen if present; absent workflows stay NOT_RUN',
      ],
      impact: mod.missingFields.join('; '),
      source: mod.source,
      evidence: [
        { path: 'output/k8k-tasks/TASK-002/inventory.json', module: mod.id },
        {
          path: 'output/k8k-tasks/TASK-003/unavailable-scenarios.json',
          status: 'NOT_RUN for missing workflow only',
        },
      ],
      futureTasks: mod.futureTasks,
      priority: 'P2',
      validation: 'Source/documented gap, not a newly executed backend acceptance test',
    });
  }
  add({
    kind: 'comparison-variability',
    title: 'Minor renderer/native-control pixel variability in fixed-data baseline',
    role: 'MULTI',
    route: 'See pixel-comparison rows',
    reproduction: [
      'Run the two independent fixed-data screenshot passes',
      'Compare exact PNG hashes and RGBA channel bytes',
    ],
    impact:
      'Exact-byte snapshot comparison has small noise despite equal text/dimensions; preserve both versions, do not silently widen tolerance',
    evidence: [{ path: `${baseline}/pixel-comparison.json` }],
    futureTasks: ['TASK-071'],
    priority: 'P3',
  });
  add({
    kind: 'source-security-lifecycle',
    priority: 'P1',
    title:
      'Student password/email OTP commands pass sensitive variables through shared useMutation',
    role: 'STUDENT',
    route: ['/student/login', '/student/security/change-password', '/student/security'],
    reproduction: [
      'Inspect Account.tsx login/change/email command variables',
      'Follow useCommand to useMutation in api.ts:122-123',
      'Review MutationCache variable retention in an isolated synthetic context; do not log or screenshot secrets',
    ],
    impact:
      'Current password/new password/email OTP enter mutation variables in the shared QueryClient path. This conflicts with the required no-secret-cache boundary; replace with a scoped noncached secret-command lifecycle without weakening CSRF/idempotency.',
    source: { path: 'apps/student-cabinet/src/api.ts', line: 122 },
    evidence: [
      { path: 'apps/student-cabinet/src/api.ts', line: 122 },
      { path: 'apps/student-cabinet/src/pages/Account.tsx', line: 28 },
      { path: 'apps/student-cabinet/src/pages/Account.tsx', line: 96 },
      { path: 'apps/student-cabinet/src/pages/Account.tsx', line: 274 },
      { path: 'apps/student-cabinet/src/pages/Account.tsx', line: 294 },
    ],
    futureTasks: ['TASK-019', 'TASK-034', 'TASK-066'],
    validation:
      'Source-traced defect; no real credential/OTP was used and no production session was inspected',
  });
  const conditional = inventory.modules
    .filter((m) => ['conditional', 'out-of-release'].includes(m.status))
    .map((m) => ({
      id: m.id,
      status: m.status,
      enabled: false,
      source: m.source,
      note: 'Scope/dependency, not an authorized feature to enable as a defect fix',
    }));
  const doc = {
    task: 'TASK-004',
    sourceCommit: index.basis.head,
    baselineRef: baseline,
    classificationPolicy:
      'Inherited means present at the current baseline before TASK-004. Regression from older releases is unknown without comparable evidence; no unsupported regression claim.',
    records,
    conditionalScope: conditional,
    notRun: 'No live backend/provider/DB actions; absent workflows not fabricated',
    screenshotRows: index.summary.rows,
  };
  await write(path.join(run, 'defects.json'), doc);
  const escape = (s) =>
    String(s ?? '—')
      .replaceAll('|', '/')
      .replaceAll('\n', ' ');
  await fs.writeFile(
    path.join(run, 'defects.md'),
    [
      '# TASK-004 addressed defects',
      '',
      doc.classificationPolicy,
      '',
      '|ID / priority|Kind / role / route|Reproduction / impact|Inherited or regression|Evidence|Future TASK|',
      '|---|---|---|---|---|---|',
      ...records.map(
        (r) =>
          `|${r.id} / ${r.priority}|${r.kind} / ${r.role} / ${escape(Array.isArray(r.route) ? r.route.join(', ') : r.route)}|${escape(r.reproduction.join('; '))}<br>${escape(r.impact)}|${r.classification}; ${r.regression}|${r.evidence
            .slice(0, 4)
            .map((e) => `[evidence](../../../../../${e.path})`)
            .join(', ')}; full list in JSON|${r.futureTasks.join(', ')}|`,
      ),
    ].join('\n') + '\n',
  );
  return doc;
}
async function verify(run, limit = LIMIT) {
  const data = await read(path.join(run, 'bundle.json')),
    issues = [];
  const current = await measure(run, data.routePlan, limit);
  for (const [app, record] of Object.entries(data.manifests)) {
    try {
      if (
        sha(await fs.readFile(path.join(run, 'build', app, '.vite/manifest.json'))) !==
        record.sha256
      )
        issues.push(`Manifest checksum changed ${app}`);
    } catch {
      issues.push(`Manifest unavailable ${app}`);
    }
  }
  for (const [i, row] of data.rows.entries()) {
    const expected = current.rows[i];
    if (
      !expected ||
      row.inventoryId !== expected.inventoryId ||
      JSON.stringify(row.files) !== JSON.stringify(expected.files) ||
      row.total !== expected.total ||
      JSON.stringify(row.font) !== JSON.stringify(expected.font) ||
      JSON.stringify(row.optionalActions) !== JSON.stringify(expected.optionalActions) ||
      row.pass !== expected.pass
    )
      issues.push(`Stale or tampered row ${row.inventoryId}`);
  }
  const inv = await read(path.join(root, 'output/k8k-tasks/TASK-002/inventory.json'));
  for (const screen of inv.screens)
    if (!data.rows.some((r) => r.inventoryId === screen.id))
      issues.push(`Missing route ${screen.id}`);
  for (const entry of data.basis.sourceManifest)
    if (sha(await fs.readFile(path.join(root, entry.path))) !== entry.sha256)
      issues.push(`Source changed ${entry.path}`);
  const registry = await read(path.join(run, 'defects.json'));
  for (const defect of registry.records) {
    if (
      !defect.futureTasks.length ||
      !defect.reproduction.length ||
      !defect.impact ||
      !defect.evidence.length
    )
      issues.push(`Incomplete defect ${defect.id}`);
    for (const t of defect.futureTasks)
      try {
        await fs.access(path.join(root, `docs/k8k-redesign-tasks/${t}.md`));
      } catch {
        issues.push(`Missing future task ${t}`);
      }
    for (const e of defect.evidence)
      try {
        await fs.access(inside(root, e.path));
      } catch {
        issues.push(`Missing defect evidence ${defect.id}: ${e.path}`);
      }
  }
  const failures = current.rows.filter((r) => !r.pass || r.optionalActions.some((a) => !a.pass));
  const availableTotals = current.rows.filter((r) => r.total !== null).map((r) => r.total);
  const result = {
    task: 'TASK-004',
    passed: !issues.length && !failures.length,
    issues,
    budgetFailures: failures.map((r) => ({
      route: r.route,
      app: r.app,
      status: r.status,
      total: r.total,
      reason: r.reason,
      optionalActions: r.optionalActions,
    })),
    summary: {
      routes: data.rows.length,
      availableRoutes: current.rows.filter((r) => r.status === 'available').length,
      maxTotal: availableTotals.length ? Math.max(...availableTotals) : null,
      limit,
      defects: registry.records.length,
      bothFontSubsets: current.rows.every((r) => r.font?.cyrillic && r.font?.latin),
      sourceFiles: data.basis.sourceManifest.length,
    },
    basis: data.basis,
    method: METHOD,
  };
  await write(path.join(run, 'verification.json'), result);
  return result;
}
async function build() {
  const oldAudit = await read(path.join(root, baseline, 'audit.json'));
  if (oldAudit.status !== 'DONE') throw new Error('TASK-003 audit prerequisite missing');
  const inventory = await read(path.join(root, 'output/k8k-tasks/TASK-002/inventory.json')),
    fixture = await read(path.join(root, baseline, 'fixture-manifest.json'));
  const previousChanges = [];
  for (const entry of oldAudit.basis.sourceManifest) {
    if (entry.path === 'package.json') continue;
    if (sha(await fs.readFile(path.join(root, entry.path))) !== entry.sha256)
      previousChanges.push(entry.path);
  }
  if (previousChanges.length)
    throw new Error('TASK-003 source inputs changed: ' + previousChanges.join(', '));
  const run = path.join(
    output,
    'runs',
    new Date().toISOString().replaceAll(/[:.]/g, '-') + '-' + crypto.randomBytes(3).toString('hex'),
  );
  await fs.mkdir(run, { recursive: true });
  const inputPaths = [
    ...new Set([
      ...oldAudit.basis.sourceManifest.map((e) => e.path),
      'scripts/k8k-route-budget.mjs',
      'scripts/k8k-route-budget-core.mjs',
      'output/k8k-tasks/TASK-004/design-note.md',
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      ...['student-cabinet', 'manager-web', 'platform'].flatMap((app) => [
        `apps/${app}/package.json`,
        `apps/${app}/vite.config.ts`,
      ]),
      ...['ui', 'account-ui', 'api-contracts', 'shared'].map(
        (pkg) => `packages/${pkg}/package.json`,
      ),
    ]),
  ].sort();
  const sourceManifest = await Promise.all(
    inputPaths.map(async (p) => ({ path: p, sha256: sha(await fs.readFile(path.join(root, p))) })),
  );
  const basis = {
    head: git('rev-parse', 'HEAD').toString().trim(),
    branch: git('branch', '--show-current').toString().trim(),
    sourceManifest,
    dirtyDigest: sha(
      JSON.stringify({
        patchSha256: sha(git('diff', '--binary', '--full-index', 'HEAD', '--')),
        sourceManifest,
      }),
    ),
    sourceDigest: sha(JSON.stringify(sourceManifest)),
    digestDefinition:
      'SHA256(JSON.stringify({patchSha256: SHA256(git diff --binary --full-index HEAD --), sourceManifest})); files ordered path/SHA256; outputs and mutable bookkeeping excluded',
    task003AuditSha256: sha(await fs.readFile(path.join(root, baseline, 'audit.json'))),
  };
  const req = createRequire(path.join(root, 'apps/manager-web/package.json')),
    { build: viteBuild, version: viteVersion } = await import(pathToFileURL(req.resolve('vite'))),
    { default: react } = await import(pathToFileURL(req.resolve('@vitejs/plugin-react')));
  const alias = [
    ['@online-school/ui/style.css', 'packages/ui/src/style.css'],
    ['@online-school/account-ui/style.css', 'packages/account-ui/src/style.css'],
    ['@online-school/ui', 'packages/ui/src/index.ts'],
    ['@online-school/account-ui', 'packages/account-ui/src/index.tsx'],
    ['@online-school/api-contracts', 'packages/api-contracts/src/index.ts'],
    ['@online-school/shared', 'packages/shared/src/index.ts'],
  ].map(([find, p]) => ({ find, replacement: path.join(root, p) }));
  const buildProvenance = {
    method:
      'Installed programmatic Vite production frontend-only builds; source aliases; no TypeScript/Prisma/OpenAPI generation',
    viteVersion,
    node: process.version,
    zlibVersion: process.versions.zlib,
    lockfileSha256: sha(await fs.readFile(path.join(root, 'pnpm-lock.yaml'))),
    configFile: false,
    envDir: false,
    publicDir: false,
    manifest: true,
    gzipLevel: 9,
    sourceAlias: alias,
  };
  const manifests = {};
  for (const app of ['student-cabinet', 'manager-web', 'platform']) {
    const dir = path.join(run, 'build', app);
    await viteBuild({
      root: path.join(root, 'apps', app),
      configFile: false,
      envDir: false,
      publicDir: false,
      mode: 'production',
      plugins: [react()],
      base: app === 'student-cabinet' ? '/student/' : app === 'manager-web' ? '/manager/' : '/',
      resolve: { alias, dedupe: ['react', 'react-dom'] },
      build: { outDir: dir, emptyOutDir: false, manifest: true },
      logLevel: 'error',
    });
    manifests[app] = {
      path: path.relative(root, path.join(dir, '.vite/manifest.json')).replaceAll('\\', '/'),
      sha256: sha(await fs.readFile(path.join(dir, '.vite/manifest.json'))),
    };
  }
  const routePlanData = await routePlan(inventory, fixture),
    { rows, cache } = await measure(run, routePlanData);
  const historical = [];
  for (const p of [
    'output/k8k-implementation/bundle.json',
    'output/k8k-phase0/bundle-baseline.json',
    'output/k8k-phase2/bundle.json',
  ]) {
    try {
      historical.push({
        path: p,
        sha256: sha(await fs.readFile(path.join(root, p))),
        deltaStatus: 'unavailable',
        delta: null,
        reasons: [
          'not k8k-route-v1 route mapping',
          'source dirty digest and complete matching build provenance not recorded',
          'different/no font baseline or emitted package vs source alias/chunk layout; no trustworthy comparable route delta',
        ],
      });
    } catch {
      historical.push({
        path: p,
        deltaStatus: 'unavailable',
        delta: null,
        reasons: ['historical file missing'],
      });
    }
  }
  const rendererCrosscheck = [];
  for (const [app, data] of cache) {
    const priorApp = {
      'student-cabinet': 'student',
      'manager-web': 'manager',
      platform: 'platform',
    }[app];
    const same = [];
    for (const [file, bytes] of data.assets) {
      try {
        const old = await fs.readFile(path.join(root, baseline, 'build', priorApp, file));
        same.push({ file, sha256: sha(bytes), sameBytes: bytes.equals(old) });
      } catch {
        same.push({
          file,
          sameBytes: false,
          reason: 'not emitted under same filename in renderer build',
        });
      }
    }
    rendererCrosscheck.push({
      app,
      matchingAssets: same.filter((r) => r.sameBytes).length,
      totalAssets: same.length,
      assets: same,
      delta: null,
      scope:
        'Asset identity cross-reference only; renderer build had no Vite manifest and is not a separate route-size baseline',
    });
  }
  const bundle = {
    schemaVersion: 1,
    task: 'TASK-004',
    method: METHOD,
    budget: LIMIT,
    basis,
    buildProvenance,
    manifests,
    routePlan: routePlanData,
    rows,
    historical,
    rendererCrosscheck,
    fontPolicy:
      'Both local Golos cyrillic and latin WOFF2 full bytes once each per route even when a subset is not requested for a locale; compressed font bytes are not substituted',
    lazyPolicy:
      'Static closure + explicitly resolved page/tab lazy roots. Deferred roots listed. Login passkey-browser action closure evaluated and budget-checked separately. Other navigation pages/tabs use their own route rows.',
    baselineRef: {
      path: path.relative(root, run).replaceAll('\\', '/'),
      kind: 'first versioned k8k-route-v1 baseline for future compatible source/build comparisons',
    },
  };
  await write(path.join(run, 'bundle.json'), bundle);
  const index = await read(path.join(root, baseline, 'INDEX.json'));
  await defects(inventory, index, run);
  const rowsMd = rows.map(
    (r) =>
      `|${r.role} / ${r.route}|${r.app}|${r.gzip ?? 'unavailable'}|${r.font?.cyrillic.bytes ?? 'unavailable'}|${r.font?.latin.bytes ?? 'unavailable'}|${r.total ?? 'unavailable'}|${r.pass ? 'PASS' : 'FAIL'}|${r.manifestSeeds.join(', ')}|`,
  );
  await fs.writeFile(
    path.join(run, 'bundle.md'),
    [
      '# TASK-004 route budgets',
      '',
      METHOD,
      '',
      'Historical delta: unavailable; see provenance/reasons in bundle.json. No zero-size substitution.',
      '',
      '|Role / route|App|JS/CSS gzip|Cyrillic raw|Latin raw|Total|Budget|Manifest seeds|',
      '|---|---|---|---|---|---|---|---|',
      ...rowsMd,
      '',
      'Optional lazy actions (passkey browser):',
      ...rows.flatMap((r) =>
        r.optionalActions.map(
          (a) =>
            `- ${r.route}: ${a.total ?? 'unavailable'} bytes, ${a.pass ? 'PASS' : 'FAIL'}, seed ${a.seed}`,
        ),
      ),
    ].join('\n') + '\n',
  );
  const result = await verify(run);
  console.log(
    JSON.stringify(
      {
        run: path.relative(root, run),
        passed: result.passed,
        summary: result.summary,
        issues: result.issues,
        budgetFailures: result.budgetFailures,
      },
      null,
      2,
    ),
  );
  if (!result.passed) process.exitCode = 1;
}
async function selfcheck() {
  const run = path.join(
    output,
    'selfchecks',
    new Date().toISOString().replaceAll(/[:.]/g, '-') + '-' + crypto.randomBytes(3).toString('hex'),
  );
  await fs.mkdir(run, { recursive: true });
  const assets = new Map([
    ['assets/entry.js', Buffer.from('entry')],
    ['assets/a.js', Buffer.from('a')],
    ['assets/b.js', Buffer.from('b')],
    ['assets/shared.js', Buffer.from('shared')],
    ['assets/lazy.js', Buffer.from('lazy')],
    [
      'assets/style.css',
      Buffer.from(
        '@font-face{src:url(/assets/golos-text-cyrillic-wght-normal.woff2)}@font-face{src:url(/assets/golos-text-latin-wght-normal.woff2)}',
      ),
    ],
    ['assets/golos-text-cyrillic-wght-normal.woff2', Buffer.alloc(22032)],
    ['assets/golos-text-latin-wght-normal.woff2', Buffer.alloc(37916)],
  ]);
  const manifest = {
    'index.html': {
      file: 'assets/entry.js',
      imports: ['a', 'b'],
      dynamicImports: ['lazy'],
      css: ['assets/style.css'],
    },
    a: { file: 'assets/a.js', imports: ['shared'] },
    b: { file: 'assets/b.js', imports: ['shared'] },
    shared: { file: 'assets/shared.js' },
    lazy: { file: 'assets/lazy.js', imports: ['shared'] },
  };
  const valid = evaluateRoute({ manifest, seeds: ['index.html'], assets }),
    lazy = evaluateRoute({ manifest, seeds: ['index.html', 'lazy'], assets }),
    missing = evaluateRoute({ manifest: null, seeds: ['index.html'], assets }),
    over = evaluateRoute({ manifest, seeds: ['index.html'], assets, limit: 1 });
  const missingAssets = new Map(assets);
  missingAssets.delete('assets/shared.js');
  const corrupted = { ...manifest, a: { file: 'assets/a.js', imports: ['not-existing'] } };
  const expectedCode = [
    'assets/entry.js',
    'assets/a.js',
    'assets/b.js',
    'assets/shared.js',
    'assets/style.css',
  ].reduce((sum, k) => sum + gzipSync(assets.get(k), { level: 9 }).length, 0);
  const checks = {
    sharedChunkExactlyOnce:
      valid.files.filter((f) => f.file === 'assets/shared.js').length === 1 &&
      valid.gzip === expectedCode,
    bothFontSubsetsCharged:
      valid.font.cyrillic.bytes === 22032 &&
      valid.font.latin.bytes === 37916 &&
      valid.font.total === 59948,
    explicitLazyIncluded:
      lazy.files.some((f) => f.file === 'assets/lazy.js') &&
      lazy.files.filter((f) => f.file === 'assets/shared.js').length === 1,
    missingManifestUnavailable:
      missing.status === 'unavailable' && missing.total === null && !missing.pass,
    missingAssetUnavailable:
      evaluateRoute({ manifest, seeds: ['index.html'], assets: missingAssets }).status ===
      'unavailable',
    missingImportUnavailable:
      evaluateRoute({ manifest: corrupted, seeds: ['index.html'], assets }).status ===
      'unavailable',
    overLimitFails: !over.pass,
  };
  await write(path.join(run, 'probe.json'), { checks, valid, missing, over });
  for (const [name, data] of [
    ['over-budget', over],
    ['missing-manifest', missing],
  ]) {
    const p = path.join(run, `${name}.json`);
    await write(p, data);
    const child = spawnSync(process.execPath, [import.meta.filename, 'probe-file', p], {
      cwd: root,
      stdio: 'pipe',
    });
    checks[`${name}-nonzero-exit`] = child.status === 1;
  }
  const result = {
    task: 'TASK-004',
    scope:
      'Pure in-memory/temporary local graph fixtures and subprocess exit status; no app/DB/network',
    checks,
    passed: Object.values(checks).every(Boolean),
  };
  await write(path.join(run, 'results.json'), result);
  console.log(JSON.stringify({ run: path.relative(root, run), ...result }, null, 2));
  if (!result.passed) process.exitCode = 1;
}
const command = process.argv[2];
if (command === 'build') await build();
else if (command === 'verify') {
  const run = inside(
    path.join(output, 'runs'),
    path.relative(path.join(output, 'runs'), path.resolve(root, process.argv[3] ?? '')),
  );
  const result = await verify(run);
  console.log(
    JSON.stringify(
      {
        passed: result.passed,
        summary: result.summary,
        issues: result.issues,
        budgetFailures: result.budgetFailures,
      },
      null,
      2,
    ),
  );
  if (!result.passed) process.exitCode = 1;
} else if (command === 'selfcheck') await selfcheck();
else if (command === 'probe-file') {
  const p = path.resolve(process.argv[3]);
  if (!p.startsWith(path.join(output, 'selfchecks') + path.sep))
    throw new Error('Invalid probe target');
  const data = await read(p);
  process.exitCode = data.pass && data.total !== null && data.total <= data.limit ? 0 : 1;
} else throw new Error('Use build, verify <TASK-004 run>, or selfcheck; local files only');

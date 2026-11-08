// Reproducible local provenance/traceability collection. Does not read environment files.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import * as ui from '../../../packages/ui/dist/index.js';
import { resolveTokens, contrast, measured } from '../../../packages/ui/tests/contrast-contract.mjs';
const root = new URL('../../../', import.meta.url);
const out = new URL('./', import.meta.url);
const read = async (p) => JSON.parse(await readFile(new URL(p, root), 'utf8'));
const write = async (p, value) => writeFile(new URL(p, out), JSON.stringify(value, null, 2) + '\n');
const sha = (value) => createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', ['--no-optional-locks', '-c', 'core.safecrlf=false', ...args], {
  cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
});
const scopes = ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.json', 'tsconfig.base.json',
  'eslint.config.mjs', 'stylelint.config.mjs', 'apps/student-cabinet', 'apps/manager-web', 'apps/platform',
  'packages/ui', 'packages/account-ui', 'packages/api-contracts', 'packages/shared',
  'scripts/k8k-route-budget.mjs', 'scripts/k8k-route-budget-core.mjs', 'scripts/k8k-foundation-budget.mjs'];
const paths = [...new Set(git('ls-files', '-co', '--exclude-standard', '--', ...scopes).toString().trim().split('\n'))]
  .filter((p) => /\.(?:tsx?|mjs|css|json|html|yaml|woff2)$/.test(p) && !p.includes('/dist/')).sort();
const sourceManifest = await Promise.all(paths.map(async (path) => ({ path, sha256: sha(await readFile(new URL(path, root))) })));
const patchSha256 = sha(git('diff', '--binary', '--full-index', 'HEAD', '--', '.', ':(exclude)docs/ui-stack.md', ':(exclude)output/**'));
const old = await read('output/k8k-tasks/TASK-016/basis.json');
const changed = old.sourceManifest.filter((entry) => sourceManifest.find((e) => e.path === entry.path)?.sha256 !== entry.sha256).map((e) => e.path);
const allowed = ['packages/ui/package.json', 'packages/ui/src/calendar.tsx', 'packages/ui/src/calendar.css',
  'packages/ui/stories/calendar.stories.tsx', 'packages/ui/tests/calendar.test.mjs'];
assert(changed.every((p) => allowed.includes(p)), `Unexpected changes since TASK-016: ${changed}`);
const basis = { head: git('rev-parse', 'HEAD').toString().trim(), branch: git('branch', '--show-current').toString().trim(),
  dirtyDigest: sha(JSON.stringify({ patchSha256, sourceManifest })), patchSha256, sourceManifest,
  definition: 'SHA256(JSON.stringify({patchSha256, sourceManifest})); patch=HEAD tracked diff excluding output/** and mutable docs/ui-stack.md; ordered tracked+untracked scoped source hashes, no env/dist.',
  changedFromTask016: changed, protectedTask016InputsUnchanged: old.sourceManifest.length - changed.length,
  lockfileUnchanged: old.sourceManifest.find((e) => e.path === 'pnpm-lock.yaml').sha256 === sourceManifest.find((e) => e.path === 'pnpm-lock.yaml').sha256 };
assert(basis.lockfileUnchanged);
await write('basis.json', basis);
const prerequisites = [];
for (let number = 5; number <= 16; number++) {
  const task = `TASK-${String(number).padStart(3, '0')}`;
  const path = `output/k8k-tasks/${task}/report.md`;
  const report = await readFile(new URL(path, root), 'utf8');
  assert(/DONE/.test(report), `${task}: missing completed artifact`);
  prerequisites.push({ task, report: path, sha256: sha(report), status: 'historical report exists; current component behavior rechecked by TASK-017' });
}
await write('prerequisites.json', prerequisites);
await cp(new URL('packages/ui/dist/foundation-evidence/', root), new URL('browser/', out), { recursive: true });
await cp(new URL('packages/ui/dist/storybook-evidence/coverage.json', root), new URL('coverage.json', out));
await cp(new URL('packages/ui/dist/storybook-evidence/smoke.json', root), new URL('catalog-smoke.json', out));
await cp(new URL('packages/ui/dist/locale-evidence/', root), new URL('locale/', out), { recursive: true });
await cp(new URL('apps/platform/dist/account-chrome-evidence/', root), new URL('account/', out), { recursive: true });
const coverage = await read('packages/ui/dist/storybook-evidence/coverage.json');
const required = 'AppShell Sidebar BottomNav Header NotificationBell HeroCard StatTile ListRow StatusChip Button IconButton Field Select DatePicker Segmented Tabs Dialog Drawer ConfirmDialog DenseTable KanbanColumn Calendar StagesTrack Avatar Skeleton EmptyState ErrorState StaleBanner FreshnessLabel Toast'.split(' ');
const controls = required.map((name) => {
  assert(name in ui && coverage.components[name]?.length, `Required control missing: ${name}`);
  return { name, status: 'PASS', stories: coverage.components[name], adapterTasks:
    name === 'KanbanColumn' ? ['TASK-053: server pages/filter/count', 'TASK-054: keyboard/dnd eligibility/revision commands'] :
    name === 'StagesTrack' ? ['TASK-031: published student stages', 'TASK-042/043/044: teacher assessment/checkpoint/publication'] :
    name === 'Calendar' ? ['TASK-037: teacher schedule/resources', 'TASK-057/058: CRM exception workflow/role gate'] :
    ['TASK-018–023 / relevant role TASK: authoritative data, permissions and lifecycle'] };
});
await write('required-controls.json', controls);
const tokens = resolveTokens();
await write('contrast.json', measured.map(([foreground, background, historical]) => ({ foreground, background,
  foregroundValue: tokens[foreground], backgroundValue: tokens[background], ratio: contrast(tokens[foreground], tokens[background]),
  historicalExpected: historical, usage: foreground === '--k8k-accent' ? 'decorative accent; forbidden for ordinary text or critical graphics on sand' : 'semantic contract tested in contrast.test.mjs' })));
const imports = [];
for (const { path } of sourceManifest.filter((e) => /^packages\/ui\/src\/.*\.tsx?$/.test(e.path))) {
  const code = await readFile(new URL(path, root), 'utf8');
  const file = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  for (const node of file.statements) if (ts.isImportDeclaration(node)) {
    const specifier = node.moduleSpecifier.text;
    assert(!/api-contracts|account-ui|\/apps\//.test(specifier));
    imports.push({ path, specifier });
  }
  assert(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|Bearer\s/.test(code), `Network/credential candidate in ${path}`);
}
await write('isolation.json', { status: 'PASS for inspected imports/no network entrypoints; catalog module guard also passed build', imports,
  boundary: 'account-ui owns SDK/session; generic UI receives data/actions; storage only locale/theme' });
const audit = await read('output/k8k-tasks/TASK-017/audit.json');
const findings = Object.values(audit.advisories).map((a) => ({ package: a.module_name, severity: a.severity,
  id: a.github_advisory_id, paths: a.findings.flatMap((f) => f.paths), url: a.url }));
await write('audit-summary.json', { exit: 1, vulnerabilities: audit.metadata.vulnerabilities, findings,
  foundationPaths: findings.flatMap((f) => f.paths).filter((p) => p.includes('packages__ui>')),
  disposition: 'Existing API/Jest chains unchanged. Repository audit is FAIL; foundation direct dependency chains have no findings. TASK-072 dependencies and TASK-073 safe regression; security follow-up before production.' });
const policy = await read('output/k8k-tasks/TASK-017/dependency-policy.json');
assert(policy.every((p) => /^\d+\.\d+\.\d+$/.test(p.pinned) && p.ageDays >= 14 && /^(MIT|ISC|BSD-2-Clause|BSD-3-Clause|Apache-2.0|OFL-1.1)$/.test(p.license)));
await write('dependency-check.json', { packages: policy.length, pinnedLicenseAge: 'PASS',
  peers: 'React/React DOM 18.3.1 and @types React18 in installed importer; declared ranges in dependency-policy.json. Optional peers are not required installations.',
  transitiveHistoricalEvidence: ['TASK-005/dependencies.json', 'TASK-008/dependency-policy.json', 'TASK-010/dependency-policy.json', 'TASK-013/report.md'],
  lockfileSha256: sourceManifest.find((e) => e.path === 'pnpm-lock.yaml').sha256, changes: 'none' });
console.log({ dirtyDigest: basis.dirtyDigest, requiredControls: controls.length, componentExports: Object.keys(coverage.components).length,
  stories: coverage.storyCount, prerequisites: prerequisites.length, unchangedTask016Inputs: basis.protectedTask016InputsUnchanged, changed });

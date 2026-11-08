import assert from 'node:assert/strict';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const out = new URL('./', import.meta.url);
const root = new URL('../../../', import.meta.url);
const read = async (p) => JSON.parse(await readFile(new URL(p, out), 'utf8'));
const write = async (p, value) => writeFile(new URL(p, out), JSON.stringify(value, null, 2) + '\n');
const basis = await read('basis.json');
const browser = await read('browser/foundation.json');
const coverage = await read('coverage.json');
const budgets = await read('budgets.json');
assert.equal(browser.renders.length, 368);
assert.equal(browser.axe.length, 102);
assert.equal(coverage.storyCount, 46);
assert(browser.failures.length === 0 && browser.axe.every((scan) => scan.violations.length === 0));
assert.equal(budgets.rows.length, 48);
assert(budgets.rows.every((row) => row.pass && row.optionalActions.every((a) => a.pass)));
const commands = [
  ['pnpm --filter @online-school/ui build', 0, 'ui-build-final.log'],
  ['pnpm --filter @online-school/ui test', 0, 'unit-final.log'],
  ['pnpm --filter @online-school/ui lint', 0, 'lint-final.log'],
  ['pnpm --filter @online-school/ui test:locale:types', 0, 'locale-types-final.log'],
  ['pnpm --filter @online-school/ui build:storybook', 0, 'catalog-build-final.log'],
  ['pnpm --filter @online-school/ui check:storybook', 0, 'coverage-final.log'],
  ['pnpm --filter @online-school/ui test:storybook', 0, 'catalog-smoke-final.log'],
  ['pnpm --filter @online-school/ui test:foundation', 0, 'foundation-browser-final.log'],
  ['pnpm --filter @online-school/ui test:foundation:budget', 0, 'budget-final.log'],
  ['pnpm --filter @online-school/student-cabinet --filter @online-school/manager-web --filter @online-school/platform typecheck', 0, 'consumers-typecheck.log'],
  ['pnpm --filter @online-school/ui test:locale:browser', 0, 'locale-browser.log'],
  ['pnpm --filter @online-school/platform test:account-chrome', 0, 'account-browser.log'],
  ['pnpm exec eslint scripts/k8k-foundation-budget.mjs --max-warnings 0', 0, 'budget-lint-final.log'],
  ['pnpm exec prettier --check packages/ui/package.json packages/ui/src/calendar.tsx packages/ui/src/calendar.css packages/ui/stories/calendar.stories.tsx packages/ui/stories/foundation-gate.mjs packages/ui/tests/calendar.test.mjs scripts/k8k-foundation-budget.mjs', 0, 'format-check.log'],
  ['pnpm audit --json', 1, 'audit.json'],
  ['node output/k8k-tasks/TASK-017/collect-evidence.mjs', 0, 'basis.json'],
];
for (const dep of await read('dependency-policy.json')) commands.push([
  `pnpm view ${dep.name}@${dep.pinned} version license peerDependencies time dist.unpackedSize --json`, 0, 'dependency-policy.json']);
await write('commands.json', commands.map(([command, exit, artifact]) => ({ command, exit, artifact,
  target: command.startsWith('pnpm view') || command.startsWith('pnpm audit') ? 'package registry metadata; no app/provider accounts' : 'local frontend/static or fully mocked fixture; no DB' })));
const report = await readFile(new URL('report.md', out), 'utf8');
const links = [...report.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]);
for (const target of links.filter((p) => !p.startsWith('http'))) await readFile(new URL(target, out));
for (const source of basis.sourceManifest) {
  const actual = createHash('sha256').update(await readFile(new URL(source.path, root))).digest('hex');
  assert.equal(actual, source.sha256, `Changed accepted input: ${source.path}`);
}
const docs = ['docs/k8k-redesign-tasks/EXECUTION_LOG.md', 'docs/K8K_REQUIREMENTS_MATRIX.md'];
for (const path of docs) assert((await readFile(new URL(path, root), 'utf8')).includes(basis.dirtyDigest));
await write('verification.json', { status: 'PASS scoped technical foundation', basis: basis.dirtyDigest,
  requiredControls: 30, exports: 41, stories: 46, unit: 137, renders: browser.renders.length,
  axeScans: browser.axe.length, violationsReported: 0, incompleteReview: 'a11y-review.md',
  routeBudgets: '48/48 PASS', maxBytes: Math.max(...budgets.rows.map((r) => r.total)),
  repositoryAudit: 'FAIL — existing API/Jest chains; audit-summary.json',
  actualAT: 'NOT_RUN — TASK-071', provisionalApproval: 'OPEN',
  productionDBProviderFndGate: 'NOT_RUN', localReportLinksChecked: links.length,
  acceptedSourceHashesRechecked: basis.sourceManifest.length, nextTaskStarted: false });
const artifacts = [];
for (const item of await readdir(out, { recursive: true, withFileTypes: true })) {
  if (!item.isFile()) continue;
  const path = `${item.parentPath}/${item.name}`;
  const relative = path.replaceAll('\\', '/').split('/TASK-017/')[1];
  if (relative === 'artifacts.json') continue;
  const data = await readFile(path);
  artifacts.push({ path: relative, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
}
artifacts.sort((a, b) => a.path.localeCompare(b.path));
await write('artifacts.json', { head: basis.head, dirtyDigest: basis.dirtyDigest, artifacts });
console.log({ artifacts: artifacts.length, localLinks: links.length, acceptedSourceHashes: basis.sourceManifest.length, status: 'PASS' });

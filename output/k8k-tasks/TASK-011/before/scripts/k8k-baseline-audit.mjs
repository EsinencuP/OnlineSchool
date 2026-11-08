// Local TASK-003 evidence audit. No browser, provider or DB access.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const root = path.resolve(import.meta.dirname, '..');
const input = process.argv[2];
if (!input) throw new Error('Pass the exact TASK-003 run directory');
const run = path.resolve(root, input),
  allowed = path.resolve(root, 'output/k8k-tasks/TASK-003/runs');
if (!run.startsWith(allowed + path.sep)) throw new Error('Run must be inside TASK-003/runs');
const read = async (p) => JSON.parse(await fs.readFile(p, 'utf8'));
const index = await read(path.join(run, 'INDEX.json'));
const fixtures = await read(path.join(run, 'fixture-manifest.json'));
const inventory = await read(path.join(root, 'output/k8k-tasks/TASK-002/inventory.json'));
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const issues = [];
for (const row of index.rows) {
  if (row.screenshot) {
    const target = path.resolve(run, row.screenshot);
    if (
      !target.startsWith(run + path.sep) ||
      sha(await fs.readFile(target)) !== row.screenshotSha256
    )
      issues.push(`screenshot integrity: ${row.caseId}`);
    if (!row.assertions?.length || !row.evidence) issues.push(`missing assertions: ${row.caseId}`);
  } else if (row.status !== 'NOT_RUN' || !row.reason)
    issues.push(`unexplained missing screenshot: ${row.caseId}`);
}
const coverage = inventory.screens.map((screen) => {
  const rows = index.rows.filter((r) => r.inventoryIds.includes(screen.id));
  const missing = [];
  for (const pass of [1, 2])
    for (const locale of ['ru', 'ro'])
      for (const width of [360, 768, 1024, 1280]) {
        const row = rows.find(
          (r) =>
            r.pass === pass && r.locale === locale && r.viewport.width === width && r.screenshot,
        );
        if (!row) missing.push({ pass, locale, width });
      }
  return {
    screenId: screen.id,
    route: screen.route,
    role: screen.role,
    rows: rows.length,
    status: missing.length ? 'PARTIAL' : 'CAPTURED',
    missing,
  };
});
const stateCoverage = [
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
].map((state) => {
  const rows = index.rows.filter((r) => r.caseId === `common:${state}`);
  return {
    state,
    status:
      rows.length === 16 && rows.every((r) => r.screenshot && r.assertions.every((a) => a.pass))
        ? 'CAPTURED'
        : 'PARTIAL',
    rows: rows.length,
  };
});
const notRun = index.rows.filter((r) => r.status === 'NOT_RUN');
const failures = index.rows.filter((r) => r.assertions?.some((a) => !a.pass));
const sourceChanges = [];
for (const entry of index.basis.sourceManifest)
  if (sha(await fs.readFile(path.join(root, entry.path))) !== entry.sha256)
    sourceChanges.push(entry.path);
const differences = index.comparisons.filter((c) => !c.pngIdentical);
const status =
  issues.length ||
  sourceChanges.length ||
  coverage.some((c) => c.missing.length) ||
  stateCoverage.some((c) => c.status !== 'CAPTURED')
    ? 'PARTIAL'
    : 'DONE';
const result = {
  task: 'TASK-003',
  run: path.relative(root, run).replaceAll('\\', '/'),
  status,
  basis: index.basis,
  artifactIntegrityIssues: issues,
  sourceChanges,
  inventoryCoverage: coverage,
  commonStateCoverage: stateCoverage,
  summary: {
    ...index.summary,
    inventoryScreens: coverage.length,
    completeInventoryScreens: coverage.filter((c) => !c.missing.length).length,
    commonStatesComplete: stateCoverage.filter((c) => c.status === 'CAPTURED').length,
    schemaOperations: Object.keys(index.schemaFindings).length,
    schemaInvalidOperations: Object.entries(index.schemaFindings)
      .filter(([, errors]) => errors.length)
      .map(([op]) => op),
    networkSentinels: index.networkChecks.length,
    networkSentinelsAborted: index.networkChecks.filter((c) => c.sentinelAborted).length,
    semanticComparisonPairs: index.comparisons.filter((c) => c.semanticTextIdentical).length,
  },
  notRun: notRun.map(({ caseId, locale, viewport, reason }) => ({
    caseId,
    locale,
    viewport,
    reason,
  })),
  assertionFailures: failures.map(({ caseId, locale, viewport, assertions, screenshot }) => ({
    caseId,
    locale,
    viewport,
    screenshot,
    failed: assertions.filter((a) => !a.pass).map((a) => a.name),
  })),
  differences,
  unavailable: fixtures.unavailable,
  interpretation:
    'DONE means a complete current-view baseline with explicitly recorded product defects; it is not UI/domain/security/release acceptance. NOT_RUN product scenarios remain unavailable.',
};
await fs.writeFile(path.join(run, 'audit.json'), JSON.stringify(result, null, 2) + '\n');
const escape = (s) =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
const html = `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>TASK-003 baseline</title><style>body{font:16px system-ui;margin:24px;color:#222;background:#f9f7f5}label{display:block;margin:16px 0}input{padding:12px;width:min(90%,600px)}table{border-collapse:collapse;width:100%}th,td{text-align:left;border-bottom:1px solid #888;padding:12px;vertical-align:top}a{color:#00566d}thead{position:sticky;top:0;background:white}</style><h1>TASK-003 baseline</h1><p>${escape(result.run)}</p><p>${escape(JSON.stringify(result.summary))}</p><p>Текущий вид, синтетические данные. Дефекты не являются PASS приёмки.</p><label>Фильтр по роли, маршруту, состоянию или языку <input id="search" type="search"></label><table><thead><tr><th>Сценарий</th><th>Проход / язык / ширина</th><th>Снимок и результат</th></tr></thead><tbody>${index.rows.map((r) => `<tr><td>${escape(r.role)}<br>${escape(r.caseId)}<br>${escape(r.route)}</td><td>${r.pass} / ${r.locale} / ${r.viewport.width}</td><td>${r.screenshot ? `<a href="${escape(r.screenshot)}">PNG</a>` : 'NOT_RUN'}<br>${escape(r.status)}${r.evidence?.overflow ? ' — overflow' : ''}${r.reason ? `<br>${escape(r.reason)}` : ''}</td></tr>`).join('')}</tbody></table><script>document.getElementById('search').addEventListener('input',e=>{const q=e.target.value.toLowerCase();for(const r of document.querySelectorAll('tbody tr'))r.hidden=!r.textContent.toLowerCase().includes(q)})</script></html>`;
await fs.writeFile(path.join(run, 'gallery.html'), html);
console.log(
  JSON.stringify(
    {
      status,
      run: result.run,
      summary: result.summary,
      artifactIntegrityIssues: issues,
      sourceChanges,
    },
    null,
    2,
  ),
);
if (status !== 'DONE') process.exitCode = 1;

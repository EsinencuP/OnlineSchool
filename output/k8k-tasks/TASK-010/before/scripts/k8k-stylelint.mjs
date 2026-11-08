// Local CSS only. No environment, app, network, database or provider access.
import stylelint from 'stylelint';
import config from '../stylelint.config.mjs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const roots = [
  'packages/ui',
  'packages/account-ui/src',
  'apps/student-cabinet/src',
  'apps/manager-web/src',
  'apps/platform/src',
];
async function cssFiles(dir) {
  const files = [];
  for (const item of await readdir(path.join(root, dir), { withFileTypes: true })) {
    if (['node_modules', 'dist'].includes(item.name)) continue;
    const name = `${dir}/${item.name}`;
    if (item.isDirectory()) files.push(...(await cssFiles(name)));
    else if (name.endsWith('.css')) files.push(name);
  }
  return files;
}
export async function lintCss() {
  const files = (await Promise.all(roots.map(cssFiles))).flat().sort();
  const result = await stylelint.lint({
    files: files.map((p) => path.join(root, p)),
    config,
    ignoreDisables: true,
  });
  const findings = result.results.flatMap((r) =>
    r.warnings.map((w) => ({
      file: path.relative(root, r.source).replaceAll('\\', '/'),
      rule: w.rule,
      text: w.text,
      line: w.line,
    })),
  );
  return { files, findings };
}
export function compareBaseline(findings, entries) {
  const key = (e) => JSON.stringify([e.file, e.rule, e.text]);
  const remaining = new Map(entries.map((e) => [key(e), e]));
  if (remaining.size !== entries.length) throw new Error('Duplicate baseline entries');
  const unexpected = [];
  for (const e of entries) {
    if (e.file.startsWith('packages/ui/') || !/^TASK-\d{3}$/.test(e.removeInTask))
      throw new Error('UI cannot be allowlisted; every legacy declaration needs a removal TASK');
  }
  for (const finding of findings) {
    const match = remaining.get(key(finding));
    if (match) remaining.delete(key(finding));
    else unexpected.push(finding);
  }
  return { unexpected, stale: [...remaining.values()] };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { files, findings } = await lintCss();
  const baseline = JSON.parse(
    await readFile(path.join(root, 'packages/ui/tests/stylelint-legacy.json'), 'utf8'),
  );
  for (const item of baseline.entries)
    await readFile(path.join(root, `docs/k8k-redesign-tasks/${item.removeInTask}.md`));
  const comparison = compareBaseline(findings, baseline.entries);
  console.log(
    JSON.stringify(
      { files: files.length, legacyDeclarations: baseline.entries.length, ...comparison },
      null,
      2,
    ),
  );
  if (comparison.unexpected.length || comparison.stale.length) process.exitCode = 1;
}

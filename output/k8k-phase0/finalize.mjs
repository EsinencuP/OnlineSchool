// Verify audit artifacts and product preservation; does not compile or mutate product code.
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const dir = resolve('output/k8k-phase0');
const parse = async (name) => JSON.parse(await readFile(resolve(dir, name), 'utf8'));
const hash = (b) => createHash('sha256').update(b).digest('hex');
const baseline = await parse('baseline.json');
const inventory = await parse('screen-inventory.json');
const result = await parse('screenshots.json');
const differences = [];
for (const file of baseline.workingTreeAtStart) {
  if (hash(await readFile(file.file)) !== file.sha256) differences.push(file.file);
}
assert.deepEqual(differences, [], 'Product source changed during phase 0');
execFileSync('git', [
  'diff',
  '--quiet',
  baseline.source,
  '--',
  'packages/api-contracts/src',
  'packages/shared/src',
]);
const pairs = new Map();
for (const shot of result.screens) {
  const key = `${shot.id}:${shot.width}`;
  assert.ok(!pairs.has(key), `Duplicate evidence ${key}`);
  pairs.set(key, shot);
  assert.ok(['captured', 'not-applicable'].includes(shot.status), `Missing ${key}`);
  if (shot.status === 'captured') {
    const buffer = await readFile(resolve(dir, shot.file));
    assert.equal(hash(buffer), shot.sha256, `Changed PNG ${shot.file}`);
    assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(shot.dom.k8k, null, `Preview theme leaked: ${key}`);
    shot.png = { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  } else {
    assert.equal(shot.id, 'stu-navigation-drawer');
    assert.ok([1024, 1280].includes(shot.width));
  }
}
for (const screen of inventory)
  for (const width of screen.widths)
    assert.ok(pairs.has(`${screen.id}:${width}`), `Missing pair ${screen.id}/${width}`);
assert.equal(result.errors.length, 0);
await writeFile(resolve(dir, 'screenshots.json'), JSON.stringify(result, null, 2) + '\n');
const preservation = {
  source: baseline.source,
  comparedProductFiles: baseline.workingTreeAtStart.length,
  productDifferences: differences,
  sdkSharedSourceMatchesMain: true,
  screens: inventory.length,
  requiredPositions: inventory.length * 4,
  captured: result.screens.filter((s) => s.status === 'captured').length,
  notApplicable: result.screens.filter((s) => s.status === 'not-applicable').length,
  overflowPositions: result.screens
    .filter((s) => s.dom?.overflow)
    .map((s) => ({ id: s.id, width: s.width, png: s.png })),
  authority:
    'Visual/source audit only; no backend integration, financial operations or production GO.',
};
await writeFile(resolve(dir, 'preservation.json'), JSON.stringify(preservation, null, 2) + '\n');
let index = `# K8K — полная матрица «до»\n\nИсходный main: \`${baseline.source}\`. 100 состояний, четыре ширины, 398 PNG. Только синтетические источники; не production.\n\nСнимки fullPage: при существующем overflow фактическая ширина PNG может превышать viewport; дефект не обрезан. Время/данные test fixtures динамические. SDK/shared взяты из неизменённой компиляции; account-ui — из pinned source.\n\n| ID | Роль / вид | Маршрут | 360 | 768 | 1024 | 1280 |\n|---|---|---|---|---|---|---|\n`;
for (const screen of inventory) {
  const links = [360, 768, 1024, 1280].map((w) => {
    const s = pairs.get(`${screen.id}:${w}`);
    return s.status === 'captured'
      ? `[${w}${s.dom.overflow ? ' ⚠ overflow' : ''}](${s.file})`
      : 'N/A — desktop sidebar';
  });
  index += `| ${screen.id} | ${screen.role} / ${screen.kind} | \`${screen.url}\` | ${links.join(' | ')} |\n`;
}
index +=
  '\n## Повтор\n\n1. Из корня готового workspace: `node output/k8k-phase0/reproduce.mjs --build`. SDK/shared dist должны существовать и их исходник совпадать с pinned main; helper не генерирует контракты. Все файлы экспорта/сборок идут в `.codex/`.\n2. Отдельно запустить `pnpm --filter @online-school/manager-web exec vite --config D:/OnlineSchool/.codex/k8k-phase0-manager-web.vite.mjs --mode mock` (путь заменить на абсолютный путь своего workspace). Порты 55173/55174/55175 для capture должны быть свободны.\n3. `node output/k8k-phase0/capture.mjs`; частичный повтор — ID состояния или роль. `--pending` заполняет только неполные состояния.\n4. `node output/k8k-phase0/finalize.mjs`. Исходные before-хеши продукта отражают первую рабочую сессию, поэтому для нового клона проверку сохранности нужно фиксировать отдельным manifest; не переписывать историческое evidence.\n\n`stu-snapshot` использует явно синтетический DTO опубликованного среза; исходный test fixture отдавал пустой список. Экран выдачи пароля использует исключительно публичный MSW test-secret. Демо-каталог — публичные фиксированные тестовые аккаунты проекта, а не созданные аудитом пользователи. Никакие реальные switch-user/финансовые/внешние действия не выполняются.\n';
await writeFile(resolve(dir, 'INDEX.md'), index);
console.log(
  `Phase 0: ${inventory.length} states, ${preservation.captured} verified PNG, ${preservation.notApplicable} N/A; ${preservation.comparedProductFiles} product files unchanged; ${preservation.overflowPositions.length} original overflow positions documented.`,
);

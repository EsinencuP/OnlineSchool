import assert from 'node:assert/strict';
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const out = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(out, '../../..');
const read = async (name) => JSON.parse(await readFile(path.join(out, name), 'utf8'));
const write = (name, value) =>
  writeFile(path.join(out, name), JSON.stringify(value, null, 2) + '\n');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const rel = (name) => path.relative(root, name).replaceAll('\\', '/');
const summary = await read('summary.json');
const basis = await read('basis.json');
const audit = await read('source-audit.json');
assert.equal(audit.productSourceChanges.length, 0);
const screens = await read('screenshots.json');
assert.equal(new Set(screens.map((s) => s.evidence)).size, 597);
const initialRun = 'output/k8k-taskpack/task-035/runs/2026-11-08T10-45-10.781Z';
const initial = (await readFile(path.join(root, initialRun, 'screenshots.jsonl'), 'utf8'))
  .trim()
  .split('\n')
  .map(JSON.parse);
const screenKey = (s) =>
  `${s.test}|${s.route}|${s.locale}|${s.viewport.width}|${s.evidence.split('/evidence/')[1] ?? path.basename(s.evidence)}`;
const finalByKey = new Map(screens.map((s) => [screenKey(s), s]));
const pairs = [];
for (const before of initial) {
  const after = finalByKey.get(screenKey(before));
  if (!after) continue;
  const beforePath = path.resolve(root, 'apps/student-cabinet', before.evidence);
  pairs.push({
    test: before.test,
    route: before.route,
    locale: before.locale,
    viewport: before.viewport,
    before: rel(beforePath),
    after: after.evidence,
    beforeSha256: sha(await readFile(beforePath)),
    afterSha256: sha(await readFile(path.join(root, after.evidence))),
  });
}
await write('baseline-comparison.json', {
  baselineRun: initialRun,
  finalRuns: [summary.coreRun, summary.extraRun],
  pairs: pairs.length,
  method:
    'Same test/route/locale/width/fixture-file. Initial run is partial (113 pass, 6 obsolete expectations failed). No product source changed; these are before/after acceptance observations, not a redesign pixel-diff verdict. Dynamic freshness timestamps and screenshot timing can differ. TASK-034 images are historical provenance only.',
  comparisons: pairs,
});

const changed = [
  ...new Set([
    ...(await read('changed-files.json')),
    'scripts/k8k-student-gate-locale.mjs',
    'scripts/k8k-student-gate-report.mjs',
    'apps/student-cabinet/playwright.student-gate-axe.config.mjs',
    'apps/student-cabinet/tests/student-gate-extra.acceptance.mjs',
    'docs/K8K_IMPLEMENTATION_STATUS.md',
    'docs/K8K_REQUIREMENTS_MATRIX.md',
    'docs/k8k-redesign-tasks/EXECUTION_LOG.md',
  ]),
].sort();
await write('changed-files.json', changed);
const beforeByPath = new Map(basis.files.map((f) => [f.path, f]));
await write('final-source-manifest.json', {
  taskId: 'TASK-035',
  head: basis.head,
  branch: basis.branch,
  basisDirtyDigest: basis.dirtyDigest,
  contractsVerified: audit.contractsVerified,
  scope:
    'Explicit TASK-035 own changes only; other pre-existing dirty/untracked work remains outside this delta.',
  files: await Promise.all(
    changed.map(async (file) => ({
      path: file,
      before: beforeByPath.get(file)?.sha256 ?? null,
      after: sha(await readFile(path.join(root, file))),
    })),
  ),
});
const prefix = '../../k8k-taskpack/task-035/';
const core = prefix + summary.coreRun.split('/task-035/')[1] + '/';
const extra = prefix + summary.extraRun.split('/task-035/')[1] + '/';
const report = `# TASK-035 — приёмочный gate ученического кабинета

TASK: TASK-035  
Статус: **DONE — процедура приёмки завершена**  
Решение: **локальный функциональный / визуальный gate PASS; student rollout NO-GO**  
Дата: 08.11.2026. Production GO, FND-GATE и автоматический rollout не объявлены.

## Основа и сохранение работы

HEAD: \`${basis.head}\`, ветка \`${basis.branch}\`.
Исходный dirty digest: \`${basis.dirtyDigest}\`.
Метод digest и SHA manifest: [basis.json](${prefix}basis.json), статус до задачи:
[status-before.txt](${prefix}status-before.txt). Основа — текущие исходники вместе
с dirty/untracked изменениями, а не чистый HEAD. 214 ограниченно выбранных исходных
файлов сохранены побайтно в before-source; все копии перепроверены.
Полного backup архивов, ignored/secret файлов и всего репозитория этот снимок не обещает.
Чужие изменения, предыдущие outputs и ветка сохранены; reset/clean/commit/push/merge/deploy
не выполнялись. [Собственный delta](${prefix}final-source-manifest.json),
[аудит сохранности](${prefix}source-audit.json), [финальный status](${prefix}status-after.txt).

## Что уже существовало

TASK-024…034 уже содержали API/SDK и потребителей: предметные права и хаб,
абонемент/контакты менеджера, server-authoritative Meet, календарь/историю/формы,
надёжный редактор ДЗ, навыки/срез4/опубликованный отчёт8/PDF, bell, материалы,
профиль и безопасность RU/RO. Исходный \`ui.k8k\` rollback сохранён.
Предыдущие локальные acceptance и SHA отчётов проверены как prerequisites:
[prerequisites.json](${prefix}prerequisites.json). Их старые цифры не выдаются за новый прогон.
Обязательные сценарии заново исполнены на текущем коде; SQL и providers остались внешней границей.

## Что изменено

| Путь | Поведение / причина |
| --- | --- |
| scripts/k8k-student-gate.mjs и k8k-student-gate-network.mjs | Единый targeted runner: прямой tsc без generation hooks, mocks, lint/design, source build, budgets и browser; санитарный env, блокировка внешней сети и реальных service ports |
| apps/student-cabinet/playwright.student-gate*.config.mjs, tests/gate-fixtures.mjs | Отдельные timestamp outputs под TASK-035, loopback fixture, блок внешних browser requests, без trace/video, маски password/OTP на снимках |
| tests/student-gate.acceptance.mjs, student-gate-extra.acceptance.mjs | Полный путь, RU/RO×4 ширины, состояния, axe, keyboard/reflow/reduced-motion; настоящий переход к report на странице3 |
| 12 текущих tests/*.spec.mjs | Подключён условный evidence helper, исторические outputs не перезаписываются; актуализированы уже изменённые login copy, Radix Drawer, query-preserving redirect, alertdialog/focus и server-scoped historical subject behavior |
| tests/fixture-server.mjs | Test-only subjectName override для согласованной active Math / frozen English fixture; обычный default прежний |
| scripts/k8k-student-gate-locale.mjs, k8k-student-gate-report.mjs | Измерение реальных запросов RU→RO и проверяемая сборка acceptance/coverage по успешным новым artifacts |
| apps/student-cabinet/package.json | Добавлены безопасные test:k8k-student-gate, :accessibility, :locale, :report до их запуска |
| docs/K8K_IMPLEMENTATION_STATUS.md, K8K_REQUIREMENTS_MATRIX.md, k8k-redesign-tasks/EXECUTION_LOG.md | Зафиксированы local PASS, rollout NO-GO и конкретные внешние условия |

Product source не менялся. Уточнения тестов не скрывают product defect:
alertdialog действительно защищает dirty editor; failed-save/retry/draft retention проверены;
query ui.k8k сохраняется redirect; historical subject разрешено отправить только в scoped
skills/snapshots GET для авторитетного решения сервера, чужие данные остаются скрыты;
report page3 использует фактический pageSize10, а не ошибочное предположение20.

## Контракты, SDK и решения

149 OpenAPI operations сохранены, из них 48 student/auth boundary в инвентаре.
Новых DTO, operations, зависимостей и миграций нет; 46 contract/migration SHA,
включая 31 migration, совпали. SDK вручную не правился, генерация/миграция/seed
не запускались, рабочая БД не использовалась.
[API inventory](${prefix}api-inventory.json), [checksums](${prefix}contracts-before.json).

Применены TASK-035 §§3/5/6 и актуальные K8K plan/matrix/design §§5–7,
VIS12 STU-01…07/V12-AT-01…04,08,10…12; специальные CON-02/B,03/A,04/A,08/B,10/B,11/A
и owner decisions имеют приоритет над историческими источниками. Meet scope REL-01/A
сохранён. Право, календарь, факт, деньги и director decisions не смешиваются;
из приёмки не следует новое бизнес-решение. Последние owner visual/motion правила
из UI_VISUAL_SIMPLIFICATION_2026_11_08.md и UI_MOTION_2026_11_08.md сохранены.

## Свежие проверки и команды

Все команды запускались из D:/OnlineSchool; точные child argv, cwd, exit и duration
сохранены в [main commands](${core}commands.json) и
[extra commands](${extra}commands.json). Главный прогон:
\`pnpm --filter @online-school/student-cabinet test:k8k-student-gate\` → exit0.
Дополнительный: \`pnpm --filter @online-school/student-cabinet test:k8k-student-gate:accessibility\` → exit0.
Runner теперь воспроизводит оба browser блока последовательным default all.

| Проверка | Результат / exit | Evidence |
| --- | --- | --- |
| Прямой tsc -b UI/account/contracts/student/API/worker | PASS / 0 | [compile.log](${core}compile.log) |
| ESLint student; финальный ESLint всех новых scripts и student | PASS / 0, warnings0 | [student-lint.log](${core}student-lint.log), [final checks](${prefix}final-checks.json) |
| Presentation + locale node tests | PASS / 0, 14 | [presentation.log](${core}presentation.log) |
| Design/contrast/raw-style policy | PASS / 0, 77 tests, 25 pairs | [design.log](${core}design.log) |
| Student unit/HTTP/SDK/worker mocks | PASS / 0, 680 tests, 29 suites | [api-results.json](${core}api-results.json) |
| Source Vite build и route budget | PASS / 0, 17/17 | [budgets.json](${extra}budgets.json) |
| Главный Chromium gate | PASS / 0, 178, skipped0/flaky0 | [playwright.json](${core}playwright.json) |
| Дополнительные composed-state axe + report page3 | PASS / 0, 22 | [playwright-accessibility.json](${extra}playwright-accessibility.json) |
| RU→RO asset requests | PASS / 0 | [locale-impact.json](${prefix}locale-impact.json) |
| Playwright MCP, текущая compiled source fixture RO/360 | PASS: menu/Escape/focus, bell focus после exit, overflow0 | [MCP results](${prefix}mcp-results.json) |
| Генерация приёмки с assertions о текущих источниках/contracts/evidence | PASS / 0 | [acceptance.json](${prefix}acceptance.json), [final checks](${prefix}final-checks.json) |

Бюджет: JS/CSS per-file gzip level9 **192490** + все необходимые raw WOFF2
**63492** = **255982 / 256000 bytes**. Измерен static/lazy closure по общему k8k-route-v2;
student monolithic closure одинаков для17 route patterns. Запас только18 bytes —
следующее изменение JS/CSS обязано снова пройти бюджет. RU→RO не добавляет JS/CSS;
дополнительный Romanian WOFF2 3544 bytes уже включён в общий font total.
Stylelint:20 CSS,231 точных legacy declarations, unexpected0/stale0; allowlist не расширен.

## Сценарии, визуальные доказательства и сравнение

Полный auth/forced-password→предметы→Meet→draft/upload/submit/revision→skills/snapshot/report/PDF
→subscription/help→switch/logout исполнен в безопасной fixture.
Проверены own/foreign/malformed ID, 401/402/403, active+frozen/expired/limited,
0/null/history, exact Meet/24h/720h границы, CSRF/idempotency/replay/unknown,
late actor responses, session/file revocation, provider errors как mock outcomes.
Переход в Meet не пишет attendance/ledger; read notification не выполняет команду цели.
Report page3 открыт из25-го отчёта с pageSize10 и возвратом на ту же страницу RU/RO.
Трассировка source→право→действие→состояния→test names:
[DASH-STU-01…07](${prefix}coverage.md), [browser cases](${prefix}browser-cases.json).

597 уникальных автоматических PNG и один отдельный MCP PNG; у каждого в
[screenshots.json](${prefix}screenshots.json) записаны route, role, locale, viewport,
fixture/test, state и путь. Новая TASK-035 матрица:19 ready surfaces×2×4 =152,
7 critical states×2×4 =56, pending/unknown×2×4 =16, два zoom =226 снимков;
дополнительно20 composed-state axe screenshots и свежие inherited feature suites.
58 выделенных axe scenes (38 ready +20 состояния), violations0.
Keyboard/skip/Escape/focus return, длинные имена100/filenames, reduced-motion прошли;
MCP подтвердил фактический focus после160ms exit, entrance Drawer200ms.
Reflow200% эмулирован640 CSS px /1280 device px с DPR2 в1280×900 физической области;
это не физическая AT/browser signoff.

Before observations — первый частичный TASK-035 run10:45; after — финальные11:01/11:09.
Сопоставлено **${pairs.length}** пар по test/route/locale/width/fixture-file:
[baseline-comparison.json](${prefix}baseline-comparison.json). Scope baseline меньше
полной новой матрицы. Product source между ними одинаков; сравнение не выдаётся за
редизайн или pixel-identical verdict (freshness/time могут отличаться).
Первые неудачные итерации (lint/import, устаревшие ожидания, два fixture assumptions)
сохранены в runs и не входят в PASS totals. Последние успешные runs не перезаписывают их.
Ручной просмотр текущих RU-home360, RO-editor360, RO-error360, RU-zoom и MCP-RO360
не выявил blocking overflow или недоступного основного действия.

## Acceptance checklist

| Критерий | Статус | Граница |
| --- | --- | --- |
| DASH-STU-01…07 source и основной/отрицательный путь | PASS | mocks/current source, detailed module evidence |
| TASK-024…034 prerequisites и текущие consumers | PASS локально | внешние условия отдельно ниже |
| Student routes, RU/RO,360/768/1024/1280, critical states | PASS | fixture Chromium |
| Воспроизводимые targeted unit/HTTP/SDK/presentation scripts | PASS | без recursive/all-role gate |
| Budget≤250KiB,25 contrasts, local axe/keyboard/reflow | PASS | физический WCAG AA signoff NOT_RUN |
| Источники/чужая работа/contracts сохранены, secrets не используются | PASS в scope |214 source copies/46 checksums; synthetic accounts, no .env/provider/DB |
| Нет fake API success/прав или автоматического rollout | PASS | fixture outcomes явно обозначены |
| Внешняя интеграционная готовность / student rollout | NOT_RUN / NO-GO | условия и owners ниже |

## Не проверено, блокеры и передача

| Внешний gate | Статус / условие | Owner / следующий TASK |
| --- | --- | --- |
| Рабочая PostgreSQL/schema, SQL/triggers/locks/immutable ledger/replay | NOT_RUN: нужна разрешённая безопасная среда/проверка; main не трогать. TASK-027 official-phone migration/настройка перед rollout | release/DB, TASK-074/075 |
| S3/CORS/private URL expiry/revocation и PDF worker delivery | NOT_RUN: нужны реальные storage/worker credentials и разрешённый integration run | TASK-074/075 |
| Email/OTP, cookies/rotation/revoke, межвкладочная смена настоящей сессии | NOT_RUN: fixtures не доказывают provider/secure-cookie integration | TASK-066/067/069 |
| Expanded Meet POC/OAuth/security/QA/G4 | NOT_RUN: локальный URL-переход не provider acceptance | REL-01/A, TASK-074 |
| Teacher publication producer4/8 | NOT_RUN: нужен реальный assessment/publish workflow; student read не создаёт публикацию | TASK-042/043/044 |
| Физические устройства/AT/screen reader/поддерживаемые браузеры | NOT_RUN: текущие Chromium/эмуляция не полная WCAG2.2AA приёмка | TASK-071 |
| Provisional visual tokens/типографика и owner signoff | NOT_RUN: предъявлены снимки, владельческий акт не заменён тестом | owner, VIS-13…17 |
| Foundation/legal/финансовая методика/release | NOT_RUN: самостоятельные критерии не проверялись и не закрыты | MVP-IMPL-02, LEGAL-01, FIN-LEGAL-01, TASK-074/075 |

Передаваемые interfaces — существующие operationIds в api-inventory, current
contract checksums, scoped state fixtures и воспроизводимые package scripts.
Реальных private URLs, credentials, student PII или provider delivery artifacts нет;
в outputs только synthetic test data/local paths, password/OTP screenshots masked,
trace/video выключены. Производственные capabilities не запрашивались.
Отдельные historical source backups содержат test literals, не живые credentials.

## Риски и обратимость

Минимальный запас bundle18 bytes и зависимость от внешних gates остаются явными рисками.
NO-GO не разрешает включить rollout; кодlegacy/featureflag не удалён.
Откатить можно только own paths из final-source-manifest: для существовавших файлов
использовать проверенные byte copies before-source, для новых — после сверки текущего
SHA восстановить локально собственный delta. Не применять общий git checkout/reset
к уже dirty дереву. Историю runs/старые outputs и чужие файлы сохранять.
Задача остановлена после TASK-035; TASK-036 не начат.
`;
await writeFile(path.join(out, 'report.md'), report);
const canonical = path.join(root, 'output/k8k-tasks/TASK-035');
await mkdir(canonical, { recursive: true });
await writeFile(path.join(canonical, 'report.md'), report);
await writeFile(
  path.join(canonical, 'coverage.md'),
  `# TASK-035\n\n[Трассировка](${prefix}coverage.md) · [Приёмка](${prefix}acceptance.json) · [Отчёт](report.md)\n`,
);
const status = spawnSync('git', ['status', '--porcelain=v1'], { cwd: root, encoding: 'utf8' });
assert.equal(status.status, 0);
await writeFile(path.join(out, 'status-after.txt'), status.stdout);
const artifacts = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(absolute);
    else if (entry.name !== 'artifact-manifest.json') {
      const bytes = await readFile(absolute);
      artifacts.push({ path: rel(absolute), bytes: bytes.length, sha256: sha(bytes) });
    }
  }
}
await walk(out);
await walk(canonical);
await write('artifact-manifest.json', {
  taskId: 'TASK-035',
  files: artifacts.sort((a, b) => a.path.localeCompare(b.path)),
});
console.log({
  reports: 2,
  pairedBeforeAfter: pairs.length,
  sourceChanges: changed.length,
  artifacts: artifacts.length,
});

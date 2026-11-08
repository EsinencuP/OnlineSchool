# TASK-031 — карта навыков, срез4 и отчёт8

TASK: TASK-031  
Статус: DONE в локальном объёме задания  
Дата: 08.11.2026

## Основа и сохранение работы

HEAD `60e2a0c47cbcc744dc658a85f386833146e836b3`, ветка `feat/k8k-design`.
Исходный status — 431 dirty/untracked records (включая каталог evidence этого TASK);
SHA256 `8a81d8dca255447507daf97667a44b7b8010a2c72162fb10806d061c42b85d02`.
[before.json](before.json), [status-before.txt](status-before.txt) и 28 побайтовых
копий в `before/` фиксируют основу. [preservation.json](preservation.json)
подтверждает исходные HEAD/ветку, все исходные пути, 28 snapshots и неизменность
31 migration checksum. Необходимые изменения наложены поверх существующего dirty
кода; reset/clean/commit/merge/push/deploy не выполнялись.

Зависимость TASK-030 подтверждена фактическими report/acceptance/artifacts-check
предыдущего TASK и текущим исходником. Старые test counts не считались новым прогоном.

## Что уже существовало

Четыре enum SkillDto: NOT_STUDIED/FAMILIARIZING/PRACTICING/APPLYING, read-only
SkillMap, SkillAuditResponseDto, server goals, SkillSnapshotResponseDto и отдельный
Reports route. Backend уже читал собственную историю через все enrollments,
отбирал confirmed CONDUCTED и хранил frozen names/public comments в snapshot.
Student GET не создавал assessment/checkpoint/report/reminder.

Пробелы: RU-only подписи/даты/история, отсутствие контекста author/catalog date,
локальное состояние части фильтров, скрытая scoped history срезов, выбор первого
предмета на главной и длинный каталог последнего snapshot. Сохранён исходный
тест `all cabinet pages fit a narrow viewport and expose the four skill states`:
он прошёл до изменений — [baseline.log](baseline.log) — и входит без изменения
ожиданий в итоговые 10. Baseline API counts из старого README исторические.

[Design note](design-note.md) записана до реализации: exact DTO/pipe/query names,
UI components, состояния и границы. Реализация использует StagesTrack как общую
легенду без status props; текущий статус каждой карточки показывает SkillStatus.
Это не дублирует весь трек на каждом навыке и сохраняет исходный four-state test.

## Что изменено

| Путь | Поведение / причина |
| --- | --- |
| apps/student-cabinet/src/pages/SkillMap.tsx | Полная read-only карта, own/historical subject в URL, Select по полному skills read, без молчаливой подмены первым предметом. Invalid/foreign selection не раскрывает другую карту. |
| тот же SkillMap | Нейтральное NOT_STUDIED вне трёх учебных этапов, один текущий server status на карточку; unassessed показывает catalog timestamp отдельно от проверки. Пустое имя не заменяется выдуманным преподавателем. |
| тот же SkillMap / SkillHistory | Клавиатурное раскрытие через aria-expanded/aria-controls, author/time/from→to/public comment, server page/total; downgrade/reset не скрываются. Collapse возвращает прежний focus. |
| тот же SkillMap | LearningGoal text/targetDate/isAchieved берутся из API; null — «Без срока». Нет процентов, оценок, auto promotion или вывода достижения по stages. |
| тот же SkillMap | Frozen snapshots4 отделены заголовком, объяснением cadence4/8 и отдельной ссылкой /student/reports. Snapshot ID не передаётся как reportId. |
| apps/student-cabinet/src/skill-widgets.tsx | Общие StagesTrack и SkillStatus на существующем StatusChip. Три numbered/text stages, не интерактивные кнопки. Neutral NOT_STUDIED не превращается в четвёртую ступень. |
| apps/student-cabinet/src/skill-copy.ts | Полная RU/RO copy и formatSkillDate с годом, /me timezone для timestamps и UTC date-only для цели. Учебные имена/цели/comments остаются как введены людьми. |
| apps/student-cabinet/src/pages/StudentHome.tsx | Краткая цель и ссылка каждого возвращённого предмета, включая исторический. Первый предмет больше не выбирается скрыто; полный skill/snapshot каталог на главной не повторяется. Последний snapshot подписан срезом, не отчётом8. |
| apps/student-cabinet/src/pages/Learning.tsx | SkillMap реэкспортируется из отдельного файла; bodies Materials/Notifications побайтово совпадают с before. |
| apps/student-cabinet/src/api.ts | skills/skill-history/snapshots revalidate на mount/возврате и явный refresh; периодический polling не добавлен, общий session/read policy сохранён. |
| apps/student-cabinet/src/student.css | Scoped layout, перенос длинного имени, toolbar spacing, focus и targets ≥44px для history/refresh; никаких hidden overflow или fixed CTA overlays. |
| apps/api/src/student/skills/skills.dto.ts, skills.controller.ts, skills.service.ts, skills.sql.ts; student.module.ts | SkillSnapshotQueryDto/Pipe/тип с optional subjectId. Ownership одинаково запрещает foreign/unknown; фильтр до history count/pagination. Существующие paths/operations и все responses сохранены. |
| packages/api-contracts/openapi/openapi.json, src/generated/client.ts, src/generated/openapi.ts | Штатная export/generate цепочка; optional getStudentSkillSnapshots.subjectId. Generated не редактировались вручную. |
| tests/unit/student-skills*.test.mjs | Validation/defaults/foreign denial, server context/no-store, typed SDK serialization, beyond-end count и структурная проверка counter/snapshot query. |
| apps/student-cabinet/tests/skill-journey-fixtures.mjs, skill-map.spec.mjs, fixture-server.mjs; playwright.skills.config.mjs; package.json | Изолированные synthetic fixtures/read-only browser suite. Map/audit/snapshots/cadence/history/denial, отсутствие приватных basis/notes, no-write assertions. |
| scripts/k8k-refresh-budget.mjs | TASK-031 evidence на baseline TASK-030, 50 маршрутов. |
| docs/K8K_IMPLEMENTATION_STATUS.md, docs/K8K_REQUIREMENTS_MATRIX.md, docs/k8k-redesign-tasks/EXECUTION_LOG.md, apps/api/src/student/skills/README.md | Текущий статус/traceability/границы и handoff, исторические акты не переписаны. |

## Контракты / SDK / миграции

[contracts.json](contracts.json): 147 операций до и после, ноль новых operations
и student mutation routes. Единственное изменение query — optional UUID subjectId
у getStudentSkillSnapshots. Все прежние request bodies/responses/security,
старые query fields и components schemas эквивалентны. SDK сохраняет URL без
фильтра; новый scoped URL проверен отдельным serializer test.

API source → targeted typecheck → штатный `export:openapi` с DB-blocking preload →
`generate:client` → consumer typecheck/build. NODE_OPTIONS восстановлен.
Новых dependencies, lockfile changes, migrations или schema application нет.

Snapshot subject ownership проверяется по owned_subjects, включая исторические
enrollments; history фильтруется до count/limit/offset, поэтому total не относится
к глобальной странице. Собственная пустая история — 200 с items[]; неизвестный и
чужой предмет — одинаковый SKILLS_FORBIDDEN 403. Неизменяемый snapshot использует
ss.subject_name/ss.skills, без JOIN к сегодняшнему каталогу.

Счётчик не переносился на клиент и не менялся: joins owned enrollments/outcomes,
CONDUCTED и confirmed_at; нет фильтра по новой подписке/текущему учителю.
Структура SQL проверена свежим unit test. **Фактические PostgreSQL значения при
исключении no-show/cancelled/unconfirmed и смене enrollments не исполнялись**;
готовые старые source-exact CTE cases остаются NOT_RUN, не PASS.
Никаких учебных, финансовых, checkpoint/reminder writes в student UI не добавлено.

## Источники и решения

Применены приоритеты AGENTS/последней воли владельца и действующих специальных
решений над старым frontend-only текстом и visual reference. Прочитаны текущие
plan/status/matrix/design instructions, PHASE0_CHECKS, owner CON-addendum;
№9.1–9.28 student decision log; skills README Read projections and privacy /
Confirmed lesson counter and teacher integration; VIS12 STU-04/TCHD-05/V12-AT-04;
K8K design §2 п.6/§5.2 DASH-STU-04. CON-07/B сохраняет 4/8 и обязанности учителя;
открытые ретрокоррекции не решались эвристикой.

Применены webdev-frontend-craft, webdev-api-data и condensed React review из
react-best-practices. Существующий UI stack/токены/Golos/статические Lucide
сохранены. Context7 /tanstack/query подтвердил семантику v5 refetchOnMount always
и enabled false; сверено с текущим useStudentQuery и фактическим return test.
[Официальный источник query observer](https://github.com/TanStack/query/blob/main/packages/query-core/src/queryObserver.ts).
Template/newtemp.png остаётся визуальной опорой, а не источником бизнес-данных.

## Свежие проверки

Точные команды, exit codes и scope — [verification.json](verification.json).

| Команда | Exit | Результат |
| --- | --- | --- |
| Existing Playwright --grep 'four skill states', отдельный output | 0 | 1 baseline case до изменения UI, [baseline.log](baseline.log) |
| pnpm --filter @online-school/api typecheck | 0 | [api-check.log](api-check.log) |
| pnpm test:stu08 --roots tests | 0 | 57 unit + actual Nest HTTP с mock Prisma, [api-tests.log](api-tests.log) |
| export:openapi с no-db preload; generate:client | 0 | 147 операций, [generate.log](generate.log) |
| pnpm --filter @online-school/student-cabinet typecheck | 0 | [student-check.log](student-check.log) |
| Safe programmatic Vite build ниже | 0 | dist перед browser tests; silent build, tsc-only student-check log |
| pnpm --filter @online-school/student-cabinet lint | 0 | [student-lint.log](student-lint.log) |
| Scoped eslint changed API/tests | 0 | [api-lint.log](api-lint.log) |
| pnpm --filter @online-school/student-cabinet test:skill-map | 0 | 10/10 Chromium, [browser.log](browser.log), [playwright.json](playwright.json) |
| node scripts/k8k-refresh-budget.mjs --task-031 | 0 | 50/50; skills 245408 bytes, max 255923 из 256000, включая fonts; [budget.log](budget.log), [budgets.json](budgets.json) |
| node output/k8k-tasks/TASK-031/verify-contract.mjs | 0 | [contracts.log](contracts.log) |
| node output/k8k-tasks/TASK-031/verify-preservation.mjs | 0 | 28 snapshots/31 migration hashes, [preservation.log](preservation.log) |
| Scoped git diff --check | 0 | before.json paths, [diff-check.log](diff-check.log) |
| node output/k8k-tasks/TASK-031/verify-artifacts.mjs | 0 | [artifacts-check.json](artifacts-check.json) |

Точный safe build, PowerShell из D:/OnlineSchool:

```powershell
'import { build } from "vite"; await build({envDir:false,publicDir:false,logLevel:"error",build:{emptyOutDir:false}});' | pnpm --filter @online-school/student-cabinet exec node --input-type=module
```

Export выполнялся со штатным script при
`NODE_OPTIONS=--import=file:///D:/OnlineSchool/output/k8k-tasks/TASK-018/no-db-export.mjs`.
Preload выбрасывает ошибку при любом обращении к DatabaseService.client;
.env не читались, рабочая БД не использовалась. SDK generation не требует DB.

Scoped diff:

```powershell
$task031Paths = (Get-Content output/k8k-tasks/TASK-031/before.json -Raw | ConvertFrom-Json).paths.path
git -c core.safecrlf=false diff --check -- $task031Paths
```

Первое compile замечание к optional HistoryQueryDto устранено приведением
проверенного query к SkillSnapshotQuery по существующему controller pattern.
Новые тесты уточнены для локализованного pager, query-string fixture logs,
toggle/open snapshot selectors и ожидания server empty state до инспекции запроса.
Линтер/ожидания старого теста не ослаблялись. Большая регрессия/DB rehearsal
не запускались по PHASE0 policy.

## Визуальные доказательства

Роль STUDENT; synthetic fixtures, внешняя сеть в новых browser tests блокируется.
Routes /student/skills?subjectId=…&ui.k8k=1 и /student?ui.k8k=1.
34 viewport screenshots: RU/RO × 360/768/1024/1280 × map/audit/snapshot/home = 32;
ещё cached stale RU и отдельный dashboard RO. [screenshots.json](screenshots.json).

- [RU 360 map](after/ru-360-map.png)
- [RO 360 audit](after/ro-360-audit.png)
- [RU 1280 snapshot](after/ru-1280-snapshot.png)
- [RO 768 home preview](after/ro-768-home.png)
- [RU stale](after/ru-stale.png)

Снимки audit/snapshot/home прокручены к соответствующей секции; map показывает
верх страницы, не весь длинный каталог. Просмотрены реальные рендеры mobile/desktop:
длинное имя переносится, нет горизонтального overflow, focus видим.
Клавиатура Enter открывает/закрывает audit и details; targets history ≥44px.
NOT_STUDIED нейтрален и не включён в три стадии. Полный screen-reader/WCAG аудит
и физические mobile устройства здесь не принимались.

## Не проверено / точные внешние условия

- NOT_RUN: PostgreSQL source-exact query execution, counter values/row isolation,
  real trigger/immutability/rollback/concurrency и миграции. Нужен отдельно
  разрешённый working procedure/target; QA/temporary DB не создавалась.
  21 старый CTE case не запускался и не объявлен свежим PASS.
- NOT_RUN: teacher assessment/publication/checkpoint/reminder/escalation workflow —
  TASK-042/043/044. Refresh student read не публикует педагогическое решение.
- NOT_RUN: полный screen-reader/WCAG и физическая mobile приёмка; здесь Chromium
  layout/keyboard/focus и локальные fixtures.
- NOT_RUN: TASK-035/FND-GATE, legal/financial/Meet provider gates и production GO.
  Не применялись real DB/storage/provider operations, push или deploy.

## Acceptance checklist

Полный машиночитаемый список — [acceptance.json](../../k8k-taskpack/task-031/acceptance.json).

- **PASS** — four_enums_three_stages: Все 4 enum; NOT_STUDIED отдельно от трёхступенчатой read-only легенды. Исходный four skill states тест не изменён.
- **PASS** — no_fabricated_assessment: Пустой teacherName обозначает отсутствие опубликованной проверки; catalog date не называется assessment date и не берётся из now.
- **PASS** — audit_public_downgrade_reset: From/to, автор, время и public_comment; downgrade/reset видны; private basis/notes отсутствуют. Pagination/total серверные.
- **PASS** — snapshots4_reports8_separate: Разные заголовки и /student/reports; snapshot ID не передаётся как reportId; открытие/чтение не создаёт report/checkpoint.
- **PASS** — frozen_names_and_comments: Frozen names/comments остаются старыми после переименования текущего навыка; источник ss.skills/ss.subject_name, не mutable catalog.
- **PASS** — goals_null_dates_and_server_stage: Teacher-authored text, targetDate/null, isAchieved из DTO. Нет оценок, процентов, рейтингов, badge, auto stage или вычисления достижения.
- **PASS** — counter_source_scope: Структурная проверка сохранённого SQL: confirmed outcomes + CONDUCTED + subject across owned enrollments, без subscription/current teacher reset. Не PostgreSQL execution.
- **PASS** — subject_url_and_historical_scope: Явный subjectId и исторический предмет вне active hub; не подменяется первым. Unknown/duplicated selection не показывает другую карту.
- **PASS** — snapshot_filter_before_count: Optional subjectId validated/bound до history count/page; unknown/foreign forbidden, beyond-end total сохраняется; service/HTTP mocks и SQL structure.
- **PASS** — read_only_interactions: Все skills вызовы GET; audit/expand/refresh не создают skill/checkpoint/report. Student mutation routes отсутствуют, HTTP tests проверяют 404.
- **PASS** — initial_loading_empty_error_stale: Loading, initial 503, owned empty list и cached stale различаются. Сохранённый stale снабжён явным предупреждением.
- **PASS** — refresh_return_without_polling: Возврат на карту обновляет опубликованную стадию даже в cache freshness interval; явный refresh; без нового polling.
- **PASS** — session_forbidden_late_read: 403 выше cached map/goal; 401 очищает DOM, поздний intercepted reply после session revocation не возвращает приватный контент.
- **PASS** — ru_ro_four_widths_keyboard_dates: RU/RO × 360/768/1024/1280 × map/audit/snapshot/home; 32 matrix + 2 state screenshots. Long names, Enter/focus/collapse, controls≥44px; даты с годом, /me timezone; date-only без shift.
- **PASS** — backward_compatible_sdk: 147 операций и все прежние responses/request/security/schema неизменны. Единственное добавление — optional getStudentSkillSnapshots.subjectId; standard export/generate с DB-blocking preload.
- **PASS** — budgets_fonts: 50/50 ≤256000 bytes по v2 с raw Golos subsets, skills route 245408 bytes. Storybook modules не попадают в bundle.
- **PASS** — preservation_scope: 28 snapshots valid,31 migration hashes неизменны, все 431 исходных status paths существуют; HEAD/branch сохранены; working DB/production не использовались.
- **PASS** — sources_reports_handoff: Текущие owner decisions, STU-04/TCHD-05/CON-07/B/№9.1–9.28; исходная основа, новые изменения и свежие checks разделены.
- **NOT_RUN** — postgresql_execution_counter_and_isolation: Реальные counter values при no-show/cancelled/unconfirmed/смене enrollments и row isolation требуют разрешённого PostgreSQL execution. 21 старый source-exact CTE case не запускался.
- **NOT_RUN** — teacher_publication_storage_hooks: Teacher confirmation/assessment/checkpoint/reminders — TASK-042/043/044; реальные trigger/immutability/transaction races и migrations не применялись.
- **NOT_RUN** — full_role_accessibility_and_production_gate: Физический screen reader/mobile, полный WCAG, TASK-035/FND-GATE, legal/production GO не входят в локальную Chromium/mock приёмку.

## Остатки

[handoff.md](handoff.md). TASK-032 продолжает Reports/PDF и reportId/deep-link
контракты по своему документу. SkillSnapshot.snapshotId туда не передаётся.
TASK-035 — кабинетный gate; TASK-042/043/044 — учительские команды/публикация4/8.
Эти задачи автоматически не начаты.

## Риски и обратимость

Новый optional filter требует одновременного совместимого API/SDK rollout:
старые callers без subjectId работают; новый UI до обновления API получит 400
на scoped snapshots, поэтому не публиковать отдельно от backend release.
Prepared STU-08 migrations и release prerequisites из README не отменены.

Rollback адресный: восстановить только TASK-031 hunks из before snapshots с
учётом более поздней работы, убрать новые SkillMap/skill-copy/skill-widgets/tests
лишь после проверки использования; не reset/clean всего dirty дерева.
Никакие сохранённые assessments/snapshots/reports/чужие архивы не удаляются.


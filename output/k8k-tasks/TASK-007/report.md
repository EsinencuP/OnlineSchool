# TASK: TASK-007

Статус: **DONE**. Выполнен только TASK-007; TASK-008 не начат.
Палитра/шрифт/размеры provisional; полный UI-kit/релиз не объявлен завершённым.

## Основа / что уже существовало

HEAD `171db2142858e035594737e141d422fa5378e844`, ветка `feat/k8k-design` сохранены.
Build-time dirty digest `04eb5901ce4a206fad7bddcf88cb7365a91793905ca2aea069465d1d5bc9963f`;
source digest `3c04b4f4ca9e2fd8fe7ca88c04b44a2d598fa6fb1d76c1fba2bb4a35d50f3fef`. [Bundle](runs/2026-11-03T22-17-03.782Z/bundle.json) содержит465 scoped hashes.
Digest фиксирует tracked patch до bookkeeping; source manifest исключает mutable docs/output.
[Before](before.json):457 files/binary patch, TASK-006456/456 inputs совпали и verification PASS.
[Final preservation](source-preservation.json) проверяет источники, ограниченный diff, archives/index.

Были Button(default button/pending), Field(ref/native attrs/primary description), IconButton,
StatusChip, grapheme Avatar и Card;4 control tests, локальные Golos/Lucide и token states.
Select отсутствовал; hint скрывался при error, внешние description IDs не deduped;
Card/Avatar props/ref/fallback и safe unknown status были неполными.

## Что изменено / контракты

| Путь | Поведение / причина |
|---|---|
| packages/ui/src/controls.tsx | Совместимые native props/ref, Select, combined hint/error/descriptions, disabledReason, density, Card/Avatar/native extensions, neutral unknown status |
| packages/ui/src/locale.tsx | Две общие RU/RO fallback labels: unknown status/person; без бизнес-словаря/прав |
| packages/ui/src/style.css | Native controls44/48, explicit staff compact≥36, error/hint/wrap/focus/disabled и Card/neutral styles; только tokens |
| packages/ui/stories/controls.stories.tsx + controls.css | CSF-compatible RU/RO stories и interactive consumer, native keyboard/refs/validation/state catalog |
| packages/ui/tests/controls.test.mjs |8 новых meaningful SSR contracts; прежние4 сохранены |
| apps/student-cabinet/src/pages/Account.tsx | Только K8K Profile →Field/Button/Card, локальные RU/RO captions; legacy preserved; command/hooks unchanged |
| apps/student-cabinet/tests/ui-controls/; tsconfig.ui-controls.json | Pure UI consumer и реальный Profile в isolated context/mocks; strict compilation |
| package.json; apps/student-cabinet/package.json | Только safe evidence/typecheck scripts |
| scripts/k8k-controls-evidence.mjs | Fresh frontend builds/v2 budgets, real render/interactions/local SDK mocks/evidence |
| docs/ui-stack.md, log/matrix/status | Текущие статусы, bundle delta и handoff |

[Design note](design-note.md) до реализации. Полный [public contract](handoff.md).
Новых dependencies/API/DTO/SDK/миграций нет; JS lockfile/font assets прежние.
UI-kit не импортирует business SDK/session/ledger и не вычисляет eligibility.
Card title/children и старые Field native attributes/primary description ID совместимы.
Caller управляет value/onChange/pending/error; error summary остаётся app-level.

## Источники / применённый приоритет

TASK-007 §§3/5–8/10/12; AGENTS latest owner/preservation; PHASE0_CHECKS ограничения среды;
K8K plan этап1, design §§2–7/3.2–3.4, VIS-10/11, текущие matrix/status, CON rules без изменения.
Template — визуальная опора, не источник данных/прав. React18 forwardRef/useId/input/select
проверены через Context7 первичной v18 документацией; React19 API не вводился.
Skills frontend-craft и vercel:react-best-practices применены в рамках текущего стека:
[review](react-review.json), без Tailwind/SWR/Next/React upgrades.

## Consumer и сохранение поведения

[AST proof](consumer-source-proof.json): Profile useCommand/update/save и api.ts hooks идентичны;
5 соседних functions Login/ChangePassword/AccessSuspended/Security/formValues не менялись.
Native FormData displayName/trim/required/min/max сохранены, native autocomplete/inputMode добавлены.
Legacy Panel/input/button остаются при ui.k8k=0. Input key по me.displayName и server-owned success
не переписаны, autosave/command hooks не заменялись. ErrorNotice остаётся app-level.

Mock browser использует реальный Profile и useCommand→write→generated SDK:
PATCH после local CSRF, headers проверены как booleans (значения не логируются), no-store responses.
Pending не допускает второй click/Enter,422 сохраняет исходный ввод, исправление→200 показывает
success только после ответа. Это local fixture, не real DB/auth/ACL acceptance.
Unknown StatusChip никогда не повторяет fake success/status code; показывает явно нейтральный RU/RO текст.
Disabled reason/hint видны текстом; цвет ошибки/статуса дополнен текстом и декоративной иконкой.

## Проверки / команды / exit codes

[Точные команды](checks.json), только scoped local targets:

| Команда | Exit | Результат |
|---|---:|---|
| pnpm --filter @online-school/ui build |0| Targeted tsc до dist tests; [log](ui-build.log) |
| pnpm --filter @online-school/ui test |0|111/111 (4 old controls+8 new, остальные существующие UI tests); [log](ui-test.log) |
| pnpm --filter @online-school/ui lint |0| ESLint +10 CSS,715 unchanged legacy records,0 unexpected/stale; [log](ui-lint.log) |
| pnpm --filter @online-school/student-cabinet typecheck:ui-controls |0| Strict/exact optional props, stories/actual consumer; [log](consumer-typecheck.log) |
| scoped eslint --max-warnings 0 |0| [Log](eslint.log), без suppression |
| scoped prettier --check |0| [Log](format.log) |
| pnpm k8k:controls:evidence |0| [Verification](runs/2026-11-03T22-17-03.782Z/verification.json):49 cases,80 PNG,48 budgets,465 unchanged source hashes |
| TypeScript AST comparison |0| [consumer-source-proof.json](consumer-source-proof.json) |
| Python -B source/archive hash + scoped git diff --check |0| [source-preservation.json](source-preservation.json) |

Первый новый SSR test ожидал camel-case readonly — исправлен на фактический HTML readonly.
Первый story consumer фокусировал ещё disabled input до React commit: focus перенесён в
post-commit useLayoutEffect consumer (не generic Field), затем все ref/validation cases прошли.
Промежуточные runs сохранены; принятый run **2026-11-03T22-17-03.782Z**. Whole-repo regression не запускалась.

## Визуальные доказательства / бюджеты

[Галерея](runs/2026-11-03T22-17-03.782Z/gallery.html), [полные cases](runs/2026-11-03T22-17-03.782Z/visual.json), [ручной просмотр](visual-review.json).
RU/RO×360/768/1024/1280×student/staff stories:ready/pending/validation =48 PNG.
Actual Profile RU/RO×4 widths×K8K/legacy×422/success =32 PNG; вместе80.
Дополнительно большой touch viewport1280 сохраняет min44, fine-pointer staff compact36 только явно.
Long RO text/unbroken error не перекрывает input/select; descriptions существуют и deduped,
label click/ref-focus/ArrowUp keyboard работают; controlled/uncontrolled значения не сбрасываются.
Все9 VIS11 классов+unknown-result представлены как существующий StateBoundary, без изменения его модели.
16 external sentinel requests прерваны; весь browser ограничен точным ephemeral loopback,
unknown APIs501, serviceworkers blocked;0 browser errors. Frozen time/Europe-Chisinau/reduced motion.
Вручную просмотрены ro360 validation story/Profile422 и ru1280 legacy success.

[48 route rows](runs/2026-11-03T22-17-03.782Z/bundle.md), [JSON](runs/2026-11-03T22-17-03.782Z/bundle.json), тот же v2 метод TASK-006:
static/lazy closure/gzip9/dedup, все3 raw WOFF2=63492, никаких удалённых функций ради веса.

| App | Max bytes | Total delta vs TASK-006 |
|---|---:|---:|
| Student |192650|+1383|
| Platform |130391|+1077|
| Manager |243227|+1221…1230 по route|

Все48 routes и optional passkey closure PASS≤256000; max243227, запас12773.
Dependencies/lockfile/fonts не менялись, font delta0. Это не Vercel transfer performance/production GO.

## Acceptance checklist

| Критерий TASK-007 | Статус | Evidence |
|---|---|---|
| Prerequisite/все шаги только текущего TASK |PASS|before, реальный TASK-006 verification; шаги2–8 выше |
| Default Button не submit |PASS|SSR и default click не увеличивает native form attempts |
| Pending блокирует двойное намерение |PASS|consumer attempts1; actual Profile PATCH1 до исправления, disabled/busy |
| Field label связан с id |PASS|SSR+native label click/focus, Select AX label |
| Ref focus работает |PASS|реальные input/select/button/IconButton/Card refs, strict types |
| Длинный RO error не перекрывает input |PASS|DOM geometry errorTop≥inputBottom,16 validation-story PNG в галерее80 |
| Validation failure сохраняет ввод |PASS|controlled/uncontrolled stories и actual Profile422 |
| Native props/callbacks/name/value/autocomplete/inputMode |PASS|strict fixture, keyboard Select, native Profile FormData |
| Unknown StatusChip neutral; Avatar full name/no photo |PASS|unit/browser/AX, hidden decorative icons |
| Hint/error/external help IDs, summary app-level |PASS|deduped existing IDs и оба текста, Profile ErrorNotice сохранён |
| Stories/Card/Avatar/safe consumer/styles |PASS|CSF sources реально отрендерены; Storybook runtime отдельно |
| No SDK/domain decisions/dependency growth in UI |PASS|pure imports, unchanged hooks/lockfile,111 tests+lint |
| Commit/digest/preservation/log/matrix/handoff |PASS|до/после hashes, актуальные rows, README/handoff |
| Нет выдуманных прав/данных/успеха/старых PASS |PASS|synthetic inputs; success только mock200; fresh codes отдельно |
| DB/migration/production untouched |PASS|DB/provider/seed/deploy commands не выполнялись |

## Не проверено / остатки / риски

Storybook runtime/build — NOT_RUN до TASK-013; CSF-compatible sources и local renderer готовы.
Actual NVDA/Narrator speech, full WCAG/i18n/role/session/backend/provider/DB regression,
deployed CI/FND-GATE/LEGAL/FIN-LEGAL/Meet/G4/production GO — NOT_RUN вне scope.
Старые StateBoundary RU на RO — TASK-012/015, ErrorNotice/code localization — TASK-016/034.
Profile captions RU/RO не переводят человеческое имя/комментарии и не меняют wire codes.
715 legacy CSS records и прежние74 OPEN не закрыты автоматически. Блокеров TASK нет.

TASK-008 получает [props/ref/description/target-size contracts](handoff.md); dialogs здесь не начаты.
Полная CSF coverage/runtime — TASK-013, typed localization — TASK-014/015, full roles/WCAG — соответствующие gates.
Откат ограничен TASK-007 hunks/new story/fixture/helper по before/, без стирания старой dirty работы.
Archive/output history сохранена; reset/clean/stash/commit/merge/push/deploy не выполнялись.

# TASK: TASK-004

Статус: **DONE** — метод измерения, route budgets и адресный реестр.
Выполнен только TASK-004; TASK-005 не начат. OPEN дефекты не объявлены исправленными.

## Основа

- HEAD `171db2142858e035594737e141d422fa5378e844`, ветка `feat/k8k-design` сохранены.
- Dirty digest `35000c52207a367a478c67f1e221a20dd3d038654d36ee41bb5892c7903fc58b`.
- Source digest `75516b3375656c7c81440701459dcb5debddf6c2c45c5fe2eaba3c4e293ca453`.
- Pasted TASK SHA256 `0a8620b4c97cffd7da3c5a0bf4b8036ddf068e21753204fda7fb72561b9447e0`.
- [bundle.json](runs/2026-11-03T21-10-19-078Z-0b1240/bundle.json) содержит414 input hashes,
  точное определение digests, actual manifests/asset hashes, lockfile/build provenance.
  Mutable log/matrix/status/ui-stack и generated outputs не включены в scoped digest.
- TASK-003 prerequisite подтверждён audit DONE и неизменностью его source inputs
  кроме разрешённого добавления root package script. Старые output не перезаписаны.
- Сохранены исходный dirty/untracked продуктовый код и архивы; чужая работа не приписана
  этому TASK. Итог: [source-preservation.json](source-preservation.json).

## Что уже существовало

`k8k-size-check` суммировал все JS/CSS student/platform и manager по lazy page keys,
считал raw fonts. `k8k-phase2-bundle` использовал старый phase0 baseline и разнородные
manifest/dist. Старые implementation187608/125382 не имели полного route provenance.
TASK-003 уже содержал48 rendered surfaces,2128 PNG и адресные исходные наблюдения.

## Что изменено

| Путь | Поведение / причина |
|---|---|
| `scripts/k8k-route-budget-core.mjs` | Pure static closure/Set dedup, gzip(level9), оба fonts, null/unavailable на missing inputs, честный budget pass/fail |
| `scripts/k8k-route-budget.mjs` | Fresh source frontend builds+manifests, source-derived lazy seeds/tab mapping, provenance, history comparison policy, addressed defects, verify/selfcheck/nonzero probes |
| `package.json` | Добавлен только `k8k:route-budget` local-only target относительно TASK-003 |
| `output/k8k-tasks/TASK-004/` | Предварительный design note, timestamped builds/bundle/defects/verification, selfchecks, nonsecret cache probe, инструкция и отчёт |
| `docs/ui-stack.md` | Добавлена текущая методика/точные числа; исторические данные сохранены |
| `docs/k8k-redesign-tasks/EXECUTION_LOG.md`, `docs/K8K_REQUIREMENTS_MATRIX.md`, `docs/K8K_IMPLEMENTATION_STATUS.md` | Статус TASK-004 и ограничения измерения/OPEN реестра |

Продуктовые функции, старые scripts/output, dependencies, DTO/SDK/миграции не менялись.
Никаких функций/legacy branches не удалялось ради красивого веса.

## Контракты / совместимость

Новый только локальный CLI `pnpm k8k:route-budget build|verify|selfcheck`.
`bundle.json` v1 содержит route/files/method/gzip/font/total/baselineRef/pass.
Использован один installed Vite7.3.7 production source-build путь для всех3 frontend:
configFile:false/envDir:false/publicDir:false/manifest:true, source aliases, новые output
каталоги. API/DB/TypeScript/Prisma/OpenAPI generation не запускались.

Route closure: entry + рекурсивные static imports/CSS + реальный active lazy page/tab.
Shared file один раз. Lazy bindings извлечены из source React lazy(import()),
manager tab — из реальных conditional JSX ветвей. Student/platform сейчас single-entry.
Deferred dynamic roots перечислены; manager passkey action измерен отдельно. Остальные
tabs/pages учитываются в соответствующих самостоятельных route rows.

JS/CSS — сумма gzip(level9) каждого файла отдельно; fonts — raw WOFF2, без повторного
сжатия/двойного счёта. Оба subset включаются даже для латинской или кириллической
локали, где браузер фактически может запросить меньше. Лимит256000=250KiB.
Missing manifest/module/asset/font => unavailable/null/pass:false, никогда zero/PASS.

## Результат измерения

[Таблица](runs/2026-11-03T21-10-19-078Z-0b1240/bundle.md) и
[проверка](runs/2026-11-03T21-10-19-078Z-0b1240/verification.json).

| Приложение / действие | Max total, байт | Лимит | Результат |
|---|---:|---:|---|
| Student route closures |187379|256000|PASS|
| Platform:teacher/director/operator/shared login |125408|256000|PASS|
| Manager, максимум `/manager/students/:id?tab=schedule` |238089|256000|PASS; запас17911|
| Manager login с optional passkey-browser action |178457|256000|PASS|
| Все48 inventory entrypoints |48/48 доступны|256000 каждый|PASS|

В каждом total: cyrillic22032+latin37916=59948 font bytes отдельными полями и суммой.
Assets совпали побайтно с renderer build TASK-003:student4/4,manager29/29,platform4/4.
Так подтверждено сохранение текущей renderer версии; эти совпадения не выданы за
route delta, которой TASK-003 не измерял.

Историческая delta к implementation/phase0/phase2 — **unavailable/null**, причины
записаны в bundle.historical. Старые source commit/dirty/method/font/alias/chunk
основания недостаточны для достоверного сравнения. Разница новых187379/125408 со
старыми187608/125382 не публикуется как улучшение/регрессия. Текущий run — первая
полная k8k-route-v1 baseline для будущих совместимых route deltas.

## Адресный реестр дефектов

[defects.md](runs/2026-11-03T21-10-19-078Z-0b1240/defects.md),
[defects.json](runs/2026-11-03T21-10-19-078Z-0b1240/defects.json):**74 OPEN** записи.

- 13 групп observed overflow с route/role/locale/viewport/scrollWidth/offenders/PNG.
- 31 группа requested-RO static copy/htmlLang несоответствий. Имена/ДЗ/сообщения людей
  не считаются дефектами перевода.
- 28 documented functional gaps с source module, missing fields и будущими TASK.
- 1 запись небольшого native-control/pixel variability в baseline: обе версии сохранены.
- 1 P1 source-security-lifecycle запись: student password/email OTP команды передают
  sensitive variables через общий useCommand→useMutation. Привязаны api.ts:122 и
  Account.tsx:28/96/274/294, future TASK-019/034/066. Это существующий source path;
  реального credential/OTP в проверках не было. Изолированный установленный QueryClient
  подтвердил сохранение **не секретного** synthetic marker в mutation variables:
  [cache-variable-probe.json](cache-variable-probe.json), значения не логировались,
  client очищен. Авторизация в TASK-004 не переписывалась.

У каждого defect есть reproduction, impact, evidence и конкретный future TASK.
`inherited-at-TASK-003-baseline` означает наличие в текущей сохранённой основе.
Регрессия относительно более раннего релиза **не установлена** без сопоставимого
older renderer evidence. Conditional DIR-01…06 и DIR-07 out-of-release перечислены
как scope metadata; их не включали под видом исправления дефекта.

## Источники и решения

TASK-004 §§3/5/6/7/8/10/12; AGENTS preservation/текущий owner scope; PHASE0_CHECKS
актуальные запреты БД/больших общих suites; K8K_REDESIGN_PLAN этап0; текущие status/matrix;
design instructions §§2–7, где текущий §7 выше исторического §8; UX VIS-03…12/UX-AUD;
CON-01…11 без изменения финансовых/педагогических правил. Existing template не задаёт
права/цифры и не является эталоном веса.

Vite manifest/envDir semantics сверены с Context7 первичными Vite7.3.5 docs
(доступный совместимый patch этой ветки); установленный7.3.7 и его реальные manifests
использованы фактически. Stack не обновлялся. `.env` не читались, внешние accounts/
providers/MCP authorization не подразумевались. Новых dependencies нет.

## Команды / exit codes / evidence

Все команды из `D:/OnlineSchool`. Только локальные файлы/сборки/isolated fixtures.

| Команда | Exit | Доказательство |
|---|---|---|
| git status/branch/HEAD, адресное чтение старых scripts/manifests/bundles |0 для существующих источников| Старые Vite configs:manager manifest есть, student/platform отсутствует; устаревший dist не принят за fresh build |
| `pnpm exec eslint scripts/k8k-route-budget.mjs scripts/k8k-route-budget-core.mjs --max-warnings 0` |0| Адресный lint нового tooling, правила не отключались |
| `pnpm exec prettier --write` новых2 scripts/package/design note и итоговый `--check` |0| Ограниченный scope |
| `pnpm k8k:route-budget selfcheck` |0| [results](selfchecks/2026-11-03T21-09-07-532Z-d32472/results.json):9 checks,diamond shared dedup/fonts/lazy/missing manifest/import/asset/over-budget |
| Selfcheck subprocess `probe-file over-budget.json` |1 ожидаемый| Доказан nonzero при превышении лимита; основной selfcheck принимает это как корректное поведение |
| Selfcheck subprocess `probe-file missing-manifest.json` |1 ожидаемый| unavailable/null и nonzero, отсутствие manifest не даёт нулевой PASS |
| `pnpm k8k:route-budget build` |0| Принятый [run](runs/2026-11-03T21-10-19-078Z-0b1240/bundle.json):fresh3 frontend manifests,48 closures,74 defects;414 source hashes |
| `pnpm k8k:route-budget verify output/k8k-tasks/TASK-004/runs/2026-11-03T21-10-19-078Z-0b1240` |0| Повторное чтение без build, manifest/asset hash/closure/font/optional-action/source/evidence checks |
| `node --input-type=module -` isolated QueryClient nonsecret probe |0| Cache-variable semantics без app/server/network; artifact содержит только boolean/источники |
| Python `-B` source/old output hashes/package semantic check |0| [source-preservation.json](source-preservation.json) |
| `git diff --check -- package.json` |0| Нет whitespace ошибок ограниченного diff |

Первые новые timestamp builds сохранены как промежуточные: расширены hash/lockfile/
missing-summary проверки и добавлен конкретный lifecycle defect. Принятым является
указанный финальный run. Никакой исторический каталог не перезаписывался.
Старые size scripts не запускались: они пишут исторические output. Package build
команды заменены эквивалентной адресной Vite source-сборкой без postinstall/generation
и `.env`, с единым provenance для всех3 frontend. Whole-repo tests/build/DB checks — NOT_RUN.

## Acceptance checklist — §8

| Критерий | Статус | Доказательство |
|---|---|---|
| Shared chunk не посчитан дважды |PASS|Set по manifest keys/files; diamond graph selfcheck и48 deduped closures |
| Нет manifest => unavailable/fail |PASS|null поля,pass:false; selfcheck subprocess exit1; verify проверяет actual manifest checksums |
| Лимит превышен => nonzero |PASS|Over-budget probe exit1; build/verify выходят1 при route/optional-action failure |
| Оба font subset включены |PASS|cyrillic22032/latin37916,59948 raw total во всех48 строках |
| Функции не удалены ради веса |PASS|414 source hashes и Task003 renderer assets совпадают, product source не менялся |
| Каждый defect связан с future TASK |PASS|74 records с реальными TASK files/evidence и reproduction/impact; source security case отдельно |

## Acceptance checklist — готовность §10

| Критерий | Статус |
|---|---|
| Реальные prerequisites; выполнены шаги только TASK-004 |PASS|
| Метод/контракт/ограничения проверены closure/probe/evidence сценариями |PASS|
| Нет отключения lint/auth/guard/domain rules |PASS|
| HEAD/digest/source provenance связаны с артефактами; реальные секреты/детские данные отсутствуют |PASS|
| Log/matrix/status/ui-stack и handoff обновлены |PASS|
| Нет выдуманной delta/endpoint/capability/financial success |PASS|
| Прежние/новые/исторические проверки разделены |PASS|
| БД/applied migrations/production/чужой код/архивы сохранены |PASS|

## Визуальные доказательства / не проверено

TASK-004 не меняет UI и не переснимает2128 screenshots. Evidence routes/roles/RU/RO/
360/768/1024/1280 берутся из неизменённого TASK-003 INDEX/PNG, с источником для каждого
defect. Browser/a11y/role/backend/provider/DB регрессия здесь NOT_RUN. Размер closure
не равен измерению Vercel transfer headers/CDN performance, FND-GATE или production GO.
LEGAL/FIN-LEGAL/MeetPOC/OAuth/G4 остаются открытыми. Блокеров TASK-004 нет.

## Остатки / handoff

TASK-005 получает `bundle.json` как первую полную baseline метода k8k-route-v1,
`defects.json`/futureTasks и real source refs. Palette/contrast/Stylelint задачи
следующего блока здесь не реализуются. Все74 OPEN исправляются в назначенных TASK;
проверять совместимость метода/lockfile/runtime/source при будущих deltas, сохранять
font policy и active lazy seeds. Не использовать бюджеты как разрешение убрать сценарий.

## Риски и обратимость

Сборки/артефакты локальные на том же диске. Новый helper создаёт новый run и не меняет
app dist/старые outputs. Rollback ограничен2 scripts, одной package script и4 текущими
документами учёта/ui-stack; исходная пользовательская dirty работа и архивы сохранены.
Reset/clean/stash, branch replacement, commit/merge/push/deploy/DB mutations не выполнялись.

# TASK: TASK-005

Статус: **DONE** — токены, семантический контраст и scoped Stylelint.
Выполнен только TASK-005; TASK-006 не начат. Палитра остаётся provisional.

## Основа и сохранность

- HEAD `171db2142858e035594737e141d422fa5378e844`, ветка `feat/k8k-design` сохранены.
- Dirty digest на момент сборки: `cea448a53cb0f9d5e2fde7356e019fcdb3bf9e612d8e448ea735e64b50275280`.
- Source digest: `0c5e86b994e03db94fe45a394c116348a7bc54c8fa4cbc03c3cbf32e1a534ffe`; 426 ordered input hashes в [bundle](runs/2026-11-03T21-34-16.851Z/bundle.json).
- Это build-time snapshot до обновления журналов/отчётов: source manifest исключает
  mutable bookkeeping/output, но patchSha256 фиксирует весь tracked diff на момент сборки.
  Точный алгоритм записан в basis.definition; финальная сохранность проверена отдельно.
- До реализации сохранены 419 текущих файлов и binary patch в before/, hashes — [before.json](before.json).
- TASK-004 prerequisite: реальный verification PASS и неизменность функциональных источников;
  48 route rows и 74 OPEN дефекта сохранены. Архивы и прежние outputs не перезаписывались.
- [source-preservation.json](source-preservation.json) подтверждает ограниченный diff и
  неизменность исходных файлов вне разрешённых путей, HEAD/ветки/index и защищённых архивов.

## Что уже существовало

Единственный tokens.css с provisional палитрой, aliases, font/space/radius/shadow;
25 документированных измерений, 17 порогов и запрет accent по ручной WCAG формуле.
Общие Button/Field/StatusChip, локальные Golos/Lucide, StateBoundary и четыре control tests.
Stylelint/culori отсутствовали; у общих controls не было явных hover/disabled backgrounds,
focus rule зависел от Shell/State ancestry, размеры 44/48 повторялись literals.

## Что изменено

| Путь | Поведение / причина |
|---|---|
| packages/ui/src/tokens.css | Семантические danger-hover/disabled, размеры 48/44/36; прежние 25 цветов сохранены |
| packages/ui/src/style.css | Tokenized targets, student primary ≥48, прочие ≥44; hover/disabled и двухслойный focus для всех элементов под data-k8k |
| packages/ui/tests/contrast-contract.mjs, contrast.test.mjs | Alias resolver/cycle detection, прежние 25 ожиданий/17 порогов, независимый culori, semantic/hover/focus/disabled/error/alpha checks |
| stylelint.config.mjs; scripts/stylelint-k8k.mjs, k8k-stylelint.mjs | Raw colors/font sizes/неверные font tokens/accent запрещены; exact legacy baseline без UI exceptions |
| packages/ui/tests/stylelint.test.mjs, stylelint-legacy.json | Негативные пробы, реальный CLI nonzero, новая/изменённая/лишняя baseline запись fail; 715 действительных legacy records |
| packages/ui/tests/design/ | Synthetic token fixture, четыре surfaces, реальные controls и 10 StateBoundary variants |
| scripts/k8k-design-check.mjs, k8k-design-evidence.mjs | Безопасные локальные проверки и source builds/browser evidence, тот же route метод TASK-004 |
| package.json, packages/ui/package.json, pnpm-lock.yaml | Три pinned dev tools и scoped команды, UI lint включает CSS |
| .github/workflows/ci.yml | Scoped test:design в lint job, без новых credentials/services |
| docs/ui-stack.md, log/matrix/status | Dependency/bundle delta, конкретный scope и handoff |

Design note записан до реализации: [design-note.md](design-note.md).
API/DTO/SDK, auth/eligibility, финансы, миграции и бизнес-данные не менялись.

## Контракты и семантика

Tokens — единственный рабочий источник значений. Fixtures содержат имена tokens/ожидания,
не вторую палитру. 25 чисел вычисляются из CSS и независимо совпадают с culori.
Accent/surface 3,59:1 не normal text/white-label button; accent/sand **2,78:1** не graphics3:1.
Подмена brand-text на accent приводит к реальному nonzero exit1, raw hex вне tokens — exit2.

Normal text ≥4,5; focus на sand 9,77 ≥3. Проверены ссылки на white/page/sand/warm и
warning/error surfaces; primary/danger/secondary hover; disabled без opacity fading;
field aria-invalid border; status chips text+icon. Alpha overlays композятся на явном
opaque backdrop; контраст полупрозрачного цвета без backdrop отклоняется. Raw alpha
в shadow не исключение из правила. Шрифт/36px desktop token не вводят автоматическое
уменьшение touch controls; существующие 44px сохранены, student primary ≥48px.

Stylelint discovery покрывает все 8 CSS-файлов под UI/account-ui/student/manager/platform,
включая новые CSS в этих roots. Исключение literals — только canonical token file.
Allowlist: 430 manager →TASK-058; 145 student →TASK-035; 117 platform →TASK-071;
23 account-ui →TASK-067. Каждый record фиксирует path/context/property/value/occurrence/reason;
line лишь подсказка. Новые/изменённые/duplicate/stale записи fail. У packages/ui исключений нет.
Правильный tokenized font shorthand с numeric line-height разрешён как корректный CSS,
а не внесён в baseline. Автоматической команды пересоздания allowlist нет.

## Зависимости и размер

[Metadata](dependencies.json): stylelint16.26.1, culori4.0.2, postcss-value-parser4.2.0;
MIT, возраст 339/493/1799 дней, Node24 совместим, React peers отсутствуют.
Установка --ignore-scripts, без generation/postinstall. Все прежние lockfile entries
побайтно по parsed значениям сохранены; только root dev additions. Runtime tools не импортируются.

| Приложение | Max total bytes | Delta vs TASK-004 | Результат |
|---|---:|---:|---|
| student |187526|+147|PASS|
| platform |125568|+160|PASS|
| manager |238247|+158|PASS|

[Все 48 строк](runs/2026-11-03T21-34-16.851Z/bundle.md), [JSON](runs/2026-11-03T21-34-16.851Z/bundle.json).
Оба raw fonts 59948 без изменения; shared/static closure dedup и explicit lazy seeds прежние.
Optional passkey closure проверен отдельно. Сопоставимость доказана одинаковыми Node/Vite/zlib,
alias/build/gzip/font методом и сохранением всех прежних importer/packages/snapshots.
Изменение asset names/import references тоже входит в delta, это не только CSS payload.
Старые size scripts и исторические outputs не запускались/не перезаписывались.

## Свежие проверки

Точные команды/exit codes: [final-checks.json](final-checks.json).

| Команда | Exit | Результат / artifact |
|---|---:|---|
| pnpm add -Dw --save-exact --ignore-scripts stylelint@16.26.1 culori@4.0.2 postcss-value-parser@4.2.0 |0| Только dev tools; metadata выше |
| pnpm --filter @online-school/ui build |0| Targeted tsc, [log](ui-build.log); dist-based tests после build |
| pnpm --filter @online-school/ui test |0| **98/98**, [log](ui-test-accepted.log) |
| pnpm --filter @online-school/ui lint |0| ESLint + 8 CSS, 715 exact legacy entries, unexpected/stale 0; [log](ui-lint-accepted.log) |
| pnpm --filter @online-school/ui test:design |0| 77 contrast/stylelint tests + scoped CSS lint, root k8k:design эквивалентен |
| pnpm exec eslint новых tooling/config --max-warnings 0 |0| [Log](tooling-eslint-accepted.log), без lint disables |
| pnpm exec prettier --check scoped changed code/fixture/config |0| [Log](format-final-accepted.log) |
| pnpm k8k:design:evidence |0| [Verification](runs/2026-11-03T21-34-16.851Z/verification.json):48 budgets,16 PNG,16/16 external sentinel aborts,0 browser errors,426 source hashes unchanged |
| In-memory brand-text→accent child probe |1 ожидаемый| [negative-probes.json](negative-probes.json), исходный CSS не изменялся |
| Actual Stylelint CLI stdin raw hex |2 ожидаемый| [negative-probes.json](negative-probes.json) |
| Scoped source/archives hashes + diff whitespace check |0| [source-preservation.json](source-preservation.json) |

Во время реализации исправлены false positives numeric weights и tokenized font shorthand,
уточнён canonical font alias guard. Первый browser harness не передавал ui.k8k=1:
существующий feature initializer снимал data-k8k. Harness теперь явно включает тему и
проверяет её атрибут до измерений. Форматирование нового evidence helper исправлено после
check failure. Промежуточные runs/check logs сохранены и не являются итоговой приёмкой.
Единственный принятый run: **2026-11-03T21-34-16.851Z**. Общая recursive regression не запускалась.

## Визуальные доказательства

[Галерея](runs/2026-11-03T21-34-16.851Z/gallery.html), [visual.json](runs/2026-11-03T21-34-16.851Z/visual.json),
[ручной просмотр](visual-review.json). Synthetic /synthetic-token-contract:
RU/RO ×360/768/1024/1280×student/staff =16 PNG; четыре surfaces, длинные подписи,
реальный Tab до sand link, hover/disabled/error, девять классов + unknown-result.
Chromium156.0.8078.4, frozen time, Europe/Chisinau, reduced-motion, локальные WOFF2;
только точный ephemeral loopback origin, внешние запросы прерваны, serviceworkers blocked.
На каждом viewport scrollWidth ≤ viewport; чипы имеют текст и декоративную иконку.
Вручную просмотрены ru360 student и ro1280 staff; финальные PNG побайтно совпали с просмотренными.

Существующий StateBoundary/FreshnessLabel всё ещё показывает RU copy на RO — TASK-012/015;
на скриншотах это сохранено, общий i18n gate не объявлен закрытым. Не менялись auth,
бизнес-формы, DTO и поведение очередей команд; реальные credentials/детские данные отсутствуют.

## Acceptance checklist

| Требование TASK-005 | Статус | Доказательство |
|---|---|---|
| Предыдущий TASK реально проверен, шаги текущего выполнены |PASS|before.json,48 preserved route seeds и accepted artifacts |
| Brand-text→accent fail |PASS|child exit1, normal text threshold |
| Raw hex вне tokens fail |PASS|actual Stylelint CLI exit2 |
| Focus sand≥3 и normal text≥4,5 |PASS|25/17 tests, computed browser colors + Tab |
| Shadow/alpha без необоснованных исключений |PASS|raw shadow rejected, token shadow/overlay accepted, compositing tests |
| Все25 значений соответствуют CSS |PASS|contrast.json + независимый culori |
| Scoped UI script/CI и dependency/bundle delta |PASS|UI lint/test:design, CI step,48 rows |
| Нет отключения lint/auth/domain rules |PASS|targeted checks без suppressions, product TS не менялся |
| Source/HEAD/digest, исходная dirty работа сохранены |PASS|before/final manifest и source-preservation |
| Журнал/матрица/status/stack/handoff обновлены |PASS|ссылки выше и README |
| Нет выдуманного API/прав/цифр, историческое отделено от нового |PASS|локальные synthetic данные, отдельные legacy gaps |
| DB/migrations/production не изменены |PASS|ни одной DB/provider команды |

## Не проверено, остатки и handoff

Whole-repo regression, deployed CI, full product WCAG/ACL/i18n, рабочие DB/provider checks —
NOT_RUN в этом scoped TASK. UI-only evidence не является FND-GATE/LEGAL/FIN-LEGAL/Meet/OAuth/G4/production GO.
Блокеров текущего TASK нет. Provisional palette требует отдельной визуальной приёмки.

TASK-006 получает canonical font tokens и 48/44/36 target tokens без изменения Golos/Lucide.
TASK-007 продолжает API/комплектность controls, TASK-012/015 — state/localization gaps,
TASK-035/058/067/071 удаляют конкретные legacy allowlist records при миграции CSS.
TASK-071/072 получают галерею и k8k-route-v1 baseline; существующие 74 OPEN из TASK-004
не закрыты автоматически. Inline TSX style migration не заменяется CSS Stylelint.

## Риски и обратимость

Новый фокус применяется ко всем интерактивным элементам opt-in data-k8k, в том числе вне Shell;
в legacy theme без data-k8k этого изменения нет. UI primitive styles проверены на synthetic render,
полная продуктовая визуальная регрессия остаётся в назначенном gate.
Откат ограничен TASK-005 CSS/tooling/scripts/config/dev-dependency hunks по before/;
нельзя стирать пользовательские более ранние dirty файлы. Старые snapshots/output/архивы сохранены.
Reset/clean/stash/commit/merge/push/deploy/миграции/seed не выполнялись.

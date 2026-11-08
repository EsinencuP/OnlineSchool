# TASK: TASK-006

Статус: **DONE**. Только TASK-006; TASK-007 не начат. Шрифт/размеры provisional.

## Основа

HEAD `171db2142858e035594737e141d422fa5378e844`, ветка `feat/k8k-design` сохранены.
Build-time dirty digest `59e4a81081966a3b5f6c4fa0eaeccc04585d102987cf79765f226de3556049c3`;
source digest `0eadb8c2ebb7f0a0bbf4390d75672d2d32882fef94610f7a04ea06bc4ce5a0bc`. [Bundle](runs/2026-11-03T21-57-30.880Z/bundle.json) содержит456 input hashes.
Digest — tracked patch на момент сборки до bookkeeping; source manifest исключает mutable docs/output.
[До реализации](before.json) сохранены429 файлов/binary patch. Prerequisite TASK-005:
426/426 input hashes совпали, реальный verification PASS. [Сохранность](source-preservation.json)
подтверждает разрешённый diff, прежние outputs/архивы/ветку/index.

## Уточнение покрытия источников

Предыдущие inventory-derived source manifests охватывали только перечисленные inputs;
часть shared UI/CSS не входила в список. Исходные429 копий и before.json не переписаны.
В финальный manifest добавлены реальные source trees UI/account-ui/трёх кабинетов:
456 inputs, включая style.css/tokens.css/index/shell/controls/icon и CSS приложений.
[Source coverage](source-coverage.json) проверяет ранее пропущенные19 файлов: сохранённые
TASK-001 bytes или Git HEAD с CRLF filters, новые авторизованные font assets либо
каноническое восстановление CSS из сохранённого HEAD+binary patch.
Для style/tokens отдельного raw SHA до задачи не было; [patch recovery](patch-recovery.json)
в изолированном repo восстановил точное Git-canonical содержимое. Исходные line-ending
bytes не выдаются за отдельно сохранённую копию. [Reverse-hunk проверка](reconstruction/verification.json)
дополнительно получила побайтно тот же emitted student CSS, что TASK-005.
[CSS diff](css-task006.patch) показывает только текущие typography/font/Avatar изменения.
Старые результаты остаются действительными для указанного в них scope, не полным source backup.

## Что уже существовало / что изменено

Были Golos5.2.8, два WOFF2/swap/scale,24 static Lucide0.468 glyphs, decorative Icon,
обязательный IconButton label, Avatar initials. Latin cmap не покрывал часть RO букв —
[исходный CDP probe](font-glyph-discovery.json). Общие typography/Avatar bounds были неполными.

| Путь | Изменение / причина |
|---|---|
| packages/ui/src/fonts/ | Derived RO subset3544, OFL/source/provenance, одна семья/wght400–900 |
| packages/ui/src/style.css | Третий local face/?no-inline, реальные Unicode ranges, shared typography/data/body/tabular, Avatar44/name wrap |
| packages/ui/src/icon.tsx | IconName/IconProps(name,optional size/className), прежние static glyphs, aria-hidden/focusable=false |
| packages/ui/src/controls.tsx | Grapheme initials через Intl.Segmenter и полный named Avatar в AX |
| packages/ui/tests/typography.test.mjs, typography/ | Font/export/range/Icon/Avatar/budget tests и synthetic specimens |
| scripts/k8k-font-assets.py, k8k-font-requirements.txt | Reproducible generation/check, pinned isolated Python tools |
| scripts/k8k-route-budget-core.mjs | v2 считает все3 raw fonts; v1 сохранён; missing/overbudget fail |
| scripts/k8k-design-evidence.mjs | Guard против v1 измерения нового third-font policy |
| scripts/k8k-typography-evidence.mjs, package.json | Scoped safe build/browser/font commands |
| docs/ui-stack.md, log/matrix/status | Provenance, dependency/size delta и handoff |

[Design note](design-note.md) до реализации. API/DTO/SDK/миграции/auth/domain/command queues
не менялись. Icon name-only consumers совместимы; IconButton label остаётся обязательным.
Generated Orval/Prisma вручную не правились. Массовой миграции legacy CSS не было.

## Источники и решения

TASK-006 §§3/5–8/10/12; AGENTS owner scope/preservation; PHASE0_CHECKS запрет DB suites;
план этап1, design §§2–7/3.2, VIS-10/11/UX-AUD-08, текущие status/matrix.
Owner/CON правила сохранены, template не источник данных/прав. Actual exports/unicode.json/
metadata Golos5.2.8 и installed Lucide0.468 types проверены; compatible Lucide0.460/Fontsource
Context7 docs — только для API, stack не обновлён. Generation options проверены по
[первичной документации FontTools](https://fonttools.readthedocs.io/en/latest/subset/).

## Fonts / зависимости / бюджеты

[Registry metadata](existing-dependencies.json): Golos5.2.8 OFL-1.1 (17.09.2025),
Lucide0.468 ISC (05.12.2024), React18 peer совместим. JS dependencies/lockfile прежние.
Только isolated dev tools FontTools4.60.1 MIT (29.09.2025), Brotli1.1.0 MIT (07.09.2023),
старше14 дней: [PyPI metadata](font-tool-metadata.json), pinned requirements. --target/--no-deps
не меняет глобальный Python; готовые WOFF2 и JS tests работают без Python.

Full latin-ext19180 превысил бы manager headroom; вместо него получен subset3544 из установленного
font, с ĂăȘșȚț/Şş и прежней wght400–900. Исходные Cyrillic/Latin assets не менялись;
âî/ÂÎ уже в Latin. OFL/copyright сохранены. Cmap и CDP подтверждают современные10 RO и8 RU букв
в custom Golos. Upstream legacy Ţţ/NFD marks отсутствуют: readable system fallback;
человеческий текст не нормализуется/переписывается. Второй UI font не введён.

Все3 raw fonts =63492 (22032+37916+3544). [Network](font-network.json):16 loaded cases×63492,
16 blocked cases×0; каждый subset1 GET/page, независимо от числа компонентов/начертаний.
Измерены body bytes, не headers/CDN transfer.32/32 external sentinels aborted, serviceworkers blocked.

v2 = прежняя static/lazy closure/gzip9/dedup + явный третий font. JS lockfile/Node/Vite/zlib/aliases
неизменны. Delta разделена на code/font, policy upgrade не выдан за оптимизацию v1.
[48 строк](runs/2026-11-03T21-57-30.880Z/bundle.md), [JSON](runs/2026-11-03T21-57-30.880Z/bundle.json), optional passkey closure тоже PASS.

| App | Max bytes | Code delta | Font delta | Total delta |
|---|---:|---:|---:|---:|
| Student |191267|197|3544|3741|
| Platform |129314|202|3544|3746|
| Manager |241999|208|3544|3752|

Функции ради веса не удалялись;715 legacy Stylelint entries не расширены. Старые artifacts сохранены.

## Проверки — команды/exit/evidence

Точные команды: [checks.json](checks.json).

| Команда | Exit | Результат |
|---|---:|---|
| pip install --target output/k8k-tasks/TASK-006/tooling --no-deps --only-binary=:all: -r scripts/k8k-font-requirements.txt |0| Изолированные pinned dev tools |
| python -B scripts/k8k-font-assets.py generate |0|3544 bytes, SHA256/cmap/axis/license provenance |
| pnpm k8k:fonts:check |0| Byte-identical regeneration/cmap/license/axis; [log](font-check-final.log) |
| pnpm --filter @online-school/ui build |0| Targeted tsc до dist tests; [log](ui-build.log) |
| pnpm --filter @online-school/ui test |0|103/103; [log](ui-test.log) |
| pnpm --filter @online-school/ui lint |0| ESLint +9 CSS,715 legacy,0 unexpected/stale; [log](ui-lint.log) |
| scoped eslint --max-warnings 0 |0| [Log](eslint.log), без отключения правил |
| scoped prettier --check |0| [Log](format-final.log) |
| pnpm k8k:typography:evidence |0| [Verification](runs/2026-11-03T21-57-30.880Z/verification.json):48 budgets,32 PNG,456 unchanged source hashes,0 browser errors |
| Python -B source/archive hashes и scoped git diff --check |0| [source-preservation.json](source-preservation.json) |

Первый range test нашёл лишний U+2074 против installed unicode.json — исправлено.
Малый font первоначально встроился Vite как data URL; missing-font budget check дал fail/nonzero.
?no-inline исправил эмиссию, не ослабляя проверки (API подтверждён installed Vite source).
JSON provenance отформатирован после format failure. Промежуточные runs сохранены;
единственный принятый run: **2026-11-03T21-57-30.880Z**. Whole-repo regression не запускалась.

## Визуальные/AX доказательства и acceptance

[Галерея](runs/2026-11-03T21-57-30.880Z/gallery.html), [metadata](runs/2026-11-03T21-57-30.880Z/visual.json), [ручной просмотр](visual-review.json).
Synthetic /synthetic-typography:RU/RO×360/768/1024/1280×student/staff×loaded/blocked=32 PNG.
Frozen time/Europe-Chisinau/reduced-motion; long names/RO/RU/NFD;9 классов + unknown-result.
Просмотрены ro360 loaded и ro1280 fallback; финальные PNG побайтно совпали с просмотренными.

| Критерий | Статус | Доказательство |
|---|---|---|
| Prerequisite/все шаги TASK |PASS|before.json, реальный TASK-005 source/verification |
| CDN заблокирован, текст читается |PASS|32 sentinel aborts, только local font URLs, screenshots |
| RO диакритики видны |PASS|cmap/ranges, CDP actual custom Golos glyphs, visual |
| Font failure readable fallback |PASS|16 blocked cases,0 delivered bytes, system platform fonts/видимый текст |
| Decorative Icon не дублируется |PASS по AX|SVG отсутствует в AX; каждый control имеет имя; actual speech NOT_RUN |
| Long name не расширяет body |PASS|32 scrollWidth≤viewport; Avatar44; grapheme/full-name tests |
| Fonts не загружаются дважды |PASS|3 unique GET/page, каждый1 раз,63492 bytes |
| Шкала/операционные данные/student/tabular |PASS|computed12/14/16/18/22/28/36, data≥14/body16/tabular-nums |
| Static Lucide/одна семья/no photos |PASS|source tests, single Golos+fallback, initials Avatar |
| Budget≤250KiB/fonts/dedup |PASS|48/48 v2, max241999; все3 fonts, code/font delta |
| Контракты/linters/auth/domain rules сохранены |PASS|103 tests + scoped lint; API/security не менялись |
| HEAD/digests/dirty work/archive preservation |PASS|before/final hashes, ограниченный diff |
| Журнал/матрица/stack/status/handoff |PASS|TASK-006 rows и README |
| Нет выдуманных API/прав/цифр/исторических PASS |PASS|synthetic данные, свежие codes отдельно |
| DB/migrations/production без изменений |PASS|DB/provider/seed/deploy команды не выполнялись |

## Не проверено / остатки / обратимость

Actual NVDA/Narrator speech, полный product WCAG/roles/i18n, deployed CI, DB/provider и
recursive regression — NOT_RUN: текущие проверки source/UI fixtures. Это не FND-GATE/
LEGAL/FIN-LEGAL/Meet/OAuth/G4/production GO. Блокеров TASK нет; шрифт/размеры provisional.
StateBoundary/FreshnessLabel RU на RO остаётся TASK-012/015; legacy typography — TASK-035/058/067/071.
TASK-007 получает IconName/IconProps, обязательный IconButton label, Avatar grapheme/full-name и
shared typography classes/tokens. Полный control API здесь не реализуется. TASK-071/072 получают
specimens/network/v2 baseline; прежние74 OPEN не закрываются автоматически.
Откат ограничен TASK-006 hunks/new assets/helpers по before/, без стирания исходной dirty работы.
Архивы/output history сохранены; reset/clean/stash/commit/merge/push/deploy не выполнялись.

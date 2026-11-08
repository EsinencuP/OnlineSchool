# UI stack K8K — фаза 2

03.11.2026. Общая оболочка и состояния — нейтральный `@online-school/ui`. `account-ui` сохраняет доменное меню/смену аккаунта и SDK. Прежний preview сохранён в `.codex/k8k-before-phase2`, не используется приложениями и не является готовой фазой 1.

| Зависимость | Версия | Лицензия | Релиз | Назначение |
| --- | --- | --- | --- | --- |
| @fontsource-variable/golos-text | 5.2.8 | OFL-1.1 | 17.09.2025 | Два локальных WOFF2 cyrillic/latin, font-display swap; 22 032 + 37 916 байт |
| lucide-react | 0.468.0 | ISC | 05.12.2024 | Ограниченный статически импортированный набор значков оболочки, aria-hidden |

Версии/лицензии/даты повторно проверены через npm registry (`pnpm view … version license`, `pnpm view … time --json`). Peer Lucide допускает React 18.3.1; оба выпуска старше 14 дней. React/DOM 18.3.1, TypeScript 6.0.3 и types React 18.3.31 уже используются в монорепозитории. Никаких CDN, Tailwind, CSS-фреймворков или серверных зависимостей. Установка `--offline --ignore-scripts` не запускала генерацию SDK/БД.

Неверные ссылки на отсутствующие subset CSS удалены после провала Vite: этот выпуск Fontsource подключается явными font-face через экспортированные files/*.woff2 с unicode-range установленного пакета. Неудачный вариант не сохранён.

Палитра/шкала provisional по разделу 3; VIS-13/14/16 открыты. 17 пар контраста проверены тестом WCAG. Это **не замена** обязательным culori/Stylelint/Storybook/Radix задачам полной фазы 1. Новое мобильное меню немодальное; доменные диалоги остаются прежними.

Прирост по каждому маршруту: [bundle.json](../output/k8k-phase2/bundle.json), baseline — изолированная production-сборка main 5f3c6f0 из фазы 0. Сумма gzip JS/CSS по статическим импортам плюс оба WOFF2 целиком (59 948 байт). Единая сборка включает legacy и opt-in; legacy не использует новый шрифт. Все 16 маршрутов проходят 256 000 байт; максимум **233 663 байта**. Code/total delta записаны отдельно.

Сравнение ограничено: baseline использует изолированный исходник account-ui, текущая сборка — emitted workspace package; границы чанков могут отличаться. Это не измерение Vercel production или сетевых заголовков сервера.

## Инкремент функционального редизайна — 03.11.2026

Новых зависимостей нет. Добавлены доменно-нейтральные Button/IconButton/Field/StatusChip/Avatar/Card и typed ru/ro locale store; полного UI-kit/перевода/Storybook это не завершает. Контраст:17 пороговых +25 документированных сочетаний + проверка недопустимого назначения accent. Старый k8k-design-check перенаправлен на актуальные тесты packages/ui.

Измерение текущих assets (gzip всех JS/CSS плюс исходные WOFF2): student187608 байт, platform125382 байта; оба ниже256000. Это измерение инкремента, не дельта к воспроизводимой сборке исходного main. Итоговая отчётность: output/k8k-implementation. Manager route-budget в этом инкременте не пересобирался.

## TASK-004 — единая route-budget методика, 03.11.2026

Новых dependencies нет. Текущая воспроизводимая основа:
[bundle.json](../output/k8k-tasks/TASK-004/runs/2026-11-03T21-10-19-078Z-0b1240/bundle.json)
и [таблица](../output/k8k-tasks/TASK-004/runs/2026-11-03T21-10-19-078Z-0b1240/bundle.md).
Метод `k8k-route-v1`: fresh production Vite7.3.7 source builds с manifest для всех3
frontend, route entry + рекурсивные static JS/CSS imports + явно выбранные lazy page/tab
roots. Shared file учитывается один раз. JS/CSS сжимаются отдельно gzip(level9),
Golos cyrillic22032 +latin37916=59948 исходных WOFF2 байт входят в total каждого маршрута.
Оба subset начисляются и для маршрутов/локалей, где один пока не используется.
Отложенные lazy imports перечислены; passkey-browser action на manager login измерен
отдельно:178457 байт вместе с fonts. Никакие функции/legacy branches не удалялись ради веса.

48/48 inventory entrypoints проходят256000 байт: student max187379, platform max125408,
manager max238089 (`/manager/students/:id?tab=schedule`), запас17911 байт. Это размеры
выбранной route closure, не суммирование всех чужих lazy страниц или измерение HTTP/CDN.
Source/lockfile/manifests/assets hashes, Node/Vite/zlib и build settings сохранены.

Дельты к прежним187608/125382 и phase0/phase2 **unavailable/null**: нет совпадающей
route/build/dirty provenance, gzip defaults/alias/chunk/font policy отличаются.
Исторические значения выше не переписаны и не выданы за новые. Assets нового build
побайтно совпали с TASK-003 renderer build (student4/4,manager29/29,platform4/4),
но тот run не имел route manifests: это cross-reference, не отдельная route delta.
Текущий run — первая полная baseline этого метода для будущих сопоставимых изменений.

[Реестр](../output/k8k-tasks/TASK-004/runs/2026-11-03T21-10-19-078Z-0b1240/defects.md)
содержит74 OPEN записи с reproduction/impact/evidence/inherited-regression/future TASK.
Бюджет PASS не закрывает эти дефекты, UI/ACL/WCAG/FND/LEGAL/Meet или production gate.


## TASK-005 — семантический CSS guard, 03.11.2026

Палитра и размеры остаются provisional (VIS-13/14/16 не закрыты).
Единственный источник значений — packages/ui/src/tokens.css. Добавлены семантические
hover/disabled и 48/44/36 control tokens, сохранены исходные 25 цветовых сочетаний.
25 чисел сверены независимым culori, 17 порогов сохранены; accent на sand 2,78:1
не допускается для graphics, accent не применяется к тексту/кнопкам.

| Новая dev dependency | Pin | License | Релиз / возраст на 03.11.2026 | Назначение |
|---|---|---|---|---|
| stylelint | 16.26.1 | MIT | 28.11.2025 / 339 дней | CSS AST, scoped token rule и CLI failure |
| culori | 4.0.2 | MIT | 27.06.2025 / 493 дня | Независимый WCAG contrast и проверка распознавания цветов |
| postcss-value-parser | 4.2.0 | MIT | 29.11.2021 / 1799 дней | var/fallback/shadow/alpha/font AST без blanket исключений |

Node24 совместим; React peer у этих tools отсутствует. Registry metadata сохранены в
[dependencies.json](../output/k8k-tasks/TASK-005/dependencies.json).
Установка --ignore-scripts не запускала postinstall/generate. Все прежние lockfile
importers/packages/snapshots неизменны; добавлены только root dev tools (57 installed packages).
Они не импортируются клиентом. Runtime packages не обновлялись.

`pnpm --filter @online-school/ui lint` включает `lint:css` для 8 CSS-файлов;
`test:design` / root `k8k:design` включают негативные/контрастные пробы и CSS lint.
CI lint job явно вызывает test:design. Raw hex/named/functional colors, alpha в
тенях, var fallbacks, raw font sizes и неканонические font aliases отклоняются.
Canonical tokens — единственная граница literals; прозрачность/currentColor/URL/string
не являются обходом проверки цвета. Stylelint disable не обходит scoped checker.
[715 legacy entries](../packages/ui/tests/stylelint-legacy.json) привязаны к точному
path/context/property/value/occurrence/reason и TASK удаления. Новые/изменённые,
duplicate/stale entries fail; UI package не имеет исключений. TSX inline styles и полный
продуктовый CSS migration остаются для соответствующих задач и TASK-071.

Сопоставимая delta к TASK-004 по k8k-route-v1:
student +147 →187526, platform +160 →125568, manager +158 →max238247 байт.
Оба WOFF2 59948 байт без изменения. 48/48 routes и optional passkey closure проходят256000.
[Bundle](../output/k8k-tasks/TASK-005/runs/2026-11-03T21-34-16.851Z/bundle.md),
[отчёт](../output/k8k-tasks/TASK-005/report.md). JS/CSS gzip delta включает изменения
references/chunk names; это не сетевые Vercel headers или production performance.


## TASK-006 — Golos RU/RO и Icon, 03.11.2026

Golos5.2.8 OFL-1.1 (17.09.2025), Lucide0.468 ISC (05.12.2024) сохранены;
[registry metadata/React18 peer](../output/k8k-tasks/TASK-006/existing-dependencies.json).
Новых JS/runtime dependencies нет; JS lockfile неизменен. Семейство/размеры provisional.
Исходные Cyrillic22032/Latin37916 не покрывали все современные RO буквы.
Добавлен derived RO subset3544 из имеющегося latin-ext19180: ĂăȘșȚț и поддерживаемые Şş,
в той же семье Golos, wght400–900, swap. âî/ÂÎ уже в Latin. [OFL/source](../packages/ui/src/fonts/SOURCE.md),
[hashes/cmap/axis](../packages/ui/src/fonts/provenance.json). Legacy Ţţ/NFD marks отсутствуют
в upstream cmap и остаются readable fallback; человеческий текст не переписывается.
Source CSS ranges сверены с Fontsource5.2.8 unicode.json; лишний U+2074 удалён.
?no-inline (подтверждён installed Vite7.3.7 source) оставляет отдельный WOFF2 asset.

Только isolated Python dev generation/check tools: FontTools4.60.1 MIT,29.09.2025;
Brotli1.1.0 MIT,07.09.2023. Оба старше14 дней. [PyPI metadata](../output/k8k-tasks/TASK-006/font-tool-metadata.json),
[pinned requirements](../scripts/k8k-font-requirements.txt). --target output/k8k-tasks/TASK-006/tooling
--no-deps --only-binary=:all: не меняет глобальный Python; browser/UI tests используют готовый font без Python.
Static named Lucide imports сохранены; dynamic glyph/CDN нет. Icon decorative, имя у control.
Avatar44 с grapheme initials/full accessible name, без фото. Новые данные≥14/body16,
scale12/14/16/18/22/28/36/tabular-nums.715 legacy Stylelint entries не расширялись.

**k8k-route-v2** сохраняет v1 static/lazy closure/gzip9/dedup и считает все3 raw fonts:
63492 (+3544). Старые v1 artifacts не переписаны; TASK-005 helper явно отклоняет новый font policy.
Manager max241999 (запас14001), [все48 rows/code-font delta](../output/k8k-tasks/TASK-006/runs/2026-11-03T21-57-30.880Z/bundle.md).
[Network](../output/k8k-tasks/TASK-006/font-network.json):3 unique GET/page,63492 font body bytes;
0 bytes при blocked fonts, readable fallback. Не Vercel transfer headers/production performance.
Full legacy typography/voice/WCAG — TASK-007/035/058/067/071.


## TASK-007 — native controls, 04.11.2026

Новых dependencies нет; React18.3.1/Vite7.3.7/Golos/Lucide и JS lockfile сохранены.
Доработан существующий controls.tsx: native attrs/ref/default button type, external pending/error,
Select с native option/optgroup/keyboard, hint+error/merged describedby, Button disabledReason,
unknown StatusChip neutral RU/RO, Card native section/heading/actions, Avatar full name/fallback.
Density compact — explicit staff desktop/fine pointer min36; touch44/student primary48.
Никакого SDK/session/ledger/authorization computation в primitives/stories.
CSF stories без установки Storybook до TASK-013: packages/ui/stories/controls.stories.tsx;
они отрендерены local consumer fixture. UI labels/unknown fallback RU/RO; app-level error
summary остаётся у приложения, older translation gaps не объявлены исправленными.

Безопасный consumer — K8K Student Profile; legacy и command/save hooks не переписывались.
[AST proof](../output/k8k-tasks/TASK-007/consumer-source-proof.json),
[React review](../output/k8k-tasks/TASK-007/react-review.json).
111 UI tests,49 browser cases/80 PNG, strict fixture typecheck и Stylelint10 CSS (715 legacy entries неизменны).
[Сопоставимый v2 bundle delta](../output/k8k-tasks/TASK-007/runs/2026-11-03T22-17-03.782Z/bundle.md):
student192650 (+1383), platform130391 (+1077), manager max243227 (route deltas1221…1230).
Fonts63492 прежние;48/48≤256000, optional passkey closure тоже PASS. Runtime libraries не добавлены.
Storybook runtime/full UI-kit/translation/role/WCAG acceptance — соответствующие будущие TASK.


## TASK-008 — Radix overlays, 04.11.2026

| Новый direct runtime pin | License | Release / age | Назначение |
|---|---|---|---|
| @radix-ui/react-dialog1.1.6 | MIT | 05.02.2025 /636 дней | focus trap/restore, modal background isolation/scroll; Dialog и Drawer |
| @radix-ui/react-alert-dialog1.1.6 | MIT | 05.02.2025 /636 дней | safe Cancel, explicit controlled async ConfirmDialog |
| @radix-ui/react-popover1.1.6 | MIT | 05.02.2025 /636 дней | nonmodal anchored info/collision handling |
| @radix-ui/react-dropdown-menu2.1.6 | MIT | 05.02.2025 /636 дней | roving keyboard/typeahead/disabled caller-eligible actions |

ReactDOM18.3.1 уже использовался dev в UI; объявлен runtime для portal. React18.3.1 сохранён.
@types/react-dom18.3.7 (MIT,30.04.2025 /552 дня) явно закреплён dev, версия уже есть в workspace.
Все pins проверены по registry, installed d.ts и peers React18. Нет latest/metapackage/React19 upgrade.
[Metadata](../output/k8k-tasks/TASK-008/dependencies.json),
[все40 новых locked packages](../output/k8k-tasks/TASK-008/dependency-policy.json):
MIT/допустимые SPDX, min age115 дней, все≥14; pnpm-lock сохраняет precise resolution.
[Lock delta](../output/k8k-tasks/TASK-008/lock-delta.json):1139 прежних package records и все
прежние snapshot records без изменения/удаления, +40 packages; UI importer changes only.
Install --ignore-scripts, без других stack upgrades.

[API/handoff](../output/k8k-tasks/TASK-008/handoff.md): UI только поведение/семантика;
app owns open/pending/dirty/unknown/requestClose/side effects. ConfirmAction не auto-close,
close не abort/rollback. No forceMount/exit retention; session owner unmounts private subtree.
Existing account-ui/native guarded dialogs не мигрированы. Один read-only consumer Profile help,
без SDK/API. CSF/local renderer готовы, Storybook runtime остаётся TASK-013.

[Comparable v2 budget](../output/k8k-tasks/TASK-008/runs/2026-11-03T22-51-32.206Z/bundle.md):
48/48 PASS; student204864 (+12214), platform130854 (+463), manager max243665 (route Δ438…443).
Unused wrappers tree-shake; live Dialog cost входит в student routes, shared CSS входит везде.
Font63492 unchanged; optional passkey184032. Same engine/config/static+lazy closure/gzip9/font policy,
lockfile changed only for the pinned additions. Не production network/CDN performance.
116 UI tests,71 browser cases/66 PNG RU/RO×4 widths; refs/AX names/focus/modal isolation/nonmodal,
nested layers, dirty discard/pending/unknown/revoke доказаны на synthetic noncredential fixtures.
715 legacy CSS exceptions прежние; full migrations/role/session/AT/WCAG/business gates отдельно.


## TASK-009 — составные компоненты, 04.11.2026

| Пакет | Pin | Лицензия | Релиз | Назначение |
|---|---|---|---|---|
| @radix-ui/react-tabs | 1.1.3 | MIT | 05.02.2025 | Роли вкладок, стабильные ID, roving focus |
| @radix-ui/react-tooltip | 1.1.8 | MIT | 05.02.2025 | Hoverable пояснение, фокус, Escape, позиционирование |
| @radix-ui/react-visually-hidden | 1.1.2 | MIT | 05.02.2025 | Транзитивный accessible tooltip label |

Все три релиза старше 14 дней. Peer resolution использует React и ReactDOM 18.3.1.
Изменения lockfile затрагивают importer UI и три новых package/snapshot records.
Toast реализован одним локальным компонентом с polite/assertive live regions и дедупликацией ID.
[Метаданные зависимостей](../output/k8k-tasks/TASK-009/dependency-policy.json) · [Lock delta](../output/k8k-tasks/TASK-009/lock-delta.json)

Бюджет v2 прошли 48 маршрутов. Максимумы student 205971, manager 244331,
platform 131523 байт. Три локальных WOFF2 составляют 63492 байта в каждом маршруте.
Изменения JS/CSS gzip9 относительно TASK-008 составляют student +1107, manager +661…668,
platform +669. В student входит реальный Segmented. Неиспользуемые Radix wrappers удаляются сборкой.
[Таблица маршрутов](../output/k8k-tasks/TASK-009/runs/2026-11-04T04-40-16.278Z/bundle.md)

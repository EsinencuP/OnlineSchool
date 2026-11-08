# TASK-026 — абонементы по каждому предмету и точные детали прав

**Статус — DONE в объёме TASK-026.**

## Основа

Ветка `feat/k8k-design`, HEAD `60e2a0c47cbcc744dc658a85f386833146e836b3`. SHA-256 исходного снимка git status `e51ce7e1b5d4fc3dd60f366b85af8b85c2dedd95396fd5e29cd206cd489e2dc5`. Проверены 354 исходные записи и 30 входных копий. Корневой manifest и lockfile совпадают с входными. [Снимок](status-before.txt) · [Хеши](before.json) · [Сохранение](preservation.json)

TASK-024 уже предоставлял предметные статусы, причины, capabilities, финансовые якоря и раздельный временный допуск. TASK-025 добавил главную, предметный хаб и ссылки на абонемент. Старый экран уже читал детали и два вида истории, а компонент предметных абонементов был отключён. В старом чтении отсутствовавший исторический снимок списания мог замещаться расчётным значением. Предыдущие отчёты использованы для сверки входа. Свежие результаты перечислены ниже. [TASK-024](../TASK-024/handoff.md) · [TASK-025](../TASK-025/handoff.md)

## Изменения

| Путь | Поведение |
|---|---|
| `apps/student-cabinet/src/student-widgets.tsx`, `subscription-presentation.ts`, `pages/StudentHome.tsx`, `pages/Subjects.tsx` | Подключён текущий снимок предметов. Главная и список хаба показывают предпочтительный серверный план каждого предмета. Выбранный предмет показывает все возвращённые планы. Срок, заморозка, оплаченный остаток и временный допуск разделены. |
| `pages/Subscription.tsx`, `api.ts` | Один селектор и три запроса по финансовому якорю. Обе страницы сбрасываются синхронно. Возврат, событие сети и видимость запускают повторное чтение. Ошибка 5xx одного блока сохраняет состояние остальных. 403 отзывает данные выбранной группы и отменяет её активные чтения. |
| `pages/Subscription.tsx`, `subscription-copy.ts`, `student.css` | RU/RO, общий exact-decimal formatter, даты из /me.timeZone и неизменные date-only даты. Условия периода и доступ по предмету подписаны отдельно. В истории показаны количества занятий. Ссылка по продлению ведёт на существующую помощь. |
| `apps/api/src/student/subscription/subscription.{dto,sql,service}.ts` | Отсутствующие стороны снимка опубликованного списания возвращаются как `null`. Сервер сохраняет известные значения, остальные типы событий, область чтения, сортировку и пагинацию. |
| `apps/student-cabinet/tests/`, `scripts/k8k-refresh-budget.mjs` | Синтетические предметы, частичная оплата, будущий период, история, отзыв и задержанный ответ. Отдельный browser script и бюджет v2. |

Применены TASK-026 ``3, 5–10, VIS-12 STU-05/V12-AT-01/02/10, DEV-13/B, DEV-14/B и CON-02/B. Финансовый якорь берётся из проекции. При входе по существующей ссылке владение проверяют те же три серверных GET. Доступ из названия плана, платёжной истории или количества занятий не вычисляется. [Design note](design-note.md) · [Передача](handoff.md)

## Контракты, SDK и миграции

Все 146 операций OpenAPI и их пути сохранены. Два обязательных поля `StudentSubscriptionLedgerEntryDto`, `balanceBefore` и `balanceAfter`, теперь принимают `string | null`. Числовые строки в существующих известных снимках сохраняются. Orval и типы обновлены штатными командами. Миграций, backfill, расчёта новых прав и финансовых команд нет. [Сравнение контракта](contracts.json)

## Свежие проверки

| Команда | Код | Результат |
|---|---:|---|
| `pnpm --filter @online-school/api typecheck` | 0 | Целевая сборка API. [Лог](api-build.log) |
| `pnpm test:stu07 --roots tests` | 0 | 60 тестов unit и Nest HTTP с моками БД. Точные суммы, scope, прежние guards, no-store и nullable снимок. [Лог](stu07.log) |
| `pnpm --filter @online-school/api export:openapi` с no-DB preload TASK-018, затем `pnpm --filter @online-school/api-contracts generate:client` и `typecheck` | 0 | 146 операций, штатная генерация. [Лог](generate.log) |
| `pnpm --filter @online-school/student-cabinet typecheck` и `lint` | 0 | [Типы](typecheck.log) · [Lint](lint.log) |
| `pnpm exec eslint` для трёх изменённых TS-файлов API и двух STU-07 suites с `--max-warnings 0` | 0 | [Лог](api-lint.log) |
| `pnpm exec stylelint apps/student-cabinet/src/student.css --ignore-disables` | 0 | [Лог](stylelint.log) |
| `pnpm --filter @online-school/student-cabinet test:presentation` | 0 | 10 тестов, включая финансовый якорь, ноль, null и отсутствие плана. [Лог](presentation.log) |
| Vite `build({envDir:false, publicDir:false, logLevel:'error', build:{emptyOutDir:false}})` через `pnpm --filter @online-school/student-cabinet exec node --input-type=module` | 0 | Целевая локальная сборка кабинета. [Лог](build.log) |
| `pnpm --filter @online-school/student-cabinet test:subject-subscriptions` | 0 | 10 локальных Chromium-сценариев, 24 кадра RU/RO × 4 ширины и 6 axe-проверок на 360 px. [Лог](playwright.log) |
| `pnpm --filter @online-school/student-cabinet exec playwright test --config playwright.subject-subscriptions.config.mjs subject-subscriptions.spec.mjs --grep "future NONE"` | 0 | Повтор адресного сценария с переходом loading → empty. [Лог](states-smoke.log) |
| `pnpm --filter @online-school/student-cabinet exec playwright test --config playwright.subject-subscriptions.config.mjs subject-hub.spec.mjs --grep-invert subject-baseline` | 0 | 14 регрессий хаба и маршрутов. Снимки сохранены отдельно от TASK-025. [Лог](hub-regression.log) |
| `node output/k8k-tasks/TASK-026/check-isolated-fixture.mjs` | 0 | Три строки и три финансовых перехода в изолированном компоненте при 360 px. [Лог](isolated-fixture.log) |
| `node scripts/k8k-refresh-budget.mjs --task-026` | 0 | 50/50 маршрутов до 256 000 байт с учётом шрифтов. Кабинет ученика 231 868 байт, максимум по пакету 255 964 байта. [Замеры](budgets.json) |

## Визуальные доказательства

Роль STUDENT, тема `ui.k8k=1`, имя из 100 символов, RU/RO, 360/768/1024/1280. Синтетический loopback `127.0.0.1:4175`. В фикстуре America/New_York проверяет переход через полночь у времени платежа и неизменность даты окончания.

| Поверхность | Примеры |
|---|---|
| Главная | [RU 1280](after/ru-1280-dashboard.png) · [RO 360](after/ro-360-dashboard.png) |
| Хаб и детали | [Хаб RU 768](after/ru-768-hub.png) · [Детали RO 360](after/ro-360-details.png) |
| Доступ и история | [Временный допуск](states/partial-with-admission.png) · [Будущий план](states/future-none.png) |
| Состояния источника | [Loading](states/subjects-loading.png) · [Empty](states/subjects-empty.png) · [Error](states/subjects-error.png) · [Stale](states/stale.png) · [403](states/forbidden.png) |
| Изолированный компонент | [RU 360](states/isolated-fixture.png) |

## Приёмка

| Критерий | Статус | Доказательство |
|---|---|---|
| Абонементы на главной и в хабе из TASK-024 | PASS | Независимые строки активной математики, истёкшей физики и замороженного английского. |
| Заморозка, срок, разрешённые материалы и ДЗ | PASS | Серверные capabilities, точные ссылки, отсутствие Meet на экране финансов. |
| Неполная оплата, директорский допуск и полная оплата | PASS на fixture | Оплаченный остаток 0 и допуск 2 показаны отдельно. После нового снимка остаток 5, отдельный допуск исчезает. |
| Финансовый anchor, выбор второго плана, сброс страниц и поздний ответ | PASS | Все три GET одного плана. Оба history GET начинают с первой страницы. Тест удерживает и завершает старый ответ. |
| Точные суммы и валюты | PASS | 600,1234 MDL, 1,005 EUR, 0,00 MDL и USD. Общий форматтер строк. |
| Будущий план, NONE, ноль, null и отказ источника | PASS | Future сохраняет выбранную историю платежей. Нет плана, загрузка и ошибка представлены отдельными состояниями. |
| Заморозка, разморозка, корректировка и отмена списания | PASS на fixture | История сохраняет записи и отдельные количества до и после. Отсутствующий исторический снимок помечен неизвестным. |
| Stale, 403 и общий guard | PASS | Читаемый stale, без новых действий. 403 удаляет выбранную историю. 401/402 и чужой якорь проверены. |
| RU/RO, 360/768/1024/1280, фокус и touch | PASS | Визуальная матрица, axe на 360 px, сохранение фокуса селектора, высота ссылок 44 px. |
| Источник, no-store и SDK | PASS | Совместимые GET и штатная генерация, API mock tests. |
| Рабочая БД, реальные платежи, полный ролевой gate | NOT_RUN | Проверки выполнены на локальных fixtures. |

[Машиночитаемая приёмка](../../k8k-taskpack/task-026/acceptance.json)

## Передача и обратимость

TASK-027 получает путь из абонемента к действующей помощи. TASK-035 получает ролевую приёмку. Прежний общий обзор сохранён для старого интерфейса до такой приёмки. Ограничения исходной проекции, включая отсутствие будущих периодов в списке и старые отсутствующие снимки, описаны в передаче. Рабочая БД, production и применённые миграции в задаче не менялись. [Передача](handoff.md)

Откат ограничивается изменёнными путями из `before/` и новыми файлами TASK-026. Если возвращаются исходные DTO, SDK воспроизводится штатной генерацией. Исходные незакоммиченные изменения и предыдущие артефакты сохранены.

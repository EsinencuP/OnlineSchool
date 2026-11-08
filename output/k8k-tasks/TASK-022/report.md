# TASK-022 — серверный источник критического события и очереди

**Статус — PARTIAL.** Контракт и потребитель проверены. Для активации нужен подтверждённый источник критичности и критерий primary.

## Основа

Ветка `feat/k8k-design`, HEAD `60e2a0c47cbcc744dc658a85f386833146e836b3`, dirty digest `42c976241f3a411477e8442fe572807822cd8f4ceebd27950bf8a775da7bf2f4`. До редактирования подтверждены 156 хешей, 50 браузерных сценариев и 48 бюджетов TASK-021. Все 321 исходные записи статуса остались в рабочем дереве. Сверены 25 входных копий и 9 защищённых исторических файлов. [Основа](basis.json) · [Сверка](preservation.json)

## Исходный код, изменения и границы

`PriorityEvents`, общий dashboard GET, scoped CRM-очередь, отдельный claim и worker дедлайнов уроков уже существовали. `overdueTasks` агрегирует просрочку; отдельные отметки `escalatedAt` относятся к процессам переноса и спора. `VIS-07/B §7.1.1` оставляет выбор primary открытым. `OPS-01/B §5` устанавливает срок явного принятия уже классифицированной задачи и маршрут передачи руководителю. `SCH II №7.1–7.3`, `DEV-09/B` и VIS-12 MGR-03 определяют рамки, а в текущих producer/schema отсутствует авторитетный источник критичности для этой очереди. [Аудит и точная зависимость](source-audit.md)

| Путь | Изменение |
|---|---|
| `apps/api/src/modules/manager/dto/manager-dashboard.dto.ts`, `apps/api/src/openapi/dtos.ts` | Дополнен ответ `getManagerDashboard`. `priority` отсутствует при неподключённом источнике; `null` обозначает недоступность источника; объект передаёт `primary`, `criticalCount`, `queueAction`, `sourceAsOf`. Подтверждённая пустая очередь имеет `primary:null` и `criticalCount:0`. |
| `apps/manager-web/src/pages/Dashboard.tsx` | `PriorityEvents` получает снимок из существующего dashboard query. Ссылки ведут на `/manager/tasks/:id` и `/manager/tasks`. Сбой источника показывает ошибку с повтором GET. При сбое dashboard прежний счётчик скрывается, а общий `State` показывает stale. |
| `packages/ui/src/state.tsx`, `priority.tsx`, `style.css` | Существующий компонент размещён в уже общем модуле, точка импорта сохранена. Длинное название переносится. При смене события меняется содержимое слота. |
| `scripts/k8k-priority-evidence.mjs`, `scripts/k8k-refresh-budget.mjs` | Локальные GET fixtures и сборка с теми же маршрутными seeds и порогом, что у TASK-021. |

OpenAPI и Orval SDK сгенерированы штатно. У 145 операций прежние маршруты и метаданные; изменены только схемы `ManagerDashboardDto`, `DashboardPriorityDto` и `DashboardPriorityTaskDto`. `ManagerDashboardService` опускает поле до появления авторитетного источника. Миграций, записей в рабочую БД и новых зависимостей нет. Существующие ACL, claim и worker не менялись. [Design note](design-note.md)

## Свежие проверки

| Команда | Exit code | Результат |
|---|---:|---|
| `pnpm --filter @online-school/api build` и `pnpm --filter @online-school/api export:openapi` | 0 | Сборка и экспорт 145 операций. Финальный экспорт с проверенным preload, запрещающим доступ к БД. [Лог](openapi.log) |
| `pnpm --filter @online-school/api-contracts generate:client` и `pnpm --filter @online-school/api-contracts build` | 0 | Генерация Orval и сборка типов. [Лог](sdk.log) |
| `pnpm test:mgr09 --roots tests` | 0 | 51 проверка. Scoped dashboard, invalid params, `private, no-store`, отзыв контекста, 503, четыре формы поля в SDK. `--roots tests` исключает исторические копии пакетов из поиска Jest; исходная команда без ограничения завершилась кодом 1 до запуска тестов. [Лог](api.log) |
| `node --experimental-vm-modules node_modules/jest/bin/jest.js --roots tests --runInBand --runTestsByPath tests/unit/manager-tasks-http.test.mjs --testNamePattern 'foreign, disallowed\|queue filters\|claim CAS\|cached task replay'` | 0 | 4 адресных проверки штатной очереди, изоляции и явного claim. [Лог](task.log) |
| `pnpm --filter @online-school/ui build` и `pnpm --filter @online-school/ui test` | 0 | 137 тестов. [Лог](ui.log) |
| `pnpm --filter @online-school/ui lint` и адресный `pnpm exec eslint … --max-warnings 0` | 0 | ESLint и Stylelint, DTO/CRM/скрипты/SDK test. [UI](lint.log) · [Адресный lint](scoped.log) |
| `pnpm --filter @online-school/manager-web exec tsc -p tsconfig.json --pretty false` | 0 | Типы потребителя SDK. [Лог](types.log) |
| `pnpm k8k:priority:evidence` | 0 | 36 сценариев, 16 PNG, 76 GET. Реальные Manager Dashboard/Layout/Task/Tasks в локальном Chromium. [Лог](evidence.log) · [Доказательства](browser/browser.json) |
| `pnpm k8k:priority:budget` | 0 | 48/48, максимум 255 840 из 256 000 байт, включая 63 492 байта шрифтов. [Лог](budget.log) · [Расчёт](budgets.json) |

## Визуальные доказательства

Роль MANAGER, `/manager?ui.k8k=1`, RU/RO × 360/768/1024/1280. Синтетические данные получены по существующему GET. Проверены длинный заголовок, Tab, Enter, стабильность меню и фокуса при замене события, скрытие слота при отсутствии поля, error, stale и forbidden. [RO 360, пять событий](browser/ro-360-ready-five.png) · [RU 768, сбой источника](browser/ru-768-unavailable.png)

## Acceptance checklist

| Критерий | Статус | Доказательство |
|---|---|---|
| TASK-021 и аудит существующих источников | PASS | Сверены входы, отделены overdue, дедлайны worker и эскалация переноса/спора. |
| 5 critical → один primary, count 5 | PASS на fixture | Реальный UI показывает один заголовок и полный переданный счётчик. |
| Положительный backend eligibility и полный count по собственному/чужому портфелю | NOT_RUN | Производственный producer отсутствует. Проверены ACL существующих dashboard и queue, включая отзыв контекста и чужой объект. |
| Outage и подтверждённый ноль | PASS | Различаются `null`, 503 с кэшем, объект с `criticalCount:0` и отсутствие поля. |
| Render/read без claim и resolve | PASS | Локальный стенд пропускает только GET; отдельные тесты штатного claim проходят. |
| Новое событие без перестановки меню | PASS | В восьми комбинациях RU/RO и ширины проверены порядок ссылок, DOM и фокус. |
| Эскалация OPS-01/B для production critical queue | NOT_RUN | Понадобится отдельный authoritative producer и связанный worker-сценарий. |
| Локальная визуальная матрица, бюджеты и сохранение дерева | PASS | 16 PNG, 48 бюджетов, контрольная сверка файлов. |

## Следующая работа и откат

Для завершения TASK-022 нужна версия утверждённого каталога или решение владельца о первом наборе критических событий и порядке выбора primary, включая равные случаи. Тогда producer должен в одном снимке проверить текущее назначение, отобрать доступные открытые CRM tasks, посчитать весь набор и вернуть `priority`. TASK-050 получает `getManagerDashboard.priority`, `PriorityEvents`, `['manager','dashboard',horizon,days]`, карточку и очередь. TASK-023 идёт отдельным запросом владельца.

Контракт добавлен опционально. Для точечного отката вернуть hunks из `before/` по `preservation.json` и выполнить штатную генерацию SDK. Полная ролевая/WCAG-приёмка, внешние провайдеры и рабочая БД отложены по правилам Phase 0.

# TASK-017 — приёмка UI-kit и локализации

Статус: **DONE в объёме foundation TASK-005–016**, 04.11.2026.
Техническая приёмка компонентов завершена. Ролевые, release и FND-GATE остаются отдельными.

Основа: HEAD `171db2142858e035594737e141d422fa5378e844`, ветка `feat/k8k-design`,
dirty digest `f5fd3becbc1f779edbd99b3af55618f1b74ec9bee74ca06d57bb3c3eb497acb3`.
[Определение и хеши](basis.json), [исходный status](status-before.txt).
Из 220 входов TASK-016 сохранены 215; изменены только пять перечисленных UI файлов.
Новые gate scripts включены в текущий source manifest. Архивы, пользовательские изменения
и ветка сохранены. Commit/push/deploy, генерация SDK, миграции и обращения к БД не выполнялись.

## Что уже существовало

TASK-005–016 предоставили токены/контраст/CSS guard, локальный Golos, нативные контролы,
Radix overlays, таблицы/колонки, Calendar, StagesTrack, девять VIS-11, typed RU/RO,
account chrome, безопасное отображение ошибок и валидацию. Проверены реальные отчёты
двенадцати prerequisites с хешами, без переноса их старых test counts в свежий результат.
[Prerequisites](prerequisites.json)

## Что изменено

- `packages/ui/src/calendar.tsx`: дополнен публичный `CalendarView` вариантом `month`,
  отсутствовавшим при сверке §3.4. `data-weekday` передаёт ISO weekday существующей даты.
- `calendar.css`: месяц выровнен в семь колонок от 1280 px, две от 768 px и одну на
  узких экранах. Весь текст доступен; overflow не скрывается. Переданные `days/events/horizon`
  остаются единственным источником. Нет автозаполнения событий, расчёта свободных мест или прав.
- `stories/calendar.stories.tsx`: `MonthRange` с 31 синтетической датой, явным частичным
  horizon и повторным DST-часом. `tests/calendar.test.mjs` проверяет отсутствие выдуманной
  coverage/events и сохранение instant/offset. Остальные три calendar views совместимы.
- `stories/foundation-gate.mjs` и scripts `test:foundation`, `test:foundation:budget`:
  локальная acceptance-матрица каталога, axe, focus trap/return, reflow и reduced motion.
- `scripts/k8k-foundation-budget.mjs`: in-memory сборки трёх frontend приложений,
  48 прежних маршрутных планов, три WOFF2, явный BalanceSummary seed и optional passkey closure.
  Проверяется отсутствие Storybook modules в production chunks.
- Обновлены журнал, предметная матрица, текущий implementation status и ui-stack.

Контракты/SDK/миграции: единственное расширение публичного типа —
`CalendarView = 'day' | 'week' | 'month' | 'list'`. Новых props/DTO/wire codes/operations нет.
Существующие consumers прошли typecheck. [Design note](design-note.md)

Источники/решения: TASK-017 §§3/5–10; design §§2–7 и полный перечень §3.4;
VIS-03…12, UX-AUD-01…13, VIS12 §§1–6, текущие AGENTS/PHASE0_CHECKS и owner CON addendum.
Позднейшие утверждения RU/RO/API имеют приоритет над историческими ограничениями.
Использованы frontend-craft и React best-practices review; рекомендации о замене stack
не применялись. Temporal сверён с Context7 upstream и установленным 0.5.1.

## Свежие проверки

| Команда | Exit | Сценарии / артефакт |
|---|---:|---|
| `pnpm --filter @online-school/ui build` | 0 | [UI build](ui-build-final.log), strict locale parity |
| `pnpm --filter @online-school/ui test` | 0 | **137/137**, 25 пар CSS + независимый culori, exact money, civil date, DST, UI states, controls. [Unit](unit-final.log), [контраст](contrast.json) |
| `pnpm --filter @online-school/ui lint` | 0 | [ESLint/CSS](lint-final.log); 16 CSS файлов, 715 прежних legacy declarations, новых/stale нет |
| `pnpm --filter @online-school/ui test:locale:types` | 0 | [Typed args/unknown key probes](locale-types-final.log) |
| `pnpm --filter @online-school/ui build:storybook` | 0 | [Build](catalog-build-final.log), module guard без apps/SDK/account-ui |
| `pnpm --filter @online-school/ui check:storybook` | 0 | **46 историй / 41 component export** с alias; все **30 required controls** из §3.4. [Coverage](coverage.json), [полный перечень](required-controls.json) |
| `pnpm --filter @online-school/ui test:storybook` | 0 | Девять VIS-11 × RU/RO × 4, keyboard/table/tabs/date picker, locale toolbar, запрет API/external sentinel. [Smoke](catalog-smoke-final.log), [JSON](catalog-smoke.json) |
| `pnpm --filter @online-school/ui test:foundation` | 0 | **368 renders**, **102 axe scans**, 10 overlay keyboard cases, 24 reflow cases, reduced motion. [Лог](foundation-browser-final.log), [JSON](browser/foundation.json) |
| `pnpm --filter @online-school/ui test:foundation:budget` | 0 | **48/48 ≤256000**, max **254567 bytes**, fonts **63492**. Optional passkey **196062**. [Лог](budget-final.log), [бюджеты/хеши файлов](budgets.json) |
| `pnpm --filter @online-school/student-cabinet --filter @online-school/manager-web --filter @online-school/platform typecheck` | 0 | [Три существующих consumer](consumers-typecheck.log) |
| `pnpm --filter @online-school/ui test:locale:browser` | 0 | **11 cases**: общий login, drafts, reload/full navigation/cross-tab/clear/unknown/denied storage; login writes=0. [Лог](locale-browser.log), [JSON](locale/browser.json) |
| `pnpm --filter @online-school/platform test:account-chrome` | 0 | **15 cases**: chrome, pending/unknown, draft/route, denied storage, switch/logout/two tabs. [Лог](account-browser.log), [JSON](account/browser.json) |
| `pnpm exec eslint scripts/k8k-foundation-budget.mjs --max-warnings 0` | 0 | [Tooling](budget-lint-final.log) |
| `pnpm view <19 UI pins> version license peerDependencies time dist.unpackedSize --json` | 0 | [Registry policy](dependency-policy.json), [оценка](dependency-check.json) |
| `pnpm audit --json` | **1** | **Общий audit FAIL**: 1 high / 4 moderate / 1 low, прежние API/Jest chains. UI chains без findings. [Raw](audit.json), [разбор](audit-summary.json) |
| `node output/k8k-tasks/TASK-017/collect-evidence.mjs` | 0 | Provenance, prerequisites, isolation и сохранение неизменённых входов |

Ранний lint нового harness выявил четыре необъявленных browser globals; исправлено через
`globalThis`, без отключения правил. Первые запуски нового month test выявили неточный
ожидаемый текст и регистр SSR `dateTime`; ожидания приведены к фактической семантике.
Первый collector пропустил `tsconfig.base.json` в своём manifest scope; добавлен существующий
вход, подтверждён неизменный хеш. Финальные команды выше прошли после исправлений.

## Визуальные и ручные доказательства

Static Storybook iframe, synthetic fixtures; RU/RO × 360/768/1024/1280.
Component gallery представляет общие контролы, а не приёмку реального кабинета роли.
Ручная клавиатурная проверка выполнена отдельно в Playwright MCP.
[Наблюдения](manual-review.md), [состояния](manual-states.json),
[CSS zoom 200%](manual-dialog-csszoom200.png),
[месяц RO1280](browser/screenshots/ui-calendar-and-dates--month-range-ro-1280.png),
[Dialog RO360](browser/screenshots/ui-controlled-overlays--modal-dialog-ro-open.png).

Axe сообщил 0 violations, но сохранил incomplete по четырём категориям правил.
Это требует дальнейшей AT/document-level оценки; [разбор](a11y-review.md).
Автоматические reflow cases используют 640/320 CSS px для эквивалента 200/400%.
CSS zoom вручную проверен отдельно. Native Ctrl++ в headless не изменял масштаб и
не засчитан. Полная WCAG2.2AA сертификация/реальная речь screen reader не заявляются.

## Acceptance checklist

| Критерий TASK-017 | Статус / доказательство |
|---|---|
| Prerequisites TASK-005–016 подтверждены по реальным артефактам | PASS — 12 хешированных отчётов + свежая проверка текущего кода |
| Все девять VIS-11, безопасный pending/unknown и denial | PASS — catalog smoke, unit, ручные snapshots |
| 25 контрастных сочетаний, корректное применение accent | PASS — unit/contrast.json; три декоративные accent-пары не объявлены пригодными для обычного текста |
| Весь §3.4, общая оболочка и props канбана/track | PASS — 30/30 required, 41 публичный component export; month gap устранён |
| Scoped build/lint/unit/catalog после сборки UI | PASS — финальные логи выше |
| RU/RO keys/placeholders/aria/errors, exact decimal, date-only/DST | PASS — strict compile, 137 unit и browser locale cases |
| Четыре ширины, длинные labels, keyboard/focus/reduced motion/reflow | PASS для component fixtures — 368 renders, 24 reflow, manual-review |
| CDN и SDK/credentials отсутствуют в generic kit | PASS в проверенном графе/fixtures — module guard, static imports, сеть без неожиданных запросов; [isolation](isolation.json) |
| Dependencies pin/license/peers/age проверены | PASS — 19 UI pins, возраст ≥14 дней, permissive licenses; lockfile прежний |
| Audit выполнен с честным статусом | PASS выполнения проверки; общий audit **FAIL**, вне UI scope, TASK-072/073 |
| Bundle по прежнему методу, включая fonts/lazy action | PASS — 48/48 и optional passkey |
| HEAD/dirty digest/commands/artifacts, журнал и матрица | PASS |
| DB/production/миграции/чужие изменения сохранены | PASS — только локальные frontend builds, static/mocked browser |
| Формальное утверждение provisional дизайна | NOT_RUN — решение владельца остаётся открытым |
| Реальные AT/native zoom, полный WCAG/ролевой и сквозной gate | NOT_RUN — TASK-071/072 и role gates |
| FND-GATE, LEGAL/FIN-LEGAL, Meet provider/OAuth/G4, production GO | NOT_RUN — внешние/отдельные release prerequisites |

## Передача, риски и обратимость

- TASK-018–023 получают существующие AppShell/StateBoundary/freshness/context hooks.
  Generic presentation не вычисляет eligibility и не предоставляет новые права.
- TASK-031 получает `StagesTrack({label,stage})`; TASK-042/043/044 отвечают за реальные
  assessment/checkpoint/publication. Три качественных этапа и NOT_STUDIED сохранены.
- TASK-053/054 получают `KanbanColumn({title,count,pending,children,actions})` и ListRow.
  Server pagination/total, transitions/revision, keyboard move и dnd принадлежат этим adapters.
- TASK-037 получает Calendar с day/week/month/list, `events/days/horizon/timeZone`.
  Resource read-model/lesson actions остаются ролевыми. CRM exception workflow и full
  translation/role acceptance — TASK-057/058. Месячный fixture не добавляет режим в UI кабинетов.
- TASK-034/047/058/065/066/067 продолжают ролевую локализацию/доступность. TASK-071 получает
  axe incomplete и real AT/native zoom; TASK-072/073 — advisories и конечную регрессию.

Audit findings не устранены массовым обновлением backend/test stack. Новых внешних
зависимостей нет. Generic month read-only; возможный rollback ограничен добавленным
вариантом CalendarView, CSS/weekday attribute, историей/тестом и новыми gate scripts.
215 прочих входов TASK-016 и существующие изменения сохраняются. Следующий TASK не начат.

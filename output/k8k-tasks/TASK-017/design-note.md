# TASK-017 — design note, 04.11.2026

Проверяется текущая foundation TASK-005–016. Применяется webdev-frontend-craft.
Новых DTO, operations, public component props, SDK или миграций не планируется.
KanbanColumn(title,count,pending,children,actions), StagesTrack(label,stage),
Calendar(events,days,horizon,timeZone,view) уже существуют и остаются презентационными.
Переходы CRM, revision/eligibility и публикация учебных этапов принадлежат role adapters.

Planned tooling: `packages/ui/stories/foundation-gate.mjs`, manifest script
`test:foundation`, `test:foundation:budget`, `scripts/k8k-foundation-budget.mjs`. Только static catalog,
loopback, synthetic fixtures и in-memory Vite; configFile/envDir false при builds.
Используется установленный axe из manager-web; новых dependencies не требуется.
Визуальная ручная оценка фиксируется отдельно от автоматических assertions.
Axe не доказывает полный WCAG или фактическую речь screen reader.
Выявленные дефекты исправляются в существующих компонентах/историях без отключения правил.
Все 48 budgets пересчитываются K8K v2 с тремя WOFF2 один раз и явным BalanceSummary seed.

Уточнение ревью до реализации: в §3.4 требуется month, а CalendarView сейчас
только day|week|list. Planned additive contract: CalendarView += 'month'.
Новых props нет: days/horizon/events по-прежнему передаёт adapter. Desktop month
выравнивает предоставленные дни по ISO weekday; узкие экраны показывают те же даты
последовательно. Ни автозаполнения событий, ни вычисления свободных мест/прав.
Новая CSF MonthRange проверяет полный месяц и границу незагруженных данных.

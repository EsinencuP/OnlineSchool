# TASK-012 — контракты состояний

`BoundaryState` остаётся общей моделью. `queryBoundaryState` принимает существующие флаги read,
проверяет 401/403 первыми и возвращает `stale.empty: true` для пустого кэша при ошибке или старении.
Partial subscription-limited принимает только разрешённых children из read-model приложения.

`StateBoundary` принимает state, children, asOf, receivedAt, timeZone, refreshing, retryRead и action.
Совместимый at представляет receipt. Параметр retryRead предназначен для повторного GET.
Action виден в empty, error, stale и subscription-limited. При pending/unknown, 401 и 403
контекстные действия и retry скрываются. Структура слота children стабильна в состояниях
ready, stale, pending и limited. При отказе приложение также отвечает за свою границу сессии.

`FreshnessLabel` принимает тот же источник времени. asOf может быть epoch ms или ISO instant
с явным смещением. receivedAt задаётся клиентом по завершении чтения. Когда оба значения
неизвестны, выводится нейтральный текст. Политика интервала обновления и подтверждение
серверной команды определяются отдельно от этой подписи.

`Skeleton({lines})`, `EmptyState({message})`, `ErrorState({message,retryRead,refreshing})` и
`StaleBanner({message,empty,retryRead,refreshing})` экспортируются из @online-school/ui.
`StagesTrack({label,stage})` принимает FAMILIARIZING, PRACTICING, APPLYING, NOT_STUDIED или null.
Авторитетный выбор этапа приходит из существующего источника и относится к TASK-031/043.

CSF-compatible stories находятся в packages/ui/stories/states.stories.tsx. Fixture с настоящими
адаптерами Manager State и Student QueryState находится в apps/manager-web/test/ui-states.
TASK-013 получает эти истории для подключения runtime. Предметная локализация wire codes
и сообщений ошибок относится к TASK-016.

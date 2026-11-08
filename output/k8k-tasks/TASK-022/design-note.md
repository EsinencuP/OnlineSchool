# TASK-022 — контракт перед изменениями

TASK-021 подтверждён по 156 хешам, 50 браузерным сценариям и 48 маршрутным бюджетам. Подключение остаётся на `getManagerDashboard` (`GET /api/v1/manager/dashboard`) и существующем `['manager','dashboard',horizon,days]`.

Планируемый additive-контракт `ManagerDashboardDto.priority?: DashboardPriorityDto | null`. Отсутствующее поле означает, что источник не подключён. `null` означает, что подключённый источник не смог подтвердить состояние. Объект содержит `primary: DashboardPriorityTaskDto | null`, `criticalCount`, `queueAction: 'TASK_QUEUE'`, `sourceAsOf`. `DashboardPriorityTaskDto` содержит `taskId` и `title`. Достоверная пустая очередь представляется объектом с `primary:null` и `criticalCount:0`.

Планируемый потребитель `DashboardPriority({ priority, receivedAt, retryRead, refreshing })` использует существующие `PriorityEvents`, `FreshnessLabel`, `ErrorState` и известные `routes.task/routes.tasks`. Продуктовый слот активируется только объектом серверного снимка. Штатный Dashboard сохраняет реакцию на 401/403, stale и GET-повтор. Отдельный запрос и команды не добавляются.

Производственные `ManagerDashboardService`, `ScheduleDeadlines`, claim и эскалация сохраняют существующее поведение. Аудит не обнаружил связки «критический event → утверждённый приоритет → scoped CRM task». В `VIS-07/B §7.1.1` выбор primary открыт. `OPS-01/B` задаёт реакцию на уже классифицированную срочную задачу. `due_at`, `escalated_at` и общие schedule follow-up не подставляются в поле `priority`. Подключение провайдера, подсчёт полного набора и публикация снимка ожидают утверждённого источника и правила primary. Синтетические READY/null используются только в локальном стенде.

# TASK-013 — design note

Каталог в packages/ui/.storybook, CSF в packages/ui/stories. Команды storybook, build:storybook, check:storybook, test:storybook локальные. Runtime props, DTO, operations и SDK сохраняют текущий контракт. Для существующих русскоязычных NotificationBell и PriorityEvents переиспользуется useLocale. Планируемые ключи словаря: notificationBellKnown, notificationBellUnknown, priorityAttention, priorityAction, priorityCount.

Toolbar locale (ru/ro) передаёт значение в args и useLocale; timezone Europe/Chisinau задаётся отдельно в синтетических примерах. Viewport: width360, width768, width1024, width1280. Истории по девяти BoundaryState.status доступны отдельными ссылками. Coverage сверяет публичные runtime exports, CSF render и фактический статический индекс. Сетевой smoke разрешает только файлы локальной сборки и блокирует API. Production chunks проверяются по модулям Rollup трёх существующих Vite-приложений.

Фактические ключи колокольчика `bellUnread` и `bellCountUnavailable` переиспользуют общий заголовок `notifications`. Словарь также содержит `workspace`, `primaryNavigation`, `mobileNavigation`, `cabinetStudent`, `cabinetManager`, `cabinetTeacher`, `cabinetDirector`, `cabinetOperator` и `schedule`. Runtime props сохранены.

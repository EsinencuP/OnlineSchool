# TASK-012 — контракты до реализации

501 хеш TASK-011 проверен. Сохранены 505 копий и бинарный diff.

- Существующий `BoundaryState` остаётся единой моделью. `stale.empty?: true` отмечает пустой cached read. `subscription-limited.message` становится необязательным и имеет RU/RO fallback. Все девять статусов и два outcome pending используют общий словарь. `queryBoundaryState` сохраняет приоритет 401/403.
- `Skeleton({ lines? })`, `EmptyState({ message? })`, `ErrorState({ message?, retryRead?, refreshing? })`, `StaleBanner({ message?, empty?, retryRead?, refreshing? })` используют те же подписи и семантику. Кнопка повторяет только чтение, при refetch сохраняет фокус. Pending/unknown и denial не выводят caller action или retryRead. StateBoundary сохраняет постоянный слот children для ready/stale/pending/limited и снимает его при отказе.
- `FreshnessSourceProps` разделяет `asOf?: string | number | null` и `receivedAt?: number`. Старый `at` остаётся совместимым алиасом времени получения. `FreshnessLabel` выводит отдельные источники, принимает ISO instant с поясом и не подставляет текущее время. Manager/Platform передают receipt. Student QueryState передаёт серверный generatedAt из существующего sourceTimestamp и receipt отдельно. Политика refresh и age thresholds сохраняются.
- `StagesTrack({ label, stage })` принимает три качественных этапа или NOT_STUDIED. null означает неизвестность. Текущий этап отмечен aria-current. Переходы, проценты и оценка отсутствуют в компоненте. Выбор авторитетного этапа остаётся TASK-031/043.

Manager State, Student QueryState и Platform adapter используют текущие transport/redirect границы. Legacy guards тоже прерывают показ данных при 401/403. Доменный текст ошибок остаётся у приложения. В RO общее сообщение локализовано, предметные wire codes и переводы относятся к TASK-016.

Проверки через CSF-compatible stories и loopback Chromium. RU/RO×360/768/1024/1280, сохранение конкретного узла и фокуса, отсутствие приватных данных после cached 403/401, ограничение одного предмета, прочитанный пустой и stale empty, отдельные источники времени. Новый runtime dependency не требуется.

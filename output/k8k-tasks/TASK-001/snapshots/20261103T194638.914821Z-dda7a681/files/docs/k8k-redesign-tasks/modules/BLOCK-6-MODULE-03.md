# Блок6 — Оператор: безопасная диагностика

Модуль выполняется отдельными заданиями по порядку. Этот индекс не заменяет текст TASK; каждый файл содержит собственный контекст и правила.

- [TASK-064 — Техоператор: контекст здоровья компонентов, устаревание и защищённые read-only diagnostics API](../TASK-064.md). Исходно: QaController GET api/v1/qa/components возвращает API/DB/worker, lastSeen, migrationVersion, checkedAt с MFA staff access. Public api/health и api/health/worker только liveness; worker threshold30s уже в коде. Расширенной операторской диагностики/оперативного incident read-контекста нет.
- [TASK-065 — Техоператор: K8K status workspace и RU/RO-приёмка безопасных диагностических сценариев](../TASK-065.md). Исходно: Operator view в platform сейчас показывает component status из getComponentStatus, остальные staff вкладки отключены. Самостоятельного полноценного K8K diagnostics представления со stale/source/incident explanation и полностью локализованными состояниями нет.

Выход модуля: критерии каждого TASK и доступные по ссылкам отчёты; gate не считается пройденным по наличию исходного кода.

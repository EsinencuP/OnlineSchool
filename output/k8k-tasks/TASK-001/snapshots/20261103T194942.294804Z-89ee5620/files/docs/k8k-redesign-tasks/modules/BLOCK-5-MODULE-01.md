# Блок5 — Права, рабочая очередь и приоритет

Модуль выполняется отдельными заданиями по порядку. Этот индекс не заменяет текст TASK; каждый файл содержит собственный контекст и правила.

- [TASK-048 — Capabilities конкретных действий и согласованность сервера с mock](../TASK-048.md). Исходно: Частично: /manager/me capabilities есть, но PAYMENTS_CONFIRM связан с director permission, TASKS_PROCESS/NOTIFICATIONS_SEND перечислены и не выдаются. UI/mock иногда выводят действия по роли/статусу.
- [TASK-049 — Настоящая очередь задач на главной и корректные агрегаты CRM](../TASK-049.md). Исходно: Частично: dashboard показывает overdueTasks.top под заголовком «Мои задачи»; полный tasks endpoint с cursor/filter существует. upcomingLessons.length — ограниченный preview, не total.
- [TASK-050 — Критические события, эскалация и обращения преподавателей в CRM](../TASK-050.md). Исходно: Заготовка: PriorityEvents source/flag существует; в продукте нет authoritative critical selection. Teacher own events/appeals реализует TASK-046, их storage не дублировать.

Выход модуля: критерии каждого TASK и доступные по ссылкам отчёты; gate не считается пройденным по наличию исходного кода.

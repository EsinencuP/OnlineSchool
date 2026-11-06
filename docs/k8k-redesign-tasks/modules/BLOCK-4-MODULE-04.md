# Блок4 — Личные данные работы, коммуникации и приёмка

Модуль выполняется отдельными заданиями по порядку. Этот индекс не заменяет текст TASK; каждый файл содержит собственный контекст и правила.

- [TASK-045 — Преподаватель: собственная ставка и ведомость с раздельными начислениями, обязательствами и выплатами](../TASK-045.md). Исходно: TeacherRateService уже реализует очковые200/220/250, историю engagements≤6мес, индивидуальные promises и snapshotAtStart. PayrollService.read и GET finance/teacher/:id/payroll существуют, отдают не более100 начислений с obligations/confirmed payouts. Полной period/pagination/свежей rate teacher read-модели и UI нет.
- [TASK-046 — Преподаватель: собственные рабочие уведомления и структурированные обращения менеджеру](../TASK-046.md). Исходно: NotificationService/NotificationOutboxPublisher и StudentNotification ориентированы на studentId; NotificationDispatch не содержит собственного teacher recipient. CrmTask и schedule-requests существуют, teacher notification/appeal API и UI отсутствуют. Нельзя переиспользовать student inbox под видом teacher или объявить готовый API обращений.
- [TASK-047 — TEACHER-GATE: сквозная функциональная, RU/RO и K8K-приёмка кабинета преподавателя](../TASK-047.md). Исходно: Полный teacher gate отсутствует: имеющийся platform smoke подтверждал read-only workspace/demo switching. Student targeted suites существуют, но не доказывают готовность teacher write workflows. FND-GATE/рабочая PostgreSQL concurrency и юридические зависимости остаются отдельными открытыми воротами.

Выход модуля: критерии каждого TASK и доступные по ссылкам отчёты; gate не считается пройденным по наличию исходного кода.

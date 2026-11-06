# Блок6 — Директор: решения и предметная очередь

Модуль выполняется отдельными заданиями по порядку. Этот индекс не заменяет текст TASK; каждый файл содержит собственный контекст и правила.

- [TASK-059 — Директор: единая read-очередь ожидающих решений и безопасные detail-проекции](../TASK-059.md). Исходно: Platform workspace читает до50 открытых CRM задач школы. ScheduleChangeApprovalController и DirectorCrmDisputesController имеют detail/approve по ID; FinanceController — команды confirm/approve/temporary-access. Единой директорской discovery/list-очереди с корректными типами решений и метаданными нет.
- [TASK-060 — Директор: интерфейс подтверждения поступлений, распределений и отдельного частичного допуска](../TASK-060.md). Исходно: Finance confirmPayment/approveDistribution/grantTemporaryAccess реализованы, manager-confirm только запрашивает одобрение. Директорский platform UI пока read-only; TASK-059 добавляет discovery/detail. Нет K8K формы независимых финансовых решений и обозримых последствий.
- [TASK-061 — Директор: ревизионное одобрение исключений расписания и исполнение полной отмены спорного списания](../TASK-061.md). Исходно: Есть get/approve ScheduleChangeApproval и get/approve CrmDisputeResolution, exact lesson/change revision и task version. Partial dispute требует MANUAL_FINANCE_REVIEW. Director UI этих сценариев отсутствует; approval расписания само не применяет перенос.

Выход модуля: критерии каждого TASK и доступные по ссылкам отчёты; gate не считается пройденным по наличию исходного кода.

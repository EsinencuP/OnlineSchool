# TASK-029 — передача

Следующий TASK выдаёт владелец. TASK-030 автоматически не начинался.

- Расписание хранит period/view/month/page/subjectId или fromSubjectId,
  история хранит historyPage. Detail принимает безопасный backTo только
  для /student/lessons. ScrollRestoration использует контекст расписания.
- month сохраняет прежний calendar contract. Явный view=list с month разрешает
  pagination того же месяца после CALENDAR_MONTH_LIMIT_EXCEEDED.
- LessonHistoryQueryDto/Pipe изолированы от общей HistoryQueryDto/Pipe,
  которую используют отчёты, навыки и другие страницы.
- GET history с lessonId возвращает адресный own fact без перебора страниц.
  Фактические teacher/duration и Decimal quantity snapshots берутся из него.
  Null остаётся неизвестным. NO_SHOW и approved CANCELLED сохраняют свои источники.
- getStudentHomework/getStudentMaterials принимают optional lessonId.
  Основные правила выдачи ДЗ и явного file permission сохранены.
  Detail показывает paginated ссылки на выданное ДЗ и доступные материалы.
- LessonCommands использует Dialog/Button/Field и серверные canRequestReschedule
  либо canDispute. Одно намерение имеет один UUID. Pending блокирует повтор.
  Unknown хранит только UUID в sessionStorage по actor/lesson/type. Body остаётся
  в памяти. После reload доступна проверка результата.
- getStudentLessonRequestResult читает
  /api/v1/student/lessons/{lessonId}/requests/{requestKey}?type=...
  с RESCHEDULE_REQUEST либо ATTENDANCE_DISPUTE. CREATED подтверждает создание
  собственной CRM task. UNKNOWN сохраняется при отсутствии committed task.
  Автоматический повтор POST отсутствует.
- Session teardown очищает pending UUID и приватный cache. Поздние reads
  отбрасываются. History 403 подавляет cached snapshots и действия.

TASK-030 получает существующий homework flow без изменения его очереди autosave.
TASK-031 получает фильтр lessonId в материалах и возврат в карточку, а также
оставшуюся локализацию/приёмку общей библиотеки. TASK-035 получает ролевой gate.

Реальные PostgreSQL execution, unique-index/transaction races, production CRM
commands, Meet OAuth/POC/G4 и FND-GATE имеют статус NOT_RUN. Для них нужен отдельно
разрешённый рабочий target и согласованный безопасный сценарий.

[Отчёт](report.md) · [Контракт](contracts.json) · [Сохранность](preservation.json) ·
[Приёмка](../../k8k-taskpack/task-029/acceptance.json)

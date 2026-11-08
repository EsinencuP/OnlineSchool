# TASK-029 — проектирование до реализации

Существующие getStudentLessons/getStudentLesson/getStudentLessonHistory и команды
переноса/спора сохраняются. LessonsQueryDto.view?: 'calendar' | 'list' дополняет
month. По умолчанию month остаётся календарём с лимитом 62 без pagination.
Явный view=list разрешает page/pageSize для того же выбранного месяца.
LessonsQueryDto.subjectId? и HistoryQueryDto.subjectId? сужают собственный scope.
HistoryQueryDto.lessonId? даёт адресный history read без перебора страниц.

LessonCardDto.subjectId? и originalScheduledAt? отражают существующий enrollment
и original_scheduled_at. Фактический преподаватель и duration берутся из
существующей history projection. HomeworkQueryDto.lessonId? и
MaterialsQueryDto.lessonId? добавляют фильтр к существующим scoped projections,
сохраняя выдачу только разрешённого материала и выданного ДЗ.

getStudentLessonRequestResult читает GET
/student/lessons/:lessonId/requests/:requestKey. LessonRequestResultDto содержит
status CREATED/UNKNOWN, nullable crmTaskId и type. Поиск CRM task использует
существующий стабильный idempotency_key студента, lesson и тип. Отсутствие записи
остаётся UNKNOWN. Ответ исключает payload, staff IDs и чужие task IDs.

LessonCommands использует kit Dialog/Button/Field, одно намерение с UUID и
сохранённым body в приватном query cache сессии. Pending блокирует double submit.
Unknown сохраняется при закрытии/повторном открытии формы и разрешает только
проверку GET по ключу, без повторной команды с новым ключом. Успех показывает
crmTaskId и сохраняет плановый урок/баланс. 401/402 используют текущий transport,
403 удаляет приватные данные затронутого раздела.

Уточнение перед реализацией сохранения ключа. Для безопасного reload незавершённый
UUID сохраняется в sessionStorage по actor/lesson/type. Текст формы остаётся
в памяти. Reload восстанавливает только UNKNOWN и GET-проверку. Успех, явный
отказ и смена сессии удаляют сохранённый UUID.

Lessons сохраняет period/view/month/page/subject context в URL. История —
отдельная последовательная секция того же раздела с server total, historyPage.
Detail получает адресную историю, ДЗ и материалы. Возврат принимает только
локальный /student/lessons URL с разрешёнными query keys.

Перед уточнением receipt. Optional query type сужает поиск к
RESCHEDULE_REQUEST либо ATTENDANCE_DISPUTE. Клиент передаёт его явно, поскольку
core idempotency допускает один UUID в разных command namespaces.

Контрактная сверка перед изоляцией DTO обнаружила наследование HistoryQueryDto
отчётами и навыками. LessonHistoryQueryDto и LessonHistoryQueryPipe получают
только фильтры урока и предмета. Общие HistoryQueryDto/HistoryQueryPipe сохраняют
пагинацию без расширения соседних API. LessonHistoryPage расширяет HistoryPage
только внутри lesson-history domain.

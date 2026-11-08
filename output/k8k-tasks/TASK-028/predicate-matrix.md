# TASK-028 — матрица проекций

| Проверка | Dashboard hero | List/calendar | Detail |
| --- | --- | --- | --- |
| Owner | request.studentCtx.studentProfileId | тот же student ID | student ID и lesson ID |
| SCHEDULED для ссылки | общий SQL и projection | общий SQL и projection | общий SQL и projection |
| Enrollment, assignment, teacher, subject | studentMeetLinkSql | studentMeetLinkSql | тот же list read с выбранным ID |
| Validity слота и снимка | scheduledLessonScopeSql и live predicates | те же predicates | те же predicates |
| Paid balance собственного enrollment | общие grants/adjustments/consumptions | те же | те же |
| Partial director allowance | current, unrevoked, unused max_lessons | те же | те же |
| Freeze | общий subscription predicate | тот же | тот же |
| Canonical link или override | общий SQL и canonical pattern | те же | те же |
| Окно −600000…+3600000 мс | studentMeetProjection | studentMeetProjection | studentMeetProjection |
| Snapshot | nextLesson.meetAsOf | item.meetAsOf | lesson.meetAsOf |
| Status | nextLesson.status | item.status | lesson.status |
| Кэш и свежесть | summary без урока, revision и новое чтение | no-store и query revalidation | no-store и query revalidation |

Различие только в выборе отображаемых записей. Hero выбирает текущий разрешённый,
иначе ближайший будущий. List/calendar сохраняют существующий period/month
и порядок. Detail сохраняет выбор собственного lesson ID и отображение истории
без предоставления ссылки для terminal status.

SQL predicates проверены по параметризованным запросам, результаты проекций
проверены unit/HTTP mocks. Выполнение SQL на рабочей БД имеет статус NOT_RUN.

# TASK-021 — передача следующему исполнителю

`packages/ui/src/refresh.ts` экспортирует `operationalQueryInterval`, `isAuthRead`, `refreshPolicies` и `useContextRefresh({ enabled, context, paused?, refresh })`. `request(reason?, dueAt?)` принимает монотонный `dueAt` для дедлайна. Один ключ закрепляется за одним фоновым владельцем из [карты](refresh-map.md). Для новых критичных чтений оценивать область actor, активность запроса и данные источника до добавления ключа. У пользовательской команды остаётся её адресная инвалидация.

`apps/student-cabinet/src/api.ts` содержит `StudentDeadlineRead`. Провайдер установлен в `StudentLayout`, потребитель — `NextLesson` в `StudentHome`. При T−10 повторяется штатное чтение ученического dashboard. Карточка `/student/lessons/:id` использует отдельный 15-секундный интервал `['student','lesson',id]`. Для TASK-028 передаются `getStudentDashboard`, `getStudentLesson`, `meetPresentation`, `serverSampleTime` и серверный `canJoin`.

`apps/manager-web/src/components/ui.tsx` принимает `State` с `asOf`, полученным от сервера. `dataUpdatedAt` передаётся в `StateBoundary` как `receivedAt`. Для TASK-022 текущие точки подключения — `apps/manager-web/src/pages/Dashboard.tsx`, `['manager','dashboard',horizon,days]` и `ManagerLayout`. Типизированное критическое событие и серверная эскалация остаются предметом TASK-022.

Staff workspace и карточки используют `actorContext.asOf` и локальное время получения. `StaffCabinet` передаёт `reload` активной карточке. Через `StaffDetail.onReading` карточка сообщает оболочке, что фоновое чтение следует приостановить до ответа. Операторский health GET выполняется после проверки сессии.

Повторить доказательства можно через `pnpm k8k:refresh:evidence` и `pnpm k8k:refresh:budget` из корня. [Основа проверки](basis.json) · [Отчёт](report.md)

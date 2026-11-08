# TASK-024 — контракт перед реализацией

Основа TASK-023 подтверждена по 179 хешам, 48 ролевым/login сценариям и 48 бюджетам. Открытый источник срочных событий CRM не участвует в ученическом доступе. Новый экран относится к следующему заданию.

Планируемый `getStudentSubjects` использует `GET /api/v1/student/subjects` и существующие student session/context/access guards. Query пустой. `StudentSubjectsResponseDto` содержит `generatedAt` и `items: StudentSubjectDto[]`. Предмет содержит `subjectId`, `subjectName`, `enrollmentIds`, `displayStatus`, `reasonCode`, `liveAccess`, `capabilities: StudentSubjectCapabilitiesDto` и `subscriptions: StudentSubjectSubscriptionDto[]`.

`StudentSubjectSubscriptionDto` содержит `subscriptionId` финансового периода для старых detail/payments/ledger, `managerSubscriptionId` управляющего абонемента, `enrollmentId`, `displayStatus`, `reasonCode`, `validUntil`, `frozenUntil`, `paidLessonsRemaining`, `liveAccess` и `temporaryAdmission: StudentTemporaryAdmissionDto | null` с `maxLessons`, `lessonsRemaining`, `validUntil`. Группировка периодов одного wrapper сохраняет один переход. Остатки разных абонементов и разных enrollments не складываются. Будущий финансовый период не участвует в снимке и не выбирается для перехода.

| Факт | Display и доступ |
|---|---|
| Текущий период, открытый enrollment, полная подтверждённая оплата и положительное право | ACTIVE, `PAID_RIGHTS`, `liveAccess:true` |
| Действующая заморозка в текущем периоде | FROZEN, `liveAccess:false`. ДЗ и материалы зависят от уже существующих выдач и grants |
| Истёк период или закрыт enrollment | EXPIRED, `liveAccess:false`. Сохраняется допустимый переход к истории |
| Нет начавшегося абонемента | NONE, `NO_SUBSCRIPTION`, массив абонементов пуст |
| Неполная оплата и отдельное действующее разрешение директора | LIMITED, `TEMPORARY_ADMISSION`, live по текущему enrollment и сроку, лимит отдельно от купленных прав |
| Разрешение истекло, отозвано, исчерпано или было до последнего подтверждённого распределения | LIMITED, `PAYMENT_OR_ADMISSION_REQUIRED`, `liveAccess:false` |
| Подтверждённый нулевой остаток | LIMITED, `NO_PAID_RIGHTS` для полностью оплаченного текущего периода. Текущий частично оплаченный период без гранта имеет 0 оплаченных прав |
| Исторический период без подтверждённых исходных грантов или полностью оплаченный без подтверждённого гранта | Остаток `null`. Для текущего оплаченного периода `RIGHTS_UNKNOWN` и `liveAccess:false` |

`canViewHomework` и `canViewMaterials` основаны на фактических выдачах. `canOpenSubscription` соответствует доступному историческому или текущему detail. `canOpenLessons` разрешает открыть существующий список при доступном уроке либо текущем праве. Доступ к конкретному Meet по-прежнему решает endpoint урока.

Все факты читаются одним параметризованным SELECT с `statement_timestamp()`. Используются существующие подтверждённые гранты, количественные корректировки, активные списания и `t03_paid_at`. Остаток решения берётся из `max_lessons` и подтверждённых исходов; приватная причина директора не включается. Старые GET, guards и запись финансовых операций сохраняют поведение.

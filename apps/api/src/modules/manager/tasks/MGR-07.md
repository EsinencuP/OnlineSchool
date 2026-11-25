# MGR-07: очередь и решения CRM, 01.11.2026

## API и область доступа

Реализованы GET `/api/v1/manager/tasks`, GET `/:taskId`, POST `/:taskId/claim`,
POST `/:taskId/resolve-reschedule`, POST `/:taskId/resolve-dispute`.
Все manager-контроллеры используют ManagerRoute. Scope проверяется одним запросом
с whitelist и portfolioWhere; чужие/отсутствующие/запрещённые задачи дают одинаковый
TASK_NOT_FOUND. Ресурс и активный контекст повторно проверяются в критической
транзакции и перед cached replay. managerId не принимается от клиента.

Очередь объединяет status/type (comma-separated), overdue, studentId, dueBefore;
limit=25, максимум100. Сортировка due_at/id стабильна; зашифрованный cursor до200
символов привязан к менеджеру, фильтрам и limit, хранит now для overdue и действует
30 минут. Некорректный cursor даёт422. Завершённые задачи не просрочены.
Пустая страница возможна при пропуске повреждённых legacy payload; nextCursor
продвигается по просмотренным строкам. Cursor не является снимком всей БД:
изменения статусов/портфолио учитываются на следующем запросе.

DTO строгие, discriminated payload содержит только разрешённые поля. Комментарий
передаётся обычной строкой JSON. LedgerRef берётся из Finance, произвольные
payload-ссылки игнорируются. Для недоказуемого старого списания
ledgerRef/chargedAmount/currency=null, автоматический ACCEPT запрещён.
Чужие данные семьи не читаются. GET ответы private/no-store.

## Состояния и атомарность

OPEN → IN_PROGRESS → RESOLVED/REJECTED. Claim и решения требуют version>=1,
используют CAS updateMany с текущим статусом/версией и увеличивают версию.
Повтор закрытой задачи — TASK_ALREADY_RESOLVED409; устаревшая версия —
TASK_VERSION_CONFLICT409; неверный разрешённый тип — TASK_TYPE_MISMATCH409.

POST требуют сессию, CSRF и UUID Idempotency-Key. Core CriticalCommand обеспечивает
SERIALIZABLE, максимум3 попытки, атомарные бизнес-запись/Audit/Outbox/результат.
Повтор ключа с прежним телом воспроизводит ответ; изменение тела даёт409.
Data-access ошибки преобразуются в Result; явных throw в manager-коде нет.

Перенос использует ManagerScheduleService и ту же CriticalContext/tx, сохраняет
lessonId. Конфликт слота или последующий отказ CAS/Audit/Outbox откатывает также
перенос. DECLINE требует причину и закрывает задачу REJECTED без изменения урока.
Поздний/третий перенос не получает обхода: overrideLateRule создаёт точный запрос
директору по MGR-06; задача остаётся IN_PROGRESS/AWAITING_SCHEDULE_APPROVAL.
После одобрения менеджер повторяет согласованное предложение с текущей версией
задачи и новым командным ключом. Старый ключ воспроизводит прежний pending ответ.

## Оспаривание и решение владельца

Применено [решение владельца](../../../../../../docs/manager-rules.md):
полная отмена через директора, частичные запросы отдельно. Менеджер вызывает только
ManagerFinanceFacade: scoped disputeSource и ограниченный publishAdjustment.
Последний проверяет исходное списание и возвращает APPROVAL_REQUIRED, а не проводку.
ACCEPT требует хотя бы один положительный эффект, деньги только Decimal string,
число занятий целое0..10. Сумма/количество не могут превысить исходное списание.
Положительная сумма с явным количеством0 допустима как частичный запрос.

Source новых оспариваний привязывается к consumption при создании учеником.
Для legacy без FK Finance допускает только единственное опубликованное списание
своего ученика/урока, существовавшее на момент создания задачи. Последующее
списание не подставляется. Неоднозначность блокирует автоматическое исполнение;
уже исправленный источник требует ручного рассмотрения. Исходная оплаченная цена,
а не текущая цена курса, определяет денежный предел.

ACCEPT сохраняет точное предложение, source, escalatedAt и стабильный ключ
`dispute:<taskId>`; статус IN_PROGRESS, approvalStatus=AWAITING_DIRECTOR либо
MANUAL_FINANCE_REVIEW. REJECT закрывает REJECTED без денег; ESCALATE сохраняет
ручное рассмотрение. Ни менеджер, ни флаг не подменяют директора.

Директор с MFA получает GET `/api/v1/dispute-resolutions/:taskId`: версия,
requested/full сумма и занятия, валюта, причина и режим. POST `/:taskId/approve`
с версией, CSRF и UUID ключом исполняет только FULL_REVERSAL. DisputeFinanceService
проверяет реального директора, состояние/версию и точный source, вызывает существующий
Finance EntitlementsService, а тот — публикацию обратной записи Ledger. Операция
имеет детерминированный UUID от `dispute:<taskId>`, независимо от HTTP ключа.
Права и аванс абонемента восстанавливаются полностью, выплаты семье нет.
Публикация, CAS RESOLVED, Audit TASK_DISPUTE_ACCEPTED и Outbox атомарны.
Частичный запрос директорская команда отклоняет MANUAL_FINANCE_REVIEW_REQUIRED409;
отдельный частичный финансовый workflow здесь не реализован.

Схема добавляет version/escalated_at/decision, source FK, уникальные
ledger_publication_id и dispute_resolution_key, индекс due_at/id. SQL trigger
защищает переходы/версию, неизменяемый source и связь публикации с реально
опубликованной отменой собственного consumption. Старые ID/payload/сроки сохраняются.
Директорские исправления не меняют учебные исходы, оценки и обычную зарплату.
История ученика умеет показывать CANCELLED с опубликованным списанием платной отмены,
не создавая фиктивный CONDUCTED/NO_SHOW. Static history зарегистрирован до :lessonId.

## События и границы проверки

Каждое решение создаёт `manager.task.decision.v1` с studentId/taskId/lessonId,
статусом/решением и ссылкой на публикацию при исполнении. Claim создаёт
`manager.task.changed.v1`; отдельно сохраняются технические command events.

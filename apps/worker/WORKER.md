# TASK-11 — Outbox, retry и reconciliation

Отдельный Node.js 24 процесс (`NestFactory.createApplicationContext`, без HTTP listener).
Новый dispatcher работает в `apps/worker`; прежние ScheduleDeadlines и
TemporaryAccessExpiry продолжают обрабатывать свои предметные JobRecord.

## Доставка и восстановление

`OutboxEvent.status`: PENDING → DELIVERED либо DEAD. Polling захватывает одну
доступную запись через `FOR UPDATE SKIP LOCKED`. В отдельной короткой транзакции
создаются `outbox.deliver.v1` JobRecord с уникальным `outbox-delivery:<eventId>`,
JobAttempt и lease с уникальным токеном. Политика SAFE_RETRY применима только
к локальным транзакционным эффектам обязательных handlers.

Эффект handler, успешный JobAttempt/JobRecord и отметка DELIVERED с
`published_at`/`delivery_reference` сохраняются одной транзакцией. При ошибке
эффекты откатываются; отдельно сохраняются код ошибки и следующая попытка.
Backoff: **1s, 5s, 30s, 5min, 30min**, затем 30min до исчерпания попыток.
JobRecord возвращается в PENDING; лимит фиксируется при его создании.
Исчерпание лимита даёт DEAD + FAILED job + `worker.outbox-dead` AuditEvent,
не останавливая следующий элемент очереди. Неизвестные topic/schema не теряются:
они повторяются и достигают DEAD с безопасным кодом.

SIGINT/SIGTERM останавливают выдачу новой работы и дожидаются текущей транзакции
до закрытия Nest/database. SIGKILL оставляет RUNNING и незавершённый JobAttempt
в PostgreSQL. После окончания lease другой worker фиксирует LEASE_EXPIRED,
возвращает job в PENDING и резервирует следующую попытку. Если лимит уже исчерпан,
запись уходит в DEAD. До окончания lease задание не перехватывается.
Токен и номер попытки защищают от подтверждения прежним владельцем.
Считаются все зарезервированные попытки, включая прерванные аварией.

Доставка **at-least-once**; уникальные ключи эффектов сохраняются между
перезапусками. Сеть/создание ресурсов провайдеров внутри этих handlers запрещены.
Для внешних действий нужна политика RECONCILE_BEFORE_RETRY и отдельный адаптер.

## Обязательные handlers

| Handler                     | Topic v1                                         | Эффект/ключ                                                                  |
| --------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------- |
| PaymentConfirmedHandler     | `finance.payment.confirmed`, `payment.confirmed` | PAYMENT_FOLLOW_UP, `payment-confirmed:<paymentId>`                           |
| LessonOutcomeTimeoutHandler | `schedule.outcome-overdue`                       | FOLLOW_UP после scheduled_end + 24h, `outcome-deadline:<lessonId>:<version>` |
| StarPendingHandler          | `schedule.star-follow-up`                        | FOLLOW_UP для текущего STAR_PENDING, `star-follow-up:<lessonId>:<version>`   |
| FileAccessRevokedHandler    | `file.access-revoked`                            | FileAuditLog REVOKE, `file-access-revoked:<permissionId>`                    |
| EntitlementGrantedHandler   | `entitlement.granted`                            | AuditEvent, `worker:entitlement-granted:<grantId>`                           |

Topic содержит суффикс `.v1`, `schema_version` и `payload.schemaVersion` равны 1.
`aggregate_id` — ID платёжного поступления, урока, FilePermission или EntitlementGrant.
Handlers читают авторитетное состояние БД; payload не предоставляет права/статус.
Для lesson используется ключ указанной версии; устаревшие события не создают новые задачи.
Действующее назначение менеджера выбирается в момент создания задачи.

API и старые deadline processors уже создают часть тех же задач. Использованы
их прежние ключи: повтор не меняет существующую задачу и не открывает её заново.
Платёж без `student_id` фиксируется как `worker.payment-unassigned` в AuditEvent:
создавать CRM-задачу без lead/student запрещает `ck_task_target`. Подтверждение
платежа и выдача прав остаются предметными командами, worker их не выполняет.
Явный список остальных Phase-0 событий получает AuditEvent `worker.event-observed`.
FileAccessRevoked — контракт потребителя для будущего файлового API; новый endpoint
отзыва доступа в этом TASK не добавляется.

## Неизвестный внешний результат

RecoveryState: **PENDING | CONFIRMED | FAILED | NEEDS_MANUAL**.
В миграции UNKNOWN/RECONCILING преобразованы в PENDING, ABSENT — в FAILED,
MANUAL_REQUIRED — в NEEDS_MANUAL. Идентификаторы, исходный provider request,
operation_key и подтверждённые evidence сохраняются.

Внешний исполнитель должен сохранять JobAttempt/RecoveryState с исходными
идентификаторами и переводить job в RECONCILIATION_REQUIRED при неизвестном исходе.
RecoveryWorker захватывает PENDING текущей попытки такого job с собственным lease,
вызывает `RecoveryProvider.check(state, signal)` вне транзакции и проверяет токен
перед фиксацией результата. Проверка только читает исходную операцию/ресурс.
Счётчик сверок сохраняется до обращения к провайдеру; авария не сбрасывает лимит.

- CONFIRMED требует resourceId + evidenceRef, завершает job без повторного создания.
- FAILED означает **доказанное отсутствие/невыполнение**, требует evidenceRef;
  только тогда SQL guard разрешает вернуть job в PENDING, если остались попытки.
- Timeout, исключение, недостаточное доказательство и отсутствие адаптера оставляют
  исход неизвестным; используется тот же backoff.
- После WORKER_RECOVERY_MAX_ATTEMPTS — NEEDS_MANUAL и один AuditEvent
  `worker.recovery-needs-manual`; job остаётся заблокированным для слепого повтора.

Реальные S3/Google Meet адаптеры и их POC **не входят в доказательства этого TASK**.
Точка подключения — Nest provider `RECOVERY_PROVIDERS`, карта provider → RecoveryProvider.
По умолчанию карта пуста: неподключённая интеграция будет явно эскалирована,
не получит фиктивное подтверждение. evidenceRef — ссылка на защищённое доказательство,
не сырые provider response, токены или секреты. Адаптер должен соблюдать AbortSignal.

## Запуск и диагностика

Сначала применить `20261026070000_task11_worker` через отдельное migration-подключение
DIRECT_URL. Тот же SQL есть в migrations-history для legacy chain. Затем:

```sh
pnpm --filter @online-school/worker build
pnpm --filter @online-school/worker start
```

Runtime использует только DATABASE_URL; переменные приведены в `.env.example`.
WORKER_MAX_ATTEMPTS=10, WORKER_RECOVERY_MAX_ATTEMPTS=10, WORKER_POLL_MS=1000,
WORKER_BATCH_SIZE=20, WORKER_LEASE_MS=30000, WORKER_PROVIDER_TIMEOUT_MS=5000.
Значения проверяются до запуска; timeout провайдера должен быть меньше lease.
Без DATABASE_URL dev/test контекст бездействует; production завершается ошибкой.

Оператор проверяет DEAD outbox, FAILED JobRecord, NEEDS_MANUAL recovery и ERROR
AuditEvent. Технические поля содержат коды, без stack/provider payload.
DELIVERED/DEAD и terminal jobs защищены от перезаписи. Для разрешённой повторной
доставки после исправления создаётся новое audit/outbox-событие с новой идентичностью;
предметный ключ эффекта остаётся стабильным. Ручная сверка требует проверяемых
evidence исходной операции; автоматического сброса неизвестного результата нет.

## Адресная проверка 26 октября 2026

Prisma generation, компиляция worker, адресный ESLint и 2 unit/lifecycle проверки.
На изолированной копии PostgreSQL **18.6** применена только новая миграция поверх
TASK-09; прошли **12** коротких интеграционных тестов: два worker, SKIP LOCKED,
rollback, retry, DEAD без остановки очереди, реальный SIGKILL Node child после claim,
перезапуск/reclaim/fencing, пять handlers без дублей, deadline 24h и reconciliation
с доказательствами/таймаутом/ручной эскалацией. Время в тестовых due-fixtures задано
явно, чтобы рассинхронизация часов Node/PostgreSQL не делала smoke нестабильным.

```powershell
pnpm --filter @online-school/worker test
$env:WORKER_TEST_DATABASE_URL='postgresql://postgres@127.0.0.1:55441/online_school_test_task11'
pnpm --filter @online-school/worker test:integration
```

Тестовая БД должна быть отдельной, migrated и reference-seeded; suite создаёт
синтетические записи и откладывает старые PENDING fixtures в своей TASK-11 БД.
Тесты отвергают remote, production и иные имена БД. Полная регрессия и повторные
migration rehearsals отложены в PHASE0_CHECKS.md; FND-GATE и production GO не выданы.

Справочные контракты: [PostgreSQL 18 row locking](https://www.postgresql.org/docs/18/sql-select.html#SQL-FOR-UPDATE-SHARE),
[Prisma interactive transactions](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions).

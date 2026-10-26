# Education, Files, Audit, Outbox, Jobs — TASK-04

Добавлены 16 моделей задачи и HomeworkDelivery, который сохраняет требуемое TECH-11/B
разделение задания и выдачи конкретному ученику. Полная схема TASK-02/03/04 содержит
**63 модели**, UUID PK, обязательные created_at/updated_at, именованные FK с RESTRICT.
Денежные поля TASK-03 остаются Decimal(20,4); Float не добавлен.

| Контур                 | Модели                                                                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Education              | HomeworkAssignment, HomeworkDelivery, HomeworkSubmission, SubmissionReview, SkillEntry, SkillAssessment, ProgressCheckpoint, EducationReport |
| Files                  | S3Object, FilePermission, FileAuditLog                                                                                                       |
| Audit / Infrastructure | AuditEvent, IdempotencyRecord, OutboxEvent, JobRecord, JobAttempt, RecoveryState                                                             |

После этого инкремента TASK-05 добавляет миграцию guards и отдельный полный QA seed:
[актуальные команды и проверка миграций](MIGRATIONS_SEED.md). Описанная ниже единая init
и reference seed сохраняются без изменения; текущая активная цепочка содержит init + guards.

## Единая init и сохранённая история

Для новой БД используется единственная активная миграция
`prisma/migrations/20261026020000_init/migration.sql`. Она содержит полную DDL,
частичные индексы, EXCLUDE, CHECK, триггеры и RLS TASK-02/03/04; применение атомарно.
`prisma migrate dev --name init` на чистой PostgreSQL 18.6 применяет **одну** миграцию,
не создавая вторую из-за расхождения схемы. DEFAULT TTL записан в канонической форме
PostgreSQL, чтобы повторное сравнение не создавало пустые изменения DEFAULT.

Четыре исходные миграции перемещены в `prisma/migrations-history/` без изменения
байтов. Их SHA-256 сохранены в `task02-task03-sha256.json`. В этом же каталоге есть
отдельная новая delta `20261026020100_task04_education_files_infra` для прежних БД.
Это альтернативные цепочки, выбираемые конфигурацией:

| База                                 | Конфигурация / команда                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| Новая, пустая                        | prisma.config.ts → `pnpm --filter @online-school/db db:migrate --name init`  |
| Уже имеет четыре миграции TASK-02/03 | prisma.legacy.config.ts → `pnpm --filter @online-school/db db:deploy:legacy` |

Прежнюю БД не сбрасывают и не помечают init применённой автоматически. Для неё
добавляется только delta, старые IDs/checksums сохраняются. На отдельной тестовой
БД проверены последовательность 4 → 5 миграций, сохранение контрольной Student-записи
и отсутствие различий со схемой после обновления. Настоящая пользовательская БД
не изменялась. Прежние фиктивные UUID-ссылки в CRM, если они есть в другой среде,
нужно сверить до применения нового FK; фиктивные audit/outbox не создаются миграцией.

## Seed

В Prisma 7 seed запускается явно через `prisma db seed`. Конфиг вызывает
`pnpm run seed:run`: сборку DB-пакета и ESM-скрипт `prisma/seed.mjs`.
Используется только DIRECT_URL, не runtime DATABASE_URL.

Seed добавляет пять утверждённых RoleCode через транзакционный
`INSERT ... ON CONFLICT (code) DO NOTHING`. Он не меняет существующие ID/timestamps
и не создаёт аккаунты, пароли, назначения ролей, тарифы, финансовые периоды,
учеников, навыки, реальные задания или внешние ресурсы.

Проверено: первый CLI-запуск — `5 roles; 5 inserted`, второй — `5 roles; 0 inserted`.
Интеграционный тест проверяет также параллельные запуски и неизменность строк.

## Учебная история

HomeworkAssignment — предметное содержание и автор; HomeworkDelivery — отдельная
выдача в StudentSubjectEnrollment с датой и сроком. HomeworkSubmission принадлежит
выдаче и правильному Student, имеет уникальную версию и ссылку на предыдущую сдачу.
SubmissionReview относится к конкретной версии сдачи, а не ко всем будущим доработкам.
Сдачи, проверки и SkillAssessment сохраняются отдельными неизменяемыми записями.

SQL проверяет предмет навыка/урока/выдачи, принадлежность ученику, версии и основания
ревизий. Ранее выданную работу можно доработать во время разрешённой заморозки;
модель не превращает саму заморозку в разрешение выдавать новые задания.
Проверка педагогических и файловых прав остаётся в будущих серверных командах.

ProgressCheckpoint относится к устойчивому предметному обучению и подтверждённому
факту урока. Типы LESSON_4/LESSON_8 допускают только соответствующие кратные счётчики;
проверяется наличие достаточного количества подтверждённых проведённых уроков.
Уникальность предотвращает дубли одной контрольной точки. EducationReport связан
с LESSON_8: дополнительный обязательный отчёт на четвёртом уроке не введён.
У отчёта есть период, версия, автор, draft/generated/published и история ревизий.
Публикация требует заполненных данных, опубликованный текст не перезаписывается.
Автоматическая постановка задач, сроки 2/3 рабочих дня и полный пересчёт после
коррекций не объявлены реализованными одной схемой.

## Приватные файлы

S3Object хранит метаданные, PENDING/UPLOADED/VERIFIED/QUARANTINED/DELETED,
размер BigInt, тип, hash и время. `key` глобально UNIQUE, включая разные bucket.
Bucket/key и подтверждённое содержимое не переписываются в ту же метазапись.
URL S3 и краткоживущие signed URLs не хранятся как идентичность объекта.

FilePermission использует `subject_id = AuthAccount.id` и `subject_type = AccountKind`.
Составной FK проверяет вид принципала; Household и отдельный родительский логин
не являются получателями такого гранта. Частичный UNIQUE по
`(s3_object_id, subject_id, subject_type)` действует при `revoked_at IS NULL`.
Истёкший грант сначала явно отзывают; затем создают новый. Даты и отозвавший актёр
фиксируются. Грант чтения требует VERIFIED-метазапись. Это не заменяет будущую
серверную проверку фактического S3-объекта, лицензии, актуальных прав и срока.

FileAuditLog записывает VIEW/DOWNLOAD/REVOKE, актёра, объект, исход и request_id.
Он append-only. Реальных загрузок, signed URLs, Google Drive-хранилища или публичного
доступа этот инкремент не создаёт; внешние S3/Meet POC остаются открытыми.

## Аудит, идемпотентность и фоновая работа

AuditEvent хранит ACCOUNT/SYSTEM/ANONYMOUS, действие, ресурс, результат, request_id,
серверное время, source_operation_id и уникальный event_key. Системный актёр имеет
явный system_actor_ref. Все FK — RESTRICT; триггер запрещает UPDATE/DELETE даже при
обычном запросе владельца таблицы. У online_school_runtime нет UPDATE/DELETE/TRUNCATE
для audit/file logs. DBA/retention/legal-hold процедуры этим не заменяются.

IdempotencyRecord отделяет scope + command_type + key, request_hash и завершённый
result/result_hash. TTL по умолчанию **48 часов**, индекс expires_at готов для очистки.
До истечения срока удаление запрещено. Очистка не удаляет постоянные финансовые
ключи операций, source IDs и audit. Вычисление канонических hash, сравнение повторного
payload, middleware и плановая очистка относятся к TASK-06/11.

OutboxEvent создаётся недоставленным, с уникальным event_key и ссылкой на успешный
AuditEvent той же операции. published_at появляется только вместе с метаданными
попытки и delivery_reference; запись доставки не возвращается в pending.
Payload/источник не меняются. CrmTask.source_event_id теперь имеет настоящий FK.
Внешние организационные сообщения семье автоматически не отправляются (CON-08/B).

JobRecord хранит deduplication_key, явную retry_policy, лимит попыток, статус,
очередную дату и lease. JobAttempt версионирует попытки; error — санитарный код,
без секретов и сырых провайдерских ответов. Время lease/попыток задаётся по серверным
часам БД, чтобы не зависеть от рассинхронизации часов Windows/контейнера.
Для RECONCILE_BEFORE_RETRY неизвестный внешний результат блокирует новый запрос
до доказанного ABSENT именно для последней попытки. RecoveryState хранится отдельно
по `(job_id, attempt_no)`: старое отсутствие не разрешает повтор нового UNKNOWN.
CONFIRMED/ABSENT требуют evidence_ref/reconciled_at и не перезаписываются.
Фактическую сверку с провайдером, worker, SKIP LOCKED, backoff и мониторинг реализует TASK-11.

Существующая LedgerPublicationService теперь атомарно записывает публикацию,
AuditEvent и OutboxEvent. Тест коллизии outbox подтверждает откат проводки и нового
аудита целиком. Повтор команды оставляет одну пару audit/outbox. Штатная политика
публикации по-прежнему запрещающая до ACL TASK-06/08, финансового endpoint нет.

## Проверка

Новая одноразовая PostgreSQL 18, PowerShell, из корня workspace:

```powershell
docker run --detach --name online-school-task04-verify --publish 127.0.0.1:55434:5432 --env POSTGRES_HOST_AUTH_METHOD=trust --env POSTGRES_DB=online_school_test_task04 postgres:18
$env:DIRECT_URL = 'postgresql://postgres@127.0.0.1:55434/online_school_test_task04'
pnpm --filter @online-school/db db:validate
pnpm --filter @online-school/db exec prisma migrate dev --name init
pnpm --filter @online-school/db exec prisma db seed
pnpm --filter @online-school/db exec prisma db seed
$env:TEST_DATABASE_URL = $env:DIRECT_URL
pnpm --filter @online-school/db test:integration
pnpm --filter @online-school/db exec prisma migrate status
pnpm --filter @online-school/db exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
docker stop online-school-task04-verify
```

Дождитесь готовности БД. Тестовая база должна быть локальной с префиксом
online_school_test; часть тестов оставляет синтетические записи. Проверено
**26 октября 2026, PostgreSQL 18.6**: одна init, повторный/параллельный seed,
31 интеграционная проверка (22 прежние + 9 новых), schema diff — 0.
Производственные данные, полноценные пользовательские API, ACL, S3/Meet-интеграция,
работающий dispatcher/worker и production GO этим инкрементом не подтверждаются.

[Prisma 7: seed](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/seeding),
[объединение миграций](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/squashing-migrations).

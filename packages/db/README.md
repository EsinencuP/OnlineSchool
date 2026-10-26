# Identity, Access и CRM — TASK-02

Текущий инкремент и команды для новых/существующих БД:
[SQL guards, миграции и QA seed — TASK-05](MIGRATIONS_SEED.md).
Полная модель Education/Files/Audit/Outbox/Jobs описана в [TASK-04](EDUCATION_INFRA.md).
Полная схема после TASK-07 содержит 66 моделей: init + TASK-05 guards + TASK-07 Identity;
[Identity и recovery](../../apps/api/IDENTITY.md). Исходная история TASK-02/03 сохранена
отдельно. Ниже описан исходный инкремент TASK-02 с поздними уточнениями.

Реализованы 20 моделей задачи и общий технический `AuthAccount`. Все PK —
`String @id @default(uuid()) @db.Uuid`; каждая модель содержит `created_at`
и `updated_at`. Внешние ключи имеют явные имена и `ON DELETE/UPDATE RESTRICT`.
PII отмечены в Prisma-схеме; комментарий не заменяет серверные права доступа.

## Владение и связи

| Владелец                     | Модели и границы                                                                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Student registry / Relations | Student, Representative, StudentRepresentativeLink, Household, HouseholdMembership, RelationshipVerification                                 |
| Identity / Access            | AuthAccount, StudentAccount, StaffAccount, TeacherAccount, Role, RoleAssignment, Session, WebAuthnCredential, MfaChallenge, AccessRevocation |
| CRM / Intake                 | Lead, LeadStudentLink, AssignedManager, ContactLog, CrmTask; LeadStage — enum                                                                |

`AuthAccount` объединяет технические FK сессий, MFA и ролей. Типизированный профиль
связан с ним составным FK `(account_id, account_kind)`; CHECK запрещает подмену вида
профиля. `Representative` не связан с AuthAccount и не получает отдельный логин.
`Student` сохраняет свою идентичность при смене/деактивации аккаунта. Одинаковые
контакты у детей, взрослых и заявок допускаются и не запускают объединение записей.

## Ограничения миграций

Первая миграция создаёт модели, именованные FK и частичные UNIQUE-индексы.
Для декларации этих индексов в Prisma 7.10.1 включён preview `partialIndexes`.
Индексы сохраняются при последующих сравнениях схемы:

- `uq_student_active_household`: student_id при `status = 'ACTIVE'`;
- `uq_student_active_account`: student_id при `deactivated_at IS NULL`.

Вторая миграция добавляет SQL-инварианты и словарь пяти ролей, без учётных записей
и назначения привилегий. Требуется PostgreSQL-расширение `btree_gist`.

- Членство относится ровно к одному Student или Representative. У взрослого могут
  быть разные семейные группы. Периоды ACTIVE/ENDED одного ребёнка не пересекаются
  благодаря EXCLUDE; смежные полуоткрытые интервалы `[from, to)` разрешены.
- Членство не подтверждает представительство. История проверок хранится отдельно,
  а VERIFIED-связь требует даты и проверявшего сотрудника.
- Роль соответствует виду аккаунта; пересекающиеся назначения одной роли
  запрещены. Вид аккаунта и код роли неизменяемы.
- Активация StudentAccount требует UUID подтверждения оплаты, сотрудника с ролью
  DIRECTOR на момент активации и времени активации. Для LIMITED_DIRECTOR_ADMISSION
  дополнительно обязателен UUID отдельного решения о допуске (CON-02/B).
- Session/MfaChallenge имеют обязательное время истечения. Хранятся SHA-256 hashes
  cookie-токена/challenge; исходные секреты в этих таблицах не сохраняются.
  Составные FK не допускают привязки challenge/отзыва к сессии другого аккаунта.
- `sign_count` — BigInt с диапазоном uint32, включая значения выше Int32.
  Проверка replay и аутентификаторов с нулевым счётчиком относится к TASK-07.
- Исторические проверки/отзывы не удаляются каскадно вместе со своими основаниями.
- CRM хранит проверившего связь менеджера, историю назначений, внутренние задачи
  и результаты контактов. `idempotency_key` уникален для отдельной производной задачи;
  `source_event_id` может повторяться у разных задач одного события.

## Незавершённые междоменные зависимости

В исходном TASK-02 финансовые ссылки были UUID-снимками без FK. В TASK-03 добавлены
Subscription/PaymentReceipt/TemporaryAccessPermission и именованные FK активации.
Проверяются принадлежность ученику, подтверждённое распределение, полнота оплаты
либо отдельный действующий допуск. [Текущие ограничения и проверки](FINANCE.md).
Полный авторизованный API активации и audit/outbox остаются следующими задачами.

`source_event_id` получит связь с моделью outbox в TASK-04. Серверные RBAC/контекстные
проверки, MFA, однократное потребление challenge и отзыв действующих сессий реализуются
в TASK-06/07; текущая схема не является готовой системой аутентификации. Семейное
членство и SQL-целостность не выдают прав на учебные или финансовые данные.
Журнал общего аудита, политика retention и защита истории от прикладных изменений
остаются следующими задачами. FND-GATE и production GO не закрыты.

## Проверка на чистой PostgreSQL 18

Из корня workspace, PowerShell; используется отдельная локальная тестовая БД:

```powershell
docker run --detach --name online-school-task02-verify --publish 127.0.0.1:55432:5432 --env POSTGRES_HOST_AUTH_METHOD=trust --env POSTGRES_DB=online_school_test_identity postgres:18
$env:DIRECT_URL = 'postgresql://postgres@127.0.0.1:55432/online_school_test_identity'
pnpm --filter @online-school/db db:validate
pnpm --filter @online-school/db db:migrate
pnpm --filter @online-school/db build
$env:TEST_DATABASE_URL = $env:DIRECT_URL
pnpm --filter @online-school/db test:integration
pnpm --filter @online-school/db exec prisma migrate status
pnpm --filter @online-school/db exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
docker stop online-school-task02-verify
```

Дождитесь готовности PostgreSQL перед миграцией. Runtime `DATABASE_URL` не используется
миграциями. Интеграционные тесты требуют loopback-адрес и имя БД с префиксом
`online_school_test` или `online_school_task02`; обычный `pnpm test` не требует БД.
Тестовые данные синтетические; тесты откатывают транзакции или удаляют свои записи.

**Проверено 26 октября 2026:** PostgreSQL **18.6**, образ `postgres:18`
(`sha256:edb0c08dc33befd0262ab3b5cf1c4f3f8cfd8b09e88c05b45adee29d6761ddb6`).
На новой пустой БД применены обе миграции через `prisma migrate dev`.
`prisma validate`, `prisma generate`, 12 интеграционных проверок — успешно;
`migrate status` — up to date, `migrate diff --exit-code` — 0, различий нет.
Включены конкурентная вставка двух активных членств, сохранение истории,
активация только с актёром-директором, границы MFA/session и реальные Prisma-запросы.

Основания: TECH-02/B, TECH-03/B, TECH-04/C, TECH-05/A, TECH-14/B, CON-02/B.
Документация: [частичные индексы Prisma 7](https://www.prisma.io/docs/orm/v7/prisma-schema/data-model/indexes),
[расширение миграций собственным SQL](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/unsupported-database-features).

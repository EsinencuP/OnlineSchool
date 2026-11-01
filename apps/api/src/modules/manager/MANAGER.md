# MGR-01 — инфраструктура кабинета менеджера

Сверка и реализация: 31.10.2026. Основание — MGR-01 и INV-01…16 из
`docs/AI Coder Tasks — Модуль 2 Кабинет менеджера.md`, действующие решения
CON-01…11 и реальная Prisma-схема. Проверка относится к локальному рабочему дереву.

## Шаг 0: соответствие ТЗ → код

| Имя / понятие ТЗ               | Реальный аналог                                                                    | Правило использования                                                                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| StudentProfile                 | `Student` (`students`)                                                             | Реестровая личность; существует без аккаунта. ID ученика — `Student.id`.                                                                                                     |
| StudentProfile.managerId       | `Student.manager_assignments` → `AssignedManager.manager_id`                       | Поля `managerId` у Student нет. Портфолио определяется действующим назначением, не новой колонкой.                                                                           |
| ManagerProfile / Manager       | `StaffAccount` (`staff_accounts`) + действующая роль `MANAGER`                     | `account_id`, `account_kind=STAFF`, `full_name`; `deactivated_at` означает неактивность. Существующий unique `(account_id, account_kind)` исключает второй staff-профиль.    |
| ManagerProfile.isActive        | `StaffAccount.deactivated_at IS NULL`                                              | Отключение самого `AuthAccount` продолжает давать 401.                                                                                                                       |
| ManagerProfile.displayName     | `StaffAccount.full_name`                                                           | Возвращается только имя текущего менеджера.                                                                                                                                  |
| Портфолио                      | `AssignedManager` (`assigned_managers`)                                            | `assigned_at <= now`, `ended_at IS NULL OR ended_at > now`; назначения на лиды не входят в число учеников. Индекс `(manager_id, ended_at)` уже существует.                   |
| AuthAccount / SessionPrincipal | `AuthAccount`, core `AccountContext`                                               | В manager `SessionPrincipal` — AccountContext с server-side requestId; JWT не вводится.                                                                                      |
| StudentAccount                 | `StudentAccount` → `AuthAccount` + `Student`                                       | Кабинет/активация отделены от создания CRM-записи.                                                                                                                           |
| Household                      | `Household`, `HouseholdMembership`                                                 | Семейная связь не даёт автоматического доступа или платёжного права.                                                                                                         |
| CrmTask                        | `CrmTask` (`crm_tasks`)                                                            | `student_id`, `assigned_manager_id`, `type`, `status`. В MGR-01 workflow не реализуется.                                                                                     |
| Subscription                   | `Subscription` → `StudentSubjectEnrollment` → `Student`                            | Цена/скидка — Decimal(20,4), не JS number.                                                                                                                                   |
| PaymentRecord                  | `PaymentReceipt` + `PaymentDistribution`                                           | Поступление и распределение разделены; отдельные подтверждения директора.                                                                                                    |
| Допуск при неполной оплате     | `TemporaryAccessPermission`                                                        | Каждая неполная оплата/рассрочка требует отдельного ограниченного решения директора.                                                                                         |
| Баланс прав                    | `EntitlementGrant`, `EntitlementConsumption`, `EntitlementAdjustment`              | Это права на занятия, не денежный остаток.                                                                                                                                   |
| LedgerEntry                    | `LedgerEntry` + `LedgerDocument` + `LedgerLine`                                    | Деньги находятся в строках; прямая запись менеджером запрещена.                                                                                                              |
| LedgerPublicationService       | `FinanceLedger` (`modules/finance/finance-ledger.service.ts`)                      | Реальный сервис ядра финансов; не создаём дублирующий ledger-сервис в manager.                                                                                               |
| SkillMap                       | `SkillEntry`, `SkillAssessment`, `SkillAuditLog`, `SkillSnapshot`                  | Учебные данные для менеджера только для чтения.                                                                                                                              |
| Homework                       | `HomeworkAssignment`, `HomeworkDelivery`, `HomeworkSubmission`, `SubmissionReview` | Прямые записи из manager запрещены, включая вспомогательные учебные модели.                                                                                                  |
| EducationalReport              | `EducationReport`, `ProgressCheckpoint`, `EducationReportRead`                     | Прямые записи из manager запрещены.                                                                                                                                          |
| AuditLog / Outbox              | `AuditEvent`, `OutboxEvent`                                                        | Критические команды используют существующий core/transaction + idempotency; MGR-01 не добавляет бизнес-мутаций.                                                              |
| JwtAuthGuard                   | core `SessionGuard`, PostgreSQL `SessionStore`                                     | Opaque cookie `__Host-school_session`; MFA, expiry, revocation и disabled-account проверяются ядром.                                                                         |
| Roles('MANAGER')               | core `RequireRole('MANAGER')`                                                      | Метаданные общего RBAC, без второго механизма ролей.                                                                                                                         |
| ADMIN                          | Отдельного значения нет в `RoleCode`                                               | Реальные роли: DIRECTOR, MANAGER, TEACHER, STUDENT, TECH_OPERATOR. DIRECTOR и TECH_OPERATOR запрещены; синтетический ADMIN также отвергается scope-тестом. Имперсонации нет. |
| Таймзона школы                 | `SCHOOL_TIMEZONE`                                                                  | IANA-зона из конфигурации, по умолчанию Europe/Chisinau; некорректная конфигурация → 503.                                                                                    |

Аналоги профиля и связи портфолио уже есть, поэтому новые ManagerProfile,
Student.managerId, индексы и миграция не добавлены. `prisma migrate dev` не нужен
и не запускался. Рабочая БД не изменялась; отдельная test/QA БД не создавалась.

Модуль 1 физически присутствует в рабочем дереве: `apps/api/src/student/`,
`apps/student-cabinet/`, его DTO и generated API. Это не доказывает commit/merge
или приёмку модуля. Для MGR-06/07/08 ещё нужна адресная сверка соответствующих
контрактов; MGR-01 не подтверждает их готовность.

## Контекст, guard-ы и ошибки

`ManagerModule` импортирует `CoreModule`, подключён в `AppModule` и ничего не
экспортирует. Последующие manager-контроллеры/сервисы регистрируются внутри этого
модуля и используют только его `ManagerScopeService` для портфолио.

Каждый контроллер обязан иметь `@ManagerRoute()`. Декоратор задаёт существующий
`RequireRole('MANAGER')`, cookie security `sessionCookie`, tag `manager`, ответы
401/403 и `ManagerContextGuard`. Глобальные core Session/RBAC/CSRF/WebAuthn/
Idempotency guards выполняются до controller guard. Общая default-deny политика
и обязательная MFA сотрудников остаются включены. Mixed-role principal также
запрещён: в этом кабинете разрешена только роль MANAGER и kind STAFF.

Core metadata `roleErrorCode` задаёт FORBIDDEN_ROLE для manager-роутов ещё на
глобальном RBAC. `managerProfileErrors` разрешает SessionStore вернуть 403
MANAGER_INACTIVE / MANAGER_PROFILE_NOT_FOUND вместо обычного 401 при валидной
manager-сессии. Эта настройка меняет только диагностику отказа: неактивный профиль
не получает контекст/доступ. Отключённый аккаунт, отозванная/просроченная сессия и
access revocation по-прежнему имеют приоритет и возвращают 401. Обычные маршруты
сохраняют прежний отказ для отсутствующего/неактивного staff-профиля.

`ManagerContextGuard` удаляет старый request.managerCtx, получает профиль только
по доверенному accountId и сохраняет замороженный контекст с managerId/sessionId/
requestId. managerId из query/body/path не используется. Отказы пишутся общим
AuditService без контактов или сведений чужого ученика. HTTP-конвертация Result
выполняется только core `fail`/`unwrap` на границе controller/guard.

`assertStudentInPortfolio` выполняет один scoped `student.findFirst` с проекцией
только `id`. Чужой и отсутствующий корректный UUID используют одинаковую форму
запроса и возвращают одинаковый 404 STUDENT_NOT_FOUND. Некорректный UUID тоже
получает 404. Искусственные задержки не используются; постоянное время работы БД
не обещается. Будущие списки должны применять `AND: [portfolioWhere(ctx), filters]`,
а не перезаписывать scope клиентским фильтром. Предикат учитывает период назначения.

Ошибки data access перехватываются и превращаются в Result DATABASE_ERROR/503
без текста SQL/соединения. Публичные ошибки используют стандартный core ApiError
с requestId, code, message, timestamp. Ответы помечаются core middleware no-store.

## GET /api/v1/manager/me

Возвращает ManagerMeResponseDto: managerId, displayName, role=MANAGER,
portfolioSize, timezone, capabilities. Count применяется к Student с тем же
portfolioWhere; контакты и идентификаторы учеников не загружаются. DTO оформлен
Swagger/class-validator декораторами; клиент генерируется из OpenAPI.

Capabilities показывают полномочия действующей core policy, а не готовность
будущих MGR endpoint-ов:

| Capability                        | Текущая проверка                                                                   |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| STUDENTS_VIEW                     | student:read                                                                       |
| ACCOUNTS_CREATE                   | student:create; создание аккаунта остаётся отдельной MGR-03 с платёжными условиями |
| SUBSCRIPTIONS_MANAGE              | subscription:create                                                                |
| SCHEDULE_MANAGE                   | schedule:manage                                                                    |
| PAYMENTS_CONFIRM                  | payment:confirm; у обычного менеджера отсутствует и не возвращается                |
| TASKS_PROCESS, NOTIFICATIONS_SEND | Тип зарезервирован; до появления соответствующей core policy не возвращаются       |

MGR-01 не вводит подтверждение платежей менеджером, не отменяет директорские
решения и не реализует бизнес-команды следующих задач.

## Проверки и воспроизведение

```powershell
pnpm --filter @online-school/api build
pnpm --filter @online-school/db db:validate
pnpm generate:client
pnpm generate
pnpm test:mgr01
```

Адресный набор: 56 тестов в manager-scope, manager-http, manager-architecture.
HTTP-набор использует настоящий Nest и core SessionStore/guards/filter, подменяя
только Prisma persistence. Он покрывает анонима, реальные запрещённые роли,
два портфолио, отсутствующий/неактивный профиль, MFA/disabled/revoked/expired,
обычную диагностику SessionStore, CSRF для четырёх mutation verbs и Swagger.
Мутационные probe-контроллеры существуют только в тесте.

Архитектурный набор рекурсивно находит все manager-контроллеры через TypeScript
AST и требует ManagerRoute. ESLint INV-02/03 запрещает write-методы защищённых
Prisma-делегатов, включая aliases, destructuring, computed/optional access и
извлечение write-method. Raw SQL из manager также запрещён для предотвращения
обхода. Положительные read-fixtures и отрицательные mutation-fixtures проверяют
сами правила. Это статическая проверка, не замена domain policy и правам БД.

INV-05 запрещает Number/parseFloat, number в денежных полях и прямую денежную
арифметику. Числовой portfolioSize разрешён. INV-08 запрещает throw и требует
явный Promise<Result<T, DomainError>> у async-методов manager-сервисов;
portfolioWhere — намеренно синхронный Prisma-предикат.

Проверки с подменой persistence не доказывают поведение SQL/planner, production
GO или FND-GATE. Полная регрессия, миграционные rehearsal и рабочая БД в эту
задачу не входят согласно PHASE0_CHECKS.md.

Итог адресной проверки: MGR-01 + существующие student-context/student-http —
88/88 тестов; API `tsc -b`, компиляция api-contracts, адресный ESLint,
`prisma validate`, `generate:client` и `generate` прошли. После изменений выполнен
один `graphify update .`: 6060 узлов / 13064 рёбер; shrink guard не обходился.
Graphify сохранил backup curated graph и сообщил о перестроении community labels.
AST-обновление не объявляется новой семантической проверкой старых документов.

## Продолжение MGR-02, 31.10.2026

Добавлены CRM-список/карточка, создание Student без аккаунта, изменение контактов
с версиями и адресная миграция. Новые поля, денежный Ledger-баланс, особенности
SQL read-model и актуальные доказательства описаны в [MGR-02](students/MGR-02.md).
Выше сохранён исторический снимок проверки MGR-01.

## Продолжение MGR-03, 31.10.2026

Identity-backed создание аккаунта и reset, однократный пароль, строгий initial
password gate и Outbox-уведомление описаны в [MGR-03](accounts/MGR-03.md).
Первая оплата проверяется через опубликованный PaymentDistribution собственного
абонемента. Уточнение владельца по деньгам ученика отражено также в MGR-02;
поступление семьи само по себе не образует баланс ученика.

## Продолжение MGR-04, 31.10.2026

Добавлены создание/продление и заморозка управляемых абонементов на направление,
отдельные неизменяемые финансовые периоды, worker и уведомления в inbox.
Таблица моделей, решения владельца 30/60 и готовое распределение на входе,
даты, порт MGR-06 и границы проверки — в [MGR-04](subscriptions/MGR-04.md).

## Продолжение MGR-05, 31.10.2026

Поступления MDL, manager-confirm → одобрение директора, отклонение, предложения
распределений и доплаты описаны в [MGR-05](payments/MGR-05.md). Шаг0 сверяет
PaymentRecord с реальным PaymentReceipt; контакт поступления и получатель денег
разделены. Общий ManagerFinanceFacade стал единственным адаптером финансовых
команд менеджера, включая MGR-04; внутренний Finance-адаптер покупки называется
ManagerAllocationFinance. OpenAPI/Orval обновлены до108 операций. Миграция
подготовлена и офлайн проверена, к БД не применялась. Исторические итоги выше
сохранены; текущие адресные доказательства — tests/evidence/mgr05-verification.json.

## Продолжение MGR-06, 31.10.2026

Шесть manager-маршрутов расписания, подготовка60 минут, директорские исключения,
платная отмена через общий FinanceFacade, отдельный Meet override и действующий
порт отмены из заморозки описаны в [MGR-06](schedule/MGR-06.md). Старые одиночные
calendar-команды ограничены DIRECTOR, чтобы исключить обход новых manager-проверок.
109 адресных и340 затронутых проверок,9 core/Finance/Schedule unit и worker smoke
успешны. Текущая схема93 модели; OpenAPI116 операций. Миграция подготовлена,
к БД не применялась; реальный EXCLUDE и PostgreSQL-гонки не проверялись.

## Продолжение MGR-07, 01.11.2026

Очередь CRM, CAS claim/решения, атомарный перенос и директорское исполнение полной
отмены описаны в [MGR-07](tasks/MGR-07.md), включая таблицу реальных моделей и
утверждённое решение владельца по частичным запросам. ManagerFinanceFacade остаётся
единственным финансовым адаптером менеджера; MGR-08 получает события Outbox.
85 собственных и348 затронутых проверок,9 kernel unit и1 worker smoke успешны.
OpenAPI123 операции;93 модели/218FK. Новая миграция подготовлена, не применялась;
реальная приёмка PostgreSQL и внешняя доставка остаются открыты.

## Продолжение MGR-08, 01.11.2026

[MGR-08](notifications/MGR-08.md) добавляет ручную отправку202, delivery metadata,
общий NotificationOutboxPublisher в MGR-03–07 и worker IN_APP/Resend. Существующий
канонический inbox/STU-10 сохранён. Без канала системная операция завершается с
FAILED intent по решению владельца, ручная отправка422. Директорское ожидание не
выдаётся за окончательное принятие оспаривания. 59 собственных+408 затронутых+
28 architecture/schema+1 worker smoke проверок проходят.125 OpenAPI операций,
94 модели/221FK. Миграция не применялась; реальные письма и PostgreSQL не проверялись.

## Продолжение MGR-09, 01.11.2026

[MGR-09](dashboard/MGR-09.md) добавляет dashboard на одном READ ONLY/Repeatable Read
снимке, общие read-spec MGR-02/04/05/06/07 и подтверждённый владельцем расчёт
неопубликованного/нераспределённого остатка по валютам. Смешанные семьи исключены
из денежного агрегата. Шесть явных reporting-команд; кэша/Audit нет.47 собственных+
95 unit+338 HTTP/architecture+1 worker smoke проверок проходят. OpenAPI126 операций.
Новая миграция не нужна. Нагрузочный отчёт NOT_RUN: p95 на500 учениках не подтверждён.

## Продолжение MGR-10, 01.11.2026 — размещение frontend

Шаг0: кабинет ученика — `apps/student-cabinet`, общего UI-пакета нет.
Создан `apps/manager-web` (`@online-school/manager-web`): те же React18.3.1,
Vite7.3.7, Router7.18.5, Query5.105.0, Zustand5.0.16 и нативные React/FormData формы.
Сессии/MFA/CSRF остаются в ядре. Новые read-only справочники форм используют
ManagerScopeService; никаких новых менеджерских финансовых/учебных записей.
Исправлены Swagger-типы nullable контактов и страниц, обновлены127 OpenAPI операций.
Миграций нет. Экраны S1–S6, проверки и ограничения описаны в
[MGR-10 frontend](../../../../manager-web/README.md).
Рабочая приёмка на чистой БД и общие gate-проверки остаются открыты;
результаты моков не заменяют фактические публикации директора, PostgreSQL и доставку.

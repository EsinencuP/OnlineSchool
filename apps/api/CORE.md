# TASK-06 — защищённое ядро NestJS

Проверено 26 октября 2026. `CoreModule` подключён глобально; доменные модули находятся
в `src/modules/`. Identity и Student/Household registry реализованы в
[TASK-07](IDENTITY.md); Schedule/Education/Storage/Integrations — точки следующих задач.
Сервис публикации ledger перенесён в `modules/finance`; его базовая
policy по-прежнему запрещает публикацию, пока TASK-08 не подключит финансовые команды.

## Порядок обработки

RequestIdMiddleware → SessionGuard → RbacGuard/контекстная policy → CsrfGuard →
WebAuthnChallengeGuard → IdempotencyGuard → CriticalCommandInterceptor → handler.
Глобальные guards зарегистрированы через APP_GUARD, исключения — через APP_FILTER.
Порядок соответствует [NestJS Guards](https://docs.nestjs.com/guards) и
[NestJS Interceptors](https://docs.nestjs.com/interceptors).

Все ответы, включая 401/403/404 и некорректный JSON, получают `X-Request-ID` и
`Cache-Control: no-store`. Принимается только UUID request ID; иной заменяется новым.
Ошибки имеют `{requestId, code, message, details?, timestamp}` по общему OpenAPI-контракту.
Неизвестные исключения не раскрывают SQL, stack или параметры подключения.
Domain services возвращают Result; `fail/unwrap` в errors — единственная точка
преобразования DomainError в типизированный AppException для Nest и отката транзакции.

## Сессии и CSRF

Свой SessionStore использует PostgreSQL Session. Cookie содержит случайный 256-bit
opaque token, БД — только SHA-256. `__Host-school_session`: Path=/, HttpOnly, Secure,
SameSite=Strict, без Domain. Абсолютный TTL — 8 часов, inactivity timeout — 30 минут.
На каждом запросе проверяются expiry, revocation, disabled account, активный профиль
и текущие назначения ролей с периодами. `AccessRevocation` также учитывается при чтении.

`AccountContext.accountId/role/roles/mfaCompleted/lastActiveAt` — представление сессии
для приложения: `mfaCompleted` вычисляется из `mfa_verified_at`, активность хранится
в `last_seen_at`. Роли читаются из действующих RoleAssignment, поэтому не остаются
действительными после отзыва назначения. Эти сведения не принимаются из cookie/body.
`SessionService.revoke` атомарно меняет revoked_at, добавляет AccessRevocation и AuditEvent.
Выдача сессий — доверенный внутренний API для последующей проверки личности TASK-07.

Staff/teacher без MFA не получают бизнес-доступ. `@AllowPreMfa` действует только на
четырёх POST WebAuthn register/authenticate start/finish; `@RequireMfa` запрещает такой
допуск. Завершение WebAuthn дополнительно проверяет владельца/сессию, purpose, hash,
expiry и used_at challenge. `consume` выполняет условный UPDATE внутри транзакции.
Нормализация регистра URL и завершающего `/` исключает пропуск guard через варианты URL.

Основа challenge lifecycle теперь подключена к Identity TASK-07: реальная библиотека
проверяет RP/origin/signature/sign_count до consume и изменения credential/MFA в той же
транзакции. Для sessionless passkey login добавлена browser-binding cookie, для recovery —
отдельный ограниченный session flag. Тестовые probe-обработчики ядра изолированы от
production Identity routes; полное поведение описано в [IDENTITY.md](IDENTITY.md).

Все POST/PUT/PATCH/DELETE, включая Public, требуют равные cookie и `X-CSRF-Token`.
Для сессии дополнительно сравнивается сохранённый hash. До входа используются
подписанные HMAC токены с TTL 15 минут. `GET /api/v1/auth/csrf` выдаёт токен и
Secure SameSite=Strict cookie `__Host-school_csrf`, доступную JS для заголовка.
В `CSRF_SIGNING_SECRET` нужно локально задать не менее 32 случайных байтов; рабочего
секрета в репозитории нет. Без него анонимная выдача отказывает с 503.

Secure cookies требуют HTTPS. Локальные HTTP-тесты явно передают Cookie headers;
они не заменяют браузерную приёмку на постоянном QA HTTPS-домене.

## Доступ и контекст

Без явного `@Public`, `@Authenticated`, непустого `@RequireRole` или
`@RequirePermission` — запрет. Public нельзя совместить с защищёнными требованиями.
Роли из `RequireRole` — OR; перечисленные permissions — AND, role+permission — AND.
Неизвестное permission не выдаётся ни одной роли. TECH_OPERATOR не получает
финансовых или ученических прав автоматически. Карта минимальных permissions
явно находится в PolicyService и расширяется вместе с предметными командами.

`canAccessStudent` / `@RequireStudentAccess('id')` разрешает DIRECTOR; менеджеру —
актуальное персональное назначение; преподавателю — действующее TeachingAssignment
и ACTIVE enrollment; ученику — собственный активный StudentAccount.
Household и сходство контактов не дают прав. Проверка относится к доступу к данным;
право на урок/оплата проверяется отдельными финансовыми политиками.

## Критические команды и идемпотентность

```typescript
@Post()
@RequireRole(Role.DIRECTOR)
@RequirePermission('student:create')
@CriticalCommand({ type: 'student.create', resourceType: 'Student', topic: 'student.created.v1' })
async create(@CurrentTransaction() context: CriticalContext) {
  return context.tx.student.create({ data: { full_name: 'Synthetic example' } });
}
```

DTO необходимо валидировать до предметной записи. Критический handler использует
только `context.tx`, возвращает JSON и не отправляет HTTP response напрямую.
Внешние вызовы выполняет worker по Outbox. Обработчик может повториться после
serialization failure, поэтому внешних эффектов внутри callback быть не должно.
Для Result с ошибкой вызывается `unwrap/fail`, чтобы откатить весь callback.

IdempotencyGuard требует UUID `Idempotency-Key`, вычисляет hash канонического
method/path/params/query/body и проверяет прежний hash. Scope — account ID,
command_type — стабильное имя команды, срок — 48 часов.

Interceptor в одной SERIALIZABLE-транзакции заново проверяет session, роли и
контекстные права, получает advisory lock по account/command/key, читает результат,
либо создаёт IN_PROGRESS → выполняет handler → пишет SUCCESS AuditEvent и pending
OutboxEvent → сохраняет COMPLETED/response/result_hash. Первый и повторный ответы — 200.
Повтор не запускает handler; изменившийся payload возвращает 422. Проверка прав
предшествует выдаче кэша, включая повтор. Финансовая идемпотентность после TTL
дополнительно защищается постоянными source_operation_id/UNIQUE предметной модели.

Ошибка handler/audit/outbox откатывает бизнес-запись и idempotency cache.
Отказы безопасности пишутся отдельно от отменённой основной транзакции, без токенов
и тела запроса. Ошибка записи обязательного аудита даёт отказ 503.
Приложение должно подключаться ролью с правами `online_school_runtime`;
миграции уже запрещают UPDATE/DELETE audit_events для этой роли.

`TransactionService.runCritical` использует максимум три полные попытки, exponential
backoff 25/50 ms + jitter. Повторяются только serialization/deadlock конфликты.
`maxRetries` сохранён как имя параметра задания, но означает предел общего числа
попыток 1–3. Другие ошибки не повторяются; exhausted → Result с 503.

## Проверка

Четыре unit-теста входят в обычный `pnpm test`. Девять HTTP/PG тестов запускаются
отдельно против одноразовой локальной PostgreSQL 18 с обеими миграциями:

```sh
# TEST_DATABASE_URL = прямой адрес localhost, имя online_school_test*.
pnpm --filter @online-school/api test:integration
```

Интеграционный набор добавляет синтетические fixtures через seedQA; не сбрасывает БД.
Покрыты 401/403, default deny, MFA, CSRF всех mutation verbs/подделка подписи, cookie flags,
актуальные manager/teacher/student policies, challenge ownership/replay/варианты URL,
request ID на malformed JSON и 404, одинаковые/разные payload, конкурентный повтор
из разных сессий, откат при domain/audit/outbox ошибках, отзыв/TTL/idle/роль.
Дополнительно прошла прежняя регрессия 31 DB-теста. Production GO/FND-GATE этим
инкрементом не выдаются.

## Подключение Finance (TASK-08)

FinanceScopeGuard устанавливает resourceAuthorizer для текущего запроса.
AccessService вызывает его также внутри критической транзакции перед чтением
idempotency cache. Отзыв назначения менеджера поэтому блокирует повтор уже
выполненной команды, даже если роль и сессия ещё действуют. Права Finance заданы
явно в PolicyService; TECH_OPERATOR их не получает. Handler повторяет предметные
проверки в этой же транзакции. [Маршруты и примеры](FINANCE.md).

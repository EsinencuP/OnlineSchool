# TASK-07 — Identity, Passkeys и Recovery

Реализовано и проверено 26 октября 2026 на PostgreSQL 18.6. Используется закреплённая
`@simplewebauthn/server` **14.0.3**; API и правила проверки сверены с
[официальной документацией](https://simplewebauthn.dev/docs/packages/server).
Применяется реальная проверка registration/authentication; production verifier не подменён.

## Конфигурация

В локальном `apps/api/.env` задаются DATABASE_URL, CSRF_SIGNING_SECRET и:

```dotenv
WEBAUTHN_RP_ID=qa.your-school.example
WEBAUTHN_ALLOWED_ORIGIN=https://qa.your-school.example
```

Исторический пример TASK-07. В TASK-12 владелец утвердил постоянный адрес
`https://onlineschool-xi.vercel.app` для единственного рабочего проекта.
Конфигурация принимает ровно один HTTPS hostname: RP ID совпадает с origin hostname;
wildcard, credentials, path, port и завершающий `/` запрещены. Постоянный точный
Vercel hostname разрешён; preview с другим hostname не проходит проверку origin/RP.
Проверяется origin в clientDataJSON; библиотека повторно проверяет RP hash/origin/type,
подпись и обязательные user presence/verification. Если HTTP Origin присутствует,
он также должен совпасть. Неверный origin даёт 400 и отдельный DENIED AuditEvent
с кодом WEBAUTHN_ORIGIN_INVALID. Без конфигурации WebAuthn отказывает с 503.

Все cookies остаются Secure/Strict и требуют HTTPS в браузере. HTTP-тесты явно
передают Cookie headers; они не подтверждают работу физического ключа и браузера на QA TLS.

## HTTP-контракт

Все изменяющие запросы требуют cookie + `X-CSRF-Token`, включая вход и recovery complete.
Перед входом клиент получает подписанный double-submit token через GET `/api/v1/auth/csrf`.
Описание DTO и ошибок — `packages/api-contracts/openapi/openapi.json`; типы генерируются.

| Метод и путь `/api/v1`                    | Вход                                                  | Доступ / результат                                                                       |
| ----------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| POST `/auth/session`                      | `{email, password}`                                   | Новая stage-one сессия, `mfa_completed=false`                                            |
| POST `/auth/session`                      | `{method:"passkey", email}`                           | Options + challengeId для passwordless login; одинаковая форма для неизвестного аккаунта |
| GET `/auth/session`                       | —                                                     | Текущий account/roles/MFA/recovery stage; без сессии 401                                 |
| DELETE `/auth/session`                    | пустое тело                                           | Отзыв сессии, AccessRevocation + Audit/Outbox, очистка cookies                           |
| POST `/auth/webauthn/register/start`      | `{}`                                                  | Только сессия; creation options, resident key и UV required                              |
| POST `/auth/webauthn/register/finish`     | `{challengeId, response}`                             | Проверка и сохранение credential; сама регистрация не завершает MFA                      |
| POST `/auth/webauthn/authenticate/start`  | `{}` либо `{email}`                                   | Текущая сессия либо публичный passwordless flow                                          |
| POST `/auth/webauthn/authenticate/finish` | `{challengeId, response}`                             | Assertion verification, новый counter и новая MFA-сессия                                 |
| POST `/auth/recovery/initiate`            | `{authorizationId}`                                   | MFA director/tech operator + trusted evidence; обязателен UUID Idempotency-Key           |
| POST `/auth/recovery/complete`            | `{recoveryId, token}`                                 | Одноразовая сессия только для регистрации нового passkey                                 |
| POST `/students`                          | `{fullName, email?, phone?, birthDate?}`              | MFA director/manager; стабильный Student, без кабинета или оплаченных прав               |
| POST `/households`                        | `{label?}`                                            | MFA director/manager; создаётся ownership для предметной проверки                        |
| POST `/households/:id/members`            | `{studentId, basis}` либо `{representativeId, basis}` | Ровно один тип участника; role + object-policy + SQL constraints                         |

`response` — стандартный JSON результат браузерного WebAuthn API / SimpleWebAuthn browser,
включая id/rawId/type/clientExtensionResults/response. Сервер не принимает client MFA flags,
не выбирает аккаунт по сходству PII и отклоняет неизвестные поля собственных DTO.

## Сессии, ключи и replay

Challenge — случайные **32 байта**, TTL **5 минут**; в БД только SHA-256.
В генератор передаются bytes: строковый challenge библиотека кодирует как UTF-8,
что иначе изменило бы фактическое число байтов. Challenge привязан к account/session;
для passwordless login — к отдельной HttpOnly-cookie `__Host-school_webauthn_login`.
Публичные options не раскрывают credential IDs или наличие аккаунта.

Finish блокирует challenge и account/credential, проверяет владельца, срок, purpose,
origin/RP/type/UV/signature/userHandle, затем атомарно помечает used_at и сохраняет результат.
Одинаковый challenge повторно не проходит, включая конкурентные запросы.
Counter читается под блокировкой; монотонность проверяет SimpleWebAuthn, значение хранится
как BigInt uint32. Аутентификаторы с постоянным нулём поддерживаются согласно протоколу:
replay защищён одноразовым challenge; обещания обнаружить клонирование по нулевому counter нет.
Сохраняются AAGUID, COSE public key, transports, backup eligibility/state; identity key
неизменяем, counter не уменьшается, отзыв credential необратим для приложения.

После успешного assertion прежняя сессия отзывается, выдаются новый opaque token и CSRF.
Клиент должен обновить X-CSRF-Token из новой cookie/response. Staff/teacher до MFA имеют
только WebAuthn flow; чтение собственного stage и logout разрешены для отображения/отмены
незавершённого входа. Бизнес endpoints требуют MFA. С одним паролем нельзя зарегистрировать
дополнительный ключ, если уже есть активный credential. Первый enrollment допускается
после доверенного password provisioning; recovery — только после отдельной проверки личности.

Пароли: scrypt N=131072, r=8, p=1, случайная соль 16 байт, hash 64 байта, constant-time
comparison; для неизвестного пользователя выполняется тот же KDF. Plaintext не сохраняется.
Инженерные rate limits: 10 password attempts на identifier / 15 минут, 30 для иных auth
identifiers и 100 на socket IP/realm. PostgreSQL counters сохраняются отдельно от отката
неудачной аутентификации; превышение — 429 с audit. X-Forwarded-For не считается доверенным.
Для reverse proxy нужны проверенная передача клиентского IP и нагрузочная настройка лимитов
в эксплуатационном инкременте; TTL buckets можно очищать будущим worker по expires_at.

## Управляемое восстановление

HTTP не создаёт разрешение на основании `identityVerified` или `ownerApproved` из body.
`RecoveryAuthorization` — отдельная append-only запись: проверенный субъект,
уполномоченный инициатор, приватный evidence reference, срок и подтверждённое поручение
владельца для директора. Runtime имеет SELECT, но **не INSERT/UPDATE/DELETE** этого реестра.

Уполномоченный оператор сначала выполняет внешнюю проверку личности/поручения и затем
фиксирует её через maintenance роль (DIRECT_URL), используя защищённый JSON-файл:

```sh
node scripts/authorize-recovery.mjs --verified-evidence-file .identity-ops/recovery.json
```

Поля файла: subjectAccountId, authorizedActorId, identityEvidenceRef, reason и при
восстановлении директора ownerInstructionRef. CLI фиксирует выполненную проверку;
он не проверяет документы или личность автоматически. Сам запуск требует доверенного
maintenance-доступа. Срок записи CLI — один час; SQL допускает максимум 24 часа.

Director восстанавливает другого сотрудника/преподавателя. DIRECTOR subject требует
TECH_OPERATOR и owner instruction. Self-recovery запрещён. Проверяются текущие роли,
активные профили и аккаунты; заявленные во входе роли не используются.

Initiate в одной транзакции отзывает все сессии, деактивирует все ключи, потребляет
ещё действующие challenges, пишет account-wide AccessRevocation с инициатором,
устанавливает recovery_registration_required и создаёт RecoveryRequest.
Предыдущие незавершённые requests отзываются. Вместе сохраняются Audit и pending Outbox.
Bootstrap token показывается уполномоченному инициатору **один раз**, для передачи
проверенному субъекту по защищённому каналу; в БД хранится только hash, TTL ≤15 минут.
Самостоятельных backup-кодов и автоматической рассылки нет.

Complete потребляет token один раз и ещё раз отзывает старые сессии; новая сессия имеет
recovery_only=true и MFA=false. Она не допускает бизнес-запросы и аутентификацию старым
ключом. Успешная регистрация нового ключа снимает recovery flag; затем нужен отдельный
assertion для MFA. Пересечение timestamps нового сеанса и account-wide revocation
защищено выдачей created_at строго после последнего отзыва.

Auth one-time ответы/cookies не сохраняются в IdempotencyRecord. Replay finish → 400;
повтор initiate по использованному authorization/operation key → 409 без нового отзыва
или раскрытия token. При потере одноразового ответа нужна новая проверенная authorization.
Обычные Student/Household команды используют cache/idempotency и атомарный механизм TASK-06.

Для первоначальной установки пароля существующего аккаунта:

```sh
node scripts/set-account-password.mjs --protected-input-file .identity-ops/password.json
```

Поля: accountId и password (12–256 символов). Инструмент отзывает прежние сессии и пишет
audit, не выдаёт роли, не снимает MFA/recovery ограничения и не меняет credentials.
`.identity-ops/` исключён из Git/Graphify/Prettier; секретные файлы следует удалять после
проведения операции. Seed по-прежнему не содержит рабочих паролей или passkeys.

## Student / Household

Owner-of-write — RegistryService в CrmModule. Менеджер, создавший Student, получает явное
AssignedManager; StudentAccount и EntitlementGrant не создаются. Household не является
юридическим представительством и не даёт прав. Менеджер меняет только созданную им группу,
проверяя доступ ко всем её ученикам и новому ребёнку. Добавление Representative требует
действующей VERIFIED связи с доступным ребёнком группы. Director действует по организационной
политике. Нет отдельного родительского логина и автоматического сопоставления контактов.

## Миграция и проверки

`20261026040000_task07_identity` добавляется после двух прежних миграций, включая legacy chain.
Теперь 66 моделей: RecoveryAuthorization, RecoveryRequest и AuthRateLimit; добавлены
recovery flags, login challenge binding и creator Household. Все PK UUID, timestamps и
именованные RESTRICT FK сохранены. Есть SQL state/hash/period checks и append-only guards.

На PostgreSQL 18.6 проверены чистая установка и upgrade заполненной TASK-06 staging-схемы:
старые значения всех колонок, ID и timestamps сохранились, status current, schema diff 0.
Это локальная репетиция; внешний staging/production не менялись.

```sh
# Две отдельные одноразовые локальные БД online_school_test*, с тремя миграциями.
# TEST_DATABASE_URL — core tests; IDENTITY_TEST_DATABASE_URL — Identity tests.
pnpm --filter @online-school/api test:integration
```

Прошли 9 core + 11 Identity HTTP/PG сценариев с реальными synthetic ES256/CBOR assertions,
31 прежний DB-тест и 6 QA seed/SQL тестов. Отдельно проверены оба maintenance CLI на
синтетических записях. Физический FIDO2/браузер, QA DNS/TLS, внешняя проверка личности,
production deployment и формальный FND-GATE этой локальной проверкой не подтверждаются.

# STU-11 — профиль, безопасность и блокировка

Состояние на 2026-10-28: реализация и целевые проверки готовы. PostgreSQL-проверка
отложена по решению владельца STU-08/09/10. Миграция подготовлена, не применялась;
деплой, настоящий почтовый транспорт и S3-аватар не проверялись.

Используется существующая модель: User → AuthAccount, studentProfileId → Student.id
с текущей связью StudentAccount, FileRecord → S3Object, AuditLog → AuditEvent.
Нового параллельного identity, JWT или родительского аккаунта нет.

## Маршруты и ограничения

| Маршрут                                               | Поведение                                                                                           |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `PATCH /api/v1/student/profile`                       | displayName 1–100, avatarFileId — UUID; обновлённый StudentProfileDto                               |
| `GET /api/v1/student/profile/avatar`                  | собственный выбранный приватный raster, no-store; отсутствие/карантин/удаление — 404                |
| `PATCH /api/v1/student/security/change-password`      | текущий пароль + новый 8–128, латинские буквы и цифры; 200, mustChangePassword=false, новые cookies |
| `POST /api/v1/student/security/change-password`       | совместимый deprecated alias STU-01; те же проверки и транзакция                                    |
| `POST /api/v1/student/security/change-email/request`  | текущий пароль проверен; 200 с сообщением только после подтверждения приёма провайдером             |
| `POST /api/v1/student/security/change-email/confirm`  | верный шестизначный OTP меняет login email; 200 `{email}` и ротация cookies                         |
| `GET /api/v1/student/security/sessions`               | массив собственных активных сессий без cookie/CSRF/hash                                             |
| `DELETE /api/v1/student/security/sessions/:sessionId` | другая собственная сессия — 204, повтор — 204; текущая — 409; чужая/неизвестная — одинаковый 404    |

Для всех маршрутов обязательны существующие cookie session/STUDENT/context guards.
Изменения требуют CSRF. Для PATCH profile обязателен UUID Idempotency-Key и обычный
critical-command replay; безопасный ответ содержит только профиль и относительный
avatar endpoint. Для security-команд UUID необязателен и служит корреляцией аудита;
секретные тела и их вычислимые отпечатки **не попадают** в generic idempotency cache.
Повтор запроса email — новый код, а не воспроизведение предыдущего ответа.

`mustChangePassword=true` проверяется в StudentContextGuard, в том числе при повторном
использовании request context. Разрешены только GET `/me` и POST/PATCH
`/security/change-password`. GET `/me` сохранён намеренно: он присутствует в explicit
allowlist задания и нужен для показа первого входа/блокировки. Остальные существующие
student-маршруты, включая profile и security, получают 403 MUST_CHANGE_PASSWORD.
Неизвестный маршрут по-прежнему 404, он не даёт доступ к данным.

После смены временного пароля при отсутствии допуска все защищённые student-маршруты
получают 402 ACCESS_SUSPENDED. STU-11 отменяет широкое исключение profile/security
STU-01 и исключение чтения subscription/payments/ledger STU-07. Исторические документы
и доказательства прошлых этапов сохраняют прежний статус; текущие guard-тесты обновлены.
Смена пароля доступна без платного допуска, но с session/CSRF/currentPassword.
Определение hasActiveAccess STU-01 сохранено, включая отдельно разрешённый руководителем
ограниченный допуск; нового автоматического требования оплаты STU-11 не создаёт.
Обычный logout вне student namespace сохраняется. WebAuthn/passkeys ученику запрещены;
обязательная MFA рабочих ролей не ослаблена.

## Профиль и аватар

displayName сохраняется отдельно в Student.display_name; Student.full_name в реестре,
финансовые документы, email/телефон и личности представителей не переписываются.
Старые профили отображают full_name до первого изменения alias.
Email и phone не входят в whitelist PATCH profile (400). Телефон этим API не меняется;
новый процесс верификации телефона/SMS в STU-11 не добавляется.

avatarFileId указывает на уже загруженный S3Object: VERIFIED, не из будущего,
uploaded_by текущего ученика, JPEG/PNG/WebP до 2 MiB. SVG и активный контент запрещены.
SQL guard дополнительно связывает файл с активированным учеником; GET повторно
проверяет владение стабильным Student.id, статус и размер. Предварительная загрузка
файла является предусловием этого контракта; отдельный profile upload API не добавлен.

Возвращается относительный `/api/v1/student/profile/avatar?v=<file UUID>`, который
требует действующую сессию и доступ. Параметр v служит только обновлению img cache;
он не выбирает чужой файл. Приватные signed URLs и object keys клиенту не выдаются.
S3 чтение ограничено 2 MiB, проверяет заявленные size/type и сигнатуру raster;
полный decoder/re-encoding изображения не выполняется. Ответ имеет no-store,
nosniff и ограничивающий CSP. После QUARANTINED/DELETED изображение не выдаётся.

## Пароль, OTP и аудит

Смена пароля проверяет текущий пароль без обрезания пробелов; ошибка — 401
CURRENT_PASSWORD_INVALID. Новый пароль отличается от текущего, длина 8–128 и
шаблон задания. Реальный scrypt KDF и формат хеша STU-01 сохранены; рабочие аккаунты
сохраняют прежнюю стандартную политику 12–256. В одной critical transaction меняются
хеш, initial flag, отзываются старые сессии и pending OTP, создаётся новая сессия,
пишутся обязательные audit/outbox. Сбой аудита откатывает все изменения.

Запрос email требует текущего пароля, активного допуска и свободного адреса.
Сравнение занятости учитывает legacy логины с другим регистром; аккаунты не сливаются.
В StudentEmailChange хранится HMAC-SHA256 от purpose/challenge/account/email/code,
а не шестизначный код или его перебираемый незащищённый хеш. Секрет — отдельные
32 случайных байта. Генератор использует crypto.randomInt, сравнение timingSafeEqual.
Повторный запрос отзывает предыдущие коды; случайное совпадение с ещё живым старым
кодом также исключается. TTL строго 600000 ms от issued_at, на границе код недействителен.

Максимум пять проверок кода. Неудачная проверка коммитит attempts и DENIED-аудит,
затем возвращает HTTP 400 EMAIL_OTP_INVALID; бросать ошибку внутри транзакции нельзя,
иначе счётчик откатился бы. Пятая неудачная попытка отзывает challenge. Успешный код
одноразовый, привязан к login/student/newEmail; повтор, чужой аккаунт и другой адрес
отклоняются. AuthAccount блокируется, контекст и доступ перепроверяются в транзакции.

При успехе атомарно фиксируются used_at, AuthAccount.login_id/email_verified_at,
отзыв сессий и новая сессия; обязательный аудит содержит actor_id, action и DB
recorded_at. Пароли, OTP, хеши, email из запроса и cookie-секреты не копируются в
audit/outbox/response cache. SQL guards и deferred constraint связывают использованный
challenge с verified login в одном commit. CRM-контакт Student.email не меняется.

Запрос OTP ограничен пятью на 15 минут/account, общие IP/identity лимиты сохранены.
Письмо отправляется после commit, вне DB-транзакции. При ошибке провайдера — 503,
а не фиктивное «отправлен». При неоднозначном timeout письмо могло быть принято:
полученный код остаётся действителен до TTL/следующего запроса. Автоматического
повтора нет, поскольку plaintext OTP не сохраняется для очереди. Если параллельный
новый запрос уже отозвал код до подтверждения доставки, старый запрос получает 409
EMAIL_REQUEST_SUPERSEDED. Это security-подтверждение пользователя; организационные
автоуведомления семье по CON-08/B не добавляются.

Подготовлен Resend HTTPS adapter с фиксированным endpoint, plain text и
[provider idempotency key](https://resend.com/docs/dashboard/emails/idempotency-keys)
на challenge UUID; [официальный API-контракт](https://github.com/resend/resend-openapi/blob/main/resend.yaml).
Нужны RESEND_API_KEY, STUDENT_EMAIL_FROM (подтверждённый sender) и
STUDENT_EMAIL_OTP_SECRET (32 bytes standard base64). Без них — EMAIL_NOT_CONFIGURED 503.
Задавать их нужно в server secret store существующего проекта, без VITE_/public
префикса; в чат, Git, args команд и логи значения не передавать. В этом TASK
реальный провайдер не подключался и письма не отправлялись.

## Сессии и контакты блокировки

Session хранит bounded очищенный user_agent и наблюдаемый socket ip_address (inet).
Произвольным forwarded headers доверия нет; за proxy это может быть адрес proxy,
а не посетителя. Для старых сессий без метаданных DTO возвращает пустые строки.
Выдача сессий обновлена для login/password/email/recovery/MFA; cookie и CSRF secrets
в список не включаются. Отзывается только другая сессия того же account_id;
создаётся AccessRevocation, поэтому старый cookie сразу перестаёт работать.

402 и неактивный `/me` содержат контакты текущего AssignedManager этого Student.id:
действующее назначение, enabled staff/login, активная роль MANAGER/DIRECTOR.
Публичные ссылки задаются в StaffAccount.student_whatsapp_url/student_telegram_url;
скрытый личный phone не публикуется автоматически. Разрешены только HTTPS wa.me
с номером и t.me с username. При отсутствии — пустые строки, без подстановки общего
менеджера из env или другого ученика. Заполнение этих полей в рабочей среде ещё нужно
проверить при её приёмке.

В QA-оболочке добавлен отдельный StudentAccess: forced-password → suspended → active.
Экран «Доступ приостановлен» показывает только валидные контакты; временный пароль
сначала меняется через PATCH, поля очищаются при отправке/ошибке. Ученик не попадает
в staff MFA/passkey и QA command workspace. Bootstrap обновляется после смены
пароля и возврата фокуса. Это минимальный access экран; полноценные UI профиля,
email и управления сессиями относятся к последующей реализации ученического UI.

## Доказательства и приёмка

`pnpm test:stu11`: 66 новых unit/actual Nest HTTP/SDK проверок с mock Prisma/S3/mail;
реальный scrypt отдельно проверен на 8 символах. Дополнительно прошли 61 адресная
регрессионная проверка STU-01/STU-07 и transport/empty-response. Тесты выполнялись
логическими адресными наборами, без повторного общего прогона.

В браузере на синтетических API проверены восемь access/password сценариев и три
скриншота (desktop, 390 px, first password). Это не реальные DB/session/email
end-to-end доказательства; local API/health отдельно не поднимался.
Prisma validate/generate, API/worker/SDK/frontend builds и целевой lint — PASS.
OpenAPI85. Офлайн разобраны 24 SQL statements/6 PLpgSQL bodies, соответствие новых
колонок Prisma и шесть CTE-сценариев личного менеджера. Read-only PostgreSQL тест
`tests/integration/student-security-readonly.test.mjs` подготовлен, не запускался.

Результаты: `infra/STU11_EVIDENCE.json`, `tests/evidence/stu11-sql-syntax.json`,
`tests/evidence/stu11-browser.json`. До production acceptance остаются миграции/
typed binding/constraints/grants и гонки на PostgreSQL, реальная доставка OTP,
проверка S3-avatar и данных назначенного менеджера, полный browser→API→DB/provider
поток и FND-GATE. Дополнительные БД/ветки/контейнеры, deployment и production-записи
в этом TASK не выполнялись.

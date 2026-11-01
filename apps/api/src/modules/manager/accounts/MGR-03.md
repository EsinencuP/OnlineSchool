# MGR-03 — создание и восстановление аккаунта

Реализованы `POST /api/v1/manager/students/:studentId/account` и
`POST .../account/reset-password`. Первый ответ создания — 201, сброса — 200.
Оба требуют сессионную роль MANAGER, активный staff-профиль, принадлежность
ученика портфолио, CSRF и UUID Idempotency-Key. Чужой/отсутствующий ученик —
одинаковый STUDENT_NOT_FOUND. Проверка повторяется внутри транзакции, включая replay.

## Сверка с существующей моделью

| ТЗ                            | Реальный код                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------- |
| StudentProfile                | Student, учебный доступ — StudentAccount                                                            |
| Аккаунт Identity              | AuthAccount + RoleAssignment STUDENT                                                                |
| ManagerProfile                | StaffAccount MANAGER; портфолио AssignedManager                                                     |
| mustChangePassword            | существующий StudentAccount.must_change_password                                                    |
| Срок временного пароля        | новые temporary_password_issued_at / temporary_password_expires_at                                  |
| Первая оплата                 | PaymentDistribution на Subscription ученика + подтверждённый PaymentReceipt + опубликованный Ledger |
| Ссылка финансового основания  | activation_distribution_id; legacy activation_payment_confirmation_id сохранён                      |
| Единственный активный аккаунт | существующий частичный uq_student_active_account; не дублируется                                    |

Finance read-model проверяет опубликованные распределения на собственный
абонемент. `PaymentReceipt.student_id` — контакт, он не определяет владельца
денег. Подтверждённого поступления без опубликованного распределения недостаточно.
Полная совокупная оплата допускает обычную активацию; любая неполная оплата требует
действующего отдельного ограниченного решения директора после последней оплаты,
с неиспользованным лимитом занятий. Отказ — FIRST_PAYMENT_NOT_CONFIRMED.
Менеджер не подтверждает деньги и не пишет Ledger/учебные результаты.
Оплаченный абонемент может начинаться в будущем: создание аккаунта не требует,
чтобы занятия уже начались. Доступ к занятиям отдельно проверяет Student policy.

В StudentAccount сохраняется исходный финансовый директор, проверенный на момент
его решения. Технический исполнитель менеджер указан в Audit и назначении роли.
Миграция расширяет проверку директора для этого пути; legacy-проверка сохранена.
Утверждённое [уточнение по распределениям](../../../../../../docs/online_academy_manager_finance_distribution_clarification_2026_10_31.md)
также задаёт требования будущих MGR-04/05/09; их реализация сюда не входит.

## Секрет и атомарность

Identity создаёт CSPRNG-пароль из 16 символов без 0/O/1/l/I, с буквами и цифрами,
и хеширует существующим student scrypt. DB clock задаёт срок 72 часа. Секрет
возвращается через request-local проекцию только после commit, с no-store.
Он отсутствует в Audit, Outbox, логировании, durable idempotency JSON и примерах
OpenAPI. Повтор того же ключа — 200, temporaryPassword:null,
passwordAlreadyIssued:true; иной body — 409. При потере первого ответа нужен
reset-password: повторная выдача сохранённого пароля невозможна.

Student lock и запись updated_at принуждают конкурирующие SERIALIZABLE-команды
повторить чтение. Ядро допускает не более трёх попыток; ошибки data-access
возвращаются как Result и сохраняют признак retryable. Аккаунт, роль, Audit,
Outbox и безопасный результат идемпотентности коммитятся вместе. Проекция секрета
очищается на каждой новой попытке, включая replay после неудавшегося commit.

Сброс отзывает все сессии, passkey-credentials, незавершённые MFA и email-change
challenge в той же транзакции. Лимит — три успешных сброса за скользящие 24 часа
на ученика, считается по Audit. Replay лимит не расходует. Дополнительно действуют
существующие Identity rate-limit buckets по менеджеру и ученику (30/15 минут
для каждой команды; дополнительно 100 запросов/IP за 15 минут).

## Вход и уведомление

Правило MGR-03 уточняет старый bootstrap STU-11: до смены пароля запрещены также
GET /student/me и GET /auth/csrf, код PASSWORD_CHANGE_REQUIRED. Разрешены только
POST/PATCH /student/security/change-password и фактический logout
DELETE /auth/session. CSRF выдаётся до аутентификации и сохраняется cookie;
экран смены читает её, не запрашивая запрещённый bootstrap. Просроченный временный
пароль не создаёт сессию, существующая сессия также не обходит срок. Установка
того же временного пароля отклоняется PASSWORD_UNCHANGED. Успешная смена снимает
флаг и срок, используя существующий отзыв/ротацию сессии.

Отдельное `manager.student.account-created.v1` после commit обрабатывается worker:
канонический ACCOUNT_CREATED source → существующий NotificationService → inbox.
Логин и инструкция включены, пароль отсутствует. Повторная доставка идемпотентна.
Миграция расширяет STU-10 provenance trigger, сохраняя все старые источники.
Внешний канал отправки MGR-08 этим инкрементом не объявляется реализованным.

## Проверки и ограничения

`pnpm test:mgr03` проверяет Identity KDF, реальные Nest guards/interceptor/pipes,
login → запрет bootstrap → смену пароля → кабинет, replay/rollback/retry,
изоляцию портфолио, роли, CSRF, финансовый допуск, отзыв ключей и reset quota.
Persistence и финансовые факты подменены. SDK/worker проверяют контракт и inbox.
Playwright использует синтетический API и собранный кабинет.

Миграция 20261031110000_mgr03_student_credentials подготовлена, не применена.
Prisma validate и офлайн syntax parse не доказывают grants/triggers, гонки или
планы PostgreSQL. Новая БД/ветка/контейнер не создавались, рабочие данные не
изменялись согласно PHASE0_CHECKS.md. Реальный MGR-05 → allocation → login поток,
миграционная приёмка, FND-GATE и production GO остаются отдельными проверками.

Финальные адресные результаты: MGR-03 — 49/49, затронутые CRM/student security/
subscription/notifications — 262/262; 56 проверок MGR-01 также успешны, причём
архитектурный набор (27) повторён отдельно с testTimeout=120000 после таймаута
type-aware ESLint на загруженной машине. Это 367 разных unit/HTTP/SDK/architecture
проверок, без общего project regression. Отдельный MGR-03 Playwright — 1/1;
проверяет вход, обязательную смену, CSRF без запрещённого bootstrap и кабинет.
Попытки старого общего login/upload сценария завершались таймаутами старта/отрисовки;
их полный проход не заявляется. API/worker/contracts/frontend сборки и адресный
ESLint прошли; OpenAPI 3.1 содержит 95 операций, Prisma validate/generate и
OpenAPI/Orval обновлены. Офлайн разобраны 10 SQL-вариантов, включая 13 statements
миграции и 3 PL/pgSQL-функции. Артефакты — tests/evidence/mgr03-*.json.

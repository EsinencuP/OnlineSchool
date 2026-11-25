# MGR-08: уведомления, 01.11.2026

## HTTP и безопасность

POST `/api/v1/manager/students/:studentId/notifications` принимает channel IN_APP/EMAIL,
body1..2000, optional subject<=150 только для EMAIL; возвращает202 NotificationDto
со статусом QUEUED. Subject не допускает переводов строки. DTO отвергает неизвестные
поля. GET того же пути возвращает items/nextCursor; фильтр status, limit25/max100,
стабильный created_at/id cursor, связанный с менеджером, учеником и фильтром.
GET private/no-store. Cursor использует общий AES-GCM примитив и30-минутный TTL.

Только активный MANAGER с core session/MFA; остальные роли403, аноним401. Каждый
запрос и cached replay проверяет актуальное портфолио; чужой/отсутствующий ученик404.
Мутация повторяет проверку в транзакции, требует CSRF и UUID Idempotency-Key.
Невалидный ключ даёт установленный ядром400, отсутствующий —400; новое тело с прежним
ключом409. managerId поступает из контекста. Ошибки data access возвращаются Result.

Лимит MANUAL_NOTIFICATIONS_PER_HOUR=10 на manager/student за предыдущий час.
Общий publisher берёт advisory xact lock и считает delivery intents, включая FAILED;
SERIALIZABLE/retry защищает конкурирующие команды. Повтор командного ключа не
считает сообщение заново. Конфигурация лимита положительная, максимум1000.

Ссылки допускают только HTTPS, точный hostname из NOTIFICATION_ALLOWED_DOMAINS
(либо WEBAUTHN_RP_ID), плюс meet.google.com. Чужие поддомены, credentials, иные
схемы и нестандартные порты отклоняются с `422 LINK_NOT_ALLOWED`. Ручной body
хранится простым текстом. Email отправляется в текстовом формате. Проверка
отклоняет распространённые маркеры учётных секретов.

Шаблоны принимают только точные строковые переменные, без лишних/пропущенных полей.
UUID/email и длины валидируются. ACCOUNT_CREATED содержит логин и общую инструкцию,
не временный пароль. Outbox доставки содержит только notificationId; Audit
NOTIFICATION_QUEUED — template/channel/textLength и ссылки, без body/subject/email.
Публичный DTO не содержит body, recipient email, provider receipt или техническую
ошибку. failureReason — безопасный текст; NO_DELIVERY_CHANNEL имеет отдельную причину.

## Producers и дедупликация

MGR-03/04/05/06/07 вызывают NotificationOutboxPublisher.enqueue внутри исходной
транзакции. Ошибка записи delivery/Audit/Outbox откатывает исходную операцию.
Бизнес-события сохранены отдельно от delivery-команды; их старые account/subscription
handlers теперь используют тот же publisher и не создают второй inbox напрямую.

| Producer                                   | Код/ключ                                                        |
| ------------------------------------------ | --------------------------------------------------------------- |
| MGR-03 созданный аккаунт                   | ACCOUNT_CREATED / account-created:accountId                     |
| MGR-04 CREATE/RENEW/FREEZE/UNFREEZE/EXPIRE | SUBSCRIPTION_* / manager-subscription:operationId               |
| MGR-05 директор подтвердил поступление     | PAYMENT_CONFIRMED / receipt-confirmed:paymentId                 |
| MGR-06 create/reschedule/cancel            | LESSON_SCHEDULED/RESCHEDULED/CANCELLED / lesson:id:version:type |
| MGR-07 DECLINE/REJECT                      | RESCHEDULE_DECLINED/DISPUTE_REJECTED / task:id:type             |
| Director Finance исполнил полную отмену    | DISPUTE_ACCEPTED / task:id:DISPUTE_ACCEPTED                     |
| Ручное сообщение                           | MANUAL_MESSAGE / manual:managerId:studentId:operationId         |

Одобренный перенос MGR-07 уведомляет через MGR-06 ровно один раз. Ожидающие
директорского решения переносы/оспаривания не получают ложный окончательный итог.
Платёжный контакт и получатель распределения различаются: новое receipt-уведомление
не сообщает деньги/доступ ученика. Прежний STU-10 payment-allocation notice сохраняет
свои проверки утверждённого распределения и относится к его получателю. Это разные
события. Семейные суммы и чужие данные не добавляются.

Уникальны dedupe_key и source_id. Повтор intent сравнивает ученика, template,
переменные и выбранный канал/subject; другое содержание409. P2002 при конкурентной
вставке переводится в retryable transaction conflict. SQL trigger защищает неизменность
snapshot/терминального статуса и связь source с собственным учеником/фактом.
Для уроков сохраняются существующие ключи SQL capture. Старый source projector
исключает delivery-managed sources; worker использует тот же NotificationService.

## Worker и ограничения доставки

Системный канал — активный аккаунт → IN_APP, иначе email контакта → EMAIL.
По [решению владельца](../../../../../../docs/manager-rules.md)
при отсутствии обоих исходная операция завершается, intent сразу FAILED с
NO_DELIVERY_CHANNEL. Ручной запрос без выбранного канала422 и откатывается.

OutboxWorker использует прежние committed claim, lease, JobAttempt, retry и DEAD.
IN_APP создаёт канонический inbox и receipt, затем SENT в одной worker-транзакции.
При деактивации аккаунта после enqueue — FAILED. EMAIL использует неизменяемые
recipient/subject/body, фиксированные endpoint/from config и безопасные коды ошибок.
SENT означает принятие Resend API, а не прочтение письма или отсутствие bounce;
webhook отслеживания почтового ящика здесь не реализован.

Committed claim сохраняет first_attempt_at перед внешним вызовом. Resend получает
стабильный Idempotency-Key `manager-notification/<id>` и timeout5s. Пока допустимы
повторы, ошибка оставляет QUEUED, а исходная бизнес-операция уже завершена. После
исчерпания попыток DEAD переводит intent в FAILED. [Resend хранит ключ24 часа](https://resend.com/docs/dashboard/emails/idempotency-keys);
повтор после23 часов от первой claim прекращается как DELIVERY_UNCONFIRMED, без
нового сетевого запроса. Неопределённый внешний исход требует сверки, а не нового
автоматического ключа. Это также может остановить доставку после длительного сбоя
процесса ещё до первой фактической отправки. Сетевые ошибки и адреса не логируются.

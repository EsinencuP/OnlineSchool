> Исходный текст из [пакета Модуль 2](https://raw.githubusercontent.com/EsinencuP/OnlineSchool/main/docs/AI%20Coder%20Tasks%20%E2%80%94%20%D0%9C%D0%BE%D0%B4%D1%83%D0%BB%D1%8C%202%20%D0%9A%D0%B0%D0%B1%D0%B8%D0%BD%D0%B5%D1%82%20%D0%BC%D0%B5%D0%BD%D0%B5%D0%B4%D0%B6%D0%B5%D1%80%D0%B0.md). Обязательны [общие инварианты и поздние решения владельца](COMMON.md).

### MGR-08: Уведомления ученику (NotificationService)

**Приоритет:** P0 · **Сложность:** M · **Архитектурные ссылки:** INV-01, INV-04, INV-09, INV-10, INV-11, INV-12, INV-14; зависит от MGR-01; используется MGR-03/04/05/06/07.

#### Контекст и бизнес-правила

1. Два пути отправки: **системный** (события других задач MGR) и **ручной** (менеджер пишет ученику из карточки). Оба идут по цепочке «транзакция → Outbox → worker → `NotificationService`» (INV-11); прямой вызов провайдера из HTTP-запроса запрещён.
2. Для остальных задач MGR вводится единая точка постановки в очередь — `NotificationOutboxPublisher.enqueue(tx, event)`. Она пишет в Outbox внутри переданной транзакции и возвращает `Result`. Ключ дедупликации `dedupeKey` уникален: повторная обработка того же события не создаёт второе уведомление.
3. Каналы: `IN_APP` (в кабинете ученика) и `EMAIL`. Другие каналы вне объёма. `IN_APP` требует аккаунта; `EMAIL` — адреса в контактах; иначе 422 `NO_DELIVERY_CHANNEL`.
4. Шаблоны хранятся в реестре с кодом, переменными и локалью ученика (по умолчанию `ru`). Недостающие или лишние переменные → 422 `TEMPLATE_VARIABLES_INVALID`.
5. Ручное сообщение — только простой текст до 2000 символов, HTML экранируется. Ссылки допускаются только на домены из белого списка конфигурации (домен школы, `meet.google.com`), иначе 422 `LINK_NOT_ALLOWED`. Лимит ручных сообщений — `MANUAL_NOTIFICATIONS_PER_HOUR` (по умолчанию 10 на пару менеджер–ученик), иначе 429 `NOTIFICATION_RATE_LIMITED`.
6. Ответ на ручную отправку — `202 Accepted` со статусом `QUEUED`; реальный статус доставки (`SENT`, `FAILED`) обновляет worker.
7. В уведомлениях никогда не передаются временные пароли и иные секреты (INV-12); шаблон `ACCOUNT_CREATED` содержит только логин.

Соответствие событий и шаблонов:

| Событие Outbox | Шаблон | Источник |
| --- | --- | --- |
| `STUDENT_ACCOUNT_CREATED` | `ACCOUNT_CREATED` | MGR-03 |
| `PAYMENT_CONFIRMED` | `PAYMENT_CONFIRMED` | MGR-05 |
| `SUBSCRIPTION_RENEWED` | `SUBSCRIPTION_RENEWED` | MGR-04, СЦ-М-02 |
| `SUBSCRIPTION_FROZEN` / `_UNFROZEN` | `SUBSCRIPTION_FROZEN` / `_UNFROZEN` | MGR-04, СЦ-М-05 |
| `SUBSCRIPTION_EXPIRED` | `SUBSCRIPTION_EXPIRED` | worker, MGR-04 |
| `LESSON_CREATED` / `_RESCHEDULED` / `_CANCELLED` | `LESSON_SCHEDULED` / `LESSON_RESCHEDULED` / `LESSON_CANCELLED` | MGR-06 |
| `TASK_RESCHEDULE_DECLINED` | `RESCHEDULE_DECLINED` | MGR-07, СЦ-М-03 |
| `TASK_DISPUTE_ACCEPTED` / `_REJECTED` | `DISPUTE_ACCEPTED` / `DISPUTE_REJECTED` | MGR-07, СЦ-М-04 |

Перенос, одобренный в СЦ-М-03, уведомляется шаблоном `LESSON_RESCHEDULED`.

#### Контракты

```ts
export enum NotificationChannel { IN_APP = 'IN_APP', EMAIL = 'EMAIL' }
export enum NotificationStatus { QUEUED = 'QUEUED', SENT = 'SENT', FAILED = 'FAILED' }
export type NotificationTemplateCode =
  | 'ACCOUNT_CREATED' | 'PAYMENT_CONFIRMED' | 'SUBSCRIPTION_RENEWED' | 'SUBSCRIPTION_FROZEN'
  | 'SUBSCRIPTION_UNFROZEN' | 'SUBSCRIPTION_EXPIRED' | 'LESSON_SCHEDULED' | 'LESSON_RESCHEDULED'
  | 'LESSON_CANCELLED' | 'RESCHEDULE_DECLINED' | 'DISPUTE_ACCEPTED' | 'DISPUTE_REJECTED' | 'MANUAL_MESSAGE';

export class SendNotificationDto {
  @IsEnum(NotificationChannel) channel!: NotificationChannel;
  @IsOptional() @IsString() @MaxLength(150) subject?: string;      // только для EMAIL
  @IsString() @MinLength(1) @MaxLength(2000) body!: string;
}

export class NotificationDto {
  notificationId!: string; studentId!: string; channel!: NotificationChannel;
  templateCode!: NotificationTemplateCode; status!: NotificationStatus;
  createdAt!: string; sentAt!: string | null; failureReason!: string | null;   // причина без технических деталей
}

export class ListNotificationsQueryDto {
  @IsOptional() @IsEnum(NotificationStatus) status?: NotificationStatus;
  @IsOptional() @IsString() @MaxLength(200) cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit: number = 25;
}

export interface SystemNotificationEvent {
  studentId: string;
  templateCode: Exclude<NotificationTemplateCode, 'MANUAL_MESSAGE'>;
  variables: Record<string, string>;      // только строки, без секретов
  dedupeKey: string;                      // например, subscription:<id>:renewed:<operationId>
}

export interface NotificationOutboxPublisher {
  enqueue(tx: TransactionContext, event: SystemNotificationEvent): Promise<Result<void, DomainError>>;
}

export interface ManagerNotificationsService {
  send(ctx: ManagerContext, studentId: string, dto: SendNotificationDto, key: string): Promise<Result<NotificationDto, DomainError>>;
  list(ctx: ManagerContext, studentId: string, q: ListNotificationsQueryDto): Promise<Result<Page<NotificationDto>, DomainError>>;
}

export type NotificationErrorCode =
  | 'NO_DELIVERY_CHANNEL' | 'LINK_NOT_ALLOWED' | 'TEMPLATE_VARIABLES_INVALID' | 'NOTIFICATION_RATE_LIMITED';
```

| Метод | Путь | Успех |
| --- | --- | --- |
| POST | `/api/v1/manager/students/:studentId/notifications` (+`Idempotency-Key`) | 202 `NotificationDto` |
| GET | `/api/v1/manager/students/:studentId/notifications` | 200 `Page<NotificationDto>` |

Prisma (если в Notification-модуле нет аналога): `StudentNotification { id, studentId, managerId?, channel, templateCode, status, dedupeKey @unique, failureReason?, createdAt, sentAt? }` с индексом `@@index([studentId, createdAt])`.

#### Безопасность и обработка исключений

- Ученик разрешается через `assertStudentInPortfolio`; чужой → 404.
- Audit `NOTIFICATION_QUEUED`: код шаблона, канал, длина текста; **сам текст в Audit не пишется**.
- Worker обрабатывает события идемпотентно; повторы и ретраи берёт на себя существующий Outbox-механизм, дубликатов у ученика нет.
- Сбой провайдера не влияет на бизнес-операцию, которая породила событие: она уже зафиксирована.
- Email и телефон в логах маскируются.

#### Критерии готовности

- [ ] `NotificationOutboxPublisher` реализован и используется в MGR-03/04/05/06/07 вместо прямых вызовов; в `modules/manager` нет прямых вызовов провайдера
- [ ] Ручная отправка возвращает 202, сообщение появляется в списке со статусом QUEUED, затем SENT после работы worker
- [ ] Нет аккаунта и нет email → 422 `NO_DELIVERY_CHANNEL`
- [ ] Ссылка вне белого списка → 422 `LINK_NOT_ALLOWED`; HTML в тексте экранируется
- [ ] Лимит ручных сообщений → 429 `NOTIFICATION_RATE_LIMITED`
- [ ] Повторная обработка события с тем же `dedupeKey` не создаёт второе уведомление
- [ ] Отказ Outbox откатывает порождающую операцию (INV-10); сбой провайдера её не откатывает
- [ ] Тест на отсутствие пароля и иных секретов в шаблонах, Audit и Outbox
- [ ] Шаблоны покрыты тестом переменных (все коды, `ru` и запасная локаль)
- [ ] Чужой ученик → 404; STUDENT/TEACHER/ADMIN → 403; без CSRF → 403
- [ ] OpenAPI и клиент перегенерированы

---


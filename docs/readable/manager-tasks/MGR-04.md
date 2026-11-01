> Исходный текст из [пакета Модуль 2](https://raw.githubusercontent.com/EsinencuP/OnlineSchool/main/docs/AI%20Coder%20Tasks%20%E2%80%94%20%D0%9C%D0%BE%D0%B4%D1%83%D0%BB%D1%8C%202%20%D0%9A%D0%B0%D0%B1%D0%B8%D0%BD%D0%B5%D1%82%20%D0%BC%D0%B5%D0%BD%D0%B5%D0%B4%D0%B6%D0%B5%D1%80%D0%B0.md). Обязательны [общие инварианты и поздние решения владельца](COMMON.md).

### MGR-04: Управление абонементами (СЦ-М-02, СЦ-М-05)

**Приоритет:** P0 · **Сложность:** XL · **Архитектурные ссылки:** INV-01, INV-03, INV-04, INV-05, INV-09, INV-10, INV-11, INV-15; зависит от MGR-05, MGR-08; использует `ManagerFinanceFacade` из MGR-05.

#### Контекст и бизнес-правила

1. Операции: создание, продление, заморозка, разморозка. Статусы и допустимые переходы:

| Из \\ В | ACTIVE | FROZEN | EXPIRED | CANCELLED |
| --- | --- | --- | --- | --- |
| (новый) | создание по оплате | — | — | — |
| ACTIVE | продление | заморозка | по сроку (worker) | вне объёма менеджера |
| FROZEN | разморозка | — | — | — |
| EXPIRED | продление (новый период) | — | — | — |

Любой другой переход → 409 `INVALID_STATE_TRANSITION`.

2. **Создание и продление требуют `paymentId`** подтверждённой оплаты (MGR-05, статус `CONFIRMED`) из портфолио того же ученика. Один платёж можно использовать ровно один раз: UNIQUE на `paymentId` в таблице операций абонемента (409 `PAYMENT_ALREADY_USED`).
3. Изменение баланса (занятия и деньги) выполняется **только** публикацией через `ManagerFinanceFacade` → `LedgerPublicationService` (INV-03). Модель абонемента хранит статус и сроки; остаток занятий берётся из существующей модели оплаченных прав — сверить на шаге 0.
4. Продление: новый `endsAt = max(now, текущий endsAt) + срок тарифа`; к остатку добавляются занятия тарифа. Не более одного активного абонемента на ученика (`ACTIVE_SUBSCRIPTION_EXISTS`).
5. Заморозка: даты `startsOn`/`endsOn` (локальные даты школы), причина из справочника. Срок абонемента на время заморозки не идёт; при разморозке `endsAt` сдвигается на **фактическое** число дней заморозки. Лимиты — конфигурация `SUBSCRIPTION_MAX_FREEZE_DAYS` (по умолчанию 30) и `SUBSCRIPTION_MAX_FREEZE_TOTAL_DAYS` (по умолчанию 60). **Значения по умолчанию — предположение, их нужно подтвердить у владельца продукта.**
6. Если в период заморозки есть запланированные уроки, заморозка возвращает 409 `FREEZE_HAS_LESSONS` со списком `lessonIds`. При `cancelConflictingLessons = true` уроки отменяются без списания через порт `LessonCancellationPort` (в MGR-04 — интерфейс и заглушка, реализация подключается в MGR-06).
7. Worker переводит просроченные ACTIVE в EXPIRED идемпотентно (повторный запуск ничего не меняет) и ставит в Outbox событие «абонемент истёк». Дубли внутренних CRM-задач, которые worker уже создаёт при истечении допуска, не создаются.
8. Каждая операция ставит в Outbox уведомление ученику (MGR-08): продление — СЦ-М-02, заморозка и разморозка — СЦ-М-05.

#### Контракты

```ts
export enum SubscriptionStatus { ACTIVE = 'ACTIVE', FROZEN = 'FROZEN', EXPIRED = 'EXPIRED', CANCELLED = 'CANCELLED' }
export enum FreezeReason { ILLNESS = 'ILLNESS', TRAVEL = 'TRAVEL', FAMILY = 'FAMILY', OTHER = 'OTHER' }

export class CreateSubscriptionDto {
  @IsUUID() planId!: string;
  @IsUUID() paymentId!: string;
  @IsOptional() @IsISO8601() startsAt?: string;
}
export class RenewSubscriptionDto {
  @IsUUID() paymentId!: string;
  @IsOptional() @IsUUID() planId?: string;   // по умолчанию — текущий тариф
}
export class FreezeSubscriptionDto {
  @IsDateString({ strict: true }) startsOn!: string;   // YYYY-MM-DD
  @IsDateString({ strict: true }) endsOn!: string;
  @IsEnum(FreezeReason) reason!: FreezeReason;
  @IsOptional() @IsString() @MaxLength(500) comment?: string;
  @IsOptional() @IsBoolean() cancelConflictingLessons?: boolean;
}

export class SubscriptionDto {
  id!: string; studentId!: string; planId!: string; status!: SubscriptionStatus;
  startsAt!: string; endsAt!: string; frozenUntil!: string | null;
  totalLessons!: number; remainingLessons!: number; freezeDaysUsed!: number;
  price!: string;                                   // Decimal как строка
}

export interface ManagerSubscriptionsService {
  list(ctx: ManagerContext, studentId: string): Promise<Result<SubscriptionDto[], DomainError>>;
  create(ctx: ManagerContext, studentId: string, dto: CreateSubscriptionDto, key: string): Promise<Result<SubscriptionDto, DomainError>>;
  renew(ctx: ManagerContext, id: string, dto: RenewSubscriptionDto, key: string): Promise<Result<SubscriptionDto, DomainError>>;
  freeze(ctx: ManagerContext, id: string, dto: FreezeSubscriptionDto, key: string): Promise<Result<SubscriptionDto, DomainError>>;
  unfreeze(ctx: ManagerContext, id: string, key: string): Promise<Result<SubscriptionDto, DomainError>>;
}

export interface LessonCancellationPort {
  cancelWithoutCharge(ctx: ManagerContext, lessonIds: string[], reason: string): Promise<Result<void, DomainError>>;
}

export type SubscriptionErrorCode =
  | 'SUBSCRIPTION_NOT_FOUND' | 'PLAN_NOT_FOUND' | 'PAYMENT_NOT_CONFIRMED' | 'PAYMENT_ALREADY_USED'
  | 'INVALID_STATE_TRANSITION' | 'ACTIVE_SUBSCRIPTION_EXISTS' | 'FREEZE_LIMIT_EXCEEDED' | 'FREEZE_HAS_LESSONS';
```

| Метод | Путь | Успех |
| --- | --- | --- |
| GET | `/api/v1/manager/students/:studentId/subscriptions` | 200 `SubscriptionDto[]` |
| POST | `/api/v1/manager/students/:studentId/subscriptions` | 201 `SubscriptionDto` |
| POST | `/api/v1/manager/subscriptions/:id/renew` | 200 `SubscriptionDto` |
| POST | `/api/v1/manager/subscriptions/:id/freeze` | 200 `SubscriptionDto` |
| POST | `/api/v1/manager/subscriptions/:id/unfreeze` | 200 `SubscriptionDto` |

Все мутации требуют CSRF и `Idempotency-Key`. Для путей с `:id` абонемент разрешается в `studentId`, затем `assertStudentInPortfolio`; чужой → 404 `SUBSCRIPTION_NOT_FOUND`.

Prisma (уточнить на шаге 0): `SubscriptionOperation { id, subscriptionId, type (CREATE | RENEW | FREEZE | UNFREEZE), paymentId? @unique, ledgerPublicationId?, payload Json, createdByManagerId, createdAt }`; `SubscriptionFreeze { id, subscriptionId, startsOn, endsOn, actualEndsOn?, reason, comment? }`.

#### Безопасность и обработка исключений

- Каждая операция: `SELECT ... FOR UPDATE` по абонементу, SERIALIZABLE, retry ≤ 3, Audit (`SUBSCRIPTION_CREATED`, `_RENEWED`, `_FROZEN`, `_UNFROZEN`) и Outbox в той же транзакции.
- Ошибка публикации в Ledger откатывает всю операцию; частичных состояний нет.
- Тело запроса не содержит сумм: цена и занятия берутся из тарифа и платежа на сервере.
- Расчёты дат — в таймзоне школы, хранение в UTC; граница полуночи покрыта тестами.

#### Критерии готовности

- [ ] Приёмочный тест СЦ-М-02: подтверждённая оплата → продление → остаток и срок обновлены → событие уведомления в Outbox → ученик видит новый баланс
- [ ] Приёмочный тест СЦ-М-05: заморозка → статус FROZEN, уведомление; разморозка → `endsAt` сдвинут на фактические дни, уведомление
- [ ] Повторное использование `paymentId` → 409 `PAYMENT_ALREADY_USED`; неподтверждённый платёж → 409 `PAYMENT_NOT_CONFIRMED`; платёж другого ученика → 404
- [ ] Матрица переходов покрыта unit-тестами, недопустимые → 409
- [ ] Лимиты заморозки проверяются, значения берутся из конфигурации
- [ ] `FREEZE_HAS_LESSONS` возвращает `lessonIds`; при `cancelConflictingLessons` вызывается порт
- [ ] Гонка двух продлений одним платежом: один успех
- [ ] Откат при отказе Ledger, Audit и Outbox
- [ ] Worker истечения идемпотентен (двойной прогон без изменений)
- [ ] Нет прямой записи в `LedgerEntry` и в модели учебных данных (INV-02, INV-03)
- [ ] Деньги — строки, `Decimal` в БД
- [ ] OpenAPI и клиент перегенерированы

---


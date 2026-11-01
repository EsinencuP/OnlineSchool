> Исходный текст из [пакета Модуль 2](https://raw.githubusercontent.com/EsinencuP/OnlineSchool/main/docs/AI%20Coder%20Tasks%20%E2%80%94%20%D0%9C%D0%BE%D0%B4%D1%83%D0%BB%D1%8C%202%20%D0%9A%D0%B0%D0%B1%D0%B8%D0%BD%D0%B5%D1%82%20%D0%BC%D0%B5%D0%BD%D0%B5%D0%B4%D0%B6%D0%B5%D1%80%D0%B0.md). Обязательны [общие инварианты и поздние решения владельца](COMMON.md).

### MGR-05: Подтверждение оплат (PaymentRecord → LedgerPublicationService)

**Приоритет:** P0 · **Сложность:** XL · **Архитектурные ссылки:** INV-01, INV-03, INV-04, INV-05, INV-09, INV-10; зависит от MGR-01, MGR-02; модуль Finance (README: поступления, распределение, подтверждение директора).

#### Контекст и бизнес-правила

1. Менеджер регистрирует оплату ученика из портфолио (`PaymentRecord`, статус `PENDING`) и затем подтверждает её. Подтверждение публикует сбалансированную проводку через `LedgerPublicationService`.
2. **Единственная точка финансовой записи менеджера — `ManagerFinanceFacade`** (`modules/manager/finance/`). Остальные задачи (MGR-03/04/07) вызывают только её. Методы: `publishPayment`, `publishAdjustment` (для MGR-07), `publishDeduction` (если понадобится). Фасад не пишет в `LedgerEntry` сам.
3. Правила допуска берутся из существующего Finance-модуля и решений CON-01–11: неполная оплата, рассрочка и случаи, требующие подтверждения руководителя или директора, переводят платёж в `AWAITING_APPROVAL`. Менеджер не публикует такой платёж; решение принимает роль, определённая Finance, и публикация происходит там. Пороги и перечень случаев в этой задаче **не изобретаются** — берутся из Finance-политики.
4. Штатная политика публикации Ledger по README запрещающая до реализации ACL. Задача добавляет в `core/policy` правило «роль MANAGER может публиковать оплату только по ученику своего портфолио» и тесты на него.
5. Подтверждённая оплата неизменяема (409 `PAYMENT_IMMUTABLE`). Исправление ошибок — корректировкой через Finance, не удалением и не правкой.
6. Защита от дублей: UNIQUE по паре (`method`, `externalRef`) при заданном `externalRef`; повторная регистрация → 409 `PAYMENT_DUPLICATE`.
7. Платёж содержит назначение (`purpose`): `FIRST_PAYMENT`, `RENEWAL`, `OTHER`; использование платежа в MGR-03/04 помечает его потреблённым (одна операция на платёж).

#### Контракты

```ts
export enum PaymentMethod { CASH = 'CASH', CARD = 'CARD', BANK_TRANSFER = 'BANK_TRANSFER', ONLINE = 'ONLINE' }
export enum PaymentPurpose { FIRST_PAYMENT = 'FIRST_PAYMENT', RENEWAL = 'RENEWAL', OTHER = 'OTHER' }
export enum PaymentStatus { PENDING = 'PENDING', AWAITING_APPROVAL = 'AWAITING_APPROVAL', CONFIRMED = 'CONFIRMED', REJECTED = 'REJECTED' }

// validators/is-money-string.ts: положительная десятичная строка, до 12 цифр целой части, до 4 после точки
export const MONEY_REGEX = /^(0|[1-9][0-9]{0,11})(\.[0-9]{1,4})?$/;
export const IsMoneyString = (): PropertyDecorator => Matches(MONEY_REGEX, { message: 'INVALID_MONEY' });

export class CreatePaymentDto {
  @IsMoneyString() amount!: string;
  @IsIn(SUPPORTED_CURRENCIES) currency!: Currency;       // значения из Finance, по умолчанию MDL
  @IsEnum(PaymentMethod) method!: PaymentMethod;
  @IsEnum(PaymentPurpose) purpose!: PaymentPurpose;
  @IsISO8601() receivedAt!: string;
  @IsOptional() @IsString() @MaxLength(100) externalRef?: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}
export class RejectPaymentDto { @IsString() @MinLength(3) @MaxLength(500) reason!: string; }

export class PaymentDto {
  id!: string; studentId!: string; amount!: string; currency!: Currency;
  method!: PaymentMethod; purpose!: PaymentPurpose; status!: PaymentStatus;
  receivedAt!: string; externalRef!: string | null; consumed!: boolean;
  ledgerPublicationId!: string | null; createdAt!: string;
}

export interface ManagerFinanceFacade {
  publishPayment(ctx: ManagerContext, payment: PaymentRecordView, tx: TransactionContext):
    Promise<Result<{ ledgerPublicationId: string }, DomainError>>;
  publishAdjustment(ctx: ManagerContext, cmd: ManagerAdjustmentCommand, tx: TransactionContext):
    Promise<Result<{ ledgerPublicationId: string }, DomainError>>;
}

export interface ManagerPaymentsService {
  create(ctx: ManagerContext, studentId: string, dto: CreatePaymentDto, key: string): Promise<Result<PaymentDto, DomainError>>;
  confirm(ctx: ManagerContext, paymentId: string, key: string): Promise<Result<PaymentDto, DomainError>>;
  reject(ctx: ManagerContext, paymentId: string, dto: RejectPaymentDto): Promise<Result<PaymentDto, DomainError>>;
  list(ctx: ManagerContext, studentId: string, q: ListPaymentsQueryDto): Promise<Result<Page<PaymentDto>, DomainError>>;
  get(ctx: ManagerContext, paymentId: string): Promise<Result<PaymentDto, DomainError>>;
}

export type PaymentErrorCode =
  | 'PAYMENT_NOT_FOUND' | 'PAYMENT_DUPLICATE' | 'PAYMENT_IMMUTABLE' | 'PAYMENT_NOT_PENDING'
  | 'CURRENCY_NOT_SUPPORTED' | 'LEDGER_PUBLICATION_FAILED' | 'APPROVAL_REQUIRED';
```

| Метод | Путь | Успех |
| --- | --- | --- |
| POST | `/api/v1/manager/students/:studentId/payments` | 201 `PaymentDto` (PENDING) |
| GET | `/api/v1/manager/students/:studentId/payments` | 200 `Page<PaymentDto>` |
| GET | `/api/v1/manager/payments/:paymentId` | 200 `PaymentDto` |
| POST | `/api/v1/manager/payments/:paymentId/confirm` | 200 `PaymentDto` (CONFIRMED или AWAITING\_APPROVAL) |
| POST | `/api/v1/manager/payments/:paymentId/reject` | 200 `PaymentDto` (REJECTED) |

Prisma (уточнить имена на шаге 0): `PaymentRecord { id, studentId, managerId, amount Decimal(20,4), currency, method, purpose, status, receivedAt, externalRef?, note?, consumedAt?, ledgerPublicationId?, idempotencyKey, createdAt }` с `@@unique([method, externalRef])` и индексом `@@index([studentId, createdAt])`.

#### Алгоритм подтверждения (SERIALIZABLE, retry ≤ 3)

1. `SELECT ... FOR UPDATE` платежа, проверка портфолио, статус `PENDING`.
2. Вычисление допуска по Finance-политике: нужен ли `AWAITING_APPROVAL`. Если да — смена статуса, Audit `PAYMENT_SENT_FOR_APPROVAL`, конец.
3. `ManagerFinanceFacade.publishPayment` → `LedgerPublicationService` (дебет/кредит сбалансированы по каждой валюте проверяет сам Ledger).
4. Статус `CONFIRMED`, `ledgerPublicationId`, Audit `PAYMENT_CONFIRMED`, Outbox `PAYMENT_CONFIRMED`.
5. Любая ошибка на шагах 3–4 откатывает транзакцию; наружу — маппинг в `LEDGER_PUBLICATION_FAILED` без внутренних деталей.

#### Безопасность и обработка исключений

- Сумма и валюта задаются только при создании; при подтверждении тело запроса пустое.
- Идемпотентность: повтор `confirm` с тем же ключом возвращает тот же результат, без второй публикации.
- Reject возможен только из `PENDING`; Audit `PAYMENT_REJECTED` с причиной.
- Чужой платёж → 404 `PAYMENT_NOT_FOUND`.

#### Критерии готовности

- [ ] Денежные тесты: `0.1 + 0.2`, 4 знака после точки, 12 цифр целой части, отрицательные, ноль, пустые и экспоненциальные записи отклоняются; в путях платежей нет `number`/`parseFloat`
- [ ] Подтверждение публикует ровно одну проводку; двойной клик и гонка двух `confirm` → одна публикация
- [ ] Неполная оплата и рассрочка → `AWAITING_APPROVAL`, менеджер не может опубликовать такой платёж
- [ ] Правило ACL в `core/policy`: MANAGER публикует только по своему портфолио, чужой ученик → 404; прочие роли → 403
- [ ] Подтверждённый платёж нельзя изменить или отклонить → 409 `PAYMENT_IMMUTABLE`
- [ ] Дубликат (`method`, `externalRef`) → 409 `PAYMENT_DUPLICATE`
- [ ] Откат при отказе Ledger, Audit, Outbox; БД без висящих PENDING→CONFIRMED состояний
- [ ] `ManagerFinanceFacade` — единственный вызов `LedgerPublicationService` из `modules/manager` (архитектурный тест)
- [ ] Audit на создание, подтверждение, отправку на одобрение, отклонение
- [ ] OpenAPI и клиент перегенерированы

---


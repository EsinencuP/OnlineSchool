> Исходный текст из [пакета Модуль 2](https://raw.githubusercontent.com/EsinencuP/OnlineSchool/main/docs/AI%20Coder%20Tasks%20%E2%80%94%20%D0%9C%D0%BE%D0%B4%D1%83%D0%BB%D1%8C%202%20%D0%9A%D0%B0%D0%B1%D0%B8%D0%BD%D0%B5%D1%82%20%D0%BC%D0%B5%D0%BD%D0%B5%D0%B4%D0%B6%D0%B5%D1%80%D0%B0.md). Обязательны [общие инварианты и поздние решения владельца](COMMON.md).

### MGR-07: CrmTask-воркфлоу (СЦ-М-03, СЦ-М-04)

**Приоритет:** P0 · **Сложность:** L · **Архитектурные ссылки:** INV-01, INV-02, INV-03, INV-04, INV-05, INV-09, INV-10, INV-11; зависит от MGR-04, MGR-06, MGR-08.

#### Контекст и бизнес-правила

1. Очередь менеджера — CrmTask учеников портфолио и только разрешённых типов: `RESCHEDULE_REQUEST`, `CHARGE_DISPUTE`, `SUBSCRIPTION_EXPIRING`, `GENERAL`. Задачи прочих типов (например, учебные) не показываются, а прямой доступ → 404 `TASK_NOT_FOUND` (INV-01, INV-02).
2. Статусы: `OPEN` → `IN_PROGRESS` → `RESOLVED` или `REJECTED`. Просрочена та задача, у которой `dueAt < now` и статус `OPEN` или `IN_PROGRESS`. Для внутренних задач срок — 24 часа, как в README.
3. Взять в работу (`claim`): `OPEN` → `IN_PROGRESS`, защита от гонки через `version` (409 `TASK_VERSION_CONFLICT`).
4. **Запрос на перенос (СЦ-М-03).** Решение `APPROVE` с новым временем вызывает `ManagerScheduleService.reschedule` с общей транзакцией, закрывает задачу и ставит уведомление ученику. Решение `DECLINE` требует причину и тоже уведомляет ученика. Перенос урока и закрытие задачи атомарны.
5. **Оспаривание списания (СЦ-М-04).** Решения `ACCEPT`, `REJECT`, `ESCALATE`. При `ACCEPT` возврат (занятия и/или сумма) публикуется **только** через `ManagerFinanceFacade.publishAdjustment` → `LedgerPublicationService`; возврат не может превышать исходное списание (`DISPUTE_REFUND_EXCEEDS_CHARGE`). Если Finance-политика требует одобрения руководителя, задача получает `escalatedAt`, публикация не выполняется, менеджеру возвращается статус ожидания одобрения; решение при этом остаётся в Audit.
6. На одну задачу-оспаривание допускается не более одной корректировки: ключ идемпотентности публикации — `dispute:` + id задачи, плюс UNIQUE на `ledgerPublicationId` в задаче.
7. Любое решение ставит в Outbox уведомление ученику с итогом (СЦ-М-03, СЦ-М-04), содержимое — через MGR-08.
8. Закрытую задачу повторно решить нельзя → 409 `TASK_ALREADY_RESOLVED`.

Эндпоинты:

| Метод | Путь | Успех |
| --- | --- | --- |
| GET | `/api/v1/manager/tasks` | 200 `Page<CrmTaskDto>` |
| GET | `/api/v1/manager/tasks/:taskId` | 200 `CrmTaskDetailDto` |
| POST | `/api/v1/manager/tasks/:taskId/claim` | 200 `CrmTaskDto` |
| POST | `/api/v1/manager/tasks/:taskId/resolve-reschedule` | 200 `CrmTaskDto` |
| POST | `/api/v1/manager/tasks/:taskId/resolve-dispute` | 200 `CrmTaskDto` |

#### Контракты

```ts
export enum CrmTaskStatus { OPEN = 'OPEN', IN_PROGRESS = 'IN_PROGRESS', RESOLVED = 'RESOLVED', REJECTED = 'REJECTED' }
export enum ManagerTaskType { RESCHEDULE_REQUEST = 'RESCHEDULE_REQUEST', CHARGE_DISPUTE = 'CHARGE_DISPUTE',
  SUBSCRIPTION_EXPIRING = 'SUBSCRIPTION_EXPIRING', GENERAL = 'GENERAL' }

export type CrmTaskPayload =
  | { kind: 'RESCHEDULE_REQUEST'; lessonId: string; currentStartsAt: string; studentComment: string | null;
      preferredWindows: { from: string; to: string }[] }
  | { kind: 'CHARGE_DISPUTE'; lessonId: string; ledgerRef: string; chargedLessons: number;
      chargedAmount: string | null; studentComment: string }
  | { kind: 'SUBSCRIPTION_EXPIRING'; subscriptionId: string; endsAt: string }
  | { kind: 'GENERAL'; text: string };

export class ListTasksQueryDto {
  @IsOptional() @Transform(({ value }) => String(value).split(',')) @IsEnum(CrmTaskStatus, { each: true }) status?: CrmTaskStatus[];
  @IsOptional() @Transform(({ value }) => String(value).split(',')) @IsEnum(ManagerTaskType, { each: true }) type?: ManagerTaskType[];
  @IsOptional() @Transform(({ value }) => value === 'true') @IsBoolean() overdue?: boolean;
  @IsOptional() @IsUUID() studentId?: string;
  @IsOptional() @IsISO8601() dueBefore?: string;
  @IsOptional() @IsString() @MaxLength(200) cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit: number = 25;
}

export class CrmTaskDto {
  taskId!: string; type!: ManagerTaskType; status!: CrmTaskStatus; version!: number;
  studentId!: string; studentName!: string; createdAt!: string; dueAt!: string; isOverdue!: boolean;
  escalatedAt!: string | null; payload!: CrmTaskPayload;
}

export class ResolveRescheduleDto {
  @IsIn(['APPROVE', 'DECLINE']) decision!: 'APPROVE' | 'DECLINE';
  @ValidateIf((o) => o.decision === 'APPROVE') @IsISO8601() newStartsAt?: string;
  @IsOptional() @IsUUID() newTeacherId?: string;
  @ValidateIf((o) => o.decision === 'DECLINE') @IsString() @MinLength(3) @MaxLength(500) reason?: string;
  @IsInt() @Min(1) version!: number;
}

export class ResolveDisputeDto {
  @IsIn(['ACCEPT', 'REJECT', 'ESCALATE']) decision!: 'ACCEPT' | 'REJECT' | 'ESCALATE';
  @IsString() @MinLength(3) @MaxLength(1000) reason!: string;
  @IsOptional() @IsMoneyString() refundAmount?: string;
  @IsOptional() @IsInt() @Min(0) @Max(10) refundLessons?: number;   // для ACCEPT нужно хотя бы одно из двух полей
  @IsInt() @Min(1) version!: number;
}

export interface ManagerTasksService {
  list(ctx: ManagerContext, q: ListTasksQueryDto): Promise<Result<Page<CrmTaskDto>, DomainError>>;
  get(ctx: ManagerContext, taskId: string): Promise<Result<CrmTaskDetailDto, DomainError>>;
  claim(ctx: ManagerContext, taskId: string, version: number): Promise<Result<CrmTaskDto, DomainError>>;
  resolveReschedule(ctx: ManagerContext, taskId: string, dto: ResolveRescheduleDto, key: string): Promise<Result<CrmTaskDto, DomainError>>;
  resolveDispute(ctx: ManagerContext, taskId: string, dto: ResolveDisputeDto, key: string): Promise<Result<CrmTaskDto, DomainError>>;
}

export type TaskErrorCode =
  | 'TASK_NOT_FOUND' | 'TASK_ALREADY_RESOLVED' | 'TASK_VERSION_CONFLICT' | 'TASK_TYPE_MISMATCH'
  | 'DISPUTE_REFUND_EXCEEDS_CHARGE' | 'REFUND_REQUIRED' | 'APPROVAL_REQUIRED';
```

#### Безопасность и обработка исключений

- Тип задачи в пути решения должен совпадать с типом задачи: иначе 409 `TASK_TYPE_MISMATCH`.
- Для `ACCEPT` без `refundAmount` и `refundLessons` → 422 `REFUND_REQUIRED`; сумма — только строка (INV-05), сравнение с исходным списанием через Decimal.
- Всё решение (задача + перенос/корректировка + Audit + Outbox) — одна SERIALIZABLE-транзакция, retry ≤ 3.
- Audit: `TASK_CLAIMED`, `TASK_RESCHEDULE_APPROVED`, `TASK_RESCHEDULE_DECLINED`, `TASK_DISPUTE_ACCEPTED`, `TASK_DISPUTE_REJECTED`, `TASK_DISPUTE_ESCALATED`; в payload — ссылки на урок и публикацию Ledger, без лишних персональных данных.
- Комментарий ученика из `payload` отображается как текст, на фронтенде экранируется (защита от XSS).

#### Критерии готовности

- [ ] Приёмочный тест СЦ-М-03: задача `RESCHEDULE_REQUEST` → claim → APPROVE с новым временем → урок перенесён с тем же `lessonId` → задача `RESOLVED` → уведомление ученику в Outbox
- [ ] Приёмочный тест СЦ-М-04: задача `CHARGE_DISPUTE` → ACCEPT с возвратом → публикация в Ledger через фасад → баланс ученика обновлён → задача `RESOLVED` → уведомление; ветка REJECT — баланс без изменений
- [ ] Откат: конфликт слота при APPROVE оставляет задачу `IN_PROGRESS` и урок без изменений
- [ ] Возврат больше исходного списания → 422/409 `DISPUTE_REFUND_EXCEEDS_CHARGE`
- [ ] Повторное решение и параллельное решение двумя запросами → одно применение, второй `TASK_ALREADY_RESOLVED` или `TASK_VERSION_CONFLICT`
- [ ] Повтор с тем же `Idempotency-Key` не создаёт вторую корректировку
- [ ] Фильтры очереди (`status`, `type`, `overdue`, `studentId`, `dueBefore`) работают совместно; сортировка по `dueAt` стабильна
- [ ] Задачи чужих учеников и неразрешённых типов → 404, в списке отсутствуют
- [ ] Эскалация по политике Finance не публикует проводку и фиксируется в Audit
- [ ] Нет прямой записи в `LedgerEntry` и учебные модели (INV-02, INV-03)
- [ ] Матрица ролей INV-16, CSRF на мутациях
- [ ] OpenAPI и клиент перегенерированы

---


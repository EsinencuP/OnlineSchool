> Исходный текст из [пакета Модуль 2](https://raw.githubusercontent.com/EsinencuP/OnlineSchool/main/docs/AI%20Coder%20Tasks%20%E2%80%94%20%D0%9C%D0%BE%D0%B4%D1%83%D0%BB%D1%8C%202%20%D0%9A%D0%B0%D0%B1%D0%B8%D0%BD%D0%B5%D1%82%20%D0%BC%D0%B5%D0%BD%D0%B5%D0%B4%D0%B6%D0%B5%D1%80%D0%B0.md). Обязательны [общие инварианты и поздние решения владельца](COMMON.md).

### MGR-06: Расписание (просмотр, создание, перенос, отмена, Google Meet)

**Приоритет:** P0 · **Сложность:** XL · **Архитектурные ссылки:** INV-01, INV-02, INV-03, INV-04, INV-09, INV-10, INV-11, INV-15; зависит от MGR-02, MGR-08; модуль Schedule (README: календарные команды, устойчивые ID экземпляров, calendar EXCLUDE).

#### Контекст и бизнес-правила

1. Задача **оборачивает существующие команды Schedule**, а не дублирует календарную логику. Источник истины по пересечениям — ограничение `EXCLUDE` в БД: нарушение (код PostgreSQL `23P01`) маппится в 409 `SLOT_CONFLICT`; одной предварительной проверки недостаточно.
2. Просмотр: `GET /manager/schedule` за диапазон до 31 дня по портфолио (фильтры `studentId`, `teacherId`, `status`). Диапазон больше 31 дня → 422 `RANGE_TOO_LARGE`.
3. Создание урока: ученик из портфолио, активный (не FROZEN и не EXPIRED) абонемент с остатком занятий, преподаватель из допустимых для ученика, `startsAt` не ближе минимального времени подготовки (`LESSON_MIN_LEAD_MINUTES`, конфигурация).
4. Перенос: `lessonId` **не меняется** (устойчивый ID экземпляра). Бесплатный перенос — не позже чем за `LESSON_FREE_CHANGE_HOURS` (по умолчанию 24) до начала. Более поздний перенос требует `overrideLateRule = true` и причину (в Audit). **Значения по умолчанию и правила позднего переноса — предположение; сверить с регламентами и CON-01–11.**
5. Отмена: `chargeable = false` — без списания; `chargeable = true` — списание занятия, выполняемое **только** через `ManagerFinanceFacade.publishDeduction` → `LedgerPublicationService` в той же транзакции (INV-03). Реализация `LessonCancellationPort` из MGR-04 (`cancelWithoutCharge`) входит в эту задачу.
6. Менеджер не меняет исход проведённого урока, оценки и отчёты — это зона преподавателя (INV-02). Уроки в статусах «проведён», «исход подтверждается» и в прошлом менеджеру недоступны для изменения → 409 `LESSON_IMMUTABLE_STATE`.
7. Google Meet: менеджер привязывает, заменяет и удаляет ссылку. Допускается только `https://meet.google.com/xxx-xxxx-xxx`. Автогенерация — через порт `MeetLinkPort` (интерфейс; адаптер расширенного Meet API подключается отдельно, в этой задаче используется заглушка за feature-флагом).
8. Перенос и отмена ставят в Outbox уведомление ученику (MGR-08) и событие для потребителей Schedule (преподаватель).

Эндпоинты:

| Метод | Путь | Успех |
| --- | --- | --- |
| GET | `/api/v1/manager/schedule` | 200 `LessonDto[]` |
| POST | `/api/v1/manager/students/:studentId/lessons` | 201 `LessonDto` |
| POST | `/api/v1/manager/lessons/:lessonId/reschedule` | 200 `LessonDto` |
| POST | `/api/v1/manager/lessons/:lessonId/cancel` | 200 `LessonDto` |
| PUT | `/api/v1/manager/lessons/:lessonId/meet-link` | 200 `LessonDto` |
| DELETE | `/api/v1/manager/lessons/:lessonId/meet-link` | 200 `LessonDto` |

Все мутации — CSRF; создание, перенос и отмена — ещё и `Idempotency-Key`.

#### Контракты

```ts
export const MEET_LINK_REGEX = /^https:[/][/]meet[.]google[.]com[/][a-z]{3}-[a-z]{4}-[a-z]{3}$/;

export class ListScheduleQueryDto {
  @IsISO8601() from!: string;
  @IsISO8601() to!: string;                       // to - from <= 31 дня, проверяется в сервисе
  @IsOptional() @IsUUID() studentId?: string;
  @IsOptional() @IsUUID() teacherId?: string;
  @IsOptional() @IsEnum(LessonStatus) status?: LessonStatus;
}

export class CreateLessonDto {
  @IsUUID() teacherId!: string;
  @IsISO8601() startsAt!: string;
  @IsIn([30, 45, 60, 90]) durationMinutes!: number;
  @IsOptional() @IsUUID() subscriptionId?: string;      // по умолчанию — активный
  @IsOptional() @Matches(MEET_LINK_REGEX) meetLink?: string;
}
export class RescheduleLessonDto {
  @IsISO8601() newStartsAt!: string;
  @IsOptional() @IsUUID() newTeacherId?: string;
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
  @IsOptional() @IsBoolean() overrideLateRule?: boolean;
}
export class CancelLessonDto {
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
  @IsBoolean() chargeable!: boolean;
}
export class SetMeetLinkDto { @Matches(MEET_LINK_REGEX) url!: string; }

export class LessonDto {
  lessonId!: string; studentId!: string; teacherId!: string; teacherName!: string;
  startsAt!: string; endsAt!: string; status!: LessonStatus;
  meetLink!: string | null; subscriptionId!: string | null; chargedLessons!: number;
}

export interface ManagerScheduleService {
  list(ctx: ManagerContext, q: ListScheduleQueryDto): Promise<Result<LessonDto[], DomainError>>;
  create(ctx: ManagerContext, studentId: string, dto: CreateLessonDto, key: string, tx?: TransactionContext): Promise<Result<LessonDto, DomainError>>;
  reschedule(ctx: ManagerContext, lessonId: string, dto: RescheduleLessonDto, key: string, tx?: TransactionContext): Promise<Result<LessonDto, DomainError>>;
  cancel(ctx: ManagerContext, lessonId: string, dto: CancelLessonDto, key: string, tx?: TransactionContext): Promise<Result<LessonDto, DomainError>>;
  setMeetLink(ctx: ManagerContext, lessonId: string, dto: SetMeetLinkDto): Promise<Result<LessonDto, DomainError>>;
  clearMeetLink(ctx: ManagerContext, lessonId: string): Promise<Result<LessonDto, DomainError>>;
}

export interface MeetLinkPort { generate(lesson: LessonView): Promise<Result<string, DomainError>>; }

export type ScheduleErrorCode =
  | 'LESSON_NOT_FOUND' | 'SLOT_CONFLICT' | 'SUBSCRIPTION_NOT_ACTIVE' | 'NO_LESSONS_REMAINING'
  | 'LEAD_TIME_VIOLATION' | 'LESSON_IMMUTABLE_STATE' | 'TEACHER_NOT_AVAILABLE'
  | 'TEACHER_NOT_ASSIGNED' | 'RANGE_TOO_LARGE' | 'INVALID_MEET_LINK';
```

Параметр `tx?` позволяет MGR-07 вызывать перенос и отмену внутри собственной транзакции (атомарное решение по задаче и уроку).

#### Безопасность и обработка исключений

- Урок разрешается в `studentId` и проходит `assertStudentInPortfolio`; чужой урок → 404 `LESSON_NOT_FOUND`. Фильтр `teacherId` не раскрывает уроки чужих учеников.
- Audit: `LESSON_CREATED`, `LESSON_RESCHEDULED` (старое и новое время, причина, флаг `overrideLateRule`), `LESSON_CANCELLED` (причина, `chargeable`), `LESSON_MEET_LINK_SET`, `LESSON_MEET_LINK_CLEARED`.
- Время принимается в ISO-8601 с часовым поясом, хранится в UTC; переходы на летнее/зимнее время покрыты тестами.
- Ссылка Meet не логируется целиком (маскируется код встречи).
- Списание при отмене и изменение расписания — одна транзакция; отказ Ledger откатывает отмену.

#### Критерии готовности

- [ ] Шаг 0: перечислены существующие команды Schedule и ACL, которые переиспользуются; дублирующей календарной логики нет
- [ ] Просмотр возвращает только уроки портфолио; диапазон > 31 дня → 422
- [ ] Создание: заморожен или истёк абонемент → 409 `SUBSCRIPTION_NOT_ACTIVE`; остаток 0 → 409 `NO_LESSONS_REMAINING`; нарушение lead time → 422
- [ ] Два параллельных создания в один слот преподавателя: один успех, второй `SLOT_CONFLICT` (тест на реальном EXCLUDE)
- [ ] Перенос сохраняет `lessonId`; поздний перенос без `overrideLateRule` отклоняется, с флагом — записывается в Audit
- [ ] Отмена `chargeable = true` публикует списание через фасад; `false` — без Ledger-записи; откат при отказе Ledger
- [ ] Проведённый урок и прошлые уроки неизменяемы → 409 `LESSON_IMMUTABLE_STATE`
- [ ] Ссылка Meet: валидный формат принимается, чужие домены и `http` отклоняются → 422 `INVALID_MEET_LINK`
- [ ] `LessonCancellationPort` реализован, заморозка из MGR-04 с `cancelConflictingLessons` работает end-to-end
- [ ] Outbox-события для ученика и Schedule-потребителей создаются в той же транзакции
- [ ] Матрица ролей INV-16 на всех шести эндпоинтах; без CSRF → 403
- [ ] OpenAPI и клиент перегенерированы

---


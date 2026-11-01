> Исходный текст из [пакета Модуль 2](https://raw.githubusercontent.com/EsinencuP/OnlineSchool/main/docs/AI%20Coder%20Tasks%20%E2%80%94%20%D0%9C%D0%BE%D0%B4%D1%83%D0%BB%D1%8C%202%20%D0%9A%D0%B0%D0%B1%D0%B8%D0%BD%D0%B5%D1%82%20%D0%BC%D0%B5%D0%BD%D0%B5%D0%B4%D0%B6%D0%B5%D1%80%D0%B0.md). Обязательны [общие инварианты и поздние решения владельца](COMMON.md).

### MGR-02: CRM-список учеников и карточка ученика

**Приоритет:** P0 · **Сложность:** L · **Архитектурные ссылки:** INV-01, INV-02, INV-04, INV-05, INV-09, INV-12, INV-14; зависит от MGR-01.

#### Контекст и бизнес-правила

1. Менеджер видит список только своего портфолио (`portfolioWhere(ctx)`), любые фильтры накладываются поверх него, а не вместо.
2. Карточка ученика объединяет: профиль и контакты, активный абонемент и баланс, ближайшие 5 уроков, открытые CrmTask, последние 10 платежей и **учебный срез только для чтения**. Учебный срез содержит агрегаты: число освоенных навыков из общего числа, счётчики ДЗ «сдано / не сдано / просрочено», дату и статус последнего образовательного отчёта. Тексты оценок, комментарии преподавателя и содержимое отчётов менеджеру не отдаются (INV-02).
3. Менеджер может создать запись ученика **без аккаунта** (лид) — `managerId` ставится из контекста — и редактировать контакты и внутреннюю заметку. Учебные поля не редактируются.
4. Открытие карточки с контактами пишет Audit `STUDENT_PII_VIEWED`; список контактов не раскрывает (только маскированный телефон).
5. Поиск — по ФИО, телефону и email, минимум 2 символа, спецсимволы `%` и `_` экранируются. Сортировка стабильная: пользовательский ключ + `id`. Пагинация cursor-based, cursor — непрозрачная строка.
6. Список строится не более чем 4 запросами к БД независимо от размера страницы (без N+1).
7. Обновление контактов — оптимистичная блокировка по полю `version`.

#### Контракты

```ts
// dto/student-crm.dto.ts
export enum StudentCrmStatus {
  LEAD = 'LEAD', ACTIVE = 'ACTIVE', FROZEN = 'FROZEN', EXPIRED = 'EXPIRED', ARCHIVED = 'ARCHIVED',
}

export class ListStudentsQueryDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) search?: string;
  @IsOptional() @IsEnum(StudentCrmStatus) status?: StudentCrmStatus;
  @IsOptional() @Transform(({ value }) => value === 'true') @IsBoolean() hasOverdueTask?: boolean;
  @IsOptional() @Transform(({ value }) => value === 'true') @IsBoolean() subscriptionExpiringSoon?: boolean;
  @IsOptional() @IsIn(['name', 'nextLesson', 'subscriptionEnd']) sort?: 'name' | 'nextLesson' | 'subscriptionEnd';
  @IsOptional() @IsString() @MaxLength(200) cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit: number = 25;
}

export class Page<T> { items!: T[]; nextCursor!: string | null; }

export class StudentListItemDto {
  studentId!: string;
  fullName!: string;
  status!: StudentCrmStatus;
  hasAccount!: boolean;
  maskedPhone!: string | null;
  activeSubscription!: { id: string; endsAt: string; remainingLessons: number } | null;
  balance!: string;                 // Decimal как строка
  nextLessonAt!: string | null;     // ISO-8601 UTC
  openTasksCount!: number;
  overdueTasksCount!: number;
}

export class StudentCardDto {
  studentId!: string; version!: number;
  fullName!: string; status!: StudentCrmStatus; hasAccount!: boolean;
  contacts!: { phone: string | null; email: string | null; guardianName: string | null; guardianPhone: string | null };
  managerNote!: string | null;
  subscription!: SubscriptionSummaryDto | null;
  balance!: string;
  upcomingLessons!: LessonBriefDto[];          // до 5
  openTasks!: CrmTaskBriefDto[];
  recentPayments!: PaymentBriefDto[];          // до 10
  learning!: { skillsMastered: number; skillsTotal: number; homeworkSubmitted: number; homeworkPending: number;
               homeworkOverdue: number; lastReportAt: string | null; lastReportStatus: string | null };
}

export class CreateStudentDto {
  @IsString() @MinLength(2) @MaxLength(120) fullName!: string;
  @IsOptional() @IsString() @Matches(/^\+?[0-9 ()-]{6,20}$/) phone?: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(120) guardianName?: string;
  @IsOptional() @IsString() @MaxLength(2000) managerNote?: string;
}

export class UpdateStudentContactsDto extends PartialType(OmitType(CreateStudentDto, ['fullName'] as const)) {
  @IsInt() @Min(1) version!: number;
}

export interface ManagerStudentsService {
  list(ctx: ManagerContext, q: ListStudentsQueryDto): Promise<Result<Page<StudentListItemDto>, DomainError>>;
  getCard(ctx: ManagerContext, studentId: string): Promise<Result<StudentCardDto, DomainError>>;
  create(ctx: ManagerContext, dto: CreateStudentDto, idempotencyKey: string): Promise<Result<StudentCardDto, DomainError>>;
  updateContacts(ctx: ManagerContext, studentId: string, dto: UpdateStudentContactsDto): Promise<Result<StudentCardDto, DomainError>>;
}
```

Эндпоинты:

| Метод | Путь | Успех | Ошибки |
| --- | --- | --- | --- |
| GET | `/api/v1/manager/students` | 200 `Page<StudentListItemDto>` | 401, 403, 422 |
| GET | `/api/v1/manager/students/:studentId` | 200 `StudentCardDto` | 401, 403, 404 |
| POST | `/api/v1/manager/students` (+`Idempotency-Key`) | 201 `StudentCardDto` | 401, 403, 409, 422 |
| PATCH | `/api/v1/manager/students/:studentId/contacts` | 200 `StudentCardDto` | 401, 403, 404, 409 `VERSION_CONFLICT`, 422 |

Prisma: `Student/StudentProfile` — добавить `version Int @default(1)`, `managerNote String?`; индексы `@@index([managerId, status])` и `@@index([managerId, createdAt, id])`; для поиска — индекс `pg_trgm` по `lower(fullName)` (если расширение разрешено в окружении).

#### Безопасность и обработка исключений

- Любой `studentId` проходит `assertStudentInPortfolio`; чужой и несуществующий → 404 `STUDENT_NOT_FOUND`.
- Поля `managerId`, `status`, `hasAccount` из тела запроса игнорируются/отклоняются (`forbidNonWhitelisted`).
- Audit: `STUDENT_CREATED`, `STUDENT_CONTACTS_UPDATED` (в payload — список изменённых полей и маскированные значения), `STUDENT_PII_VIEWED`. Все записи — в транзакции мутации (INV-04).
- Заметка и контакты хранятся как PII; в логи не попадают.
- Конкурентное обновление → 409 `VERSION_CONFLICT` без частичной записи.

#### Критерии готовности

- [ ] Шаг 0: сверены имена моделей и полей (`version`, `managerNote`), миграция добавлена, `prisma validate` проходит
- [ ] Список возвращает только портфолио, фильтры `status`, `hasOverdueTask`, `subscriptionExpiringSoon`, `search` работают совместно
- [ ] Cursor-пагинация стабильна при одинаковых значениях сортировки (тест с дубликатами)
- [ ] Список строится ≤ 4 запросами (тест на счётчик запросов)
- [ ] Карточка не содержит оценок ДЗ, комментариев преподавателя и текстов отчётов (контрактный тест на отсутствие полей)
- [ ] Деньги в ответах — строки, тест на отсутствие `number`
- [ ] `STUDENT_PII_VIEWED` пишется при каждом открытии карточки
- [ ] Создание ученика идемпотентно (повтор с тем же ключом → тот же ответ, другой body → 409)
- [ ] Обновление контактов: конфликт версий → 409, успешное → версия +1, audit записан
- [ ] Чужой ученик → 404 на всех четырёх эндпоинтах; роли STUDENT/TEACHER/ADMIN → 403; мутации без CSRF → 403
- [ ] Поиск со спецсимволами `%`, `_` не ломает запрос и не возвращает лишнего
- [ ] OpenAPI и Orval-клиент перегенерированы без ручных правок

---


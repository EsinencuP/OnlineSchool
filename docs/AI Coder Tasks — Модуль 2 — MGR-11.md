MGR-11: Заявки и пробные уроки (воронка до первой оплаты)
Приоритет: P0 · Сложность: XL · Архитектурные ссылки: INV-01, INV-02, INV-04, INV-09, INV-10, INV-11, INV-12, INV-14, INV-15, INV-16; template/manager.webp (пункт «Заявки», панель «Новые заявки»), ref/ (Trial CRM: записи на пробные, карточка пробного урока; воронка лидов); зависит от MGR-02, MGR-06, MGR-07, MGR-08; взаимодействует с MGR-05 и MGR-03.
Задача добавляет в пакет начало сценария СЦ-М-01: теперь он идёт как заявка → пробный урок → оплата → аккаунт. Предлагается новый приёмочный сценарий СЦ-М-06 «Заявка → пробный → оплата → конверсия» (см. критерии).
Контекст и бизнес-правила
1. Заявка принадлежит менеджеру (managerId). Нераспределённая заявка менеджеру не видна (INV-01). Приём заявок с публичного сайта и распределение между менеджерами вне объёма и подключаются через порт LeadIntakePort (только системный вызов, возвращает Result).
2. Заявка и ученик — разные сущности. Запись ученика (MGR-02, статус LEAD, без аккаунта) создаётся при назначении пробного урока, потому что к уроку нужен ученик. Если заявка потеряна, а у связанного ученика нет платежей, он переводится в ARCHIVED.
3. Пробный урок — урок вида TRIAL (расширение MGR-06): без абонемента, без списания и без записи в Ledger. Бесплатность пробного — допущение, подтвердить. Длительность — конфигурация TRIAL_LESSON_MINUTES (по референсу 50 минут, подтвердить). Ссылка Meet привязывается как в MGR-06.
4. Исход пробного (проведён, неявка, отмена) и фидбэк пробного вносит преподаватель, не менеджер (INV-02). Менеджер видит статус исхода и статус фидбэка, а краткий текст фидбэка — только если TRIAL_FEEDBACK_VISIBLE_TO_MANAGER = true (по умолчанию true, подтвердить).
5. Бриф заявки (по референсу: аудитория, возраст, уровень, предмет) показывается в карточке пробного урока в расписании и в карточке заявки.
6. Новая заявка автоматически создаёт CrmTask LEAD_FOLLOWUP со сроком LEAD_FOLLOWUP_DUE_MINUTES (по умолчанию 120, допущение) и, если преподаватель не назначен, задачу ASSIGN_TEACHER («Назначить преподавателя» из шаблона). Обе задачи видны в MGR-07 и закрываются автоматически при взятии заявки в работу или назначении пробного.
7. Конверсия только через деньги. Когда в MGR-05 подтверждён и опубликован платёж FIRST_PAYMENT ученика этой заявки, worker переводит заявку в CONVERTED идемпотентно (ключ — id события Outbox). Ручной операции «конвертировать» нет. Дальше действует MGR-03.
8. Дубликаты. Совпадение телефона или email среди заявок и учеников своего портфолио → 409 LEAD_DUPLICATE_SUSPECTED с existingId; forceCreate = true пропускает проверку и пишется в Audit. Чужое портфолио не проверяется и не раскрывается.
9. Метрики воронки (референс-отчёт с колонками «Конверсия» и «Оплат»): summary отдаёт счётчики по стадиям, число новых и пробных за сегодня, число просроченных LEAD_FOLLOWUP и конверсию за 30 дней в базисных пунктах (целое число, денег в summary нет).
10. Уведомления контакту до появления аккаунта идут только по EMAIL на контактный адрес заявки, через MGR-08 (получатель CONTACT, см. изменения смежных задач).
Стадии и допустимые переходы:
Стадия
Название в шаблоне
Как попадает
Допустимые переходы
NEW
Новая
создание заявки
IN_PROGRESS, LOST
IN_PROGRESS
В работе
claim: контакт установлен
TRIAL, AWAITING_PAYMENT (без пробного — только с skipTrialReason), LOST
TRIAL
Пробный урок
назначен пробный урок
IN_PROGRESS (пробный отменён или неявка), AWAITING_PAYMENT (исход ATTENDED), LOST
AWAITING_PAYMENT
Ожидают оплаты
клиент решил, ждём платёж
TRIAL (повторный пробный), LOST; в CONVERTED — только автоматически по платежу
CONVERTED
—
платёж FIRST_PAYMENT подтверждён
терминальная
LOST
—
потеря с причиной
reopen → IN_PROGRESS
Переход TRIAL → AWAITING_PAYMENT без исхода ATTENDED → 409 TRIAL_OUTCOME_REQUIRED. Любой другой переход → 409 INVALID_STAGE_TRANSITION.
Контракты
export enum LeadStage { NEW = 'NEW', IN_PROGRESS = 'IN_PROGRESS', TRIAL = 'TRIAL',
  AWAITING_PAYMENT = 'AWAITING_PAYMENT', CONVERTED = 'CONVERTED', LOST = 'LOST' }
export enum LeadSource { SITE = 'SITE', PHONE = 'PHONE', MESSENGER = 'MESSENGER', REFERRAL = 'REFERRAL', OTHER = 'OTHER' }
export enum LeadAudience { CHILD = 'CHILD', ADULT = 'ADULT' }
export enum LeadLostReason { NOT_INTERESTED = 'NOT_INTERESTED', PRICE = 'PRICE', NO_CONTACT = 'NO_CONTACT',
  COMPETITOR = 'COMPETITOR', SCHEDULE_MISMATCH = 'SCHEDULE_MISMATCH', TRIAL_NO_SHOW = 'TRIAL_NO_SHOW', OTHER = 'OTHER' }

export class CreateLeadDto {
  @IsEnum(LeadAudience) audience!: LeadAudience;
  @IsString() @MinLength(2) @MaxLength(120) contactName!: string;            // имя будущего ученика
  @ValidateIf((o) => o.audience === 'CHILD') @IsString() @MinLength(2) @MaxLength(120) guardianName?: string;
  @IsOptional() @IsString() @Matches(/^\+?[0-9 ()-]{6,20}$/) phone?: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;               // хотя бы один из phone/email: кастомный валидатор AtLeastOneContact
  @IsUUID() subjectId!: string;
  @IsOptional() @IsInt() @Min(1) @Max(11) grade?: number;
  @IsOptional() @IsInt() @Min(3) @Max(99) ageYears?: number;
  @IsOptional() @IsString() @MaxLength(10) level?: string;                // например, B1
  @IsEnum(LeadSource) source!: LeadSource;
  @IsOptional() @IsString() @MaxLength(2000) comment?: string;
  @IsOptional() @IsBoolean() forceCreate?: boolean;
}
export class UpdateLeadDto extends PartialType(OmitType(CreateLeadDto, ['forceCreate'] as const)) {
  @IsInt() @Min(1) version!: number;
}

export class ListLeadsQueryDto {
  @IsOptional() @Transform(({ value }) => String(value).split(',')) @IsEnum(LeadStage, { each: true }) stage?: LeadStage[];
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) search?: string;
  @IsOptional() @IsUUID() subjectId?: string;
  @IsOptional() @IsEnum(LeadSource) source?: LeadSource;
  @IsOptional() @Transform(({ value }) => value === 'true') @IsBoolean() overdue?: boolean;
  @IsOptional() @IsString() @MaxLength(200) cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit: number = 25;
}

export class LeadListItemDto {
  leadId!: string; stage!: LeadStage; audience!: LeadAudience; contactName!: string;
  subjectName!: string; grade!: number | null; maskedPhone!: string | null; source!: LeadSource;
  createdAt!: string; stageChangedAt!: string; trialAt!: string | null;
  nextActionAt!: string | null; isOverdue!: boolean;
}
export class TrialLessonView {
  lessonId!: string; startsAt!: string; endsAt!: string; teacherName!: string; meetLink!: string | null;
  outcome!: 'PENDING' | 'ATTENDED' | 'NO_SHOW' | 'CANCELLED';              // только чтение, ставит преподаватель
  feedbackStatus!: 'PENDING' | 'SUBMITTED';
  feedbackSummary!: string | null;                                           // по флагу TRIAL_FEEDBACK_VISIBLE_TO_MANAGER
}
export class LeadDto extends LeadListItemDto {
  version!: number; guardianName!: string | null; phone!: string | null; email!: string | null;
  ageYears!: number | null; level!: string | null; comment!: string | null; studentId!: string | null;
  lostReason!: LeadLostReason | null; lostComment!: string | null;
  trial!: TrialLessonView | null; history!: { from: LeadStage | null; to: LeadStage; at: string; byManager: boolean }[];
  openTasks!: CrmTaskBriefDto[];
}
export class LeadSummaryDto {
  countsByStage!: Record<'NEW' | 'IN_PROGRESS' | 'TRIAL' | 'AWAITING_PAYMENT', number>;
  createdToday!: number; trialsToday!: number; overdueFollowups!: number;
  conversion30dBp!: number;                                                  // базисные пункты, 2500 = 25,00%
}

export class ScheduleTrialDto {
  @IsUUID() teacherId!: string; @IsISO8601() startsAt!: string; @IsInt() @Min(1) version!: number;
}
export class TransitionLeadDto {
  @IsIn(['IN_PROGRESS', 'AWAITING_PAYMENT']) to!: 'IN_PROGRESS' | 'AWAITING_PAYMENT';
  @IsOptional() @IsString() @MinLength(3) @MaxLength(500) skipTrialReason?: string;
  @IsInt() @Min(1) version!: number;
}
export class LoseLeadDto {
  @IsEnum(LeadLostReason) reason!: LeadLostReason;
  @IsOptional() @IsString() @MaxLength(500) comment?: string;
  @IsInt() @Min(1) version!: number;
}

export interface ManagerLeadsService {
  list(ctx: ManagerContext, q: ListLeadsQueryDto): Promise<Result<Page<LeadListItemDto>, DomainError>>;
  summary(ctx: ManagerContext): Promise<Result<LeadSummaryDto, DomainError>>;
  get(ctx: ManagerContext, leadId: string): Promise<Result<LeadDto, DomainError>>;
  create(ctx: ManagerContext, dto: CreateLeadDto, key: string): Promise<Result<LeadDto, DomainError>>;
  update(ctx: ManagerContext, leadId: string, dto: UpdateLeadDto): Promise<Result<LeadDto, DomainError>>;
  claim(ctx: ManagerContext, leadId: string, version: number): Promise<Result<LeadDto, DomainError>>;
  scheduleTrial(ctx: ManagerContext, leadId: string, dto: ScheduleTrialDto, key: string): Promise<Result<LeadDto, DomainError>>;
  transition(ctx: ManagerContext, leadId: string, dto: TransitionLeadDto): Promise<Result<LeadDto, DomainError>>;
  lose(ctx: ManagerContext, leadId: string, dto: LoseLeadDto): Promise<Result<LeadDto, DomainError>>;
  reopen(ctx: ManagerContext, leadId: string, version: number): Promise<Result<LeadDto, DomainError>>;
}

export interface LeadIntakePort {                                            // только системный вызов, например, публичный сайт
  intake(managerId: string, dto: CreateLeadDto, source: LeadSource): Promise<Result<{ leadId: string }, DomainError>>;
}

export type LeadErrorCode =
  | 'LEAD_NOT_FOUND' | 'LEAD_DUPLICATE_SUSPECTED' | 'LEAD_VERSION_CONFLICT' | 'INVALID_STAGE_TRANSITION'
  | 'TRIAL_ALREADY_SCHEDULED' | 'TRIAL_OUTCOME_REQUIRED' | 'LEAD_TERMINAL' | 'SUBJECT_NOT_FOUND' | 'CONTACT_REQUIRED';
Эндпоинты:
Метод
Путь
Успех
GET
/api/v1/manager/leads
200 Page<LeadListItemDto>
GET
/api/v1/manager/leads/summary
200 LeadSummaryDto
GET
/api/v1/manager/leads/:leadId
200 LeadDto
POST
/api/v1/manager/leads (+Idempotency-Key)
201 LeadDto
PATCH
/api/v1/manager/leads/:leadId
200 LeadDto
POST
/api/v1/manager/leads/:leadId/claim
200 LeadDto
POST
/api/v1/manager/leads/:leadId/trial (+Idempotency-Key)
200 LeadDto
POST
/api/v1/manager/leads/:leadId/transition
200 LeadDto
POST
/api/v1/manager/leads/:leadId/lose
200 LeadDto
POST
/api/v1/manager/leads/:leadId/reopen
200 LeadDto
Перенос и отмену пробного урока менеджер выполняет через эндпоинты MGR-06 по lessonId; стадия заявки обновляется обработчиком событий.
model Lead {
  id             String          @id @default(uuid()) @db.Uuid
  managerId      String          @db.Uuid
  studentId      String?         @unique @db.Uuid
  stage          LeadStage       @default(NEW)
  audience       LeadAudience
  contactName    String
  guardianName   String?
  phone          String?
  email          String?
  subjectId      String          @db.Uuid
  grade          Int?
  ageYears       Int?
  level          String?
  source         LeadSource
  comment        String?
  lostReason     LeadLostReason?
  lostComment    String?
  trialLessonId  String?         @unique @db.Uuid
  version        Int             @default(1)
  idempotencyKey String?
  createdAt      DateTime        @default(now())
  stageChangedAt DateTime        @default(now())
  convertedAt    DateTime?
  events         LeadStageEvent[]

  @@unique([managerId, idempotencyKey])
  @@index([managerId, stage, createdAt, id])
  @@index([managerId, phone])
  @@index([managerId, email])
}

model LeadStageEvent {
  id        String     @id @default(uuid()) @db.Uuid
  leadId    String     @db.Uuid
  fromStage LeadStage?
  toStage   LeadStage
  actor     String     // MANAGER | SYSTEM
  reason    String?
  createdAt DateTime   @default(now())
  lead      Lead       @relation(fields: [leadId], references: [id])
  @@index([leadId, createdAt])
}
В SQL-миграции: CHECK (phone IS NOT NULL OR email IS NOT NULL); имена enum и моделей сверить со схемой на шаге 0 (INV и MGR-01).
Алгоритм назначения пробного урока (SERIALIZABLE, retry ≤ 3)
1. SELECT ... FOR UPDATE заявки, проверка портфолио и version; допустимая стадия — IN_PROGRESS или AWAITING_PAYMENT; уже назначенный и не отменённый пробный → 409 TRIAL_ALREADY_SCHEDULED.
2. Если studentId пуст — создать запись ученика (ManagerStudentsService.create, статус LEAD, без аккаунта) из данных заявки и связать с ней.
3. Создать урок вида TRIAL через ManagerScheduleService.create в той же транзакции; конфликт слота → 409 SLOT_CONFLICT и откат всего.
4. Перевести заявку в TRIAL, записать trialLessonId, событие стадии, закрыть задачу ASSIGN_TEACHER.
5. Audit TRIAL_SCHEDULED; Outbox: уведомление контакту по email (если задан) и событие для Schedule.
Обработчики событий (worker, идемпотентные по id события): отмена или неявка пробного → TRIAL → IN_PROGRESS и новая задача LEAD_FOLLOWUP; подтверждённый платёж FIRST_PAYMENT ученика заявки → CONVERTED, convertedAt, Audit LEAD_CONVERTED с actor = SYSTEM.
Изменения смежных задач (обязательны для MGR-11)
• MGR-06: kind: 'REGULAR' | 'TRIAL' в CreateLessonDto и LessonDto. Для TRIAL нет проверок абонемента и остатка, списания и записи в Ledger; отмена пробного всегда без списания; в расписании метка «Пробный» и фильтр по kind.
• MGR-07: новые типы LEAD_FOLLOWUP и ASSIGN_TEACHER с payload { kind; leadId }, автозакрытие по событиям заявки.
• MGR-08: получатель CONTACT (email заявки, до появления аккаунта) и шаблон TRIAL_SCHEDULED; IN_APP для заявки недоступен.
• MGR-02: в карточке ученика ссылка на заявку (leadId); LEAD → ARCHIVED при потере заявки без платежей.
• MGR-05: событие PAYMENT_CONFIRMED содержит studentId и purpose.
• MGR-09 и MGR-01: счётчики воронки берутся из LeadSummaryDto; в ManagerCapability добавляется LEADS_MANAGE.
Безопасность и обработка исключений
• Чужая и нераспределённая заявка → 404 LEAD_NOT_FOUND (INV-01); managerId берётся только из контекста.
• Телефон в списках маскируется; открытие карточки пишет Audit LEAD_PII_VIEWED; контакты в логи не попадают.
• Менеджер не может менять исход и фидбэк пробного (нет write-методов, архитектурный тест INV-02).
• Audit: LEAD_CREATED, LEAD_UPDATED, LEAD_STAGE_CHANGED, LEAD_LOST, LEAD_REOPENED, TRIAL_SCHEDULED, LEAD_CONVERTED; все в транзакции операции.
• Конфликт версий → 409 LEAD_VERSION_CONFLICT без частичной записи; терминальная заявка не изменяется (LEAD_TERMINAL).
• Лимит создания заявок на менеджера (по умолчанию 30 в минуту), комментарий выводится как текст.
Критерии готовности
[ ] Шаг 0: сверены имена моделей, enum и существующих сервисов; миграция добавлена, prisma validate и migrate dev проходят на PostgreSQL 18
[ ] Приёмочный тест СЦ-М-06: заявка → claim → пробный урок (создан ученик LEAD, урок TRIAL) → исход ATTENDED от преподавателя → AWAITING_PAYMENT → платёж FIRST_PAYMENT подтверждён (MGR-05) → заявка CONVERTED → аккаунт создан (MGR-03)
[ ] Матрица переходов покрыта unit-тестами; недопустимые → 409 INVALID_STAGE_TRANSITION; без исхода ATTENDED → 409 TRIAL_OUTCOME_REQUIRED
[ ] Ручной конверсии нет; повторная обработка события платежа не меняет заявку второй раз
[ ] Дубликат по телефону или email в своём портфолио → 409 с existingId; чужое портфолио не раскрывается; forceCreate пишется в Audit
[ ] Пробный урок не требует абонемента и не создаёт записей в Ledger (тест на отсутствие публикации); отмена пробного → заявка возвращается в IN_PROGRESS и создаётся LEAD_FOLLOWUP
[ ] Гонка двух назначений пробного: один успех; конфликт слота откатывает создание ученика и урока
[ ] Заявка без телефона и email отклоняется (DTO и CHECK в БД); CHILD без guardianName отклоняется
[ ] summary совпадает со списком при тех же фильтрах; конверсия считается в базисных пунктах без float в денежных путях
[ ] Потеря заявки архивирует связанного ученика без платежей и не трогает ученика с платежами
[ ] Менеджер не может изменить исход и фидбэк пробного (архитектурный тест); текст фидбэка скрывается при выключенном TRIAL_FEEDBACK_VISIBLE_TO_MANAGER
[ ] Чужая заявка → 404 на всех десяти эндпоинтах; STUDENT/TEACHER/ADMIN → 403; мутации без CSRF → 403; создание и назначение пробного идемпотентны
[ ] Откат при отказе Audit и Outbox
[ ] OpenAPI и клиент перегенерированы; ключи словаря ошибок MGR-10 расширены кодами LeadErrorCode
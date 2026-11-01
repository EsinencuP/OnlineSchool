> Исходный текст из [пакета Модуль 2](https://raw.githubusercontent.com/EsinencuP/OnlineSchool/main/docs/AI%20Coder%20Tasks%20%E2%80%94%20%D0%9C%D0%BE%D0%B4%D1%83%D0%BB%D1%8C%202%20%D0%9A%D0%B0%D0%B1%D0%B8%D0%BD%D0%B5%D1%82%20%D0%BC%D0%B5%D0%BD%D0%B5%D0%B4%D0%B6%D0%B5%D1%80%D0%B0.md). Обязательны [общие инварианты и поздние решения владельца](COMMON.md).

### MGR-01: Инфраструктура ManagerModule

**Приоритет:** P0 · **Сложность:** M · **Архитектурные ссылки:** INV-01, INV-06, INV-07, INV-08, INV-13, INV-16; `core/rbac`, `core/session`, `core/csrf`, `core/policy`, `core/errors`, `core/request-id`.

#### Контекст и бизнес-правила

0. **Шаг 0 (сверка).** Прочитать `core/*` и `schema.prisma`. Составить таблицу «ТЗ → код» (StudentProfile, CrmTask, Subscription, LedgerEntry, Manager-сущность и т. д.) и положить в `apps/api/src/modules/manager/MANAGER.md`. Проверить, есть ли `StudentProfile.managerId` и профиль менеджера; если нет — миграция ниже.
1. Структура: `apps/api/src/modules/manager/{manager.module.ts, context/, guards/, scope/, me/, errors/, dto/}`. Модуль импортирует ядро и не экспортирует внутренности.
2. `ManagerContextGuard` выполняется после guard аутентификации ядра: проверяет роль MANAGER, находит активный профиль менеджера по `accountId`, кладёт `ManagerContext` в request. Роль ADMIN на manager-роутах → 403 (имперсонация вне объёма).
3. `ManagerScopeService` — единственная точка проверки принадлежности ученика портфолио (INV-01). Все последующие модули используют только её.
4. Составной декоратор `@ManagerRoute()` навешивает guard'ы, `@Roles('MANAGER')`, `@ApiTags('manager')`, `@ApiCookieAuth()` и стандартные ответы 401/403.
5. `GET /api/v1/manager/me` — профиль, размер портфолио, таймзона, список возможностей (capabilities).

#### Контракты

```prisma
// только если в схеме нет аналога (см. шаг 0)
model ManagerProfile {
  id          String   @id @default(uuid()) @db.Uuid
  accountId   String   @unique @db.Uuid
  displayName String
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  students    StudentProfile[]
}
// StudentProfile: managerId String? @db.Uuid + @@index([managerId])
```

```ts
// context/manager-context.ts
export interface ManagerContext {
  readonly accountId: string;
  readonly managerId: string;
  readonly sessionId: string;
  readonly requestId: string;
}

export type ManagerCapability =
  | 'STUDENTS_VIEW' | 'ACCOUNTS_CREATE' | 'PAYMENTS_CONFIRM'
  | 'SUBSCRIPTIONS_MANAGE' | 'SCHEDULE_MANAGE' | 'TASKS_PROCESS' | 'NOTIFICATIONS_SEND';

// errors/manager-errors.ts
export const MANAGER_ERROR_CODES = [
  'MANAGER_PROFILE_NOT_FOUND', 'MANAGER_INACTIVE', 'FORBIDDEN_ROLE',
  'STUDENT_NOT_FOUND', 'IDEMPOTENCY_KEY_REQUIRED', 'IDEMPOTENCY_KEY_REUSED',
] as const;
export type ManagerErrorCode = (typeof MANAGER_ERROR_CODES)[number];

// scope/manager-scope.service.ts
export interface ManagerScopeService {
  resolveContext(principal: SessionPrincipal): Promise<Result<ManagerContext, DomainError>>;
  assertStudentInPortfolio(ctx: ManagerContext, studentId: string): Promise<Result<void, DomainError>>;
  portfolioWhere(ctx: ManagerContext): Prisma.StudentProfileWhereInput; // { managerId: ctx.managerId }
}

// dto/manager-me.response.dto.ts
export class ManagerMeResponseDto {
  @ApiProperty({ format: 'uuid' }) managerId!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ enum: ['MANAGER'] }) role!: 'MANAGER';
  @ApiProperty() portfolioSize!: number;
  @ApiProperty({ example: 'Europe/Chisinau' }) timezone!: string;
  @ApiProperty({ type: [String] }) capabilities!: ManagerCapability[];
}
```

Эндпоинт: `GET /api/v1/manager/me` → `200 ManagerMeResponseDto`; ошибки 401, 403 (`FORBIDDEN_ROLE`, `MANAGER_INACTIVE`).

#### Безопасность и обработка исключений

- Нет сессии → 401; роли STUDENT, TEACHER, ADMIN → 403 `FORBIDDEN_ROLE`; профиль деактивирован → 403 `MANAGER_INACTIVE`; профиля нет → 403 `MANAGER_PROFILE_NOT_FOUND`. Тела ошибок не раскрывают детали.
- `assertStudentInPortfolio` для чужого и несуществующего ученика возвращает один и тот же `STUDENT_NOT_FOUND` и работает за сопоставимое время.
- `managerId` берётся только из контекста, никогда из тела, query или path.
- Ошибки БД преобразуются в Result на границе data access, без `throw`.

#### Критерии готовности

- [ ] Шаг 0 выполнен, `MANAGER.md` с таблицей соответствия имён закоммичен
- [ ] Миграция добавлена только при отсутствии аналога, `prisma validate` и `migrate dev` проходят на PostgreSQL 18
- [ ] `ManagerContextGuard`, `ManagerScopeService`, `@ManagerRoute()` реализованы, импорты с `.js`, `tsc -b` без ошибок
- [ ] `GET /manager/me` работает, документирован в OpenAPI, `pnpm generate` обновил `api-contracts` и Orval-клиент
- [ ] Матрица INV-16 для `/me`: аноним 401, STUDENT/TEACHER/ADMIN 403, неактивный менеджер 403, активный 200
- [ ] Архитектурный тест: каждый контроллер в `modules/manager` помечен `@ManagerRoute()`
- [ ] Архитектурные тесты INV-02 и INV-03 добавлены (падают при записи в запрещённые модели)
- [ ] ESLint-правила INV-05 и INV-08 включены для `modules/manager`
- [ ] Тест `assertStudentInPortfolio`: свой → ok, чужой и несуществующий → идентичная ошибка
- [ ] В логах и ответах нет данных чужого портфолио

---


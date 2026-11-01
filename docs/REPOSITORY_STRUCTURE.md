# Структура исходников после cleanup, фаза 3

Актуально для `chore/repo-cleanup` от source-only `main` на 01.11.2026. Исторические
описания TASK-01…13 в README и документах сохраняют свои исходные пути. Требования
берутся из `docs/`, визуальные ориентиры — из `ref/` и `template/` локального проекта.

## Слои и точки входа

| Слой | Назначение и потребители |
| --- | --- |
| `packages/shared` | Чистые Result и JSON-проекция; без Nest и зависимостей от приложений |
| `packages/db` | Prisma, фабрики клиента и DB-контракты; схема, миграции и seed не переносились |
| `packages/server-kernel` | Общие Database/Transaction/Audit, AccountContext, DomainError → AppException, DB clock; API и jobs/worker |
| `packages/jobs` | FinanceExpiry и ScheduleDeadline: отдельные `*.module.ts` и `*.service.ts`; API и worker |
| `packages/api-contracts` | OpenAPI, generated types/SDK и transport; без ручных изменений generated-файлов |
| `apps/api/src/core` | Сессии, HTTP, RBAC, CSRF, policy и валидация; не импортирует доменные модули |
| `apps/api/src/modules/*` | Домены Nest; публичный `index.ts`, внутренние controller/service/DTO |
| `apps/api/src/app.module.ts` | Композиция доменов через их публичные index |
| `apps/worker/src/worker.module.ts` | Композиция фоновых обработчиков из пакетов; нет зависимости от API |
| `apps/qa-shell` | React/Vite и serverless-адаптер к API; его API project reference нужен адаптеру |

API и worker делят реализацию исключительно через `packages/*`. Все workspace
tsconfig наследуют `tsconfig.base.json`; server использует NodeNext, frontend —
Bundler. У worker удалён reference на API, добавлены kernel/jobs; их references
ведут только на действительно импортируемые нижние пакеты.

## Карта перенесённых реализаций

| Прежний путь | Реализация сейчас | Совместимость |
| --- | --- | --- |
| `apps/api/src/core/database/database.module.ts` | `packages/server-kernel/src/database/database.module.ts` | Старый путь реэкспортирует те же классы |
| `apps/api/src/core/transaction/transaction.service.ts` | `packages/server-kernel/src/transaction/transaction.service.ts` | Те же TransactionService/Module |
| `apps/api/src/core/audit/audit.service.ts` | `packages/server-kernel/src/audit/audit.service.ts` | Те же AuditService/Module |
| `apps/api/src/core/errors/domain-error.ts` | `packages/server-kernel/src/errors/domain-error.ts` | Старые экспорты, включая API DTO alias, сохранены |
| `apps/api/src/modules/finance/expiry.module.ts` | `packages/jobs/src/finance-expiry/` | Старые Nest классы и package subpath сохранены |
| `apps/api/src/modules/schedule/deadline.module.ts` | `packages/jobs/src/schedule-deadline/` | Старые Nest классы и package subpath сохранены |
| `apps/api/src/modules/identity/input.ts` | `apps/api/src/core/validation/input.ts` | Старый путь остаётся реэкспортом |
| Finance `serialize`, Schedule JSON audit snapshots | `packages/shared/src/json.ts` | Нативные JSON semantics, Decimal.toJSON и ошибки BigInt сохранены |
| Identity `now`, Finance `at`, worker `dbNow` | `packages/server-kernel/src/database/clock.ts` | Прежние имена остаются alias; тот же `clock_timestamp()` |

Result уже был общим и не создаётся повторно. Разные денежные парсеры не объединены:
их ограничения и ошибки не совпадают по смыслу. Новых универсальных utils/helpers
нет; общие инфраструктурные функции остаются в kernel, чистая JSON-проекция — в shared.

## Правила импортов и проверка

Между доменами разрешены только `../<domain>/index.js` и явно выделенные `ports/`.
Nest `exports` по-прежнему определяет доступные DI-провайдеры: TypeScript barrel не
делает все внутренние сервисы публичными. Пакеты не импортируют приложения.
Статические импорты, реэкспорты, literal dynamic import и require проверяет локальный
ESLint plugin `scripts/repo-boundary-rules.mjs`.

Относительные server-импорты требуют `.js`. Явный throw разрешён только в файле
границы DomainError → AppException. Правило денежных полей запрещает `number` и
очевидные float-конверсии для известных денежных имён; это синтаксический контроль,
а не доказательство корректности произвольного вычисления. Счётчики остаются числами.

```sh
pnpm check:boundaries
pnpm check:cycles
```

Первое выполняет положительные и отрицательные ESLint fixtures. Второе строит граф
first-party TypeScript из Git inventory с workspace aliases и type imports, затем
запускает `pnpm dlx madge@8.0.0 --stdin --circular`. В граф входят API, worker,
qa-shell, пакеты и serverless entrypoints; generated Prisma/SDK и внешние зависимости
исключены. Пустой граф и неразрешённые локальные `.js`-импорты дают ошибку. Явный
stdin предотвращает пропуск файлов Madge в скрытом каталоге worktree `.codex`.
Обе проверки включены в CI; новая dev-зависимость не добавлялась.

## Отложенная раскладка DTO

Попытка разложить общий OpenAPI DTO registry и QA controller по доменным папкам
не прошла API typecheck: CSRF Swagger annotations ссылались на `ApiError`, которого
не было в новом namespace facade. Весь этот незакоммиченный шаг откачен по правилу
владельца, без исправления вперёд. Центральный `openapi/dtos.ts`, `qa/qa.dto.ts` и
контроллеры внутри `qa.module.ts` пока сохранены. Единая раскладка DTO/controller
всех старых модулей **не завершена**; пустые `dto/` и `errors/` для вида не создавались.

Остаются три точных зависимости core от OpenAPI composition, записанные в allow-list:

- `core/core.module.ts` → `openapi/dto-validation.pipe.js`;
- `core/csrf/csrf.module.ts` → `openapi/dtos.js`;
- `core/errors/domain-error.ts` → `openapi/dtos.js` (совместимый ApiError alias).

Эти исключения не разрешают core импортировать домены и не допускают новых
composition-imports. Полное отделение core от OpenAPI и перенос DTO остаются
отложенными после отката. `modules/manager` и frontend менеджера не перемещались.

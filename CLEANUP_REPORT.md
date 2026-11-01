# CLEANUP_REPORT — фаза 0: инвентаризация и базовая линия

Дата: 01.11.2026, Europe/Chisinau. Начало измеряемого прогона: 01.11.2026, 14:48:48.

## Область и неизменность

База «до»: `origin/main`, commit `d6e5c6116dd79948ebad988d1852b7b65d37b1f1`. Инвентаризация и все измерения выполнены в отдельном detached worktree `D:/OnlineSchool/.codex/worktrees/cleanup-baseline`. Отчёт сохраняется в ветке `chore/repo-cleanup`.

В cleanup-ветке уже был предыдущий проход; его изменённый генератор **не использован** для этой базовой линии. В исходном main нет кабинетов manager/student. Работа `codex/manager-vercel` и production не включены в измерения; их приложения не удалены — они находятся вне выбранного main. Проверенные ранее PR и пути: [предыдущая сверка](docs/repo-cleanup/2026-11-01/open-pr-paths.md).

В рамках этой фазы исходники, manifests, зависимости, contracts, SDK, schema, seed, миграции и Dockerfile не изменялись. Ничего не удалено, включая существующие dist/кэши/образы. После измерений `git diff HEAD` в baseline пустой; OpenAPI checkout SHA-256 совпал до/после. Отчёт и доказательства — единственные новые tracked-файлы этого шага. Не выполнялись deploy, seed, migrations или обращения к рабочей БД.

## Карта apps/* и packages/*

Шесть workspace-пакетов плюс корневой orchestrator (pnpm/Turbo). Потребители в таблице — **прямые** workspace dependencies из manifests; это не утверждение, что каждая зависимость входит в браузерный bundle.

| Каталог                  | Пакет                          | Назначение                                                                                           | Прямые потребители workspace                                                                                                  |
| ------------------------ | ------------------------------ | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `apps/api`               | `@online-school/api`           | NestJS HTTP API, сессии и guards; standalone и serverless.                                           | `@online-school/qa-shell`, `@online-school/worker`                                                                            |
| `apps/qa-shell`          | `@online-school/qa-shell`      | React/Vite QA-интерфейс действующей среды; не отдельная тестовая БД.                                 |                                                                                                                               |
| `apps/worker`            | `@online-school/worker`        | Nest application context без HTTP: Outbox, recovery, heartbeat, Finance expiry и Schedule deadlines. |                                                                                                                               |
| `packages/api-contracts` | `@online-school/api-contracts` | OpenAPI JSON, generated TypeScript/Orval SDK и HTTP transport.                                       | `@online-school/api`, `@online-school/qa-shell`                                                                               |
| `packages/db`            | `@online-school/db`            | Prisma Client/адаптер pg, schema, миграции, reference/QA seed и database tools.                      | `@online-school/api`, `@online-school/worker`                                                                                 |
| `packages/shared`        | `@online-school/shared`        | Result<T,E>, ok/err и общие имена сервисов.                                                          | `@online-school/api`, `@online-school/qa-shell`, `@online-school/worker`, `@online-school/api-contracts`, `@online-school/db` |

Дополнительные потребители и границы:

- `@online-school/api`: корневой `api/handler.ts` импортирует compiled serverless напрямую; `apps/qa-shell/api/handler.ts` использует package export. Worker использует только `finance-expiry` и `schedule-deadlines` subpaths. QA SPA обращается к HTTP API, а не включает сервер Nest в JS bundle.
- `@online-school/db`: кроме API/worker, фабрики клиента используются Prisma/seed/database tools и эксплуатационными/integration скриптами. Эти команды не являются автоматически мёртвым кодом. Сами DB-команды не запускались.
- `@online-school/api-contracts`: API использует контракт типов; qa-shell импортирует generated SDK и transport. Root `generate` и `generate:client` управляют генерацией. Worker получает его транзитивно через API.
- `@online-school/shared`: Result используется пятью остальными workspace-пакетами; runtime `ok/err` и типы различаются по характеру импорта.
- `apps/api/tsconfig.json` references → shared, db, api-contracts; worker → api, shared, db; qa-shell → shared, api-contracts, api. Turbo `build` имеет `dependsOn: ["^build"]`.

```mermaid
flowchart LR
  QA[apps/qa-shell] --> Contracts[packages/api-contracts]
  QA --> Shared[packages/shared]
  QA -. serverless adapter .-> API[apps/api]
  Worker[apps/worker] --> API
  Worker --> DB[packages/db]
  Worker --> Shared
  API --> DB
  API --> Contracts
  API --> Shared
  Contracts --> Shared
  DB --> Shared
```

Все ссылки на имена пакетов в tracked-файлах перечислены в [машинной карте](docs/repo-cleanup/2026-11-01/phase0/evidence.json) → inventory.workspaces[].referenceFiles; список включает документацию и тесты, а не только runtime.

## Модули внутри apps/api/src

`AppModule` в `apps/api/src/app.module.ts` подключает CoreModule и все восемь областей ниже, плюс собственный HealthController.

| Каталог                             | Nest-модули                            | Содержимое / состояние                                                                       | Связи                                                                        |
| ----------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `apps/api/src/modules/crm`          | CrmModule                              | RegistryController / RegistryService: ученики, семьи, представители.                         | Подключён AppModule; прямых Nest imports нет.                                |
| `apps/api/src/modules/education`    | EducationModule                        | Пустой каркас `@Module({})`.                                                                 | AppModule.                                                                   |
| `apps/api/src/modules/finance`      | FinanceModule, FinanceExpiryModule     | Payments, entitlements, ledger, periods, payroll, teacher rates; отдельный expiry processor. | AppModule; ScheduleModule; worker через экспорт пакета `api/finance-expiry`. |
| `apps/api/src/modules/identity`     | IdentityModule                         | Пароли, opaque session, WebAuthn, recovery и rate limit; экспорт Passwords.                  | AppModule.                                                                   |
| `apps/api/src/modules/integrations` | IntegrationsModule                     | Пустой каркас `@Module({})`.                                                                 | AppModule.                                                                   |
| `apps/api/src/modules/qa`           | QaModule                               | Диагностика компонентов, проверка файлового доступа, API/worker health.                      | AppModule; QA SPA вызывает API.                                              |
| `apps/api/src/modules/schedule`     | ScheduleModule, ScheduleDeadlineModule | Registry, booking, recurrence, outcomes; отдельный deadline processor.                       | AppModule; импортирует FinanceModule; worker через `api/schedule-deadlines`. |
| `apps/api/src/modules/storage`      | StorageModule                          | Пустой каркас `@Module({})`.                                                                 | AppModule.                                                                   |

CoreModule — общий слой в `apps/api/src/core/`: `audit`, `csrf`, `database`, `errors`, `idempotency`, `policy`, `rbac`, `request-id`, `session`, `transaction`. Глобально устанавливает DTO validation pipe, AppExceptionFilter, Session/RBAC/CSRF/WebAuthn/Idempotency guards и CriticalCommandInterceptor; request-id middleware охватывает маршруты.

`apps/api/src/openapi/` — DTO-классы и Swagger/export-инфраструктура; это не самостоятельный предметный Nest-модуль. Пустые Education/Storage/Integrations отмечены как каркасы, а не как разрешение на удаление.

## Точки входа

| Сценарий             | Исходник                                    | Выход / запуск                                                          | Особенности                                                                      |
| -------------------- | ------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Standalone API       | `apps/api/src/main.ts`                      | `apps/api/dist/main.js`; `pnpm --filter @online-school/api start`       | NestFactory.create(AppModule), Swagger; HOST/PORT; shutdown hooks.               |
| Общий serverless API | `apps/api/src/serverless.ts`                | `apps/api/dist/serverless.js`, export handler                           | Кэширует приложение на Function instance; polling worker не запускает.           |
| Root Vercel adapter  | `api/handler.ts`                            | default re-export handler                                               | Выбран root vercel.json; rewrites /api/* и /health.                              |
| QA-project adapter   | `apps/qa-shell/api/handler.ts`              | default export из `@online-school/api/serverless`                       | Альтернативная Vercel entrypoint; не импортируется из браузерного main.          |
| Worker               | `apps/worker/src/main.ts`                   | `apps/worker/dist/main.js`; `pnpm --filter @online-school/worker start` | createApplicationContext(WorkerModule), без HTTP listener; SIGINT/SIGTERM drain. |
| QA frontend          | `apps/qa-shell/index.html` → `src/main.tsx` | `apps/qa-shell/dist/index.html`                                         | React StrictMode → App; SDK через api.ts, passkey через auth.ts; Vite.           |
| OpenAPI export       | `apps/api/scripts/export-openapi.mjs`       | `pnpm generate:client`                                                  | Создаёт Nest app и документ; в этой фазе контракт не переэкспортировался.        |

Инфраструктурные связи сохранены: root `vercel.json` → `infra/vercel/build.mjs` + `Dockerfile.worker`; Compose → `apps/api/Dockerfile` и `apps/worker/Dockerfile`. Два worker Dockerfile в исходной базе побайтово одинаковы, но имеют разные внешние потребители.

## Среда и методика

Host: Windows x64, AMD Ryzen 5 5600G with Radeon Graphics, 12 логических CPU, 15.37 GiB RAM; Node v24.21.0, pnpm 10.34.9. Локальные версии из lockfile: Turbo 2.11.10, TypeScript 6.0.3, NestJS 12.2.0, Prisma 7.10.1, React 18.3.1, Vite 7.3.7.

Зависимости установлены через `pnpm install --frozen-lockfile`; postinstall выполнил штатную offline-генерацию. Установка не включена в build time. Подготовительный запуск до завершения установки не нашёл turbo и не начал сборку; он исключён из замера. Перед измеряемой холодной сборкой подтверждено отсутствие dist всех пакетов, *.tsbuildinfo и выделенного Turbo cache.

Два build-прогона шли последовательно, без изменения source/environment между ними. Локальный кэш новый: `.codex/phase0/turbo-cache`; remote cache выключен через `--cache=local:rw`. pnpm store и OS file cache уже тёплые; холодную сеть, очистку OS cache и повторные статистические серии не измеряли. URL-переменные БД удалены из окружения команд; `BUILD_COMMIT_SHA` установлен в baseline commit. Данные — одиночные локальные замеры, не p95/CI SLA.

## Результаты «до»: typecheck / build / lint / test

| Команда                                                                                        | Результат | Wall time с запуском pnpm | Лог                                                              |
| ---------------------------------------------------------------------------------------------- | --------- | ------------------------- | ---------------------------------------------------------------- |
| `pnpm exec turbo run build --cache-dir=.codex/phase0/turbo-cache --cache=local:rw --summarize` | PASS      | 31.566 с                  | [turbo-cold](docs/repo-cleanup/2026-11-01/phase0/turbo-cold.txt) |
| `pnpm exec turbo run build --cache-dir=.codex/phase0/turbo-cache --cache=local:rw --summarize` | PASS      | 0.495 с                   | [turbo-warm](docs/repo-cleanup/2026-11-01/phase0/turbo-warm.txt) |
| `pnpm typecheck`                                                                               | PASS      | 4.969 с                   | [typecheck](docs/repo-cleanup/2026-11-01/phase0/typecheck.txt)   |
| `pnpm lint`                                                                                    | PASS      | 3.271 с                   | [lint](docs/repo-cleanup/2026-11-01/phase0/lint.txt)             |
| `pnpm test`                                                                                    | PASS      | 5.628 с                   | [test](docs/repo-cleanup/2026-11-01/phase0/test.txt)             |

Первая команда эквивалентна корневому `pnpm build` (тот же `turbo run build`) с явным изолированным cache и summary. Typecheck использует Turbo, lint — корневой ESLint, test — Turbo unit + monorepo smoke.

`pnpm test`: API 10, worker 2, DB clients 3, shared 1, monorepo smoke 2 — **18 passed, 0 failed**. У api-contracts и qa-shell в исходном main нет package test-script. DB/integration/QA seed suites не запускались; эти 18 тестов не означают полной DB приёмки. В test-прогоне 10 успешных Turbo задач, из них 6 cached build и 4 исполненных test.

## Холодная и тёплая сборка Turbo

| Режим                       | Полный wall time | Внутреннее время Turbo | Build tasks     | Cache   |
| --------------------------- | ---------------- | ---------------------- | --------------- | ------- |
| Холодная компиляция         | 31.566 с         | 31.128 с               | 6 успешных      | 0/6 HIT |
| Повторный идентичный запуск | 0.495 с          | 0.100 с                | 6 восстановлены | 6/6 HIT |

Это базовая линия cache reuse, не сравнение «до/после оптимизации». Никакие существующие outputs не удалялись. Хеши задач и cache status сохранены в evidence.json → turbo.

## Размеры dist

Логические байты файлов, без node_modules, с .d.ts и source maps; не allocated disk size и не размер npm tarball. QA-shell имеет TypeScript noEmit, его dist создаёт Vite.

| Каталог                       | Файлов | Всего, bytes | MiB   | JS, bytes | .d.ts, bytes | Maps, bytes |
| ----------------------------- | ------ | ------------ | ----- | --------- | ------------ | ----------- |
| `apps/api/dist`               | 252    | 1084366      | 1.03  | 528243    | 96247        | 459876      |
| `apps/worker/dist`            | 28     | 74129        | 0.07  | 34564     | 4788         | 34777       |
| `apps/qa-shell/dist`          | 3      | 193088       | 0.18  | 183042    | 0            | 0           |
| `packages/api-contracts/dist` | 16     | 502419       | 0.48  | 52745     | 248565       | 201109      |
| `packages/db/dist`            | 328    | 15253344     | 14.55 | 898506    | 8715824      | 5639014     |
| `packages/db/dist-tools`      | 13     | 117885       | 0.11  | 32094     | 1699         | 29343       |
| `packages/shared/dist`        | 8      | 2143         | 0.00  | 275       | 518          | 1350        |

`packages/db/dist-tools` показан отдельно от runtime dist; его общий размер также включает прочие файлы. В packages/db/dist включён generated Prisma Client, поэтому объём types/maps значителен.

## Frontend bundle: Vite production build

`apps/qa-shell`: Vite build, 1 JS + 1 CSS + HTML. Имена файлов относятся к этому конкретному build; builtAt/commit metadata могут менять хеш имени при следующем запуске.

| Файл                                           | Raw bytes  | gzip bytes |
| ---------------------------------------------- | ---------- | ---------- |
| `apps/qa-shell/dist/assets/index-C7dOYG32.css` | 9592       | 2680       |
| `apps/qa-shell/dist/assets/index-DKPUe2PE.js`  | 183042     | 57493      |
| `apps/qa-shell/dist/index.html`                | 454        | 300        |
| **Всего**                                      | **193088** | **60473**  |

JS: 178.75 KiB raw / 56.15 KiB gzip. Gzip подсчитан Node gzipSync отдельно для каждого emitted файла и суммирован; HTTP headers/Brotli и сетевой overhead не включены.

## Размер Docker-образов

Оба образа собраны из **исходных** Dockerfile выбранного main с root build context; пакеты и версии не менялись. Команды и результаты — evidence.json → images; [API build log](docs/repo-cleanup/2026-11-01/phase0/docker-api.txt), [worker build log](docs/repo-cleanup/2026-11-01/phase0/docker-worker.txt).

| Локальный образ                      | Dockerfile            | Size, bytes | MiB     | Платформа   |
| ------------------------------------ | --------------------- | ----------- | ------- | ----------- |
| `onlineschool-phase0-api:d6e5c61`    | `apps/api/Dockerfile` | 1181208848  | 1126.49 | linux/amd64 |
| `onlineschool-phase0-worker:d6e5c61` | `Dockerfile.worker`   | 1181598995  | 1126.86 | linux/amd64 |

Size — значение docker image inspect: логический несжатый размер слоёв; не registry transfer size и не уникальный расход диска. Образы разделяют слои, складывать размеры для оценки места нельзя. Сборки могли использовать существующий Docker layer cache; Docker cold build здесь не заявляется. Container Node: 24.22.2; исходный base tag `node:24-bookworm-slim` не закреплён digest, его не меняли. Параметры runtime и точные image IDs сохранены в evidence.json. Контейнеры приложения/БД в этой фазе не запускались.

## Контрольный хеш OpenAPI

Файл: `packages/api-contracts/openapi/openapi.json`.

- SHA-256 канонического Git blob (LF): `f32a2cf03eca4db077ddc88e1f844aa5c0cfcd724353357f062573b635ccec9f`.
- SHA-256 измеренного Windows checkout (CRLF): `5c7deefd2479228addfdb34d19e9ec74911664ab3e346011f94b94011a1444d5`.
- Checkout SHA-256 до/после совпал. Разные окончания строк объясняют различие двух хешей; source diff пустой. Ручного редактирования generated файлов не было.

## Доказательства и границы

[Полная машинная карта, размеры, cache hashes, команды и metadata](docs/repo-cleanup/2026-11-01/phase0/evidence.json); [канонические SHA-256 всех 214 tracked-файлов baseline](docs/repo-cleanup/2026-11-01/phase0/source-hashes.json). Чистый baseline worktree сохранён; существующие рабочие деревья/outputs и production не трогались.

Результат фазы — инвентаризация и измеряемая база, без удаления или рефакторинга. Ни архитектурное закрытие, ни production GO, ни полная DB-regression из этих измерений не следуют.

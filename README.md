# Онлайн-академия

## Разработка: TASK-01

Создан начальный ESM-monorepo: Node.js 24 LTS, pnpm 10.34.9, TypeScript 6.0.3
(strict), NestJS 12.2.0, Prisma 7.10.1, React 18.3.1 и Vite 7.3.7.
ESLint 9 (flat config), Prettier и Turbo настроены на весь workspace.
Все версии закреплены в `package.json` и `pnpm-lock.yaml`.
У `openapi-typescript` 7.13.0 заявлен peer TypeScript `^5.x`: для него одного
разрешён TS 6.0.3 через `peerDependencyRules`. Генерация и итоговые типы проверяются
на TS 6.0.3; строгая проверка остальных peer dependencies сохранена.

```text
apps/api                 @online-school/api           NestJS HTTP, GET /health
apps/worker              @online-school/worker        NestJS standalone process
apps/qa-shell            @online-school/qa-shell      React/Vite QA-оболочка
apps/student-cabinet     @online-school/student-cabinet React/Vite кабинет ученика (STU-12)
packages/db              @online-school/db            Prisma, фабрики клиентов
packages/api-contracts   @online-school/api-contracts OpenAPI → TypeScript
packages/shared          @online-school/shared        Result<T, E>, константы
```

### Установка и проверка

Установите Node.js 24 (`nvm use` при наличии nvm) и pnpm 9+.
Поле `packageManager` выбирает pnpm 10.34.9. Команды выполняются из корня:

```sh
pnpm install
pnpm -r typecheck
pnpm -r build
pnpm -r lint
pnpm test
pnpm format:check
```

`pnpm install` генерирует Prisma Client и OpenAPI-типы без подключения к БД и без `.env`.
`typecheck` использует `tsc -b`: проверяет TypeScript project references и создаёт
выходные файлы зависимостей, поэтому работает и на чистом workspace.
`pnpm build`, `pnpm typecheck` и `pnpm lint:packages` запускают задачи через Turbo.
`pnpm lint` дополнительно проверяет корневые конфиги и JS-скрипты.
`pnpm test` запускает проверки фабрик БД, Result, HTTP-контракта API и lifecycle worker.

### Локальный запуск

При необходимости скопируйте `.env.example` в `.env` в нужном приложении.
Секреты в `VITE_*` не допускаются: эти значения попадают в браузерную сборку.

```sh
pnpm build
pnpm --filter @online-school/api start
# В отдельных терминалах:
pnpm --filter @online-school/worker start
pnpm --filter @online-school/qa-shell dev
```

API по умолчанию слушает `http://127.0.0.1:3000`, QA-оболочка —
`http://127.0.0.1:5173`. Vite перенаправляет `/api/*` в локальный backend.
`GET /health` проверяет только жизнь HTTP-процесса. Он не подтверждает доступность
БД или готовность релиза. Worker обрабатывает PostgreSQL outbox и reconciliation,
при остановке завершает текущую обработку и освобождает таймеры/подключения.
[Доставка, восстановление и эксплуатация TASK-11](apps/worker/WORKER.md).

Для работы над API/worker: запустите `pnpm --filter @online-school/api watch`
и `pnpm --filter @online-school/api dev` в разных терминалах; аналогично для worker.

### Общие пакеты

Импорты между пакетами используют `workspace:*`. Все пакеты — ESM;
в относительных TypeScript-импортах серверного кода используется расширение `.js`.
Для ожидаемых ошибок приложения используется `Result<T, E>` из
`@online-school/shared`; явный `throw` запрещён ESLint за исключением единственной
типизированной границы DomainError → AppException в ядре API.
Ошибки запуска NestJS перехватываются на границе процесса с ненулевым exit code.

`packages/api-contracts/openapi/openapi.json` — начальный источник контрактов
health и общей ошибки. `pnpm generate` обновляет генерируемые файлы;
их вручную не редактируют. DTO и OpenAPI-типы экспортируются через
`@online-school/api-contracts`, Prisma-типы остаются в серверном `@online-school/db`.
Полная генерация API и клиент относятся к TASK-10.

Фабрики БД возвращают `Result<PrismaClient, DatabaseClientError>`:

```ts
import { createPoolClient, createDirectClient } from '@online-school/db';

const runtime = createPoolClient(); // Только DATABASE_URL, pool max=10.
const maintenance = createDirectClient(); // Только DIRECT_URL, pool max=1.

if (runtime.ok) {
  // Владелец процесса подключает клиент и закрывает его при остановке.
  await runtime.value.$disconnect();
}
if (maintenance.ok) await maintenance.value.$disconnect();
```

Обе фабрики используют PostgreSQL-адаптер Prisma 7. Runtime URL может указывать
на pgBouncer/внешний pool; direct URL должен обходить его. Автоматической подмены
одного URL другим нет. Ошибки конфигурации не раскрывают строку подключения.
Создание клиента не открывает сетевое соединение; ошибки запросов Prisma/pg нужно
перехватывать на границе будущего data access слоя и преобразовывать в Result.

Для Prisma CLI скопируйте `packages/db/.env.example` в `packages/db/.env`.
`prisma.config.ts` читает для миграций исключительно `DIRECT_URL`:

```sh
pnpm --filter @online-school/db db:validate
pnpm --filter @online-school/db db:migrate --name <reviewed-migration>
pnpm --filter @online-school/db db:deploy
```

В исходном инкременте TASK-01 предметных моделей и миграций не было.
Identity/Access/CRM и их проверка на PostgreSQL 18 добавлены в TASK-02, см. ниже.
Эта задача не закрывает FND-GATE, MVP-IMPL-02 или production GO.

Документация реализации: [Prisma 7: pooled/direct подключения](https://www.prisma.io/docs/guides/switch-to-prisma-postgres/from-neon),
[PrismaPg](https://www.prisma.io/docs/postgres/database/switch-from-accelerate),
[NestJS lifecycle](https://docs.nestjs.com/fundamentals/lifecycle-events).

## Разработка: TASK-02

Добавлены Prisma-модели Identity/Access/CRM, общий AuthAccount и две SQL-миграции.
Идентификаторы — UUID, связи именованы, PII помечены. Частичные UNIQUE-индексы
защищают активный Household и аккаунт ученика; SQL проверяет периоды, владельцев
сессий/MFA, виды аккаунтов, роли и сохранение истории.

На чистой PostgreSQL 18.6 прошли `prisma migrate dev`, 12 интеграционных проверок,
`prisma validate` и `prisma generate`; сравнение БД со схемой не выявило различий.
[Модель, запуск тестов и незавершённые зависимости](packages/db/README.md).
Финансовые FK и проверки оплаты добавлены следующим инкрементом TASK-03.
Outbox и серверная авторизация остаются следующими задачами. TASK-02 не закрывает
FND-GATE или production GO.

## Разработка: TASK-03

Добавлены 25 моделей расписания, финансов, оплаченных прав и payroll, Decimal(20,4),
две миграции, уникальные ключи операций и проверки закрытых периодов/остатков.
NestJS-команда публикации ledger проверяет дебет/кредит по каждой валюте;
SQL и runtime RLS защищают опубликованную историю. Штатная политика публикации
остаётся запрещающей до реализации ACL в TASK-06/08; нового финансового endpoint нет.
Финансовые основания активации TASK-02 теперь связаны FK и проверяются в БД.
[Модель, результаты проверки и границы реализации](packages/db/FINANCE.md).

## Разработка: TASK-04

Добавлены Education/Files/Audit/Outbox/Jobs и отдельная HomeworkDelivery: полная схема
содержит 63 модели. Для новых БД подготовлена единая `init`; четыре прежние миграции
сохранены без изменения байтов, для существующих БД есть отдельный legacy upgrade.
`prisma db seed` идемпотентно создаёт только пять ролей. Публикация ledger записывает
audit/outbox атомарно. На PostgreSQL 18.6 прошли одна init, повторный seed,
31 интеграционная проверка и проверка сохранения данных при legacy-обновлении.
[Запуск, выбор migration chain и границы проверки](packages/db/EDUCATION_INFRA.md).

## Разработка: TASK-05

Добавлены calendar EXCLUDE, уникальность распределения платежа и публикационный
balance trigger по каждой валюте. QA seed создаёт синтетические аккаунты/учеников,
расписание и подтверждённые финансовые fixtures, сохраняя данные при повторном запуске.
`pnpm db:migrate:dry-run`, `pnpm db:migrate:up`, `pnpm db:seed`, `pnpm db:reset-qa`
используют отдельные явные адреса окружений. Проверены чистая PostgreSQL 18 и локальный
staging с предыдущей схемой/данными; внешний staging не предоставлен.
Сброс QA отделён от seed; его реальное выполнение остановлено защитой Prisma для AI.
[Команды, данные и доказательства](packages/db/MIGRATIONS_SEED.md).

## Разработка: TASK-06

В API подключено глобальное ядро с PostgreSQL SessionStore, CSRF, default-deny RBAC,
контекстными student policies, request ID и едиными OpenAPI-ошибками. Критические
команды атомарно сохраняют business write, Audit, Outbox и ответ идемпотентности;
SERIALIZABLE retry ограничен тремя попытками. Проверены четыре unit- и девять HTTP/PG
сценариев, включая конкурентный повтор, 401/403/422 и откат при audit/outbox отказе.
Обновлены контракт ошибок и `GET /api/v1/auth/csrf`.
[Подключение handlers, cookies, MFA и границы реализации](apps/api/CORE.md).
Полный login/WebAuthn/recovery добавлен следующим инкрементом TASK-07.

## Разработка: TASK-07

Реализованы все 12 Identity/registry операций: password/passkey login, current/logout,
WebAuthn start/finish с SimpleWebAuthn 14.0.3, управляемое recovery и создание
Student/Household/участников. MFA обновляет counter и заменяет сессию; recovery требует
заранее подтверждённого основания, отзывает старые сессии/ключи и допускает только
повторную регистрацию. Student создаётся через CRM без аккаунта и оплаченных прав.

Схема — 66 моделей, третья incremental migration без изменения прежних миграций.
Проверены 20 HTTP/PG сценариев ядра/Identity, реальная криптография synthetic ES256,
прежние 31 DB- и 6 QA-тестов, оба maintenance CLI и сохранность данных при локальном upgrade.
[Контракты, настройка и recovery runbook](apps/api/IDENTITY.md).
Постоянный QA-домен ещё нужно задать в env; физические ключи/браузер и production GO
этими локальными проверками не подтверждаются.

## Разработка: TASK-08

Реализованы все 17 Finance-операций: поступления и распределение с подтверждением
директора, оплаченные права и ограниченный допуск, сбалансированный ledger,
корректировки закрытой истории, периоды, начисления и подтверждённые выплаты.
Деньги передаются точными decimal-строками. Статусы попытки и подтверждения выплаты
разделены; UNKNOWN требует сверки. Менеджер ограничен назначенными учениками,
teacher читает только свою ведомость. Audit/Outbox/cache атомарны с финансовым фактом.

Очковая ставка 200/220/250 фиксируется на фактический старт; семь месяцев перерыва
не восстанавливают стаж. Индивидуально обещанные ставки хранятся отдельно.
Worker самостоятельно создаёт одну внутреннюю CRM-задачу при истечении допуска.
Добавлена четвёртая incremental migration (69 моделей), OpenAPI и 14 HTTP/PG
сценариев под ограниченной runtime-ролью. [Контракты и границы Finance](apps/api/FINANCE.md).
Реальные банковские операции, внешняя staging-проверка, приёмка юридических
регламентов и production GO этим инкрементом не подтверждаются.

## Разработка: TASK-09 и TASK-10

Schedule добавляет календарные команды с устойчивыми ID экземпляров, занятыми
⭐-слотами, отдельными сообщением/подтверждением исхода, серверным стартом и внутренними
задачами по 24-часовому deadline. Смена назначения не переписывает фактического
исполнителя. [Устройство расписания](apps/api/SCHEDULE.md).

Swagger `/api/docs` и `/api/docs-json` публикует OpenAPI 3.1.0, API v1, 46 операций.
DTO — классы с Swagger/class-validator; денежные поля — строки. `pnpm generate:client`
сохраняет Orval SDK и OpenAPI-типы в исходниках; QA-shell импортирует клиент без TS-ошибок.
[Генерация и использование](apps/api/OPENAPI.md).

**Порядок проверок изменён владельцем 26.10.2026:** до конца фазы 0 выполняем только
необходимые короткие адресные проверки. Крупный общий прогон отложен на конец фазы;
старые результаты выше остаются историческими. [План итоговой приёмки](PHASE0_CHECKS.md).

## Разработка: TASK-12 и TASK-13

Оболочка проверки опубликована на https://onlineschool-xi.vercel.app в одном рабочем
Vercel/Neon-проекте. [Поведение, роли и WebAuthn](apps/qa-shell/QA_SHELL.md).

Docker Compose, раздельные DB-роли, HTTPS-конфигурация для будущего VPS и GitHub Actions:
[запуск, секреты и границы проверки](infra/README.md). Для первого локального запуска:

```sh
node infra/create-local-env.mjs
docker compose up -d --build --wait
```

Ссылки на `docs/`, `ref/`, `template/` и Graphify ниже относятся к локальному корпусу
проекта; исследовательские документы/медиа не включены в публичный source-only экспорт.

## Источники требований

Двадцать исходных документов находятся в `docs/`, семь макетов — в `template/`, 41 исходный JPG и видеозапись — в `ref/`. Ещё 17 просмотренных кадров записи сохранены в `ref/video_frames/ukraine_crm_review/`.

Начать работу: [карта проекта](graphify-out/PROJECT_MAP.md), [дерево документов и макетов](graphify-out/GRAPH_TREE.html), [граф связей](graphify-out/graph.html).

Актуальный пакет на **25 октября 2026**: roadmap **v9.7**, технический реестр v3.2, handoff блока №13, детальное проектирование **v1.9** и релизное дополнение **REL-01/A**. Блоки №13 и №14 закрыты на уровнях архитектуры и проектирования. Расширенный Meet API обязателен для первого MVP. Утверждён порядок реализации: общий фундамент → ученик → преподаватель → CRM → публичный сайт, с отдельной QA-приёмкой каждого этапа. Следующий открытый вопрос — **MVP-IMPL-02**, критерий допуска фундамента.

[Статус документов](graphify-out/DOCS_STATUS.md) · [Актуальная готовность MVP и регламентов](graphify-out/READINESS_MVP_AND_REGULATIONS_2026-10-25.md). Упомянутые в новых источниках отдельные handoff блока №14, стратегия и backlog реализации пока отсутствуют в папке; они перечислены в оценке готовности. Эти документы описывают состояние до TASK-01. Начальный каркас описан выше; полная реализация, приёмка и production GO остаются открытыми.

**Поздние решения владельца от 25 октября:** [дополнение CON-01—11](docs/online_academy_CON_01_11_owner_decisions_addendum_v1.0.md) имеет приоритет в перечисленных вопросах. Сохранены методика возврата со скидкой и очковая ставка 200/220/250 MDL; неполная оплата, включая рассрочку, требует отдельного допуска руководителя. Бонус меняется для будущих уроков; прежние стажевые очки восстанавливаются при возвращении в пределах 6 месяцев. Формальное закрытие №11.4 ожидается. [Результаты выбора по 11 расхождениям](graphify-out/CONTRADICTIONS_2026-10-25.md).

[Галерея видеореференсов](graphify-out/video/gallery.html) содержит таймкоды, фильтры и описания. [Разбор](graphify-out/video/VIDEO_REFERENCES.md) связывает показанные экраны с областями разработки.

Карта фиксирует происхождение и статус требований. Черновики, рекомендации и демонстрационные данные макетов не становятся утверждёнными правилами.

**TASK-14:** единый рабочий MVP опубликован на https://onlineschool-xi.vercel.app
с настоящим Vercel worker Daemon и существующей Neon main. PR #1 объединён;
Git-публикация применяет миграции до выхода новой версии. Дополнительные QA/staging/test
БД не создаются; integration-test явно skipped по уточнению владельца, а FND-GATE остаётся
открытым. [Runbook](infra/vercel/README.md), [протокол](infra/TASK14_EVIDENCE.json).

Graphify 0.9.76 и скилл для Codex установлены. Поиск: `graphify query "ваш вопрос"`. Повторная сборка из сохранённых смысловых фрагментов: `python scripts/build_project_map.py`, затем `graphify export html` и `graphify tree --root . --label OnlineSchool`. Для изменённых документов требуется повторный смысловой анализ; признак устаревания — `graphify-out/freshness.json`.

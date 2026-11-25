# OnlineSchool

Серверная часть платформы индивидуального обучения. API обеспечивает аутентификацию, ролевой доступ, расписание, учебные материалы и финансовые операции. Менеджер ведёт портфолио учеников и связывается с семьёй. Руководитель утверждает финансовые операции и исключения.

## Документация

- [Правила академии и обучения](docs/academy-rules.md)
- [Расписание, замены и отмены](docs/schedule-rules.md)
- [Деньги, абонементы и возвраты](docs/finance-rules.md)
- [Полномочия менеджера и связи между операциями](docs/manager-rules.md)
- [Регламент менеджера](docs/regul/online_academy_manager_regulations_v1.0.md) и [регламент преподавателя](docs/regul/online_academy_teacher_regulations_v1.0.md)
- [Архитектура и интеграции](docs/platform-rules.md), [контракт HTTP API](packages/api-contracts/openapi/openapi.json) и [схема данных](packages/db/ERD.md)
- [Развёртывание и подключения](infra/README.md), [Vercel](infra/vercel/README.md), [резервное копирование](infra/ops/database-backup.md)

## Локальная разработка

### Установка и проверка

Установите Node.js 24 и pnpm 10.34.9. Выполните команды из корня репозитория.

```sh
pnpm install --frozen-lockfile
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

```sh
pnpm build
pnpm --filter @online-school/api start
# В отдельных терминалах:
pnpm --filter @online-school/worker start
```

API по умолчанию слушает `http://127.0.0.1:3000`.
`GET /health` проверяет только жизнь HTTP-процесса. Он не подтверждает доступность
БД или готовность релиза. Worker обрабатывает PostgreSQL outbox и reconciliation,
при остановке завершает текущую обработку и освобождает таймеры/подключения.
[Доставка и восстановление фоновых задач](apps/worker/WORKER.md).

### Локальный демостенд

Подготовьте отдельную PostgreSQL 18 на loopback с именем
`online_school_qa_demo` или `online_school_qa_demo_utc` и часовым поясом PostgreSQL `UTC`.
В локальном окружении задайте `APP_ENV=qa`,
`DIRECT_URL` для миграций, `DATABASE_URL` для API и worker,
`CSRF_SIGNING_SECRET` и уникальный тестовый `PLATFORM_LOCAL_DEMO_PASSWORD`
длиной от 16 символов. Используйте отдельные роли миграций и приложения
из [настройки PostgreSQL](infra/postgres/00-roles.sql).

```sh
pnpm --filter @online-school/api build
pnpm --filter @online-school/db db:deploy
node packages/db/prisma/seed.mjs
node scripts/provision-platform-demo.mjs --local
```

Для API включите `QA_PASSWORD_ONLY_LOGIN=true`, `PLATFORM_DEMO_SWITCHING=true`
и задайте `QA_PASSWORD_ONLY_ACCOUNT_IDS` значением из вывода seed. Запустите API
на порту 3000 и worker в отдельных терминалах.

```sh
pnpm --filter @online-school/api start
pnpm --filter @online-school/worker start
```

Войдите через `POST /api/v1/auth/session` с тестовым логином и локальным
паролем. Для смены демо-аккаунта используйте
`POST /api/v1/auth/switch-user`. База содержит четыре оплаченных
абонемента с 22 правами на уроки, 12 записей в расписании, домашние задания
с двумя ответами и одной проверкой, заявку CRM и задачи. Тестовые платежи
помечены `OWNER-DEMO-NO-REAL-MONEY`.
Повторный seed сохраняет созданные записи и пароль.

Облачный вариант с той же синтетической школой описан в
[инструкции для Railway](infra/railway/README.md).

Для работы над API/worker: запустите `pnpm --filter @online-school/api watch`
и `pnpm --filter @online-school/api dev` в разных терминалах; аналогично для worker.

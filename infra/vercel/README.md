# TASK-14 — единая рабочая публикация MVP

Решение владельца: единственный проект `onlineschool`, постоянный адрес
https://onlineschool-xi.vercel.app, существующая Neon `onlineschool` / main /
`online_school` в Frankfurt, PostgreSQL 18. Дополнительных проектов, веток или БД
QA/staging/shadow не создаётся. QA app удалён по решению владельца 01.11.2026;
общий вход и staff-кабинеты находятся в `apps/platform`. Preview deployments выключены.

Корневой `vercel.json` собирает React SPA и настоящую NestJS Function. Worker —
отдельный Daemon из `Dockerfile.worker`, 1 GiB, одна instance `fra1`, 45 секунд
на SIGTERM. Его состояние остаётся в PostgreSQL; HTTP worker не запускает.
Публичный `/api/health` проверяет API process, `/api/health/worker` — heartbeat
из PostgreSQL не старше 30 секунд. Последний возвращает 503 при остановке worker,
исчерпании квоты или недоступности БД; ответы не кешируются. Подробности компонентов
по-прежнему доступны только через обычную MFA-сессию и разрешённые роли.

## Секреты и публикация

Production target этого одного Vercel-проекта хранит sensitive `DATABASE_URL`
(pooled `app_runtime`), `DIRECT_DATABASE_URL` (direct владелец схемы для миграций)
и `CSRF_SIGNING_SECRET`. `WEBAUTHN_RP_ID` и `WEBAUTHN_ALLOWED_ORIGIN` — соответственно
постоянный hostname и его HTTPS origin. Приложение использует opaque DB sessions,
поэтому не требует неиспользуемого `SESSION_SECRET`. S3 credentials не выдумываются:
их настройка нужна при подключении реального провайдера файлов.

Vercel передаёт project environment variables также Daemon process. Рабочие
запросы API/worker используют исключительно pooled runtime client; migration
credential нужен только protected build. Dockerfile не объявляет секретные ARG,
не сохраняет env и исключает приватные файлы из build context. Для будущего VPS
используйте разделение credentials из Compose runbook.

GitHub CI не получает DB credentials. После обновления основной ветки Vercel Git
integration выполняет `infra/vercel/build.mjs`: компиляция API/SPA, затем
`prisma migrate deploy` через direct connection. При ошибке публикация завершается
ошибкой; старый deployment остаётся обслуживать запросы. Prisma stdout/stderr
миграций не печатаются, показывается только безопасный код ошибки. Применённая
миграция сама по себе не откатывается при последующем сбое платформы; изменения
схемы должны быть совместимы с предыдущей версией. Rehearsal на копии не выполняется.

Root Directory в Vercel — корень репозитория (иначе Daemons beta не поддерживается),
Node 24, install `pnpm install --frozen-lockfile`, output `apps/platform/dist`. Активен корневой `vercel.json`.
Общий аккаунт: `packages/account-ui`; переключение ограничено тестовыми логинами.

План Hobby Daemons beta: 5 Active CPU-hours в месяц на команду; при исчерпании
Vercel останавливает Daemons до следующего месяца UTC. Данные в Neon сохраняются,
health/UI сообщают о недоступности. Это не равнозначно готовности production.

Источники: https://vercel.com/docs/daemons,
https://vercel.com/docs/daemons/config-reference,
https://vercel.com/docs/daemons/limits.

TASK-15, ручная приёмка и FND-GATE остаются отдельными открытыми этапами.

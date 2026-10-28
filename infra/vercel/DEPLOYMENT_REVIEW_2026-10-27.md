# Проверка Vercel — 27.10.2026

Владелец подтвердил: использовать один `onlineschool`, если функционал корректно
работает вместе; разделять только при функциональной необходимости. Для текущих
SPA, NestJS API и фонового worker разделение Vercel-проектов не требуется.

## Причины ошибок

- `api` (`prj_6u8UmPPgbAQEjHRuPUAY65oEoPiI`), deployment
  `dpl_DYCCNuRyzY4xGEUKSycRXadBDjFG`: Node искал
  `/vercel/path0/apps/api/infra/vercel/build.mjs`.
- `worker` (`prj_U1hKs6l2YuygpWRNZMVRJcw0K99P`), deployment
  `dpl_21iXchBurHzJDA2iUfTPpyC7zNgr`: Node искал
  `/vercel/path0/apps/worker/infra/vercel/build.mjs`.
- Корневая команда сборки была применена к подкаталогам. Worker дополнительно
  ошибочно импортирован как NestJS HTTP-приложение, хотя его entrypoint создаёт
  application context без HTTP listener.
- У `api`, `worker` и `qa-shell` список переменных окружения пуст.
  Успешная сборка `qa-shell` сама по себе не подтверждает вход и работу БД.

## Применённая конфигурация

Единственный рабочий проект: `onlineschool`
(`prj_XusYmdwL1Y0478T09RNKmBQMldgZ`), команда
`team_Ht3RiN2zfq6iuPrxaOnTG5s3`, адрес
https://onlineschool-xi.vercel.app.

Настройки сохранены через Vercel API: Root Directory — корень репозитория,
framework `vite`, Node `24.x`, install `pnpm install --frozen-lockfile`,
build `node infra/vercel/build.mjs`, output `apps/qa-shell/dist`, регион `fra1`,
preview отключены, Ignored Build Step очищен. Существующие secret environment
variables не копировались в дубли и не выводились. WebAuthn RP ID и origin
соответствуют постоянному адресу.

У трёх дублей установлены `previewDeploymentsDisabled: true` и Ignored Build Step
`exit 0`. `qa-shell` приостановлен. Pause API для `api` и `worker` вернул
`invalid_deployment: Active production deployment does not exist`; у них нет
успешного production deployment. Повторные попытки pause не выполнялись.
Проекты и исторические ошибки не удалены. Автоматические Git-сборки дублей
пропускаются; явной ручной публикацией их можно снова запустить.

SPA обращается к API по своему HTTPS origin. `/api/*` передаётся настоящему
NestJS handler, затем SPA fallback обслуживает страницы. Это сохраняет host-only
cookies, CSRF, RBAC/MFA и WebAuthn на одном origin без междоменных исключений.
Worker остаётся отдельным Daemon существующего проекта с одной instance `fra1`;
проверка heartbeat читает ту же рабочую PostgreSQL. Дополнительная БД не создаётся.

## Адресная проверка

Браузер на постоянном origin подтвердил:

| Запрос | Результат |
| --- | --- |
| `/` | Интерфейс OnlineSchool загружен |
| `/api/health` | 200, JSON `status: ok`, `service: api` |
| `/api/health/worker` | 200, JSON `status: ok`, `service: worker` |
| `/api/v1/auth/csrf` | 200, токен присутствует |
| `/api/v1/auth/session` без входа | 401 `UNAUTHENTICATED` |
| `/api/docs-json` | 200, OpenAPI 3.1.0, 48 paths текущего main |
| `/api/does-not-exist` | 404, JSON `NOT_FOUND`, не HTML SPA |

Ответы API имеют `Cache-Control: no-store` и `X-Request-ID`. Cookie CSRF:
`__Host-school_csrf`, `Path=/`, `Secure`, `SameSite=Strict`, `Max-Age=900`.
Браузер подтвердил secure context и наличие PublicKeyCredential.
401 без сессии и проверочный 404 — ожидаемые ответы, а не ошибки запуска.

Повторная production-сборка запущена из проверенного Git `main`:
`d6e5c6116dd79948ebad988d1852b7b65d37b1f1`, deployment
`dpl_GqFxQSRDjNVE5DC3ZZ8971remQ3F`. Итог: `READY`, `aliasError: null`,
сборка заняла около трёх минут. Логи подтверждают:
`Working database migrations applied; deployment may be published`,
`Build Completed in /vercel/output [3m]`, `Deployment completed`.
Новые файлы миграций не добавлялись; protected pipeline выполнил свой обычный
`prisma migrate deploy` на миграциях выбранного commit.

После публикации 27.10.2026 в 23:02 МСК повторены браузерные проверки постоянного
адреса: API 200, worker heartbeat 200, CSRF 200, session без входа 401,
OpenAPI 200. Build info в браузере показывает тот же SHA `d6e5c611…`.
Проверка heartbeat подтверждает доступность PostgreSQL для этого SELECT и свежий
worker, но не заменяет проверки всех бизнес-команд после MFA.

## Границы проверки

Это проверка deployment/runtime, а не FND-GATE или production GO. Вход реального
владельца с физическим passkey и сценарии после MFA в этой проверке не выполнялись.
48 paths относятся к текущему опубликованному `main`; более поздние STU-ветки
и незакоммиченные локальные изменения этой операцией не публикуются.
Полные регрессии и migration rehearsal не запускались. Квота Vercel Daemons
остаётся ограничением текущего плана: остановка worker должна давать health 503.

Документация платформы:
https://vercel.com/docs/daemons/config-reference,
https://vercel.com/docs/project-configuration/vercel-json#ignorecommand.

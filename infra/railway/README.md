# OnlineSchool Test на Railway

Окружение `test` содержит три сервиса. `web` отдаёт интерфейс и API на одном
HTTPS-адресе. `worker` запускает одну инстанцию обработчика событий.
`postgres` использует отдельный том и доступен по внутренней сети. Схема,
роли и синтетические данные создаются отдельно от рабочего окружения Vercel.

| Сервис     | Файл Railway                   | Сетевой доступ                             |
| ---------- | ------------------------------ | ------------------------------------------ |
| `postgres` | `/infra/railway/postgres.json` | Закрытый, порт 5432                        |
| `web`      | `/infra/railway/web.json`      | HTTPS, внутренний порт 3000                |
| `worker`   | `/infra/railway/worker.json`   | Закрытый, входящие соединения не требуются |

При сборке из Git укажите путь к файлу конфигурации для каждого сервиса.
Для загрузки отдельного архива поместите выбранный файл в корень как
`railway.json`, а выбранный Dockerfile как `Dockerfile`. При таком способе
укажите `Dockerfile` в `build.dockerfilePath`.

```sh
railway up <каталог-сервиса> --path-as-root --project <id> --environment test --service web --detach
```

Для `worker` укажите его каталог и замените `--service web` на
`--service worker`. В архив включаются исходники сборки и конфигурация
сервиса. Переменные с секретами задаются в Railway.

Подключите том PostgreSQL 18 к `/var/lib/postgresql`. Установите
`POSTGRES_DB=online_school_qa_railway`, `POSTGRES_USER=school_bootstrap`,
сгенерируйте отдельные пароли `POSTGRES_PASSWORD`, `APP_MIGRATE_PASSWORD` и
`APP_RUNTIME_PASSWORD`. Сценарий запуска базы создаёт роли и задаёт ей UTC.

Для `web` установите `APP_ENV=qa`, `PORT=3000` и закрытые переменные
`CSRF_SIGNING_SECRET`, `PLATFORM_LOCAL_DEMO_PASSWORD` (от 16 символов),
`DIRECT_URL` для `app_migrate` и `DATABASE_URL` для `app_runtime`. Обе
строки подключения должны указывать на базу `online_school_qa_railway` на
одном хосте `*.railway.internal`. Сервис `worker` получает только
`DATABASE_URL` и настройки используемых интеграций.

Перед стартом HTTP-сервера образ `web` применяет миграции и наполняет базу
через `node infra/railway/predeploy.mjs`. Команда требует отдельного окружения
`test`, совпадающих адресов и раздельных ролей. Повторный запуск сохраняет
данные. HTTP-процесс запускается без строки миграций и пароля наполнения.
Для переключения демо-аккаунтов в `web` включите `QA_PASSWORD_ONLY_LOGIN=true`
и `PLATFORM_DEMO_SWITCHING=true`. В `QA_PASSWORD_ONLY_ACCOUNT_IDS` поместите
UUID синтетических аккаунтов из [локального seed](../../README.md#локальный-демостенд).

После запуска откройте `/account` на HTTPS-адресе `web`. Запросы
`/api/health` и `/api/health/worker` должны возвращать `200`.
Войдите синтетическим аккаунтом и проверьте переключение ролей, расписание,
домашние задания и остаток занятий. Публичные настройки Vercel управляются
отдельно.

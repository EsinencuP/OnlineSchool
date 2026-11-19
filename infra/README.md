# TASK-13 — Docker Compose и CI

## Локальная контейнерная система

```sh
node infra/create-local-env.mjs
docker compose up -d --build --wait
docker compose exec api pnpm prisma migrate deploy
```

Первый шаг создаёт `.env` с разными случайными паролями и CSRF secret, без вывода
значений. Уже существующий файл не меняется. Пример ключей — корневой `.env.example`.
Пароли генерируются hex, поэтому пригодны для подстановки в PostgreSQL URL.
Не используйте локальный файл для Neon/Vercel и не сохраняйте его в Git/CI artifacts.

API слушает `127.0.0.1:3000`, nginx — `127.0.0.1:80`; порты задаются `API_PORT` и
`HTTP_PORT`. PostgreSQL не публикует порт хоста. nginx проксирует API, включая
`/health` и `/api/docs`; QA SPA пока обслуживается существующим Vercel-проектом.
Это инструкция для будущего VPS/локального запуска, не второй облачный QA space.
По уточнению владельца в TASK-14 сейчас используется только существующая рабочая
Neon main; дополнительные БД, в том числе временные CI-БД, автоматически не создаются.

Порядок запуска: healthy PostgreSQL → одноразовый `migrate` → API/worker → nginx.
Миграции выполняет `app_migrate`; reference seed добавляет только справочник ролей,
без паролей, аккаунтов или демонстрационных финансов. Завершившийся `migrate` с кодом 0 —
нормальное состояние. При ошибке миграции API/worker не запускаются.

В PostgreSQL 18 том монтируется в `/var/lib/postgresql`, PGDATA находится в
`/var/lib/postgresql/18/docker`. `docker compose stop/down` сохраняет named volume
`online-school_pg_data`; `down -v` уничтожает данные и не является штатной командой.
SQL init выполняется только при создании пустого кластера. Изменение пароля в `.env`
не меняет существующий пароль в БД: ротация — отдельная maintenance-операция.

API и worker запускаются от непривилегированного OS-пользователя `node`, PID 1 — init,
SIGTERM передаётся процессу. Worker получает 45 секунд для завершения транзакций и
сохранения заданий. Healthcheck heartbeat подтверждает liveness, не отсутствие ошибок очереди.
Рабочие схемы, runtime grants, append-only audit, RLS и published ledger guards не ослаблены.

## DB-роли

| Роль                           | Возможности                                                                            |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| `school_bootstrap` (`PG_USER`) | Администратор только контейнера PostgreSQL; создаёт роли на пустом кластере            |
| `app_migrate`                  | NOSUPERUSER/NOCREATEROLE/NOCREATEDB/NOBYPASSRLS; владелец одной БД и объектов миграций |
| `online_school_runtime`        | NOLOGIN, точечные table/function grants из версионных миграций                         |
| `app_runtime`                  | LOGIN, наследует только `online_school_runtime`; не входит в `app_migrate`             |

Группа runtime создаётся bootstrap-скриптом заранее: поэтому миграциям не нужен
CREATEROLE. Владелец БД может создавать расширение `btree_gist` и прикладную схему.
Пример `REVOKE ... WHERE published_at ...` не является SQL PostgreSQL. Вместо него
используются уже существующие RLS policies и immutable triggers.

Worker получает только runtime connection и параметры polling. Bootstrap-пароль ему
и API не передаётся. API использует `DATABASE_URL` с `app_runtime`; `DIRECT_URL` с
`app_migrate` доступен в Compose API-контейнере исключительно для указанной владельцем
административной команды `exec api pnpm prisma migrate deploy`. Это осознанная возможность
maintenance в этом контейнере. В опубликованной Vercel Function `DIRECT_URL` отсутствует;
для более строгого разделения на VPS применяйте `docker compose run --rm migrate` и
уберите `DIRECT_URL` из API service. Реальные credentials находятся только вне образов/Git.

## HTTPS на будущем VPS

Нужны Compose >=2.24.4, DNS для выбранного hostname и настоящие `fullchain.pem`/
`privkey.pem` в каталоге вне репозитория. Автоматическое получение сертификата и
смена DNS этим TASK не выполняются. Добавьте в приватный `.env`:

```dotenv
PUBLIC_HOST=school.example.org
TLS_CERT_DIR=/etc/online-school/tls
WEBAUTHN_RP_ID=school.example.org
WEBAUTHN_ALLOWED_ORIGIN=https://school.example.org
```

```sh
docker compose -f docker-compose.yml -f docker-compose.vps.yml up -d --build --wait
```

Override публикует 80/443, перенаправляет HTTP на фиксированный HTTPS hostname,
разрешает TLS 1.2/1.3, монтирует сертификат read-only и включает HSTS. nginx access log
не записывает query, body, Cookie или Authorization. Пароли/challenges не передавайте
в URL. Действующие passkey текущего Vercel hostname не переносятся на новый RP ID.
Смену домена и enrollment следует планировать отдельно.

## Внешняя проверка API и worker

`node infra/ops/runtime-monitor.mjs` проверяет два публичных HTTPS endpoint по
адресу из `OPS_RUNTIME_ORIGIN`. При сбое проверка повторяется через пять секунд.
Код возврата `0` означает исправность обеих проверок, `1` — отказ хотя бы одной,
`2` — ошибку настройки или самого процесса проверки.

Для автоматического оповещения workflow `Runtime health monitor` запускается
на `main` по расписанию через 30 минут, в `:07` и `:37` UTC, и вручную. Он
включается переменной `OPS_RUNTIME_MONITOR_ENABLED=true`. Для настройки
требуются `OPS_RUNTIME_ORIGIN` и секрет Actions `OPS_RUNTIME_PING_URL` с базовым
UUID-адресом закрытой проверки Healthchecks.io. В проверке задать период
30 минут, допустимую задержку 15 минут и доставку уполномоченному оператору.
Внешний сервис отслеживает переходы состояния и пропуск сигналов даже при
остановке самого workflow. В публичном логе Actions виден только факт доставки и
технические ошибки механизма доставки. [Документация Healthchecks.io](https://healthchecks.io/docs/)

Приёмка оповещений требует получить у оператора сигнал об отказе, подтвердить
один инцидент при повторных сбоях, получить сигнал восстановления и проверить
отдельное обнаружение пропущенного запуска. GitHub может задержать или пропустить
запуск cron. Очередь и сверку после восстановления проверяют через защищённый
снимок `/api/v1/qa/queues`. [Расписание GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)

## Резервирование приватных файлов и проверка восстановления

`node apps/api/scripts/private-object-backup.mjs capture` создаёт независимое
поколение в `recovery/<id>/`. В одной read-only транзакции PostgreSQL скрипт
собирает каталог подтверждённых объектов и контрольный отчёт БД. Он копирует
байты, перечитывает точные версии и сверяет SHA-256. Контрольный отчёт и список
копий входят в один подписанный HMAC манифест. Скрипт записывает манифест последним
и перечитывает подписанную версию. При сбое до записи манифеста поколение не используется.
Отчёт с кодом `FILES_CAPTURED` подтверждает проверку этого набора файлов.

`node apps/api/scripts/private-object-backup.mjs verify <id>` сверяет манифест с
выбранным для проверки состоянием БД и перечитывает защищённые версии файлов.
Код `CATALOG_MISMATCH` сообщает число отсутствующих, лишних или изменённых
записей и число действующих разрешений на недоступные файлы. `DATABASE_MISMATCH`
показывает расхождения с контрольным отчётом БД, включая разрешения на файлы.
Незавершённые загрузки учитываются отдельно. Сверка работает в режиме чтения.
`FILES_VERIFIED` подтверждает каталог и целостность файлов данного поколения.
Поле `databaseCheckpointMatched: true` подтверждает совпадение с отчётом БД.

Оператор собирает `@online-school/db` и передаёт параметры через защищённое
окружение. `BACKUP_DB_URL` задаёт PostgreSQL 18 с правами чтения всех строк
проверяемых таблиц. `BACKUP_MANIFEST_KEY`
содержит отдельный 32-байтный ключ в Base64. `BACKUP_S3_ENDPOINT`,
`BACKUP_S3_REGION`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY` и
`BACKUP_S3_SECRET_KEY` задают независимый S3. Для `capture` переменные `S3_*`
задают исходный bucket с правами чтения. Для `verify` достаточно чтения версий
в резервном bucket. Проверка требует версионирование и подтверждение `AES256`.
Архивная политика и учётная запись должны отдельно защищать версии от удаления
оператором приложения. [Контракт S3 PutObject](https://docs.aws.amazon.com/AmazonS3/latest/API/API_PutObject.html)

`node apps/api/scripts/database-recovery-audit.mjs` проверяет инварианты журнала
проводок, подтверждённых платежей, оплаченных прав, фактов занятий и связей
outbox с аудитом. `RECOVERY_DATABASE_URL` задаёт прямое подключение PostgreSQL 18
с правами видеть все строки проверяемых таблиц. Скрипт использует одну read-only
транзакцию и завершает проверку ошибкой, если политика доступа скрывает строки.
В JSON попадают версия миграции, счётчики и SHA-256 для 20 таблиц, включая
метаданные S3 и права на файлы. Начиная с миграции `20261118160000_lesson_admission_starts`
отчёт также сверяет решения по временному допуску и записи фактического старта,
проверяя лимит и согласованность с проведёнными уроками. Команда
возвращает код выхода 1 при нарушениях или расхождении и 2 при ошибке запуска.

Сохраните отчёт `INVARIANTS_OK` в UTF-8 как защищённый контрольный артефакт
и свяжите его с выбранной точкой резервирования. Снимок для отчёта должен
соответствовать этой точке, включая версию схемы. На изолированном восстановлении
до запуска worker и применения новых миграций выполните
`node apps/api/scripts/database-recovery-audit.mjs --checkpoint <file.json>`.
`CHECKPOINT_MATCH` подтверждает проверенные инварианты, версию миграции
и совпадение числа и содержимого записей в выбранных таблицах. В том же
испытании выполните сверку S3 с соответствующим поколением архива, проверку
истории миграций, вход уполномоченного пользователя и проверку повторного
применения законных удалений данных.
[Политики доступа PostgreSQL](https://www.postgresql.org/docs/18/ddl-rowsecurity.html)

Рабочий Neon на 18 ноября предоставляет окно восстановления 6 часов. Проверка
нашла ноль пользовательских snapshots. Внутренние точки Neon относятся к
восстановлению в пределах проекта. Для закрытия ARCH-14 остаются отдельно
доступные физическая копия PostgreSQL и архив WAL, назначение RPO/RTO и
изолированное испытание восстановления с проверкой доступа, финансовых
инвариантов и S3. [PITR Neon](https://neon.com/blog/pitr-deep-dive)

## GitHub Actions

`.github/workflows/ci.yml` запускает typecheck, lint, unit-test, build, docker-build.
`integration-test` явно пропущен по уточнению владельца TASK-14: существующие suites
создают синтетические данные и отдельные БД. Они не перенаправляются на рабочую БД.
Это означает, что текущий CI не является подтверждением DB-регрессии/FND-GATE.
Node 24, pnpm 10.34.9, frozen lockfile;
checkout/setup-node закреплены полными проверенными commit SHA. Токен имеет только
`contents: read`, checkout не сохраняет credentials. Нет `pull_request_target`,
деплой-секретов, автоматической публикации, merge, cache upload или upload artifacts.
Build info получает настоящий `${{ github.sha }}`.

Unit scripts используют существующий `node:test`; в этом TASK добавлены единообразные
`test:unit` aliases, без замены тестового framework. Перед ними компилируются нужные
workspace-зависимости. Новые FND-GATE/E2E наборы относятся к TASK-15.

Историческая проверка TASK-13 (до уточнения TASK-14) использовала настоящий
`postgres:18`, доступный только на loopback. Её свидетельства сохранены.
`DATABASE_URL_CI` — maintenance connection этого временного сервиса;
`DATABASE_URL_TEST` — тестовый шаблон URL того же сервиса. Production secrets с этими
именами подключать нельзя. Для PR не требуются долговечные GitHub secrets.
Внешние CI secrets допустимы только для отдельной проверенной CI-БД, никогда для
рабочего Neon; текущий runner намеренно отклоняет remote hosts и рабочее имя БД.

Сейчас не запускаемый `infra/ci/integration.mjs` проверяет CI=true, localhost, тестовый prefix и PostgreSQL 18,
создаёт новый пустой template, один раз применяет миграции/reference seed, затем делает
шесть новых изолированных клонов для DB, Core, Identity, Finance, Schedule и Worker.
Не использует DROP/reset и не повторяет тесты в рабочей БД. Соединения редактируются
в диагностике. Trust authentication включён только для одноразового loopback CI-сервиса:
старые тесты создают runtime probes без паролей. Compose/Neon/VPS используют пароли.

Полный FND-GATE, clean/previous-version rehearsal, браузерная/ручная QA-приёмка и
публикация worker на Vercel этим инфраструктурным TASK не объявляются пройденными.
Во время TASK локально выполняется короткий Compose/permission/TLS smoke; общий
рекурсивный прогон на рабочей машине отложен по PHASE0_CHECKS.md.

## Публикация исходников и секреты

Локальная старая Git-история содержит исходное видео 276 МБ. Она не переписывается и
не отправляется в GitHub. В новый public repository направляется source-only дерево:
прикладной код, тесты, package/lock/config, runbooks и инфраструктура. Закрытый корпус
документов, видео, graph cache, `.identity-ops/`, реальные `.env`, сертификаты, DB dumps
и build outputs не экспортируются. `.dockerignore` также использует allow-list.

`infra/prepare-source-export.mjs` готовит проверяемый JSON в игнорируемой `.codex/`,
проверяет доступные credentials/ключи и не меняет Git refs. Нечитаемые приватные файлы
исключаются по пути; их ACL не расширяются. При отсутствии рабочей среды этот локальный
экспортёр не нужен для CI/сборки.

Информация о выполненном smoke и CI находится в `TASK13_EVIDENCE.json` после завершения
проверки. Это свидетельства TASK-13, а не протокол открытия кабинета ученика.

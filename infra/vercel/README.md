# Рабочее развёртывание на Vercel

Решение владельца: единственный проект `onlineschool`, постоянный адрес
https://onlineschool-xi.vercel.app, существующая Neon `onlineschool` / main /
`online_school` в Frankfurt, PostgreSQL 18. Дополнительных проектов, веток или БД
QA/staging/shadow не создаётся. Preview deployments выключены.

Корневой `vercel.json` публикует NestJS Function. Worker —
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

Подтверждение учебных загрузок использует условный `GetObject` staging-объекта
и условный `CopyObject` с одним ETag. Для приёмки проверить на выбранном
приватном S3-провайдере чтение staging с `If-Match`, отклонение несовпадения
содержимого, копирование финального объекта и обычное скачивание после
проверки прав. Проверка формата, антивирусная обработка и очистка просроченных
staging-объектов имеют отдельные критерии приёмки. Очистка запускается после
включения `S3_UPLOAD_CLEANUP_ENABLED` у worker. Порядок проверки в
[регламенте worker](../../apps/worker/WORKER.md#очистка-истёкших-загрузок).

### Проверка на вредоносное содержимое

Новые загрузки подтверждаются после однозначного `stream: OK` от ClamAV.
Ответ `FOUND` блокирует публикацию с кодом `UPLOAD_SCAN_REJECTED`. Ошибка,
таймаут или отсутствие настроенного сервиса возвращают `503`; объект остаётся
в staging. В сканер передаются байты файла. API журналирует только коды,
а подтверждённые ранее объекты сохраняют действующий порядок выдачи.

Для Vercel задать `S3_SCAN_TLS_URL` вида `tls://scanner.example.org:3310` и
действующие PEM `S3_SCAN_CLIENT_CERT` и `S3_SCAN_CLIENT_KEY`. Для частного
центра сертификации задать `S3_SCAN_CA`. Удалённый TLS-прокси проверяет клиентский
сертификат, а `clamd` слушает только на защищённой стороне прокси. Для API на
одном хосте со сканером доступен `S3_SCAN_SOCKET_PATH` с контролем прав на Unix
сокет. Секреты хранятся в окружении API. [Протокол ClamD](https://docs.clamav.net/manual/Usage/ClamdProtocol.html)

Профиль ClamAV для приёмки включает `StreamMaxLength 50M`, `MaxFileSize 50M`,
`MaxScanSize 200M`, `AlertExceedsMax yes`, `AlertEncrypted yes` и
`FailIfCvdOlderThan 7` с обновлением сигнатур через freshclam. Проверка выпуска
подтверждает обычный файл, отказ на официальном тестовом файле, отказ при
недоступности сканера и обработку допустимого файла 50 MiB в пределах
бюджета запроса. [Параметры clamd.conf](https://github.com/Cisco-Talos/clamav/blob/main/etc/clamd.conf.sample)

Vercel передаёт project environment variables также Daemon process. Рабочие
запросы API/worker используют исключительно pooled runtime client; migration
credential нужен только protected build. Dockerfile не объявляет секретные ARG,
не сохраняет env и исключает приватные файлы из build context. Для будущего VPS
используйте разделение credentials из Compose runbook.

GitHub CI не получает DB credentials. После обновления основной ветки Vercel Git
integration запускает `infra/vercel/build.mjs`. После компиляции API скрипт
читает историю миграций в read-only транзакции. Незавершённая миграция, пропуск,
дубликат, неизвестная миграция или несовпадение контрольной суммы блокируют
выпуск. Далее сборка выполняет `prisma migrate deploy` через
direct connection, после чего повторяет проверку и требует полного совпадения
с цепочкой в Git. При ошибке публикация завершается
ошибкой; старый deployment остаётся обслуживать запросы. Prisma stdout/stderr
миграций не печатаются, показывается только безопасный код ошибки. Применённая
миграция сама по себе не откатывается при последующем сбое платформы; изменения
схемы должны быть совместимы с предыдущей версией. Rehearsal на копии не выполняется.

Для отдельной проверки истории соберите `@online-school/db` и запустите
`pnpm db:migrate:preflight` с защищённой переменной `DIRECT_DATABASE_URL`.
`PENDING` означает, что применённые миграции совпадают с началом локальной
цепочки. Вариант `pnpm db:migrate:preflight --expect-current` требует `CURRENT`.
Проверка выводит только статус, безопасные коды и имена миграций. Для
восстановления после `P3009` используется отдельная процедура.

### Восстановление выпуска после P3009

После утверждения версии и окна выпуска повторить проверку Neon. Для
`20261116150000_dir04_staff_lifecycle` ожидаются ноль применённых шагов и
отсутствие `manager_handovers` и `staff_status_changes`. В утверждённой версии
файл этой миграции должен содержать исправленный SQL.

С защищённым `DIRECT_URL` выполнить
`pnpm --filter @online-school/db exec prisma migrate resolve --rolled-back 20261116150000_dir04_staff_lifecycle`.
Этот шаг отмечает неудачную попытку в истории Prisma. Затем запустить выпуск
утверждённого коммита. Проверка перед миграциями должна вернуть `PENDING`,
после миграций — `CURRENT`. Проверить health API и worker, свежесть heartbeat
и обработку просроченной очереди. [Процедура Prisma](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/patching-and-hotfixing#option-1-mark-the-migration-as-rolled-back-and-re-deploy)

### Диагностика очереди

`GET /api/v1/qa/queues` доступен директору и техническому оператору после
подтверждённой MFA. Снимок содержит число готовых событий и заданий, возраст
самых старых готовых записей, отложенные повторы outbox, просроченные блокировки,
состояния сверки и до 20 записей о событиях `DEAD`. Каждая запись содержит ID
события, технический тип, число попыток, код сбоя и время. При недоступной БД
запрос возвращает `503` с кодом `QUEUE_HEALTH_UNAVAILABLE`.

После запуска worker сравнить два снимка. Проверить, что готовые к обработке
события и задания уходят из очереди, а просроченные блокировки освобождаются.
Для записей `DEAD` сверить тип, причину и следы исходной операции перед решением
о повторе.

Для подтверждённых переключений демо-аккаунтов, завершившихся
`OUTBOX_HANDLER_NOT_REGISTERED`, после выпуска API и запуска актуального worker
доступна команда `POST /api/v1/qa/outbox/{id}/replay`. Использовать ID исходной
записи `DEAD`, сессию с подтверждённой MFA, CSRF и UUID в `Idempotency-Key`.
Ответ `202` подтверждает постановку задания. `latestDead[].replayStatus` в
снимке `/api/v1/qa/queues` показывает `PENDING` либо `DELIVERED`. Исходная запись
сохраняет `DEAD`, а `DELIVERED` у повтора подтверждает восстановление аудита.

Root Directory в Vercel — корень репозитория (иначе Daemons beta не поддерживается),
Node 24, install `pnpm install --frozen-lockfile`, output `apps/manager-web/dist`.
Корневой `vercel.json` публикует демо-кабинеты с синтетическими данными и
переключением ролей на `/`, `/manager`, `/teacher` и `/student`. Запросы `/api/*`
обслуживает NestJS Function.

План Hobby Daemons beta даёт команде 5 Active CPU-hours и 420 GB-hours выделенной
памяти в месяц. При размере worker 1 GiB квоты памяти хватит максимум на 420
часов непрерывной работы. При исчерпании любой квоты Vercel останавливает Daemons
до следующего месяца UTC или до перехода на Pro. Данные сохраняются в Neon,
а health сообщает о недоступности worker.

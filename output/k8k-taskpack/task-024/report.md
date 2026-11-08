# TASK-024 — серверная проекция предметов, доступа и абонементов ученика

**Статус — DONE для API и SDK.** Адресные mock unit/HTTP/SDK проверки пройдены. Исполнение запроса на PostgreSQL отмечено `NOT_RUN`.

## Основа

Ветка `feat/k8k-design`, HEAD `60e2a0c47cbcc744dc658a85f386833146e836b3`, dirty digest `5da1852af7b2bcab938f52c9b1254c31b72a708669047de0d106ec129e46c3c0`. На входе совпали 179 хешей TASK-023. Подтверждены его 48 локальных сценариев и 48 бюджетов как исторические артефакты. Нерешённый critical producer CRM относится к TASK-022/050. Сверены 21 входная копия, 9 защищённых исторических файлов и исходные записи статуса дерева. [Основа](../../k8k-tasks/TASK-024/basis.json) · [Сохранение](../../k8k-tasks/TASK-024/preservation.json)

## Что существовало и что изменено

`MeService` и guards проверяли сессию, роль, первоначальный пароль и общий доступ. Предметный Meet уже зависел от конкретных enrollment, срока, оплаты или решения директора. Старые subscription GET выбирали один финансовый период и при необходимости раскрывали его группу через manager wrapper. ДЗ и материалы уже имели собственные условия видимости.

| Путь | Изменение |
|---|---|
| `apps/api/src/student/subjects/subjects.controller.ts`, `student.module.ts` | Добавлен `GET /api/v1/student/subjects` с cookie-сессией, текущими guards, `private, no-store` и строгим запретом query-параметров. |
| `apps/api/src/student/subjects/subjects.sql.ts` | Один связанный SELECT использует `statement_timestamp()`, сверяет пару аккаунт/профиль и собирает начавшиеся собственные enrollment и финансовые периоды. Гранты, корректировки, списания и использование разрешений сгруппированы в запросе. |
| `apps/api/src/student/subjects/subjects.service.ts`, `subjects.dto.ts` | Сервер формирует по одному предмету на `subjectId`, возвращает состояния, reason codes, отдельные live/read capabilities, оплаченный остаток и лимит допуска. Группирует только периоды одного wrapper. Финансовый anchor для старых GET выбирается из начавшихся периодов. |
| `subscription/subscription.sql.ts`, `homework/homework.service.ts`, `materials/materials.service.ts` | Переиспользованы условия подтверждённых грантов, действующей выдачи ДЗ и доступного материала. Существующие фильтры старых запросов сохранены. |

Display и возможности — read model. У заморозки `liveAccess:false` и собственные факты ранее выданных материалов/ДЗ. Чтение истории может быть разрешено при закрытом live. Неполная оплата использует действующее отдельное решение с остатком `max_lessons` за вычетом подтверждённых исходов. Просрочка, отзыв, исчерпание и новое распределение исключают старый допуск. При полной оплате доступ проверяется по фактическому положительному гранту. Историческая неизвестность возвращает `null`; подтверждённый нулевой остаток — `0`. [Design note](../../k8k-tasks/TASK-024/design-note.md) · [SQL](../../k8k-tasks/TASK-024/projection.sql)

Действующие источники — VIS-12 STU-05 и V12-AT-01/02, DEV-13/B, DEV-14/B, CON-02/B, актуальный STU-11 guard и правила STU-07/STU-03. Даты и суммы финансовых GET сохраняют прежний контракт. В новой проекции нет денежных полей и команд. [Передача](../../k8k-tasks/TASK-024/handoff.md)

## Контракты, SDK и миграции

OpenAPI 3.1 добавляет `getStudentSubjects` и пять DTO. Все 145 исходных операций и их схемы совпадают, итог — 146 операций. Orval обновлён штатной генерацией. `subscriptionId` относится к финансовому периоду и подходит для деталей, платежей и ledger. `managerSubscriptionId` отдельно обозначает группу. Миграции, Prisma schema и lockfile сохранены. [Сверка OpenAPI](../../k8k-tasks/TASK-024/contracts.json)

## Свежие проверки

| Команда | Exit code | Результат |
|---|---:|---|
| `pnpm --filter @online-school/api typecheck` | 0 | Целевая сборка `dist` перед тестами. [Лог](../../k8k-tasks/TASK-024/api-build.log) |
| `pnpm --filter @online-school/api export:openapi` с `NODE_OPTIONS=--import=file:///D:/OnlineSchool/output/k8k-tasks/TASK-018/no-db-export.mjs` | 0 | 146 операций. Preload запрещает доступ к клиенту БД. [Лог](../../k8k-tasks/TASK-024/generate.log) |
| `pnpm --filter @online-school/api-contracts generate:client` и `pnpm --filter @online-school/api-contracts typecheck` | 0 | Сгенерированный типизированный клиент и проверка типов. [Лог](../../k8k-tasks/TASK-024/generate.log) |
| `pnpm test:k8k-student-subjects` | 0 | 39 тестов, включая новые cases проекции и OpenAPI/SDK и общий HTTP fixture старых и новых GET. Две сессии, чужие параметры, отсутствие cookie, роль, первоначальный пароль, 402, отзыв, параллельные чтения и 503. [Лог](../../k8k-tasks/TASK-024/subjects.log) |
| `pnpm test:stu01 --roots tests` | 0 | 34 адресных теста контекста и transport. [Лог](../../k8k-tasks/TASK-024/stu01.log) |
| `pnpm test:stu07 --roots tests` | 0 | 58 тестов абонемента, включая совместно используемую HTTP suite. [Лог](../../k8k-tasks/TASK-024/stu07.log) |
| `pnpm test:stu03 --roots tests` | 0 | 70 тестов уроков. [Лог](../../k8k-tasks/TASK-024/stu03.log) |
| `node --experimental-vm-modules node_modules/jest/bin/jest.js --roots tests --runInBand --runTestsByPath tests/unit/student-materials.test.mjs tests/unit/student-homework.test.mjs -t 'list query scopes\|URL query applies\|newest-first query\|detail SQL binds'` | 0 | 4 адресных проверки условий видимости материалов и ДЗ. [Лог](../../k8k-tasks/TASK-024/resource-reads.log) |
| `pnpm exec eslint` для изменённых API-файлов и двух suites с `--max-warnings 0` | 0 | Адресный lint. [Лог](../../k8k-tasks/TASK-024/lint.log) |

Проверка SQL охватывает форму SELECT, привязку аккаунта и профиля, условия допуска и группировку. В HTTP-тестах PostgreSQL заменён моком, тесты проекции исполняют сервис поверх синтетических строк. После уточнения проверки nullable integer по фактически сгенерированному OpenAPI адресный набор прошёл.

## Приёмка

| Критерий | Статус | Доказательство |
|---|---|---|
| Независимость математики и физики | PASS | Отдельные subject states, существующий endpoint физики возвращает `canJoin:false` на HTTP fixture. |
| Заморозка и самостоятельная работа | PASS | `liveAccess:false`, разрешённые выдачи ДЗ и материала подтверждены моделированием фактов и проверкой прежних SQL-условий. |
| Частичный платёж, отдельный допуск, полная оплата | PASS в unit/SQL contract | Три состояния возвращают раздельные поля. Границы истечения, отзыва, исчерпания и последнего распределения проверены в сгенерированном SQL; план PostgreSQL остаётся `NOT_RUN`. |
| Два ученика и отказ доступа | PASS | Чужие ID и сессии, mismatch роли, пароль, отзыв и 402. |
| Ноль, `null`, будущие периоды и wrapper | PASS в unit/SQL contract | Подтверждённый ноль и неизвестность различены. Группировка не складывает разные планы. Предикат ограничивает SQL уже начавшимися периодами. |
| Параллельное чтение, empty и 503 | PASS на HTTP fixture | Чтения не меняют fixture состояния. Реальное пустое множество и ошибка источника дают разные ответы. |
| OpenAPI/SDK, старые детали, история и платежи | PASS | SDK-проверка и переход по возвращённому финансовому ID. |
| SQL на PostgreSQL, UI и production gate | NOT_RUN | Рабочий DB-доступ для задачи не предоставлен, UI относится к TASK-025/026. |

Тестовый сценарий визуального рендера не требуется для этого API-инкремента. PostgreSQL EXPLAIN, реальные ledger snapshots и работа на production остаются отдельно. [SQL и параметры](../../k8k-tasks/TASK-024/query.json) · [Машиночитаемая приёмка](acceptance.json)

## Передача и обратимость

TASK-025 получает SDK, subjectId/enrollmentIds и capabilities. TASK-026 получает упорядоченные планы, состояние, раздельные остатки, дату и финансовый anchor. Для отката вернуть точечные изменения по `before/` и удалить добавленные файлы TASK-024. После возврата DTO выполнить штатную генерацию SDK. [Контракты следующему кодеру](../../k8k-tasks/TASK-024/handoff.md)

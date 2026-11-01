# MGR-09: дашборд менеджера, 01.11.2026

## Шаг 0: сверка и общие определения

Изучены core session/RBAC/ManagerRoute/transaction, ManagerScopeService,
MGR-02/04/05/06/07 и утверждённое уточнение владельца по деньгам. Модуль только
читает; новой модели, миграции, механизма аутентификации и кэша нет.

| ТЗ                       | Реальный код / общий источник определения                                   |
| ------------------------ | --------------------------------------------------------------------------- |
| StudentProfile           | Student, AssignedManager; portfolioWhere → portfolioSql                     |
| ACTIVE/FROZEN/LEAD       | MGR-02 studentCrmStatusSql и subscriptionSelectionSql                       |
| Subscription             | ManagerSubscription для управляемого срока; финансовые периоды Subscription |
| Остаток занятий          | MGR-04 managedSubscriptionTotalsSql                                         |
| Истекающий абонемент     | expiringSubscriptionSql, subscriptionExpiryUntil; root ACTIVE               |
| Запланированный урок     | LessonOccurrence SCHEDULED; MGR-06 schedule-read.spec                       |
| Google Meet              | общий effectiveMeetLink/MEET_LINK_REGEX, dashboard отдаёт только boolean    |
| CrmTask                  | CrmTask; MGR-07 task-read.spec, whitelist и проверка связанного ученика     |
| CHARGE_DISPUTE / GENERAL | хранимые ATTENDANCE_DISPUTE / MANUAL                                        |
| PaymentRecord            | PaymentReceipt, его CRM-контакт и опубликованные Ledger движения            |
| Ожидающие оплаты         | Finance pendingReceiptTotalsSql, общий MGR-05 receiptStatus/statusWhere     |

Общая выборка абонемента выделена из student subscriptionFacts без изменения её
правил. Статус ученика совпадает с MGR-02: это статус выбранного представительного
абонемента; счётчик относится к ученикам, а не к числу учебных направлений.
Дашборд не вводит собственную альтернативную классификацию нескольких направлений.

При сверке исправлены два расхождения MGR-02: open/overdue task counts теперь
учитывают только публично видимые MGR-07 типы/связи; subscriptionExpiringSoon
использует общую выборку ACTIVE управляемых абонементов, исключает FROZEN и строго
применяет (now,until]. Учебные/FOLLOW_UP/PAYMENT_FOLLOW_UP задачи не попадают в CRM
сводку. Прежние доказательства MGR-02 сохранены как исторический снимок.

## Контракт и снимок

GET `/api/v1/manager/dashboard` возвращает ManagerDashboardDto. Параметры:
lessonsHorizonHours=48, допустимы24/48/168; expiringDays=7, допустимы3/7/14.
Неизвестные параметры и недопустимые значения422. Все вложенные Swagger DTO
имеют явные схемы; OpenAPI/Orval обновлены до126 операций.

Core runReadOnly начинает callback с
`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY`. Изоляция задана в
этом первом SQL, без дополнительного isolation SET от Prisma option. Затем один
transaction_timestamp() задаёт generatedAt и все временные границы; профиль и
единственная активная роль MANAGER перепроверяются в том же снимке.

Шесть явных команд Prisma внутри reporting-транзакции:

1. SET изоляции и read-only режима.
2. SELECT transaction_timestamp().
3. SELECT профиля с текущими role/disabled predicates.
4. Общий overview: счётчики учеников, ближайшие уроки и overdue count/top.
5. Истекающие абонементы с количественным остатком.
6. Ожидающие поступления по валютам.

BEGIN/COMMIT дают восемь SQL-команд транзакции; middleware session/RBAC запросы
HTTP-пайплайна находятся за пределами reporting-бюджета. Это структура вызовов,
проверенная mock-счётчиком, а не live PostgreSQL trace. Команд записи и Audit для
успешного дашборда нет; core session bookkeeping/отказы доступа сохраняют обычное
поведение ядра. READ ONLY не заменяет scope: каждая выборка строится через общий
portfolioWhere/portfolioSql. Внутренности ManagerModule не экспортируются.

Уроки: startsAt в [now,now+horizon], SCHEDULED, максимум10, порядок start/id.
Это подокно стартов календаря MGR-06; сам календарь сохраняет overlap-контракт
[from,to), включая начавшийся ранее урок. При сверке списков применяется то же
подокно стартов. meet override/явное удаление/валидность совпадают с MGR-06;
сам URL, контакты, заметки, учебные результаты и семейные данные не возвращаются.

Задачи: dueAt<now, OPEN/IN_PROGRESS; полный count и первые5 dueAt/id. Закрытые,
неразрешённые типы, повреждённый subscription payload и связи на чужой урок
исключаются. Финансовый source, недоступный для старого dispute, сам по себе не
скрывает задачу, как и в MGR-07.

Истечение: ACTIVE root, endsAt в (now,until], максимум10, endsAt/id. Сначала
выбираются10 кандидатов, затем рассчитываются их права общей спецификацией MGR-04.
until добавляет календарные дни в SCHOOL_TIMEZONE (default Europe/Chisinau),
сохраняя школьное время при DST. Границы на полуночи и дни23/25 часов проверены.

Пустой портфель даёт нули/пустые массивы. Ответ private/no-store. Аноним401,
STUDENT/TEACHER/DIRECTOR/TECH_OPERATOR403; ADMIN из исходного ТЗ соответствует
запрещённому административному доступу, имперсонации нет. Ошибки DB обобщены в
Result/503 без driver details.

## Финансовое уточнение

Применено [решение владельца от01.11.2026](../../../../../../docs/online_academy_manager_dashboard_decisions_2026_11_01.md):
ожидание одобрения плюс подтверждённый нераспределённый остаток. Прямое сравнение
только с MGR-05 filter=PENDING недостаточно: CONFIRMED с остатком тоже входит.

Finance read-spec сохраняет MGR-05 статусы поступления и отдельно определяет его
остаток. Для опубликованного CONFIRMED читается UNALLOCATED_FUNDS по документам
поступления/распределений и их correction lineage: CREDIT−DEBIT. Поэтому отмена
распределения возвращает остаток, а неопубликованное предложение его не уменьшает.
Для ещё не опубликованного поступления берётся точная сумма receipt. Учитываются
только положительные остатки, один receipt — один count. Отклонённые и полностью
распределённые исключены. SUM выполняется PostgreSQL numeric, ответ format4 string,
валюты раздельны. CUSTOMER_ADVANCE и remainingLessons не участвуют.

Контакт должен быть в портфолио. Агрегат дополнительно исключает поступления семей
с актуальным ребёнком вне портфолио и поступления с распределением на чужого
получателя. Проверки membership/назначений темпоральны на одном now. Карточка
поступления MGR-05 остаётся самостоятельным разрешённым представлением по контакту;
дашборд не раскрывает размер исключённой семьи или причины исключения.

## Проверки и p95

47 собственных проверок:32 HTTP,13 unit,2 SDK. Покрыты query/роли, два менеджера,
общий набор данных MGR-02/04/05/06/07, границы уроков/истечения, Meet boolean,
просрочка и лимиты, precision выше безопасного JS integer, опубликованная отмена
распределения, смешанная семья, snapshot mutation mock и лимит шести команд.
95 затронутых unit и338 HTTP/architecture проверок,1 standalone worker smoke
проходят:481 уникальная проверка. Сборки API/worker/api-contracts, typecheck
student-cabinet/qa-shell, адресный ESLint и OpenAPI/Orval проходят.

SQL проверен офлайн pglast; данные/согласованность HTTP проверены реальными
Nest/core/domain сервисами с mock Prisma и relational evaluator. Эти проверки
не доказывают PostgreSQL MVCC, фактический query plan/round trips или p95.
Новые миграции не нужны; существующие миграции не применялись. Рабочая БД не
изменялась, отдельная/одноразовая PostgreSQL не создавалась по PHASE0_CHECKS.md.

`pnpm test:mgr09:load` — воспроизводимый read-only HTTP прогон. Требует существующий
origin MGR09_LOAD_BASE_URL и manager cookie в MGR09_LOAD_COOKIE (локально через
секретное окружение, не в чат/репозиторий). Preflight MGR-02 проверяет ровно500
учеников; далее10 warmup и100 GET с concurrency4, nearest-rank p95, порог300мс.
Скрипт не создаёт fixtures/аккаунты и не сохраняет cookie или тела ответов.

Текущий `tests/evidence/mgr09-load-report.json`: **NOT_RUN**, нет origin и manager
session. Поэтому p95≤300мс **не подтверждён**, нагрузочный критерий остаётся открытым.
После предоставления авторизованной среды с таким портфелем нужно выполнить этот
прогон; mock timings не выдаются за PostgreSQL результат. FND-GATE не закрыт.

# TASK-046 — Преподаватель: собственные рабочие уведомления и структурированные обращения менеджеру

**Пакет:** K8K-FRONTEND-REBUILD v1.0,03.11.2026. **Блок:** 4 — Рабочий кабинет преподавателя. **Модуль:** Личные данные работы, коммуникации и приёмка.

**Входные зависимости:** [TASK-036](TASK-036.md), [TASK-038](TASK-038.md), [TASK-041](TASK-041.md), [TASK-044](TASK-044.md), [TASK-045](TASK-045.md). Номер относится только к этому пакету, не к старым MGR/Phase0 TASK. **Учёт выполнения:** [EXECUTION_LOG](EXECUTION_LOG.md).

**Исходный статус:** NotificationService/NotificationOutboxPublisher и StudentNotification ориентированы на studentId; NotificationDispatch не содержит собственного teacher recipient. CrmTask и schedule-requests существуют, teacher notification/appeal API и UI отсутствуют. Нельзя переиспользовать student inbox под видом teacher или объявить готовый API обращений.. Это описание кода на дату составления, не акт приёмки и не команда начать с нуля.

## 1. Команда AI-кодеру и результат

Выполни **только TASK-046** в существующем репозитории. Не начинай следующий TASK автоматически.

Создать отдельный безопасный teacher scope для рабочих уведомлений и собственных организационных обращений: одно событие/одна связная задача, видимый ответ и история, без внутреннего чата с ребёнком, без дублирования запросов расписания и без расширения финансовых полномочий.

Этот файл содержит необходимые общие правила и предметное задание. Предыдущая переписка, ответы других чатов и внешний COMMON.md не нужны. Локальные исходники/документы ниже нужны для проверки фактической реализации; их ссылки не заменяют сформулированные здесь требования. Если код уже частично существует — ревью, завершение и доказательство вместо повторной реализации.

## 2. Контекст проекта — повторён намеренно

Рабочий репозиторий `D:/OnlineSchool`, существующее ESM pnpm-monorepo. Это функциональный редизайн работающей академии, а не новый проект. Node24, pnpm10.34.9, React18.3.1, Vite7.3.7, TypeScript6.0.3 strict, NestJS/Prisma, PostgreSQL, TanStackQuery и сгенерированный Orval SDK уже используются. Проверяй текущие manifests: перечисленные версии описывают исходную точку пакета03.11.2026, не команду массово обновить зависимости.

В выпуск входят пять кабинетов, общий вход и смена демонстрационного пользователя. Публичный сайт отдельно. Русский и румынский утверждены для всего интерфейса, включая aria-labels, ошибки, валидацию, даты и пустые состояния. Учебные задания, имена, комментарии и сообщения людей автоматически не переводятся. Язык и таймзона — разные настройки; таймзона берётся из авторитетного контекста пользователя.

Уже есть `packages/ui` с токенами, локальными Golos/Lucide, AppShell/StateBoundary/freshness/refresh, базовыми controls и частичной locale-моделью. `account-ui` остаётся границей меню аккаунта/сессии. В текущем инкременте есть Reports, bell pagination/redirect, current-lesson fix и staff section URLs. Это заготовки и ограниченные доказательства, а не завершение всего плана. Не пересоздавай их с нуля. Сначала сравни фактический код с требованием TASK. Выполненное сохрани и проверь; недостающее реализуй. Исторические числа тестов не считать новым прогоном.

Порядок: основа → ученик → преподаватель → менеджер/CRM → необходимые директор/оператор/общий вход → сквозная приёмка. Отдельные недостающие API-инкременты разрешены владельцем03.11.2026 в рамках утверждённых правил. Старый frontend-only запрет в разделе8 K8K-документа исторический; действующий раздел7 и текущий план имеют приоритет.

## 3. Неприкосновенные правила — применить и в этом TASK

1. Сохрани пользовательский dirty/untracked код и архивы. Никаких `reset --hard`, `clean`, удаления чужих файлов, force push или коммита всего дерева. Сначала прочитай status/HEAD; работай ограниченным diff. Существующую ветку не подменять. Если нужна новая — `codex/k8k-task-NNN` с сохранением рабочей основы; без автоматического merge/push/deploy.
2. Приоритет: последняя явная воля владельца → действующие специальные решения/UX → актуальные архитектурные источники → K8K-инструкции → визуальный template. Замороженные исторические акты не переписывать. Ссылки на отсутствующие handoff/backlog/findings не считать их содержимым или доказательством реализации.
3. Экран ничего сам не подтверждает. Календарь, вход в Meet, факт проведения, право на занятие, денежное поступление, распределение, начисление и выплата — разные факты. Не создавать второй ledger или клиентский расчёт прав.
4. Все действия проверяет сервер по `роль × действие × объект × контекст`. Кнопки строятся по реальной action eligibility/capabilities, не по одной строке роли. Передача поступления менеджером на согласование не директорское подтверждение. Подтверждение поступления/распределения и окончательное финансовое решение — директор.
5. Пока совокупно подтверждённая распределённая оплата абонемента ниже полной цены, каждый частичный/рассрочный допуск требует отдельного ограниченного решения директора. Полная оплата даёт нормальный доступ без двойных прав. Снимок/скриншот платежа семьи не подтверждает оплату.
6. Деньги остаются точными decimal strings/существующим Decimal; никаких `Number`/`parseFloat` для сумм. Не смешивать валюты, аванс, нераспределённые средства семьи, остаток уроков и ожидающие поступления. Чужие дети смешанного портфолио/семьи не раскрываются.
7. Обычная ставка преподавателя: `min(6,floor(eligible_full_months/2)) + min(4,floor(active_students/2))`;0–4→200MDL,5–9→220MDL,10→250MDL. Расчёт только сервером, snapshot при фактическом старте. Восстановление стажа при возвращении в пределах6месяцев. Старые +20/+30,230MDL и месячный пересчёт не возвращать. Спор/предварительное начисление/подтверждённая выплата различаются; личные обещанные обязательства не отменять молча.
8. У ученика нет общего чата/«Моих обращений»/пункта «Сообщения» и отдельного центра уведомлений: только колокольчик. Официальные внешние контакты только из разрешённой CRM-проекции. Спецформы переноса/спора остаются в уроке. Новые внешние организационные автонапоминания семье не вводить.
9. ДЗ и история уроков ученика — единые хронологические списки без новых status-tabs. Сдача не checkbox. Черновик/сохранение/загрузка/отправка/проверка раздельны; существующую сериализованную очередь autosave/версий/idempotency не переписывать ради внешнего вида. Просрочка — текст/иконка, не новая санкция.
10. Навыки: три качественных этапа «Знакомлюсь/Практикую/Применяю» плюс техническое «Ещё не изучали». Ни процентов знаний, рейтинга, автоповышения. Циклы4/8 по подтверждённо проведённым урокам каждого предмета; срез4 не отчёт8; публикация требует преподавателя. Неизвестные ретрокоррекции не решать эвристикой.
11. Истечение одного предмета не закрывает другой; заморозка не окончание, ранее разрешённая самостоятельная работа сохраняется. Полная приостановка — простой экран и контакт менеджера; история не удаляется. Нельзя выводить доступ из названия плана или клиентского состояния.
12. Сохрани действующие CSRF, idempotency, no-store, MFA и явно разрешённые scoped password-only исключения. Одноразовый пароль/OTP/cookie/OAuth token не попадает в logs/stories/snapshots/idempotency cache. Logout/401/session switch убирают приватный DOM/кэш и отменяют reads; поздний ответ прежнего actor отбрасывается.403 выше cached stale.
13. Девять UI-классов: loading, empty, ready, stale, error, pending/unknown-result, forbidden, subscription-limited, session-expired. Loading не empty; queued не delivered; unknown не success. Повтор чтения допустим по политике, слепой повтор команды с неизвестным исходом запрещён. Read≠claim≠resolve; серверная эскалация не зависит от браузера.
14. Токены/шрифт/размеры provisional до приёмки. Golos локально, Lucide статически, без CDN/фото людей/emoji actions. WCAG2.2AA, видимый фокус, клавиатура, reduced-motion, статусы текстом и иконкой;4ширины360/768/1024/1280. Основное действие ученика48px, прочие44px; staff touch44px, desktop от36px по контексту. Не скрывать overflow вместо исправления доступа. Бюджет≤250KiB gzip на маршрут по единому методу с учётом fonts.
15. Новый dependency только по необходимости: pinned версия, релиз старше14дней, license MIT/ISC/BSD/Apache-2.0/OFL; MPL-2.0 только соответствующий test tooling, React18 peers; запись причины/веса вui-stack. Никаких Tailwind/Bootstrap/FullCalendarPremium/AGPL/GPL/CC-NC заимствований. Современный сайт vendor не разрешает обновить текущий stack до latest.
16. Одна рабочая Vercel/Neon main. Не создавать staging/QA/disposable БД, не выполнять reset/seed/destructive/concurrency/crash suites на рабочей БД. Unit/HTTP mocks/local browser fixtures разрешены; перед командой проверь её реальное содержимое и env-target. Не читать/печатать .env. Недоказуемые DB/provider проверки остаются BLOCKED/NOT_RUN, неPASS.
17. Во время отдельного TASK только нужные scoped build/generate/lint/tests и короткий smoke. Общую рекурсивную регрессию отложить до финального блока. Авторизованное API-изменение: source DTO/service/controller → безопасные проверки → штатная OpenAPI/SDK генерация → consumers; generated вручную не править. Applied migrations/checksums не переписывать. Подготовить необходимую additive migration можно с описанием сохранения данных; не применять её к рабочей БД в этой задаче без отдельного разрешения.
18. Условные DIR-01…06 остаются выключенными, DIR-07/BI/P&L вне выпуска. .ics, saved filters, offline/PWA/dark mode тоже вне этого пакета. LEGAL/FIN-LEGAL, ретрокоррекции4/8, expanded MeetAPI POC/OAuth/security/G4 и FND-GATE не закрываются наличием экрана или mock-тестом.

## 4. Источники и конкретные входные файлы

Обязательный локальный минимум, повторённый для отдельного чата:

- [AGENTS.md](../../AGENTS.md) — последние owner decisions, source priority, preservation.
- [PHASE0_CHECKS.md](../../PHASE0_CHECKS.md) — первые актуальные ограничения среды; позднейший исторический список не разрешает testDB.
- [docs/K8K_REDESIGN_PLAN.md](../K8K_REDESIGN_PLAN.md) — объём и последовательность.
- [docs/K8K_IMPLEMENTATION_STATUS.md](../K8K_IMPLEMENTATION_STATUS.md) — какие заготовки уже есть и что ещё не доказано.
- [docs/K8K_REQUIREMENTS_MATRIX.md](../K8K_REQUIREMENTS_MATRIX.md) — текущая трассировка и статусы.
- [docs/K8K_DESIGN_INSTRUCTIONS.md](../K8K_DESIGN_INSTRUCTIONS.md) — разделы2–7; раздел8 исторический, не действующий запрет API.
- [docs/online_academy_CON_01_11_owner_decisions_addendum_v1.0.md](../online_academy_CON_01_11_owner_decisions_addendum_v1.0.md) — CON-01…11: деньги, допуск, ставки, публикация; не возвращать старую модель.

Предметные основания именно этого TASK:

- [docs/K8K_DESIGN_INSTRUCTIONS.md](../K8K_DESIGN_INSTRUCTIONS.md) — **5.1,5.4**: Честные состояния, read≠resolved и разрешённые действия
- [docs/K8K_Academy_VIS12_dashboard_module_contracts_v1.0.md](../K8K_Academy_VIS12_dashboard_module_contracts_v1.0.md) — **3:TCHD-07**: Собственные значимые события и обращения teacher
- [docs/online_academy_MVP_full_release_architecture_roadmap_v9.7.md](../online_academy_MVP_full_release_architecture_roadmap_v9.7.md) — **TCH-08/B,TCH-10/B,TCH-11/B; DEV-08/09**: Центр уведомлений teacher допустим, обращения структурированы, перенос отдельный
- [docs/online_academy_CON_01_11_owner_decisions_addendum_v1.0.md](../online_academy_CON_01_11_owner_decisions_addendum_v1.0.md) — **CON-08/B**: Организационная семья информируется лично менеджером
- [docs/regul/online_academy_teacher_regulations_v1.0.md](../regul/online_academy_teacher_regulations_v1.0.md) — **6,11,13**: Разрешённые каналы, конфиденциальность и срок обычного ответа20часов
- [docs/online_academy_manager_notification_decisions_2026_11_01.md](../online_academy_manager_notification_decisions_2026_11_01.md) — **System/manual delivery separation**: Сбой доставки не тождественен отмене исходной операции

Реальные точки входа в код/доказательства (существуют на дату пакета; если структура позже изменена, найди symbol через `rg`, не создавай дубликат):

- [apps/api/src/modules/notifications/notification.service.ts](../../apps/api/src/modules/notifications/notification.service.ts).
- [apps/api/src/modules/notifications/notification-outbox.publisher.ts](../../apps/api/src/modules/notifications/notification-outbox.publisher.ts).
- [apps/api/src/modules/notifications/templates.ts](../../apps/api/src/modules/notifications/templates.ts).
- [apps/api/src/modules/schedule/registry.service.ts](../../apps/api/src/modules/schedule/registry.service.ts).
- [apps/api/src/modules/manager/tasks/manager-tasks.service.ts](../../apps/api/src/modules/manager/tasks/manager-tasks.service.ts).
- [apps/api/src/student/notifications/notifications.service.ts](../../apps/api/src/student/notifications/notifications.service.ts).
- [packages/db/prisma/schema.prisma](../../packages/db/prisma/schema.prisma).
- [apps/worker/src/notifications.ts](../../apps/worker/src/notifications.ts).
- [apps/platform/src/App.tsx](../../apps/platform/src/App.tsx).

Визуальная опора: [template/newtemp.png](../../template/newtemp.png) — язык дизайна, не требования и не источник mock-цифр. Старые [template/*.webp](../../template/README.md) — только исторические примеры.

Инструменты кодера: начинай поиск исходников с `rg`; версии/лицензии проверяй через `pnpm view` и текущий lockfile. Для библиотечных API используй доступный Context7/официальные документы нужной версии; для интерфейса — локальный Playwright/browser harness и проверку реального рендера. Сначала проверь доступность MCP, не считай запись сервера доказательством авторизации. Repo-инструменты и локальные fixtures остаются рабочим fallback. Figma/внешний дизайн-сервис не обязательны для восстановления этого контекста. Не подключай реальные аккаунты/провайдеры ради mock smoke и не подменяй ими ограничения среды.

Официальные справочные сайты по теме; бизнес-контекст уже дан выше, интернет не нужен для его восстановления. Перед использованием API/версии библиотеки сверяй первичную документацию именно совместимой версии. Наличие ссылки не требует установки пакета:

- [React 18.3.1](https://18.react.dev/reference/react) — API текущей major-версии; не обновлять проект до React19 по latest-примеру.
- [TanStack Query v5](https://tanstack.com/query/latest/docs/framework/react/overview) — Чтения, query keys, invalidation, cancellation; выбранную minor сверять с package.json.
- [WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/) — Рабочая accessibility-рамка; axe не заменяет ручные проверки.
- [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots) — Воспроизводимые снимки и контролируемые fixtures.
- [Orval](https://orval.dev/) — Генерация SDK только штатным способом проекта.

## 5. Предметные правила и сохранение поведения

- Teacher имеет собственный центр рабочих уведомлений по TCH-10/B; ученический запрет большого notification center не переносится на teacher, но student UI не расширяется.
- Teacher recipient/owner всегда определяется серверной сессией и отдельным типизированным контекстом; нельзя записать teacher ID в student_id и отключить FK/SQL guards.
- Показано/доставлено/прочитано/принято/решено различаются; mark-read не закрывает CRM задачу и не подтверждает выполнение педагогического действия.
- Одно событие связано с одной предметной записью и дедуплицируемой задачей; виджеты не создают параллельные поручения.
- Запрос изменения подтверждённого расписания использует существующий schedule-requests workflow; общая форма обращений направляет туда, а не создаёт второй тикет.
- Собственное обращение не меняет урок, paid access, сумму, ставку, выплату или статус чужой задачи; manager/director выполняют отдельное предметное действие.
- Без общего чата учитель–ребёнок/родитель; семейные организационные внешние сообщения автоматически не отправляются.
- Не назначать новые SLA/приоритеты обращения по своему усмотрению. Обычный ответ teacher менеджеру20часов от отправки относится к действующему регламенту, не универсальному response SLA всех тикетов.
- Содержимое и вложения обращений минимальны, приватны и доступны только author+уполномоченному обработчику; чужие финансовые/медицинские подробности исключены.

## 6. Контракты, данные и совместимость

- Teacher notification/appeal операции новые; существующие /student/notifications и manager notification I/O сохранить, не разрешать teacher роль в student endpoint.
- Notification read DTO: безопасный тип/текст, own recipient, source reference, created/read timestamps; никаких чужих task payload целиком и никаких секретов в переменных.
- Appeal create input: category, сообщение, optional разрешённый object reference и expected revision при ответном действии; actor/routing/status задаются сервером.
- Response/history доступны собственному teacher и уполномоченному manager/director по существующим policies; наличие correlation ID не даёт права открыть чужой объект.
- Mark-read идемпотентен и независим от исполнения; unknown create/result сверяется по тому же ключу. Повтор outbox не создаёт duplicate appeal/task/notification.
- Новые schema поля/таблицы минимальны и обоснованы FK/ACL/immutable history; enums существующих student template types не расширять бесконтрольно teacher категориями.

Точные имена новых planned DTO/operation/props запиши в коротком design note этого TASK до реализации и соблюдай существующие namespace/style. Planned нельзя выдавать за уже существующий API. Найденный существующий сервис переиспользуй. Generic UI не принимает бизнес-решения. Существующий авторитетный источник не копируется во второй реестр.

## 7. Пошаговое выполнение

1. Подтверди prerequisites по реальным артефактам предыдущих TASK и текущему коду. Недостающий результат не заменяй заглушкой или флагом с фиктивными данными. Не пересылай пользователю уже закрытые вопросы о чате, уведомлениях или director-only подтверждениях.
2. Провести schema-gap таблицу: student notification recipient сейчас несовместим с teacher, generic CrmTask не хранит полный author/response workflow. Спроектировать минимальное typed recipient/appeal расширение без дублирования event/task домена.
3. Описать каталог разрешённых teacher событий из уже реализованных процессов: расписание, ожидающий outcome, homework submission, checkpoint/report deadline, разрешённый ответ менеджера; unsupported события оставить выключенными.
4. Добавить teacher list/read/read-all notification API с own scope и стабильным paging; использовать общий outbox/dedup/audit transport, но отдельную recipient модель/проверки.
5. Добавить структурированные appeal create/list/detail с категорией, разрешённой ссылкой на объект и текстом; server author/manager routing и idempotency обязательны. Точные новые URL/DTO/DDL документировать как результат задачи.
6. Для обращений по расписанию переиспользовать существующий request ID и статус; из общей формы делать переход к специальному сценарию. Для денег/материалов/техпомощи создать только разрешённую CRM задачу.
7. Привязать manager response/status к тому же appeal/task и разрешённому автору; не выводить весь CRM журнал с внутренними заметками или материалы чужих лиц.
8. Собрать RU/RO teacher center и «Мои обращения» с counter/read status, source links, history, error/unknown states; teacher draft защищать от потери, no chat widget.
9. Обработать no-delivery-channel/worker failure отдельным статусом; system operation может быть успешна при failed notification, ручной невалидный канал не объявлять отправленным.
10. Подготовить минимальную additive migration и OpenAPI/SDK; проверить own/foreign/revoke, source/task dedup и доступные response effects на fixtures. Не применять к рабочей БД.
11. Сверь итог с правилами разделов3/5/6 этого же файла, обнови журнал и предметную матрицу, подготовь артефакты и остановись после отчёта по TASK-046.

## 8. Обязательные сценарии проверки

- [ ] Teacher видит только собственные notifications/appeals; подмена recipient/teacher/task ID и прямой foreign URL закрыты.
- [ ] Mark-read/read-all меняют own unread counts, не закрывают outcome/homework/CRM задачи.
- [ ] Повтор source/outbox/create/replay создаёт одну связную запись и один task, не дублирует работу.
- [ ] Appeal по переносу направляет к тому же schedule request; ни слот, ни финансовый статус не меняются от подачи.
- [ ] Manager ответ отображается автору без внутренних заметок и без чужих student/family данных.
- [ ] Отозванный teacher assignment не позволяет открыть связанный student объект; собственная допустимая переписка не становится обходом ACL.
- [ ] No delivery channel и worker timeout имеют честные statuses; исходная бизнес-операция не откатывается из-за provider failure.
- [ ] Внешний email/SMS семье не отправляется; student notification schema/TTL/inbox остаются совместимыми.
- [ ] RU/RO, keyboard, counter refresh, empty/stale/error/unknown и safe links проверены на четырёх ширинах.

Для визуального изменения: RU/RO,360/768/1024/1280, keyboard/focus/long text и relevant VIS11 states. Для read-model/API: validation, own/foreign scope, revoked context, no-store, error/empty/unknown и совместимость SDK. Для мутации: CSRF/idempotency/revision/unknown-result и отсутствие двойного эффекта. Не добавляй бессмысленный тест, который просто повторяет строку implementation; доказывай поведение.

## 9. Команды и безопасные границы проверки

Рабочий каталог `D:/OnlineSchool`. Это адресные ориентиры из текущих manifests, а не разрешение слепо запускать все команды. Прочитай scripts/конфиг теста перед запуском. Сборка может генерировать Prisma/SDK; это не разрешение запускать migration/seed или подключать реальную БД. Dist-based tests выполнять после целевой сборки.

```powershell
pnpm --filter @online-school/api typecheck
```

```powershell
pnpm --filter @online-school/platform typecheck
```

```powershell
pnpm --filter @online-school/platform lint
```

```powershell
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/unit/student-notifications.test.mjs tests/unit/manager-notifications.test.mjs tests/unit/manager-tasks.test.mjs --runInBand
```

Если нужен новый тестовый script, сначала добавь его в manifest с явно безопасным локальным/mock target, затем запусти и запиши точную команду. Не выполняй `pnpm test`/recursive regression автоматически на каждом TASK. Полный разрешённый прогон относится к финальному блоку. Ошибка не основание ослабить линтер или выдавать NOT_RUN за PASS.

## 10. Критерии готовности

- [ ] Собственный teacher center и структурированные обращения действительно имеют backend и UI.
- [ ] Teacher recipient не замаскирован под student; роли/objects/ссылки защищены отдельным scope.
- [ ] Read, delivery, accept и resolved различаются; один source не создаёт дублирующую задачу.
- [ ] Schedule appeal не дублирует существующие requests; прочие обращения не выполняют деньги/расписание.
- [ ] История/ответ и RU/RO states доступны, private content не утекло в student/manager общий payload.
- [ ] Schema/OpenAPI изменения подготовлены и адресно проверены без рабочего DB-write и без выдуманного SLA.

- [ ] Все использованные данные и действия имеют реальный авторитетный источник/проверку; нет выдуманных цифр, прав, кнопок и success.
- [ ] Отчёт различает исходный работающий код, новые изменения, свежие проверки и исторические доказательства.
- [ ] Не изменены рабочая БД, применённые migration checksums и production; необоснованные внешние эффекты отсутствуют.

## 11. Не входит в этот TASK

- Внутренний messenger teacher–семья, личные соцсети и новые внешние рассылки
- Новые уровни срочности/правила SLA без источника или approvals
- Прямые финансовые/кадровые решения из обращения и небезопасное расширение operator доступа

Обнаруженный соседний gap запиши с конкретным следующим TASK, не расширяй текущую задачу на весь redesign. Если требуется реально новое бизнес-решение или недоступный внешний провайдер — подготовь все независимые изменения и точный вопрос/блокер только по этому пункту. Не останавливайся на повторном согласовании ранее утверждённых правил.

## 12. Артефакты и отчёт для следующего кодера

- Teacher recipient/appeal schema-gap и минимальный migration design
- Event→notification→source task→response трассировка с дедупликацией
- RU/RO center/appeal evidence и запрет внешней семейной отправки

Формат `output/k8k-tasks/TASK-046/report.md`:

```text
TASK: TASK-046
Статус: DONE / PARTIAL / BLOCKED (не смешивать с исходным статусом заготовки)
Основа: HEAD, ветка, dirty digest, сохранённые чужие изменения
Что уже существовало:
Что изменено: путь → поведение → причина
Контракты/SDK/миграции: actual changes, совместимость, что не применялось
Источники/решения: конкретные IDs и применённый приоритет
Проверки: команда → exit code → сценарии → artifact path
Визуальные доказательства: route, role, locale, viewport, fixture
Не проверено/блокеры: точная причина и необходимое внешнее условие
Acceptance checklist: каждый критерий PASS / FAIL / NOT_RUN
Остатки: конкретный TASK и передаваемые interfaces/URLs/ключи
Риски и обратимость: ограниченный rollback без удаления истории/чужих файлов
```

После отчёта остановись. Следующий TASK выдаёт владелец отдельно. Не добавляй утверждение о FND-GATE/юридическом соответствии/production GO, если такого доказательства и решения нет.

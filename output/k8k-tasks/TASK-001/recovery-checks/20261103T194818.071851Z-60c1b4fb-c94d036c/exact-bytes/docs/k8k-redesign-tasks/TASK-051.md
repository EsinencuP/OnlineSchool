# TASK-051 — Append-only API структурированного журнала контактов

**Пакет:** K8K-FRONTEND-REBUILD v1.0,03.11.2026. **Блок:** 5 — Менеджер и CRM. **Модуль:** Журнал контактов.

**Входные зависимости:** [TASK-048](TASK-048.md), [TASK-050](TASK-050.md). Номер относится только к этому пакету, не к старым MGR/Phase0 TASK. **Учёт выполнения:** [EXECUTION_LOG](EXECUTION_LOG.md).

**Исходный статус:** Модель ContactLog и связи уже существуют; manager contact-log HTTP/API отсутствует. PATCH student contacts — редактирование реквизитов, не журнал взаимодействий.. Это описание кода на дату составления, не акт приёмки и не команда начать с нуля.

## 1. Команда AI-кодеру и результат

Выполни **только TASK-051** в существующем репозитории. Не начинай следующий TASK автоматически.

Добавить scoped чтение и идемпотентную запись факта внешнего контакта в существующий ContactLog, сохранив автора, время события и время внесения без отправки сообщения и без редактирования исторической записи.

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

- [docs/online_academy_MVP_full_release_architecture_roadmap_v9.7.md](../online_academy_MVP_full_release_architecture_roadmap_v9.7.md) — **DEV-10/B; DEV-08/B/09/B**: Структурированный ручной журнал, event time/record time и отдельные предметные подтверждения.
- [docs/K8K_Academy_VIS12_dashboard_module_contracts_v1.0.md](../K8K_Academy_VIS12_dashboard_module_contracts_v1.0.md) — **MGR-04; §6 безопасность**: Контакты ожидающие работы и разрешённая детализация.
- [docs/K8K_DESIGN_INSTRUCTIONS.md](../K8K_DESIGN_INSTRUCTIONS.md) — **§5.3 Контакты**: Позвонить — tel, зафиксировать — запись факта, не отправка семье.
- [packages/db/prisma/schema.prisma](../../packages/db/prisma/schema.prisma) — **ContactLog; ContactChannel; AssignedManager**: Переиспользовать существующую модель, не создавать parallel journal.
- [docs/regul/online_academy_manager_regulations_v1.0.md](../regul/online_academy_manager_regulations_v1.0.md) — **Обязанности по общению и фиксации**: Краткая операционная история без полных переписок.

Реальные точки входа в код/доказательства (существуют на дату пакета; если структура позже изменена, найди symbol через `rg`, не создавай дубликат):

- [packages/db/prisma/schema.prisma](../../packages/db/prisma/schema.prisma).
- [apps/api/src/modules/manager/manager.module.ts](../../apps/api/src/modules/manager/manager.module.ts).
- [apps/api/src/modules/manager/scope/manager-scope.service.ts](../../apps/api/src/modules/manager/scope/manager-scope.service.ts).
- [apps/api/src/modules/manager/students/manager-students.controller.ts](../../apps/api/src/modules/manager/students/manager-students.controller.ts).
- [apps/api/src/modules/manager/leads/manager-leads.controller.ts](../../apps/api/src/modules/manager/leads/manager-leads.controller.ts).
- [apps/api/src/modules/manager/dto/student-crm.dto.ts](../../apps/api/src/modules/manager/dto/student-crm.dto.ts).
- [apps/api/src/modules/manager/context/manager-context.ts](../../apps/api/src/modules/manager/context/manager-context.ts).
- [apps/api/src/modules/manager/students/manager-students.service.ts](../../apps/api/src/modules/manager/students/manager-students.service.ts).

Визуальная опора: [template/newtemp.png](../../template/newtemp.png) — язык дизайна, не требования и не источник mock-цифр. Старые [template/*.webp](../../template/README.md) — только исторические примеры.

Инструменты кодера: начинай поиск исходников с `rg`; версии/лицензии проверяй через `pnpm view` и текущий lockfile. Для библиотечных API используй доступный Context7/официальные документы нужной версии; для интерфейса — локальный Playwright/browser harness и проверку реального рендера. Сначала проверь доступность MCP, не считай запись сервера доказательством авторизации. Repo-инструменты и локальные fixtures остаются рабочим fallback. Figma/внешний дизайн-сервис не обязательны для восстановления этого контекста. Не подключай реальные аккаунты/провайдеры ради mock smoke и не подменяй ими ограничения среды.

Официальные справочные сайты по теме; бизнес-контекст уже дан выше, интернет не нужен для его восстановления. Перед использованием API/версии библиотеки сверяй первичную документацию именно совместимой версии. Наличие ссылки не требует установки пакета:

- [React 18.3.1](https://18.react.dev/reference/react) — API текущей major-версии; не обновлять проект до React19 по latest-примеру.
- [TanStack Query v5](https://tanstack.com/query/latest/docs/framework/react/overview) — Чтения, query keys, invalidation, cancellation; выбранную minor сверять с package.json.
- [WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/) — Рабочая accessibility-рамка; axe не заменяет ручные проверки.
- [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots) — Воспроизводимые снимки и контролируемые fixtures.
- [Orval](https://orval.dev/) — Генерация SDK только штатным способом проекта.

## 5. Предметные правила и сохранение поведения

- Использовать ContactLog: lead/student target, actor manager, existing channel enum CALL/MESSAGE/EMAIL/OTHER, краткий outcome, occurred_at и server created_at. Контакт не идентифицирует человека и не объединяет семьи.
- Body не принимает managerId/createdAt/произвольного ученика вне route. Проверка текущего portfolio/lead assignment нужна до чтения/записи и внутри transaction/replay.
- Запись — утверждение менеджера о факте контакта, не доказательство доставки/прочтения/согласия семьи, оплаты, переноса или решения спора.
- Никаких sends/email/SMS/мессенджер API, call recording, автоматического импорта переписок и хранения полных вложений. Outcome — минимальный текст операционной цели.
- Append-only: POST/GET без PATCH/DELETE для записей. Исправление исторической записи отдельным принятым процессом; эта задача не даёт право молча переписывать историю.
- Legacy ContactLog может содержать и lead_id, и student_id согласно существующему CHECK>=1; не ужесточать constraint задним числом и не терять историю перехода lead→student. Scope всех раскрываемых связей проверяется.

## 6. Контракты, данные и совместимость

- Новые endpoints — explicit ContactLog read/write, не изменение реквизитов PATCH contacts. DTO output: contactId, target reference, channel, outcome, occurredAt, recordedAt, author display; private staff/representative поля не раскрываются.
- POST требует session/CSRF/UUID и текущий scoped action. GET no-store, cursor привязан actor/filter/target; foreign/unknown target возвращает единый существующий404/403 according resource policy.
- Опциональный representativeId не добавляет доступ: проверяется законная текущая связь с целевым учеником/заявкой; отсутствие связи отклоняется без раскрытия чужих представителей.
- Contact completion не закрывает CRM task автоматически. Будущая связь contact→task не принимается как произвольный taskId без scoped authorization и принятой отдельной команды.

Точные имена новых planned DTO/operation/props запиши в коротком design note этого TASK до реализации и соблюдай существующие namespace/style. Planned нельзя выдавать за уже существующий API. Найденный существующий сервис переиспользуй. Generic UI не принимает бизнес-решения. Существующий авторитетный источник не копируется во второй реестр.

## 7. Пошаговое выполнение

1. Подтверди prerequisites по реальным артефактам предыдущих TASK и текущему коду. Недостающий результат не заменяй заглушкой или флагом с фиктивными данными. Не пересылай пользователю уже закрытые вопросы о чате, уведомлениях или director-only подтверждениях.
2. Проверить существующие ContactLog/schema/grants и где уже записывается контакт. Не спутать NotificationDispatch или обновление contact phone с журналом факта.
3. Добавить GET/POST /api/v1/manager/students/:studentId/contact-log и эквивалент leads/:leadId/contact-log; новый controller/service подключить к existing ManagerRoute, scope и TASK-048 actions.
4. Определить строгий DTO POST: channel из существующего enum, outcome1–2000 plain text, occurredAt ISO instant не из будущего; representativeId optional только при подтверждённой связи с route target. Автор/createdAt серверные.
5. Разрешить backdated факт без выдуманного30-дневного лимита, но хранить occurredAt отдельно от createdAt; неправильный/будущий timestamp422. Не устанавливать новый retention срок как юридически утверждённый.
6. В CriticalCommand записать ContactLog+Audit+Outbox+idempotency атомарно; replay с тем же body не создаёт второй контакт, changed body отклоняется. Audit/outbox содержат IDs/channel/status без outcome/phone/email.
7. Чтение сортировать occurred_at DESC,id DESC с limit25/max100 и scoped cursor. Не раскрывать всем карточкам семьи contact notes через один совпавший phone или representativeId.
8. Подготовить append-only DB enforcement/миграцию только при отсутствии текущей защиты, сохранив старые строки и nullable links; не применять DDL в рабочей mainDB автоматически.
9. Описать OpenAPI/SDK и HTTP tests двух менеджеров/истории назначения/дубля/atomic rollback. Классификаторы результатов, исправления, retention/legal оставить за границей без фабрикации signed approval.
10. Сверь итог с правилами разделов3/5/6 этого же файла, обнови журнал и предметную матрицу, подготовь артефакты и остановись после отчёта по TASK-051.

## 8. Обязательные сценарии проверки

- [ ] Два менеджера: GET/POST чужого student/lead запрещены независимо от совпавших контактов.
- [ ] Same key+body даёт одну запись, changed body не создаёт новую; audit/outbox failure откатывает log/idempotency.
- [ ] OccurredAt вчера и recordedAt сейчас различны; future/invalid date и blank/oversize outcome отклонены.
- [ ] Чужой representativeId, подставленный managerId/createdAt и unknown body keys не принимаются.
- [ ] Нельзя PATCH/DELETE existing ContactLog; historic dual lead/student link сохраняется без backfill.
- [ ] Создание log не отправляет сообщение/не закрывает task/не подтверждает деньги или согласие.
- [ ] Plain text HTML-like outcome не исполняется; logs/outbox не содержат PII/полного outcome.

Для визуального изменения: RU/RO,360/768/1024/1280, keyboard/focus/long text и relevant VIS11 states. Для read-model/API: validation, own/foreign scope, revoked context, no-store, error/empty/unknown и совместимость SDK. Для мутации: CSRF/idempotency/revision/unknown-result и отсутствие двойного эффекта. Не добавляй бессмысленный тест, который просто повторяет строку implementation; доказывай поведение.

## 9. Команды и безопасные границы проверки

Рабочий каталог `D:/OnlineSchool`. Это адресные ориентиры из текущих manifests, а не разрешение слепо запускать все команды. Прочитай scripts/конфиг теста перед запуском. Сборка может генерировать Prisma/SDK; это не разрешение запускать migration/seed или подключать реальную БД. Dist-based tests выполнять после целевой сборки.

```powershell
pnpm test:mgr01
```

```powershell
pnpm --filter @online-school/api typecheck
```

- Создать test:k8k-manager-contact-log: mock unit/HTTP/SDK, без DML/DDL на mainDB.

Если нужен новый тестовый script, сначала добавь его в manifest с явно безопасным локальным/mock target, затем запусти и запиши точную команду. Не выполняй `pnpm test`/recursive regression автоматически на каждом TASK. Полный разрешённый прогон относится к финальному блоку. Ошибка не основание ослабить линтер или выдавать NOT_RUN за PASS.

## 10. Критерии готовности

- [ ] ContactLog используется как единственный журнал, новые endpoints полностью typed и scoped.
- [ ] Автор/recordedAt серверные, event time сохранено отдельно без вымышленного срока давности.
- [ ] POST идемпотентен и атомарен с Audit/Outbox; история append-only.
- [ ] Нет внешней отправки/автоматического закрытия/согласия как побочного эффекта.
- [ ] Negative access/replay/rollback cases пройдены; legal retention и corrections не объявлены утверждёнными.

- [ ] Все использованные данные и действия имеют реальный авторитетный источник/проверку; нет выдуманных цифр, прав, кнопок и success.
- [ ] Отчёт различает исходный работающий код, новые изменения, свежие проверки и исторические доказательства.
- [ ] Не изменены рабочая БД, применённые migration checksums и production; необоснованные внешние эффекты отсутствуют.

## 11. Не входит в этот TASK

- Автоматическая интеграция телефонии/мессенджеров, записи звонков, send-message API.
- Новые retention/legal approvals и право редактировать/удалять историю контактов.

Обнаруженный соседний gap запиши с конкретным следующим TASK, не расширяй текущую задачу на весь redesign. Если требуется реально новое бизнес-решение или недоступный внешний провайдер — подготовь все независимые изменения и точный вопрос/блокер только по этому пункту. Не останавливайся на повторном согласовании ранее утверждённых правил.

## 12. Артефакты и отчёт для следующего кодера

- output/k8k-taskpack/task-051/report.md: commit, изменения, команды и ограничения; отрицательные/непроверенные случаи явно указаны.
- output/k8k-taskpack/task-051/acceptance.json: PASS/FAIL/NOT_RUN каждого критерия со ссылкой на fixture/HTTP/browser evidence.

Формат `output/k8k-tasks/TASK-051/report.md`:

```text
TASK: TASK-051
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

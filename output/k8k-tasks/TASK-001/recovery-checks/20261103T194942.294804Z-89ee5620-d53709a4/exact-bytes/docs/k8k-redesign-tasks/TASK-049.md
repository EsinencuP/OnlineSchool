# TASK-049 — Настоящая очередь задач на главной и корректные агрегаты CRM

**Пакет:** K8K-FRONTEND-REBUILD v1.0,03.11.2026. **Блок:** 5 — Менеджер и CRM. **Модуль:** Права, рабочая очередь и приоритет.

**Входные зависимости:** [TASK-048](TASK-048.md). Номер относится только к этому пакету, не к старым MGR/Phase0 TASK. **Учёт выполнения:** [EXECUTION_LOG](EXECUTION_LOG.md).

**Исходный статус:** Частично: dashboard показывает overdueTasks.top под заголовком «Мои задачи»; полный tasks endpoint с cursor/filter существует. upcomingLessons.length — ограниченный preview, не total.. Это описание кода на дату составления, не акт приёмки и не команда начать с нуля.

## 1. Команда AI-кодеру и результат

Выполни **только TASK-049** в существующем репозитории. Не начинай следующий TASK автоматически.

Сделать очередь разрешённых открытых задач главным рабочим модулем менеджера и привести каждый счётчик к реальному определению, не теряя текущие CRM процессы и фильтры.

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

- [docs/K8K_Academy_VIS12_dashboard_module_contracts_v1.0.md](../K8K_Academy_VIS12_dashboard_module_contracts_v1.0.md) — **MGR-01…07, особенно MGR-02; VIS-04/06/07**: Рабочая очередь первична, stable blocks.
- [docs/K8K_DESIGN_INSTRUCTIONS.md](../K8K_DESIGN_INSTRUCTIONS.md) — **§5.3; §2 UX-AUD-05/07**: Состав главной, реальные значения, без выдуманных дельт.
- [apps/api/src/modules/manager/tasks/MGR-07.md](../../apps/api/src/modules/manager/tasks/MGR-07.md) — **API и область доступа; Состояния и атомарность**: Типы, cursor30min, стабильный порядок и CAS.
- [docs/online_academy_manager_dashboard_decisions_2026_11_01.md](../online_academy_manager_dashboard_decisions_2026_11_01.md) — **Ожидание одобрения и подтверждённый остаток**: Pending financial aggregate definition.
- [docs/online_academy_manager_finance_distribution_clarification_2026_10_31.md](../online_academy_manager_finance_distribution_clarification_2026_10_31.md) — **п.1/5/7**: CUSTOMER_ADVANCE, mixed portfolio и раздельные валюты.

Реальные точки входа в код/доказательства (существуют на дату пакета; если структура позже изменена, найди symbol через `rg`, не создавай дубликат):

- [apps/manager-web/src/pages/Dashboard.tsx](../../apps/manager-web/src/pages/Dashboard.tsx).
- [apps/manager-web/src/pages/Tasks.tsx](../../apps/manager-web/src/pages/Tasks.tsx).
- [apps/api/src/modules/manager/dashboard/dashboard.sql.ts](../../apps/api/src/modules/manager/dashboard/dashboard.sql.ts).
- [apps/api/src/modules/manager/dashboard/manager-dashboard.service.ts](../../apps/api/src/modules/manager/dashboard/manager-dashboard.service.ts).
- [apps/api/src/modules/manager/dto/manager-dashboard.dto.ts](../../apps/api/src/modules/manager/dto/manager-dashboard.dto.ts).
- [apps/api/src/modules/manager/tasks/manager-tasks.service.ts](../../apps/api/src/modules/manager/tasks/manager-tasks.service.ts).
- [apps/api/src/modules/manager/tasks/task-cursor.ts](../../apps/api/src/modules/manager/tasks/task-cursor.ts).
- [apps/api/src/modules/manager/tasks/contracts.ts](../../apps/api/src/modules/manager/tasks/contracts.ts).
- [apps/manager-web/src/components/ui.tsx](../../apps/manager-web/src/components/ui.tsx).

Визуальная опора: [template/newtemp.png](../../template/newtemp.png) — язык дизайна, не требования и не источник mock-цифр. Старые [template/*.webp](../../template/README.md) — только исторические примеры.

Инструменты кодера: начинай поиск исходников с `rg`; версии/лицензии проверяй через `pnpm view` и текущий lockfile. Для библиотечных API используй доступный Context7/официальные документы нужной версии; для интерфейса — локальный Playwright/browser harness и проверку реального рендера. Сначала проверь доступность MCP, не считай запись сервера доказательством авторизации. Repo-инструменты и локальные fixtures остаются рабочим fallback. Figma/внешний дизайн-сервис не обязательны для восстановления этого контекста. Не подключай реальные аккаунты/провайдеры ради mock smoke и не подменяй ими ограничения среды.

Официальные справочные сайты по теме; бизнес-контекст уже дан выше, интернет не нужен для его восстановления. Перед использованием API/версии библиотеки сверяй первичную документацию именно совместимой версии. Наличие ссылки не требует установки пакета:

- [React 18.3.1](https://18.react.dev/reference/react) — API текущей major-версии; не обновлять проект до React19 по latest-примеру.
- [TanStack Query v5](https://tanstack.com/query/latest/docs/framework/react/overview) — Чтения, query keys, invalidation, cancellation; выбранную minor сверять с package.json.
- [WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/) — Рабочая accessibility-рамка; axe не заменяет ручные проверки.
- [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots) — Воспроизводимые снимки и контролируемые fixtures.
- [Orval](https://orval.dev/) — Генерация SDK только штатным способом проекта.
- [TanStack Table v8](https://tanstack.com/table/v8/docs/introduction) — Headless таблицы, server-controlled pagination/sort.

## 5. Предметные правила и сохранение поведения

- Мои задачи — вся разрешённая открытая очередь, а не только overdue subset. Просроченные имеют отдельную пометку/count; terminal status не overdue.
- Публичные OPEN/IN_PROGRESS/RESOLVED/REJECTED остаются действующими; ожидание внешнего/директора показывается approvalStatus/metadata, без самовольного нового DB status.
- Видимость задаётся текущим portfolio/assigned lead; task может иметь leadId и studentId=null. Не выдумывать student для lead-followup.
- Ограниченный список ближайших уроков не является school/portfolio total. Если full count нужен, получить его server snapshot либо подписать preview буквально.
- Ожидающие оплаты — source ledger/receipt aggregate по утверждённой методике: pending approval и confirmed unallocated residual, currency отдельно, receipt один раз, mixed-household исключён.
- Закрытие задачи не подтверждает контакт, оплату, урок или возврат; dashboard quick action ведёт к соответствующему предметному сценарию.

## 6. Контракты, данные и совместимость

- Существующий listManagerTasks возвращает items/nextCursor, не total. Новый count добавляется только сервером с документированной одинаковой фильтрацией; client items.length не выдаётся за total.
- Dashboard generatedAt — время согласованного read snapshot; existing lessonsHorizonHours24/48/168 и expiringDays3/7/14 сохраняют семантику.
- PendingPayments.count/totalsByCurrency не равны CUSTOMER_ADVANCE или remainingLessons; Decimal strings не складываются между валютами.
- Corrupt legacy payload может дать пустую страницу с nextCursor; UI не объявляет всю очередь пустой, пока продолжение существует. No-store/ACL/401/403 сохраняются.

Точные имена новых planned DTO/operation/props запиши в коротком design note этого TASK до реализации и соблюдай существующие namespace/style. Planned нельзя выдавать за уже существующий API. Найденный существующий сервис переиспользуй. Generic UI не принимает бизнес-решения. Существующий авторитетный источник не копируется во второй реестр.

## 7. Пошаговое выполнение

1. Подтверди prerequisites по реальным артефактам предыдущих TASK и текущему коду. Недостающий результат не заменяй заглушкой или флагом с фиктивными данными. Не пересылай пользователю уже закрытые вопросы о чате, уведомлениях или director-only подтверждениях.
2. Сопоставить Dashboard DTO, SQL и заголовки UI; составить словарь каждого показателя: источник, период, filters, limit/count semantics, обновление, detail link.
3. Подключить к главному модулю полный tasks source с OPEN,IN_PROGRESS, stable due_at/id и явной пагинацией. Overdue summary оставить отдельным доступным фильтром, не подменять им очередь.
4. При необходимости добавить общий count/short preview в dashboard read-model, используя тот же scope/filter predicate и согласованный read snapshot; не запускать отдельный client count по загруженным карточкам.
5. Сохранить cursor contract: filter/limit/manager binding, 30min expiry и snapshot now для overdue. При изменении фильтров сбрасывать cursor; неправильный/expired cursor объяснить и дать начало, не замалчивать.
6. Перестроить layout: зарезервированный priority slot TASK-050, центральная task queue, вторичные leads/contacts/renewals/teacher requests; один порядок на повторных reads.
7. Исправить misleading MyTasks count и visibleLessons total. Суммы/направления/сроки показывать точно и раздельно, без новых +6/week, fake online teachers или неработающих widgets.
8. Сохранить search Ctrl/Cmd+K и переходы task→lead/student/object; filters/scroll/dirty inputs не теряются от refresh. Метку freshness показывать на уровне операционного блока, не засорять каждую строку.
9. Добавить actor/object capabilities TASK-048 к quick actions, RU/RO labels и targeted contract/browser cases. Обновить matrix по реальной готовности каждого dashboard module.
10. Сверь итог с правилами разделов3/5/6 этого же файла, обнови журнал и предметную матрицу, подготовь артефакты и остановись после отчёта по TASK-049.

## 8. Обязательные сценарии проверки

- [ ] Неoverdue OPEN задача есть в главной очереди; overdue count не выдается за число всех задач.
- [ ] Lead-linked task с studentId=null открывает lead, обычная student task открывает ученика.
- [ ] Переключение status/type/overdue/student сбрасывает cursor; cursor другого менеджера/filter и expired cursor не принимаются.
- [ ] Preview10 из100 уроков подписан ограниченным списком либо server total100, но не показан как10 всех уроков.
- [ ] Pending/confirmed residual/fully allocated/reversed allocation cases дают утверждённый currency aggregate без double count.
- [ ] Mixed household и чужой recipient не раскрывают семейные суммы; portfolio revoked удаляет задачи.
- [ ] Refresh не переставляет блоки и не крадёт focus/scroll; loading/error/empty/stale и RU/RO различимы.

Для визуального изменения: RU/RO,360/768/1024/1280, keyboard/focus/long text и relevant VIS11 states. Для read-model/API: validation, own/foreign scope, revoked context, no-store, error/empty/unknown и совместимость SDK. Для мутации: CSRF/idempotency/revision/unknown-result и отсутствие двойного эффекта. Не добавляй бессмысленный тест, который просто повторяет строку implementation; доказывай поведение.

## 9. Команды и безопасные границы проверки

Рабочий каталог `D:/OnlineSchool`. Это адресные ориентиры из текущих manifests, а не разрешение слепо запускать все команды. Прочитай scripts/конфиг теста перед запуском. Сборка может генерировать Prisma/SDK; это не разрешение запускать migration/seed или подключать реальную БД. Dist-based tests выполнять после целевой сборки.

```powershell
pnpm test:mgr09
```

```powershell
pnpm test:mgr07
```

```powershell
pnpm --filter @online-school/manager-web typecheck
```

```powershell
pnpm --filter @online-school/manager-web test:unit
```

- Создать адресный browser grep actual-task-queue/dashboard-counts на local MSW fixtures.

Если нужен новый тестовый script, сначала добавь его в manifest с явно безопасным локальным/mock target, затем запусти и запиши точную команду. Не выполняй `pnpm test`/recursive regression автоматически на каждом TASK. Полный разрешённый прогон относится к финальному блоку. Ошибка не основание ослабить линтер или выдавать NOT_RUN за PASS.

## 10. Критерии готовности

- [ ] Главный модуль — реальная открытая очередь с переходами и pagination.
- [ ] Каждый счётчик имеет документированное определение и server source, preview не выдан за total.
- [ ] Финансовые aggregates соответствуют owner решению01.11 и не смешивают money/rights.
- [ ] Фильтры/cursor/session scopes сохранены и протестированы.
- [ ] Фиктивные widgets/дельты выключены, refresh не меняет структуру/ввод.

- [ ] Все использованные данные и действия имеют реальный авторитетный источник/проверку; нет выдуманных цифр, прав, кнопок и success.
- [ ] Отчёт различает исходный работающий код, новые изменения, свежие проверки и исторические доказательства.
- [ ] Не изменены рабочая БД, применённые migration checksums и production; необоснованные внешние эффекты отсутствуют.

## 11. Не входит в этот TASK

- Новые KPI/BI, новые денежные формулы, единый рейтинг сотрудников, произвольный новый SLA.
- Закрытие task одним dashboard click без выполнения предметного процесса.

Обнаруженный соседний gap запиши с конкретным следующим TASK, не расширяй текущую задачу на весь redesign. Если требуется реально новое бизнес-решение или недоступный внешний провайдер — подготовь все независимые изменения и точный вопрос/блокер только по этому пункту. Не останавливайся на повторном согласовании ранее утверждённых правил.

## 12. Артефакты и отчёт для следующего кодера

- output/k8k-taskpack/task-049/report.md: commit, исходные расхождения, изменения и целевые результаты; отсутствующее evidence = NOT_RUN.
- output/k8k-taskpack/task-049/acceptance.json: бинарные критерии со ссылками на unit/HTTP/browser evidence без PII/secrets.

Формат `output/k8k-tasks/TASK-049/report.md`:

```text
TASK: TASK-049
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

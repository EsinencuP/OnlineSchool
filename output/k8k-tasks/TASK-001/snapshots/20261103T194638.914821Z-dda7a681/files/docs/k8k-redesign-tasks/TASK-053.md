# TASK-053 — Полная серверная пагинация и согласованные фильтры доски заявок

**Пакет:** K8K-FRONTEND-REBUILD v1.0,03.11.2026. **Блок:** 5 — Менеджер и CRM. **Модуль:** Воронка заявок.

**Входные зависимости:** [TASK-048](TASK-048.md), [TASK-052](TASK-052.md). Номер относится только к этому пакету, не к старым MGR/Phase0 TASK. **Учёт выполнения:** [EXECUTION_LOG](EXECUTION_LOG.md).

**Исходный статус:** Частично: lead API имеет secure cursor/limit/filters и summary; текущая board UI фильтрует ограниченный общий page по стадиям. List DTO не несёт version, summary counts глобальны.. Это описание кода на дату составления, не акт приёмки и не команда начать с нуля.

## 1. Команда AI-кодеру и результат

Выполни **только TASK-053** в существующем репозитории. Не начинай следующий TASK автоматически.

Обеспечить честную доску с независимой пагинацией каждой стадии и counts от того же фильтра/portfolio, чтобы карточки не пропадали после первых100 и недоступные стадии не изображались пустыми.

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

- [apps/api/src/modules/manager/leads/MGR-11.md](../../apps/api/src/modules/manager/leads/MGR-11.md) — **API/scope; Summary; Утверждённые уточнения**: Публичные стадии, portfolio, версия, пробный и конверсия.
- [apps/api/src/modules/manager/dto/manager-lead.dto.ts](../../apps/api/src/modules/manager/dto/manager-lead.dto.ts) — **ListLeadsQueryDto; LeadListItemDto; LeadPageDto; LeadSummaryDto**: Фактические query/cursor и недостающая board-version.
- [docs/K8K_DESIGN_INSTRUCTIONS.md](../K8K_DESIGN_INSTRUCTIONS.md) — **§5.3 Канбан; §4 Таблицы/Перетаскивание**: Доска использует принятые стадии, данные не выдумываются.
- [docs/AI Coder Tasks — Модуль 2 — MGR-11.md](../AI%20Coder%20Tasks%20%E2%80%94%20%D0%9C%D0%BE%D0%B4%D1%83%D0%BB%D1%8C%202%20%E2%80%94%20MGR-11.md) — **Заявки/стадии/пагинация**: Инженерная база с приоритетом поздних owner уточнений.

Реальные точки входа в код/доказательства (существуют на дату пакета; если структура позже изменена, найди symbol через `rg`, не создавай дубликат):

- [apps/api/src/modules/manager/leads/manager-leads.service.ts](../../apps/api/src/modules/manager/leads/manager-leads.service.ts).
- [apps/api/src/modules/manager/leads/manager-leads.controller.ts](../../apps/api/src/modules/manager/leads/manager-leads.controller.ts).
- [apps/api/src/modules/manager/leads/lead-cursor.ts](../../apps/api/src/modules/manager/leads/lead-cursor.ts).
- [apps/api/src/modules/manager/leads/summary.sql.ts](../../apps/api/src/modules/manager/leads/summary.sql.ts).
- [apps/api/src/modules/manager/leads/policy.ts](../../apps/api/src/modules/manager/leads/policy.ts).
- [apps/api/src/modules/manager/dto/manager-lead.dto.ts](../../apps/api/src/modules/manager/dto/manager-lead.dto.ts).
- [apps/manager-web/src/pages/Leads.tsx](../../apps/manager-web/src/pages/Leads.tsx).
- [apps/manager-web/src/test/handlers.ts](../../apps/manager-web/src/test/handlers.ts).

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

- Доска не строится из одного общего limit100. Каждая стадия читает свой stage-filtered page/cursor и имеет явное продолжение.
- Публичные NEW/IN_PROGRESS/TRIAL/AWAITING_PAYMENT/CONVERTED/LOST сохраняют mapping существующего storage; учебный outcome пробного отдельный факт, не новая стадия.
- Cursor bound to manager+normalized filters+limit+server now, expiry30min; не переиспользовать cursor другой колонки, поиска или пользователя.
- Список и matching counts используют одинаковые search/source/subjectId/overdue predicates и temporal portfolio; matching totals не берутся из загруженных карточек.
- Existing summary conversion30dBp — cohort-created30days published-first-payment conversion, не новый Dashboard KPI и не рассчитанный по отфильтрованной одной странице процент.
- В list телефон masked, detail PII read audit сохраняется; duplicate contact warning не означает auto merge. Student/lead связываются явной identity link, не phone match.

## 6. Контракты, данные и совместимость

- Existing GET leads(stage/search/source/subjectId/overdue/cursor/limit) сохраняется. New additive list.version и summary.matchingCountsByStage не меняют прежнюю global summary semantics.
- Summary получает only validated base filters, без raw SQL search/managerId. Для пустой колонки items=[] и matchingCount0; source error не превращается в пустую стадию.
- Клиент не предполагает total из nextCursor/items.length. До API matching count отсутствующее значение обозначается unknown, не0.
- CAS version соответствует действительной строке; terminal transitions и trial scheduling остаются специализированными commands, version не даёт права произвольного stage PATCH.

Точные имена новых planned DTO/operation/props запиши в коротком design note этого TASK до реализации и соблюдай существующие namespace/style. Planned нельзя выдавать за уже существующий API. Найденный существующий сервис переиспользуй. Generic UI не принимает бизнес-решения. Существующий авторитетный источник не копируется во второй реестр.

## 7. Пошаговое выполнение

1. Подтверди prerequisites по реальным артефактам предыдущих TASK и текущему коду. Недостающий результат не заменяй заглушкой или флагом с фиктивными данными. Не пересылай пользователю уже закрытые вопросы о чате, уведомлениях или director-only подтверждениях.
2. Зафиксировать текущий board query и воспроизвести dataset>100 с неравномерными стадиями; показать, какие колонки сейчас выглядят ложно пустыми.
3. Использовать существующий list endpoint отдельно для каждой видимой стадии с собственным cursor. Не вводить лишний второй lead store; query keys включают stage и все фильтры.
4. Добавить version в LeadListItemDto как additive актуальную CAS версию, совместимую с detail. Подключить object allowed actions из TASK-048 для допустимых переходов.
5. Расширить summary query теми же базовыми search/source/subjectId/overdue фильтрами; добавить matchingCountsByStage. Existing global counts/conversion сохраняют старое определение и не переименовываются в filtered.
6. Установить semantics: matchingCountsByStage считает все стадии по базовому фильтру без stage restriction; UI выбранной стадии/набора решает только видимость колонок. Каждый column list дополнительно фильтрует конкретную stage.
7. Проверить encrypted cursor fingerprint/порядок created_at,id и reset при любом изменении base filters. Server scope актуализируется на каждом page; никакого обещания immutable database snapshot.
8. Обновить SDK и MSW fixtures с несколькими страницами в каждой стадии, matching totals, current version, null nextActionAt и awaiting payment.
9. Добавить unit/HTTP/query tests equality count/list predicates, two managers, expiry/cursor tamper, status change between pages. После проверки API отметить готовность для TASK-054, не выдавать отсутствие UI за готовую доску.
10. Сверь итог с правилами разделов3/5/6 этого же файла, обнови журнал и предметную матрицу, подготовь артефакты и остановись после отчёта по TASK-053.

## 8. Обязательные сценарии проверки

- [ ] >100leads,100 в NEW и20 в TRIAL: обе стадии читают свои данные и продолжение.
- [ ] Base filters одинаково ограничивают matching counts и column lists, global conversion не меняет definition.
- [ ] Cursor NEW нельзя использоватьTRIAL/другому manager/filter; expired/tampered422 отображается явно.
- [ ] Отзыв assignment между страницами исключает карточку; full raw phone не появляется в list.
- [ ] List/detail version совпадают; concurrent stage update делает старую version конфликтной.
- [ ] Status/null date/overdue semantics соответствуют API; no fabricated totals из loaded cards.
- [ ] Invalid UUID/unknown query/search bounds и server error не превращаются в пустую успешную доску.

Для визуального изменения: RU/RO,360/768/1024/1280, keyboard/focus/long text и relevant VIS11 states. Для read-model/API: validation, own/foreign scope, revoked context, no-store, error/empty/unknown и совместимость SDK. Для мутации: CSRF/idempotency/revision/unknown-result и отсутствие двойного эффекта. Не добавляй бессмысленный тест, который просто повторяет строку implementation; доказывай поведение.

## 9. Команды и безопасные границы проверки

Рабочий каталог `D:/OnlineSchool`. Это адресные ориентиры из текущих manifests, а не разрешение слепо запускать все команды. Прочитай scripts/конфиг теста перед запуском. Сборка может генерировать Prisma/SDK; это не разрешение запускать migration/seed или подключать реальную БД. Dist-based tests выполнять после целевой сборки.

```powershell
pnpm test:mgr11
```

```powershell
pnpm --filter @online-school/api typecheck
```

```powershell
pnpm --filter @online-school/manager-web typecheck
```

- Создать адресные mock unit/HTTP board-paging cases; без реальных lead inserts.

Если нужен новый тестовый script, сначала добавь его в manifest с явно безопасным локальным/mock target, затем запусти и запиши точную команду. Не выполняй `pnpm test`/recursive regression автоматически на каждом TASK. Полный разрешённый прогон относится к финальному блоку. Ошибка не основание ослабить линтер или выдавать NOT_RUN за PASS.

## 10. Критерии готовности

- [ ] Каждая колонка независимо paginated, ни одна не строится из урезанного общего page.
- [ ] Filtered matching counts имеют точное согласованное определение и backend tests.
- [ ] Secure cursor и version/action metadata проходят two-manager negative cases.
- [ ] Глобальная конверсия/summary не переопределены неполным UI фильтром.
- [ ] SDK/mocks включают multi-page/denied/error сценарии и готовы для keyboard/dnd UI.

- [ ] Все использованные данные и действия имеют реальный авторитетный источник/проверку; нет выдуманных цифр, прав, кнопок и success.
- [ ] Отчёт различает исходный работающий код, новые изменения, свежие проверки и исторические доказательства.
- [ ] Не изменены рабочая БД, применённые migration checksums и production; необоснованные внешние эффекты отсутствуют.

## 11. Не входит в этот TASK

- Новые стадии/definition конверсии, автоматический CONVERTED, слияние лидов по контакту.
- Виртуализация ради небольших списков и загрузка всех lead страниц одним bulk запросом.

Обнаруженный соседний gap запиши с конкретным следующим TASK, не расширяй текущую задачу на весь redesign. Если требуется реально новое бизнес-решение или недоступный внешний провайдер — подготовь все независимые изменения и точный вопрос/блокер только по этому пункту. Не останавливайся на повторном согласовании ранее утверждённых правил.

## 12. Артефакты и отчёт для следующего кодера

- output/k8k-taskpack/task-053/report.md: commit, изменения, команды и ограничения; отрицательные/непроверенные случаи явно указаны.
- output/k8k-taskpack/task-053/acceptance.json: PASS/FAIL/NOT_RUN каждого критерия со ссылкой на fixture/HTTP/browser evidence.

Формат `output/k8k-tasks/TASK-053/report.md`:

```text
TASK: TASK-053
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

# TASK-058 — Полная RU/RO локализация и приёмочный gate менеджерского кабинета

**Пакет:** K8K-FRONTEND-REBUILD v1.0,03.11.2026. **Блок:** 5 — Менеджер и CRM. **Модуль:** Локализация и приёмка CRM.

**Входные зависимости:** [TASK-048](TASK-048.md), [TASK-049](TASK-049.md), [TASK-050](TASK-050.md), [TASK-051](TASK-051.md), [TASK-052](TASK-052.md), [TASK-053](TASK-053.md), [TASK-054](TASK-054.md), [TASK-055](TASK-055.md), [TASK-056](TASK-056.md), [TASK-057](TASK-057.md). Номер относится только к этому пакету, не к старым MGR/Phase0 TASK. **Учёт выполнения:** [EXECUTION_LOG](EXECUTION_LOG.md).

**Исходный статус:** Не выполнено для нового scope: manager-web в основном импортирует ru; shared LanguageSelector уже существует, исторические MGR-10/MSW проверки не доказывают готовность новой CRM.. Это описание кода на дату составления, не акт приёмки и не команда начать с нуля.

## 1. Команда AI-кодеру и результат

Выполни **только TASK-058** в существующем репозитории. Не начинай следующий TASK автоматически.

Завершить RU/RO во всех CRM экранах и состояниях, затем проверить целостный путь менеджера с task queue, contact journal, board, абонементами и финансовыми предложениями, сохранив student-account secret handling.

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

- [docs/K8K_REDESIGN_PLAN.md](../K8K_REDESIGN_PLAN.md) — **Основание; этап5; приёмка**: Последнее решение: полный RU/RO и функциональный редизайн CRM.
- [docs/K8K_DESIGN_INSTRUCTIONS.md](../K8K_DESIGN_INSTRUCTIONS.md) — **§5.1/5.3; §6; §4 зависимости/бюджет**: Состояния, toolkit, реальные данные и accessibility.
- [docs/online_academy_manager_frontend_implementation_2026_11_01.md](../online_academy_manager_frontend_implementation_2026_11_01.md) — **Сохранённые решения и evidence boundaries**: Существующие рабочие формы/секреты/датировки; исторические тесты не новый gate.
- [apps/api/src/modules/manager/accounts/MGR-03.md](../../apps/api/src/modules/manager/accounts/MGR-03.md) — **Одноразовая выдача; Вход и уведомление**: Пароль только один раз, replay без секрета, temp72h и initial gate.
- [docs/online_academy_manager_notification_decisions_2026_11_01.md](../online_academy_manager_notification_decisions_2026_11_01.md) — **Системный FAILED и ручной422**: Не путать202/QUEUED/SENT и исходную бизнес-операцию.
- [PHASE0_CHECKS.md](../../PHASE0_CHECKS.md) — **Адресные проверки; одна рабочая mainDB**: Не запускать разрушительные/массовые suites на рабочей БД.

Реальные точки входа в код/доказательства (существуют на дату пакета; если структура позже изменена, найди symbol через `rg`, не создавай дубликат):

- [apps/manager-web/src/i18n/ru.ts](../../apps/manager-web/src/i18n/ru.ts).
- [apps/manager-web/src/i18n/error-messages.ts](../../apps/manager-web/src/i18n/error-messages.ts).
- [apps/manager-web/src/api/error-view.ts](../../apps/manager-web/src/api/error-view.ts).
- [apps/manager-web/src/components/ui.tsx](../../apps/manager-web/src/components/ui.tsx).
- [apps/manager-web/src/components/layout.tsx](../../apps/manager-web/src/components/layout.tsx).
- [apps/manager-web/src/pages/Account.tsx](../../apps/manager-web/src/pages/Account.tsx).
- [apps/manager-web/src/pages/student/Notifications.tsx](../../apps/manager-web/src/pages/student/Notifications.tsx).
- [apps/manager-web/src/test/forms.test.tsx](../../apps/manager-web/src/test/forms.test.tsx).
- [apps/manager-web/src/test/session.test.tsx](../../apps/manager-web/src/test/session.test.tsx).
- [apps/manager-web/playwright.config.mjs](../../apps/manager-web/playwright.config.mjs).
- [packages/ui/src/locale.tsx](../../packages/ui/src/locale.tsx).

Визуальная опора: [template/newtemp.png](../../template/newtemp.png) — язык дизайна, не требования и не источник mock-цифр. Старые [template/*.webp](../../template/README.md) — только исторические примеры.

Инструменты кодера: начинай поиск исходников с `rg`; версии/лицензии проверяй через `pnpm view` и текущий lockfile. Для библиотечных API используй доступный Context7/официальные документы нужной версии; для интерфейса — локальный Playwright/browser harness и проверку реального рендера. Сначала проверь доступность MCP, не считай запись сервера доказательством авторизации. Repo-инструменты и локальные fixtures остаются рабочим fallback. Figma/внешний дизайн-сервис не обязательны для восстановления этого контекста. Не подключай реальные аккаунты/провайдеры ради mock smoke и не подменяй ими ограничения среды.

Официальные справочные сайты по теме; бизнес-контекст уже дан выше, интернет не нужен для его восстановления. Перед использованием API/версии библиотеки сверяй первичную документацию именно совместимой версии. Наличие ссылки не требует установки пакета:

- [React 18.3.1](https://18.react.dev/reference/react) — API текущей major-версии; не обновлять проект до React19 по latest-примеру.
- [TanStack Query v5](https://tanstack.com/query/latest/docs/framework/react/overview) — Чтения, query keys, invalidation, cancellation; выбранную minor сверять с package.json.
- [WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/) — Рабочая accessibility-рамка; axe не заменяет ручные проверки.
- [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots) — Воспроизводимые снимки и контролируемые fixtures.
- [Orval](https://orval.dev/) — Генерация SDK только штатным способом проекта.
- [ECMA-402 / Intl](https://tc39.es/ecma402/) — Первичный стандарт форматирования locale; money representation по-прежнему точная строка/существующий Decimal.

## 5. Предметные правила и сохранение поведения

- RU/RO охватывают navigation/pages/forms/validation/errors/aria/title/empty/stale/pending/manual review, а не только общий переключатель. Имена/комментарии/filenames/исторические human messages не переводятся AI.
- Единый typed locale из packages/ui, без второго i18n store и нового framework. Форматы Intl зависят от locale, timezone из /manager/me, money остаётся exact Decimal string.
- Create/reset student-account показывает temporary password один раз в памяти отдельного экрана. Нет Query/Mutation cache, storage, URL, analytics, screenshots с настоящим секретом; уход/401/pagehide/late response стирают.
- Account first-payment gate использует опубликованное распределение и каждый partial admission отдельно; temp password72h/initial change policy и replay без секрета не заменяются удобным UI fallback.
- Системное уведомление без канала не откатывает business operation: dispatchFAILED/NO_DELIVERY_CHANNEL; ручное сообщение без выбранного канала422, без created dispatch.
- 202/QUEUED означает очередь, не доставлено. Provider failure не превращается в success/прочтение и не повторяет финансовую команду. Новые внешние автоматические организационные сообщения не вводятся.
- Приёмка нового CRM привязана к current commit/dirty snapshot, не copied MGR-10/phase2 метрикам. Fixture evidence не является PostgreSQL/real provider/MFA acceptance или FND-GATE.
- Одна рабочая Neon main: никаких destructive seed/reset/write tests/новой БД ради gate. UI флаг/legacy rollback сохраняются до общей владельческой приёмки.

## 6. Контракты, данные и совместимость

- Existing manager API/SDK payloads/empty responses/version/errors сохраняются; locale presentation не расширяет portfolio или permission. Новые read contracts048–057 проверяются вместе со SDK/mocks.
- ErrorView хранит безопасный code/status/requestId, а текст вычисляется из текущего locale. Не замораживать ru string внутри cached error и не использовать unknown raw message.
- Account create201/reset200/replay secret-null остаются; response secret не входит в shared query/mutation cache. Повторная выдача потерянного первого пароля — approved reset command, не client recovery.
- Manual/system notifications сохраняют разные no-channel results и queued lifecycle. Исторические stored тексты без template params остаются исходными, автоматический перевод/переписывание истории запрещены.
- Acceptance evidence указывает SHA,command,status,route/locale/viewport/state,путь артефакта,ограничение. Настоящие passwords/cookies/OTP/Meet/S3 URLs/PII в evidence не сохраняются.

Точные имена новых planned DTO/operation/props запиши в коротком design note этого TASK до реализации и соблюдай существующие namespace/style. Planned нельзя выдавать за уже существующий API. Найденный существующий сервис переиспользуй. Generic UI не принимает бизнес-решения. Существующий авторитетный источник не копируется во второй реестр.

## 7. Пошаговое выполнение

1. Подтверди prerequisites по реальным артефактам предыдущих TASK и текущему коду. Недостающий результат не заменяй заглушкой или флагом с фиктивными данными. Не пересылай пользователю уже закрытые вопросы о чате, уведомлениях или director-only подтверждениях.
2. Составить coverage всех manager routes/tabs/forms/errors и их actions: dashboard/tasks/leads/student/cards/account/schedule/subscriptions/payments/notifications/contact-log/priority. Каждому дать RU/RO ключ и тест state.
3. Заменить статические ru/label imports на существующий shared typed locale/адаптер и dictionary parity. Перевести ErrorView по code в момент рендера, чтобы смена языка переводила уже показанную ошибку без новой команды.
4. Сохранить безопасный requestId и conflict/existingId actions, не показывать raw server message/SQL/private notes. RU/RO missing-key проверка должна падать адресным тестом, не подставлять случайный английский.
5. Проверить money/time utilities: precision1–4, большие Decimal, разные legacy currencies, DST/date-only и RO plurals. Не преобразовывать money в Number ради Intl.
6. Перенести account issuance/reset screen и manual notification forms на доступные shared controls, сохранив sensitive local lifetime, pending/unknown, stable intent и current actions TASK-048.
7. Подготовить отдельный fixture gate config/output дляTASK-058, чтобы не перезаписать исторические output/mgr10. Внешняя сеть закрыта, MSW typed contracts отражают production permissions и не дают manager director powers.
8. Пройти browser путь lead→claim→trial/skip→contact log→payment proposal→director-pending→ready distribution→subscription→task/dispute/schedule exception, а student account выдачу проверить только синтетическим секретом.
9. Проверить cross-tab user/session switch, portfolio revocation,403 с cached data,409 с вводом, late response и unknown command; затем keyboard/skip/Escape/focus/200%zoom/reduced-motion на360/768/1024/1280 для обоих языков.
10. Запустить адресные unit/HTTP/SDK и UI suites, axe+manual checks, route bundle gzip+fonts. Перепроверить каждую задачу048–057 и каждый DASH-MGR-01…07; missing mandatory source = blocking, не готовность скрытого флага.
11. Выпустить отчёт текущих PASS/FAIL/NOT_RUN, source/evidence matrix и конкретные rollout blockers. Не делать merge/deploy/удаление legacy и не закрывать legal/provider/foundation gates этой задачей.
12. Сверь итог с правилами разделов3/5/6 этого же файла, обнови журнал и предметную матрицу, подготовь артефакты и остановись после отчёта по TASK-058.

## 8. Обязательные сценарии проверки

- [ ] RU↔RO переводит все routes/tabs/forms/errors/aria/title, включая already-visible conflict и pending director labels; reload/cross-tab choice един.
- [ ] Создание/reset аккаунта показывают synthetic secret один раз; replay/null, route exit/pagehide/401/late response не восстанавливают его.
- [ ] Нет payment allocation/admission → account creation blocked; partial permission отдельное; full payment не дублирует rights.
- [ ] Системный no-channel dispatchFAILED при successful original operation, manualno-channel422;202 не отображается как SENT.
- [ ] Task queue/priority/contact-log/board per-stage paging и keyboard movement работают по настоящим capabilities без director execution.
- [ ] Subscription freeze/renew/partial payments/full-vsmanual dispute/schedule exceptions проходят source-specific negative cases.
- [ ] 403 cached data и revoked portfolio скрываются;409 сохраняет ввод;unknown не автоматически повторяет новый intent.
- [ ] Decimal600.1234/large amounts/legacyEUR и ChisinauDST даты отображаются точно вRU/RO.
- [ ] Keyboard/screen reader/touch/200%zoom/long text и четыре ширины без overflow; automatedaxe не заменяет ручной итог.
- [ ] Budget всех manager route graphs <=250KiB по общему методу; actual measurements заменяют исторические87/146KiB, fixtures не выданы за real DB/provider pass.

Для визуального изменения: RU/RO,360/768/1024/1280, keyboard/focus/long text и relevant VIS11 states. Для read-model/API: validation, own/foreign scope, revoked context, no-store, error/empty/unknown и совместимость SDK. Для мутации: CSRF/idempotency/revision/unknown-result и отсутствие двойного эффекта. Не добавляй бессмысленный тест, который просто повторяет строку implementation; доказывай поведение.

## 9. Команды и безопасные границы проверки

Рабочий каталог `D:/OnlineSchool`. Это адресные ориентиры из текущих manifests, а не разрешение слепо запускать все команды. Прочитай scripts/конфиг теста перед запуском. Сборка может генерировать Prisma/SDK; это не разрешение запускать migration/seed или подключать реальную БД. Dist-based tests выполнять после целевой сборки.

```powershell
pnpm --filter @online-school/manager-web typecheck
```

```powershell
pnpm --filter @online-school/manager-web lint
```

```powershell
pnpm --filter @online-school/manager-web test:unit
```

```powershell
pnpm --filter @online-school/manager-web build
```

```powershell
pnpm test:mgr03
```

```powershell
pnpm test:mgr08
```

- Создать test:k8k-manager-gate с отдельным Playwright output и fixture-only network, включив новые048–057; общий recursive regression отложен к финалу taskpack.

Если нужен новый тестовый script, сначала добавь его в manifest с явно безопасным локальным/mock target, затем запусти и запиши точную команду. Не выполняй `pnpm test`/recursive regression автоматически на каждом TASK. Полный разрешённый прогон относится к финальному блоку. Ошибка не основание ослабить линтер или выдавать NOT_RUN за PASS.

## 10. Критерии готовности

- [ ] Все manager страницы и девять state classes имеют полный RU/RO и проверку словарей без смешения UI языков.
- [ ] Одноразовая выдача секрета, session/portfolio/scope/idempotency/unknown-result invariants не нарушены.
- [ ] Все задачи048–057 и DASH-MGR-01…07 имеют реальный источник/основной и отрицательный сценарий; обязательные missingAPI явно блокируют готовность.
- [ ] Financial proposals/approval/admission/manual review и notification lifecycle не объявляются исполненными раньше server facts.
- [ ] Четыре viewport/оба языка/accessibility/route budget подтверждены новыми воспроизводимыми артефактами текущей версии.
- [ ] Итоговый CRM gate отделён от общего recursive release/FND-GATE/legal/provider approval и не выполняет rollout автоматически.

- [ ] Все использованные данные и действия имеют реальный авторитетный источник/проверку; нет выдуманных цифр, прав, кнопок и success.
- [ ] Отчёт различает исходный работающий код, новые изменения, свежие проверки и исторические доказательства.
- [ ] Не изменены рабочая БД, применённые migration checksums и production; необоснованные внешние эффекты отсутствуют.

## 11. Не входит в этот TASK

- Новые бизнес-правила, auth framework, автоперевод пользовательского текста, смена ролей/прав ради прохождения теста.
- Реальная внешняя отправка, financial writes, destructive mainDB suites, общая академическая приёмка/merge/deploy.

Обнаруженный соседний gap запиши с конкретным следующим TASK, не расширяй текущую задачу на весь redesign. Если требуется реально новое бизнес-решение или недоступный внешний провайдер — подготовь все независимые изменения и точный вопрос/блокер только по этому пункту. Не останавливайся на повторном согласовании ранее утверждённых правил.

## 12. Артефакты и отчёт для следующего кодера

- output/k8k-taskpack/task-058/report.md: commit, coverageRU/RO, route/state matrix, commands/results и blockers.
- output/k8k-taskpack/task-058/acceptance.json: все048–057 и DASH-MGR-01…07 с PASS/FAIL/NOT_RUN и evidence текущей сборки.
- output/k8k-taskpack/task-058/browser/: screenshots/axe/manual checklist/bundle measurements без PII, настоящих секретов и signed URLs.

Формат `output/k8k-tasks/TASK-058/report.md`:

```text
TASK: TASK-058
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

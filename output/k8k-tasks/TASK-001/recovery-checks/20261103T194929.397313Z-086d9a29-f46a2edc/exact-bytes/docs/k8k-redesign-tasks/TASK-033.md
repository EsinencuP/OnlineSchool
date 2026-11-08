# TASK-033 — Колокольчик событий: завершение пагинации, прочтения и переходов

**Пакет:** K8K-FRONTEND-REBUILD v1.0,03.11.2026. **Блок:** 3 — Кабинет ученика. **Модуль:** События, локализация и приёмка.

**Входные зависимости:** [TASK-032](TASK-032.md). Номер относится только к этому пакету, не к старым MGR/Phase0 TASK. **Учёт выполнения:** [EXECUTION_LOG](EXECUTION_LOG.md).

**Исходный статус:** Частично реализовано root: поповер имеет pages/read-all, /notifications в K8K ведёт на /student?events=1, report deep link добавлен. Требуются полная локализация/доступность, актуальные scope/late-response сценарии и источники без вымышленных событий.. Это описание кода на дату составления, не акт приёмки и не команда начать с нуля.

## 1. Команда AI-кодеру и результат

Выполни **только TASK-033** в существующем репозитории. Не начинай следующий TASK автоматически.

Довести единственный колокольчик ученика до завершённого рабочего сценария: увидеть событие, открыть исходный объект, явно отметить прочтение и сохранить правильный счётчик без отдельного центра уведомлений.

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

- [docs/K8K_Academy_VIS12_dashboard_module_contracts_v1.0.md](../K8K_Academy_VIS12_dashboard_module_contracts_v1.0.md) — **STU-06; V12-AT-04/08/10/11**: Колокольчик, прочтение не действие, дедупликация.
- [docs/K8K_DESIGN_INSTRUCTIONS.md](../K8K_DESIGN_INSTRUCTIONS.md) — **§2 п.2; §5.1 п.3; §5.2 DASH-STU-06**: Нет карточки уведомлений и внешних автонапоминаний.
- [apps/api/src/student/notifications/README.md](../../apps/api/src/student/notifications/README.md) — **Контракт; Создание из бизнес-фактов; Хранение и проверка**: Scopes, read semantics, event sources, unread count.
- [apps/api/src/student/notifications/notifications.dto.ts](../../apps/api/src/student/notifications/notifications.dto.ts) — **NOTIFICATION_TYPES; NotificationItemDto**: Текущий enum шире исторического README; не удалять рабочие типы.
- [docs/K8K_IMPLEMENTATION_STATUS.md](../K8K_IMPLEMENTATION_STATUS.md) — **Реализовано: колокольчик/legacy redirect**: Не создавать заново выполненную пагинацию и редирект.

Реальные точки входа в код/доказательства (существуют на дату пакета; если структура позже изменена, найди symbol через `rg`, не создавай дубликат):

- [apps/student-cabinet/src/StudentNotificationMenu.tsx](../../apps/student-cabinet/src/StudentNotificationMenu.tsx).
- [apps/student-cabinet/src/student-presentation.ts](../../apps/student-cabinet/src/student-presentation.ts).
- [apps/student-cabinet/src/router.tsx](../../apps/student-cabinet/src/router.tsx).
- [apps/student-cabinet/src/pages/Learning.tsx](../../apps/student-cabinet/src/pages/Learning.tsx).
- [apps/student-cabinet/src/Layout.tsx](../../apps/student-cabinet/src/Layout.tsx).
- [apps/api/src/student/notifications/notifications.dto.ts](../../apps/api/src/student/notifications/notifications.dto.ts).
- [apps/api/src/student/notifications/notifications.service.ts](../../apps/api/src/student/notifications/notifications.service.ts).
- [apps/student-cabinet/tests/k8k-presentation.test.mjs](../../apps/student-cabinet/tests/k8k-presentation.test.mjs).
- [packages/ui/src/locale.tsx](../../packages/ui/src/locale.tsx).

Визуальная опора: [template/newtemp.png](../../template/newtemp.png) — язык дизайна, не требования и не источник mock-цифр. Старые [template/*.webp](../../template/README.md) — только исторические примеры.

Инструменты кодера: начинай поиск исходников с `rg`; версии/лицензии проверяй через `pnpm view` и текущий lockfile. Для библиотечных API используй доступный Context7/официальные документы нужной версии; для интерфейса — локальный Playwright/browser harness и проверку реального рендера. Сначала проверь доступность MCP, не считай запись сервера доказательством авторизации. Repo-инструменты и локальные fixtures остаются рабочим fallback. Figma/внешний дизайн-сервис не обязательны для восстановления этого контекста. Не подключай реальные аккаунты/провайдеры ради mock smoke и не подменяй ими ограничения среды.

Официальные справочные сайты по теме; бизнес-контекст уже дан выше, интернет не нужен для его восстановления. Перед использованием API/версии библиотеки сверяй первичную документацию именно совместимой версии. Наличие ссылки не требует установки пакета:

- [React 18.3.1](https://18.react.dev/reference/react) — API текущей major-версии; не обновлять проект до React19 по latest-примеру.
- [TanStack Query v5](https://tanstack.com/query/latest/docs/framework/react/overview) — Чтения, query keys, invalidation, cancellation; выбранную minor сверять с package.json.
- [WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/) — Рабочая accessibility-рамка; axe не заменяет ручные проверки.
- [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots) — Воспроизводимые снимки и контролируемые fixtures.
- [Orval](https://orval.dev/) — Генерация SDK только штатным способом проекта.

## 5. Предметные правила и сохранение поведения

- В новом виде события открываются только из колокольчика/его drawer. Legacy URL сохраняет совместимость через уже добавленный redirect; запрещённый самостоятельный центр и dashboard notification card не возвращаются.
- Счётчик означает unreadCount всех видимых событий, не число непрочитанных на текущей странице. Не подменять unavailable counter нулём; empty page может иметь ненулевой total.
- Прочтение уведомления не означает прочтение отчёта, выполнение ДЗ, подтверждение платежа, contact delivery или решение CRM задачи. Эти команды и факты остаются раздельными.
- POST read-all и PATCH read принимают пустой body и возвращают204; first read_at неизменяем. Повтор того же read-all key не поглощает новые события после исходной команды.
- Текущий enum содержит расширения после раннего STU-10: его нельзя сжать до исторических7 типов. Не добавлять произвольный HOMEWORK_ASSIGNED/manual chat источник без отдельного принятого процесса.
- Payload даёт только публичные entity IDs, не Meet/S3 URLs, private notes, денежные суммы других людей. Ссылка по UUID ведёт в существующий scoped object route, не использует произвольный payload.url.
- RU/RO переводит UI и системные шаблоны; пользовательский текст approved MANUAL_MESSAGE сохраняется исходным и не считается общим чатом. Внешние автоматические сообщения семье не вводятся.

## 6. Контракты, данные и совместимость

- Существующие GET notifications list/count, POST read-all и PATCH :id/read сохраняются; no-store, scopes, pageSize bounds и пустые mutation bodies. Planned optional locale query строго ru|ro, неизвестные поля по-прежнему400.
- Locale меняет только представление существующих системных catalog templates с полными публичными params. Исторический готовый текст без template key/params и human MANUAL_MESSAGE остаётся исходным; read_at/event_key/payload не меняются, новая запись для перевода не создаётся.
- NOTIFICATION_TYPES актуального DTO — источник типов; для каждого поддержанного вида target определяется наличием документированного entity ID, неизвестный тип безопасно отображается без command.
- Global transport обрабатывает401/402/403; target object проверяет собственный scope. Наличие notificationId/reportId само по себе не даёт capability и не означает права на опубликованный отчёт.

Точные имена новых planned DTO/operation/props запиши в коротком design note этого TASK до реализации и соблюдай существующие namespace/style. Planned нельзя выдавать за уже существующий API. Найденный существующий сервис переиспользуй. Generic UI не принимает бизнес-решения. Существующий авторитетный источник не копируется во второй реестр.

## 7. Пошаговое выполнение

1. Подтверди prerequisites по реальным артефактам предыдущих TASK и текущему коду. Недостающий результат не заменяй заглушкой или флагом с фиктивными данными. Не пересылай пользователю уже закрытые вопросы о чате, уведомлениях или director-only подтверждениях.
2. Сохранить внесённые root pages/read-all и legacy redirect, проанализировать race открытого details с events=1/searchParams. Закрытие удаляет только events, не subjectId/reportId/другие параметры страницы.
3. Сделать колокольчик доступным Popover/Drawer общего kit: корректное имя/count, Escape/outside/возврат фокуса, внутренний scroll на маленькой высоте, заголовок и pagination без перекрытия bottom nav.
4. Ограничить загрузку preview состоянием open; count остаётся отдельным лёгким read. По page change не показывать предыдущие строки как новые, не считать loading=empty и не терять server total.
5. Использовать existing mark/read-all intent и empty-response transport; после успешного ответа invalidation обновляет count и все preview pages. Pending/unknown не отмечать визуально как прочитано до проверки.
6. Завершить target mapping: lessonId, homeworkId, reportId с TASK-032, subscriptionId с TASK-026; валидировать UUID и соответствующий тип. Событие без разрешённого target остаётся читаемым без ложной ссылки.
7. Добавить RU/RO словари UI/aria и системных типов. Для существующих catalog templates+params добавить optional locale=ru|ro в GET list (default ru, query key включает locale). Исторический готовый текст без template key/params показывать исходным: без AI-перевода/эвристик и без переписывания inbox.
8. Сохранить человеческий текст MANUAL_MESSAGE как исходный; недостающие template params не восстанавливать из приватных полей или caption. Новое поле локали только read projection и не создаёт notification sources.
9. Обработать vanished/expired/foreign target: исходный API авторизует переход, UI сообщает unavailable без существования чужого объекта. При смене сессии/count error late response не воскресит прежний список.
10. Проверить fixtures concurrent event/read-all, второй page, legacy deep link, report beyondpage1, stale и два языка. Обновить matrix/evidence только новыми результатами.
11. Сверь итог с правилами разделов3/5/6 этого же файла, обнови журнал и предметную матрицу, подготовь артефакты и остановись после отчёта по TASK-033.

## 8. Обязательные сценарии проверки

- [ ] Legacy /notifications в K8K открывает именно колокольчик; reload/back/close не создают redirect loop.
- [ ] Page2, empty beyond-end, stale и ошибка count различимы; global unread не равен unread текущей страницы.
- [ ] Read-all204 обновляет оба счётчика; повтор same key не отмечает новое событие, пришедшее позже.
- [ ] Событие REPORT_READY открывает старый разрешённый отчёт независимо отpage1; read notification не меняет report isNew.
- [ ] Invalid UUID/javascript:payload URL/private foreign target не создаёт unsafe href и не раскрывает объект.
- [ ] Все актуальные типы enum сохраняют совместимость; unsupported source не генерируется ради screenshots.
- [ ] RU/RO UI/catalog templates, исторический ready text без params и human message сохраняют исходный текст; long body/360px без overflow.
- [ ] ESC/outside/focus return, закрытая preview загрузка и session switch/late response не оставляют приватных сообщений.

Для визуального изменения: RU/RO,360/768/1024/1280, keyboard/focus/long text и relevant VIS11 states. Для read-model/API: validation, own/foreign scope, revoked context, no-store, error/empty/unknown и совместимость SDK. Для мутации: CSRF/idempotency/revision/unknown-result и отсутствие двойного эффекта. Не добавляй бессмысленный тест, который просто повторяет строку implementation; доказывай поведение.

## 9. Команды и безопасные границы проверки

Рабочий каталог `D:/OnlineSchool`. Это адресные ориентиры из текущих manifests, а не разрешение слепо запускать все команды. Прочитай scripts/конфиг теста перед запуском. Сборка может генерировать Prisma/SDK; это не разрешение запускать migration/seed или подключать реальную БД. Dist-based tests выполнять после целевой сборки.

```powershell
pnpm test:stu10
```

```powershell
pnpm --filter @online-school/student-cabinet test:presentation
```

```powershell
pnpm --filter @online-school/student-cabinet typecheck
```

```powershell
pnpm --filter @online-school/student-cabinet lint
```

- Создать адресный Playwright grep bell/locales/race на synthetic fixtures; без отправки внешних сообщений.

Если нужен новый тестовый script, сначала добавь его в manifest с явно безопасным локальным/mock target, затем запусти и запиши точную команду. Не выполняй `pnpm test`/recursive regression автоматически на каждом TASK. Полный разрешённый прогон относится к финальному блоку. Ошибка не основание ослабить линтер или выдавать NOT_RUN за PASS.

## 10. Критерии готовности

- [ ] У ученика один bell/drawer, нет нового notification center и dashboard card.
- [ ] Пагинация/count/read-all работают на полном server scope, без ложных zero/total.
- [ ] У каждого доступного target проверенный маршрут; отсутствующий target не подменён ссылкой.
- [ ] Прочтение события не выполняет учебные/финансовые/CRM операции.
- [ ] RU/RO UI/catalog templates доступны; historical free text остаётся исходным, persisted source/read факты не меняются.
- [ ] Сессия, stale, empty-response и concurrent read-all cases подтверждены адресными тестами.

- [ ] Все использованные данные и действия имеют реальный авторитетный источник/проверку; нет выдуманных цифр, прав, кнопок и success.
- [ ] Отчёт различает исходный работающий код, новые изменения, свежие проверки и исторические доказательства.
- [ ] Не изменены рабочая БД, применённые migration checksums и production; необоснованные внешние эффекты отсутствуют.

## 11. Не входит в этот TASK

- Новые каталоги/приоритеты событий, SMS/email/мессенджер-авторассылка, chat, пуши/Realtime SLA.
- Сброс read_at, ретроспективный backfill inbox, превращение MANUAL_MESSAGE в общий диалог.

Обнаруженный соседний gap запиши с конкретным следующим TASK, не расширяй текущую задачу на весь redesign. Если требуется реально новое бизнес-решение или недоступный внешний провайдер — подготовь все независимые изменения и точный вопрос/блокер только по этому пункту. Не останавливайся на повторном согласовании ранее утверждённых правил.

## 12. Артефакты и отчёт для следующего кодера

- output/k8k-taskpack/task-033/report.md: исходное состояние, commit/dirty diff, команды, результаты и оставшиеся ограничения.
- output/k8k-taskpack/task-033/acceptance.json: бинарные критерии и доказательства текущей версии; screenshots и accessibility вывод без секретов/URL.

Формат `output/k8k-tasks/TASK-033/report.md`:

```text
TASK: TASK-033
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

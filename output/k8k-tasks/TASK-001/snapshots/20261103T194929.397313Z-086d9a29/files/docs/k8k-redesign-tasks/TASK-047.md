# TASK-047 — TEACHER-GATE: сквозная функциональная, RU/RO и K8K-приёмка кабинета преподавателя

**Пакет:** K8K-FRONTEND-REBUILD v1.0,03.11.2026. **Блок:** 4 — Рабочий кабинет преподавателя. **Модуль:** Личные данные работы, коммуникации и приёмка.

**Входные зависимости:** [TASK-036](TASK-036.md), [TASK-037](TASK-037.md), [TASK-038](TASK-038.md), [TASK-039](TASK-039.md), [TASK-040](TASK-040.md), [TASK-041](TASK-041.md), [TASK-042](TASK-042.md), [TASK-043](TASK-043.md), [TASK-044](TASK-044.md), [TASK-045](TASK-045.md), [TASK-046](TASK-046.md). Номер относится только к этому пакету, не к старым MGR/Phase0 TASK. **Учёт выполнения:** [EXECUTION_LOG](EXECUTION_LOG.md).

**Исходный статус:** Полный teacher gate отсутствует: имеющийся platform smoke подтверждал read-only workspace/demo switching. Student targeted suites существуют, но не доказывают готовность teacher write workflows. FND-GATE/рабочая PostgreSQL concurrency и юридические зависимости остаются отдельными открытыми воротами.. Это описание кода на дату составления, не акт приёмки и не команда начать с нуля.

## 1. Команда AI-кодеру и результат

Выполни **только TASK-047** в существующем репозитории. Не начинай следующий TASK автоматически.

Принять весь teacher инкремент по реальным пользовательским сценариям и источникам: урок→результат→ДЗ→проверка→навыки4→отчёт8→student read/PDF, собственная ведомость и обращения; проверить RU/RO, изоляцию, accessibility и бюджет без подмены gate красивыми снимками.

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

- [docs/K8K_DESIGN_INSTRUCTIONS.md](../K8K_DESIGN_INSTRUCTIONS.md) — **2,3,5.1,5.4,6**: Запреты шаблона, K8K tokens/states и критерии дизайн-приёмки
- [docs/K8K_Academy_VIS12_dashboard_module_contracts_v1.0.md](../K8K_Academy_VIS12_dashboard_module_contracts_v1.0.md) — **3; общие правила**: Базовый teacher набор и авторитетные источники модулей
- [docs/online_academy_MVP_full_release_architecture_roadmap_v9.7.md](../online_academy_MVP_full_release_architecture_roadmap_v9.7.md) — **41:MVP-IMPL-01/B; TCH-E2E-01…**: Порядок STUDENT→TEACHER→CRM и evidence/retest
- [PHASE0_CHECKS.md](../../PHASE0_CHECKS.md) — **Текущая среда и адресные проверки**: Не создавать QA БД и не проводить destructive suites на Neon main
- [docs/online_academy_CON_01_11_owner_decisions_addendum_v1.0.md](../online_academy_CON_01_11_owner_decisions_addendum_v1.0.md) — **2–6**: Оплата/ставка/4/8/ручное семейное информирование
- [docs/platform_account_switching_2026_11_01.md](../platform_account_switching_2026_11_01.md) — **Demo switch/session revocation**: Очистка между аккаунтами и отличие demo от real finance

Реальные точки входа в код/доказательства (существуют на дату пакета; если структура позже изменена, найди symbol через `rg`, не создавай дубликат):

- [apps/platform/src/App.tsx](../../apps/platform/src/App.tsx).
- [apps/platform/src/style.css](../../apps/platform/src/style.css).
- [packages/ui/src/tokens.css](../../packages/ui/src/tokens.css).
- [packages/account-ui/src/index.tsx](../../packages/account-ui/src/index.tsx).
- [playwright.config.mjs](../../playwright.config.mjs).
- [tests/unit/platform-switch-http.test.mjs](../../tests/unit/platform-switch-http.test.mjs).
- [tests/unit/rates.test.mjs](../../tests/unit/rates.test.mjs).
- [tests/unit/student-homework.test.mjs](../../tests/unit/student-homework.test.mjs).
- [tests/unit/student-skills.test.mjs](../../tests/unit/student-skills.test.mjs).
- [tests/unit/student-reports.test.mjs](../../tests/unit/student-reports.test.mjs).
- [tests/FOUNDATION_STATUS.json](../../tests/FOUNDATION_STATUS.json).

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

- TEACHER-GATE не равен FND-GATE, release GO, Google POC/OAuth acceptance или юридической сертификации; статусы выводить отдельно и доказательно.
- Выполнять scoped набор teacher и regression затронутых student/common потоков; полный рекурсивный прогон не повторять после каждой карточки задачи.
- Для writes использовать безопасные in-process/fake adapters/browser fixture servers; запретить случайное подключение тестов к рабочей Neon и реальные выплаты/рассылки.
- Real-origin smoke только разрешённое чтение существующих данных; demo account switching сохраняет собственные guards и не повышает роль произвольного пользователя.
- Каждый критерий связан с актуальным источником/Task ID и проверяемым результатом; скриншот/axe score сам по себе не доказывает сохранность бизнес-правил.
- RU и RO — рабочие интерфейсы: статусы, ошибки, формы, даты, focus и пустые состояния проверяются в обоих; содержимое педагогических работ не переводить автоматически.
- Незакрытый retro4/8, отсутствующий provider/legal evidence или disabled модуль честно отмечаются blocked/deferred, а не выдаются за пройденный функционал.
- Нельзя удалить старое teacher представление/flag до успешной приёмки нового набора и понятного rollback; чужие незакоммиченные изменения сохранять.

## 6. Контракты, данные и совместимость

- Публичные teacher API/DTO/SDK к концу блока согласованы между TASK-036…046; acceptance suite проверяет фактические I/O, отсутствие ручного fetch/изменённых generated-файлов и работу единого транспорта.
- Тестовые adapters не могут обращаться к Neon main/write-провайдерам. Любой live smoke имеет явный read-only whitelist, origin и отсутствие секретов в evidence.
- Gate report содержит commit/worktree состояния, язык/viewport/role, status каждого case и ссылку на evidence; нельзя импортировать старые чужие успешные результаты как новые.
- Feature flags скрывают условные/неподтверждённые возможности; отсутствие source API не представляется stub success. Foundation metadata/capabilities/states одинаковы во всех teacher потоках.
- Нет новых бизнес-правил на этапе приёмки: выявленный конфликт фиксируется дефектом к источнику/Task, а открытый product/legal выбор остаётся отдельным gate.

Точные имена новых planned DTO/operation/props запиши в коротком design note этого TASK до реализации и соблюдай существующие namespace/style. Planned нельзя выдавать за уже существующий API. Найденный существующий сервис переиспользуй. Generic UI не принимает бизнес-решения. Существующий авторитетный источник не копируется во второй реестр.

## 7. Пошаговое выполнение

1. Подтверди prerequisites по реальным артефактам предыдущих TASK и текущему коду. Недостающий результат не заменяй заглушкой или флагом с фиктивными данными. Не пересылай пользователю уже закрытые вопросы о чате, уведомлениях или director-only подтверждениях.
2. Собрать traceability matrix TASK-036…046 → requirement/VIS12 module → API/role → browser/unit/HTTP case → evidence → дефект/retest, включая скрытые условные модули и открытые зависимости.
3. Проверить teacher workflows на обеих локалях и в активном/пустом/stale/error/forbidden/expired/unknown states; отсутствующие fixture cases добавить в планируемый отдельный teacher acceptance suite.
4. Пройти расписание/detail/start/outcome24ч с fake-clock, own/foreign/revoke и no-paid-access сценариями; подтвердить, что Meet click не создаёт attendance/зарплату.
5. Пройти teacher issue→student autosave/submit→teacher review→student correction→accepted; проверить версии, скрытость draft, файлы и все context-preserving переходы.
6. Пройти confirmed lesson4/8→skill assessment/goal→explicit snapshot/report publish→student map/report/PDF; correction draft не скрывает предыдущую публикацию, retro mismatch корректно gated.
7. Проверить own payroll/rate periods и notifications/appeals, server capabilities, точность decimal, mark-read≠resolved, source/task dedup и отсутствие внешней семейной отправки.
8. Снять целевые baseline/after render360/768/1024/1280; проверить keyboard, screen-reader sample, zoom200%, focus restoration, contrast, reduced-motion и длинные RO строки.
9. Измерить teacher route gzip budget≤250КиБ и доступность без добавления облачного сервиса; при провале найти источник, исправить и повторить только затронутые checks.
10. Зафиксировать безопасные команды/versions/вывод, оставшиеся непроверенные DB/Meet/правовые сценарии. Присвоить gate PASS только при выполнении определённого набора, иначе PARTIAL/BLOCKED с конкретным перечнем.
11. Сформировать reviewable teacher diff и rollback flags; завершение блока само по себе не разрешает merge/deploy.
12. Сверь итог с правилами разделов3/5/6 этого же файла, обнови журнал и предметную матрицу, подготовь артефакты и остановись после отчёта по TASK-047.

## 8. Обязательные сценарии проверки

- [ ] Полный teacher/student учебный цикл на RU и RO с версионным ДЗ, качественным прогрессом и опубликованным8-отчётом.
- [ ] Негативная матрица teacherA→teacherB, другой предмет того же ребёнка, бывшее назначение, revoked session и прямой private-file URL.
- [ ] 401/403/recovery/MFA и demo switch в нескольких вкладках очищают прежний DOM/cache и не дают stale data leak.
- [ ] Временные границы start/report24ч,4/8,2/3 рабочих дня и DST проверяются от serverTime/утверждённого календаря.
- [ ] Timeout/retry/replay/version409 не создают двойные reports/reviews/checkpoints/appeals; исход unknown показан честно.
- [ ] Payroll points4/5/9/10, rehire≤/>6months, promise, compensation/confirmed payout показываются раздельно без frontend-money арифметики.
- [ ] Все9 state classes и четыре viewport, RU/RO, keyboard/zoom200%/reduced-motion/contrast проходят адресную проверку.
- [ ] Student regressions: chronological homework, no percentages, no messages menu, subject access/freezes, published-only reports и immutable snapshots.
- [ ] Нет сетевых вызовов к внешним семейным каналам/банку/записи Meet; нет реальных DB writes и ложных gate PASS.

Для визуального изменения: RU/RO,360/768/1024/1280, keyboard/focus/long text и relevant VIS11 states. Для read-model/API: validation, own/foreign scope, revoked context, no-store, error/empty/unknown и совместимость SDK. Для мутации: CSRF/idempotency/revision/unknown-result и отсутствие двойного эффекта. Не добавляй бессмысленный тест, который просто повторяет строку implementation; доказывай поведение.

## 9. Команды и безопасные границы проверки

Рабочий каталог `D:/OnlineSchool`. Это адресные ориентиры из текущих manifests, а не разрешение слепо запускать все команды. Прочитай scripts/конфиг теста перед запуском. Сборка может генерировать Prisma/SDK; это не разрешение запускать migration/seed или подключать реальную БД. Dist-based tests выполнять после целевой сборки.

```powershell
pnpm --filter @online-school/platform typecheck
```

```powershell
pnpm --filter @online-school/platform lint
```

```powershell
pnpm --filter @online-school/platform build
```

```powershell
pnpm --filter @online-school/ui test
```

```powershell
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/unit/platform-switch-http.test.mjs tests/unit/rates.test.mjs tests/unit/student-homework.test.mjs tests/unit/student-skills.test.mjs tests/unit/student-reports.test.mjs --runInBand
```

```powershell
pnpm exec playwright test --list
```

Если нужен новый тестовый script, сначала добавь его в manifest с явно безопасным локальным/mock target, затем запусти и запиши точную команду. Не выполняй `pnpm test`/recursive regression автоматически на каждом TASK. Полный разрешённый прогон относится к финальному блоку. Ошибка не основание ослабить линтер или выдавать NOT_RUN за PASS.

## 10. Критерии готовности

- [ ] Каждый обязательный базовый teacher модуль имеет фактический источник, рабочий сценарий и проверенное ролевое ограничение.
- [ ] Критические дефекты устранены с ретестом, остальные явно классифицированы; evidence привязан к текущему состоянию кода.
- [ ] RU/RO и четыре ширины пригодны для основных ежедневных операций, доступность проверена автоматом и вручную.
- [ ] Student/common регрессия затронутых потоков пройдена без повторения полного проекта на каждом шаге.
- [ ] Бюджет≤250КиБ gzip на teacher маршрут измерен, исключения не скрыты.
- [ ] Отдельно перечислены FND/DB concurrency/Meet/OAuth/LEGAL/retro dependencies; teacher gate не выдан за production GO.
- [ ] Новый teacher режим готов к самостоятельному ревью, известен rollback и условия удаления старого UI.

- [ ] Все использованные данные и действия имеют реальный авторитетный источник/проверку; нет выдуманных цифр, прав, кнопок и success.
- [ ] Отчёт различает исходный работающий код, новые изменения, свежие проверки и исторические доказательства.
- [ ] Не изменены рабочая БД, применённые migration checksums и production; необоснованные внешние эффекты отсутствуют.

## 11. Не входит в этот TASK

- Общий RELEASE-GATE, CRM/public UI приёмка и автоматический production merge/deploy
- Destructive PostgreSQL, реальные финансовые race/restore suites и новый staging
- Выдача юридического заключения или фиктивное закрытие Google POC/EDU-RETRO-01

Обнаруженный соседний gap запиши с конкретным следующим TASK, не расширяй текущую задачу на весь redesign. Если требуется реально новое бизнес-решение или недоступный внешний провайдер — подготовь все независимые изменения и точный вопрос/блокер только по этому пункту. Не останавливайся на повторном согласовании ранее утверждённых правил.

## 12. Артефакты и отчёт для следующего кодера

- TEACHER-GATE report с матрицей требований/cases/evidence/defects/retest
- RU/RO screenshots, keyboard/screen-reader/contrast/viewport evidence
- Route bundle measurement, safe test command log и current unresolved gate register
- Reviewable diff/rollback plan и список условий удаления старого teacher UI

Формат `output/k8k-tasks/TASK-047/report.md`:

```text
TASK: TASK-047
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

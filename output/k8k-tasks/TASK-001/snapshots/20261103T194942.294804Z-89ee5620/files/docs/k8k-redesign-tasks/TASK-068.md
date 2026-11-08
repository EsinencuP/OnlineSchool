# TASK-068 — Права на данные и privacy: понятные интерфейсы, представитель и юридический gate

**Пакет:** K8K-FRONTEND-REBUILD v1.0,03.11.2026. **Блок:** 6 — Директор, оператор, вход и приватность. **Модуль:** Общий вход, сессии и защита данных.

**Входные зависимости:** [TASK-019](TASK-019.md), [TASK-020](TASK-020.md), [TASK-063](TASK-063.md), [TASK-065](TASK-065.md), [TASK-066](TASK-066.md), [TASK-067](TASK-067.md). Номер относится только к этому пакету, не к старым MGR/Phase0 TASK. **Учёт выполнения:** [EXECUTION_LOG](EXECUTION_LOG.md).

**Исходный статус:** ARCH-20/TECH-14 задают категории данных/основания/access/retention/legal hold, но юридически заполненный каталог и тексты/сроки не утверждены. Student shared child/parent account и suspended-manager contact существуют. Готового автоматического data-subject export/delete/request API в корпусе не установлено.. Это описание кода на дату составления, не акт приёмки и не команда начать с нуля.

## 1. Команда AI-кодеру и результат

Выполни **только TASK-068** в существующем репозитории. Не начинай следующий TASK автоматически.

Сделать доступные RU/RO privacy/data-rights входы и честный управляемый маршрут через официального менеджера, сохранив минимизацию и проверку представительства. Подготовить проверяемый юридический пакет перед выпуском, не объявлять согласия/retention/законность одобренными дизайном.

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

- [docs/online_academy_technical_architecture_part_01_v3.2.md](../online_academy_technical_architecture_part_01_v3.2.md) — **ARCH-19/B,ARCH-20/B,ARCH-26/B**: Категории данных, основания, legal hold, backup и локализация
- [docs/online_academy_detailed_technical_design_part_01_v1.9.md](../online_academy_detailed_technical_design_part_01_v1.9.md) — **TECH-14/B:ENG-SEC-PII/IDENTITY/DATA-LIFECYCLE**: Матрица полей/провайдеров/регионов и legal review
- [docs/online_academy_student_architecture_full_decision_log_v2.md](../online_academy_student_architecture_full_decision_log_v2.md) — **5.1,5.16,5.18,7.1–7.3**: Shared login≠guardian identity, legal access даже при suspension
- [docs/online_academy_block_13_final_architecture_handoff_v1.0.md](../online_academy_block_13_final_architecture_handoff_v1.0.md) — **LEGAL-01,FIN-LEGAL-01,LANG-01**: Открытые правовые и языковые release dependencies
- [docs/regul/online_academy_manager_regulations_v1.0.md](../regul/online_academy_manager_regulations_v1.0.md) — **9,12,15**: Молдова, data protection, ознакомление≠договорное согласие
- [docs/online_academy_REL-01_A_Meet_API_MVP_release_addendum_v1.0.md](../online_academy_REL-01_A_Meet_API_MVP_release_addendum_v1.0.md) — **GM-SCOPE-10,MEET-SEC-01**: Приватность Google/детей, отсутствие auto recordings/transcripts

Реальные точки входа в код/доказательства (существуют на дату пакета; если структура позже изменена, найди symbol через `rg`, не создавай дубликат):

- [apps/platform/src/App.tsx](../../apps/platform/src/App.tsx).
- [packages/account-ui/src/index.tsx](../../packages/account-ui/src/index.tsx).
- [apps/student-cabinet/src/pages/Account.tsx](../../apps/student-cabinet/src/pages/Account.tsx).
- [apps/api/src/student/profile/profile.controller.ts](../../apps/api/src/student/profile/profile.controller.ts).
- [apps/api/src/student/security/security.controller.ts](../../apps/api/src/student/security/security.controller.ts).
- [apps/api/src/core/policy/policy.service.ts](../../apps/api/src/core/policy/policy.service.ts).
- [packages/db/prisma/schema.prisma](../../packages/db/prisma/schema.prisma).
- [docs/online_academy_technical_architecture_part_01_v3.2.md](../online_academy_technical_architecture_part_01_v3.2.md).
- [docs/online_academy_detailed_technical_design_part_01_v1.9.md](../online_academy_detailed_technical_design_part_01_v1.9.md).

Визуальная опора: [template/newtemp.png](../../template/newtemp.png) — язык дизайна, не требования и не источник mock-цифр. Старые [template/*.webp](../../template/README.md) — только исторические примеры.

Инструменты кодера: начинай поиск исходников с `rg`; версии/лицензии проверяй через `pnpm view` и текущий lockfile. Для библиотечных API используй доступный Context7/официальные документы нужной версии; для интерфейса — локальный Playwright/browser harness и проверку реального рендера. Сначала проверь доступность MCP, не считай запись сервера доказательством авторизации. Repo-инструменты и локальные fixtures остаются рабочим fallback. Figma/внешний дизайн-сервис не обязательны для восстановления этого контекста. Не подключай реальные аккаунты/провайдеры ради mock smoke и не подменяй ими ограничения среды.

Официальные справочные сайты по теме; бизнес-контекст уже дан выше, интернет не нужен для его восстановления. Перед использованием API/версии библиотеки сверяй первичную документацию именно совместимой версии. Наличие ссылки не требует установки пакета:

- [React 18.3.1](https://18.react.dev/reference/react) — API текущей major-версии; не обновлять проект до React19 по latest-примеру.
- [TanStack Query v5](https://tanstack.com/query/latest/docs/framework/react/overview) — Чтения, query keys, invalidation, cancellation; выбранную minor сверять с package.json.
- [WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/) — Рабочая accessibility-рамка; axe не заменяет ручные проверки.
- [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots) — Воспроизводимые снимки и контролируемые fixtures.
- [Orval](https://orval.dev/) — Генерация SDK только штатным способом проекта.
- [CNPDCP — закон195/2024](https://datepersonale.md/despre-legea-nr-195-2024/) — Официальный правовой источник Молдовы для отдельной legal-проверки. Задание не подменяет юридическое заключение.

## 5. Предметные правила и сохранение поведения

- Юрисдикция корпуса — Республика Молдова; актуальные требования проверяются по официальным источникам в общем legal пакете, не по памяти или произвольным GDPR порогам.
- Общий пароль ребёнка/родителя не подтверждает полномочия представителя и не является юридическим согласием на новые договорные условия.
- Доступ по закону к данным/образовательным документам остаётся через защищённый manager маршрут даже при приостановленном кабинете; не включать для этого скрытый student API bypass.
- Окончание подписки/смена teacher не означает удаление всей истории; retention по категориям/legal hold/backup, точные сроки и основания нельзя придумывать.
- Privacy notice, подтверждение ознакомления, договорное согласие и optional consent — разные события; общий обязательный «согласен на всё» checkbox не вводить.
- RU/RO UI утверждён как интерфейс, но юридический перевод/текст/дата вступления в силу требуют отдельного sign-off и версионирования.
- Data-rights entry не становится общим student «Мои обращения»/чатом; default конкретный официальный контакт/защищённый процесс, без несуществующего request API.
- Маскировать чувствительные поля и исключать medical/child content/секреты из analytics/log/evidence; Google/S3 processor region/privacy не закрываются наличием ссылки на policy.

## 6. Контракты, данные и совместимость

- Default data-rights interface использует реально существующие official manager contacts и защищённый регламент; не заявляет несуществующий createDataRequest/deleteAccount/exportAll API.
- Shared account/session авторизует допустимое чтение, но не legal representative proof; любые юридически значимые действия требуют отдельной проверяемой процедуры.
- Policy content должен иметь утверждённую версию/язык/дату и автора sign-off. UI locale переключение не создаёт юридического approval и не переводит договор автоматически.
- Retention/data lifecycle матрица является юридическим артефактом, не конфигом произвольного автоматического удаления; financial/audit evidence и legal hold сохраняются.
- Новый backend receipt/request только после утверждённого процесса: минимум данных, safe status, server actor/time, audit и отказ без proof; неподтверждённая часть остаётся gated явно.

Точные имена новых planned DTO/operation/props запиши в коротком design note этого TASK до реализации и соблюдай существующие namespace/style. Planned нельзя выдавать за уже существующий API. Найденный существующий сервис переиспользуй. Generic UI не принимает бизнес-решения. Существующий авторитетный источник не копируется во второй реестр.

## 7. Пошаговое выполнение

1. Подтверди prerequisites по реальным артефактам предыдущих TASK и текущему коду. Недостающий результат не заменяй заглушкой или флагом с фиктивными данными. Не пересылай пользователю уже закрытые вопросы о чате, уведомлениях или director-only подтверждениях.
2. Инвентаризировать реально показанные поля/выгрузки/материалы каждого role UI, screenshots/логи и external recipients; сопоставить с ENG-SEC-PII категориями и минимумом данных.
3. Подготовить локальный нормативный пакет текущего release: цель/основание/subjects/поля/роли/период/архив/delete/legal hold/backup/processor region/owner и статус юридической проверки, без заполнения неизвестных сроков вымышленными числами.
4. Добавить RU/RO информационный privacy/data-rights entry в общий account/help и student suspended screen через существующий официальный manager contact; не добавлять generic обращения menu ученику.
5. Для запроса объяснить отдельную проверку личности/представительства и защищённый канал передачи документов; не загружать удостоверения через произвольную новую форму/чат.
6. Показывать только согласованные versioned privacy/terms/regulation тексты. Неподтверждённый правовой текст хранить как draft в legal review, не делать checkbox принятия юридически неизвестных условий.
7. Проверить версии/acknowledgement сценария регламентов: ознакомление не подписывает новые contractual terms. Если backend receipt недоступен, не симулировать успешную запись.
8. Зафиксировать LEGAL-01/FIN-LEGAL-01/LANG-01/MEET-SEC и фактический перечень Google/S3/Vercel/Neon обработчиков для проверки ответственным; официальный регуляторный источник и актуальность приведёт общий package.
9. Не реализовывать массовое auto-delete/бесконтрольный export. Если для утверждённой процедуры понадобится новый request/receipt API, оформить отдельный минимальный backend scope с verified actor, audit и policy sign-off до включения.
10. Проверить RU/RO/keyboard/mobile, suspended контакт, отсутствие PII в URLs/logs и source-of-truth flags; принять UI отдельно от юридического sign-off, сохранить blocking release dependencies.
11. Сверь итог с правилами разделов3/5/6 этого же файла, обнови журнал и предметную матрицу, подготовь артефакты и остановись после отчёта по TASK-068.

## 8. Обязательные сценарии проверки

- [ ] При suspended student доступен официальный manager/data-rights маршрут без разблокирования приватных API.
- [ ] Shared login/checkbox не выдаётся за подтверждение родителя/представителя и не меняет contract consent.
- [ ] Неподтверждённая privacy версия/перевод не показывает «утверждено/принято» и не записывает фиктивный acceptance.
- [ ] ФИО/контакты/medical cancellation reason/child work не попадают в URL, raw logs, diagnostics и публичные screenshots.
- [ ] Смена teacher/окончание подписки отзывает доступ, но не удаляет financial/education history автоматически.
- [ ] Legal hold/backup retention не подменяются универсальным сроком; UI не предлагает destructive delete в один клик.
- [ ] RU/RO, language metadata, keyboard/focus/zoom и четыре viewport делают contact/privacy entry доступными.
- [ ] Не создаётся student чат/общий центр обращений, лишний parent account и отправка документов в personal messenger автоматически.
- [ ] Release report разделяет UI готовность и pending legal/processor/cross-border sign-offs.

Для визуального изменения: RU/RO,360/768/1024/1280, keyboard/focus/long text и relevant VIS11 states. Для read-model/API: validation, own/foreign scope, revoked context, no-store, error/empty/unknown и совместимость SDK. Для мутации: CSRF/idempotency/revision/unknown-result и отсутствие двойного эффекта. Не добавляй бессмысленный тест, который просто повторяет строку implementation; доказывай поведение.

## 9. Команды и безопасные границы проверки

Рабочий каталог `D:/OnlineSchool`. Это адресные ориентиры из текущих manifests, а не разрешение слепо запускать все команды. Прочитай scripts/конфиг теста перед запуском. Сборка может генерировать Prisma/SDK; это не разрешение запускать migration/seed или подключать реальную БД. Dist-based tests выполнять после целевой сборки.

```powershell
pnpm --filter @online-school/platform typecheck
```

```powershell
pnpm --filter @online-school/account-ui typecheck
```

```powershell
pnpm --filter @online-school/student-cabinet typecheck
```

```powershell
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/unit/student-security-http.test.mjs tests/unit/target-guards.test.mjs --runInBand
```

Если нужен новый тестовый script, сначала добавь его в manifest с явно безопасным локальным/mock target, затем запусти и запиши точную команду. Не выполняй `pnpm test`/recursive regression автоматически на каждом TASK. Полный разрешённый прогон относится к финальному блоку. Ошибка не основание ослабить линтер или выдавать NOT_RUN за PASS.

## 10. Критерии готовности

- [ ] Пользователь понимает, где получить сведения/обратиться по данным, включая приостановленный доступ.
- [ ] Маршрут использует реальные контакты/защищённую процедуру, без mock API и без лишних персональных сборов.
- [ ] Согласия/ознакомления/representative proof раздельны и не фабрикуются интерфейсом.
- [ ] Правовая матрица и конкретные legal gates подготовлены, unknown срок/основание явно pending.
- [ ] RU/RO и доступность privacy/data-rights entry проверены адресно.
- [ ] Никакого автоматического удаления/экспорта/правового approval от лица агента не выполнено.

- [ ] Все использованные данные и действия имеют реальный авторитетный источник/проверку; нет выдуманных цифр, прав, кнопок и success.
- [ ] Отчёт различает исходный работающий код, новые изменения, свежие проверки и исторические доказательства.
- [ ] Не изменены рабочая БД, применённые migration checksums и production; необоснованные внешние эффекты отсутствуют.

## 11. Не входит в этот TASK

- Юридическое заключение, автоматическое утверждение договоров и сроков хранения
- Mass export/delete/account erasure без утверждённой процедуры и полномочий
- Новый parent account, детский attendance tracking, записи Meet/транскрипты

Обнаруженный соседний gap запиши с конкретным следующим TASK, не расширяй текущую задачу на весь redesign. Если требуется реально новое бизнес-решение или недоступный внешний провайдер — подготовь все независимые изменения и точный вопрос/блокер только по этому пункту. Не останавливайся на повторном согласовании ранее утверждённых правил.

## 12. Артефакты и отчёт для следующего кодера

- ENG-SEC-PII/data-rights role/field/processor/legal-basis matrix с pending sign-offs
- RU/RO privacy/contact/suspended-entry evidence
- Версии юридических текстов и release-blocking LEGAL/FIN-LEGAL/LANG/MEET-SEC register

Формат `output/k8k-tasks/TASK-068/report.md`:

```text
TASK: TASK-068
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

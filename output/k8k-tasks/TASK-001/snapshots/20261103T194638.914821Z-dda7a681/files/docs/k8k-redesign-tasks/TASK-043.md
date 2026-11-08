# TASK-043 — Преподаватель: явная оценка навыков, текстовые цели и подтверждение4-контроля

**Пакет:** K8K-FRONTEND-REBUILD v1.0,03.11.2026. **Блок:** 4 — Рабочий кабинет преподавателя. **Модуль:** Навыки, цели и образовательные отчёты.

**Входные зависимости:** [TASK-036](TASK-036.md), [TASK-041](TASK-041.md), [TASK-042](TASK-042.md). Номер относится только к этому пакету, не к старым MGR/Phase0 TASK. **Учёт выполнения:** [EXECUTION_LOG](EXECUTION_LOG.md).

**Исходный статус:** SkillEntry/SkillAssessment с immutable revisions, SkillAuditLog, LearningGoal/History и ProgressCheckpoint completion существуют в schema. STU-08 read API и SQL guards аудита/snapshot подготовлены. Teacher commands редактирования/оценки/целей и соответствующие UI ещё не реализованы.. Это описание кода на дату составления, не акт приёмки и не команда начать с нуля.

## 1. Команда AI-кодеру и результат

Выполни **только TASK-043** в существующем репозитории. Не начинай следующий TASK автоматически.

Позволить действующему преподавателю осознанно обновлять качественные этапы навыков и текстовые цели в одной образовательной карточке, подтверждать завершённый4-контроль с замороженным снимком через действующие guards, сохраняя внутренние основания и публичные комментарии раздельно.

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

- [docs/K8K_DESIGN_INSTRUCTIONS.md](../K8K_DESIGN_INSTRUCTIONS.md) — **5.4**: Педагогические действия только в рамках базового teacher scope
- [docs/K8K_Academy_VIS12_dashboard_module_contracts_v1.0.md](../K8K_Academy_VIS12_dashboard_module_contracts_v1.0.md) — **3:TCHD-05**: Контрольные точки и отчёты без автоматической педагогической публикации
- [docs/online_academy_MVP_full_release_architecture_roadmap_v9.7.md](../online_academy_MVP_full_release_architecture_roadmap_v9.7.md) — **TCH-06/B; TECH-11/B; EDU-RETRO-01**: Процесс4/8, сохранение истории и открытая ретрокоррекция
- [docs/online_academy_CON_01_11_owner_decisions_addendum_v1.0.md](../online_academy_CON_01_11_owner_decisions_addendum_v1.0.md) — **6:CON-06/B,CON-07/B**: Диагностика в пробном, навыки4/отчёт8 по предмету
- [docs/online_academy_student_architecture_full_decision_log_v2.md](../online_academy_student_architecture_full_decision_log_v2.md) — **3.1–3.8**: Карта навыков, цели, публикация и педагогическая история
- [apps/api/src/student/skills/README.md](../../apps/api/src/student/skills/README.md) — **Read projections/privacy; teacher integration**: Маппинг INTRODUCING→FAMILIARIZING, hidden basis и frozen snapshots
- [packages/db/prisma/migrations/20261027160100_stu08_skills/migration.sql](../../packages/db/prisma/migrations/20261027160100_stu08_skills/migration.sql) — **stu08 guards, audit, goals and freeze_snapshot**: Действующие SQL ограничения педагогических операций

Реальные точки входа в код/доказательства (существуют на дату пакета; если структура позже изменена, найди symbol через `rg`, не создавай дубликат):

- [apps/api/src/modules/education/education.module.ts](../../apps/api/src/modules/education/education.module.ts).
- [apps/api/src/student/skills/skills.service.ts](../../apps/api/src/student/skills/skills.service.ts).
- [apps/api/src/student/skills/skills.dto.ts](../../apps/api/src/student/skills/skills.dto.ts).
- [packages/db/prisma/schema.prisma](../../packages/db/prisma/schema.prisma).
- [packages/db/prisma/migrations/20261027160100_stu08_skills/migration.sql](../../packages/db/prisma/migrations/20261027160100_stu08_skills/migration.sql).
- [apps/platform/src/App.tsx](../../apps/platform/src/App.tsx).
- [packages/api-contracts/src/index.ts](../../packages/api-contracts/src/index.ts).
- [tests/unit/student-skills-http.test.mjs](../../tests/unit/student-skills-http.test.mjs).

Визуальная опора: [template/newtemp.png](../../template/newtemp.png) — язык дизайна, не требования и не источник mock-цифр. Старые [template/*.webp](../../template/README.md) — только исторические примеры.

Инструменты кодера: начинай поиск исходников с `rg`; версии/лицензии проверяй через `pnpm view` и текущий lockfile. Для библиотечных API используй доступный Context7/официальные документы нужной версии; для интерфейса — локальный Playwright/browser harness и проверку реального рендера. Сначала проверь доступность MCP, не считай запись сервера доказательством авторизации. Repo-инструменты и локальные fixtures остаются рабочим fallback. Figma/внешний дизайн-сервис не обязательны для восстановления этого контекста. Не подключай реальные аккаунты/провайдеры ради mock smoke и не подменяй ими ограничения среды.

Официальные справочные сайты по теме; бизнес-контекст уже дан выше, интернет не нужен для его восстановления. Перед использованием API/версии библиотеки сверяй первичную документацию именно совместимой версии. Наличие ссылки не требует установки пакета:

- [React 18.3.1](https://18.react.dev/reference/react) — API текущей major-версии; не обновлять проект до React19 по latest-примеру.
- [TanStack Query v5](https://tanstack.com/query/latest/docs/framework/react/overview) — Чтения, query keys, invalidation, cancellation; выбранную minor сверять с package.json.
- [WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/) — Рабочая accessibility-рамка; axe не заменяет ручные проверки.
- [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots) — Воспроизводимые снимки и контролируемые fixtures.
- [Orval](https://orval.dev/) — Генерация SDK только штатным способом проекта.

## 5. Предметные правила и сохранение поведения

- Навык меняет явно действующий teacher своего предмета; отсутствие оценивания означает NOT_STUDIED, не автоматический INTRODUCING и не нулевой балл.
- Качественные публичные стадии: NOT_STUDIED/FAMILIARIZING/PRACTICING/APPLYING, storage INTRODUCING маппится по существующему STU-08 правилу.
- SkillAssessment.basis — внутреннее педагогическое основание; только public_comment попадает в student audit/snapshot, не раскрывать basis как tooltip.
- Изменение уровня создаёт новую assessment version и audit, не UPDATE прошлой оценки; нельзя переassign catalog skill другому предмету/ребёнку.
- LearningGoal текстовая, statuses ACTIVE/ACHIEVED/PAUSED/ARCHIVED; target_date календарная дата, не timestamp полночь ОС; изменения пишут before/after journal.
- Подтверждение4-точки teacher explicit с completed_by/summary; существующий SQL freeze создаёт immutable SkillSnapshot, фронтенд не пишет второй snapshot вручную.
- Пересмотр навыков не означает обязательный отчёт4; выдача/проверка ДЗ не вызывает скрытый auto-assessment.
- Коррекция frozen snapshot/чужих публикаций и ретросдвиг4/8 не выполняются автоматически; при неопределённом основании применяется gate TASK-042.

## 6. Контракты, данные и совместимость

- Teacher assessment command принимает целевой skill/enrollment и expected version, но actor и assessed_at назначает сервер. Точный URL новый и документируется вместе с DTO; общая шкала не расширяется.
- Ответ содержит новую assessment identity/version и безопасную public projection; basis допустим только в разрешённом teacher detail и не просачивается в student DTO.
- Goal command работает с текстом, optional owned skill, date и существующим goal status; revision conflict и foreign target возвращают типизированный отказ.
- Checkpoint completion ссылается на реальную4-точку и её действующее основание; клиент не присылает произвольный snapshot JSON или confirmed lesson count.
- Student STU-08 keeps audit ordering, frozen display names/comments, historical enrollment continuity и nextSnapshotIn; новый teacher write workflow не меняет этот read contract.

Точные имена новых planned DTO/operation/props запиши в коротком design note этого TASK до реализации и соблюдай существующие namespace/style. Planned нельзя выдавать за уже существующий API. Найденный существующий сервис переиспользуй. Generic UI не принимает бизнес-решения. Существующий авторитетный источник не копируется во второй реестр.

## 7. Пошаговое выполнение

1. Подтверди prerequisites по реальным артефактам предыдущих TASK и текущему коду. Недостающий результат не заменяй заглушкой или флагом с фиктивными данными. Не пересылай пользователю уже закрытые вопросы о чате, уведомлениях или director-only подтверждениях.
2. Сверить SQL функции STU-08 с Prisma models и DTO student: какие INSERT создают audit и snapshot, какие поля immutable и какие действия отсутствуют в API.
3. Добавить teacher read-карту и commands оценки/целей в единый education workflow, используя own context TASK-036 и checkpoints TASK-042; не вызывать student controller от имени staff.
4. Реализовать оценку конкретного skill с expected current version, качественным level, внутренним basis, optional public_comment и допустимой связью lesson; сервер проверяет подтверждённый conducted evidence для lesson-linked assessment.
5. Создавать SkillAssessment новую версию в критической транзакции; переиспользовать SQL audit trigger вместо дублирования SkillAuditLog. Проверить конфликт двух одновременных оценок.
6. Добавить create/update/archive goal с author/editor от сессии, валидным optional skill того же предмета и календарной датой; сохранить before/after journal в существующей модели.
7. Собрать teacher UI карты навыков и целей: явный выбор стадии, предосмотр student-видимого комментария, отдельное внутреннее основание, история изменений и доступный подтверждающий диалог.
8. Реализовать явное completion4-контроля с basis/revision token TASK-042; SQL freeze/summary срабатывает один раз, видимые имена/этапы снимка не зависят от будущего каталога.
9. При stale revision/отзыве назначения сохранить локальный ввод безопасно, запретить silent resubmit, показать необходимость обновить контекст; revoked приватные данные очистить.
10. Обновить OpenAPI/SDK и RU/RO тексты; пройти teacher→student карту/audit/snapshot на fixtures, не применяя миграции/seed к рабочей БД.
11. Сверь итог с правилами разделов3/5/6 этого же файла, обнови журнал и предметную матрицу, подготовь артефакты и остановись после отчёта по TASK-043.

## 8. Обязательные сценарии проверки

- [ ] Оценить own skill через INTRODUCING storage: student видит FAMILIARIZING и правильную RU/RO подпись, без процентов и баллов.
- [ ] Показать необученный skill без assessment: NOT_STUDIED, реальный catalog timestamp и без вымышленного teacher.
- [ ] Две concurrent оценки ожидаемой версии дают одну согласованную историю, следующая версия не затирает прошлую.
- [ ] Lesson-linked assessment с неподтверждённым/чужим уроком и personal skill другого ребёнка отклоняются.
- [ ] Внутренний basis отсутствует в student map/audit/snapshot/export; public_comment доступен только разрешённым зрителям.
- [ ] Goal date не сдвигается timezone/DST, ACTIVE→ACHIEVED/PAUSED/ARCHIVED сохраняет before/after и авторство.
- [ ] Completion4 создаёт один frozen snapshot; повтор/replay и переименование каталога позже не меняют старый снимок.
- [ ] Revoke назначения между открытием формы и commit запрещает оценку/goal/completion; чужая учётная запись не использует replay.
- [ ] Retro review-required блокирует автоматическое завершение спорной точки, но не стирает ранее подтверждённые педагогические факты.

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
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/unit/student-skills.test.mjs tests/unit/student-skills-http.test.mjs --runInBand
```

Если нужен новый тестовый script, сначала добавь его в manifest с явно безопасным локальным/mock target, затем запусти и запиши точную команду. Не выполняй `pnpm test`/recursive regression автоматически на каждом TASK. Полный разрешённый прогон относится к финальному блоку. Ошибка не основание ослабить линтер или выдавать NOT_RUN за PASS.

## 10. Критерии готовности

- [ ] Teacher оценки и текстовые цели доступны по реальному защищённому API и в образовательной карточке.
- [ ] Публичная и внутренняя обратная связь раздельны; student приватность проверена сериализацией и UI.
- [ ] Assessment/goal history версионная, audit не дублируется,4-snapshot immutable.
- [ ] Все операции используют active assignment и ожидаемую актуальную версию, без auto-advancement.
- [ ] RU/RO интерфейс и keyboard контроли используют K8K компоненты, сохраняют контекст.
- [ ] Адресные tests подтверждают snapshot continuity и STU-08 compatibility; retro gate явно сохранён.

- [ ] Все использованные данные и действия имеют реальный авторитетный источник/проверку; нет выдуманных цифр, прав, кнопок и success.
- [ ] Отчёт различает исходный работающий код, новые изменения, свежие проверки и исторические доказательства.
- [ ] Не изменены рабочая БД, применённые migration checksums и production; необоснованные внешние эффекты отсутствуют.

## 11. Не входит в этот TASK

- Процент знаний, рейтинг, цифровые оценки и автоматический навык по посещаемости
- Глобальное редактирование каталога навыков без утверждённых authoring прав
- Перезапись frozen snapshot или ретроизменение публикации без отдельной процедуры

Обнаруженный соседний gap запиши с конкретным следующим TASK, не расширяй текущую задачу на весь redesign. Если требуется реально новое бизнес-решение или недоступный внешний провайдер — подготовь все независимые изменения и точный вопрос/блокер только по этому пункту. Не останавливайся на повторном согласовании ранее утверждённых правил.

## 12. Артефакты и отчёт для следующего кодера

- Teacher assessment/goal/completion DTO и матрица публичных/внутренних полей
- Version-conflict, snapshot immutability и student privacy evidence
- RU/RO карта навыков/целей/подтверждения4 и история изменений

Формат `output/k8k-tasks/TASK-043/report.md`:

```text
TASK: TASK-043
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

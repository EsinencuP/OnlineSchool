# TASK-035 — Приёмочный gate ученического кабинета K8K

**Пакет:** K8K-FRONTEND-REBUILD v1.0,03.11.2026. **Блок:** 3 — Кабинет ученика. **Модуль:** События, локализация и приёмка.

**Входные зависимости:** [TASK-024](TASK-024.md), [TASK-025](TASK-025.md), [TASK-026](TASK-026.md), [TASK-027](TASK-027.md), [TASK-028](TASK-028.md), [TASK-029](TASK-029.md), [TASK-030](TASK-030.md), [TASK-031](TASK-031.md), [TASK-032](TASK-032.md), [TASK-033](TASK-033.md), [TASK-034](TASK-034.md). Номер относится только к этому пакету, не к старым MGR/Phase0 TASK. **Учёт выполнения:** [EXECUTION_LOG](EXECUTION_LOG.md).

**Исходный статус:** Не выполнено для полного нового scope: есть исторические STU-12/phase2/phase3 и новый root smoke отчёта/колокольчика. Они не доказывают завершение TASK-024…034 или всей академии.. Это описание кода на дату составления, не акт приёмки и не команда начать с нуля.

## 1. Команда AI-кодеру и результат

Выполни **только TASK-035** в существующем репозитории. Не начинай следующий TASK автоматически.

Проверить завершённый ученический путь на текущем commit с реальными контрактами/локальными безопасными fixtures, отделив функциональную, визуальную и внешнюю приёмку. Получить точное решение go/no-go для student rollout, не выдавая его за FND-GATE/production GO.

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

- [docs/K8K_DESIGN_INSTRUCTIONS.md](../K8K_DESIGN_INSTRUCTIONS.md) — **§6; §5.1/5.2**: Полный критерий дизайна, состояния и пользовательские сценарии.
- [docs/K8K_Academy_VIS12_dashboard_module_contracts_v1.0.md](../K8K_Academy_VIS12_dashboard_module_contracts_v1.0.md) — **V12-AT-01…04,08,10…12; §8**: Отрицательные проверки и незакрытые зависимости.
- [PHASE0_CHECKS.md](../../PHASE0_CHECKS.md) — **Policy; ограничения рабочей среды; общий gate**: Адресная проверка инкремента без destructive suites в mainDB.
- [docs/K8K_REQUIREMENTS_MATRIX.md](../K8K_REQUIREMENTS_MATRIX.md) — **STU-01…07; Сквозные проверки; Незакрытые работы**: Трассировка всех базовых модулей до evidence.
- [docs/K8K_IMPLEMENTATION_STATUS.md](../K8K_IMPLEMENTATION_STATUS.md) — **Проверки текущего инкремента; Осталось по принятому плану**: Историческое evidence не является новым запуском.
- [apps/student-cabinet/playwright.config.mjs](../../apps/student-cabinet/playwright.config.mjs) — **testMatch; webServer; reporter/outputDir**: Существующая безопасная fixture инфраструктура и риск перезаписи старого output.

Реальные точки входа в код/доказательства (существуют на дату пакета; если структура позже изменена, найди symbol через `rg`, не создавай дубликат):

- [apps/student-cabinet/tests/student.spec.mjs](../../apps/student-cabinet/tests/student.spec.mjs).
- [apps/student-cabinet/tests/k8k-presentation.test.mjs](../../apps/student-cabinet/tests/k8k-presentation.test.mjs).
- [apps/student-cabinet/tests/fixture-server.mjs](../../apps/student-cabinet/tests/fixture-server.mjs).
- [apps/student-cabinet/tests/accessibility.mjs](../../apps/student-cabinet/tests/accessibility.mjs).
- [apps/student-cabinet/playwright.config.mjs](../../apps/student-cabinet/playwright.config.mjs).
- [apps/student-cabinet/package.json](../../apps/student-cabinet/package.json).
- [scripts/k8k-implementation-smoke.mjs](../../scripts/k8k-implementation-smoke.mjs).
- [scripts/k8k-design-check.mjs](../../scripts/k8k-design-check.mjs).
- [docs/K8K_REQUIREMENTS_MATRIX.md](../K8K_REQUIREMENTS_MATRIX.md).
- [docs/K8K_IMPLEMENTATION_STATUS.md](../K8K_IMPLEMENTATION_STATUS.md).

Визуальная опора: [template/newtemp.png](../../template/newtemp.png) — язык дизайна, не требования и не источник mock-цифр. Старые [template/*.webp](../../template/README.md) — только исторические примеры.

Инструменты кодера: начинай поиск исходников с `rg`; версии/лицензии проверяй через `pnpm view` и текущий lockfile. Для библиотечных API используй доступный Context7/официальные документы нужной версии; для интерфейса — локальный Playwright/browser harness и проверку реального рендера. Сначала проверь доступность MCP, не считай запись сервера доказательством авторизации. Repo-инструменты и локальные fixtures остаются рабочим fallback. Figma/внешний дизайн-сервис не обязательны для восстановления этого контекста. Не подключай реальные аккаунты/провайдеры ради mock smoke и не подменяй ими ограничения среды.

Официальные справочные сайты по теме; бизнес-контекст уже дан выше, интернет не нужен для его восстановления. Перед использованием API/версии библиотеки сверяй первичную документацию именно совместимой версии. Наличие ссылки не требует установки пакета:

- [React 18.3.1](https://18.react.dev/reference/react) — API текущей major-версии; не обновлять проект до React19 по latest-примеру.
- [TanStack Query v5](https://tanstack.com/query/latest/docs/framework/react/overview) — Чтения, query keys, invalidation, cancellation; выбранную minor сверять с package.json.
- [WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/) — Рабочая accessibility-рамка; axe не заменяет ручные проверки.
- [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots) — Воспроизводимые снимки и контролируемые fixtures.
- [Orval](https://orval.dev/) — Генерация SDK только штатным способом проекта.

## 5. Предметные правила и сохранение поведения

- Приёмка соответствует текущему SHA и сохранённому dirty tree; старые output/отчёты только baseline. Если часть источников/API отсутствует, обязательный модуль не считается готовым потому что скрыт флагом.
- Безопасный fixture browser проверяет UI и контрактные запросы, но не доказывает реальные PostgreSQL locks/triggers/provider delivery/OAuth/S3. Эти границы явно маркируются.
- Единственная рабочая Neon main не используется для destructive seed/reset/write suites; не создавать вторую БД/ветку/контейнер для обхода запрета. Обязательный реальный шаг без разрешённой среды остаётся NOT_RUN.
- Матрица включает все7 student dashboard модулей и полные экраны/формы, а не только главную. Скрытая недоделка, broken deep link или incompleteRO — failure, не мелкое отложенное замечание.
- WCAG2.2AA оценивается автоматикой и ручными keyboard/focus/reading order/zoom/touch проверками; axe0/Lighthouse score сами по себе не означают полную доступность.
- Лимит маршрута <=250KiB gzip измеряется воспроизводимо по принятому общему бюджету с shared dependencies/fonts, не по одному entry JS; baseline delta сопровождается методом.
- Flag ui.k8k сохраняет возможность отката к legacy до владельческой приёмки. Удаление старого кода и rollout — отдельное решение общих release задач, не побочный эффект gate.

## 6. Контракты, данные и совместимость

- Новые API из024/027/028/032/033 проверяются вместе с generated SDK и frontend request payloads. Unknown extra fields/ID/scopes, nullable values и empty responses имеют явные cases.
- Browser fixtures воспроизводят server-owned capabilities, snapshot timestamps и idempotency behavior, но не объявляются backend implementation. Договорённости tests не расширяют business rules.
- Acceptance manifest: taskId, commit, command, exit/status, route/viewport/locale/state, evidence path, limitation. Secrets, cookies, OTP, signed URLs и реальные private learner data исключаются из артефактов.
- Успешный student gate не закрывает FND-GATE, LEGAL-01, FIN-LEGAL-01, Meet OAuth/POC/G4 и общую приёмку сотрудников/директора/оператора. Тестовый fixture результат не является production GO.

Точные имена новых planned DTO/operation/props запиши в коротком design note этого TASK до реализации и соблюдай существующие namespace/style. Planned нельзя выдавать за уже существующий API. Найденный существующий сервис переиспользуй. Generic UI не принимает бизнес-решения. Существующий авторитетный источник не копируется во второй реестр.

## 7. Пошаговое выполнение

1. Подтверди prerequisites по реальным артефактам предыдущих TASK и текущему коду. Недостающий результат не заменяй заглушкой или флагом с фиктивными данными. Не пересылай пользователю уже закрытые вопросы о чате, уведомлениях или director-only подтверждениях.
2. Собрать manifest текущих commit/dirty changes и перечень маршрутов/команд после TASK-024…034. У каждой строки requirements matrix указать API source, право, действие, состояния, язык и конкретное evidence.
3. Обновить test harness так, чтобы новый прогон писал в output/k8k-taskpack/task-035, не перезаписывал исторический output/stu12/phase2. Изолировать network: localhost fixtures, внешние API/providers заблокированы.
4. Проверить unit/HTTP/SDK targeted suites по затронутым student API, static types/lint и student presentation tests. Не запускать весь repository recursive gate, пока это не общий завершающий этап taskpack.
5. Выполнить браузерный end-to-end: вход/forced password → active subject hub → current Meet → homework draft/upload/submit/revision → map/snapshot/report → PDF job → subscription → help → logout/switch.
6. Пройти negative matrix: active+expired/frozen/limited subjects, zero/null/history, чужие ID,401/402/403, поздний ответ, неизвестная команда, отозванный файл/сессия, exact time boundaries.
7. Снять before/after/state screenshots360/768/1024/1280 для всех новых экранов и ключевых error/empty/pending/stale состояний RU/RO; baseline может отличаться scope, метод сравнения описать.
8. Автоматический axe запустить по готовым fixture states, дополнить keyboard tab order/skip/Escape/focus return/200%zoom/reduced-motion/long content проверкой. Наблюдаемые defects исправлять в owning task без ослабления тестов.
9. Измерить route bundle gzip/fonts и locale impact после текущей сборки, проверить все25 контрастных сочетаний и запрет raw styles согласно общим checks. Зафиксировать actual цифры, не копировать87/146KiB из старого документа.
10. Обновить текущий status/matrix и итоговый task report: PASS/FAIL/NOT_RUN с причиной, список незакрытых внешних gates и решение student readiness. Не пушить/деплоить/merge автоматически в рамках приёмки.
11. Сверь итог с правилами разделов3/5/6 этого же файла, обнови журнал и предметную матрицу, подготовь артефакты и остановись после отчёта по TASK-035.

## 8. Обязательные сценарии проверки

- [ ] Полный путь двух предметов: один active, другой expired/frozen/limited; нет глобального ошибочного logout/suspension.
- [ ] Meet T−10±1ms/T0/T+60±1ms, cancelled/no-link/stale/skewed clock; клик не пишет attendance/ledger.
- [ ] Автосохранение медленных редакций, upload confirm retry, soft deadline, do-over и same-intent submit; ввод не теряется.
- [ ] History24h reschedule/720h dispute boundaries, open-case409/replay201, unknown balances и нет client refund.
- [ ] Четыре skill states, public audit, immutable snapshot4 и report8; report со страницы3 и версия/read semantics.
- [ ] PDF queued/processing/ready/failed/429/60s resume/fixed1h expiry; logout во время job polling.
- [ ] Bellpage2/read-all with concurrent event/legacy redirect/deeplinks; уведомление не выполняет предметное действие.
- [ ] Materials/private URL/revocation, profile alias, OTP provider error, sessions revoke и first-password/suspended/cross-tab.
- [ ] RU/RO все маршруты/aria/error/title, long name100/filenames, четыре ширины, keyboard/zoom/reduced-motion.
- [ ] Route budgets и accessibility измерены на текущей сборке; root historical output не выдан за новые проверки.

Для визуального изменения: RU/RO,360/768/1024/1280, keyboard/focus/long text и relevant VIS11 states. Для read-model/API: validation, own/foreign scope, revoked context, no-store, error/empty/unknown и совместимость SDK. Для мутации: CSRF/idempotency/revision/unknown-result и отсутствие двойного эффекта. Не добавляй бессмысленный тест, который просто повторяет строку implementation; доказывай поведение.

## 9. Команды и безопасные границы проверки

Рабочий каталог `D:/OnlineSchool`. Это адресные ориентиры из текущих manifests, а не разрешение слепо запускать все команды. Прочитай scripts/конфиг теста перед запуском. Сборка может генерировать Prisma/SDK; это не разрешение запускать migration/seed или подключать реальную БД. Dist-based tests выполнять после целевой сборки.

```powershell
pnpm --filter @online-school/student-cabinet typecheck
```

```powershell
pnpm --filter @online-school/student-cabinet lint
```

```powershell
pnpm --filter @online-school/student-cabinet test:presentation
```

```powershell
pnpm --filter @online-school/student-cabinet build
```

```powershell
node scripts/k8k-design-check.mjs
```

- Создать test:k8k-student-gate с отдельным Playwright config/output и fixture-only network; затем запускать этот script вместо перезаписи output/stu12.

Если нужен новый тестовый script, сначала добавь его в manifest с явно безопасным локальным/mock target, затем запусти и запиши точную команду. Не выполняй `pnpm test`/recursive regression автоматически на каждом TASK. Полный разрешённый прогон относится к финальному блоку. Ошибка не основание ослабить линтер или выдавать NOT_RUN за PASS.

## 10. Критерии готовности

- [ ] Каждый базовый DASH-STU-01…07 имеет работающий авторитетный source и подтверждённый основной+отрицательный сценарий.
- [ ] Все TASK-024…034 acceptance либо PASS, либо конкретный blocking FAIL/NOT_RUN; отсутствуют неопределённые «готово в целом».
- [ ] Все student routes/critical states проверены RU/RO и на360/768/1024/1280; ошибки имеют owner task и evidence.
- [ ] Новые unit/HTTP/SDK/presentation checks включены в воспроизводимые scripts; фальшивого production/API evidence нет.
- [ ] Бандл <=250KiB по общему методу и accessibility defects текущего scope устранены либо блокируют gate.
- [ ] Отчёт отделяет student readiness от внешних/финансовых/юридических/provider/foundation gates и не включает автоматический rollout.

- [ ] Все использованные данные и действия имеют реальный авторитетный источник/проверку; нет выдуманных цифр, прав, кнопок и success.
- [ ] Отчёт различает исходный работающий код, новые изменения, свежие проверки и исторические доказательства.
- [ ] Не изменены рабочая БД, применённые migration checksums и production; необоснованные внешние эффекты отсутствуют.

## 11. Не входит в этот TASK

- Общий recursive regression всех ролей, релиз/merge/deploy, удаление legacy до владельческой приёмки.
- Production financial/provider calls, destructive DB suites, выдача прав и массовое заполнение данных ради тестов.

Обнаруженный соседний gap запиши с конкретным следующим TASK, не расширяй текущую задачу на весь redesign. Если требуется реально новое бизнес-решение или недоступный внешний провайдер — подготовь все независимые изменения и точный вопрос/блокер только по этому пункту. Не останавливайся на повторном согласовании ранее утверждённых правил.

## 12. Артефакты и отчёт для следующего кодера

- output/k8k-taskpack/task-035/report.md: commit/dirty diff, команды, результаты и ограничения.
- output/k8k-taskpack/task-035/acceptance.json: бинарные критерии и доказательства текущей версии; screenshots и accessibility вывод без секретов/URL.

Формат `output/k8k-tasks/TASK-035/report.md`:

```text
TASK: TASK-035
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
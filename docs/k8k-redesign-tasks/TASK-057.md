# TASK-057 — Споры о списании и исключения расписания без обхода директора

**Пакет:** K8K-FRONTEND-REBUILD v1.0,03.11.2026. **Блок:** 5 — Менеджер и CRM. **Модуль:** Абонементы, финансы и исключения.

**Входные зависимости:** [TASK-050](TASK-050.md), [TASK-056](TASK-056.md). Номер относится только к этому пакету, не к старым MGR/Phase0 TASK. **Учёт выполнения:** [EXECUTION_LOG](EXECUTION_LOG.md).

**Исходный статус:** Основные API/UI tasks/reschedule/dispute существуют; текущие pending director/manual finance состояния нужно ясно показать. Нельзя возвращаться к историческому самостоятельному ACCEPT менеджером.. Это описание кода на дату составления, не акт приёмки и не команда начать с нуля.

## 1. Команда AI-кодеру и результат

Выполни **только TASK-057** в существующем репозитории. Не начинай следующий TASK автоматически.

Довести manager task decision и schedule формы до точных approved workflows: менеджер предлагает, директор исполняет нужное исключение, частичная корректировка остаётся отдельным финансовым решением.

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

- [docs/online_academy_manager_task_decisions_2026_11_01.md](../online_academy_manager_task_decisions_2026_11_01.md) — **Полная отмена через директора; частичные запросы отдельно**: ACCEPT proposal, MANUAL_FINANCE_REVIEW и full effect.
- [docs/online_academy_manager_schedule_decisions_2026_10_31.md](../online_academy_manager_schedule_decisions_2026_10_31.md) — **Явные решения и применение регламентов**: 60min lead,24h,два переноса,директорское исключение.
- [apps/api/src/modules/manager/tasks/MGR-07.md](../../apps/api/src/modules/manager/tasks/MGR-07.md) — **Состояния и атомарность; Оспаривание и решение владельца**: CAS/source/replay/director version execution.
- [apps/api/src/modules/manager/schedule/MGR-06.md](../../apps/api/src/modules/manager/schedule/MGR-06.md) — **Переносы, отмены, approval**: Существующий Schedule и исключения.
- [docs/K8K_DESIGN_INSTRUCTIONS.md](../K8K_DESIGN_INSTRUCTIONS.md) — **§5.3 деньги/задачи; §5.1 states/actions**: Никакого ложного success и расширения прав.
- [AGENTS.md](../../AGENTS.md) — **CON override и финансовые полномочия**: Закрытые решения не переоткрывать.

Реальные точки входа в код/доказательства (существуют на дату пакета; если структура позже изменена, найди symbol через `rg`, не создавай дубликат):

- [apps/manager-web/src/pages/Task.tsx](../../apps/manager-web/src/pages/Task.tsx).
- [apps/manager-web/src/pages/Schedule.tsx](../../apps/manager-web/src/pages/Schedule.tsx).
- [apps/manager-web/src/components/business-forms.tsx](../../apps/manager-web/src/components/business-forms.tsx).
- [apps/api/src/modules/manager/tasks/manager-tasks.service.ts](../../apps/api/src/modules/manager/tasks/manager-tasks.service.ts).
- [apps/api/src/modules/manager/tasks/contracts.ts](../../apps/api/src/modules/manager/tasks/contracts.ts).
- [apps/api/src/modules/manager/schedule/manager-schedule.service.ts](../../apps/api/src/modules/manager/schedule/manager-schedule.service.ts).
- [apps/api/src/modules/manager/dto/manager-task.dto.ts](../../apps/api/src/modules/manager/dto/manager-task.dto.ts).
- [apps/api/src/modules/manager/dto/manager-schedule.dto.ts](../../apps/api/src/modules/manager/dto/manager-schedule.dto.ts).
- [apps/manager-web/src/hooks/use-command.ts](../../apps/manager-web/src/hooks/use-command.ts).

Визуальная опора: [template/newtemp.png](../../template/newtemp.png) — язык дизайна, не требования и не источник mock-цифр. Старые [template/*.webp](../../template/README.md) — только исторические примеры.

Инструменты кодера: начинай поиск исходников с `rg`; версии/лицензии проверяй через `pnpm view` и текущий lockfile. Для библиотечных API используй доступный Context7/официальные документы нужной версии; для интерфейса — локальный Playwright/browser harness и проверку реального рендера. Сначала проверь доступность MCP, не считай запись сервера доказательством авторизации. Repo-инструменты и локальные fixtures остаются рабочим fallback. Figma/внешний дизайн-сервис не обязательны для восстановления этого контекста. Не подключай реальные аккаунты/провайдеры ради mock smoke и не подменяй ими ограничения среды.

Официальные справочные сайты по теме; бизнес-контекст уже дан выше, интернет не нужен для его восстановления. Перед использованием API/версии библиотеки сверяй первичную документацию именно совместимой версии. Наличие ссылки не требует установки пакета:

- [React 18.3.1](https://18.react.dev/reference/react) — API текущей major-версии; не обновлять проект до React19 по latest-примеру.
- [TanStack Query v5](https://tanstack.com/query/latest/docs/framework/react/overview) — Чтения, query keys, invalidation, cancellation; выбранную minor сверять с package.json.
- [WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/) — Рабочая accessibility-рамка; axe не заменяет ручные проверки.
- [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots) — Воспроизводимые снимки и контролируемые fixtures.
- [Orval](https://orval.dev/) — Генерация SDK только штатным способом проекта.
- [EventCalendar](https://github.com/vkurko/calendar) — Официальный исходник @event-calendar/core; license/peer/версию перепроверить.

## 5. Предметные правила и сохранение поведения

- Claim OPEN→IN_PROGRESS, решения с current version/CAS; approvalStatus не равен terminal status. Read/claim/escalate не подтверждает денежный или учебный результат.
- ACCEPT менеджера — точное предложение, задача IN_PROGRESS/AWAITING_DIRECTOR или MANUAL_FINANCE_REVIEW. До director execution нет ledger publication/возвращённых прав/RESOLVED.
- Полная отмена возвращает всю исходную сумму в аванс того же финансового subscription и все исходно списанные уроки; это не выплата семье.
- Частичные деньги/уроки, включая positive amount+refundLessons0, не исполняются полной отменой и не закрываются автоматически. Один полный supplied effect нормализуется в оба полных эффекта, директор видит оба.
- Unknown/ambiguous/уже исправленный source не подменяется новым списанием; original paid snapshot задаёт предел, не сегодняшняя цена курса.
- Обычный create/reschedule minlead по принятойconfig60min. Ровно24h своевременно; два стандартных student transfers на один оплаченный урок, третий+ отдельный director decision.
- Teacher/academy инициативы и freeze не расходуют student transfer count. Legacy неизвестная история не считается0; позднее исключение без списания и третий перенос привязаны к точной ревизии/варианту.
- Late student cancellation может списывать право, но не подтверждает conducted lesson; компенсация учителю отдельна от обычного начисления за проведённый урок.

## 6. Контракты, данные и совместимость

- Existing resolve-reschedule/resolve-dispute/claim и Schedule SDK сохраняют version и idempotency. Директорские execution endpoints остаются только директорскими; manager ведёт к их status/reference.
- Resolve-dispute ACCEPT body содержит requested effect, не executed refund; response status/approvalStatus — источник UI. Unknown/nullable ledgerRef/chargedAmount/currency не трактуются как0.
- Schedule approval связан с lesson revision и точным target/initiator/reason; подпись менеджера overrideLateRule не создаёт authorization.
- После approved full cancellation task closure+published reversal+Audit/Outbox должны совпасть атомарно согласно серверному процессу; UI только читает итог, не воссоздаёт Finance последствия.

Точные имена новых planned DTO/operation/props запиши в коротком design note этого TASK до реализации и соблюдай существующие namespace/style. Planned нельзя выдавать за уже существующий API. Найденный существующий сервис переиспользуй. Generic UI не принимает бизнес-решения. Существующий авторитетный источник не копируется во второй реестр.

## 7. Пошаговое выполнение

1. Подтверди prerequisites по реальным артефактам предыдущих TASK и текущему коду. Недостающий результат не заменяй заглушкой или флагом с фиктивными данными. Не пересылай пользователю уже закрытые вопросы о чате, уведомлениях или director-only подтверждениях.
2. Сверить TaskDecision/DisputeForm/RescheduleForm c поздними owner docs и текущим contracts; составить таблицу command response→status/approvalStatus/effect labels.
3. Отобразить source deduction, chargedAmount/chargedLessons/currency, предложение и его version; поля результата показывать whitelist текстом, без arbitrary resolution JSON.
4. Для ACCEPT показать preview полного/частичного эффекта и предупреждение «предложение директору». Частичный вариант направить в MANUAL_FINANCE_REVIEW с сохранением task, не кнопкой refund.
5. Показать AWAITING_DIRECTOR/AWAITING_SCHEDULE_APPROVAL/manual review отдельно от RESOLVED; ledgerPublicationId только серверный после выполнения, не fabricated local reference.
6. Для schedule actions сохранять lessonId, current revision, initiator/reason и exact requested target. overrideLateRule означает запрос директору, не permission на изменение.
7. В UI объяснить24h boundary, student transfer count и legacy unknown; изменённое предложение после approval требует собственного review, старое approval не применяется к новому времени/учителю.
8. После решения директора manager повторяет согласованную schedule-команду с текущей task version и новым intent; старый ключ replay остаётся pending. Не делать этот повтор автоматическим в неизвестном состоянии.
9. Обработать CAS409/slot conflict/insufficient rights/closed financial period: сохранение ввода и refetch source, без частичного UI success. Atomic rollback на сервере не подменять optimistic moved lesson.
10. Перевести RU/RO, confirmations и safe explanations; проверить full/partial/legacy/director revision cases и отсутствие manager director-endpoint calls на local fixtures.
11. Сверь итог с правилами разделов3/5/6 этого же файла, обнови журнал и предметную матрицу, подготовь артефакты и остановись после отчёта по TASK-057.

## 8. Обязательные сценарии проверки

- [ ] ACCEPT менеджера оставляет IN_PROGRESS и нет ledger change; директорский source ещё pending.
- [ ] Full original effect показывает сумму+все уроки; частичный/amount positive+lessons0 уходит manual review.
- [ ] Неизвестный/исправленный source и сумма больше исходной запрещены без подстановки текущей цены.
- [ ] Ровно24h своевременно,24h−1ms поздно; третий student transfer требует approval, teacher/freeze count не расходуют.
- [ ] Legacy unknown transfers не объявлены0; изменение target/revision после approval не использует прежнее решение.
- [ ] Один approving execution не выполняется дважды; old key replay pending, новая согласованная команда имеет новый intent.
- [ ] Slot conflict/CAS/Audit failure не оставляют частично перенесённый UI или закрытую task.
- [ ] Late cancellation deduction не показывает COMPLETED/ordinary teacher pay; RU/RO/keyboard/phone forms корректны.

Для визуального изменения: RU/RO,360/768/1024/1280, keyboard/focus/long text и relevant VIS11 states. Для read-model/API: validation, own/foreign scope, revoked context, no-store, error/empty/unknown и совместимость SDK. Для мутации: CSRF/idempotency/revision/unknown-result и отсутствие двойного эффекта. Не добавляй бессмысленный тест, который просто повторяет строку implementation; доказывай поведение.

## 9. Команды и безопасные границы проверки

Рабочий каталог `D:/OnlineSchool`. Это адресные ориентиры из текущих manifests, а не разрешение слепо запускать все команды. Прочитай scripts/конфиг теста перед запуском. Сборка может генерировать Prisma/SDK; это не разрешение запускать migration/seed или подключать реальную БД. Dist-based tests выполнять после целевой сборки.

```powershell
pnpm test:mgr07
```

```powershell
pnpm test:mgr06
```

```powershell
pnpm --filter @online-school/manager-web test:unit
```

```powershell
pnpm --filter @online-school/manager-web typecheck
```

- Создать адресный Playwright grep director-proposals/schedule-exceptions на local MSW fixtures.

Если нужен новый тестовый script, сначала добавь его в manifest с явно безопасным локальным/mock target, затем запусти и запиши точную команду. Не выполняй `pnpm test`/recursive regression автоматически на каждом TASK. Полный разрешённый прогон относится к финальному блоку. Ошибка не основание ослабить линтер или выдавать NOT_RUN за PASS.

## 10. Критерии готовности

- [ ] Полный и частичный спор имеют разные маршруты; manager ACCEPT всегда proposal.
- [ ] Нет выплаты семье/частичного исполнения через full reversal и нет клиентского ledger adjustment.
- [ ] Schedule exceptions требуют точного director approval с current version/target.
- [ ] 24h/60min/две student transfers/legacy unknown реализованы по действующему серверу и тестам.
- [ ] Pending/manual/unknown/conflict не выдаются за RESOLVED/success, ввод сохраняется.

- [ ] Все использованные данные и действия имеют реальный авторитетный источник/проверку; нет выдуманных цифр, прав, кнопок и success.
- [ ] Отчёт различает исходный работающий код, новые изменения, свежие проверки и исторические доказательства.
- [ ] Не изменены рабочая БД, применённые migration checksums и production; необоснованные внешние эффекты отсутствуют.

## 11. Не входит в этот TASK

- Новый частичный финансовый engine, автоматический refund, изменения CON/transfer policy.
- Автоматическое director approval, изменение teacher pay из календаря и реальные reversal/write tests на mainDB.

Обнаруженный соседний gap запиши с конкретным следующим TASK, не расширяй текущую задачу на весь redesign. Если требуется реально новое бизнес-решение или недоступный внешний провайдер — подготовь все независимые изменения и точный вопрос/блокер только по этому пункту. Не останавливайся на повторном согласовании ранее утверждённых правил.

## 12. Артефакты и отчёт для следующего кодера

- output/k8k-taskpack/task-057/report.md: commit/dirty snapshot, реальные изменения, commands/results и ограничения.
- output/k8k-taskpack/task-057/acceptance.json: каждый критерий PASS/FAIL/NOT_RUN с актуальным unit/HTTP/browser evidence без секретов/PII.

Формат `output/k8k-tasks/TASK-057/report.md`:

```text
TASK: TASK-057
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

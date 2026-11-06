# TASK-061 — Директор: ревизионное одобрение исключений расписания и исполнение полной отмены спорного списания

**Пакет:** K8K-FRONTEND-REBUILD v1.0,03.11.2026. **Блок:** 6 — Директор, оператор, вход и приватность. **Модуль:** Директор: решения и предметная очередь.

**Входные зависимости:** [TASK-059](TASK-059.md), [TASK-060](TASK-060.md). Номер относится только к этому пакету, не к старым MGR/Phase0 TASK. **Учёт выполнения:** [EXECUTION_LOG](EXECUTION_LOG.md).

**Исходный статус:** Есть get/approve ScheduleChangeApproval и get/approve CrmDisputeResolution, exact lesson/change revision и task version. Partial dispute требует MANUAL_FINANCE_REVIEW. Director UI этих сценариев отсутствует; approval расписания само не применяет перенос.. Это описание кода на дату составления, не акт приёмки и не команда начать с нуля.

## 1. Команда AI-кодеру и результат

Выполни **только TASK-061** в существующем репозитории. Не начинай следующий TASK автоматически.

Дать директору две ясные отдельные карточки решения: точное исключение расписания и полная отмена исходного списания. Показать текущую ревизию, старое/новое, финансовый эффект и границы исполнения, не превращая manual partial case в автоматический refund.

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

- [docs/K8K_DESIGN_INSTRUCTIONS.md](../K8K_DESIGN_INSTRUCTIONS.md) — **5.1,5.4**: Общие состояния, реальные действия директора и запрет P&L
- [docs/K8K_Academy_VIS12_dashboard_module_contracts_v1.0.md](../K8K_Academy_VIS12_dashboard_module_contracts_v1.0.md) — **5,6,8**: DIR-01…06 условны, DIR-07 POST-MVP; базовые предметные полномочия не равны KPI
- [docs/online_academy_MVP_full_release_architecture_roadmap_v9.7.md](../online_academy_MVP_full_release_architecture_roadmap_v9.7.md) — **DEV-15…25; FIN/OPS; TECH-09/C**: Утверждённые предметные финансовые и управленческие процессы
- [docs/online_academy_manager_schedule_decisions_2026_10_31.md](../online_academy_manager_schedule_decisions_2026_10_31.md) — **Director exceptions**: Late/third move, exact immutable change и разовое применение
- [docs/online_academy_manager_task_decisions_2026_11_01.md](../online_academy_manager_task_decisions_2026_11_01.md) — **Full reversal/manual partial**: Возврат прав/аванса не равен перечислению семье
- [docs/scheduling_logistics_part_1_modules_01-05_v0.1 (1).md](../scheduling_logistics_part_1_modules_01-05_v0.1%20%281%29.md) — **TRF-02…05,TRF-17/18**: Своевременность, сохранение прав и лимиты переносов

Реальные точки входа в код/доказательства (существуют на дату пакета; если структура позже изменена, найди symbol через `rg`, не создавай дубликат):

- [apps/api/src/modules/schedule/manager/approval.controller.ts](../../apps/api/src/modules/schedule/manager/approval.controller.ts).
- [apps/api/src/modules/schedule/manager/workflow.service.ts](../../apps/api/src/modules/schedule/manager/workflow.service.ts).
- [apps/api/src/modules/finance/manager-disputes/director.controller.ts](../../apps/api/src/modules/finance/manager-disputes/director.controller.ts).
- [apps/api/src/modules/finance/manager-disputes/dispute.service.ts](../../apps/api/src/modules/finance/manager-disputes/dispute.service.ts).
- [apps/platform/src/App.tsx](../../apps/platform/src/App.tsx).
- [packages/api-contracts/src/index.ts](../../packages/api-contracts/src/index.ts).
- [tests/unit/manager-schedule-http.test.mjs](../../tests/unit/manager-schedule-http.test.mjs).
- [tests/unit/manager-tasks-http.test.mjs](../../tests/unit/manager-tasks-http.test.mjs).

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

- Schedule approval относится к конкретному lesson revision и точному payload; другое время/teacher/reason требует нового рассмотрения, не вечного override.
- Одобрить исключение не означает применить перенос: статусы APPROVED/APPLIED/STALE показываются раздельно, manager workflow завершает своё действие.
- Два обычных student timely moves на одно право; третий+ и late без списания требуют director. Неизвестная старая история не считается нулевой.
- Полная отмена спорного списания возвращает исходные права/исходную сумму в аванс того же subscription, а не переводит деньги семье.
- Partial requested effect остаётся MANUAL_FINANCE_REVIEW; full reversal command не используется как приближение частичного результата.
- Версия dispute proposal и полный денежный/количественный эффект видны до approve; повторное исполнение/closed-period rewrite недопустимы.
- Спор/appeal/прочтение карточки не меняют исходные факты до отдельной разрешённой команды.
- Серверная ACL/MFA/idempotency, audit/outbox и reconciliation неизменны; family auto messages не возникают из approval.

## 6. Контракты, данные и совместимость

- Existing getScheduleChangeApproval/approveScheduleChange и getCrmDisputeResolution/approveCrmDisputeResolution переиспользуются из SDK.
- Schedule approve endpoint получает ID immutable request; server перепроверяет lesson/change revision. Клиент не добавляет новый desired payload в старый approve.
- Dispute approve body содержит актуальную version; response возвращает task/ledger publication и исходные refund amount/lessons, не bank transfer receipt.
- Если source controller возвращает stale/not-found/409, UI запрещает blind retry и требует перечитать актуальный source; unknown сохраняет исходный operation correlation.
- Любое недостающее deny/request-more-info действие не рисовать рабочим без отдельного реального contract: допустимо существующее разрешённое CRM обращение/возврат на уточнение.

Точные имена новых planned DTO/operation/props запиши в коротком design note этого TASK до реализации и соблюдай существующие namespace/style. Planned нельзя выдавать за уже существующий API. Найденный существующий сервис переиспользуй. Generic UI не принимает бизнес-решения. Существующий авторитетный источник не копируется во второй реестр.

## 7. Пошаговое выполнение

1. Подтверди prerequisites по реальным артефактам предыдущих TASK и текущему коду. Недостающий результат не заменяй заглушкой или флагом с фиктивными данными. Не пересылай пользователю уже закрытые вопросы о чате, уведомлениях или director-only подтверждениях.
2. В detail расписания TASK-059 отобразить source lesson, initiator, причину, old/new starts/teacher и отдельный статус chargeable; timestamps в user timezone.
3. Сделать явное director approve с confirmation точного изменения и одной ожидаемой ревизии; после успеха показать «одобрено, ожидает применения», если backend не применял.
4. Показать STALE без возможности повторного approve, предложить вернуться к актуальному запросу; не строить новый change автоматически из старого payload.
5. В dispute detail вывести reason, requested amount/lessons, full original amount/lessons, currency, mode и task version; различить техническую отмену списания и cash refund.
6. Для FULL_REVERSAL подключить approveCrmDisputeResolution с version, confirmation и safe status refresh. При MANUAL_REVIEW убрать full-execute кнопку и показать отдельный ручной финансовый маршрут.
7. Проверить сценарий одного заполненного полного поля: серверный preview показывает оба эффекта до исполнения; refundLessons0 с positive money остаётся partial.
8. Сохранить связь queue→detail→source task/lesson и возврат без потери фильтров; stale/error/unknown не сбрасывают выбранный контекст.
9. Локализовать RU/RO причины/стадии/пояснение директорского решения и доступность диалогов; technical codes не выдавать как пользовательские тексты.
10. Добавить fixture/HTTP проверки stale revisions, double execution и manual partial, regression manager/student dispute view; не исполнять реальные исправления ledger.
11. Сверь итог с правилами разделов3/5/6 этого же файла, обнови журнал и предметную матрицу, подготовь артефакты и остановись после отчёта по TASK-061.

## 8. Обязательные сценарии проверки

- [ ] Одобрить точное late/third move исключение, затем применить manager workflow: один approved request и одно фактическое изменение.
- [ ] Изменить lesson revision между detail/approve: сервер отказывает, UI показывает STALE без silent payload recreation.
- [ ] Повторный approve/replay не даёт общего разрешения на новый change и не дублирует эффект.
- [ ] Полный dispute reversal восстанавливает точные original rights/advance и атомарно закрывает задачу, не создавая cash payout.
- [ ] Partial money/lessons и явный lessons0+money показывают MANUAL_REVIEW; full endpoint такое не исполняет.
- [ ] Старое уже исправленное consumption нельзя отменить ещё раз; закрытая история не перезаписывается.
- [ ] Manager/operator/student прямым API не утверждают решение; revoke/MFA/recovery-only проверены.
- [ ] RU/RO и narrow/keyboard flows честно различают approved/applied/resolved/manual/unknown.

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
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/unit/manager-schedule.test.mjs tests/unit/manager-schedule-http.test.mjs tests/unit/manager-tasks.test.mjs tests/unit/manager-tasks-http.test.mjs --runInBand
```

Если нужен новый тестовый script, сначала добавь его в manifest с явно безопасным локальным/mock target, затем запусти и запиши точную команду. Не выполняй `pnpm test`/recursive regression автоматически на каждом TASK. Полный разрешённый прогон относится к финальному блоку. Ошибка не основание ослабить линтер или выдавать NOT_RUN за PASS.

## 10. Критерии готовности

- [ ] Два решения представлены отдельными предметными карточками с понятными последствиями.
- [ ] Schedule exact revision и approval/application independence сохранены.
- [ ] Full reversal ограничен полным исходным эффектом, partial не подменён полной отменой.
- [ ] Повторы/конфликты/unknown не создают двойной финансовый или календарный эффект.
- [ ] RU/RO accessibility и source-navigation проверены адресно.
- [ ] Existing manager/student workflows остаются совместимыми, реальные ledger данные не изменялись проверкой.

- [ ] Все использованные данные и действия имеют реальный авторитетный источник/проверку; нет выдуманных цифр, прав, кнопок и success.
- [ ] Отчёт различает исходный работающий код, новые изменения, свежие проверки и исторические доказательства.
- [ ] Не изменены рабочая БД, применённые migration checksums и production; необоснованные внешние эффекты отсутствуют.

## 11. Не входит в этот TASK

- Новая partial reversal формула и банковский refund
- Одобрение любого будущего изменения по одному флагу
- Автоматическое закрытие спора или отправка семье без предметного исполнения

Обнаруженный соседний gap запиши с конкретным следующим TASK, не расширяй текущую задачу на весь redesign. Если требуется реально новое бизнес-решение или недоступный внешний провайдер — подготовь все независимые изменения и точный вопрос/блокер только по этому пункту. Не останавливайся на повторном согласовании ранее утверждённых правил.

## 12. Артефакты и отчёт для следующего кодера

- Скриншоты exact-change и full/manual dispute confirmation RU/RO
- Case evidence stale/duplicate/reversal independence
- Матрица approval versus application/financial publication стадий

Формат `output/k8k-tasks/TASK-061/report.md`:

```text
TASK: TASK-061
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

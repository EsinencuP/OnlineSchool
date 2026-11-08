# TASK-056 — Поступления, распределения и директорские допуски: точный финансовый UI

**Пакет:** K8K-FRONTEND-REBUILD v1.0,03.11.2026. **Блок:** 5 — Менеджер и CRM. **Модуль:** Абонементы, финансы и исключения.

**Входные зависимости:** [TASK-048](TASK-048.md), [TASK-055](TASK-055.md). Номер относится только к этому пакету, не к старым MGR/Phase0 TASK. **Учёт выполнения:** [EXECUTION_LOG](EXECUTION_LOG.md).

**Исходный статус:** Существуют receipt/distribution forms и Finance facade; manager-confirm уже отправляет на approval. Требуются K8K/actions, точные подписи всех состояний и полная демонстрация partial admission без обхода директора.. Это описание кода на дату составления, не акт приёмки и не команда начать с нуля.

## 1. Команда AI-кодеру и результат

Выполни **только TASK-056** в существующем репозитории. Не начинай следующий TASK автоматически.

Дать менеджеру безопасно зарегистрировать поступление/подготовить распределение и видеть этап одобрения, не смешивая contact receipt, деньги ученика, оплаченные права и ограниченный допуск.

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

- [docs/online_academy_manager_payment_decisions_2026_10_31.md](../online_academy_manager_payment_decisions_2026_10_31.md) — **Подтверждённое решение; действующие ограничения**: Новые receipts только MDL; manager не публикует.
- [docs/online_academy_manager_finance_distribution_clarification_2026_10_31.md](../online_academy_manager_finance_distribution_clarification_2026_10_31.md) — **п.1–7**: CUSTOMER_ADVANCE, contact vsrecipient, mixed household, distributionId.
- [docs/online_academy_manager_dashboard_decisions_2026_11_01.md](../online_academy_manager_dashboard_decisions_2026_11_01.md) — **Ожидающие оплаты**: Pending approval и confirmed unallocated residual.
- [apps/api/src/modules/manager/payments/MGR-05.md](../../apps/api/src/modules/manager/payments/MGR-05.md) — **Распределения и MGR-03/04; Границы и безопасность**: Подготовка не выдаёт права; Finance facade only.
- [docs/online_academy_CON_01_11_owner_decisions_addendum_v1.0.md](../online_academy_CON_01_11_owner_decisions_addendum_v1.0.md) — **Частичная оплата/рассрочка и полномочия директора**: Каждый partial admission отдельно, без installment carveout.
- [docs/K8K_DESIGN_INSTRUCTIONS.md](../K8K_DESIGN_INSTRUCTIONS.md) — **§5.3 Деньги; §3.2 числа**: Раздельные поля/точные строки/capabilities.

Реальные точки входа в код/доказательства (существуют на дату пакета; если структура позже изменена, найди symbol через `rg`, не создавай дубликат):

- [apps/manager-web/src/pages/student/Payments.tsx](../../apps/manager-web/src/pages/student/Payments.tsx).
- [apps/manager-web/src/components/business-forms.tsx](../../apps/manager-web/src/components/business-forms.tsx).
- [apps/manager-web/src/lib/money.ts](../../apps/manager-web/src/lib/money.ts).
- [apps/api/src/modules/manager/payments/manager-payments.service.ts](../../apps/api/src/modules/manager/payments/manager-payments.service.ts).
- [apps/api/src/modules/manager/dto/manager-payment.dto.ts](../../apps/api/src/modules/manager/dto/manager-payment.dto.ts).
- [apps/api/src/modules/manager/finance/manager-finance.facade.ts](../../apps/api/src/modules/manager/finance/manager-finance.facade.ts).
- [apps/manager-web/src/pages/Student.tsx](../../apps/manager-web/src/pages/Student.tsx).
- [apps/manager-web/src/pages/Account.tsx](../../apps/manager-web/src/pages/Account.tsx).
- [apps/manager-web/src/i18n/error-messages.ts](../../apps/manager-web/src/i18n/error-messages.ts).

Визуальная опора: [template/newtemp.png](../../template/newtemp.png) — язык дизайна, не требования и не источник mock-цифр. Старые [template/*.webp](../../template/README.md) — только исторические примеры.

Инструменты кодера: начинай поиск исходников с `rg`; версии/лицензии проверяй через `pnpm view` и текущий lockfile. Для библиотечных API используй доступный Context7/официальные документы нужной версии; для интерфейса — локальный Playwright/browser harness и проверку реального рендера. Сначала проверь доступность MCP, не считай запись сервера доказательством авторизации. Repo-инструменты и локальные fixtures остаются рабочим fallback. Figma/внешний дизайн-сервис не обязательны для восстановления этого контекста. Не подключай реальные аккаунты/провайдеры ради mock smoke и не подменяй ими ограничения среды.

Официальные справочные сайты по теме; бизнес-контекст уже дан выше, интернет не нужен для его восстановления. Перед использованием API/версии библиотеки сверяй первичную документацию именно совместимой версии. Наличие ссылки не требует установки пакета:

- [React 18.3.1](https://18.react.dev/reference/react) — API текущей major-версии; не обновлять проект до React19 по latest-примеру.
- [TanStack Query v5](https://tanstack.com/query/latest/docs/framework/react/overview) — Чтения, query keys, invalidation, cancellation; выбранную minor сверять с package.json.
- [WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/) — Рабочая accessibility-рамка; axe не заменяет ручные проверки.
- [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots) — Воспроизводимые снимки и контролируемые fixtures.
- [Orval](https://orval.dev/) — Генерация SDK только штатным способом проекта.

## 5. Предметные правила и сохранение поведения

- Новые receipt currency только MDL/defaultMDL; legacy другие валюты читаются без переписывания/конвертации. Все суммы Decimal strings, source precision до4 сохраняется.
- Тексты «заявлено/поступило/подтверждено/распределение предложено/опубликовано/допущено» не взаимозаменяемы. Manager-confirm PENDING→AWAITING_APPROVAL — отправка, не confirm денег.
- Только директор подтверждает поступление, утверждает распределение и исполняет финальные refunds/admissions. Manager UI не вызывает director endpoint под видом quick action.
- Receipt.student_id — контакт. Баланс ученика — опубликованный CUSTOMER_ADVANCE его абонементов по валютам; семейный нераспределённый остаток и вся receipt amount не являются его деньгами.
- Контактный portfolio и recipient scope проверяются отдельно; shared receipt не раскрывает другим детям их allocations/notes, mixed household суммы не показываются в одной student card.
- Пока cumulative confirmed allocated payment ниже full price, каждое новое распределение требует нового отдельного ограниченного director decision. Предыдущее разрешение не переносится на следующий взнос, в том числе same timestamp.
- После полного накопленного платежа используются обычные paid rights без второго гранта. Подготовка/предложение/ожидание approval не выдаёт прав и не активирует аккаунт само по себе.

## 6. Контракты, данные и совместимость

- Existing create/confirm/reject/prepare/allocate/list payments/distributions SDK остаются. Action названия уточняются, права Finance не расширяются. Manager mutation не содержит произвольного publish=true или director override.
- Balance DTO {currency,amount:string}[] относится к published CUSTOMER_ADVANCE; receipt amount/remaining unallocated показываются только в соответствующем scoped представлении. Currency sums не объединяются.
- Admission projection при необходимости additive: approved source/revision, valid interval/remaining limit/reason code; private director notes не раскрываются. Client не посылает approvedBy/approvedAt.
- Prepared distribution unique consumption относится к distributionId, не paymentId. Duplicate command/reference/conflict сохраняют нынешние safe codes и version/current authorization.

Точные имена новых planned DTO/operation/props запиши в коротком design note этого TASK до реализации и соблюдай существующие namespace/style. Planned нельзя выдавать за уже существующий API. Найденный существующий сервис переиспользуй. Generic UI не принимает бизнес-решения. Существующий авторитетный источник не копируется во второй реестр.

## 7. Пошаговое выполнение

1. Подтверди prerequisites по реальным артефактам предыдущих TASK и текущему коду. Недостающий результат не заменяй заглушкой или флагом с фиктивными данными. Не пересылай пользователю уже закрытые вопросы о чате, уведомлениях или director-only подтверждениях.
2. Составить financial UI truth table receipt status/distribution status/publication/admission/paid-rights; проверить текущие labels/actions и prepared package flow.
3. Заменить role/status-only controls на server action capabilities TASK-048. Кнопку manager-confirm назвать Отправить на одобрение/RO, текст последствий явно исключает финансовую публикацию.
4. Разнести receipts контакта, allocations получателя и его ledger balances на отдельные представления/подписи; не объединять их в «баланс семьи/ученика» ради карточки.
5. Сохранить prepare-subscription/allocate commands через Finance facade: enrollment/plan/amount/startsAt только разрешённые поля. После proposal показывать current status и ожидание директора без зелёного «оплачено».
6. Показывать partial admission отдельно: наличие/срок/лимит/источник последнего решения при разрешённом read-contract. Не вычислять allowance от суммы и не показывать старое разрешение как действующее после нового allocation.
7. Добавить понятные переходы к директорскому рассмотрению только как permitted routing/reference, не manager execution. Недостающий admission read-field добавить минимально из Finance-owned source, не новый ledger.
8. Проверить formatMoney/MoneyInput на exact strings, большие значения,0,precision1–4 и localeRU/RO. Удалить Number/parseFloat/toNumber над деньгами; Intl применять к безопасным строковым/BigInt представлениям.
9. Сохранить stable idempotency intent, duplicate reference409, current scope/cached replay и state pending/unknown. После неизвестного исхода сверять текущий receipt/distribution, не подтверждать повторно новым ключом вслепую.
10. Обновить mocks/tests/SDK labels и приёмку двух детей одного receipt, двух менеджеров, partial→full. Никаких реальных переводов/публикаций на рабочей БД в UI QA.
11. Сверь итог с правилами разделов3/5/6 этого же файла, обнови журнал и предметную матрицу, подготовь артефакты и остановись после отчёта по TASK-056.

## 8. Обязательные сценарии проверки

- [ ] MDL creation/defaultMDL разрешено, новая иная валюта отклонена; legacyEUR/USD читаются точно.
- [ ] Manager отправка даёт AWAITING_APPROVAL и не публикует ledger/rights; direct director call manager запрещён.
- [ ] Один receipt на двух детей: каждый видит только свои allocations/balance, contact не раскрывает другого получателя.
- [ ] Partial без нового director permission не допускает; agreed installments также требуют решения на каждый взнос.
- [ ] Последующее allocation отзывает старый partial admission, включая equal timestamp; UI не использует stale allowance.
- [ ] Полная cumulative оплата выдаёт обычный доступ без дублированных grants/остатка.
- [ ] 600.1234/1.005/large amount/несколько валют сохраняют точность; pending/unknown/duplicate409 не false-success.
- [ ] 401/403/portfolio revoke между открытием и исполнением/повтором блокируют действие; RU/RO forms читаемы.

Для визуального изменения: RU/RO,360/768/1024/1280, keyboard/focus/long text и relevant VIS11 states. Для read-model/API: validation, own/foreign scope, revoked context, no-store, error/empty/unknown и совместимость SDK. Для мутации: CSRF/idempotency/revision/unknown-result и отсутствие двойного эффекта. Не добавляй бессмысленный тест, который просто повторяет строку implementation; доказывай поведение.

## 9. Команды и безопасные границы проверки

Рабочий каталог `D:/OnlineSchool`. Это адресные ориентиры из текущих manifests, а не разрешение слепо запускать все команды. Прочитай scripts/конфиг теста перед запуском. Сборка может генерировать Prisma/SDK; это не разрешение запускать migration/seed или подключать реальную БД. Dist-based tests выполнять после целевой сборки.

```powershell
pnpm test:mgr05
```

```powershell
pnpm test:mgr03
```

```powershell
pnpm test:mgr04
```

```powershell
pnpm --filter @online-school/manager-web test:unit
```

```powershell
pnpm --filter @online-school/manager-web typecheck
```

Если нужен новый тестовый script, сначала добавь его в manifest с явно безопасным локальным/mock target, затем запусти и запиши точную команду. Не выполняй `pnpm test`/recursive regression автоматически на каждом TASK. Полный разрешённый прогон относится к финальному блоку. Ошибка не основание ослабить линтер или выдавать NOT_RUN за PASS.

## 10. Критерии готовности

- [ ] Manager execution/директорская публикация и admission раздельны в controls/API/тестах.
- [ ] Каждое partial allocation явно требует собственного действующего решения, без carveout рассрочки.
- [ ] Contact receipt/customer advance/allocated rights/temporary limit не смешиваются.
- [ ] Суммы/валюты/precision точны и не проходят IEEE conversion.
- [ ] Unknown/replay/scope/двое детей/partial→full проверены без реальных денежных операций.

- [ ] Все использованные данные и действия имеют реальный авторитетный источник/проверку; нет выдуманных цифр, прав, кнопок и success.
- [ ] Отчёт различает исходный работающий код, новые изменения, свежие проверки и исторические доказательства.
- [ ] Не изменены рабочая БД, применённые migration checksums и production; необоснованные внешние эффекты отсутствуют.

## 11. Не входит в этот TASK

- Новый payment gateway, card checkout, refund engine или отмена существующих promised obligations.
- Изменение формул Finance, автоматическое директорское одобрение и реальные денежные smoke.

Обнаруженный соседний gap запиши с конкретным следующим TASK, не расширяй текущую задачу на весь redesign. Если требуется реально новое бизнес-решение или недоступный внешний провайдер — подготовь все независимые изменения и точный вопрос/блокер только по этому пункту. Не останавливайся на повторном согласовании ранее утверждённых правил.

## 12. Артефакты и отчёт для следующего кодера

- output/k8k-taskpack/task-056/report.md: commit/dirty snapshot, реальные изменения, commands/results и ограничения.
- output/k8k-taskpack/task-056/acceptance.json: каждый критерий PASS/FAIL/NOT_RUN с актуальным unit/HTTP/browser evidence без секретов/PII.

Формат `output/k8k-tasks/TASK-056/report.md`:

```text
TASK: TASK-056
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

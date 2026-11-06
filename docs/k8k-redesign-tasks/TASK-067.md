# TASK-067 — AccountMenu: RU/RO, demo switching, logout и синхронная смена session во всех вкладках

**Пакет:** K8K-FRONTEND-REBUILD v1.0,03.11.2026. **Блок:** 6 — Директор, оператор, вход и приватность. **Модуль:** Общий вход, сессии и защита данных.

**Входные зависимости:** [TASK-019](TASK-019.md), [TASK-020](TASK-020.md), [TASK-066](TASK-066.md). Номер относится только к этому пакету, не к старым MGR/Phase0 TASK. **Учёт выполнения:** [EXECUTION_LOG](EXECUTION_LOG.md).

**Исходный статус:** packages/account-ui уже содержит AccountMenu, getAccounts, switchDemoUser/logout, CSRF mutation и BroadcastChannel school-account; полная навигация очищает runtime. Demo switch server ограничен фиксированными аккаунтами и двумя flags. Меню/role labels/ошибки в основном RU, нужна интеграция с foundation session019 и locale.. Это описание кода на дату составления, не акт приёмки и не команда начать с нуля.

## 1. Команда AI-кодеру и результат

Выполни **только TASK-067** в существующем репозитории. Не начинай следующий TASK автоматически.

Сохранить безопасное переключение демонстрационных пользователей и выход во всех кабинетах, оформить единое доступное K8K меню RU/RO, исключить двойную session orchestration и кратковременную утечку прежних данных между вкладками/ролями.

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

- [docs/K8K_DESIGN_INSTRUCTIONS.md](../K8K_DESIGN_INSTRUCTIONS.md) — **3,5.1:7,8**: Общий shell, Icon/avatar, reset cache при session смене
- [docs/platform_account_switching_2026_11_01.md](../platform_account_switching_2026_11_01.md) — **Switch endpoint/flags/cross-tab**: Фиксированные demo accounts, новая session и отсутствие паролей на клиенте
- [docs/online_academy_technical_architecture_part_01_v3.2.md](../online_academy_technical_architecture_part_01_v3.2.md) — **ARCH-08/B,ARCH-09/B,ARCH-18/B**: Сессия, серверная роль и sensitive actions
- [docs/platform_demo_dataset_2026_11_01.md](../platform_demo_dataset_2026_11_01.md) — **Demo scope**: Синтетические данные не реальные платежи/Meet
- [docs/manager_password_login_owner_decision_2026_11_01.md](../manager_password_login_owner_decision_2026_11_01.md) — **Auth exception**: Не превращать demo UX в глобальный password-only доступ

Реальные точки входа в код/доказательства (существуют на дату пакета; если структура позже изменена, найди symbol через `rg`, не создавай дубликат):

- [packages/account-ui/src/index.tsx](../../packages/account-ui/src/index.tsx).
- [packages/account-ui/src/style.css](../../packages/account-ui/src/style.css).
- [apps/api/src/modules/identity/demo-accounts.ts](../../apps/api/src/modules/identity/demo-accounts.ts).
- [apps/api/src/modules/identity/identity.controller.ts](../../apps/api/src/modules/identity/identity.controller.ts).
- [apps/api/src/modules/platform/platform.module.ts](../../apps/api/src/modules/platform/platform.module.ts).
- [apps/api/src/modules/platform/platform.dto.ts](../../apps/api/src/modules/platform/platform.dto.ts).
- [apps/platform/src/App.tsx](../../apps/platform/src/App.tsx).
- [tests/unit/platform-switch-http.test.mjs](../../tests/unit/platform-switch-http.test.mjs).

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

- Demo switch заменяет session на разрешённый fixed account, не назначает новую роль старому пользователю и не является arbitrary impersonation.
- Каталог/разрешение switch определяет сервер при PLATFORM_DEMO_SWITCHING и QA_PASSWORD_ONLY_LOGIN; frontend flag/подмена key не обходят policy.
- Пароли/хеши/cookie/proof не входят в JS каталог, DOM меню, browser storage и межвкладочное сообщение.
- Logout,401 и успешный switch очищают queries/private DOM/формы/подписки предыдущего пользователя до нового cabinet render.
- Один общий session controller TASK-019 отвечает за cross-tab invalidation; AccountMenu не заводит несовместимый второй канал или competing redirects.
- Dirty input защищён при обычной навигации; явный switch/logout требует понятного предупреждения по общей политике и никогда не переносит private draft другому аккаунту.
- RU/RO локализует role/status/labels/errors, пользовательские имена/DEMO маркировка отображаются из реального каталога без фото/вымысла.
- Меню доступно клавиатурой, Esc/outside click/focus return согласованы; во время pending исключён double switch и unknown outcome не объявлен success.

## 6. Контракты, данные и совместимость

- Existing getPlatformAccounts/getAccounts и switchDemoUser POST /api/v1/auth/switch-user {key}, deleteSession остаются источником authority; arbitrary UUID/role input не поддерживается.
- Межвкладочный сигнал несёт только session invalidation reason/нечувствительную корреляцию по foundation019, не cookie/token/login/proof.
- Успешный switch response home проверяется against allowed routes; roleHome логика едина с TASK-020, pathname клиента не меняет серверную роль.
- 401/revoked signal инициирует общий session-expired flow; error transport после отправки критической команды не порождает blind new switch request.
- Клиент очищает private state, сервер отзывает старую session атомарно. Очистка browser cache не подменяет server revoke и не отменяет MFA policy.

Точные имена новых planned DTO/operation/props запиши в коротком design note этого TASK до реализации и соблюдай существующие namespace/style. Planned нельзя выдавать за уже существующий API. Найденный существующий сервис переиспользуй. Generic UI не принимает бизнес-решения. Существующий авторитетный источник не копируется во второй реестр.

## 7. Пошаговое выполнение

1. Подтверди prerequisites по реальным артефактам предыдущих TASK и текущему коду. Недостающий результат не заменяй заглушкой или флагом с фиктивными данными. Не пересылай пользователю уже закрытые вопросы о чате, уведомлениях или director-only подтверждениях.
2. Сверить AccountMenu существующую BroadcastChannel/full-navigation реализацию с foundation019: оставить один contract session-changed/logout signal и единые роли homes.
3. Перевести тексты, role labels, aria labels, busy/error/expired сообщения на общие RU/RO ключи; убрать local hardcoded второй словарь ролей.
4. Использовать K8K avatar initials/Icon/menu primitives без фото людей/emoji UI; сохранить понятный текущий account/role и метку демо.
5. Показывать switch section только при server enabled; disabled catalogue не должен раскрывать недопустимые аккаунты или предлагать рабочую кнопку.
6. Подключить switchDemoUser/deleteSession через единый transport CSRF/idempotency policy; allowed home ограничить известными role routes, неизвестный home безопасно отклонить.
7. Синхронно на успешном session replacement очистить query caches/DOM/abortable requests текущей вкладки, уведомить другие безопасным signal без PII и выполнить разрешённую навигацию.
8. Обработать failure/401/timeout/unknown, double click и race logout-vs-switch: отсутствие подтверждённой новой session не оставляет старый cabinet ready под чужим именем.
9. Добавить dirty-state confirmation по общей политике без сохранения student/teacher текста в долговечном общем storage; cross-tab invalidation не пытается сохранить приватный draft.
10. Пройти RU/RO keyboard/outside/Esc/mobile и одновременные вкладки teacher/director/student fixtures; серверные flags/revoke/deny регрессионно проверить существующими switch tests.
11. Сверь итог с правилами разделов3/5/6 этого же файла, обнови журнал и предметную матрицу, подготовь артефакты и остановись после отчёта по TASK-067.

## 8. Обязательные сценарии проверки

- [ ] Разрешённый demo switch меняет реального пользователя/роль, старая session отозвана; arbitrary key/role/UUID отклонены.
- [ ] Один или оба server flags выключены, обычный/recovery-only account — switch не виден/не исполняется.
- [ ] Две вкладки и запрос в полёте: обе теряют прежний private DOM/cache, поздний response старого аккаунта не рендерится.
- [ ] Logout/401/revoke и гонка switch/logout не оставляют полноценную старую сессию или циклическую переадресацию.
- [ ] Password/hash/token не присутствуют в catalogue/network/log/storage/BroadcastChannel payload.
- [ ] Dirty form при явном switch показывает обоснованную политику, после принятия private ввод не переходит другому пользователю.
- [ ] RU↔RO меняет меню/role labels, выбранный язык сохраняется по locale foundation; пользовательские имена не переводятся.
- [ ] Keyboard Enter/Space/Tab/Esc/outside click и focus return работают на360/768/1024/1280.
- [ ] Timeout/double-click/unknown не создаёт несколько session replacements и не показывает ложный success.

Для визуального изменения: RU/RO,360/768/1024/1280, keyboard/focus/long text и relevant VIS11 states. Для read-model/API: validation, own/foreign scope, revoked context, no-store, error/empty/unknown и совместимость SDK. Для мутации: CSRF/idempotency/revision/unknown-result и отсутствие двойного эффекта. Не добавляй бессмысленный тест, который просто повторяет строку implementation; доказывай поведение.

## 9. Команды и безопасные границы проверки

Рабочий каталог `D:/OnlineSchool`. Это адресные ориентиры из текущих manifests, а не разрешение слепо запускать все команды. Прочитай scripts/конфиг теста перед запуском. Сборка может генерировать Prisma/SDK; это не разрешение запускать migration/seed или подключать реальную БД. Dist-based tests выполнять после целевой сборки.

```powershell
pnpm --filter @online-school/account-ui typecheck
```

```powershell
pnpm --filter @online-school/account-ui lint
```

```powershell
pnpm --filter @online-school/platform typecheck
```

```powershell
node --experimental-vm-modules node_modules/jest/bin/jest.js tests/unit/platform-switch-http.test.mjs tests/unit/qa-password-login.test.mjs --runInBand
```

Если нужен новый тестовый script, сначала добавь его в manifest с явно безопасным локальным/mock target, затем запусти и запиши точную команду. Не выполняй `pnpm test`/recursive regression автоматически на каждом TASK. Полный разрешённый прогон относится к финальному блоку. Ошибка не основание ослабить линтер или выдавать NOT_RUN за PASS.

## 10. Критерии готовности

- [ ] Все кабинеты используют одно RU/RO AccountMenu и единый session019 lifecycle.
- [ ] Demo switching ограничено прежними серверными условиями, privilege escalation отсутствует.
- [ ] Cross-tab/cache/DOM race после switch/logout/401 проверены без утечки прежних данных.
- [ ] Меню доступно, K8K оформлено и честно обрабатывает pending/unknown/error.
- [ ] Секреты и private drafts не сохраняются/не передаются между аккаунтами.
- [ ] Existing switch/session/auth tests проходят адресно, реальный произвольный аккаунт не сбрасывался.

- [ ] Все использованные данные и действия имеют реальный авторитетный источник/проверку; нет выдуманных цифр, прав, кнопок и success.
- [ ] Отчёт различает исходный работающий код, новые изменения, свежие проверки и исторические доказательства.
- [ ] Не изменены рабочая БД, применённые migration checksums и production; необоснованные внешние эффекты отсутствуют.

## 11. Не входит в этот TASK

- Impersonation любых пользователей и новая role chooser авторизация
- Расширение demo flags в постоянную production auth policy
- Перепубликация секретов/паролей и синтетическое изображение реальных денег

Обнаруженный соседний gap запиши с конкретным следующим TASK, не расширяй текущую задачу на весь redesign. Если требуется реально новое бизнес-решение или недоступный внешний провайдер — подготовь все независимые изменения и точный вопрос/блокер только по этому пункту. Не останавливайся на повторном согласовании ранее утверждённых правил.

## 12. Артефакты и отчёт для следующего кодера

- Единый session-change/cross-tab contract и список consumers
- RU/RO keyboard/mobile menu evidence
- Race/revoke/no-secret tests и dirty-input isolation record

Формат `output/k8k-tasks/TASK-067/report.md`:

```text
TASK: TASK-067
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

# TASK-034 — Полная RU/RO локализация, материалы, профиль и безопасность

**Пакет:** K8K-FRONTEND-REBUILD v1.0,03.11.2026. **Блок:** 3 — Кабинет ученика. **Модуль:** События, локализация и приёмка.

**Входные зависимости:** [TASK-024](TASK-024.md), [TASK-027](TASK-027.md), [TASK-033](TASK-033.md). Номер относится только к этому пакету, не к старым MGR/Phase0 TASK. **Учёт выполнения:** [EXECUTION_LOG](EXECUTION_LOG.md).

**Исходный статус:** Частично: locale ru/ro и переведённые nav/freshness/reports уже есть. Materials/profile/security/password/suspended, ошибки и aria требуют полного перевода.. Это описание кода на дату составления, не акт приёмки и не команда начать с нуля.

## 1. Команда AI-кодеру и результат

Выполни **только TASK-034** в существующем репозитории. Не начинай следующий TASK автоматически.

Закончить ученический кабинет на RU и RO, сохранив приватные файловые разрешения, профильный alias, безопасные password/email/session команды и простой suspended экран.

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

- [docs/K8K_REDESIGN_PLAN.md](../K8K_REDESIGN_PLAN.md) — **Основание; этап1/3; Приёмка**: Последнее решение владельца: RU/RO в текущем выпуске.
- [docs/K8K_DESIGN_INSTRUCTIONS.md](../K8K_DESIGN_INSTRUCTIONS.md) — **§3.2/3.3; §5.1/5.2; §6**: Формат денег/дат, доступность и отсутствие фиктивных данных.
- [apps/api/src/student/materials/README.md](../../apps/api/src/student/materials/README.md) — **API; Explicit ownership and source mapping; Private Signed GET**: FilePermission не равно subject enrollment; private URL/expiry.
- [apps/api/src/student/security/README.md](../../apps/api/src/student/security/README.md) — **Маршруты и ограничения; Профиль и аватар; уточнение MGR-03**: Секреты вне generic cache; bootstrap и access policy.
- [docs/manager_password_login_owner_decision_2026_11_01.md](../manager_password_login_owner_decision_2026_11_01.md) — **Актуальное решение о входе**: Применять последнее решение, не старый MFA/password flow.
- [docs/platform_account_switching_2026_11_01.md](../platform_account_switching_2026_11_01.md) — **Переходы между пользователями**: Смена session и очистка прежнего кабинета.

Реальные точки входа в код/доказательства (существуют на дату пакета; если структура позже изменена, найди symbol через `rg`, не создавай дубликат):

- [packages/ui/src/locale.tsx](../../packages/ui/src/locale.tsx).
- [apps/student-cabinet/src/pages/Account.tsx](../../apps/student-cabinet/src/pages/Account.tsx).
- [apps/student-cabinet/src/pages/Learning.tsx](../../apps/student-cabinet/src/pages/Learning.tsx).
- [apps/student-cabinet/src/components.tsx](../../apps/student-cabinet/src/components.tsx).
- [apps/student-cabinet/src/api.ts](../../apps/student-cabinet/src/api.ts).
- [apps/student-cabinet/src/Layout.tsx](../../apps/student-cabinet/src/Layout.tsx).
- [apps/student-cabinet/src/router.tsx](../../apps/student-cabinet/src/router.tsx).
- [packages/account-ui/src/index.tsx](../../packages/account-ui/src/index.tsx).
- [apps/api/src/student/materials/materials.dto.ts](../../apps/api/src/student/materials/materials.dto.ts).
- [apps/api/src/student/security/security.dto.ts](../../apps/api/src/student/security/security.dto.ts).

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

- Новые RU/RO требования действуют для всех состояний/подписей/aria/title/ошибок, не только happy path главной. Имена людей, filenames и teacher-authored text не переводятся автоматически.
- Один locale store/переключатель из packages/ui; не создавать второй i18n framework/store. Выбор хранится безопасно, работает без storage и синхронизируется между вкладками согласно общему контракту.
- Таймзона берётся /me, locale выбирает формат; date-only не сдвигается как UTC instant. Деньги остаются точными Decimal strings с исходной precision, не Number/parseFloat.
- Materials list содержит metadata явных FilePermission, не открывает URL автоматически. Subject enrollment/покупка не являются выдачей file grant; foreign/revoked file одинаково403.
- Профиль меняет displayName alias1–100, не full_name/документы/phone/email. Отдельного avatar upload процесса не выдумывать: инициалы остаются безопасным default.
- Security secret commands не сохраняют body/вычислимый fingerprint в generic idempotency cache и не получают автоматический retry. Email provider unknown/отказ не показывается как «код отправлен».
- Initial password gate и temporary password policy сохраняют актуальное owner решение. Ученик не получает staff WebAuthn/passkey; рабочие роли не теряют MFA.
- Полный suspended — простой экран контакта без приватного меню/половины dashboard; частично ограниченный предмет не вызывает глобальный suspended. Logout доступен штатно.

## 6. Контракты, данные и совместимость

- Существующий shared Locale=ru|ro и MessageKey остаются единственными UI-интерфейсами; после reload/cross-tab язык один для AppShell и дочерних страниц. Locale не является permission.
- GET material-url возвращает private HTTPS capability+expiresAt+filename после текущего scope; URL нельзя хранить в durable client state. Истёкшая подпись требует нового авторизованного чтения, не продления на клиенте.
- PATCH profile: displayName и уже предусмотренный verified owned avatarFileId; identity поля не расширяются. Security password/email/session DTO и empty responses сохраняются.
- Password/email секреты — специальная policy, UUID может быть корреляцией аудита, не generic replay содержимого. Current-session revoke409 не обходится; foreign/unknown session404 не раскрывает ownership.
- Отсутствие server timestamp/канала/права отображается как unknown/unavailable, не имитация. Ошибки переводятся по безопасным code keys, stack/SQL/S3 и private denial причины не выводятся.

Точные имена новых planned DTO/operation/props запиши в коротком design note этого TASK до реализации и соблюдай существующие namespace/style. Planned нельзя выдавать за уже существующий API. Найденный существующий сервис переиспользуй. Generic UI не принимает бизнес-решения. Существующий авторитетный источник не копируется во второй реестр.

## 7. Пошаговое выполнение

1. Подтверди prerequisites по реальным артефактам предыдущих TASK и текущему коду. Недостающий результат не заменяй заглушкой или флагом с фиктивными данными. Не пересылай пользователю уже закрытые вопросы о чате, уведомлениях или director-only подтверждениях.
2. Составить coverage список строк во всех student routes, common components и AccountMenu: видимые тексты, aria, error codes, document.title, notices, placeholders, plural forms. Не ограничиваться строками с кириллицей в одном файле.
3. Расширить typed ru/ro dictionaries в существующем locale module, сохранив parity ключей. Убрать inline locale ternaries там, где нужен один переводимый шаблон; использовать Intl/plural category без новых форм-библиотек.
4. Перевести materials list/filter/contextless labels и download/inline действия. URL запрашивать явным действием через SDK, показывать ошибку разрешения/истечения и не обещать DRM/невозможность сохранить inline bytes.
5. Сохранить subject filter server-side и page reset; metadata never содержит private bucket/key. Null lessonTitle/Без предмета остаётся явным legacy-context состоянием, не угадывается из filename.
6. Перенести Profile на shared Field/Button: displayName alias, success только после ответа, dirty input не remountится на background me refetch. Phone/email не добавлять в profile PATCH.
7. Перевести password/change-email/request/confirm/session list/revoke; сохранить форму подтверждения пароля, типы autocomplete, current session409 и одинаковый foreign/unknown404. Secret fields очищать в утверждённых точках и не помещать в persisted query state.
8. Использовать специализированные security mutations с CSRF и корреляцией без serialized secret body в reusable intent ref/cache; не менять серверную auth-политику и не включать blind retries при unknown result.
9. Перевести suspended/login/password/bootstrap errors и контакты TASK-027. Проверить401/402/403 после любого чтения/мутации и account switching: cancellation/clear/abort не оставляют прежние данные и URL.
10. Проверить единые date/money formats, длинные RO строки, 200% zoom и 360/768/1024/1280. Добавить completeness assertions/locale fixture cases, отдельно от настоящей OTP/email/S3/provider приемки.
11. Сверь итог с правилами разделов3/5/6 этого же файла, обнови журнал и предметную матрицу, подготовь артефакты и остановись после отчёта по TASK-034.

## 8. Обязательные сценарии проверки

- [ ] СменаRU↔RO переводит каждый route/state/aria/title без reload; reload/вторая вкладка сохраняют единый выбор.
- [ ] Без доступа к localStorage переключатель работает в текущей сессии; словари одинакового покрытия и нет visible key strings.
- [ ] Materials revoked/foreign/expired grant не выдаёт signed URL; frozen доступ оставляет только ранее разрешённые файлы.
- [ ] Contextless legacy material и null title не получают вымышленный subject; фильтр сохраняет server total.
- [ ] Profile alias изменён, school full_name/email/phone не изменились; dirty alias не теряется от refetch.
- [ ] Email request provider failure/unknown не сообщает об отправке; неверный/expired OTP, current password invalid локализованы и не логируют секреты.
- [ ] Session revoke current409, чужая/unknown404, own other204/повтор204; logout/password/session switch очищает приватный cache.
- [ ] Full suspended показывает только безопасные контакты, initial-password redirect не обходит gate; частичный subject limit не закрывает другой предмет.
- [ ] Date-only в America/New_York не сдвинут, server countdown не зависит от locale; exact600.1234 MDL не округлён.
- [ ] RU/RO, long filenames/name100, 200%zoom, keyboard/reduced-motion и четыре viewport проходят без overflow.

Для визуального изменения: RU/RO,360/768/1024/1280, keyboard/focus/long text и relevant VIS11 states. Для read-model/API: validation, own/foreign scope, revoked context, no-store, error/empty/unknown и совместимость SDK. Для мутации: CSRF/idempotency/revision/unknown-result и отсутствие двойного эффекта. Не добавляй бессмысленный тест, который просто повторяет строку implementation; доказывай поведение.

## 9. Команды и безопасные границы проверки

Рабочий каталог `D:/OnlineSchool`. Это адресные ориентиры из текущих manifests, а не разрешение слепо запускать все команды. Прочитай scripts/конфиг теста перед запуском. Сборка может генерировать Prisma/SDK; это не разрешение запускать migration/seed или подключать реальную БД. Dist-based tests выполнять после целевой сборки.

```powershell
pnpm test:stu06
```

```powershell
pnpm test:stu11
```

```powershell
pnpm --filter @online-school/student-cabinet typecheck
```

```powershell
pnpm --filter @online-school/student-cabinet lint
```

- Создать test:k8k-student-locales для parity/route/state fixtures, без реальной отправки OTP или приватных S3 probes.

Если нужен новый тестовый script, сначала добавь его в manifest с явно безопасным локальным/mock target, затем запусти и запиши точную команду. Не выполняй `pnpm test`/recursive regression автоматически на каждом TASK. Полный разрешённый прогон относится к финальному блоку. Ошибка не основание ослабить линтер или выдавать NOT_RUN за PASS.

## 10. Критерии готовности

- [ ] Все ученические экраны и состояния имеют RU/RO, а не только навигация/отчёты.
- [ ] Нет второго locale store и потери выбора/ввода при смене языка.
- [ ] Файлы выдаются только существующим private authorisation workflow; нет URL в persistent storage/evidence.
- [ ] Профиль и security команды сохраняют whitelist, secret handling, statuses и session rotation.
- [ ] Suspended/initial password/partial subjects корректно отделены и проверены отрицательными тестами.
- [ ] Ошибки/aria/title/датировки локализованы, пользовательский текст сохраняется исходным.

- [ ] Все использованные данные и действия имеют реальный авторитетный источник/проверку; нет выдуманных цифр, прав, кнопок и success.
- [ ] Отчёт различает исходный работающий код, новые изменения, свежие проверки и исторические доказательства.
- [ ] Не изменены рабочая БД, применённые migration checksums и production; необоснованные внешние эффекты отсутствуют.

## 11. Не входит в этот TASK

- Новые языки кромеRU/RO, авто-перевод учительского/ученического контента, новый i18n framework.
- Новый avatar upload, phone verification/SMS, персональная смена timezone если она не утверждена; отключение MFA staff.

Обнаруженный соседний gap запиши с конкретным следующим TASK, не расширяй текущую задачу на весь redesign. Если требуется реально новое бизнес-решение или недоступный внешний провайдер — подготовь все независимые изменения и точный вопрос/блокер только по этому пункту. Не останавливайся на повторном согласовании ранее утверждённых правил.

## 12. Артефакты и отчёт для следующего кодера

- output/k8k-taskpack/task-034/report.md: commit/dirty diff, команды, результаты и оставшиеся ограничения.
- output/k8k-taskpack/task-034/acceptance.json: бинарные критерии и доказательства текущей версии; screenshots и accessibility вывод без секретов/URL.

Формат `output/k8k-tasks/TASK-034/report.md`:

```text
TASK: TASK-034
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

# TASK-032 — Опубликованный отчёт по deep link и полный workflow PDF

**Пакет:** K8K-FRONTEND-REBUILD v1.0,03.11.2026. **Блок:** 3 — Кабинет ученика. **Модуль:** Педагогический результат.

**Входные зависимости:** [TASK-024](TASK-024.md), [TASK-031](TASK-031.md). Номер относится только к этому пакету, не к старым MGR/Phase0 TASK. **Учёт выполнения:** [EXECUTION_LOG](EXECUTION_LOG.md).

**Исходный статус:** Частично: Reports.tsx уже добавлен, умеет paginated list и mark-read RU/RO. reportId лишь раскрывает элемент текущей страницы; адресное чтение старого отчёта и PDF UI отсутствуют.. Это описание кода на дату составления, не акт приёмки и не команда начать с нуля.

## 1. Команда AI-кодеру и результат

Выполни **только TASK-032** в существующем репозитории. Не начинай следующий TASK автоматически.

Открывать конкретный разрешённый опубликованный отчёт независимо от page1 и дать существующий приватный PDF-export workflow с корректными job состояниями, сроком ссылки и повтором того же намерения.

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

- [apps/api/src/student/reports/README.md](../../apps/api/src/student/reports/README.md) — **API; Какие данные видит ученик; Воркер, приватный объект и срок ссылки**: Версии, scope,4 поля, read receipts, PDF expiry и polling.
- [apps/api/src/student/reports/reports.dto.ts](../../apps/api/src/student/reports/reports.dto.ts) — **EducationalReportDto; ExportPdfRequestDto; PdfJobStatusDto**: Фактический тип payload/job, date-only и nullable URL.
- [docs/K8K_Academy_VIS12_dashboard_module_contracts_v1.0.md](../K8K_Academy_VIS12_dashboard_module_contracts_v1.0.md) — **STU-04; V12-AT-04/10/11**: Публикация только подтверждённым учителем, no false success.
- [docs/K8K_DESIGN_INSTRUCTIONS.md](../K8K_DESIGN_INSTRUCTIONS.md) — **§5.2 DASH-STU-04; §5.1 состояния/действия**: Отчёт в образовательном контексте и безопасный UI.
- [docs/online_academy_student_architecture_full_decision_log_v2.md](../online_academy_student_architecture_full_decision_log_v2.md) — **Публикации, образовательная история и PDF**: Уже утверждённая функция экспорта, не новая .ics или рассылка.

Реальные точки входа в код/доказательства (существуют на дату пакета; если структура позже изменена, найди symbol через `rg`, не создавай дубликат):

- [apps/student-cabinet/src/pages/Reports.tsx](../../apps/student-cabinet/src/pages/Reports.tsx).
- [apps/student-cabinet/src/router.tsx](../../apps/student-cabinet/src/router.tsx).
- [apps/student-cabinet/src/student-presentation.ts](../../apps/student-cabinet/src/student-presentation.ts).
- [apps/api/src/student/reports/reports.controller.ts](../../apps/api/src/student/reports/reports.controller.ts).
- [apps/api/src/student/reports/reports.service.ts](../../apps/api/src/student/reports/reports.service.ts).
- [apps/api/src/student/reports/reports.sql.ts](../../apps/api/src/student/reports/reports.sql.ts).
- [apps/api/src/student/reports/reports.dto.ts](../../apps/api/src/student/reports/reports.dto.ts).
- [packages/api-contracts/src/generated/client.ts](../../packages/api-contracts/src/generated/client.ts).
- [apps/student-cabinet/tests/fixture-server.mjs](../../apps/student-cabinet/tests/fixture-server.mjs).

Визуальная опора: [template/newtemp.png](../../template/newtemp.png) — язык дизайна, не требования и не источник mock-цифр. Старые [template/*.webp](../../template/README.md) — только исторические примеры.

Инструменты кодера: начинай поиск исходников с `rg`; версии/лицензии проверяй через `pnpm view` и текущий lockfile. Для библиотечных API используй доступный Context7/официальные документы нужной версии; для интерфейса — локальный Playwright/browser harness и проверку реального рендера. Сначала проверь доступность MCP, не считай запись сервера доказательством авторизации. Repo-инструменты и локальные fixtures остаются рабочим fallback. Figma/внешний дизайн-сервис не обязательны для восстановления этого контекста. Не подключай реальные аккаунты/провайдеры ради mock smoke и не подменяй ими ограничения среды.

Официальные справочные сайты по теме; бизнес-контекст уже дан выше, интернет не нужен для его восстановления. Перед использованием API/версии библиотеки сверяй первичную документацию именно совместимой версии. Наличие ссылки не требует установки пакета:

- [React 18.3.1](https://18.react.dev/reference/react) — API текущей major-версии; не обновлять проект до React19 по latest-примеру.
- [TanStack Query v5](https://tanstack.com/query/latest/docs/framework/react/overview) — Чтения, query keys, invalidation, cancellation; выбранную minor сверять с package.json.
- [WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/) — Рабочая accessibility-рамка; axe не заменяет ручные проверки.
- [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots) — Воспроизводимые снимки и контролируемые fixtures.
- [Orval](https://orval.dev/) — Генерация SDK только штатным способом проекта.

## 5. Предметные правила и сохранение поведения

- Ученик видит только собственные разрешённые LESSON_8/PUBLISHED не из будущего, последнюю опубликованную версию checkpoint. Черновик исправления не скрывает прежнюю публикацию.
- Report read receipt относится к конкретной версии; открытие popover/уведомления и скролл не означают прочтение отчёта. Явная команда первого прочтения204, повтор200 без body.
- Публичный content — achievements/growthAreas/recommendations/teacherSignature. Не отдавать внутренний JSON, private teacher notes или автоматически переведённый текст ребёнка/учителя.
- PDF export уже предусмотрен: subject/date filters optional, omitted body=вся история; date-only inclusively в student zone. Не превращать task в новый документогенератор или внешнюю рассылку.
- EstimatedReadyAt/+30s — оценка, не обещание. Poll каждые2s максимум60s, затем можно вернуться к тому же job; client timeout не отменяет server job и не создаёт новый export автоматически.
- Не более2 незавершённых задач на ученика:429 понятным текстом. READY URL private, fixed expiresAt=ready_at+1h; poll не продлевает срок, после expiry новая явная export-команда.
- Подписанные URL и secret content не сохраняются в localStorage/analytics/evidence. Unknown POST outcome не считается failed/queued без сверки.

## 6. Контракты, данные и совместимость

- Новый GET /reports/:reportId возвращает существующий EducationalReportDto, no-store и тот же allowed set как paginated list. Он добавляет адресуемость, не изменяет publication/version policy.
- Существующий POST :reportId/read: CSRF+UUID,204 first/200 repeat, оба без JSON. SDK generic JSON mutator не заменяет специальную обработку empty response.
- POST /reports/export-pdf возвращает202 {jobId,status:QUEUED,estimatedReadyAt}; selection {subjectId?,periodFrom?,periodTo?}; повтор того же intent не создаёт второй job. GET job state перепроверяет access на каждом poll.
- PdfJobStatusDto.downloadUrl/expiresAt/failureReason nullable; READY без валидной ссылки не представляется успешной загрузкой. После ровной expiry boundary сервер отдаёт FAILED/PDF_EXPORT_EXPIRED без URL.

Точные имена новых planned DTO/operation/props запиши в коротком design note этого TASK до реализации и соблюдай существующие namespace/style. Planned нельзя выдавать за уже существующий API. Найденный существующий сервис переиспользуй. Generic UI не принимает бизнес-решения. Существующий авторитетный источник не копируется во второй реестр.

## 7. Пошаговое выполнение

1. Подтверди prerequisites по реальным артефактам предыдущих TASK и текущему коду. Недостающий результат не заменяй заглушкой или флагом с фиктивными данными. Не пересылай пользователю уже закрытые вопросы о чате, уведомлениях или director-only подтверждениях.
2. Переиспользовать существующий Reports.tsx и list/read SDK; не писать второй список. Выделить адресный selected report query, который не зависит от нахождения reportId на текущей странице.
3. Добавить минимальный GET /api/v1/student/reports/:reportId с тем же publishedReportsCte scope, что и list. Валидировать UUID; foreign/nonexistent/unpublished/superseded выдавать единый запрещённый ответ без раскрытия наличия.
4. Разместить route после/рядом explicit export-pdf routes без перехвата job endpoints. Регенерировать OpenAPI/SDK штатно; адресный endpoint не вводит права student на исторические неопубликованные версии.
5. Подключить deep link /student/reports?reportId=UUID: загрузка выбранного отчёта, фокус его заголовка, контекст возврата в список и открытие отчёта старшеpage1. Недоступный ID не заменять первым report молча.
6. Сохранить POST :id/read с пустым body и специальным empty-response transport. Обновить isNew соответствующей версии и связанные previews только после ответа; read не публикует/редактирует отчёт.
7. Добавить экспорт-форму предмет/период на основе разрешённых subjects и date inputs; применить существующий requestStudentEducationPdf, стабильный intent UUID, показать jobId/status без подписанного URL в storage.
8. Реализовать состояния QUEUED/PROCESSING/READY/FAILED, bounded polling, повтор чтения того же job после60s и после возврата. При session смене остановить timers/queries; после revoked access URL скрывается.
9. Выдавать ссылку Скачать только READY с валидным URL и expiresAt; перед повторным переходом/после сна вкладки перепроверять job. Expired/FAILED объяснить безопасной локализованной причиной; новый export только явной кнопкой.
10. Перевести list/detail/read/export/error RU/RO и проверить длинный report text. Скриншоты и mocks подтверждают UI, но не реальный worker/S3 delivery; эти ограничения записать отдельно.
11. Сверь итог с правилами разделов3/5/6 этого же файла, обнови журнал и предметную матрицу, подготовь артефакты и остановись после отчёта по TASK-032.

## 8. Обязательные сценарии проверки

- [ ] Deep link на report со страницы3 открывает именно его без перебора/загрузки всех страниц.
- [ ] Чужой, unknown, draft/future/superseded ID не раскрывается; draft correction не скрывает действующую publication.
- [ ] Публичный JSON содержит только4 разрешённых поля; text сохраняет whitespace и не исполняется как HTML.
- [ ] Mark read first204/repeat200/пустой body работают; новая published version снова isNew.
- [ ] Экспорт omitted body и filtered subject/dates корректны, reversed date range400, foreign subject403.
- [ ] Double click/unknown enqueue retry не создаёт второй job; третья unfinished request429; timeout60s не отменяет job.
- [ ] READY link expires ровно через1h, повторный poll не продлевает; истёкшая ссылка скрыта и требует явного нового export.
- [ ] Logout/switch во время polling останавливает запросы и удаляет URL; RU/RO keyboard/360px detail и формы доступны.

Для визуального изменения: RU/RO,360/768/1024/1280, keyboard/focus/long text и relevant VIS11 states. Для read-model/API: validation, own/foreign scope, revoked context, no-store, error/empty/unknown и совместимость SDK. Для мутации: CSRF/idempotency/revision/unknown-result и отсутствие двойного эффекта. Не добавляй бессмысленный тест, который просто повторяет строку implementation; доказывай поведение.

## 9. Команды и безопасные границы проверки

Рабочий каталог `D:/OnlineSchool`. Это адресные ориентиры из текущих manifests, а не разрешение слепо запускать все команды. Прочитай scripts/конфиг теста перед запуском. Сборка может генерировать Prisma/SDK; это не разрешение запускать migration/seed или подключать реальную БД. Dist-based tests выполнять после целевой сборки.

```powershell
pnpm test:stu09
```

```powershell
pnpm --filter @online-school/api typecheck
```

```powershell
pnpm --filter @online-school/student-cabinet typecheck
```

```powershell
pnpm --filter @online-school/student-cabinet lint
```

- Создать mock unit/HTTP и Playwright grep для report-detail/pdf-job; готовые export worker suites не запускать на main DB.

Если нужен новый тестовый script, сначала добавь его в manifest с явно безопасным локальным/mock target, затем запусти и запиши точную команду. Не выполняй `pnpm test`/recursive regression автоматически на каждом TASK. Полный разрешённый прогон относится к финальному блоку. Ошибка не основание ослабить линтер или выдавать NOT_RUN за PASS.

## 10. Критерии готовности

- [ ] Selected report старшеpage1 открывается одним scoped detail query и не подменяется первым элементом.
- [ ] Адресный endpoint использует ту же публикационную/версионную политику и защищённый SDK.
- [ ] Явное прочтение204/200 не ломает transport и не означает выполнение другой задачи.
- [ ] Все4 PDF job states, bounded polling/resume/expiry/429 представлены и протестированы.
- [ ] Без подтверждённого READY нет кнопки скачивания и сообщения успешного экспорта.
- [ ] Никаких внешних сообщений семье и новых teacher publications эта задача не выполняет.

- [ ] Все использованные данные и действия имеют реальный авторитетный источник/проверку; нет выдуманных цифр, прав, кнопок и success.
- [ ] Отчёт различает исходный работающий код, новые изменения, свежие проверки и исторические доказательства.
- [ ] Не изменены рабочая БД, применённые migration checksums и production; необоснованные внешние эффекты отсутствуют.

## 11. Не входит в этот TASK

- Редизайн worker/PDF renderer, новые формулы педагогической оценки, публикация отчёта студентом.
- Реальная S3 загрузка/провайдерный smoke, автоматический экспорт, .ics, email/SMS рассылка.

Обнаруженный соседний gap запиши с конкретным следующим TASK, не расширяй текущую задачу на весь redesign. Если требуется реально новое бизнес-решение или недоступный внешний провайдер — подготовь все независимые изменения и точный вопрос/блокер только по этому пункту. Не останавливайся на повторном согласовании ранее утверждённых правил.

## 12. Артефакты и отчёт для следующего кодера

- output/k8k-taskpack/task-032/report.md: исходная версия, изменения, целевые результаты и реальные ограничения.
- output/k8k-taskpack/task-032/acceptance.json: критерии PASS/FAIL/NOT_RUN со ссылками; screenshots RU/RO/viewport для новых представлений.

Формат `output/k8k-tasks/TASK-032/report.md`:

```text
TASK: TASK-032
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

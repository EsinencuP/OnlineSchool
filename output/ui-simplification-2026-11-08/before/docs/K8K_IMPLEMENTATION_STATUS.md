# K8K — выполненный инкремент 03.11.2026

## TASK-034 — RU/RO, материалы, профиль и безопасность, 08.11.2026

Текущие K8K student routes используют единый locale store; typed student namespace
в shared MessageKey/MessageCall не добавляет copy в staff bundles. Переведены
materials/profile/security/password/suspended, общие подписи/errors/aria/title/date;
имена и авторский контент не переводятся. Alias не remountится при /me refetch.
MaterialItemDto получил3 optional read-only metadata из существующих grant/object
полей: subjectId/canDownload/fileNameIsFallback. Scope, signing и no-store прежние;
URL читается только по клику, не сохраняется в state/cache/storage. Secret commands
не используют generic mutation cache/serialized intent; password/OTP очищаются,
unknown не success/retry. Неопределённая ротация auth/logout закрывает приватный
DOM/cache через существующий session boundary; confirm заново читает /me.
48 material +73 security API/HTTP/SDK mocks,12 presentation,2 locale cases,
19 Chromium,65 screenshots, RU/RO×4 ширины, axe360 и reflow200% прошли локально.
149 операций сохранены, только3 optional response fields;31 migration SHA прежние.
50/50 budget PASS, student255001/256000, max255923. Реальные PostgreSQL/S3/email/
OTP/session rotation/provider delivery, physical accessibility и TASK-035 gate NOT_RUN.
[Отчёт](../output/k8k-tasks/TASK-034/report.md) · [Покрытие](../output/k8k-tasks/TASK-034/coverage.md)

## TASK-033 — единый колокольчик событий, 08.11.2026

Общий Drawer управляется единственным events=1, закрытие сохраняет остальные URL
параметры. Preview читается только открытым, глобальный count отдельно; page2,
empty beyond-end, stale, loading, unavailable/403 и late session responses различимы.
Read/read-all используют прежние CSRF/UUID/204 и first read_at; unknown сверяется
чтением до повтора того же intent. Повтор read-all не поглощает новое событие.
Тип и публичный UUID определяют scoped target урока/ДЗ/отчёта/TASK-026 абонемента;
прочтение события не выполняет команду объекта. Все18 типов сохранены.
Optional GET locale=ru|ro переводит только catalog key+полные public params;
historical/неполный и MANUAL_MESSAGE текст остаётся исходным, inbox не переписывается.
86 API/HTTP/SDK mocks, 12 presentation tests, 13 Chromium, 29 screenshots,
RU/RO × 4 ширины, axe360 без нарушений и 50/50 бюджетов прошли.
149 API operations и response schemas сохранены, миграций/зависимостей не добавлено.
Реальные PostgreSQL/triggers/projector/concurrency/TTL и общий gate NOT_RUN.
[Отчёт](../output/k8k-tasks/TASK-033/report.md) · [Передача](../output/k8k-tasks/TASK-033/handoff.md)

## TASK-032 — адресный отчёт и workflow PDF, 08.11.2026

Опубликованный отчёт читается отдельным GET по reportId независимо от страниц
списка, с той же publishedReportsCte/публичной проекцией. Фокус переходит к его
заголовку; возврат сохраняет page. Явное прочтение сохраняет empty-response transport
204/200 и обновляет isNew только после ответа; unknown сначала проверяет detail.
PDF UI использует существующие enqueue/status: неизменный intent UUID/body,
GET-сверку потерянного202, четыре job states, polling2s не дольше60s, resume того же
job и fixed expiry. Скачивание сначала перепроверяет job; URL не хранится в cache/
storage. Logout/401/403 и межвкладочная смена actor скрывают старые данные.
86 API/HTTP/worker/SDK mocks, 14 Chromium-сценариев, 43 screenshots и 50/50 бюджетов
прошли. OpenAPI/SDK созданы штатно: 147 прежних операций сохранены, два GET добавлены.
Реальные PostgreSQL/S3/worker delivery, teacher publication и полный gate NOT_RUN.
[Отчёт](../output/k8k-tasks/TASK-032/report.md) · [Передача](../output/k8k-tasks/TASK-032/handoff.md)

## TASK-031 — карта навыков, срез4 и отчёт8, 08.11.2026

Карта сохраняет четыре серверных enum: нейтральное NOT_STUDIED вне общего трека
трёх учебных этапов. RU/RO охватывает статусы, историю, цели, даты и состояния.
Неоценённый навык показывает catalog date без выдуманного преподавателя; цели
и isAchieved берутся из API. История показывает public comments, включая downgrade/reset.
Предметный URL включает собственные исторические enrollments и не выбирает первый
предмет молча. Additive optional subjectId для GET snapshots фильтрует историю до
count/pagination. Frozen snapshot4 отделён от Reports8; student writes не добавлены.
На главной — краткий контекст/цель каждого предмета и переход к его карте.
57 API/HTTP mocks и 10 Chromium-сценариев прошли, исходный four-state тест сохранён.
Есть 34 screenshots, включая RU/RO × 4 ширины, и 50/50 бюджетов с fonts.
Фактические PostgreSQL queries/triggers/races, teacher publication workflow и общий
gate не проверялись. [Отчёт](../output/k8k-tasks/TASK-031/report.md) · [Передача](../output/k8k-tasks/TASK-031/handoff.md)

## TASK-030 — домашние задания и защита редактора, 08.11.2026

Список ДЗ использует ListRow/StatusChip и серверную пагинацию без новых status-tabs.
Редактор, вложения, доработка и история переведены на общий UI-kit и RU/RO.
Сохранены debounce 2s, последовательная очередь сохранения и upload/submit intents.
Неизвестная отправка проверяется существующим GET detail до явного повтора с тем же
ключом и содержимым; истечение черновика сохраняет ввод без ложного «сохранён».
Пять исходных baseline-сценариев, 16 итоговых Chromium-сценариев и 55 API/HTTP mocks
прошли. Есть 26 снимков, включая RU/RO × 4 ширины, и 50/50 бюджетов с fonts.
Реальные S3/CORS, PostgreSQL write/races и общий gate имеют статус NOT_RUN.
[Отчёт](../output/k8k-tasks/TASK-030/report.md) · [Передача](../output/k8k-tasks/TASK-030/handoff.md)

## TASK-029 — расписание, история, перенос и спор, 08.11.2026

Расписание сохраняет period/view/month/page и предмет в URL. Календарь с лимитом
62 переходит к постраничному списку того же месяца. В разделе есть единая история
подтверждённых фактов с server total, точными количествами и неизвестными legacy
остатками. Карточка адресно читает свой history fact, выданное ДЗ и разрешённые
материалы. Формы переноса и спора используют серверные capabilities и существующие
команды. Unknown проверяется отдельным GET по исходному ключу, включая reload.
173 API/HTTP mocks, 11 presentation и 12 Chromium-сценариев прошли. Реальные
транзакционные гонки/БД и общий ролевой gate имеют статус NOT_RUN.
[Отчёт](../output/k8k-tasks/TASK-029/report.md) · [Передача](../output/k8k-tasks/TASK-029/handoff.md)

## TASK-028 — текущий урок и доступ к Meet, 07.11.2026

Dashboard, список, календарь и карточка используют общую серверную проверку
предметного права, назначения и точного окна T−10…T+60 включительно. Hero получает
свой status и meetAsOf. Кэш сводки хранит только счётчики и абонемент, урок читается
для каждого ответа. Клиент запрашивает решение на T−10, скрывает устаревшую ссылку
и использует монотонное время. Локальные HTTP mocks и RU/RO fixtures проверяют
границы, отмену, отзыв и два предмета. Проверки SQL на рабочей БД и Meet OAuth,
POC, provider, G4 имеют статус NOT_RUN.
[Отчёт](../output/k8k-tasks/TASK-028/report.md) · [Передача](../output/k8k-tasks/TASK-028/handoff.md)

## TASK-027 — назначенный менеджер, 07.11.2026

Главная, помощь и экран приостановки используют одну проекцию `managerContacts`.
Она возвращает имя действующего назначенного сотрудника и официальные каналы.
Телефон появляется из отдельного nullable E.164 поля. Additive миграция подготовлена
для rollout. Смена назначения и сессии проверены на локальных fixtures.
[Отчёт](../output/k8k-tasks/TASK-027/report.md) · [Передача](../output/k8k-tasks/TASK-027/handoff.md)

## TASK-026 — абонементы по предметам, 07.11.2026

Главная и хаб K8K показывают серверный статус каждого предмета, остаток оплаченных
занятий, срок, заморозку и отдельный временный допуск. Детали, подтверждённые платежи
и количественная история сохраняют один финансовый `subscriptionId`. Неизвестные
снимки старых списаний остаются `null`. Прежний интерфейс сохраняет свой обзор.
[Отчёт](../output/k8k-tasks/TASK-026/report.md) · [Передача](../output/k8k-tasks/TASK-026/handoff.md)

## TASK-025 — предметный хаб и помощь ученика, 07.11.2026

В K8K добавлены `/student/subjects?subjectId=…` и `/student/help`. Хаб читает
`getStudentSubjects`, валидирует селектор по собственным предметам и открывает
разрешённые действия. Главная выделяет одно действие урока. Профиль и безопасность
открываются из меню аккаунта. Предметный фильтр есть у материалов и карты навыков.
Из общих списков расписания и ДЗ доступен возврат к предмету.
[Отчёт](../output/k8k-tasks/TASK-025/report.md) · [Передача](../output/k8k-tasks/TASK-025/handoff.md)

## TASK-024 — серверная проекция предметов ученика, 07.11.2026

`GET /api/v1/student/subjects` отдаёт собственные предметы, подтверждённые остатки,
отдельный лимит временного допуска и возможности просмотра. `subscriptionId`
принимают существующие GET деталей, платежей и истории. OpenAPI и SDK обновлены.
API проверен адресными mock-тестами. Предметный хаб и экран абонементов относятся
к TASK-025/026. [Отчёт](../output/k8k-tasks/TASK-024/report.md) · [Передача](../output/k8k-tasks/TASK-024/handoff.md)

## TASK-023 — локальная приёмка общей оболочки и SDK, 07.11.2026

Пять кабинетов и общий вход проверены на свежих сборках в RU/RO и четырёх ширинах.
На 320 px шапка ученика корректно переносит имя рядом с колокольчиком.
Старые URL и 140 исходных операций сохранены. Сгенерированный SDK воспроизведён
побайтно. Статус PARTIAL из-за открытого рабочего источника критических событий.
[Отчёт](../output/k8k-tasks/TASK-023/report.md) · [Передача](../output/k8k-tasks/TASK-023/handoff.md)

## TASK-022 — контракт критического события и очереди CRM, 07.11.2026

Dashboard и SDK принимают опциональный серверный снимок `priority`. Слот подключён к
существующим карточке и очереди задач. Сбой источника и подтверждённый ноль различаются.
Статус PARTIAL. Действующий каталог и правило выбора primary не подтверждены, поэтому
сервер пока опускает `priority`. [Отчёт](../output/k8k-tasks/TASK-022/report.md) · [Аудит источников](../output/k8k-tasks/TASK-022/source-audit.md)

## TASK-021 — одна политика чтения и ясная свежесть, 07.11.2026

Активные оперативные ключи K8K получают фоновые чтения через одного владельца.
Сигналы фокуса, видимости, сети и таймера объединяются. Ввод и диалог откладывают
чтение до завершения взаимодействия. Запросы сессии и инвалидация после команды
сохраняют свои пути. На T−10 ученический обзор запрашивает `canJoin` у сервера.
Для критичных чтений показаны время получения, доступное время источника и stale.
[Карта владельцев](../output/k8k-tasks/TASK-021/refresh-map.md) · [Отчёт](../output/k8k-tasks/TASK-021/report.md)

## TASK-020 — адресуемая staff-навигация, 07.11.2026

Platform разделён на оболочку, workspace и объектную карточку. Существующий `section`
совместим с новыми `filter` и `id`. Back/Forward возвращает фильтр и позицию списка.
Защищённый GET читает отдельный объект с серверной областью видимости. В K8K ниже
1024 px работает нижняя навигация с «Ещё» и справкой. Свежие локальные проверки и
границы фильтрации приведены в [отчёте](../output/k8k-tasks/TASK-020/report.md).

## TASK-019 — жизненный цикл приватной сессии, 07.11.2026

Platform, Manager Web и Student Cabinet отзывают поколение запросов и очищают приватный
экран на выходе, смене пользователя и 401. Вкладки обмениваются сигналом смены сессии.
403 удаляет данные запрещённого чтения, а незавершённая MFA блокирует Finance.
Студенческие команды с паролями и OTP теперь выполняются вне MutationCache (K8K-DEF-074).
Проверки на локальных фикстурах и замеры 48 маршрутов описаны в [отчёте](../output/k8k-tasks/TASK-019/report.md).

## TASK-018 — actor context и eligibility, 04.11.2026

StaffActorContextDto различает auth account и собственный teacher/staff profile,
возвращает timezone/source и DB asOf/source timestamps. Director teacherProfileId=null.
Три per-action read adapters используют те же policies, что startLesson, manager
approval-request и director confirm. PAYMENTS_REQUEST_APPROVAL отделён от PAYMENTS_CONFIRM.
Workspace сохранил массивы и получил coverage/pageInfo/unknown total, limit+1 probe.
Platform использует generated DTO, source clock/timezone и RU/RO sample labels.
Штатный OpenAPI/Orval export выполнен без DB:140 прежних +4 новых operations,16 новых
tests +92 existing,20 browser cases/16 PNG и15 account regression. Platform145928 bytes.
Applied migrations/production не менялись. Остальные role adapters и lifecycle —
TASK-019/020/036/048/056/059; полный release/FND gate не закрыт.
[Отчёт](../output/k8k-tasks/TASK-018/report.md) · [Контракты](../output/k8k-tasks/TASK-018/contracts-diff.json)

## TASK-017 — техническая приёмка foundation, 04.11.2026

Подтверждены outputs TASK-005–016 и весь перечень design §3.4: 30 required controls,
41 публичный component export, 46 Storybook stories. Найденный gap Calendar month
исправлен additive расширением CalendarView. Calendar/KanbanColumn/StagesTrack остаются
презентационными: source/ACL/commands/publication принадлежат ролевым adapters.
Свежие 137 unit, 368 renders RU/RO×4, 102 axe scans, focus/keyboard/reflow/reduced motion,
11 locale и15 account cases. 48/48 budgets≤256000, максимум254567, fonts63492.
Общий pnpm audit имеет прежние API/Jest findings; axe incomplete и реальная AT-проверка
явно отделены. Полная WCAG, provisional approval, role/release/FND gates не закрыты.
[Отчёт](../output/k8k-tasks/TASK-017/report.md) · [Ручная оценка](../output/k8k-tasks/TASK-017/manual-review.md)

## TASK-012 — состояния чтения и стабильность DOM, 04.11.2026

Одна модель BoundaryState отображает девять состояний на RU/RO. Skeleton, EmptyState,
ErrorState и StaleBanner используют общие подписи. FreshnessLabel отдельно показывает
server asOf и client receivedAt. Черновик и фокус сохраняются при refetch и переходах
ready/stale/pending. Cached 401/403 скрывает приватный DOM и действия. StagesTrack
отображает переданный этап. 129 тестов UI, 34 браузерных сценария, 16 снимков.
Бюджет прошли все 48 маршрутов, максимум 248669 байт.
[Отчёт](../output/k8k-tasks/TASK-012/report.md) · [Галерея](../output/k8k-tasks/TASK-012/runs/2026-11-04T05-14-33.552Z/gallery.html)


## TASK-011 — календарь и выбор даты, 04.11.2026

Calendar отображает серверные интервалы в IANA-поясе аккаунта. Дата и смещение видны отдельно
от статуса доступности. DatePicker сохраняет date-only и поддерживает клавиатурные кнопки дня.
Менеджерское расписание сохраняет дату, вид и фильтры в URL. Ученический список и календарь
сохраняют месяц, вид, период и страницу. Проверены DST gap/overlap, 25-часовой день, повторное
чтение без потери фокуса и границы загруженных данных. 125 тестов UI, 20 браузерных сценариев,
10 снимков. Бюджет прошли 48 маршрутов, максимум 247590 байт.
[Отчёт](../output/k8k-tasks/TASK-011/report.md) · [Галерея](../output/k8k-tasks/TASK-011/runs/2026-11-04T05-04-04.818Z/gallery.html)


## TASK-010 — таблицы и серверная пагинация, 04.11.2026

DenseTable отображает серверную страницу и передаёт намерения сортировки и пагинации приложению.
ListRow и KanbanColumn предоставляют слоты полей, ссылок и действий. K8K список заявок использует
существующий SDK и cursor. Общее число в списке неизвестно. Проверены 403 с ранее загруженными данными,
восстановление фильтра и курсора через Back, клавиатура, выбор по ID и мобильная область прокрутки.
122 теста UI, 36 браузерных сценариев, 26 снимков. 48 маршрутов прошли бюджет, максимум 245032 байта.
[Отчёт](../output/k8k-tasks/TASK-010/report.md) · [Галерея](../output/k8k-tasks/TASK-010/runs/2026-11-04T04-50-46.028Z/gallery.html)


## TASK-009 — составные компоненты, 04.11.2026

Tabs и Tooltip используют закреплённые Radix. Segmented использует нативные radio и подключён
к существующим режимам списка и календаря в расписании ученика. Вкладки поддерживают
ручную активацию и сохранение содержимого. Для удаления панели с черновиком приложение
проверяет ввод и запрашивает подтверждение. HeroCard и StatTile принимают данные и состояние
от вызывающего кода. Toast использует две области aria-live с дедупликацией по ID результата.

Прошли 119 тестов UI и 44 браузерных сценария. Галерея содержит 36 снимков RU/RO на ширинах
360, 768, 1024 и 1280. Бюджет прошли 48 маршрутов. Максимум 244331 байт с локальными шрифтами.
[Отчёт](../output/k8k-tasks/TASK-009/report.md) · [Галерея](../output/k8k-tasks/TASK-009/runs/2026-11-04T04-40-16.278Z/gallery.html) · [Бюджеты](../output/k8k-tasks/TASK-009/runs/2026-11-04T04-40-16.278Z/bundle.md)


## TASK-008 — controlled Radix overlays, 04.11.2026

[Отчёт](../output/k8k-tasks/TASK-008/report.md), [галерея](../output/k8k-tasks/TASK-008/runs/2026-11-03T22-51-32.206Z/gallery.html),
[v2 budgets](../output/k8k-tasks/TASK-008/runs/2026-11-03T22-51-32.206Z/bundle.md).
Добавлены controlled Dialog, ConfirmDialog/AlertDialog, responsive Drawer, Popover и DropdownMenu;
Content refs, accessible title/description, Escape/focus return, modal-only focus/background/scroll isolation.
Приложение владеет open/pending/dirty/unknown/result и onRequestClose; Confirm Action не закрывает
асинхронную команду автоматически. No forceMount/hidden private DOM; revoke specimen снимает subtree
и stale callback. Только один production consumer: read-only справка имени в Student Profile,
без API. AST: save/update и5 соседних account functions прежние. Native modals/guards и account-ui
SDK/broadcast/navigation не заменены, [inventory/handoff](../output/k8k-tasks/TASK-008/handoff.md).
116 UI tests,71 browser cases/66 PNG RU/RO×360/768/1024/1280, strict/lint PASS;
715 CSS legacy entries прежние.48/48≤256000, max243665; student204864/platform130854,
fonts63492 без изменения. Pin/React18/MIT/age≥14 для всех40 новых locked packages проверены,
существующие package/snapshot records не менялись. Dirty `3c1036a16e8e2693ec0238c6f97eda4d7320ad97f65ada37bc2cce234018b5ba`.
Actual account/session/secret migrations, full Storybook/AT/WCAG/backend/provider/gates остаются
в отдельных TASK; это scoped DONE TASK-008. TASK-009 не начат.

## TASK-007 — native controls и безопасный consumer, 04.11.2026

[Отчёт](../output/k8k-tasks/TASK-007/report.md), [галерея](../output/k8k-tasks/TASK-007/runs/2026-11-03T22-17-03.782Z/gallery.html),
[budget delta](../output/k8k-tasks/TASK-007/runs/2026-11-03T22-17-03.782Z/bundle.md).
Button/Field/IconButton refs и native props сохранены; добавлены native Select,
совместные hint/error и dedup describedby, pending/disabled reason, density36 только
explicit staff desktop fine-pointer,44 touch и48 primary student. Unknown status —
нейтральный RU/RO текст; Avatar initials/full name/unknown fallback; Card heading/description/actions/ref.
CSF-compatible RU/RO stories реально отрендерены локальным fixture, Storybook runtime — TASK-013.
K8K Student Profile переведён на Field/Button/Card, legacy сохранён; AST подтверждает
неизменность useCommand/save/API hooks и5 соседних functions. Native FormData/CSRF/idempotency
проверены локальными mocks: pending без дубля,422 сохраняет ввод, исправление→success.
111/111 UI tests;49 browser cases,80 PNG RU/RO×4 widths; strict consumer typecheck/lint/Stylelint PASS.
48/48 v2 budgets PASS (max243227); fonts63492 без изменения, JS lockfile/dependencies прежние.
Full API/privacy/session/WCAG/Storybook и перевод старых StateBoundary/ErrorNotice остаются открытыми.

## TASK-006 — типографика, Golos и Icon, 03.11.2026

[Отчёт](../output/k8k-tasks/TASK-006/report.md), [specimens](../output/k8k-tasks/TASK-006/runs/2026-11-03T21-57-30.880Z/gallery.html),
[budgets](../output/k8k-tasks/TASK-006/runs/2026-11-03T21-57-30.880Z/bundle.md).
RO WOFF2 supplement3544 получен из установленного Golos5.2.8 latin-ext; одно семейство,
wght400–900/swap, исходные Cyrillic/Latin неизменны. Современные ș/ț/ă/â/î в Golos
подтверждены cmap и CDP, font failure даёт readable fallback. IconName/IconProps со
static Lucide0.468/decorative AX; icon-only label обязателен; Avatar grapheme-safe/full-name/44px.
Новые UI данные≥14, student body16, scale12/14/16/18/22/28/36, tabular-nums.
103/103 UI tests; lint/Stylelint/format/font regeneration PASS.32 PNG RU/RO×4 widths×2roles×loaded/blocked.
3 unique font GET/page,63492 loaded body bytes/0 blocked;32 external sentinel aborts.
48/48 v2 budgets PASS, max241999. JS dependencies/lockfile прежние; Python FontTools/Brotli
pinned dev-only isolated target. StateBoundary RU на RO/full WCAG/actual speech/legacy migration остаются открытыми.

## TASK-005 — токены, контраст и Stylelint, 03.11.2026

[Отчёт](../output/k8k-tasks/TASK-005/report.md),
[галерея](../output/k8k-tasks/TASK-005/runs/2026-11-03T21-34-16.851Z/gallery.html),
[route delta](../output/k8k-tasks/TASK-005/runs/2026-11-03T21-34-16.851Z/bundle.md).
Единственный tokens.css сохранён; 25 измерений независимо совпали с culori,
17 прежних порогов проходят. Accent на sand 2,78:1 — запрещённое назначение.
Общие hover/focus/disabled/error и размеры 48/44/36 проверяемы; статусы-чипы имеют текст и иконку.
Stylelint включён в UI lint/test:design и CI. Проверяются все 8 CSS-файлов пяти scoped roots;
715 точных legacy declaration entries требуют удаления в TASK-035/058/067/071.
Новые/изменённые/duplicate/stale entries дают fail; у packages/ui исключений нет.
98 UI tests PASS, 16 synthetic PNG RU/RO × 4 ширины × student/staff; overflow нет.
48/48 route budgets PASS: student 187526 (+147), platform 125568 (+160),
manager max 238247 (+158), fonts 59948 без изменения. Три pinned MIT dev-only tools;
все прежние lockfile resolutions сохранены. StateBoundary RU на RO остаётся в TASK-012/015;
это не общий WCAG/i18n gate и не визуальное утверждение provisional палитры.

## TASK-004 — route budgets и адресный реестр, 03.11.2026

[Отчёт](../output/k8k-tasks/TASK-004/report.md),
[budgets](../output/k8k-tasks/TASK-004/runs/2026-11-03T21-10-19-078Z-0b1240/bundle.md),
[defects](../output/k8k-tasks/TASK-004/runs/2026-11-03T21-10-19-078Z-0b1240/defects.md).
Fresh source Vite builds/manifest для3 frontend:48/48 inventory entries проходят256000 байт,
включая59948 raw WOFF2. Max student187379/platform125408/manager238089; optional passkey
closure178457. Static shared chunks deduped, active lazy tab включён явно; пропавшие
manifest/import/asset дают unavailable/fail, превышение лимита — nonzero exit.
Исторические delta недостоверны и оставлены null с причинами. Source/lockfile/build
provenance записаны.74 OPEN дефекта имеют reproduction/impact/evidence/future TASK;
в том числе исходный student secret-command useMutation cache path (TASK-019/034/066).
Продуктовый код не удалялся/не исправлялся ради метрики; бюджет не является release gate.

## TASK-003 — воспроизводимый baseline текущего UI, 03.11.2026

[Отчёт](../output/k8k-tasks/TASK-003/report.md),
[INDEX](../output/k8k-tasks/TASK-003/runs/2026-11-03T20-50-31-027Z-8bc616/INDEX.md),
[галерея](../output/k8k-tasks/TASK-003/runs/2026-11-03T20-50-31-027Z-8bc616/gallery.html).
48/48 inventory surfaces сняты в RU/RO на360/768/1024/1280,134 сценария в2 независимых проходах:
2144 строки,2128 PNG,16 health-empty NOT_RUN. Покрыты формы/диалоги/editor/pending/conflict/MFA
и9 общих классов состояний с отдельными pending/unknown. У1064/1064 пар совпадают тексты и размеры;
1010 PNG совпадают побайтно,54 малых различия сохранены, максимум0,11% пикселей.
124 overflow screenshots (62 уникальных first-pass наблюдения) и частичная RU/RO локализация
зафиксированы без исправления/маскирования. У39 operations нет fixture DTO findings;
532/532 внешних sentinel requests прерваны;399 source inputs неизменны.
Бизнес-API/БД/провайдеры не запускались. Это baseline после существующего инкремента,
не before-инкремента и не приёмочный UI/ACL/WCAG/FND/LEGAL/Meet/production gate.

## TASK-002 — полный source inventory, 03.11.2026

[Инвентарь](../output/k8k-tasks/TASK-002/inventory.md) и
[отчёт](../output/k8k-tasks/TASK-002/report.md):48 точек входа/URL-поверхностей,
140 SDK contracts,89 используемых operations,59 write refs. Покрыты реальные routes,
manager tab/staff section query, формы/диалоги/handlers, read/command lifecycle,
controller→service→ACL и регистрация в AppModule. Все28 VIS12 модулей и7 дополнительных
строк имеют реальные source references, ограничения и конкретные будущие TASK.
Student history/dispute/PDF APIs существуют, но UI их не вызывает; teacher EducationModule
пуст; generic start/outcome/payroll API не равны teacher workflow. `confirmManagerPayment`
отправляет на согласование директору. Workspace take50/100 не даёт школьных KPI.
Свежие проверки — только source-inventory verifier и его негативные fixtures, ESLint/Prettier
локального helper. Приложение/БД/browser здесь не тестировались; продуктовый код не менялся.

## TASK-001 — проверенное сохранение основы, 03.11.2026

Выполнен только TASK-001: [отчёт](../output/k8k-tasks/TASK-001/report.md).
Новый manifest и binary patch дополнены побайтными копиями25 tracked и145 untracked
файлов (включая Reports, locale и StudentHome). Все170 файлов восстановлены отдельно;
HEAD→worktree patch прочитан, проверен и применён только в изолированном каталоге.
Повторный timestamped-снимок имеет тот же dirty digest и сохраняет предыдущие версии.
HEAD `171db2142858e035594737e141d422fa5378e844`, ветка `feat/k8k-design`, dirty digest
`d716b9262ca859e0048d46b563872d9690026089eb1cb53b28f453555044ee76`.
Старый baseline и пользовательские RAR сохранены; их hashes до/после совпали.
Хеши не являются backup содержимого исключённых архивов/ignored/session-файлов.
Продуктовый код не менялся. Нижние результаты инкремента — прежние доказательства;
новый UI/browser/regression gate в TASK-001 не запускался.

## Реализовано

- Сохранён снимок HEAD/dirty patch/SHA256; актуализированы действующие инструкции, план и матрица28 dashboard-модулей. Frozen исходники не менялись.
- Добавлены typed locale ru/ro, сохранение выбора, cross-tab синхронизация, переключатель в общей оболочке и общем входе. Навигация/свежесть/новый экран отчётов локализованы; полный перевод приложения ещё не выполнен.
- Добавлены общие Button/IconButton/Field/StatusChip/Avatar/Card без SDK/прав/доменных команд.
- Все25 документированных цветов проверяются по WCAG; accent отдельно запрещён для обычного текста и графики на sand. Починен устаревший design-check.
- Hero ученика сохраняет текущий SCHEDULED урок в существующем60-минутном join window. SQL по-прежнему проверяет предметное право и назначение; click не проводит урок.
- Подключён существующий API опубликованных восьмиурочных отчётов: список/период/содержание/явное прочтение, пагинация, отдельный маршрут и ссылка из навыков/главной/уведомления.
- Колокольчик содержит пагинацию/прочитать все; прежний адрес notifications в K8K перенаправляется к раскрытому колокольчику. Legacy view сохранён.
- Разделы сотрудников адресуются query-параметром section с browser history; серверные команды не добавлялись в staff preview.

## Проверки текущего инкремента

- UI64/64, ученический presentation9/9, server dashboard32/32. Dashboard unit/SQL mocks не заменяют реальную PostgreSQL-проверку.
- Адресные сборки UI/API/student/platform; manager typecheck; ESLint изменённых компонентов/scripts и Prettier успешны.
- Fixture browser: отчёт на360/768/1024/1280 без overflow, axe0 на каждой ширине; сохранениеRU/RO после reload; переход legacy events→bell; read-all; Escape. Только локальные HTTP fixtures, внешний network заблокирован. Результат: output/k8k-implementation/browser/results.json.
- Screenshot отчёта360 визуально просмотрен; baseline скриншоты всех ролей не переснимались.
- GzipJS/CSS+fonts student187608/platform125382 <256000. Manager budget не измерен заново.

## Осталось по принятому плану

Инвентарь завершён в TASK-002, текущая screenshot/state baseline-матрица — в TASK-003;
future before/after сравнения и исправления74 OPEN записей остаются впереди;
текущие бюджеты/реестр завершены в TASK-004.
Полный переводRU/RO (включая account-ui/CRM/state messages); Radix/Storybook/полный UI-kit; удаление legacy CSS allowlist;
subject-access/subscriptions/manager contacts DTO; staff контекст/пагинация/action capabilities/priority;
teacher education/review/report/appeals/current-rate; CRM journal/board pagination; director approvals queues;
подключение существующих PDF API и глубокая ссылка к старому отчёту за пределами текущей
страницы; общий итоговый regression.

Не изменялись рабочая БД, миграции, финансовые формулы и production. Никаких push/deploy. Новые backend отчётные/педагогические модули не выдаются за завершённые. FND-GATE/LEGAL/FIN-LEGAL/MeetPOC/G4 остаются открытыми.

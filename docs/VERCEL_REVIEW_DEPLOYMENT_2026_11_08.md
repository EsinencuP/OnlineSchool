# Публикация текущих кабинетов для просмотра, 08.11.2026

Прямой запрос владельца: закоммитить текущую работу, отправить её в существующий
репозиторий и опубликовать актуальную версию на существующем Vercel, чтобы пройти
по кабинетам. Это отдельное разрешение на публикацию после TASK-035; оно не меняет
историческое решение gate и не объявляет FND/legal/полную функциональную готовность.

Репозиторий: `EsinencuP/OnlineSchool`, production branch `main`.
Существующий Vercel project: `onlineschool`, регион `fra1`, Node24.
Основной адрес: https://onlineschool-xi.vercel.app/account?ui.k8k=1

Параметр `ui.k8k=1` включает текущий дизайн в пределах вкладки. Для сравнения
сохранён `ui.k8k=0`; режим оформления не влияет на серверные права.
Все пять кабинетов используют прежний API и существующую БД. Аккаунт →
«Сменить пользователя» переключает только разрешённые синтетические аккаунты.
Опубликованные владельцем тестовые доступы находятся в README.md.

Сборка `infra/vercel/build.mjs` сначала компилирует приложения, затем применяет
штатные накопленные migrations и проверяет restricted runtime permissions.
Новая накопленная миграция добавляет nullable `staff_accounts.student_phone_e164`
и проверку E.164; данных не удаляет и номера сама не придумывает.
Provisioning/seed окна ранее выключены; повторно их не включать.
Секреты остаются в существующем Vercel environment, не в Git или локальных outputs.

Рабочие исходники, документация и тестовые доказательства сохраняются в Git.
Архив `apps/apps.rar` превышает100MiB и хранится через Git LFS; файл не удаляется.
`.vercelignore` исключает локальные outputs и архивы из deployment uploads.
Вложенные временные репозитории из recovery rehearsals не добавляются как gitlinks:
их содержимое без служебных `.git` сохранено в
`output/recovery-workspaces-2026-11-08.tar.gz`; исходные каталоги и metadata остаются
локально. Это устраняет ошибку Git «does not have a commit checked out» без удаления истории.
Allowlist Docker build context дополнен manifest `packages/ui/package.json`, чтобы
worker мог установить актуальный workspace dependency graph.

Первый source commit: `d08d501dd5c0e0c588ceecf600028a4b3ff53b63`, Vercel deployment
`dpl_HSGx8Dpjs6DNBgUPBUiRUNka4uAP` получил READY. Реальный browser smoke прошёл31
просмотр/viewport, смену на все4 остальные роли и logout; исключений браузера нет.
Обнаружены два503 от student dashboard; первый результат и снимки сохранены в
`output/vercel-release-2026-11-08/`, этот прогон явно имеет FAIL.

Исправление: параметр server time перед вычитанием interval явно приведён к
`timestamptz`, как тип scheduled_at. Это сохраняет60-минутное окно и все own-scope,
access и Meet guards; данные, права и providers не подменяются. К штатному
`student-cabinet-runtime-check.mjs` добавлена настоящая параметризованная проекция
nextLesson для nil profile под ограниченным runtime role в READ ONLY transaction.
Она проверяет PostgreSQL operators/permissions до публикации. Подключённые Neon
accounts не предоставляют рабочий проект, поэтому проверка использует существующие
protected environment credentials внутри Vercel, не извлекая их локально.

Повторяемая проверка опубликованного UI/API: `pnpm test:vercel-review`.
Она проверяет реальную роль каждой сессии,31 маршрутов/viewport, мобильный вид пяти
кабинетов, switching/logout и отсутствие API5xx/JS exceptions. Business mutations
заблокированы. Новые runtime outputs пишутся в стандартно ignored
`.vercel/release/review-smoke/runs/`, latest-smoke.json указывает результат; секреты,
cookies/storage state, trace и video не сохраняются. Финальный статус проверяется
после исправления и завершения повторной публикации.

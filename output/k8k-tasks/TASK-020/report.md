# TASK-020 — устойчивая оболочка и адресуемые staff-разделы

**Статус — DONE в объёме TASK-020.** Проверено 7 ноября 2026 года.

**Основа.** `feat/k8k-design`, HEAD `60e2a0c47cbcc744dc658a85f386833146e836b3`, dirty digest `d380a7b657221f25c602012b93993e6f9864bda38811fdf5c44ea9a25666dbcb`. Исходная рабочая копия включает TASK-019. Проверены хэши 26 независимых файлов, в том числе правок AGENTS, student dashboard, его теста и старых `output/stu12`. Общий `App.tsx` содержит оба инкремента, исходный хэш взят из артефакта TASK-019. [Основа и хэши](basis.json) · [TASK-019](../TASK-019/report.md)

## Исходное поведение и результат

Platform уже использовал `section`, History API, AppShell, ролевые разделы и серверный контекст. TASK-019 дал общую границу смены сессии, отмену запросов и проверку поколения. Manager Web уже использовал адресуемые CRM-карточки, Student Cabinet перенаправлял прежний URL уведомлений в колокольчик.

- Staff-функции вынесены из `App.tsx` в `StaffCabinet`, `StaffWorkspace` и `StaffDetail`. Оболочка сохраняет роль и порядок пунктов при обновлении, а карточка проверяет `actorContext` и поколение сессии. Смена локали меняет подписи и формат времени на том же экране. [Кабинет](../../../apps/platform/src/staff/StaffCabinet.tsx) · [Карточка](../../../apps/platform/src/staff/StaffDetail.tsx)
- Действующий `?section=` совместим с `filter` и `id`. Фильтры расписания, ДЗ и задач используют перечислимые значения и применяются к текущей серверной выборке с сохранением coverage. History API восстанавливает выбранный фильтр и позицию списка. Явный переход фокусирует заголовок, а refetch оставляет фокус на текущем элементе. Прямая ссылка после входа с той же staff-ролью возвращает в ту же карточку. [Навигация](../../../apps/platform/src/staff/navigation.ts) · [Списки](../../../apps/platform/src/staff/StaffWorkspace.tsx)
- В K8K от 1024 px виден Sidebar, ниже работает BottomNav с «Ещё». `AppShell.mobileMore` использует существующий Escape и возвращает фокус на открывшую кнопку. Справка доступна в Sidebar и «Ещё», аккаунт остаётся в шапке. Действующий opt-in `ui.k8k` и legacy entry points сохранены. [AppShell](../../../packages/ui/src/shell.tsx) · [Стили](../../../apps/platform/src/staff/staff.css)
- Новая операция `getPlatformWorkspaceDetail(section, id)` читает один объект в read-only транзакции. Для преподавателя ограничение урока использует назначенного преподавателя, ученика — активное назначение, ДЗ — автора выдачи. Директор читает школьные уроки и учеников с назначением, а также открытые задачи менеджеров. Оператор работает с существующим health API. Для чужого и отсутствующего ID возвращается нейтральный 404, для недопустимого UUID или раздела — 400. Применяются текущие MFA, RBAC, `private, no-store`. [Controller](../../../apps/api/src/modules/platform/platform.module.ts) · [Read service](../../../apps/api/src/modules/platform/workspace.service.ts)

## Контракты и источники

`GET /api/v1/platform/workspace/{section}/{id}` возвращает `WorkspaceDetailDto` с `actorContext` и `item` разрешённой проекции. Карточка урока исключает Meet URL. Штатный OpenAPI/Orval добавил 1 GET и 3 схемы. Прежние 144 операции и их схемы совпадают с HEAD. Изменений БД, мутаций и зависимостей нет. [Проверка контракта](contracts.json) · [Design note](design-note.md)

Применены TASK-020 §§5–10 и VIS-04/B, VIS-06/B, VIS-08/B, VIS-10/B, VIS-11/B. Границы ролей и исключения доступа следуют действующим решениям владельца и серверным guards. Раздел 7 дизайн-инструкций разрешает недостающий API-инкремент. [Задание](../../../docs/k8k-redesign-tasks/TASK-020.md) · [Реестр VIS](../../../docs/K8K_Academy_UX_decision_register_v0.9.md) · [Дизайн-инструкции](../../../docs/K8K_DESIGN_INSTRUCTIONS.md)

## Свежие проверки

| Команда | Exit | Доказательство |
| --- | ---: | --- |
| `pnpm --filter @online-school/api build` | 0 | Целевая компиляция. [Лог](api-build.log) |
| `pnpm --filter @online-school/api export:openapi` с `NODE_OPTIONS=--import=file:///D:/OnlineSchool/output/k8k-tasks/TASK-018/no-db-export.mjs` | 0 | 145 операций. Preload блокирует доступ к клиенту БД. [Лог](openapi.log) |
| `pnpm --filter @online-school/api-contracts generate:client`, затем `pnpm --filter @online-school/api-contracts build` | 0 | Orval и типы из экспортированной схемы. [Генерация](sdk.log) |
| `pnpm test:k8k-staff-context` | 0 | 17 HTTP/SDK тестов. Собственные и чужие объекты, директор и оператор, malformed ID, MFA, 401, no-store и отсутствие записей. [Лог](staff-http.log) |
| `pnpm --filter @online-school/ui build` | 0 | AppShell и декларации. [Лог](ui-build.log) |
| `pnpm --filter @online-school/platform --filter @online-school/student-cabinet --filter @online-school/manager-web typecheck` | 0 | Три приложения. [Лог](typecheck.log) |
| `pnpm --filter @online-school/platform test:staff-context` | 0 | 25 проверок с реальным Platform UI и перехваченным API, включая восстановление ссылки после входа. [Лог](staff-browser.log) · [Результаты](staff-browser.json) |
| `pnpm --filter @online-school/platform test:account-chrome` | 0 | 19 проверок меню, локали, сохранения черновика и смены сессии. [Лог](account-browser.log) · [Результаты](account-browser.json) |
| `pnpm --filter @online-school/student-cabinet exec playwright test --config playwright.config.mjs navigation.spec.mjs --reporter=line --output D:/OnlineSchool/output/k8k-tasks/TASK-020/student-browser` | 0 | Legacy уведомления открывают колокольчик. Перед тестом выполнена целевая Vite-сборка с `envDir:false`. [Лог](student-compat.log) |
| `pnpm exec eslint --max-warnings 0` и `pnpm exec prettier --check` по изменённым исходникам и тестам | 0 | [ESLint](lint.log) · [Prettier](format.log) |
| `pnpm --filter @online-school/ui lint:css` | 0 | 18 файлов, 715 исторических деклараций. Расхождений нет. [Лог](css-lint.log) |
| `node output/k8k-tasks/TASK-020/budget.mjs` | 0 | 48/48 маршрутов, максимум 255 343 из 256 000 байт, включая локальные WOFF2. Platform 149 590 байт. [Данные](budgets.json) · [Лог](budget.log) |

## Приёмка

| Сценарий | Статус | Наблюдение |
| --- | --- | --- |
| Refresh восстанавливает staff section | PASS | После reload `section=lessons` активен, серверный список и фильтр восстановлены. |
| Back/Forward | PASS | Browser Back возвращает исходный scroll и список, Forward заново читает карточку. |
| Foreign ID denied | PASS | Серверный fixture проверяет принадлежность объекта. UI показывает нейтральный 404 и убирает прежнюю карточку. |
| Mobile More Escape | PASS | При 360/768 px фокус переходит в меню и по Escape возвращается на «Ещё». При 1024/1280 px отображается Sidebar. |
| Фильтры сохранены | PASS | `SCHEDULED` восстанавливается из URL, `CANCELLED` даёт пустую отфильтрованную выборку, возврат восстанавливает прежний фильтр. |
| Refetch не крадёт focus | PASS | Событие online вызывает новый объектный GET, фокус остаётся на ссылке возврата. |

## Визуальные доказательства и границы

16 PNG для карточки урока преподавателя и директора в RU/RO на 360, 768, 1024 и 1280 px. Фикстура использует длинный синтетический заголовок и `Asia/Tokyo`, заведомо отличную от локальной зоны. Браузер проверил отсутствие горизонтального overflow и работу клавиатуры. [Снимки](screenshots/) · [RO 360](screenshots/detail-teacher-ro-360.png) · [RU 1280](screenshots/detail-director-ru-1280.png)

Проверки выполнялись в Chromium и Nest HTTP с локальными фикстурами. Физические мобильные safe-area insets и assistive technology отдельно не проверялись. Фильтры работают в границах текущей выборки, у которой сохранён признак неполного покрытия. Полный ролевой прогон, работающая БД, production, внешние провайдеры и FND-GATE остаются за рамками этих доказательств.

## Передача и обратимость

Следующие ролевые задачи могут использовать `?section=...&id=...`, `filter`, `getPlatformWorkspaceDetail` и `AppShell.mobileMore`. Полный workflow преподавателя и директора остаётся в ролевых задачах. Сквозная проверка кабинетов относится к TASK-067. Откат ограничен перечисленными файлами и строками учёта этого инкремента. На `App.tsx` при откате требуется сохранить TASK-019, ориентируясь на исходный хэш и его отчёт. [Журнал](../../../docs/k8k-redesign-tasks/EXECUTION_LOG.md) · [Матрица](../../../docs/K8K_REQUIREMENTS_MATRIX.md)

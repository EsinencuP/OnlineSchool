# TASK-021 — одна политика чтения и ясная свежесть

**Статус — DONE в объёме TASK-021**

## Основа

Ветка `feat/k8k-design`, HEAD `60e2a0c47cbcc744dc658a85f386833146e836b3`, dirty digest `88e27d1a755f76b8e0d7317a3545e474c2ac5174db9a2f5eb305940171619d92`. Сверены 17 исходников и 48 маршрутных бюджетов TASK-020. Проверено 154 копии исходного рабочего дерева и 9 исторических защищённых входов. [Основа](basis.json) · [Сверка](preservation.json) · [Исходный снимок](before.json)

## Исходный код и изменения

До TASK существовали общие интервалы и `StateBoundary`, отдельные focus/interval/reconnect в наблюдателях TanStack, таймер инвалидации для следующего урока и actor-защита чтений. Сигналы могли конкурировать, а закрытие Radix-диалога не возобновляло отложенный запрос.

| Путь | Изменение |
|---|---|
| `packages/ui/src/refresh.ts` | Один координатор для активной группы. Сигналы focus, visibility, online и интервал объединяются. Пауза учитывает редактирование, диалоги, скрытую вкладку и offline. Ожидающее чтение возобновляется один раз. При размонтировании освобождаются таймеры и слушатели. |
| `apps/student-cabinet/src/api.ts`, `Layout.tsx`, `pages/StudentHome.tsx` | Раздельные группы 60 с и 15 с. Запросы сессии остаются у TanStack. T−10 вызывает того же владельца dashboard. Meet открывается по свежему `canJoin` в ответе сервера и прежним проверкам ссылки и статуса. |
| `apps/student-cabinet/src/pages/Lessons.tsx`, `StudentNotificationMenu.tsx` | У критичных чтений показано состояние свежести. Пустой результат при ошибке источника отображается как `stale`. |
| `apps/manager-web/src/api/client.ts`, `components/layout.tsx`, `pages/student/Notifications.tsx` | CRM-ключи распределены между общей operational-группой и очередью уведомлений с `QUEUED`. Адресная инвалидация после команды сохраняет отдельный путь. |
| `apps/manager-web/src/components/ui.tsx`, `pages/Dashboard.tsx` | `State` получает `asOf` dashboard отдельно от `dataUpdatedAt`. |
| `apps/platform/src/staff/StaffCabinet.tsx`, `StaffDetail.tsx` | Координатор сохраняет cooldown между чтениями, учитывает занятость карточки, сохраняет session preflight оператора. Staff-карточка показывает `actorContext.asOf`, время получения и предупреждение о возрасте. |

60/15/120 с — предварительные значения TASK-021 §6. Для объединения событий использовано окно 1 с. Существующий календарь включён в оперативное расписание, архивный список, опубликованные и финансовые выборки работают по своим прежним явным триггерам. Эскалации, авторизация, подтверждение проведения и финансовые решения остаются у серверных источников. Приоритет — TASK-021 §§3/5/6, VIS-06/11, K8K Design §§2–7 и действующие решения владельца. [Design note](design-note.md) · [Карта чтений](refresh-map.md)

DTO, SDK, миграции и lockfile совпадают с исходным рабочим деревом. `State.asOf`, `StudentDeadlineRead` и `StaffDetail.onReading` — локальные frontend-интерфейсы. `cancelRefetch:false` использует контракт установленного TanStack Query 5.105.0. Команды, применённые миграции и рабочая БД не затронуты.

## Свежие проверки

| Команда | Exit code | Результат |
|---|---:|---|
| `pnpm --filter @online-school/ui build` | 0 | [Сборка](build.log) |
| `pnpm --filter @online-school/ui test` | 0 | 137 тестов, включая правила `stale/empty/403`, время источника и получения. [Лог](ui.log) |
| `pnpm --filter @online-school/ui lint` | 0 | ESLint и Stylelint. [Лог](lint.log) |
| `pnpm exec eslint <изменённые TS/TSX и scripts/k8k-refresh-*.mjs> --max-warnings 0` | 0 | Адресный lint приложений, стенда и budget runner. [Лог](scoped-eslint.log) |
| `pnpm --filter @online-school/manager-web typecheck:ui-refresh` и `pnpm --filter @online-school/manager-web exec tsc -p tsconfig.json --pretty false` | 0 | Типы стенда и CRM. [Лог](types.log) |
| `pnpm --filter @online-school/platform exec tsc -p tsconfig.json --pretty false` | 0 | Типы Platform и staff. [Лог](platform.log) |
| `pnpm --filter @online-school/student-cabinet typecheck` | 0 | Типы приложения ученика. [Лог](student-types.log) |
| `pnpm --filter @online-school/student-cabinet test:presentation` | 0 | 9 тестов, в том числе время сервера и разрешение Meet. [Лог](student-presentation.log) |
| `pnpm k8k:refresh:evidence` | 0 | 50 сценариев, 115 зафиксированных GET, 16 PNG. Все API локальные и перехвачены. [Лог](evidence.log) · [Сценарии и хеши](runs/2026-11-06T22-42-01.558Z/browser.json) |
| `pnpm --filter @online-school/platform test:staff-context` | 0 | 25 локальных сценариев преподавателя и директора, в том числе чужая карточка и очистка при 403. [Лог](staff.log) |
| `pnpm k8k:refresh:budget` | 0 | 48/48. Максимум 255 831 байт у `/manager/students/:id?tab=payments`, запас 169 байт. В каждом маршруте учтено 63 492 байта локальных шрифтов. [Лог](budget.log) · [Расчёт](budgets.json) |

## Визуальные доказательства

`/` — изолированный ученический fixture на реальном `useStudentQuery`, React Query и Radix. RU/RO на 360, 768, 1024 и 1280 px, переход Tab, стабильная DOM-нода с вводом, фокус и свежесть пустого ответа. `/student` — действующие `StudentLayout` и `StudentHome` с синтетическими GET, RU/RO на 360 px. В отдельном staff smoke проверены длинное название карточки, фокус и навигация.

[RO 360, stale empty](runs/2026-11-06T22-42-01.558Z/ro-360-stale-empty.png) · [RU 360, ответ сервера разрешил Meet](runs/2026-11-06T22-42-01.558Z/ru-360-server-can-join.png)

## Acceptance checklist

| Критерий | Статус | Доказательство |
|---|---|---|
| Подтвердить TASK-020 и определить владельцев | PASS | 17 совпавших хешей, 48 исторических строк; отдельная карта текущих ключей. |
| Focus + visibility + online и in-flight | PASS | Счётчики GET при задержанном ответе и повторных сигналах. |
| Интервалы 60/15 с, hidden/offline и cleanup | PASS | Управляемые часы; нет вызовов до интервала, offline или после размонтирования; reports читается только при загрузке. |
| Редактирование и закрытие диалога | PASS | Та же DOM-нода, значение и фокус; после закрытия ровно один GET. |
| Auth и post-command invalidation | PASS | Auth focus и прямая инвалидация во время ввода. Мутация в стенде не выполняется. |
| T−10 и серверное право | PASS | GET начат по дедлайну; во время задержки нет href; последующий подтверждённый ответ открывает Meet. |
| Stale пустого снимка и два времени | PASS | 503 поверх cached-empty, прежнее время источника и последнее успешное получение. |
| Локальная матрица и бюджет | PASS | Два языка, четыре ширины, 16 PNG, 48 бюджетов и optional action. |
| Рабочая БД, внешний Meet и другие провайдеры, полная ролевая и WCAG-приёмка | NOT_RUN | Изолированные fixtures и адресные проверки по Phase 0. |

## Передача и обратимость

TASK-022 получает текущие `ManagerLayout`, dashboard key и `State.asOf`; TASK-028 получает ученический `StudentDeadlineRead` и путь T−10. Эти задачи выдаются отдельно. Для точечного отката сверить `preservation.json` и вернуть изменения TASK-021 по hunks с использованием `before/`; исходные dirty-файлы и история сохраняются. [Передача](handoff.md)

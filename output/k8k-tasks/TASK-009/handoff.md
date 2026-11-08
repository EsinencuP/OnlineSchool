# TASK-009 — контракты и места применения

Экспорты находятся в `packages/ui/src/index.ts` и `packages/ui/src/composites.tsx`. Стили загружаются через существующий `@online-school/ui/style.css`.

| Компонент | Контракт | Владение состоянием |
|---|---|---|
| `Tabs` | `value`, `onValueChange`, `label`, `items: TabItem[]`, `activationMode`, `orientation`, `mountPolicy` и ref корня | Приложение принимает запрос смены. `manual` по умолчанию отделяет перемещение фокуса от активации. `keep-mounted` оставляет поля в скрытой панели. Для `unmount-inactive` вызывающий код сначала проверяет несохранённый ввод. |
| `Segmented` | `value`, `onValueChange`, `label`, `options: SegmentedOption[]`, optional `name` и ref `fieldset` | Режим, дата, фильтры, URL и запросы остаются у приложения. Нативные radio поддерживают стрелки и Space. Home/End выбирают первый и последний доступные варианты. |
| `Tooltip` | `open`, `onOpenChange`, `label`, `content: string` и ref кнопки пояснения | Отдельная кнопка пояснения поддерживает hover, фокус и tap. Текст причины недоступности передаётся самому контролу через `disabledReason`. |
| `HeroCard`, `StatTile` | `InformationCardProps` с `title`, `value`, `unit`, `source`, `period`, `action`, `state`, `stateText` | Caller предоставляет авторитетное значение, период и доступное действие. Денежные значения передаются точными строками. При `forbidden` и `session-expired` остаются безопасный заголовок и описание состояния. |
| `Toast` | `items: ToastMessage[]`, `onDismiss(id)`, `label`. `ToastMessage` содержит `id`, `message`, `outcome` и совместимый `tone` | Caller создаёт запись после получения результата и удаляет её при dismiss. `queued` и `unknown` имеют отдельное оформление и текст. Для сообщения об ошибке используется `assertive`. Остальные результаты идут в `polite`. |

`Tabs` принимает уникальные `value`. Для панелей с формами используется ручная активация. При смене аккаунта защищённое дерево вкладок снимается на границе сессии. Проверка прав и выбор доступных вкладок принадлежат вызывающему коду. Скрытые панели рассчитаны на удержание формы в рамках текущей сессии.

Для каждого результата нужен новый непрозрачный ID. Toast запоминает объявленные ID на время жизни экземпляра и хранит текст актуальной партии объявлений. Повторное получение того же ID и перерендер сохраняют live region. Экземпляр монтируется внутри дерева конкретного аккаунта. Обработчик `onDismiss` удаляет запись из `items`. Чтение уведомления, принятие и решение задачи остаются отдельными серверными действиями.

| Место | Текущая точка | Применение |
|---|---|---|
| Расписание ученика | `apps/student-cabinet/src/pages/Lessons.tsx` | K8K list/calendar использует `Segmented`. `month`, `period`, `page` и запросы сохраняются в `Lessons`. Полная локализация экрана относится к TASK-029/034. |
| Расписание менеджера | `apps/manager-web/src/pages/Schedule.tsx` | Доступны day/week/list. При будущей адаптации дата и часовой пояс передаются из существующего состояния. |
| Карточка ученика в CRM | `apps/manager-web/src/pages/Student.tsx` | `?tab=` и ссылки уже задают навигацию. Маршрутные переходы сохраняют URL и историю. Локальные вкладки подходят для содержимого внутри одного маршрута после проверки guards. |
| Секции staff | `apps/platform/src/App.tsx` | Используются существующие разрешённые секции и URL. Контролируемое значение при адаптации берётся из router. |
| ДЗ и история ученика | `apps/student-cabinet/src/pages/Learning.tsx`, `Homework.tsx` | Единые хронологические списки. |

Строгая типизация выполняется командой `pnpm --filter @online-school/student-cabinet typecheck:ui-composites`. `pnpm k8k:composites:evidence` собирает source builds для бюджета и запускает Chromium на loopback. Stories находятся в `packages/ui/stories/composites.stories.tsx`. Storybook runtime предусмотрен TASK-013.

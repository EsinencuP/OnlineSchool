# TASK-010 — контракты до реализации

TASK-009 подтверждён по 484 хешам. До правок сохранены 488 файлов рабочей основы и бинарный diff.

- `DenseTable<T>` принимает `caption`, `rows`, `columns: DenseColumn<T>[]`, `rowKey`, `state`, `sort`, `onSortChange`, `pageInfo`, `onPageChange` и опциональный `selection`. Колонки задают `id`, `header`, `cell(row)` и разрешённые `sortDirections`. Сортировка передаёт `TableSort {columnId,direction}`. Приложение применяет серверный ответ к `sort` и `rows`.
- `TablePageInfo` содержит `total: number | null`, `hasMore`, опциональные `canFirst` и `canPrevious`. Shown считается по переданным строкам. Page intent `first | previous | next` обрабатывает приложение, которое хранит курсоры и фильтры. При неизвестном total интерфейс не вычисляет число страниц.
- `TableSelection<T>` содержит `ids`, `label(row)` и `onChange(id, selected)`. Данные и выбор контролирует вызывающий код. При 403 или завершении сессии строки и действия отсутствуют в DOM.
- `ListRow` принимает `title`, `details` и `actions`. Caller передаёт обычную ссылку на объект и доступные действия. `KanbanColumn` принимает `title`, `count: number | null`, `pending`, `children` и `actions`.
- TanStack React Table и table-core 8.21.3, MIT, 14.04.2025, React 18 peers. Только core row model и manual sorting/filtering/pagination. Мобильная таблица прокручивается внутри подписанной области. Виртуализация не нужна при текущих страницах 25 строк.

Инвентарь. Leads содержит семь полей и ссылку на заявку, фильтры stage/search/source/subjectId/overdue в URL. API возвращает `items/nextCursor` и фиксированный порядок createdAt/id DESC. Отдельный summary предоставляет общие агрегаты по стадиям. Доска сейчас группирует загруженную страницу. Students содержит имя/контакт, статус, балансы, урок и задачи. Сервер принимает `name/nextLesson/subscriptionEnd` и cursor без total. Tasks использует cursor и свои фильтры. Полная доска и переходы по стадиям относятся к TASK-053/054.

Первый потребитель — K8K list на `/manager/leads`. Сохраняются семь колонок, ссылка, URL фильтров и серверный cursor. Сортировка в этом потребителе отсутствует в контракте API. Универсальный sort, выбор по ID, фильтры и Back проверяются отдельным синтетическим read fixture. SDK, DTO, бизнес-команды и миграции сохраняются без изменений.

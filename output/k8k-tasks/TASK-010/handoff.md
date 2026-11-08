# TASK-010 — контракты списка

Экспорты доступны из @online-school/ui. Стили подключаются через существующий @online-school/ui/style.css.

| Контракт | Ответственность |
|---|---|
| DenseTable<T> | caption, rows, columns, rowKey и BoundaryState. Колонки содержат id, header и cell(row). Строки идут в порядке ответа. |
| TableSort | columnId и direction. sort сообщает применённый сервером порядок. sortDirections задаёт допустимые запросы на колонке. onSortChange получает следующее намерение. |
| TablePageInfo | total с числом или null, hasMore, canFirst и canPrevious. Показанное число берётся из видимых строк. onPageChange получает first, previous или next. |
| TableSelection<T> | ids, label(row), onChange(id, checked). Приложение хранит выбор и очищает его при смене контекста согласно своему контракту. |
| ListRow | title, details и actions. Caller передаёт ссылку на объект и доступные действия. |
| KanbanColumn | title, count с числом или null, pending, children и actions. count берётся из ответа агрегата, pending управляет сообщением и aria-busy. |

Приложение владеет фильтрами, историей URL, курсорами, чтением, доступом и freshness. Оно сохраняет
непрозрачный курсор и сбрасывает его при смене сортировки или фильтра по контракту своего API.
При 403 и завершении сессии DenseTable удаляет ячейки, ссылку, выбор и пагинацию из DOM.

K8K Leads использует LeadTable и ListManagerLeadsParams. У этого API фиксированный порядок
createdAt/id DESC и ответ items/nextCursor. Серверное число берётся только из источника,
который его возвращает. Summary использует собственный DTO. Старые счетчики стадий остаются
связанными с summary. Полная доска и её серверная пагинация относятся к TASK-053. Переходы
и eligibility стадий относятся к TASK-054.

Фикстура находится в apps/manager-web/test/ui-tables. Команда pnpm k8k:tables:evidence
проверяет типовые серверные страницы и реальный компонент Leads с локальными GET mocks.

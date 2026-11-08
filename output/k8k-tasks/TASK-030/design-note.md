# TASK-030 — проектирование до JSX

HomeworkEditor сохраняет queue.current, persist/persistRef, debounce 2000ms,
uploadIntent с request key/confirmKey и submitKey. Новых DTO/operations нет.
Для неизвестной отправки существующий getStudentHomeworkDetail проверяет версию,
текст и fileIds перед явным повтором того же submit intention.

Планируются HomeworkStatus, useHomeworkCopy и homeworkReturn для UI и адресуемой
пагинации. ListRow/StatusChip/Select/Button/ConfirmDialog/StateBoundary берутся
из packages/ui. Textarea остаётся controlled с тем же editor key delivery ID.

| Состояние | Контролы | Подтверждение |
| --- | --- | --- |
| draft dirty | ответ editable, debounce | изменения ещё не сохранены |
| save pending | ответ editable, очередь serial | сохранение идёт |
| save failed | ответ editable, retry | ввод сохраняется, success отсутствует |
| upload request/PUT/confirm | ответ сохраняется, submit ждёт upload | стадии различаются, файл появляется только после VERIFIED |
| submit pending | snapshot content/fileIds и key фиксированы | очередь save завершается до POST |
| submit unknown | ответ/fileIds intention неизменны, GET check | новый key не создаётся |
| submitted/reviewed | read-only | статус/версия/late из API |
| needs-revision | редактирование следующей версии | прежние версии/comments/files неизменны |
| forbidden/session revoked | приватный DOM удалён | blocker не мешает auth redirect |

Unknown submit содержит исходный body, key и baseVersion в памяти текущей сессии.
Явный повтор сначала читает detail. Совпавшая новая версия подтверждает полученный
ответ без второго POST. Если версия не выросла и сервер допускает редактирование,
повтор использует прежний key/body. Иная новая версия требует просмотра истории.
Никакого автоматического повторения команды.

Сохранённый expiresAt используется только для server draft TTL. Новый серверный
снимок не заменяет текущий неподтверждённый текст. Навигационный blocker защищает
также выбранные файлы/unknown, возвращает фокус к ответу и пропускает auth redirect.
Expired upload сохраняет выбранный File, но сбрасывает request/confirm keys и URL.

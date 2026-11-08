# TASK-011 — контракты календаря

`Calendar` и `DatePicker` экспортируются из @online-school/ui. Стили подключаются через style.css.

| Контракт | Свойства |
|---|---|
| DatePickerProps | label, value YYYY-MM-DD, onValueChange, id, name, min, max, disabled. Ввод и кнопки дня обрабатывают plain date. |
| CalendarProps | label, timeZone (IANA), view day/week/list, days, events, horizon, refreshing, renderEvent. |
| CalendarEvent | id, revision, startsAt, endsAt, title, state, resourceId. Instants требуют Z или явного смещения. |
| CalendarHorizon | from включительно, to исключительно. null означает отсутствие загруженного диапазона. |

Серверные ID и ревизии передаются без вычисления. ManagerLessonDto сейчас не содержит revision.
Его адаптер передаёт null. Внешний caller отвечает за авторизованный read-model, horizon,
booking eligibility, запросы и действия. Free поступает как явное состояние интервала.
Частичный интервал за границей загруженных данных отображается как unknown.

Менеджерский URL использует date, view, studentId, kind, status. Дата читается через calendarDate.
Границы запросов проходят через существующий localToIso с reject. Ученический URL использует
month, view, period, page. Язык управляет подписями. Пояс приходит из контекста аккаунта.

Для TASK-029 доступен лёгкий режим Lessons. TASK-037 может использовать тот же read-only adapter
с авторизованными данными преподавателя. Ресурсные виды требуют read-model с ресурсами, статусами,
ревизиями и точным покрытием. [Оценка EventCalendar](event-calendar-review.json)

TASK-057 сохраняет существующий путь директорских исключений. Полная локализация прежних форм
и экранов относится к TASK-034/058.

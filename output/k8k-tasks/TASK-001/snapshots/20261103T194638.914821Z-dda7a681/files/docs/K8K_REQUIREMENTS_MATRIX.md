# K8K — матрица требований, 03.11.2026

Нормативная основа: UX v0.9/VIS12 v1.0, CON-addendum, специальные решения31.10–01.11, roadmap9.7, текущий план владельца03.11.2026. Названия DASH не совпадают с номерами инженерных задач. Таблица — текущий статус, не акт приёмки.

| Модуль DASH- | Задача | Источник | Право/контекст | Действие | Состояния | Статус |
|---|---|---|---|---|---|---|
| STU-01 | Текущий/следующий урок | dashboard/current rights | canJoin + own lesson | Meet/карточка | ready/stale/no link | исправлено; проверка границ |
| STU-02 | ДЗ | homework submissions | own delivery | черновик/отправка | pending/unknown/revision | существует; перенос контролов впереди |
| STU-03 | Занятия | upcoming/calendar | own enrollment | карточка | cancel/reschedule/empty | существует |
| STU-04 | Путь/отчёты | skills/snapshots/reports | published only | отчёт/read | 4 vs 8/empty/error | маршрут отчётов добавлен; PDF впереди |
| STU-05 | Абонемент по предметам | нужна предметная read-model | server access | детали | active/frozen/limited | требует API |
| STU-06 | Колокольчик | notifications | own events | read/source | empty/error/page | пагинация в колокольчике |
| STU-07 | Менеджер | CRM contacts | assigned manager | external | missing channel | требует имени/телефона в API |
| TCHD-01 | Следующий урок | см. VIS12 и текущий API | server role×action×object×context | существующая команда/деталь | VIS11 девять классов | требует API/проверки |
| TCHD-02 | План сегодня | см. VIS12 и текущий API | server role×action×object×context | существующая команда/деталь | VIS11 девять классов | требует API/проверки |
| TCHD-03 | Подтверждение факта | см. VIS12 и текущий API | server role×action×object×context | существующая команда/деталь | VIS11 девять классов | требует API/проверки |
| TCHD-04 | Проверка ДЗ | см. VIS12 и текущий API | server role×action×object×context | существующая команда/деталь | VIS11 девять классов | требует API/проверки |
| TCHD-05 | Навыки/отчёты4/8 | см. VIS12 и текущий API | server role×action×object×context | существующая команда/деталь | VIS11 девять классов | требует API/проверки |
| TCHD-06 | Личная ведомость | см. VIS12 и текущий API | server role×action×object×context | существующая команда/деталь | VIS11 девять классов | требует API/проверки |
| TCHD-07 | События/обращения | см. VIS12 и текущий API | server role×action×object×context | существующая команда/деталь | VIS11 девять классов | требует API/проверки |
| MGR-01 | Заявки | см. VIS12 и текущий API | server role×action×object×context | существующая команда/деталь | VIS11 девять классов | существует; UX-доработка |
| MGR-02 | Очередь | см. VIS12 и текущий API | server role×action×object×context | существующая команда/деталь | VIS11 девять классов | существует; UX-доработка |
| MGR-03 | Срочные | см. VIS12 и текущий API | server role×action×object×context | существующая команда/деталь | VIS11 девять классов | требует API/проверки |
| MGR-04 | Журнал контактов | см. VIS12 и текущий API | server role×action×object×context | существующая команда/деталь | VIS11 девять классов | требует API/проверки |
| MGR-05 | Организационные случаи | см. VIS12 и текущий API | server role×action×object×context | существующая команда/деталь | VIS11 девять классов | существует; UX-доработка |
| MGR-06 | Продления/платежи | см. VIS12 и текущий API | server role×action×object×context | существующая команда/деталь | VIS11 девять классов | существует; UX-доработка |
| MGR-07 | Обращения учителей | см. VIS12 и текущий API | server role×action×object×context | существующая команда/деталь | VIS11 девять классов | требует API/проверки |
| DIR-01 | Поступления | см. VIS12 и текущий API | server role×action×object×context | существующая команда/деталь | VIS11 девять классов | условно, выключено |
| DIR-02 | Расходы | см. VIS12 и текущий API | server role×action×object×context | существующая команда/деталь | VIS11 девять классов | условно, выключено |
| DIR-03 | Обязательства | см. VIS12 и текущий API | server role×action×object×context | существующая команда/деталь | VIS11 девять классов | условно, выключено |
| DIR-04 | Закрытие | см. VIS12 и текущий API | server role×action×object×context | существующая команда/деталь | VIS11 девять классов | условно, выключено |
| DIR-05 | Кадры | см. VIS12 и текущий API | server role×action×object×context | существующая команда/деталь | VIS11 девять классов | условно, выключено |
| DIR-06 | Риски | см. VIS12 и текущий API | server role×action×object×context | существующая команда/деталь | VIS11 девять классов | условно, выключено |
| DIR-07 | BI/P&L | см. VIS12 и текущий API | server role×action×object×context | существующая команда/деталь | VIS11 девять классов | вне выпуска |

## Сквозные проверки

Смена сессии/401/403, поздний ответ, CSRF/idempotency/unknown-result; 360/768/1024/1280; RU/RO и длинные подписи; серверные часы/DST; decimal-money; оплаченные права отдельно от денег и календаря; заморозка отдельно от истечения; нет внешних организационных автосообщений. Оператор: health API только чтение, проверка stale/error; общий вход: текущие MFA/password-only исключения и fixed demo catalog. Эти строки ещё требуют ролевого приёмочного прогона.

## Незакрытые работы

Полный инвентарь форм/команд и новая baseline screenshot/bundle-матрица; полный перевод; Radix/Storybook/Stylelint; subject-access DTO; staff контекст/пагинация/capabilities; teacher review/education APIs/appeals/current-rate; CRM contact journal/action eligibility/board paging; director decision queues; итоговый gate. Отсутствие API не означает успешное завершение скрытого модуля.

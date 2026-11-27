# Information architecture

## Entities and who owns the screen
| Entity | Source DTO | Primary screen | Also shown in |
|---|---|---|---|
| Lead | `LeadDto` | Manager → Заявки (kanban) | Manager overview (stages, daily) |
| Student | `StudentListItemDto`, `StudentCardDto` | Manager → Ученики (table + drawer) | Teacher → Ученики (own students) |
| Subscription | `ManagerSubscriptionDto` | Student drawer | Manager overview (expiring) |
| Lesson | `ManagerLessonDto` / teacher lesson DTOs | Manager → Расписание, Teacher → Расписание/Журнал | Overviews (today, 48 h) |
| Payment | `ManagerPaymentDto` | Manager → Платежи | Director → Решения (AWAITING_APPROVAL) |
| Task | `ManagerTaskDto` | Manager → Задачи | Manager overview attention |
| Decision | `DecisionItemDto` | Director → Решения | Director overview |
| Escalation | `EscalationDto` | Director → Команда › Эскалации | Director overview |
| Staff | `StaffItemDto` | Director → Команда | Director overview |
| Payroll / periods | `PayrollSummaryDto`, `PeriodDto`, `UnresolvedDto` | Director → Финансы | Director overview |

## Cabinets
- **Руководитель** `/director`: Обзор · Решения · Команда · Финансы.
- **Менеджер** `/manager`: Обзор · Заявки · Ученики · Задачи · Расписание · Платежи.
- **Преподаватель** `/teacher`: Сегодня · Расписание · Журнал · Ученики · Задания · Контрольные точки · Материалы · Начисления.
- **Ученик** `/student`.

## Levels
1. Overview: KPIs + attention queue.
2. Section: breakdown (by type, stage, teacher).
3. Records: table/kanban with filters from the URL, drawer for one record.

## Cross-cabinet links (one fact, one state)
- Manager "Отправить директору" → payment `AWAITING_APPROVAL` → director PAYMENT decision →
  `payment.decide` → manager sees Подтверждён/Отклонён with reason.
- Director staff metrics for the portfolio manager are computed from the manager store.

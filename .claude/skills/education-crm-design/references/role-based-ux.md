# Role-based UX

| Role | Primary goal | Density | Must see | Must not see |
|---|---|---|---|---|
| Руководитель | decide and spot risk | high, tables | decisions queue, escalations, team load, payroll, period close | per-student CRM noise unless drilled into |
| Менеджер | finish today's operations fast | high | attention queue, leads, students, tasks, schedule by teacher, payments | director-only finance (payroll, periods) |
| Преподаватель | teach; log results on time | medium, calm | today's lessons, journal backlog, homework, own schedule & availability, own accruals | other teachers, company finance, CRM pipeline |
| Ученик | next lesson and progress | low, friendly | next lesson, homework, progress, subscription | anything administrative |

Rules:
- Same shell, tokens and components for all roles; role accent only on active nav and primary accent buttons.
- Actions respect the mirrored backend rules (`*/logic.ts`); UI never offers a command the role does not have.
  Manager: cancel lesson with reason; no booking/reschedule changes without an owner decision.
  Director: approve only `ready` decisions; decline only request kinds, reason 3–500 chars.
- Teacher cabinet: earnings analytics (months, days, students, goal calculator labelled as a projection) and a «Связь с менеджером» card built on schedule requests; a real chat needs a backend endpoint.
- Student cabinet: exactly the v1 look — largest UI, mascot, pictures, colourful charts. Do not restyle it.

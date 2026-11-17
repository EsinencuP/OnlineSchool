# HANDOFF — backend: teacher + student committed; director D1–D4, D6 and manager M1–M3 uncommitted

State: teacher/student are in `5e1e5fb`. Working tree: director module (inbox D1 incl. request kinds, commands D2,
escalations D3, staff/hand-over/lifecycle D4, payroll/periods/unresolved D6), manager `teachers/` (M1), `availability/`, `contacts/` (M2),
`requests/` (M3), `operations/task-escalation.module.ts` (worker timer), Prisma models `ManagerAvailability`,
`TaskEscalation`, `ManagerRequest`, extended `ContactLog`, `scope/assignment-stamp.ts`.
Migrations (uncommitted): `20261116100000_dir02…`, `…110000_m1_students_insert_locale`, `…120000_dir03…`,
`…130000_mgr04_contact_journal`, `…140000_mgr_family_requests`, `…150000_dir04_staff_lifecycle`
(also redefines `mgr07_task_guard` to allow OPEN→OPEN re-addressing).
Test DB: Docker `online-school-fnd-ci-pg18` (WSL `Codex-Docker`, port 55500, `pg_hba` trust, keep WSL alive).
Clock skew between the API host and the DB container flakes some time-based tests by ±1–2 s; rerun once.

Next: D5 refunds (needs owner formula) → D7 subjects/sale conditions → M4 reconciliation/lead intake.
Open: period bounds are chosen by the director (recognition rules not approved); apply migrations + duplicate check on Neon; orval client not rebuilt; owner decisions (who may hand over besides
the director, urgent task catalog, shift schedule, director fallback, contact-journal roles/retention,
temporary-access limits, refund formula, KPI, teacher↔subject link); `erd-contract` unit test needs an LF checkout.

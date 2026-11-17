# TASK — DIR-D6: payroll overview, financial periods and the unresolved registry (DIR-03/DIR-04)

Outcome: the director sees what teachers earned vs. were actually paid vs. still owed, which open facts block a
period, and can open and close periods. Money commands stay where they are (`/accruals`, `/payouts/*`).

`/api/v1/director` (director only):
- `GET /payroll/summary?periodId=` — per currency and per teacher: accrued (recognised accruals), paid (confirmed
  payouts only), outstanding = accrued − paid, openAttempts (PENDING/UNKNOWN or succeeded without confirmation).
- `GET /payroll/teachers/:teacherId` — obligations with paid/outstanding, open attempts, director-exception flag.
- `GET /finance/unresolved?periodId=` — the same facts the period close refuses over: UNACCRUED_LESSON (conducted,
  no accrual), DISPUTED_LESSON, OPEN_PAYOUT_ATTEMPT, DRAFT_LEDGER_ENTRY; counts + items (≤100 per kind).
- `GET /periods` — periods with `blockers`, `finished`, `readyToClose`.
- `POST /periods {startsAt, endsAt}` — opens a period (1–32 days, no overlap: 409 `PERIOD_OVERLAP`; 422
  `INVALID_PERIOD`). Before this no API could create a period, so accruals/postings failed with `CLOSED_PERIOD`.
- `POST /periods/:id/close` — facade over the existing close (same command type, topic, rules and errors).
`PeriodsService` is now exported from `FinanceInfrastructureModule`. No schema change.

Out of scope (owner decisions): revenue/profit/cash KPIs (DIR-02, definitions not approved), recognition-period
rules and month boundaries (director chooses UTC bounds), period reopening/corrections after close, payout
execution through a bank, frontend.

Acceptance: PG18 `director-payroll-http.test.mjs` (3 pass: access/empty, accrual+payout totals and blockers, period
create/close incl. a disputed-lesson blocker) and the full PG regression; OpenAPI 227 operations; builds and eslint clean.

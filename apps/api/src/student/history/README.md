# Lesson history and addressed deduction disputes

GET `/api/v1/student/lessons/history` returns confirmed COMPLETED and NO_SHOW
lessons, descending by scheduled_at/id, with default page=1/pageSize=20 and maximum 100. One statement computes count and page; an empty page keeps the true total.
Student.id always comes from session context. Unknown/scope-selecting query keys
are rejected. STU-01 access and initial-password guards still apply, including 402
when access is completely suspended; no hidden exception is introduced.

Optional lessonId gives the owned fact for a detail view without scanning pages.
Optional subjectId narrows owned enrollment history. Both UUID filters are applied
before count and pagination. A foreign lesson has an empty result. History also
retains the existing CANCELLED case backed by a published APPROVED_CANCELLATION
consumption, distinct from COMPLETED and explicit NO_SHOW.

The student UI keeps one chronological history section with server total and
historyPage in the schedule URL. A detail view uses lessonId directly. Null legacy
balances remain unknown. A timed-out command retains its original key for the
addressed lesson request-result GET, including after reload. Only that key is kept
in actor-scoped sessionStorage, form descriptions stay in memory. Session teardown
clears pending keys. An absent receipt remains unknown and does not start a new
command.

COMPLETED requires a confirmed actual outcome, whose actual teacher and duration
are used. NO_SHOW requires the staff-confirmed explicit absence report introduced
in STU-03. A scheduled lesson, generic cancellation, unconfirmed/future outcome or
another student's lesson is not attendance history. Viewing history writes nothing.

## Deduction and balance meaning

The owner explicitly confirmed that balanceBefore/balanceAfter mean **subscription
lessons remaining**, not money. They are Decimal strings (`"10"`, `"9"`), with no
conversion through JavaScript Number. Money/currency journal totals are not exposed
as lesson quantities.

lessonDeducted means a currently effective, uncancelled EntitlementConsumption for
this lesson/enrollment that is backed by its published LedgerEntry. Draft entries
do not count. A cancelled consumption is no longer deducted, so this item exposes
false/null balances and cannot create another dispute for a restored right. Monetary
correction/reversal entries alone do not redefine quantitative consumption; the
quantitative cancellation source remains authoritative.

Two nullable numeric(20,0) fields on LedgerEntry store immutable subscription rights
immediately before and after a new consumption. EntitlementsService captures the
entire subscription's effective grants/adjustments/consumptions in the existing
SERIALIZABLE critical transaction, then passes the exact snapshot into ledger creation
and publication. It does not use only the consumed grant's balance. The mandatory
business/audit/outbox transaction remains intact.

SQL validates the snapshot pair, non-negative balance, consumption quantity and
actual subscription rights at insert. Captured values cannot be edited later;
existing published-entry immutability remains in force. Existing monetary
balance_snapshot JSON is unchanged. Old published entries are not updated or
reconstructed from today's balance: unknown historical snapshots stay null. Such
legacy deductions can still be disputed when otherwise eligible.

## Dispute eligibility and transaction

POST `/api/v1/student/lessons/:lessonId/dispute` accepts only a trimmed description
of 10–1000 characters. It requires normal session/CSRF and UUID Idempotency-Key.
The lesson scope guard checks ownership, and the critical transaction rechecks
session, student stage/access and ownership, including on cached replay. It locks
the lesson before evaluating current eligibility against database time.

An active published deduction, confirmed past attendance and age <=30 elapsed
24-hour days are required. The boundary is inclusive; 30 days plus 1 millisecond
is outside. This is an exact 720-hour window, without date truncation or DST drift.
There must be no ATTENDANCE_DISPUTE task with OPEN or IN_PROGRESS status for that
student/lesson. canDispute uses the same sources and eligibility conditions.

A new command while a case is open returns 409. An identical same-key network
retry replays its original 201 without writing another task, subject to current
authorization; a changed payload with that key remains 422 under core idempotency.
This distinction preserves retry safety while preventing duplicate open cases.

StudentCrmTaskService creates an addressed ATTENDANCE_DISPUTE task with Student.id,
lesson FK, private description and current assigned manager (or the unassigned
manager queue). AuditEvent and outbox commit atomically; failure rolls the task
and idempotency result back. Description is not copied into the outbox or logs.
Worker observes the committed event without creating a duplicate task. No general
helpdesk, attendance change, refund, right restoration, ledger correction or reopening
of a financial period is performed by this endpoint.

The database additionally enforces one OPEN/IN_PROGRESS attendance case per
student/lesson using a unique partial index, so different keys/processes cannot
bypass duplicate protection. Address/type are immutable; eligibility is checked for
creation/reopening. A manager can continue or close a case after the 30-day window
or after a right was restored; ordinary progress/closure does not rerun initial
admission. A reopened case must qualify again.

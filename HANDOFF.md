# Backend MVP handoff

The teacher and student increment is in `5e1e5fb`. Director D1–D4 and the initial
D6, manager M1–M3, and their six migrations dated 2026-11-16 are in `e24df42`.
The November 18 read-only inspection found the first 44 migrations applied in
order. The working Vercel alias still serves `9fac950`. Its latest build from
`163f3b8` failed with Prisma `P3009`. The database reports an unfinished
`20261116150000_dir04_staff_lifecycle` with zero applied steps. Both tables
from that migration are absent. The local migration now uses a valid
dollar-quoted function body and all 52 active SQL files pass the syntax check.
Database recovery requires a separately authorized release of the selected
source version. See [read-only release evidence](tests/evidence/backend-release-readonly-2026-11-18.json).

The local Vercel build checks migration history before deploying and requires a
fully applied source chain afterwards. The check uses a read-only transaction
and emits safe status codes. The verified Neon history blocks at
`20261116150000_dir04_staff_lifecycle`. The 44 completed migrations match the
checksums of the first 44 local files. All 19 PL/pgSQL bodies in the eight
pending files from that inspection pass the offline parser. See [deployment procedures](infra/vercel/README.md).

The published API responded with HTTP 200, while worker health returned HTTP
503. The database had zero fresh worker heartbeats, 22 due outbox events and
11 dead events. The worker last reported on November 7. Vercel's Hobby log
retention excludes the stop window. The cause remains unconfirmed. At the
configured memory size the provisioned-memory quota supports at most 420
continuous hours per month. All 11 dead events came from demo switching
and reported a missing consumer. The local worker now acknowledges that topic
and records the standard system audit.

The local queue diagnostics route requires verified MFA and a director or
technical operator role. Its exact SQL ran read-only on Neon and found 22 ready
outbox events and four overdue `schedule.outcome-deadline.v1` jobs. The schedule
processor handles that type. The local worker now continues the polling cycle
after an individual stage throws and logs a code identifying the stage. See
[queue recovery checks](infra/vercel/README.md#диагностика-очереди).

Manual replay is implemented for the 11 demo-switch acknowledgements. A read-only
Neon check confirmed all 11 satisfy the source audit and payload predicates.
The command uses verified MFA, CSRF and critical-command idempotency. The worker
records the original observation key. The 53rd local migration adds a partial
unique index so different operators cannot create parallel replays for the same
source. Application of the index and live delivery are pending.

An independent HTTPS check now classifies API and worker failures after a retry.
Its local run reported API 200 and worker 503 twice. The opt-in GitHub workflow
can forward one safe state code to a private Healthchecks check. Activation and
verified delivery to the designated technical operator are pending. See
[runtime monitoring](infra/README.md#внешняя-проверка-api-и-worker).

Homework files and teacher materials are now inspected before promotion from
private staging. The service checks byte length and format, and ties the read
and copy to the same ETag. Homework keeps the browser's generic MIME fallback
when the bytes match a supported format. Read-only Neon inventory found one
previously verified homework text file. The local API now requires an explicit
clean ClamAV verdict on the same staging bytes before copy. The scanner operator,
live endpoint and private S3 acceptance remain pending. Local verification
covered the ClamD wire contract and mutual TLS with a test peer. See
[scanner deployment](infra/vercel/README.md#проверка-на-вредоносное-содержимое).

Optional upload cleanup is now implemented via the audited outbox. Verified files
lose only their temporary copies. Abandoned uploads are fenced before deletion and
kept as metadata history. The read-only Neon candidate query found one confirmed
homework manifest eligible for staging cleanup. Applying the 54th migration,
authorizing S3 deletion and testing worker retries against S3 remain pending.
See [worker operations](apps/worker/WORKER.md#очистка-истёкших-загрузок).

The operator backup command copies verified S3 objects to independent encrypted,
versioned storage and verifies each saved version before signing the manifest.
Its read-only verification compares the saved catalog and hashes against the
selected database state. New manifests bind the file catalog and database audit
from a single snapshot. The database recovery audit checks nine invariants and
compares SHA-256 fingerprints for 20 tables, including file permissions.
All nine checks reported zero violations on the working Neon database on
2026-11-18. Neon reports six hours of project history and zero user snapshots.
Independent PostgreSQL base backup and WAL, backup destination approval, and a
real restore rehearsal remain open. See [recovery procedures](infra/README.md#резервирование-приватных-файлов-и-проверка-восстановления).

The 2026-11-17 local increment scopes the password-only policies to explicit
synthetic account UUIDs, checks both ends of demo switching, repairs the worker
test harness, and regenerates the SDK. Director payout reconciliation records
verified external outcomes for pending and unknown attempts, with actual MFA,
audit and transactional idempotency. See [Finance API](apps/api/FINANCE.md) and
[demo configuration](docs/platform_account_switching_2026_11_01.md).

Lesson booking, teacher start and student Meet checks now share the subscription
window, including recorded freezes. A later confirmed allocation invalidates
an earlier limited admission in lesson checks and student access summaries.
The teacher start command also rejects an expired enrollment. PostgreSQL 18
matched all 15 synthetic cases in a read-only transaction. The working catalog
had zero currently eligible admissions at the time of that check.

Actual start now records the use of a limited director admission in the same
transaction as the rate snapshot. A confirmed conducted outcome reuses that
record. A disputed lesson keeps its place until the decision, and a confirmed
non-conducted lesson releases it. The 55th migration adds immutable start
records and a shared capacity check. An in-progress lesson can still use its
own place to enter Meet. PostgreSQL 18 matched 13 read-only capacity scenarios.
Production migration and concurrent command acceptance remain pending.

DEV-20/B now has a manager proposal, current financial preview, a director
queue, and recorded rejection or referral for manual settlement. The preview
follows published ledger corrections and checks the source period, available
advance, target price and lesson activity. Receipt remainder is director-only.
The local migration preserves the original proposal and its decision. Posting
and allocating the amount under an approved proposal remain open.

OPS-02/B now has a preview and immutable register captured at closure, plus
append-only post-close correction for approved full reversals of CRM attendance
charges. The existing general cancellation command still requires an open
origin period. The close request takes the preview revision when cases remain.
The new migration and PostgreSQL scenario need acceptance on an authorized target.
Directors can review a disputed lesson report and decide its documented result
with verified MFA. The archived report stays linked to the original period.
A documented start can be reconstructed when its historical rate inputs are
available. Payroll requires a separate documented director amount, and the
teacher statement lists undecided cases outside its monetary totals. The new
schema and PostgreSQL acceptance scenarios remain pending on an authorized target.

D5 has manager refund proposals, director decisions with verified MFA, and
reconciliation of external transfers. The proposal uses the original discounted
price of unused rights and requires current, attributable allocations and grant
balances. Approval retires the selected rights and posts a refund liability.
Verified successful and returned transfers are posted separately. See
[Finance API](apps/api/FINANCE.md). Migration, concurrency and roles still need
PostgreSQL acceptance on an authorized target. Exceptions, financial rounding,
legal documents and the accounting treatment still require acceptance. D7 adds
director-only sale-condition publication and retirement with verified MFA.
Price versions apply to new purchases. Sold subscriptions retain their original
snapshots. M4 adds a public endpoint that records enquiries in the existing CRM
with same-origin CSRF, rate limiting, retry keys and duplicate-contact review
in the receiving portfolio. Public activation requires an HTTPS origin, an
active receiving manager and an approved privacy notice. See
[MGR-11](apps/api/src/modules/manager/leads/MGR-11.md).

Meet has typed REST and OAuth clients, sealed teacher credentials, MFA-bound
teacher commands, outbox processing and versioned pair links. A committed
dispatch precedes provider calls. Ambiguous creates enter a reconciliation
queue. Teacher verifications and director decisions preserve prior links and
their history. The same lesson link projection reaches the student entry
window and the manager and teacher schedules. See [Meet API](apps/api/MEET.md).
The live Google POC, PostgreSQL migration and crash/lease acceptance, and G4
remain open.

Full PostgreSQL regression, migration recovery, worker availability, Meet G4
and GO are open. The earlier local PostgreSQL run is historical evidence. Follow the target
restrictions in [Phase 0 checks](PHASE0_CHECKS.md).

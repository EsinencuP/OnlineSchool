# STU-02 — Dashboard

`GET /api/v1/student/dashboard` uses all STU-01 guards before consulting the cache.
It returns the nearest future SCHEDULED lesson, homework counts, one subscription
summary, skill counts and a server `generatedAt` timestamp. Every source binds
`request.studentCtx.studentProfileId`; query parameters cannot select another pupil.
The four source reads start together with `Promise.all`, sharing one as-of time.

## Existing model mapping

- Product `LessonAppointment` is the existing `LessonOccurrence`. Cancelled,
  STAR_PENDING and past lessons are excluded. The active assignment must match the
  enrollment and scheduled teacher; ended assignments and deactivated teachers
  cannot supply a Meet link.
- Homework uses issued, non-cancelled `HomeworkDelivery`, the latest submitted
  version and the latest review of that version. A newer resubmission supersedes
  an old NEEDS_REVISION review. `submitted` includes accepted submissions; a
  revision request has its own count. Thus `total` is the sum of the three counts.
  Drafts, future submissions/reviews and archived assignments are excluded.
- Fully paid subscription balance is actual grants plus effective adjustments
  minus effective, uncancelled consumptions. Scheduled future appointments never
  reduce that balance. Partial payment supplies no automatic admission: a current
  limited director permission is required; its unused lesson allowance is shown.
  Among multiple eligible subscriptions the earliest expiry is selected, then
  valid_from/id; balances from different subscriptions are not merged. A current
  freeze preserves an eligible paid summary. No eligible subscription yields null.
- Skills use the latest assessment of each active skill in the pupil's current
  subjects. Assessment history is retained across teaching assignments. Future
  assessments and assessments attached to unconfirmed lesson outcomes are excluded.
  No assessment means `notStudied`. INTRODUCING/PRACTICING/APPLYING map to the
  three public counters; another student's assessment never supplies a level.

The existing database permits unbounded subscriptions (`valid_to=null`), so
`validUntil` is explicitly nullable rather than fabricating an expiry date. Dates
are UTC ISO values, with `validUntil` formatted YYYY-MM-DD. Dashboard exposes no
money fields; counts and quantitative rights are integers. The shared Decimal JSON
serializer retains monetary decimals as strings if a future contract adds them.

## Meet links

The migration adds `TeachingAssignment.google_meet_link`, reused by all lessons of
that pupil/teacher enrollment assignment, including reschedules with the same
assignment. Existing manager/director assignment creation accepts optional
`googleMeetLink` through its existing MFA, authorization, CSRF, idempotency and
audit/outbox pipeline. No new endpoint or MFA bypass is introduced. Only canonical
`https://meet.google.com/xxx-xxxx-xxx` URLs are accepted; absent links remain null.

The SQL additionally requires paid rights or a limited director admission for
**this lesson's enrollment**, with no current freeze. Paid access to another
subject cannot reveal the link. The response exposes it only when canJoin is true
and the time difference is <=10 minutes, without truncating fractional minutes.
The -60 minute lower bound is retained, but the next-lesson selector deliberately
only selects future lessons as requested. Missing/unsafe links produce false/null.
Opening Meet does not confirm attendance or consume a right.

## Cache and invalidation

`DashboardCacheInterceptor` extends Nest CacheInterceptor and uses CACHE_MANAGER
with key `dashboard:{studentProfileId}` and a maximum 30,000ms TTL. HTTP responses
remain `Cache-Control: no-store`; this is a private application cache. It expires
early at the join-window opening and lesson start. Cache hits retain the actual
snapshot's generatedAt (at most 30 seconds old), rather than pretending to rebuild
data. In-flight loads for the same student/revision are coalesced.

The same migration adds `student_dashboard_revisions`. AFTER row triggers bump
the affected student's revision in the source-write transaction, covering homework,
lessons, outcomes, subscriptions, rights/admissions/payments, skills, assignments,
teacher and subject changes. Both OLD and NEW ownership are considered. Rollbacks
roll back the invalidation. API/worker/other instances do not need a local event
bus or new outbox topics; each read checks the durable revision and evicts a stale
cache entry. Runtime has SELECT only on revision tokens; the security-definer
trigger advances them with a fixed search_path and no public execution grant.

A revision change during the parallel read returns 503 DASHBOARD_REFRESH_REQUIRED
without caching a potentially mixed result. Cache backend failures fall back to
loading data, while failure to validate the DB revision fails closed with a
sanitized 503. Errors are never cached. This is revision-validated aggregation,
not a claim that separate pool connections share a PostgreSQL MVCC snapshot.

## Verification and release state

Run `pnpm --filter @online-school/api build` then `pnpm test:stu02`. The targeted
suite checks real Nest routing/session boundaries with mock Prisma, two-account
cache isolation, CSRF-independent GET behavior, timestamp/Decimal serialization,
parallel execution, Meet boundaries and mock CacheManager invalidation. A short
STU-01 HTTP regression and the current ERD contract were also checked.

Two actual PostgreSQL 18 read-only CTE cases verified latest submission/review
selection, cancelled homework, other-student isolation, latest skill levels and
unconfirmed/future assessments. CTE rows exist only for a SELECT; no databases,
tables, branches or persistent fixtures were created. Reproducible statements and
expectations are in tests/evidence/stu02-readonly-projections.json. With an explicitly
provided existing working connection, `STU_READONLY_DATABASE_URL=...` allows running
tests/integration/student-dashboard-readonly.test.mjs in a READ ONLY transaction.

Read-only SELECT smokes against the existing working schema passed for the four
projections with an absent student ID and the undeployed Meet column replaced by
NULL. They also exposed missing runtime SELECT grants on educational tables; those
minimal grants are included in the new migration. Homework/skill base-table syntax
was checked with the owner role; runtime grants still require deployment/retest.

The controlled four-query latency test logged <200ms. **Working-domain/database
latency is not established** by that mock-latency test. The new migration and
invalidation triggers are prepared, not applied or exercised on live data. Real
two-student DB/API E2E and deployment acceptance remain pending along with STU-01
and FND-GATE. This code does not open the student frontend or grant production GO.

`tests/api/student-dashboard-live.test.mjs` is prepared for that working-domain
acceptance using two already provisioned ordinary STUDENT accounts, supplied through
`STU_DASHBOARD_A_EMAIL/PASSWORD` and `STU_DASHBOARD_B_EMAIL/PASSWORD`. Both need paid
access, completed password change and distinct upcoming lessons. It logs in through
the normal session/CSRF endpoints, checks cache isolation, and logs both sessions out.
It does not create students, payments or grants. It has not been run; absent
credentials skip it rather than inventing accounts or weakening access checks.

The pinned Nest cache-manager declaration needs a narrow pnpm type patch for
exactOptionalPropertyTypes and a missing Cacheable type dependency extension.
Runtime code is unchanged; strict TypeScript/lib checking remains enabled. Patches
are included in source export and Docker build context for reproducible installs.

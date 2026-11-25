# Dashboard

`GET /api/v1/student/dashboard` uses all STU-01 guards before consulting the cache.
It returns the current eligible SCHEDULED lesson or the nearest future SCHEDULED
lesson, homework counts, one subscription summary, skill counts and a server
`generatedAt` timestamp. Every source binds
`request.studentCtx.studentProfileId`; query parameters cannot select another pupil.
On a cache miss the four source reads start together with `Promise.all`, sharing
one as-of time.

## Existing model mapping

- Product `LessonAppointment` is the existing `LessonOccurrence`. Only SCHEDULED
  lessons qualify, ordered by scheduled start and ID within the selection above.
  The active assignment must match the
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

The shared student lesson SQL requires paid rights or a limited director admission for
**this lesson's enrollment**, with no current freeze. Paid access to another
subject cannot reveal the link. The response exposes it from 10 minutes before
through 60 minutes after scheduled start, with both endpoints included and
millisecond precision. Missing or unsafe links produce false/null. The lesson
has its own `status` and `meetAsOf` timestamp from the read that checked eligibility.
Opening Meet does not confirm attendance or consume a right.

## Cache and invalidation

`DashboardCacheInterceptor` extends Nest CacheInterceptor and uses CACHE_MANAGER
with key `dashboard:summary:{studentProfileId}` and a maximum 30,000ms TTL.
HTTP responses remain `Cache-Control: no-store`. The private application cache
holds homework, subscription and skill summaries with their actual `generatedAt`.
In-flight summary loads for the same student and revision are coalesced. Every
request reads its own lesson projection and verifies the revision before returning
it. The summary cache never stores the lesson or its link.

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

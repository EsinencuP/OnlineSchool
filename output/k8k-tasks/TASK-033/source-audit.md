# TASK-033 — read-only audit of authoritative event sources

Reviewed current code on 2026-11-08. This records existing producers, not proof of execution in PostgreSQL. No producer, template registry, outbox publisher, worker, trigger or migration was changed. All 18 current DTO types are retained. The earlier STU-10 README's seven-type statement describes its historical increment.

| Existing type | Authoritative fact / code | Allowed UI target |
| --- | --- | --- |
| HOMEWORK_REVIEWED | `packages/db/prisma/migrations/20261028100000_stu10_notifications/migration.sql:112`, accepted submission review, `trg_stu10_review` | homeworkId |
| HOMEWORK_NEEDS_REVISION | Same trigger, returned submission review | homeworkId |
| REPORT_READY | Same migration:117/124, publication transition in education_reports | reportId, TASK-032 scoped GET |
| LESSON_RESCHEDULED | Same migration:130/137 schedule transition; `apps/api/src/modules/schedule/manager/workflow.service.ts:166` approved manager workflow | lessonId |
| LESSON_CANCELLED | Same schedule trigger; workflow service:168 | lessonId |
| LESSON_SCHEDULED | `apps/api/src/modules/schedule/manager/workflow.service.ts:164`, committed lesson creation | lessonId |
| RESCHEDULE_DECLINED | `apps/api/src/modules/manager/tasks/manager-tasks.service.ts:344`, committed rejection workflow | lessonId |
| DISPUTE_ACCEPTED | `apps/api/src/modules/finance/manager-disputes/dispute.service.ts:229`, accepted disputed lesson charge | lessonId |
| DISPUTE_REJECTED | `apps/api/src/modules/manager/tasks/manager-tasks.service.ts:346`, committed dispute rejection | lessonId |
| SUBSCRIPTION_CREATED | `apps/api/src/modules/finance/manager-subscriptions/lifecycle.service.ts:125`, CREATE action | subscriptionId |
| SUBSCRIPTION_RENEWED | Same, RENEW action | subscriptionId |
| SUBSCRIPTION_FROZEN | Same, FREEZE action | subscriptionId |
| SUBSCRIPTION_UNFROZEN | Same, UNFREEZE action | subscriptionId |
| SUBSCRIPTION_EXPIRED | Same, EXPIRE action | subscriptionId |
| SUBSCRIPTION_EXPIRING | `apps/worker/src/notifications.ts:13`, existing 7/3-day source query, episode-specific event key | subscriptionId |
| PAYMENT_CONFIRMED | STU-10 migration:141/154/155, confirmed allocated receipt; `apps/api/src/modules/finance/payments.service.ts:123`, receiptOnly catalog branch (does not assert allocation) | subscriptionId only when actually present |
| ACCOUNT_CREATED | `apps/api/src/modules/manager/accounts/manager-accounts.service.ts:79`, approved credential/account workflow | No target |
| MANUAL_MESSAGE | `apps/api/src/modules/manager/notifications/manager-notifications.service.ts:87`, existing validated manager command and outbox publisher; approved process, not general chat | No target; human title/body unchanged |

The actual current SQL source guards include later MGR-03/04/05/06/07/08 migrations. Their hashes are checked by preservation.json; this audit does not restore an older guard or execute migration SQL. Initial-password, own student, access, chronology, payload and canonical business-fact validation remain existing source responsibilities.

`NotificationService.create(tx, sourceId)` loads and validates a canonical source; inbox.id equals source.id. The projector uses this existing service, per-student locking, short delivery transactions, dedupe and existing retention (90 days / 500 items). Read-all uses the same lock, immutable first read_at and critical-operation idempotency; cached replay skips the mutation, preserving later arrivals. Current tests exercise service/HTTP/SDK behavior with mocks. Real worker scheduling, triggers, lock contention, TTL and PostgreSQL execution are NOT_RUN.

The list projection joins an own canonical source by id/student/type, or an own IN_APP dispatch by source_id/student, for its explicit catalog key and complete public variables. It does not use notification title/body as a lookup key or fill missing variables. Dispatch source_id is unique in the existing schema. Internally selected catalog metadata is stripped before the public response. `notificationContent` / `renderNotification` validate public variables using the existing registries; invalid/incomplete/mismatched or absent metadata returns the stored text unchanged. MANUAL_MESSAGE always returns stored text unchanged. This works for RU and RO without adding or rewriting sources/inbox/read_at/event_key/payload. The lightweight count query has no join.

No HOMEWORK_ASSIGNED, arbitrary payload URL, external family notification, chat, new event priority/catalog, backfill, provider call or student business command was introduced. Synthetic browser data uses six already-supported types; unit negative cases use unsupported/invalid values solely to prove safe omission of links.

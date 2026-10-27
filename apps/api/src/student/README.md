# STU-01 — StudentModule

The module owns `/api/v1/student/*`. `StudentProfile` in the product contract maps to
the existing `Student` registry identity plus its `StudentAccount` login linkage.
`studentProfileId` and `/me.id` are `Student.id`; no duplicate profile or parent
account is introduced. A pupil and their family share the same STUDENT account.

## Authentication and context

Four `APP_GUARD` providers run in explicit order: StudentSessionGuard,
StudentCsrfGuard, StudentContextGuard, ActiveSubscriptionGuard. Nest registers
`APP_GUARD` application-wide; each provider restricts itself to the student URL
namespace. Existing core session/CSRF checks are reused within the same request.
Authentication uses server-side sessions in httpOnly cookies, not JWT. Students
cannot register or authenticate passkeys; staff WebAuthn remains unchanged.

StudentContextGuard requires an enabled STUDENT session and an activated,
non-deactivated account linked to a non-archived Student. It caches both the
in-flight load and the completed `request.studentCtx`/`studentMe` within that
request, including concurrent invocations. It never accepts a client-supplied
student ID as the authenticated context.

`GET /api/v1/student/me` returns `StudentMeResponseDto`, including the login email
and `mustChangePassword`. `avatarUrl` is currently null; private avatar delivery
belongs to the profile/file feature. The future student frontend redirects an
initial-password account to `/security/change-password`.

## Access and errors

Existing database activation constraints require confirmed allocated payment
before a StudentAccount can activate. This task does not add a free activation
endpoint or a separate parent login. Provisioning through CRM remains subject to
those constraints and the director's partial-payment admission decision.

Access is computed from current subject enrollments and subscriptions. Fully
paid subscriptions need remaining rights. Partial payment requires a current,
unrevoked, limited director permission with remaining lessons; agreed installments
have no automatic exemption. A current freeze preserves cabinet access when paid
rights remain. This context does not itself authorize conducting a frozen lesson.

ActiveSubscriptionGuard exempts exactly `/me`, `/profile` and its descendants,
and `/security` and its descendants. Other student routes return 403
`MUST_CHANGE_PASSWORD` until the initial password changes, then 402
`ACCESS_SUSPENDED` if access is inactive. Errors use ErrorMapper and RFC 7807
`application/problem+json`; the latter response also contains
`managerContacts: { whatsapp, telegram }`. Configure actual contacts using
`STUDENT_MANAGER_WHATSAPP` and `STUDENT_MANAGER_TELEGRAM`. Unconfigured contacts
are empty strings. No contact information is fabricated.

## Initial password change

`POST /api/v1/student/security/change-password` accepts `currentPassword` and
`newPassword` (12–256 characters) with the session CSRF token. It verifies the old
password using the existing password service and transactionally changes the
hash, clears `must_change_password`, revokes existing sessions, issues fresh
session/CSRF cookies, and writes the mandatory audit/outbox pair. An audit failure
rolls the entire operation back. Credential values and tokens are excluded from
audit/outbox payloads. This minimal endpoint supports STU-01's first-login flow;
recovery, email verification and other STU-11 features are outside this task.

## Migration and verification

`20261027090000_stu01_student_context` adds
`student_accounts.must_change_password NOT NULL DEFAULT true`. Existing student
accounts therefore require a password change after applying it. Staff accounts
are unaffected. The migration is prepared but has not been applied to the working
Neon database in this task.

After `pnpm --filter @online-school/api build`, run `pnpm test:stu01`.
The suite checks actual Nest routing, guards, sessions, CSRF on all four mutation
verbs, password rotation/rollback, request caching and ProblemDetails transport,
using mock Prisma. The access SQL also passed a read-only syntax/runtime-role
smoke against the existing PostgreSQL 18 database with an absent student ID.
No extra databases, branches or PostgreSQL containers were created.

The real CRM → first confirmed payment → provisioned student login → password
change → cabinet scenario is **not verified** by these mock-backed tests. Neither
the migration deployment nor that acceptance scenario nor the Phase 0 FND-GATE
is declared complete. Keep the change in a draft PR until its foundation and
deployment acceptance are resolved; no student frontend is opened by this task.

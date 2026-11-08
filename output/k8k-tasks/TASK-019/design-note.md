# TASK-019 — design note, 06.11.2026

Base `60e2a0c47cbcc744dc658a85f386833146e836b3`, `feat/k8k-design`. TASK-018
provides `actorContext.accountId`, separate profile identity and staff source time.
Preserve user changes to student dashboard, AGENTS and local artifacts.

Planned client contracts in account-ui: `sessionSignal()`, `clearPrivateSession()`,
`subscribeSession()`, `leaveSession(path)`, `verifySessionOutcome()`,
`SessionExitBoundary({children})`, and optional `AccountMenu.logoutPath`.
One in-memory abort signal identifies a generation. On termination, seal the document,
abort reads and discard late responses before interpreting either success or errors.
Cache owners subscribe to clear their QueryClient. Root boundary removes the private tree
and listens for a fixed event on the existing `school-account` channel. BFCache restoration
requires a fresh bootstrap. No credentials or actor identifiers travel in the event.

Known rejection keeps the current session. Unknown account write hides private UI and
offers a single session recheck via existing `/` entry. A 401 replaces the document,
except existing credential-validation exceptions. Object 403 hides the denied read.
Staff refresh compares workspace actor identity with currentSession. Existing no-store,
CSRF, idempotency and password-only exceptions remain authoritative. No new server DTO,
API, dependency, schema, provider or migration. Local synthetic browser and unit fixtures.

K8K-DEF-074: internal student `useSecretCommand().run(command)` invokes a scoped closure.
The password and email OTP flows keep status and errors in component state and send
credentials directly through the existing `write()` path, outside TanStack MutationCache.

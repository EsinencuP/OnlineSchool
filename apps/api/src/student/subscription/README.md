# STU-07 — Read-only subscription showcase

Source implemented; working migration/deployment and complete acceptance remain pending FND-GATE. No payment gateway, card binding, checkout, subscription mutation or financial write endpoint is introduced.

## Owner decisions and routes

The owner explicitly approved on 2026-10-27: optional subscription selection, retaining that subscription's history context, and the actual CRM currency including MDL without conversion. All three routes accept optional `subscriptionId`. Without it, selection prefers a current plan and then the most recent valid-from date, with a stable ID tie-break. If none is current, the most recent expired plan remains visible. A foreign or nonexistent explicit ID uniformly returns 403.

- `GET /api/v1/student/subscription` returns the requested details DTO. No plan means NONE and all nullable fields null. ACTIVE/FROZEN/EXPIRED describe the CRM validity period; they are not a booking entitlement. Zero paid remaining rights can coexist with a currently valid plan. An explicitly selected future plan has no current showcase and returns NONE, while its already confirmed payment history is still scoped to that selection.
- `GET /api/v1/student/subscription/payments?page=1&pageSize=20` returns approved allocations to this selected plan from director-confirmed receipts, backed by current published accounting sources. A receipt shared across students/plans reveals only this plan's allocation amount. Proposals, drafts and sources reversed without a published replacement are excluded. A canonical published correction preserves the confirmed source. `lessonsAdded` is the actual granted quantity attributable to this allocation, or null; receipt confirmation alone does not add rights.
- `GET /api/v1/student/subscription/ledger?page=1&pageSize=20` returns the selected plan's quantity-operation history, newest first. Full chronological replay precedes pagination; an empty page keeps total. These are lesson quantities, not monetary account balances.

Page size is 1–100. Unknown query fields are rejected; student identity always comes from the session context. All three routes are GET only, session + STUDENT role required, and no-store. The new exception in ActiveSubscriptionGuard lets a student without active learning access read only these three exact GET routes. The first-password-change requirement remains in force; other routes and all mutations retain their existing access checks. No student MFA bypass is added because students already use session/password authentication without WebAuthn.

## Exact quantities, money and chronology

The plan label is the existing sale-condition code, not an invented commercial name. Quantities come from confirmed-payment grants, explicit adjustments and published confirmed lesson/cancellation deductions. A grant is included only after its approved/confirmed source dates and cumulative confirmed allocated payment reaches the full subscription price. Partial payment does not manufacture rights. Director-limited temporary admission remains separate from paid rights and is not displayed as a purchased lesson balance. Future reservations or a scheduled future lesson are never automatically deducted.

The ledger view includes original published deductions plus an independently confirmed cancellation credit, rather than erasing the old deduction. Grant and adjustment operations use their source IDs; a deduction uses the published LedgerEntry ID. Existing quantitative deduction snapshots are retained. For other rows, Decimal lesson balances replay the complete available immutable source facts in chronological order; this read calculation does not backfill or rewrite historical LedgerEntry snapshots. Equal-time events have a documented stable order: grant, deduction, adjustment, freeze, unfreeze, then source ID. No monetary journal entries are manufactured for freezings or rights grants.

Payment amounts remain exact Decimal strings, with at least two and up to the source's four fraction digits (`1500.00`, `1.005`, `600.1234`). No IEEE number conversion, silent two-digit rounding or currency conversion occurs. Currency is the actual three-letter CRM value, including MDL. Quantitative before/after values are integer Decimal strings. Date-only fields use the student's timezone (default Europe/Chisinau); confirmation timestamps remain ISO instants.

## Freeze history

The original subscription stores only the current freeze pair. The additive migration creates append-only `SubscriptionFreezeHistory` and a restricted trigger that preserves the old pair when it changes. The runtime can read this history but cannot insert/update/delete it directly. The trigger writes under its migration owner's restricted SECURITY DEFINER function with a pinned search path. No current working subscription is changed by preparing this migration.

The read model combines preserved pairs with the current CRM pair, taking the most recent state for a given freeze start. A superseded interval ends no later than its replacement time; intervals replaced before they ever started do not appear as completed freezes. FREEZE/UNFREEZE are zero-quantity operations, and a future unfreeze is not presented as already completed. View event UUIDs derive deterministically from subscription + freeze-start + event kind. Previously overwritten intervals that were never recorded cannot be recovered and are not fabricated. Current known dates are displayed without guessing missing history.

## Verification boundary

48 targeted Jest cases (26 unit, 22 actual Nest HTTP) cover DTO serialization, exact currencies/precision, selection, identity, date timezone, NONE/EXPIRED, read access without paid rights, password enforcement and absent mutations. Database storage in these tests is mocked.

Fifteen source-exact SELECT scenarios also passed as app_runtime on the existing PostgreSQL 18.6, using CTE-only fictional rows: current/frozen/expired/none/foreign plans, partial payment without rights, a combined receipt showing only the owned 1500 allocation, draft/unapproved/reversed exclusion, published correction, exact EUR/MDL/USD/UAH amounts, future booking exclusion, stored deduction snapshots, cancellation credit, adjustments, two freeze periods and pagination. No business rows, databases or branches were created. Reproduction: `tests/integration/student-subscription-readonly.test.mjs` with an explicitly supplied STU_READONLY_DATABASE_URL.

Migration application, real freeze capture/immutability/role enforcement and manual working acceptance remain unverified until the authorized deployment and FND-GATE. This increment does not reopen the owner's separate financial closure/legal approvals or establish production GO.

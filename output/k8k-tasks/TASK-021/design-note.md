# TASK-021 — refresh contract before edits

TASK-020 matched 17 recorded source hashes and 48 passing route budgets. Current inputs and working patch are backed up.

`operationalQueryInterval(key)` is an explicit allowlist, including live lesson detail at 15s. Auth remains with TanStack. Unlisted financial, published and history keys use mount, manual reads and targeted post-command invalidation. K8K non-auth focus, reconnect and intervals are disabled at the query observer. Legacy polling stays in its existing consumers.

`useContextRefresh({ enabled, context, paused?, refresh })` returns `request(reason?)`, where `reason` is `background` or `deadline`. Automatic focus, visibility and network signals share the same coordinator and a 1s coalescing window. Busy reads are not restarted. An editing field, native/Radix dialog, or open account menu defers one read. Closing the overlay or leaving input wakes it. Hidden/offline blocks background reads until resume. A deadline may wait behind a read or gate and is retained until served. Cleanup detaches timers, observer and listeners. Only read callbacks use this scheduler.

Student Layout splits 60s operational and 15s lesson-detail owners by query key. StudentHome requests the operational owner at T−10, retaining the existing server-clock sample. The browser only asks again for `canJoin`. Query refetch uses `cancelRefetch:false` to join in-flight reads. Staff keeps the current transport and session checks, with stable coordinator ownership during loading.

Freshness retains the TASK-012 `asOf`/`receivedAt` contract. Source timestamps are displayed only where the response provides them. Operator and manager blocks without source time show receipt only. Staff detail adds receipt and age. Empty previews pass actual emptiness so a cached empty result after failure is stale.

No DTO, SDK or mutation changes. Verification uses local fixtures, fake clocks, installed TanStack, both locales and four viewport widths. No new dependency.

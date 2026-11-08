# TASK-002 — design note, 2026-11-03

Only static inventory and bookkeeping. Preserve all product code and TASK-001 snapshots.
Predecessor: TASK-001 accepted manifest + verification and three backed-up untracked
sources (Reports, StudentHome, locale) must exist and match their recorded hashes.

Planned local CLI: `pnpm k8k:inventory generate` / `pnpm k8k:inventory verify`.
No new API/DTO/SDK/props/migrations/dependencies. Use the existing TypeScript parser
to discover real routes, imports, SDK runtime references, JSX forms/dialogs/handlers,
query/command wrappers, controllers/operationIds, injected service calls and ACL sources.
Read only source/test files, never .env, session dumps or live providers.

Output contract `inventory.json` v1:

- basis: HEAD/branch, explicitly defined dirty/source digests, hashed source manifest;
- routes/screens: all declared routes, manager tab query values, staff section values,
  account menu and error-boundary surfaces;
- operations: actual SDK symbol/method/URL builder and real controller/service/ACL refs;
- frontendFacts: forms/dialogs/fields/handlers/read-query/command/lifecycle source refs;
- modules: all28 VIS12 modules plus operator/auth/account/profile/security/materials;
- gaps: actual missing fields/flows and concrete TASK IDs, separate conditional/out-of-release;
- tests: source association only, never a claim that those tests were run.

`inventory.md` is the readable projection of this same JSON, not another registry.
Source reachability is static and conservative: annotate runtime branches and filter
the explicit role/tab branches; dynamic action eligibility must still be checked by
the server. An existing source chain is not runtime acceptance or TASK completion.

Verification re-extracts source, requires all discovered routes and every runtime SDK
write reference to have a screen owner, checks SDK↔controller method/path agreement,
checks every file/line reference, all28 module IDs/statuses and no whole-school KPI
claim from capped workspace lists. The command does not run application/DB tests.

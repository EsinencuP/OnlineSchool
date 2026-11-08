# TASK-004 — design note, 2026-11-03

Only route-size tooling, provenance and defect registration. No UI/feature removal,
DTO/API/SDK/migration/dependency changes. Preserve TASK-001/002/003 outputs and all
existing dirty/untracked work. TASK-003 audit DONE is the prerequisite.

Planned CLI: `pnpm k8k:route-budget build|verify|selfcheck`; helper
`scripts/k8k-route-budget.mjs`, pure evaluator `scripts/k8k-route-budget-core.mjs`.
All modes are local files only. Build uses installed Vite7 with source aliases,
configFile:false/envDir:false, production mode, manifest:true,3 frontend outputs
inside a new timestamp directory. No .env, app config proxies, DB or generation.

Method v1: cold direct route entry + recursively visited static JS/CSS imports,
plus explicit route-required lazy page/tab seeds, deduped per emitted file. Manager
lazy roots are read from actual lazy(import()) source declarations; inventory
tab selects the actual nested module. Student/platform are currently single-entry
bundles. Every inventory surface is mapped; unavailable manifests/modules/assets
produce unavailable/null, never zero/pass.

Code: gzip each emitted JS/CSS separately with level9, sum compressed byte lengths.
Fonts: identify both emitted Golos cyrillic/latin WOFF2 through CSS/manifest assets,
charge full raw bytes once per route, separate columns and included total. Budget
256000 bytes=250KiB. List deferred dynamic imports explicitly; login passkey bundle
gets an optional-action closure/limit check, not hidden from the report. Other lazy
pages/tabs are navigation to separately measured routes. No sum of unrelated route
bundles and no claiming a whole-app asset sum is per-route.

bundle.json v1 rows:inventoryId/role/route/app/manifestSeeds/files/method/gzip/font/
total/baselineRef/pass, provenance/digests, unavailable reasons, explicit lazy policy.
Historical implementation/phase0/phase2 outputs lack compatible source/build/route
provenance; delta=null/unavailable with reasons. TASK-003 source-identical emitted
assets are checked as an additional cross-reference, not a fabricated route delta.
This run becomes a reproducible baseline for future runs using this same method.

Defects JSON/Markdown groups baseline evidence into addressed observations with
reproduction, impact, inherited/regression/unknown classification, evidence/route/
role/locale/viewport and future TASK. Distinguish actual observed defects from
documented missing workflows and conditional/out-of-release scope. No automatic
closure of K8K/FND/LEGAL/Meet/production gates.

Selfcheck: diamond/shared chunk dedup, both fonts, lazy seed inclusion, missing
manifest/import/asset unavailable, over-budget command nonzero; mutate only new
temporary fixture output. Read/hash checks prove source and prior outputs unchanged.

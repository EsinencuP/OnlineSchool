# TASK-003 — design note, 2026-11-03

Input: pasted TASK-003, SHA256
`324160b1d4426908f4c5bbc341c2c5d27f55ed734bc67cf6b40e01f858ee2f00`.
TASK-002 verified before changing package.json:48 surfaces,89 used operations,
59 mapped writes; source/dirty digests retained as historical input identities.

Planned local CLI: `pnpm k8k:baseline-ui [--smoke]` runs
`scripts/k8k-screen-baseline.mjs`. No product DTO/endpoint/props/SDK/migrations.
New files are a test-only HTTP adapter, runner and common-boundary fixture.

Build current source with Vite API configFile:false/envDir:false into a new run
directory. Source aliases avoid stale dist; no production API proxy. Bind static
student/manager/platform/common origins to127.0.0.1 with ephemeral ports.
Reuse the existing student HTTP fixture in an isolated process with a fixed clock,
and the existing typed manager fixture data through test-only transpilation.
No MSW service worker; context.serviceWorkers=block, every API call intercepted,
every unknown fixture operation rejected. External origins aborted, including a
deliberate network sentinel. No .env/session dump/live account/provider access.

Time:2026-11-03T10:30:30Z; zone Europe/Chisinau. Browser clock.setFixedTime keeps
timers working; UUIDs are fixed or derived from SHA256 synthetic property seeds.
Long RU/RO test labels are frozen fixture content, not automatic translation of
people's data. Existing partial localization is measured, not repaired here.
Fixtures checked against actual checked-in OpenAPI response schemas. No invented
action capabilities. Pending receipt and director-confirmed historical allocation
are separate synthetic records; no synthetic issuance of one-time secrets.

Matrix: all48 inventory surfaces × RU/RO ×360/768/1024/1280; additional open
dialogs/editor/long-list cases, role read boundaries and all9 common states,
including pending-vs-unknown. Missing product scenarios explicitly NOT_RUN.
Capture two independent passes using same clock/data/UUID inputs. Compare PNG
hashes and semantic assertions; retain differences as defects, never hide overflow.
New timestamped outputs only; do not overwrite historical output or fix UI gaps.

INDEX entries: route/surface, role, requested/actual locale, viewport, fixture ID,
commit/current scoped dirty digest, screenshot path, content/state/overflow/network/
keyboard assertions and failures. Privacy guard forbids visible secret outputs.
Metadata never stores request bodies, cookies, CSRF/OTP/password/token values.

TASK-004 receives the measured overflow/render/locale/coverage defects. No final
WCAG/business/DB/provider/release gate is inferred from this baseline.

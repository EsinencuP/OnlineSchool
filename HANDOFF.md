# HANDOFF — backend: teacher + student complete (uncommitted)

State: all work is in the working tree, nothing committed. Test DB: Docker `online-school-fnd-ci-pg18`
(WSL `Codex-Docker`, port 55500, `pg_hba` = trust, keep WSL alive with `wsl … sleep infinity`).

Done: `apps/api/src/modules/teacher/*` (me, today, journal, availability/requests, homework, skills,
goals, checkpoints/reports, payroll, notifications, materials, profile, student card); migrations
`20261115120000…190000` (+`160000` notification state); manager: system follow-ups visible + `resolve`
command (closes teacher schedule requests); worker topics + SQL typing fix; SDK stops leaking duplicate-lead details.
Tests: `apps/api/test/integration/teacher-*.test.mjs`, `student-cabinet-http.test.mjs`.

Open: apply migrations + duplicate check on Neon before deploy; orval client not rebuilt; Meet (stage 2),
public lead form, ops/backup/CI hardening (stage 3–5); `erd-contract` unit test needs LF checkout.

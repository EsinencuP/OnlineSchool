# OnlineSchool source map

## Источники проекта

- Latest owner request, 2026-11-01: remove the QA app, use in-cabinet demo user switching,
  complete the synthetic lesson/subscription dataset, and push to main. Current map:
  `docs/platform_account_switching_2026_11_01.md`. Earlier QA UI and pending demo finance
  approval statements are historical; general authorization and real-money rules remain.

При анализе, проектировании и реализации опираться на материалы в папках `docs/`, `ref/` и `templates/` в корне проекта. В текущем репозитории папка шаблонов называется `template/`; использовать её как фактический аналог `templates/`.

- `docs/` — требования, архитектура, регламенты и утверждённые решения.
- `ref/` — исходные референсы, изображения, видео и примеры.
- `template/` (или `templates/`, если появится) — шаблоны и визуальные ориентиры.
- Читать только материалы, относящиеся к текущей задаче. При расхождениях учитывать статус документов и последние явные решения владельца; демонстрационные данные референсов не считать утверждёнными бизнес-правилами.

- Latest explicit owner decisions: `docs/online_academy_CON_01_11_owner_decisions_addendum_v1.0.md` (2026-10-25), CON-01 A, CON-02 B, CON-03 A, CON-04 A, CON-05 B, CON-06 B, CON-07 B, CON-08 B, CON-09 B, CON-10 B, CON-11 A. This addendum overrides incompatible statements in older sources within these questions; do not re-open the completed audit or restore its pre-decision conclusions.
- Current ordinary teacher pay uses POINTS: min(6, floor(eligible_full_months/2)) + min(4, floor(active_students/2)); 0–4 points = 200 MDL, 5–9 = 220, 10 = 250. Standard additive +20/+30 and ordinary 230 MDL are rejected (CON-03/A). Changes apply to future eligible lessons with the snapshot at actual start (CON-10/B), NOT only the first of the next month. Rehire restores prior tenure points only within 6 months, not after a longer break (CON-11/A). These are independent choices; do not restore the whole old monthly model when applying the points formula. Existing individually promised obligations are not silently cancelled.
- Refund methodology 11.3.2/A (original paid unused rights with initial discount) is retained; legal/rounding/documents/timing/automation review stays open. Final refunds require the director. While aggregate confirmed allocated payment for a subscription is below its full price, EVERY partial-payment/installment admission needs a separate limited director decision; agreed installments have no automatic-admission carveout. Once cumulative payment is complete, use normal paid access without duplicating rights. Economy 11.4 formal closure remains pending by explicit CON-04/A; do not mark it closed or treat the draft as signed.
- Canonical context as of 2026-10-25: `docs/online_academy_MVP_full_release_architecture_roadmap_v9.7.md`, `docs/online_academy_detailed_technical_design_part_01_v1.9.md`, and `docs/online_academy_REL-01_A_Meet_API_MVP_release_addendum_v1.0.md`, together with approved baselines `docs/online_academy_technical_architecture_part_01_v3.2.md` and `docs/online_academy_block_13_final_architecture_handoff_v1.0.md`. Roadmaps v3.8/v7.6 are historical. All ARCH-01—32 and TECH-01—18 are approved (TECH-04/C, TECH-05/A, TECH-09/C; others B), STOR-01/B is separate. Block 14 is closed at design level; physical artifacts, code and test evidence are still unconfirmed. Readiness percentages dated 2026-10-22 are historical.
- REL-01/A explicitly includes expanded Google Meet API in first MVP; the scope conflict is resolved, while POC/OAuth/security/QA/G4 remain open. MVP-IMPL-01/B approves foundation-first implementation, then student → teacher → manager/CRM → public site, with QA gates and regression per increment. MVP-IMPL-02 (FND-GATE criteria) remains open. Do not replace this order with the earlier proposed vertical-slice plan. Google Drive is for staff working documents only, not platform storage or backup (STOR-01/B).
- Referenced block-14 handoff v1.0, implementation strategy v1.0 and implementation backlogs v1.0/v1.1 are absent from the supplied corpus as of this review. Do not fabricate their contents or treat source statements that they were created as proof that the files or implementation exist. Closed source documents remain frozen; expose later approvals in the current map/status rather than rewriting old acts.
- Do not merge short codes across sources: handoff REL-01 (Meet scope) differs from full-release REL-01 (CRM); handoff OPS-01 (operations/RPO/RTO) differs from functional OPS-01 (manager availability). Architecture closure does not imply implementation or production GO.

- Requirements are governed by documents in `docs/`; images in `template/` are visual references only.
- Preserve source status and chronology. Later explicit approvals override earlier decisions; draft closure protocols are not signed approvals. See the three `*_findings.md` reports and `UI_REFERENCE_AUDIT.md`.

## Phase 0 validation policy — owner instruction, 2026-10-26

During individual Phase 0 TASKs, skip large, slow, token-heavy or repeated verification.
Run only necessary targeted compilation/generation and short smoke checks for the
current change. Defer full recursive checks, whole-project regressions and repeated
migration rehearsals to the end-of-phase gate. Do not claim that gate has passed
from earlier per-task evidence. See PHASE0_CHECKS.md.

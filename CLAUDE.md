# Working agreement

- Deliver one small, usable increment per task. The main Sonnet session owns implementation, tests, and fixes.
- Do not spawn subagents unless the user explicitly requests delegation or invokes mvp-research or mvp-review. Do not create agent teams, judges, consensus panels, or recursive review loops.
- Use the current owner request as the acceptance contract. Do not import every document into context.
- Start with targeted file/symbol search. Read the relevant code and direct dependencies; expand only to resolve a specific uncertainty.
- Research only a decision blocking this increment. Prefer existing project patterns and official documentation. Distinguish verified facts from assumptions.
- Before editing, inspect git status and preserve pre-existing user changes. Do not reset, stage, commit, push, or deploy unless requested.
- Implement the smallest complete user flow. Avoid unrelated refactors, speculative abstractions, broad dependency updates, and extra documentation.
- Validate changed behavior with the existing test tools. Add a regression test for a behavioral bug when practical. Cosmetic edits need an appropriate visual/manual check, not invented unit tests.
- Run focused checks during implementation. Run applicable integration/build checks before declaring the increment complete. Repeat a successful check only after a relevant change or new evidence.
- Keep complete command output in a local log when large; return exit status, a short summary, and relevant errors. Do not hide failures or lose a failing exit code in a pipeline.
- After two unsuccessful repair attempts on the same failure, stop that repair loop, preserve the work, and report the evidence and next decision. Never claim the task is done while required checks fail or remain unverified.
- Do not automatically escalate models, resume capped agents, or add more agents. Report partial results instead.
- Keep the final report brief: behavior changed, checks/results, remaining limitations.

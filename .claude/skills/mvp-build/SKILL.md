---
name: mvp-build
description: Implement and verify one bounded increment in the main session.
disable-model-invocation: true
argument-hint: "[task file or precise increment]"
---

Implement this increment: $ARGUMENTS

Use TASK.md unless a different acceptance contract was supplied. Work as the main implementer; do not spawn agents, activate frameworks, or escalate models.

1. Read the acceptance contract and inspect git status. Identify pre-existing edits. Locate the smallest relevant code surface and its direct dependencies.
2. State a plan in at most five bullets, then proceed without another planning approval. Ask only if a missing decision blocks correct implementation. If the request contains multiple independent outcomes, select a clearly identified first usable increment or ask which outcome has priority.
3. Make the minimal complete change following existing conventions. For a reproducible behavioral bug, use a focused failing regression test where practical. Avoid broad cleanup or new test infrastructure for a trivial edit.
4. Run the relevant focused checks. Fix demonstrated failures. Stop a failing repair loop after two unsuccessful attempts and report the blocker; do not silently loosen assertions or bypass requirements.
5. Before completion, run the applicable build/integration checks and exercise the primary user flow, using the project's available tools. Reuse still-current check evidence instead of rerunning unchanged checks. Report unavailable checks honestly.
6. Inspect your own task-scoped changes for acceptance gaps and accidental edits, including new/untracked files. Do not stage files merely to generate a diff. No automatic independent review.
7. Write a compact HANDOFF.md when continuation is needed or a useful milestone is reached: current task, files changed, verified checks, open blocker, next action. Keep it under 150 words.

Final response: implemented behavior, commands with results, and remaining limitations. Do not claim completion if required checks failed or could not be performed.

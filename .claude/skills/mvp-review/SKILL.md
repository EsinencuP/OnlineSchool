---
name: mvp-review
description: Request one independent Sonnet review of a task-scoped change.
disable-model-invocation: true
argument-hint: "[task file; paths; baseline or commits if applicable]"
---

Review request: $ARGUMENTS

1. In the main session, identify the acceptance contract and the exact change scope. Inspect git status and obtain the relevant diff against the task's actual baseline. Include new/untracked files and staged changes where applicable. Do not stage files or include unrelated pre-existing user changes. If the baseline is ambiguous, ask for it before pretending to isolate the changes.
2. Collect the applicable project invariants and existing test results with commands, results, and any relevant limitations. Do not rerun tests merely to prepare a review if their results are still current.
3. Invoke exactly one mvp-reviewer subagent. Pass the acceptance criteria, task-scoped diff, changed/new paths, relevant conventions, and check evidence explicitly. The reviewer has no access to this conversation history. Keep the packet focused; for a large diff, split the task scope before reviewing.
4. Return its material findings. If the user only asked for review, stop after reporting. If the user also authorized fixes, fix demonstrated defects in one pass and rerun the affected checks. Do not automatically launch another reviewer, judge, or model. Unresolved required defects mean the task is incomplete.

Do not automatically resume the reviewer if it hits its limit. Return its partial findings and missing evidence.

---
name: mvp-scope
description: Turn one feature request into a short acceptance contract.
disable-model-invocation: true
argument-hint: "[feature and constraints]"
---

Scope this request: $ARGUMENTS

Work in the current session. Do not spawn agents, browse the web, run tests, or write implementation code during this command.

1. Inspect only enough existing project structure to recognize its stack and relevant conventions. If the project is new, use the user's stack choice; otherwise present one simple proposed stack as an assumption.
2. Ask at most three blocking questions together, only when their answers materially change the implementation. Make explicit, reversible assumptions for the rest.
3. Create or update TASK.md for this request, preserving any unrelated existing work. Keep it under 400 words: user outcome, in scope, out of scope, 3-6 observable acceptance criteria, likely files/components, relevant check commands, and at most two unresolved decisions.
4. Make the first increment a usable path through the system, not a collection of disconnected layers. Use existing infrastructure where suitable.
5. Return the short contract and the next mvp-build command. Stop after scope; do not introduce architect, QA, judge, or spec-review stages.

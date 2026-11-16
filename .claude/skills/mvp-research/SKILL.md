---
name: mvp-research
description: Resolve one bounded factual question using the Haiku Explore agent.
disable-model-invocation: true
context: fork
agent: Explore
argument-hint: "[one question; paths or sources; constraints]"
---

Research request: $ARGUMENTS

Resolve only this question. The invocation must be self-contained because this agent does not see the main conversation history or its CLAUDE.md files. If key scope is missing, return the missing item rather than expanding into general research.

For local research, identify exact files/symbols and cite evidence. For requested external research, use at most three primary sources. Do not edit, execute commands, run tests, delegate, or produce a full specification.

Return at most 250 words: answer, supporting paths/URLs, uncertainty, and one next action. Mark partial results explicitly.

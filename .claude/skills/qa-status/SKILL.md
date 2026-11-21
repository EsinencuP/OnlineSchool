---
name: qa-status
description: "Показать состояние K8K QA: последний цикл, commit, счётчики дефектов P0–P3, BLOCKED, текущий gate."
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(node qa/scripts/qa.mjs status*), Bash(git rev-parse*), Bash(git status*), Bash(ls*)
---

# /qa-status

Только чтение. Выведи кратко:
- последний цикл (`qa/cycles/`, папки CC-* и Codex-циклы), его commit из BUILD_INFO.md, gate, дата;
- текущий HEAD (`git rev-parse --short HEAD`) и совпадает ли он с проверенным;
- счётчики дефектов по статусам и P0/P1/P2/P3 (из CONSOLIDATED_REPORT/CYCLE_STATUS, а для Codex-журнала — `node qa/scripts/qa.mjs status`);
- Reopened, BLOCKED, ожидают ретеста;
- состояние окружения: есть ли `qa/fixtures/build.json`, `qa/private/*.storage.json` (только факт наличия, содержимое не читать).
Не изменяй файлы.

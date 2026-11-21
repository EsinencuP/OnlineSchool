---
name: qa-engineer
description: "Независимый технический QA-аудит K8K Academy (код, API, БД, безопасность, frontend, производительность). Только чтение."
disable-model-invocation: true
context: fork
agent: qa-engineer
argument-hint: "[область: code|api|db|security|frontend|perf] [--build qa/fixtures/build.json]"
---

Запусти технический аудит как qa-engineer.

- Зафиксируй commit: `git rev-parse HEAD` и состояние `git status --short` (НЕ меняй репозиторий).
- Область — из аргументов; без аргумента — риск-ориентированный аудит последних изменений плюс безопасность и целостность финансов.
- Не правь код. Команды с записью не запускай — верни их владельцу.
- Верни отчёт по qa/templates/QA_REPORT.md.

Аргументы: $ARGUMENTS

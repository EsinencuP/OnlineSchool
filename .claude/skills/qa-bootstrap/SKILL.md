---
name: qa-bootstrap
description: "Подготовка окружения к первому QA-циклу: проверка стенда, аккаунтов, Playwright MCP, storage state. Ничего не создаёт и не обходит авторизацию."
disable-model-invocation: true
allowed-tools: Read, Glob, Bash(node *), Bash(git rev-parse*), Bash(ls*), Bash(npx --no-install*)
---

# /qa-bootstrap

Только проверка и отчёт «что не хватает». Не создавай учётные записи, не обходи авторизацию, не читай содержимое storage state.
1. Node ≥20 (`node -v`), npx доступен; `npx -y @playwright/mcp@0.0.83 --version`; Chromium для Playwright установлен (если нет — укажи команду `npx playwright install chromium` владельцу).
2. `qa/fixtures/build.json` существует, origin синтетический (loopback/согласованный стенд), `synthetic: true`, `externalEffects: disabled`. Если стенда нет — попробуй `curl -sI <origin>` только для GET/HEAD; недоступен → BLOCKED.
3. Для каждой роли (student, teacher, manager, director): есть ли `qa/private/<роль>.storage.json`. Нет — OWNER ACTION REQUIRED: открыть Playwright MCP роли, войти синтетической учёткой и сохранить состояние (`browser_run_code`/`context.storageState` вручную владельцем) в этот файл. Один файл — одной роли.
4. Серверы `playwright_<роль>` объявлены в `.claude/agents/*.md` (inline mcpServers), у каждой роли свой процесс; `qa/scripts/pw-mcp.mjs` на месте.
5. Хук: `node --test .claude/hooks/qa-write-guard.test.mjs`.
Итог: таблица OK / MISSING / OWNER ACTION REQUIRED.

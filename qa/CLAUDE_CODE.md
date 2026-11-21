# OnlineSchool QA — Claude Code edition

Слой Claude Code поверх общей структуры `qa/` (матрицы, шаблоны, схема дефектов, фикстуры общие с Codex-версией). Codex-раннер (`qa/scripts/qa.mjs`, `.agents/`, `.codex/`) не тронут и работает независимо.

## Команды (открыть проект в НОВОЙ сессии Claude Code)

| Команда | Что делает | Где выполняется |
|---|---|---|
| `/student` `/teacher` `/manager` `/director` | Независимый чёрный-ящик аудит роли через её собственный Playwright MCP | forked subagent `<роль>-agent` |
| `/qa-engineer` | Технический аудит, только чтение | forked subagent `qa-engineer` |
| `/qa-cycle [--gate X]` | QA → Student → Teacher → Manager → Director → сведение → Developer Handoff | основная сессия, запись только в `qa/` (хук) |
| `/qa-fix <cycle>` | Разработчик исправляет подтверждённые дефекты | основная сессия |
| `/qa-retest <cycle>` | Повторная проверка, VERIFIED / REOPENED | основная сессия, запись только в `qa/` |
| `/qa-status` | Состояние циклов и дефектов | только чтение |
| `/qa-bootstrap` | Проверка стенда, аккаунтов, MCP, storage state | только чтение |

Все команды `disable-model-invocation: true` — модель сама их не запускает. Циклы Claude: `qa/cycles/CC-<дата>-<NNN>/` (BUILD_INFO, 5 отчётов, CONSOLIDATED_REPORT, DEVELOPER_HANDOFF, RETEST_REPORT, CYCLE_STATUS). Скриншоты: `qa/evidence/<роль>/<цикл>/` (вне Git).

## Что обеспечено технически

- Пользовательские агенты: `tools` — allowlist из 16 UI-инструментов только своего сервера `playwright_<роль>`; нет Read/Bash/Agent/других MCP; `omitClaudeMd`. Исключены `browser_evaluate`, `run_code_unsafe`, `file_upload`, `network_*`.
- Пять отдельных серверов `playwright_<роль>` объявлены в `.mcp.json` (агент с inline `mcpServers` не проходил проверку `tools`: имена инструментов не распознавались) и подключены к агентам по имени. При первом запуске сессии Claude Code попросит одобрить проектные MCP-серверы. Отдельный процесс и изолированный профиль браузера на роль: `qa/scripts/pw-mcp.mjs` (`--isolated --headless`, `--allowed-origins` из `qa/fixtures/build.json`, `--storage-state qa/private/<роль>.storage.json`, только если файл есть).
- `qa-write-guard.mjs` (PreToolUse): запись разрешена только в `qa/` (кроме `qa/private`, credential-фикстур); относительные/абсолютные/Windows/Git-Bash пути, `..` и symlink-escape; неизвестное — отказ. 7 тестов: `node --test .claude/hooks/qa-write-guard.test.mjs`. Подключён в skills `qa-cycle`, `qa-retest` и агенте `qa-orchestrator`.
- `qa-engineer`: нет Write/Edit, `permissionMode: plan`, Bash под эвристикой «только чтение».
- `SubagentStart/Stop` пишут журнал в `qa/reports/agent-log.jsonl` (вне Git).

## Ограничения (честно)

- Это не ОС-песочница. Bash-фильтр qa-engineer — эвристика; пользовательские агенты изолированы набором инструментов и браузером, не сетью (жёсткая изоляция — отдельный firewall).
- `/qa-cycle` не форкается в `qa-orchestrator`: проект выставляет `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1`, вложенные запуски невозможны. Цикл идёт в основной сессии, агенты строго по одному. Профиль `qa-orchestrator` оставлен для случая, когда лимит глубины поднят до 2.
- Поле `background: false` не используется: у Skill такого поля нет, ожидание результата — поведение по умолчанию.
- Живой запуск агентов этой сессией не проверялся: определения читаются при старте сессии.

## Действия владельца (OWNER ACTION REQUIRED)

1. Новая сессия Claude Code в `D:\OnlineSchool`, затем `/qa-bootstrap`.
2. Создать `qa/fixtures/build.json` по `build.json.example` (синтетический стенд, не production).
3. Для каждой роли войти синтетической учёткой и сохранить `qa/private/<роль>.storage.json` (один файл — одна роль; в Git не попадает).
4. `/qa-cycle --gate STUDENT-GATE` (или другой gate).
5. Решения владельца остаются открытыми: MVP-IMPL-02, G4 для Google Meet API (REL-01/A), production GO.

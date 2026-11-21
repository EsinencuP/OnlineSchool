---
name: qa-retest
description: "Независимая повторная проверка исправлений QA-цикла и регрессия: VERIFIED или REOPENED."
disable-model-invocation: true
argument-hint: "<cycle-id> [--build qa/fixtures/build.json]"
hooks:
  PreToolUse:
    - matcher: "Edit|Write|NotebookEdit"
      hooks:
        - type: command
          command: node "$CLAUDE_PROJECT_DIR/.claude/hooks/qa-write-guard.mjs" write
---

# /qa-retest

Основная сессия, запись только в `qa/`. Продуктовый код не менять.
1. Прочитай `DEVELOPER_HANDOFF.md` и `CYCLE_STATUS.md` цикла; возьми карточки READY_FOR_RETEST. Сверь, что commit стенда (build.json) содержит fix commit; нет — BLOCKED.
2. Запусти `qa-engineer` через Agent tool: передай карточки дефектов (шаги, ожидаемый результат, критерии), commit и origin; задача — повторить исходные действия, проверить связанные сценарии и регрессионный охват (в т.ч. ранее принятые кабинеты). Для ролевых дефектов дополнительно запусти соответствующий `<роль>-agent` по одному, передав ТОЛЬКО шаги воспроизведения исходной карточки.
3. Запиши `RETEST_REPORT.md` в папку цикла. Сработало → VERIFIED (verified_at); нет или нельзя проверить → REOPENED / остаётся READY_FOR_RETEST с причиной. VERIFIED без фактической повторной проверки запрещён.
4. Обнови `CYCLE_STATUS.md`. Если открыто P0/P1 — gate не пройден.

Аргументы: $ARGUMENTS

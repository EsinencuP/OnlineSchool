---
name: qa-cycle
description: "Полный последовательный независимый QA-цикл K8K: QA Engineer → Student → Teacher → Manager → Director → сведение → Developer Handoff."
disable-model-invocation: true
argument-hint: "[--gate FND-GATE|STUDENT-GATE|TEACHER-GATE|CRM-GATE|PUBLIC-GATE|RELEASE-GATE] [--build qa/fixtures/build.json]"
hooks:
  PreToolUse:
    - matcher: "Edit|Write|NotebookEdit"
      hooks:
        - type: command
          command: node "$CLAUDE_PROJECT_DIR/.claude/hooks/qa-write-guard.mjs" write
---

# /qa-cycle — оркестрация

Выполняется В ОСНОВНОЙ сессии (не fork): проект ограничивает вложенные subagents (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1`, `MAX_CONCURRENT_SUBAGENTS=1`), поэтому оркестратор-subagent не смог бы запускать аудиторов. Пока skill активен, запись разрешена только в `qa/` (хук). Продуктовый код не менять, commit/push не делать. Агенты строго ПО ОДНОМУ, следующий — после завершения предыдущего. Параллельный запуск запрещён.

## Этап 0 — фиксация сборки
- Прочитай `qa/fixtures/build.json` (нет — BLOCKED, остановись: попроси владельца создать по build.json.example). Проверь, что origin — синтетический стенд, а не production.
- `git rev-parse HEAD`, branch, `git status --short`, миграции (`ls` каталога миграций), gate из `--gate` (по умолчанию RELEASE-GATE).
- Cycle ID: `CC-<YYYYMMDD>-<NNN>` (следующий свободный в `qa/cycles/`). Создай `qa/cycles/<id>/BUILD_INFO.md` и запиши id в `qa/evidence/CURRENT_CYCLE` (по нему Playwright-сервисы кладут скриншоты в `qa/evidence/<роль>/<id>/`).
- Старые циклы не перезаписывать.

## Этапы 1–5 — аудиты (каждый через Agent tool, отдельный контекст)
Порядок: `qa-engineer` → `student-agent` → `teacher-agent` → `manager-agent` → `director-agent`.
Для каждого: промпт содержит ТОЛЬКО вывод `node qa/scripts/build-context.mjs` (commit/build, origin; пользовательские агенты не умеют читать файлы), gate, путь к его матрице `qa/test-matrix/<ROLE>_TEST_MATRIX.md` (для пользовательских ролей матрица — единственный вход, исходников и чужих отчётов не передавай). Сохрани ответ дословно как `qa/cycles/<id>/<ROLE>_REPORT.md` (QA_ENGINEER_REPORT, STUDENT_REPORT, TEACHER_REPORT, MANAGER_REPORT, DIRECTOR_REPORT) с шапкой commit/дата. Отчёт сохраняется ДО запуска следующего агента. Исходные отчёты после сохранения не редактировать.
- Если qa-engineer начал отчёт с «STOP-CYCLE» (P0 безопасности/целостности данных) — останови цикл, статус BLOCKED, сообщи владельцу.
- Если commit изменился в ходе цикла (`git rev-parse HEAD` отличается) — цикл неполный: остановись и зафиксируй в `CYCLE_STATUS.md`.
- Агент не смог войти/нет стенда → его сценарии BLOCKED; не симулируй результат.

## Этап 6 — сведение (`CONSOLIDATED_REPORT.md`)
Прочитай все пять отчётов. Дубликаты и общие первопричины объединяй со ссылками на исходные находки; разные последствия одной причины оставляй отдельными; не удаляй самостоятельные замечания. Проверь воспроизводимость и соответствие требованиям (docs/…v9.7, REL-01/A, ARCH-31/B; противоречия и неутверждённые KPI → PRODUCT_DECISION, ENHANCEMENT не обязательны). Назначь ID `K8K-QA-<ЦИКЛ>-<NNN>`, type, severity P0–P3, статус OPEN → TRIAGED. Карточки по схеме `qa/findings/FINDINGS_SCHEMA.json`; неизвестное — UNKNOWN.

## Этап 7 — `DEVELOPER_HANDOFF.md` (шаблон `qa/templates/DEVELOPER_HANDOFF.md`)
Только подтверждённые дефекты с приоритетом, требованием, шагами, ожидаемым/фактическим, доказательствами, критериями исправления и повторной проверки. Заверши `CYCLE_STATUS.md` (QA-gate, счётчики P0–P3, BLOCKED, действия владельца).

## Дальше
Исправления — `/qa-fix <id>` (разработчик), повторная проверка — `/qa-retest <id>` (VERIFIED/REOPENED). Production GO не выдаётся автоматически; MVP-IMPL-02 остаётся решением владельца.

Аргументы: $ARGUMENTS

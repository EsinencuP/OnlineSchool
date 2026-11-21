---
name: qa-fix
description: "Разработчик исправляет подтверждённые дефекты из Developer Handoff QA-цикла. Выполняется в основной сессии."
disable-model-invocation: true
argument-hint: "<cycle-id> [defect-id ...]"
---

# /qa-fix — работа разработчика

1. Прочитай `qa/cycles/<cycle-id>/DEVELOPER_HANDOFF.md` (id из аргументов; нет id — последний цикл). Браться только за ACCEPTED/подтверждённые дефекты; ENHANCEMENT и PRODUCT_DECISION — только с разрешения владельца.
2. По каждому дефекту: изучи связанное требование, найди и подтверди первопричину. Если нужно изменить утверждённое бизнес-правило — остановись и верни вопрос владельцу.
3. Исправь минимально; не рефакторь постороннее. Добавь регрессионный тест, где практично; запусти сфокусированные проверки (CLAUDE.md проекта: unit/typecheck/lint по изменённому).
4. Не закрывай дефект сам. Не делай commit/push без разрешения владельца. После commit запиши `qa/fixtures/fix.json` по `qa/fixtures/fix.json.example` и выполни `node qa/scripts/qa.mjs submit-fix <cycle-id> qa/fixtures/fix.json` (совместимо с общим журналом), либо отметь в `qa/cycles/<cycle-id>/CYCLE_STATUS.md` статус READY_FOR_RETEST.
5. Итог: что исправлено, команды проверок и результат, что осталось, затем `/qa-retest <cycle-id>`.

Аргументы: $ARGUMENTS

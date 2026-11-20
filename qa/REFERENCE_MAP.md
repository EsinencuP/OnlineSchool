# Карта действующих источников

| Источник | Что сверять |
|---|---|
| [AGENTS](../AGENTS.md) и [решения CON-01—11](../docs/online_academy_CON_01_11_owner_decisions_addendum_v1.0.md) | Актуальные решения владельца имеют приоритет. Ставки, права, возвраты и границы экономики |
| [Roadmap v9.7](../docs/online_academy_MVP_full_release_architecture_roadmap_v9.7.md) | MVP-IMPL-01/B, открытый MVP-IMPL-02, ARCH-31/B, отдельное решение о допуске |
| [Handoff блока 13](../docs/online_academy_block_13_final_architecture_handoff_v1.0.md) | Утверждённые ARCH-01—32 и условные блокеры |
| [Технический реестр v3.2](../docs/online_academy_technical_architecture_part_01_v3.2.md), [дизайн v1.9](../docs/online_academy_detailed_technical_design_part_01_v1.9.md) | TECH-01—18, данные, транзакции, права, outbox и контракты |
| [Meet REL-01/A](../docs/online_academy_REL-01_A_Meet_API_MVP_release_addendum_v1.0.md) | Расширенный Meet API входит в MVP. Ручные ссылки не доказывают прохождение интеграции |
| [Решения ученика v2](../docs/online_academy_student_architecture_full_decision_log_v2.md) | Домашние работы, путь знаний, подтверждение навыков и контроль 4/8 |
| [Логистика I](<../docs/scheduling_logistics_part_1_modules_01-05_v0.1 (1).md>), [Логистика II](../docs/scheduling_logistics_part_2_modules_06-09_v1.0.md) | Слоты, расписание, факт урока, исключения и роли. Поздние утверждённые уточнения Part II имеют приоритет |
| [UX v0.9](../docs/K8K_Academy_UX_decision_register_v0.9.md), [VIS-12](../docs/K8K_Academy_VIS12_dashboard_module_contracts_v1.0.md), [DESIGN](../DESIGN.md) | Контракты четырёх ролей, RU/RO, актуальный визуальный язык. Референсы показывают представление |
| [K8K Redesign](../docs/K8K_REDESIGN_PLAN.md), [матрица требований](../docs/K8K_REQUIREMENTS_MATRIX.md) | Функциональные инкременты пяти кабинетов и входа. Публичный сайт отдельно |
| [Проверки фазы 0](../PHASE0_CHECKS.md), [статус](../tests/FOUNDATION_STATUS.json), [CI](../.github/workflows/ci.yml) | Пределы проверок задачи, текущее покрытие и условия тестовых окружений |

В рабочем корпусе отсутствуют указанные в установочном задании `online_academy_MVP_implementation_backlog_v1.1.md`, `online_academy_MVP_implementation_strategy_v1.0.md` и `online_academy_technical_architecture_part_01_v2.0.md`. По первым двум ориентиром служит зафиксированное решение в v9.7. Для третьего используется действующая v3.2.

## Открытые вопросы

- MVP-IMPL-02 остаётся решением владельца. Ранее выполненные проверки не устанавливают FND-GATE.
- UX-регистры оставляют часть KPI руководителя и обсуждаемых определений открытыми. Учитывай текущий статус источника.
- Документы различают одинаковые короткие коды из разных реестров. Указывай источник и раздел.
- Исторические записи TASK-15 ограничивают отдельные БД для того этапа. Текущий рабочий CI содержит отдельное разрешение на одноразовый PostgreSQL только внутри этого CI. Для роли продуктовый стенд и аккаунты требуется подтвердить отдельно.
- Сохраняй новые противоречия с двумя ссылками, цитатами и датами в отчёте как PRODUCT_DECISION. Решение регистрирует владелец.

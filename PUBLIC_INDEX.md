# Публичный индекс OnlineSchool

Репозиторий `EsinencuP/OnlineSchool`, ветка **main**, публичный. Исходники,
исследовательские документы, регламенты, задания, референсы и визуальные шаблоны
включены в main. Для чтения перечисленных файлов токен GitHub не нужен.
Предыдущие описания ограниченного экспорта не отражают текущий состав main.

Если сканер не открывает GitHub-папки, используйте:

- [Прямой текст этого индекса](https://raw.githubusercontent.com/EsinencuP/OnlineSchool/main/PUBLIC_INDEX.md).
- [Машинный индекс всех файлов](https://raw.githubusercontent.com/EsinencuP/OnlineSchool/main/PUBLIC_FILES.json).
- [Каталоги по разделам](docs/public/README.md): каждый файл имеет прямую Raw-ссылку.
- [Весь main одним ZIP](https://codeload.github.com/EsinencuP/OnlineSchool/zip/refs/heads/main).

## Регламенты и утверждённые решения

- [Регламент преподавателя, исходный Markdown](https://raw.githubusercontent.com/EsinencuP/OnlineSchool/main/docs/regul/online_academy_teacher_regulations_v1.0.md).
- [Регламент менеджера, исходный Markdown](https://raw.githubusercontent.com/EsinencuP/OnlineSchool/main/docs/regul/online_academy_manager_regulations_v1.0.md).
- [Поздние решения владельца CON-01–11](https://raw.githubusercontent.com/EsinencuP/OnlineSchool/main/docs/online_academy_CON_01_11_owner_decisions_addendum_v1.0.md).
- [Roadmap v9.7 целиком, Raw](https://raw.githubusercontent.com/EsinencuP/OnlineSchool/main/docs/online_academy_MVP_full_release_architecture_roadmap_v9.7.md).
- [Roadmap v9.7 по частям до 24 КиБ](docs/readable/roadmap-v9.7/README.md): полная побайтная копия, без сокращений.
- [Техническое проектирование v1.9](https://raw.githubusercontent.com/EsinencuP/OnlineSchool/main/docs/online_academy_detailed_technical_design_part_01_v1.9.md).

Статусы, даты и приоритеты исходников сохранены. Публикация документа не означает
его юридического утверждения или подтверждения реализации. Поздние явные решения
владельца имеют приоритет в перечисленных ими вопросах.

## Настоящие экраны и дизайн-код

| Кабинет               | Входная точка                                 | Маршруты и экраны                                                                                                                       | Стили                                           |
| --------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Ученик                | [main.tsx](apps/student-cabinet/src/main.tsx) | [router.tsx](apps/student-cabinet/src/router.tsx), [Layout.tsx](apps/student-cabinet/src/Layout.tsx), `apps/student-cabinet/src/pages/` | [style.css](apps/student-cabinet/src/style.css) |
| Менеджер              | [main.tsx](apps/manager-web/src/main.tsx)     | [layout.tsx](apps/manager-web/src/components/layout.tsx), `apps/manager-web/src/pages/`                                                 | [style.css](apps/manager-web/src/style.css)     |
| Вход и staff-кабинеты | [App.tsx](apps/platform/src/App.tsx)          | `/account`, `/teacher`, `/director`, `/operator`; смена пользователей в `packages/account-ui`                                           | [style.css](apps/platform/src/style.css)        |

Экраны находятся в самостоятельных React/Vite-приложениях. [Vercel build](infra/vercel/build.mjs)
собирает их и размещает под общим доменом. Сервер кабинета ученика находится в
`apps/api/src/student/`, менеджера — в `apps/api/src/modules/manager/`.
Полные списки файлов с Raw-ссылками находятся в машинных каталогах `student`,
`manager`, `qa` и `api`.

## Референсы и макеты

- [Галерея ref](ref/README.md): 41 исходный экран и 17 кадров, теперь WebP.
- [Галерея template](template/README.md): семь макетов, теперь WebP.
- [Соответствие старых JPG/PNG новым WebP и хеши](docs/reference-images-webp.json).
- Видео удалено владельцем 01.11.2026; его отсутствие не связано с приватностью.

## Исходные задания и документы реализации

- [Полный исходный пакет MGR-01–10](https://raw.githubusercontent.com/EsinencuP/OnlineSchool/main/docs/AI%20Coder%20Tasks%20%E2%80%94%20%D0%9C%D0%BE%D0%B4%D1%83%D0%BB%D1%8C%202%20%D0%9A%D0%B0%D0%B1%D0%B8%D0%BD%D0%B5%D1%82%20%D0%BC%D0%B5%D0%BD%D0%B5%D0%B4%D0%B6%D0%B5%D1%80%D0%B0.md).
- [Тот же исходный текст по отдельным задачам](docs/readable/manager-tasks/README.md), включая MGR-01–05. Общие инварианты и поздние уточнения обязательны.
- [Исходный MGR-11](docs/AI%20Coder%20Tasks%20%E2%80%94%20%D0%9C%D0%BE%D0%B4%D1%83%D0%BB%D1%8C%202%20%E2%80%94%20MGR-11.md).
- Отдельные исходные тексты AI Coder Tasks STU-01–12 в доступном локальном проекте не найдены. Их отсутствие нельзя трактовать как закрытый доступ.
- Для STU опубликованы [архитектурный журнал решений](docs/online_academy_student_architecture_full_decision_log_v2.md), [документация backend](apps/api/src/student/README.md), [документация frontend](apps/student-cabinet/README.md) и [публичные PR №3–9](https://github.com/EsinencuP/OnlineSchool/pulls?q=is%3Apr+STU-). Это документы решения/поставки, их нельзя выдавать за отсутствующие исходные ТЗ.

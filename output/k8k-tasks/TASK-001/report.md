# TASK-001

Статус: **DONE**. Выполнен только TASK-001; TASK-002 не начат.

## Основа

- HEAD: `171db2142858e035594737e141d422fa5378e844`.
- Ветка: `feat/k8k-design`, сохранена; index пуст относительно HEAD, не изменён.
- Dirty digest принятой основы:
  `d716b9262ca859e0048d46b563872d9690026089eb1cb53b28f453555044ee76`.
- Основной снимок: [manifest](snapshots/20261103T194929.397313Z-086d9a29/manifest.json),
  SHA256 `04677083f6c6f5b395644f9229d9fdebf13a0ba890385eca9dc9b2859fa8543a`.
- Повтор: [manifest](snapshots/20261103T194942.294804Z-89ee5620/manifest.json),
  SHA256 `925bdb53dfa130e5876623c75843eec60dce4b15ea7ad1840d77275bd7acacdc`.
- Рабочее дерево при начале:24 dirty tracked-файла и существующие untracked материалы.
  Снимок:25 tracked +145 untracked, суммарно8 570 869 байт точных копий.
  Разница — новый локальный helper и изменение package script этой задачи.
- Reports/locale/StudentHome, изменения dashboard/API, staff URL, controls и прочий
  исходный код существовали до TASK-001. Авторство чужой работы не присваивается.
  Manifest маркирует их `pre-existing; author not inferred`.

## Что уже существовало

`output/k8k-implementation/baseline` содержал manifest485 hashes, status и
binary patch584014 байт. Старый manifest указывает тот же HEAD, но не содержит
backup содержимого untracked. Сравнение170 захваченных путей:10 совпадают со старыми
hashes,13 изменились,147 отсутствуют в старом manifest. Это сравнение пересечения,
а не новая проверка всех485 исторических путей; старый manifest не содержит ветку.
Подробности: [old-manifest-comparison](snapshots/20261103T194929.397313Z-086d9a29/old-manifest-comparison.json).

## Что изменено

| Путь | Поведение и причина |
|---|---|
| `scripts/k8k-baseline.py` | Локальные capture/verify: новые timestamp/UUID каталоги; bytes + hashes + binary patches; отдельная проверка восстановления и preservation |
| `package.json` | `k8k:baseline` запускает helper, без dependency/postinstall/build/DB команд |
| `output/k8k-tasks/TASK-001/` | Design note до реализации, immutable snapshots, отдельные recovery-checks, инструкция и этот отчёт |
| `docs/k8k-redesign-tasks/EXECUTION_LOG.md` | TASK-001 DONE с commit/digest/отчётом |
| `docs/K8K_REQUIREMENTS_MATRIX.md` | Строка M00.1 со статусом сохранения основы и ограничениями |
| `docs/K8K_IMPLEMENTATION_STATUS.md` | Свежие доказательства TASK-001 отделены от прежних UI-тестов |

Изменений продукта нет. Три документа учёта обновлены **после** снимков;
их предыдущие байты сохранены. Итоговый source audit допускает только эти три пути.
Digest описывает сохранённую точку сравнения; это не digest поздней документации.

## Контракты / SDK / миграции

Новых DTO, endpoint, component props, SDK, зависимостей и миграций нет.
Локальный контракт описан в [design-note](design-note.md) и [инструкции](README.md).
Manifest v1: путь/размер/SHA256/тип/sourceCommit/backupPath, HEAD/index OID, exclusions,
capture checks, hashes защищённых старых артефактов и RAR. `tracked.patch` —608297 байт;
`staged.patch` —0 байт. Пустой patch не выдаётся за выполненную команду `git apply`.

## Источники / решения

TASK-001 §§3/5/6/7/8/10/12; AGENTS preservation; PHASE0_CHECKS актуальный запрет
дополнительных БД и больших прогонов; K8K_REDESIGN_PLAN этап0; текущие матрица/status;
K8K_DESIGN_INSTRUCTIONS §§2–7, с приоритетом действующего §7 над историческим §8;
UX VIS-03…12/UX-AUD — контекст существующего редизайна. CON-01…11 не изменялись:
денежные/педагогические решения в TASK-001 отсутствуют. Картинки не использовались
как бизнес-требования; PNG скопирован как binary reference.

## Свежие проверки

Все команды выполнялись из `D:/OnlineSchool`, только локальные файлы/Git/Python.

| Команда / операция | Exit / результат | Сценарий / доказательство |
|---|---|---|
| `git status --short`; `git branch --show-current`; `git rev-parse HEAD`; `git diff --stat` | 0 | Установлены исходные24 dirty tracked-файла, ветка/commit; status сохранён в snapshot |
| `pnpm k8k:baseline capture`, первичная попытка | 1, исправлено | Scanner остановился на фиксированном негативном URL-тесте; введена точечная оговорка на один literal одного файла, без вывода значения |
| `pnpm k8k:baseline capture`, вторая попытка | 1, исправлено | Выявлено Windows `autocrlf` при patch restore; в изолированной проверке задано `core.autocrlf=false`, исходный Git config не менялся |
| `pnpm k8k:baseline capture`, принятый снимок `20261103T194929.397313Z-086d9a29` | 0 | [verification](snapshots/20261103T194929.397313Z-086d9a29/verification.json):25 tracked patch-restores и170 byte-restores;8 preservation checks true |
| `pnpm k8k:baseline capture`, повтор `20261103T194942.294804Z-89ee5620` | 0 | [verification](snapshots/20261103T194942.294804Z-89ee5620/verification.json): тот же dirty digest, все предыдущие snapshots неизменны |
| `git apply --stat --numstat <tracked.patch>`; `git apply --check --binary <tracked.patch>`; `git apply --binary <tracked.patch>` | 0 каждый | Helper запускал только в новых изолированных recovery Git-каталогах; все25 результатов совпали с Git-normalized OID |
| `python scripts/k8k-baseline.py verify output/k8k-tasks/TASK-001/snapshots/20261103T194929.397313Z-086d9a29 --check-source --allow-change docs/k8k-redesign-tasks/EXECUTION_LOG.md --allow-change docs/K8K_REQUIREMENTS_MATRIX.md --allow-change docs/K8K_IMPLEMENTATION_STATUS.md` | 0 | [Итоговая проверка](final-verification.json): повторное восстановление;167 исходников неизменны, только3 намеренных документа учёта отличаются; HEAD/branch/index/старый baseline/RAR сохранены |

При подготовке проверки создан локальный `scripts/__pycache__/k8k-baseline.cpython-312.pyc`.
Автоматическая проверка отклонила его удаление (`blocked by policy`, команда не запущена).
Он оставлен и исключён из backup как generated output; это не блокирует сохранение исходников.
Промежуточные capture оставлены без перезаписи. Их результаты не подменяют два принятых снимка.

## Acceptance checklist — обязательные сценарии §8

| Критерий | Статус | Доказательство |
|---|---|---|
| Tracked diff читается без применения к source tree | PASS | stat/numstat + apply-check в изолированном каталоге; исходный index сохранён |
| Untracked Reports/locale/StudentHome сохранены содержимым | PASS | manifest entries + `files/apps/student-cabinet/src/pages/{Reports,StudentHome}.tsx`, `files/packages/ui/src/locale.tsx`; byte-restore |
| UTF8 и binary не перекодированы | PASS | Все170 copies/raw-restores побайтно совпадают;3 PNG включены; CRLF не нормализуется в raw copies |
| Повтор снимка сохраняет предыдущую версию | PASS | Разные timestamp/UUID; одинаковый dirty digest; `previousSnapshotsUnchanged:true` |
| Секреты отсутствуют в публикуемых артефактах | PASS в локальном scope | Ничего не публиковалось; `.env`/session/ignored исключены до чтения; bounded key/JWT/credential-URL scan, одна точечная synthetic fixture оговорка; общей secret-аудит гарантии нет |
| Source hashes до/после чтения неизменны | PASS | capture checks true; финальный audit отдельно указывает3 последующих документа учёта |

## Acceptance checklist — готовность §10

| Критерий | Статус |
|---|---|
| Все шаги TASK-001 выполнены; отсутствие predecessor подтверждено | PASS |
| Контракты/ограничения проверены сценариями восстановления | PASS |
| Ошибки исправлены без ослабления auth/lint/доменной логики | PASS |
| Артефакты связаны с HEAD/dirty digest; production-данные/аккаунты не использовались | PASS |
| Журнал и предметная строка матрицы обновлены; следующему TASK переданы пути | PASS |
| Проверки основаны на локальных реальных файлах; чужой код/старые тесты не выданы за новые | PASS |
| Отчёт различает прежний код, изменения, свежие/исторические доказательства | PASS |
| БД/applied migrations/production не менялись; push/deploy не выполнялись | PASS |

## Визуальные доказательства / не проверено

Новых визуальных изменений нет; RU/RO, viewport360/768/1024/1280, focus/keyboard,
роль/route/fixture/browser прогоны — NOT_RUN в TASK-001. Существующие screenshots
сохранены, но не являются свежей UI-приёмкой. Сборки/рекурсивная регрессия — NOT_RUN,
не нужны для byte backup; следующая baseline UI-матрица относится к TASK-003.
Никаких DB/provider проверок. FND-GATE/LEGAL/FIN-LEGAL/MeetPOC/OAuth/G4/production GO
не закрывались. Блокеров TASK-001 нет.

## Ограничения и исключения

- SHA256 **не заменяет backup содержимого**. Архивы `apps/apps.rar` (136682186 байт)
  и `uiux.rar` (2898090 байт) не копировались/не извлекались; их hashes до/после совпали.
  ZIP taskpack и прочий untracked output также остаются на месте без content backup.
- Полный адресный список — `excludedUntracked` в manifest; ignored-файлы не
  перечисляются и не читаются. `.env*`, cookies/session state, зависимости и generated
  outputs не нужны для исходного baseline и не включены.
- Чистые tracked-файлы восстанавливаются из указанного HEAD в существующем Git.
  Внешний backup/bundle всей `.git` и файлов вне scope не создавался; ACL/mtime/NTFS
  alternate streams не проверялись.
- Сканирование ищет ограниченный набор credential signatures. Literal из негативного
  URL-теста является синтетическим кодом, а не реальным секретом. Это не полная
  безопасность произвольных данных и не разрешение публиковать private backup.

## Остатки / передача

TASK-002: полный инвентарь маршрутов, форм, команд и авторитетных источников.
Передаются HEAD/dirty digest, два immutable manifest, `tracked.patch`, `staged.patch`,
`files/`, `old-manifest-comparison.json`, `verification.json` и локальный CLI.
Историческая screenshot-матрица не закрыта (TASK-003); бюджеты — TASK-004.
Никаких новых API/URL/props для следующего кодера не создано.

## Риски и обратимость

Снимки и recovery-каталоги находятся локально на том же диске, поэтому это точка
сравнения/восстановления рабочей основы, не внешняя аварийная копия. После TASK-001
изменять файлы snapshot нельзя; новый запуск создаёт новый timestamp/UUID.
Откат helper/script и трёх добавленных разделов документации ограничен этими
изменениями; прежние байты документов доступны в snapshot. Автоматического
восстановления поверх dirty source tree, удаления истории/архивов, reset/clean/stash,
смены ветки, commit/push/deploy не выполнялось.

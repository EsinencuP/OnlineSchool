# TASK-004 — budgets и defects

Принятый run: [bundle.md](runs/2026-11-03T21-10-19-078Z-0b1240/bundle.md),
[bundle.json](runs/2026-11-03T21-10-19-078Z-0b1240/bundle.json),
[defects.md](runs/2026-11-03T21-10-19-078Z-0b1240/defects.md),
[verification.json](runs/2026-11-03T21-10-19-078Z-0b1240/verification.json).

Из `D:/OnlineSchool`:

```powershell
pnpm k8k:route-budget build
pnpm k8k:route-budget verify output/k8k-tasks/TASK-004/runs/2026-11-03T21-10-19-078Z-0b1240
pnpm k8k:route-budget selfcheck
```

`build` создаёт новый timestamped run, строит только3 frontend с manifest, измеряет
48 route closures и создаёт адресный реестр. Никаких .env, API proxy, DB, Prisma/SDK
generation или провайдеров. `verify` перечитывает manifest/assets и source hashes;
не пересобирает и не исправляет приложение. `selfcheck` использует локальный diamond
graph, fonts и отдельные subprocess probes: missing manifest и over-budget должны
вернуть exit1. Ошибки/отсутствующие assets не подменяются нулями.

Метод `k8k-route-v1`:

1. Entry JS/CSS и рекурсивные static imports.
2. Явные seeds для route-required lazy page/tab, извлечённые из исходников React lazy.
3. Каждый shared emitted file один раз; gzip(level9) для каждого JS/CSS отдельно.
4. Оба referenced local Golos WOFF2 целиком: cyrillic22032+latin37916=59948 raw bytes.
5. Total=JS/CSS gzip+font; limit256000=250KiB. Отложенные chunks перечислены.
6. Manager passkey browser action имеет отдельную измеренную closure; другие tabs/pages
   являются отдельными строками навигации. Ничего не удаляется ради веса.

Для missing manifest/import/asset/font: status unavailable, total/gzip/font null, pass:false.
Root summary также не подменяет отсутствие всех измерений нулевым максимумом.
`bundle.json` хранит route/files/method/gzip/font/total/baselineRef/pass, manifest/asset
hashes, source/lockfile digests, Node/Vite/zlib и build flags. Три приложения используют
единый configFile:false/envDir:false source-build метод, а не разнородные старые dist.

Историческая delta к implementation/phase0/phase2 = null/unavailable. Старые числа
не имеют полного совпадающего route/dirty/build/font provenance. TASK-003 emitted
assets совпали побайтно с новым build, но его run не содержал route manifest;
cross-reference не выдаётся за отдельную route delta. Этот run — первая полная
baseline данного метода для будущих совместимых измерений.

74 OPEN записи:13 групп overflow,31 групп locale,28 documented workflow gaps,
1 small pixel-variability и1 student secret-command cache lifecycle. У каждой есть
reproduction, impact, inherited/regression status, evidence и конкретные future TASK.
Inherited означает наличие на сохранённом TASK-003 baseline; регрессия из более раннего
релиза не доказана. Conditional DIR/BI scope перечислен отдельно и не включается
под видом устранения дефекта. Source/security запись подтверждена изолированным
[nonsecret variable probe](cache-variable-probe.json), без реального пароля/OTP/сессии.

Budget PASS не закрывает дефекты, роли, WCAG, бизнес-правила, DB/providers или
FND/LEGAL/Meet/production gate. Исторические output и чужой dirty код сохранены.

# TASK-003 — baseline текущей версии

Это снимки **после** уже существующего K8K-инкремента. Они не изображают состояние
до его реализации. Product UI здесь не исправляется; обнаруженные дефекты сохраняются.

Принятый baseline capture:
`runs/2026-11-03T20-50-31-027Z-8bc616`.
Оба прохода завершены, `audit.json` имеет status DONE:48/48 поверхностей,2128 PNG,
1064 одинаковых semantic hashes,1010 exact PNG pairs. Остальные54 пары имеют те же
размеры, максимум0,11% различающихся пикселей; `pixel-comparison.json` сохраняет bbox/счётчики.
В run записаны124 overflow screenshots, а16 строк health-empty явно NOT_RUN.
Все ранние smoke/discovery каталоги сохраняются как история подготовки harness.
Нулевой случай CLI-фильтра в раннем `20-38-26` не является доказательством; пустая
выборка теперь явно отклоняется.

Локальные команды из `D:/OnlineSchool`:

```powershell
pnpm k8k:baseline-ui
pnpm k8k:baseline-ui:audit output/k8k-tasks/TASK-003/runs/2026-11-03T20-50-31-027Z-8bc616
```

Первая команда создаёт **новый** timestamp/UUID каталог, строит3 приложения и
общий test fixture в него и снимает два независимых прохода. Каждый сценарий получает
новый browser context, новый изолированный synthetic state и фиксированные clock/data/UUID.
Вторая проверяет PNG hashes, полноту48 inventory surfaces×2 pass×2 locale×4 widths,
общие состояния, source hashes и сохраняет `audit.json`/фильтруемую `gallery.html`.

Диагностические параметры:

```powershell
pnpm k8k:baseline-ui --smoke
pnpm k8k:baseline-ui --smoke '--cases=student:/student,manager:new-lead'
```

`--smoke` делает один проход по ограниченной выборке и двум ширинам. `--discovery`
делает один проход полной выборки; эти результаты не заменяют двойной итоговый run.
Чужие historical output не перезаписываются.

Артефакты run:

- `fixture-manifest.json`:фиксированное время `2026-11-03T10:30:30Z`, zone
  `Europe/Chisinau`, UUID policy,134 case definitions,399 input hashes, HEAD/branch,
  scoped dirty digest и SHA256 неизменённого входного инвентаря TASK-002.
- `runtime.json`: фактические Node/Chromium/Playwright versions и точные loopback origins.
- `INDEX.json`/`INDEX.md`: route/role/requested locale/actual htmlLang/viewport/fixture ID,
  screenshot SHA256, фактические assertions/state/overflow/offenders/keyboard evidence,
  DTO findings, request operation/method/status (без headers/body/secret values).
- `comparisons`: пары новых независимых contexts; PNG byte identity и semantic-text hash
  проверяются отдельно. Различия не скрываются изменением эталона.
- `build/`: Vite output текущих source aliases, configFile:false/envDir:false,
  publicDir:false, без API proxy/реальных сервисов. Старые app dist не использовались.

HTTP fixtures повторяют существующие DTO/enum/capabilities; успешные ответы проверяются
по checked-in OpenAPI (required/type/enum/pattern/nullable/array). Не заявляется полный
JSON Schema валидатор или новая backend-приёмка. Неизвестная API операция возвращает501.
Финансовые записи остаются decimal strings. PENDING receipt и историческое директорское
подтверждение для действующего абонемента представлены разными синтетическими записями.

Внешняя сеть browser context блокируется по точному origin. Каждый captured scenario
пробует `baseline-network-sentinel.invalid` и фиксирует abort. Service workers заблокированы.
Node HTTP adapter обращается только к собственному127.0.0.1 fixture worker; live API,
Neon/S3/Meet/отправка сообщений не вызываются. `.env*` не читаются.

Privacy: screenshot запрещён при непустом password/OTP input или output одноразового
пароля. Email-code screenshot содержит пустой input; реальные коды не выдаются.
Login/MFA fixtures используют только краткоживущие synthetic in-memory данные, не
сохраняют тела/headers/cookies. AccountMenu получает существующий demo catalog и
идентификатор соответствующего synthetic demo actor; переключение сессии не выполняется.

Loading/blank не считаются ready. Девять common state classes включают10 снимков
с отдельными pending/unknown. Недоступные product workflows перечислены NOT_RUN в
fixture manifest. У health DTO нет empty-data представления: соответствующая product
строка NOT_RUN, common empty снят отдельно. Conditional DIR-01…06 не включаются;
DIR-07/BI/P&L остаются вне выпуска.

Overflow измеряется `documentElement.scrollWidth` против viewport и сохраняет offenders
и существующие hidden-overflow containers. Harness не добавляет overflow:hidden/mask.
Длинные синтетические RU/RO подписи проверяются в данных и common fixture; текущая
смешанная локализация фиксируется как baseline-дефект, не переводится автоматически.

Клавиатурная проба Tab сохраняет фактический focus/outline и восстанавливает исходный
focus/scroll. Это краткая probe, а не ручная WCAG-приёмка всех клавиш/screen reader.
FND-GATE/LEGAL/FIN-LEGAL/MeetPOC/OAuth/G4/production GO здесь не закрываются.

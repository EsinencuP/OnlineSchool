# TASK-006 — design note до реализации

Prerequisite TASK-005: 426 source hashes совпали, accepted verification PASS.
429 файлов текущей основы и binary diff сохранены в before/ и before.json.
API/DTO/SDK/финансовые или session rules не меняются.

Обнаружено: local Latin WOFF2 не содержит части RO glyphs; CDP discovery показывает
смешение Golos/Arial даже без unicode-range ограничения. Full latin-ext 19180 bytes
добавил бы > имеющегося manager headroom 17753 bytes. Нельзя скрыть этот расход.

Планируемые контракты:

- Дополнительный локальный Golos Romanian WOFF2, полученный подмножеством уже
  установленного Fontsource latin-ext: ĂăȘșȚț и поддерживаемые legacy Şş. âî/ÂÎ остаются в latin.
  Одно семейство, 400–900 weight axis, font-display swap, сохранённые OFL attribution/license.
  Проверяются реальные cmap, glyphs в браузере и readable fallback.
- `scripts/k8k-font-assets.py`: reproducible generation/check command, SHA256 исходника,
  pinned FontTools4.60.1/Brotli1.1.0 (MIT, 2025-09-29/2023-09-07), dev-only isolated target.
  Они необходимы для компактного RO subset и проверки WOFF2/cmap; глобальный Python и
  JS dependency graph не меняются. Metadata получены из PyPI.
  Source cmap затем подтвердил отсутствие legacy Ţţ/NFD marks; для них остаётся
  readable system fallback, без изменения человеческого текста.
- `IconName`/`IconProps`: сохраняются 24 static named Lucide imports и decorative
  aria-hidden/focusable=false; className/size без dynamic library loading.
- `IconButton` сохраняет обязательный label; SVG не получает отдельного имени.
- `Avatar` использует grapheme-safe первые инициалы, bounded box; полное имя доступно.
- CSS typography scopes: single font, 12/14/16/18/22/28/36; operational text ≥14,
  student body16, tabular numbers; без массового изменения legacy styles.
- `k8k-route-v2`: та же closure/gzip схема + ВСЕ три raw font subsets однократно.
  Старый v1 доступен для исторического verify; новая проверка требует Romanian font,
  missing input/overbudget => fail. Delta разбивается на JS/CSS и реальный font прирост.
- `k8k:typography:evidence`: scoped fresh source builds, RU/RO specimens ×4 ширины,
  font blocked/fallback, CDP platform glyph proof, requests/bytes/dedup, accessibility
  snapshot, long names, keyboard, relevant existing VIS11 states.

Font assets generation CLI сверено с первичной FontTools subset документацией;
Lucide API — compatible v0.460 docs и установленными0.468 types, Fontsource — реальные
exports/unicode.json5.2.8. Dependencies проекта не обновляются.

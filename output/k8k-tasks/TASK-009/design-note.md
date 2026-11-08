# TASK-009 — planned contracts, до реализации

Prerequisite TASK-008:475/475 source hashes matched;479 inputs+tracked patch saved in before/.
Only TASK-009, без массовой миграции/новых API/команд/статусных вкладок ученика.

Planned `packages/ui/src/composites.tsx`:
- `Tabs`: value/onValueChange/label/items(value,label,content,disabled?,disabledReason?),
  activationMode=manual, orientation, mountPolicy=keep-mounted(default)|unmount-inactive.
  Radix Tabs pinned1.1.3: arrows/Home/End/ids/panel semantics. Keep-mounted hidden panels
  сохраняют DOM/form state. Unmount policy только с caller dirty guard в onValueChange.
- `Segmented`: controlled value/onValueChange/label/options(value,label,disabled?,disabledReason?);
  native radio group/fieldset, optional name, arrows/Space + Home/End. App/router владеет режимом
  и датой; UI не сбрасывает дату/период/пагинацию и не вызывает SDK.
- `Tooltip`: controlled open/onOpenChange/label/content; собственный info IconButton, refs;
  Radix Tooltip pinned1.1.8, hover/focus/Escape + explicit click/tap для supplementary help.
  Только пояснение, не обёртка action с перехватом его click. Disabled reasons остаются видимыми
  у Button/options независимо от Tooltip. No interactive tooltip contents.
- `HeroCard` и `StatTile`: композиция существующего Card; title/value/unit/source/period/action/state
  все переданы caller, source/period обязательны. Без KPI/default цифр/вычислений.
  Discriminated state: ready/stale/pending/subscription-limited может показывать supplied value;
  loading/empty/error/forbidden/session-expired не показывает cached private value. State copy
  передана caller RU/RO; generic presentation не вычисляет access/business state.
- `Toast` (единый подход): controlled immutable item IDs + onDismiss, native polite/assertive
  live regions. No global bus/provider store/Sonner/second Toast stack. Единственный native
  подход выбран ради exact ID-dedup и отсутствия countdown/autoread/claim/resolve effects.
  `ToastMessage`: id/message + outcome confirmed|queued|error|unknown и совместимый tone;
  queued/unknown не success даже при некорректном runtime tone. Server/status adapter остаётся
  в caller, UI не интерпретирует HTTP и не подтверждает результат заранее.
  Seen IDs содержат только opaque event IDs на lifetime actor-scoped component; повторный
  render/same ID/dismiss/re-add/locale change не повторяет live announcement. New event requires
  new id. Persistent visual notice + explicit dismiss; no countdown/auto-hide/focus effect.
  Actor boundary unmounts Toast and clears its external items on revoke, никакого singleton cache.

Candidate dependencies: только Tabs1.1.3 и Tooltip1.1.8, MIT/05.02.2025/React18 peers,
точные registry/installed d.ts сверяются; React/Vite/fonts unchanged. No new Toast dependency.

Applicable inventory: Student Lessons list/calendar (view independent of month); manager Schedule
day/week/list (date stays in parent); manager Student route links and platform section URLs —
router ownership, не переводить links в local Tabs. Staff forms требуют guard. Student Homework
и history остаются едиными списками, полностью исключены. Первый safe consumer: заменить только
K8K list/calendar mode control Student Lessons на Segmented, существующие query/date/hooks preserved.
RU/RO только новые labels; full legacy Lesson localization отдельный TASK-029/034.

Evidence: CSF/local app/router fixture, retained form and guarded unmount, calendar/list date,
queued202/error/unknown/confirmed external mock response, live DOM mutations/no focus theft,
hover/keyboard/touch help, reduced-motion, RU/RO×4 widths, all9 display states,48 v2 route budgets.

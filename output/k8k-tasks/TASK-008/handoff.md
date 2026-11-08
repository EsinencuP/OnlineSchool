# TASK-008 — передача interfaces

Public exports: `packages/ui/src/index.ts` → `overlays.tsx`.
Runtime CSS: существующий `@online-school/ui/style.css` → tokens/overlays.css.
React18.3.1, pinned Radix Dialog/AlertDialog/Popover1.1.6, DropdownMenu2.1.6.

`OverlayLifecycle`: required `open:boolean`, `onOpenChange(open):void`;
optional `onRequestClose(reason):void`, `initialFocusRef`, `returnFocusRef`.
Close reasons: escape/outside/close-button/cancel-button/primitive.
Если onRequestClose задан, caller обязан явно закрыть через свой setOpen(false),
либо сохранить open=true/показать app-level confirm/reconciliation. Это не server abort.

- `Dialog`/`Drawer`: title/description/children; optional trigger ReactElement(asChild,
  forwarding native props/ref), modal=true, pending(aria-busy), contentProps/native
  focus/Escape/outside callbacks. forwardRef<HTMLDivElement> на Content.
  Drawer responsive desktop-right/mobile-bottom использует тот же DialogSurface.
- `ConfirmDialog` (`AlertDialog` alias): title/description/confirmLabel/cancelLabel/
  onConfirm; optional trigger/children/pending/pendingDescription/destructive/contentProps.
  Action не закрывает автоматически; pending блокирует повтор confirm только на уровне UI.
  Caller дополнительно защищает синхронным inFlight ref/своим command hook, сохраняет
  CSRF/idempotency/revision и сверяет unknown результат. Cancel/Escape идут через requestClose.
  Safe Cancel получает default focus; optional initialFocusRef сознательно задаёт caller.
- `Popover`: title/description/trigger/children + lifecycle; modal=false default,
  collision-aware contentProps. Имена/description через stable useId, no focus trap в nonmodal.
- `DropdownMenu`: trigger/label/items + lifecycle **без initialFocusRef** (native roving
  keyboard/entry focus Radix этой закреплённой версии). Content ref/returnFocusRef доступны.
  items: id/label/textValue?/disabled?/disabledReason?/onSelect(event). Caller передаёт
  eligibility и SDK callbacks; event.preventDefault сохраняет меню. Menu modal=false default.

Native callbacks вызываются первыми; preventDefault сохраняется. Ref focus перехватывает
default только после успешного фокуса подключённого элемента, preventScroll. No forceMount,
CSS exit retention или сохранённых скрытых форм. Session owner обязан unmount entire root,
clear private state и отбросить callbacks старого actor. UI не знает session/permissions/API.
Modal background: aria-hidden + pointer isolation + focus trap + scroll lock/restore Radix,
не обещание native inert attribute.

Первый production consumer — только read-only `apps/student-cabinet/src/profile-help.tsx`.
`Account.tsx` profile save/update и соседние функции неизменны (AST evidence).
Existing account-ui/native manager/student modals не мигрированы: см. lifecycle-inventory.md.
Перед каждой миграцией сохранить dirty/unknown/version/idempotency/secret guards caller,
не заменять guarded close безусловным setOpen(false). Ownership account-ui и SDK/BroadcastChannel/
full navigation остаётся там; отдельный AccountMenu TASK-067.

CSF stories: `packages/ui/stories/overlays.stories.tsx`, локальный renderer
`apps/student-cabinet/tests/ui-overlays/`. Only synthetic noncredential markers.
GuardedOverlay показывает dirty/pending/unknown/revoke; AsyncConfirmation — pending cancel veto.
Harness `pnpm k8k:overlays:evidence` строит актуальные3 apps и сравнивает48 v2 routes
с TASK-007 тем же closure/font/gzip методом (all3 raw fonts63492), только loopback HTTP.
`pnpm --filter @online-school/student-cabinet typecheck:ui-overlays` проверяет strict props.

Следующие отдельные задания: TASK-009 Tooltip/Tabs/Toast; TASK-013 Storybook runtime;
TASK-030 autosave UI; TASK-034 profile/security full RU/RO; TASK-053/054 lead forms,
TASK-055/056 financial caller guards; TASK-067 account/session; TASK-068/069 privacy/gate.
Full WCAG/AT, backend/DB/providers, FND/LEGAL/Meet/production acceptance не закрываются.

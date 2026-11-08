# TASK-008 — design note до реализации

TASK-007 prerequisite:465/465 listed source hashes совпали, verification PASS.
466 файлов текущей основы и binary patch сохранены в before/ и before.json.
Native dialogs/guards/secret AccountScreen/account-ui не заменяются глобально.

Dependencies: Radix Dialog/AlertDialog/Popover1.1.6, DropdownMenu2.1.6, MIT,
05.02.2025 (636 дней), React18 peers. @types/react-dom18.3.7 (MIT,552 дня) — уже
используемая workspace версия, явно закрепляется в UI для исключения implicit React19 types.
ReactDOM18.3.1 уже используется; declaration будет runtime для portal dependency.
Registry metadata сохранены в dependencies.json. Install только --ignore-scripts.

Planned public contracts (`packages/ui/src/overlays.tsx`, exports из index):

- `OverlayCloseReason = escape | outside | close-button | cancel-button | primitive`.
- Controlled `DialogProps`: open/onOpenChange/title/description/children, optional trigger
  ReactElement (asChild, caller forwardRef), onRequestClose(reason), pending UI semantics,
  initialFocusRef/returnFocusRef, contentProps для native focus/outside events, content ref.
- `Drawer`: тот же Dialog lifecycle, responsive right→bottom layout, modal по умолчанию.
  Non-modal variants не trap focus/hide background/lock scroll.
- `ConfirmDialog` / alias `AlertDialog`: controlled AlertDialog, caller onConfirm/labels,
  pending disables repeated confirm. Action default close предотвращён: parent сам закрывает
  после результата. Closing не abort/server rollback/платёжное полномочие.
- `PopoverProps`: controlled open/onOpenChange/title/description/trigger/children,
  modal=false default, refs/focus/outside callbacks/collision handling.
- `DropdownMenuProps`: controlled open/trigger/label/items, caller-owned onSelect/disabled/
  disabledReason/textValue; modal=false default; refs/roving keyboard. UI не фильтрует роли.
  Existing AccountMenu SDK/broadcast/navigation/ownership остаются в account-ui;
  object-menu fixture показывает переданные callbacks. Account migration — TASK-067.

No forceMount/hidden retained private form DOM. Caller removes overlay subtree and drops
stale async responses on session revoke; UI не подписывается на business session.
Radix handles native modal focus/inert semantics/scroll lock/restore; browser checks
prove focus isolation, accessibility hiding, pointer isolation and scroll restoration.
Wrappers factory calls marked pure where correct so unused overlays tree-shake from
public UI barrel. Любой используемый primitive полностью включается в route budget.

App-level `requestClose` guard реализуется в lifecycle specimen: dirty/pending/unknown
обрабатывает caller, no blind retry. Nested Dialog/Popover/Confirm/menu, async response
after close/revoke проверяются synthetic noncredential marker only. Настоящие OTP/password
не создаются, не попадают в stories/logs/snapshots.

Один безопасный production example: read-only Profile help раскрывает уже существующее
пояснение displayName, без нового API/action/domain state. Остальные формы/hooks untouched.
CSF stories/local fixtures RU/RO×4 widths, unit/typecheck/lint/build/v2 budget. TASK-009 не начат.

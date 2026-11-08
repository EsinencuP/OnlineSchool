# TASK-007 — contracts

Exports уже доступны через packages/ui/src/index.ts:

| Component/type | Contract |
|---|---|
| ButtonProps | native button props/ref; default type=button; variant primary/secondary/ghost/danger; pending disables/busy+decorative clock; density; disabledReason visible+describedby |
| IconButtonProps | ButtonProps + required label, forwarded button ref |
| FieldProps | native input attrs/ref; label/hint/error/pending/density/containerClassName; className остаётся на input |
| SelectProps | native select attrs/ref + Field presentation; options/optgroup/multiple/size/name/value/defaultValue/onChange сохраняют native смысл |
| StatusChipProps/StatusTone | known info/success/warning/danger/neutral; runtime unknown renders only unknownLabel or localized neutral text, not supplied success text |
| AvatarProps | native span/ref, name→two grapheme initials/full accessible name; empty name→neutral localized fallback; no photo |
| CardProps | native section/ref; title/children retained, headingLevel2/3/4, description/actions; named region |
| ControlDensity | comfortable/default; compact36 только staff desktop fine pointer. Other targets44/student primary48 |

Field/Select description IDs: `${id}-description` остаётся primary (error либо hint-only).
При hint+error hint получает `${id}-hint`; external aria-describedby IDs deduped и сохранены.
Generated useId используется только если caller не задаёт id. Validation error не сбрасывает value.
Pending/error/value/eligibility/error-summary остаются у caller; UI не делает SDK запросов.

CSF-compatible examples: packages/ui/stories/controls.stories.tsx; consumer fixture:
apps/student-cabinet/tests/ui-controls/fixture.tsx. Runtime Storybook — TASK-013.
Profile migration: only K8K UI branch, legacy Panel/input/button preserved; SDK/useCommand/save unchanged.
Local Profile labels RU/RO, generic ErrorNotice translation — TASK-016/034; StateBoundary — TASK-012/015.
Future TASK-008 получает эти native props/ref/description/target-size contracts; dialogs не реализованы.

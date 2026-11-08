# TASK-007 — design note до реализации

Prerequisite TASK-006: 456/456 source hashes совпали; verification PASS.
457 scoped файлов и binary patch сохранены в before/ + before.json, включая controls,
style.css, tokens, consumer Account.tsx. Старые snapshots и outputs не переписываются.

Native primitives расширяются совместимо; API/DTO/SDK/hooks/ledger не меняются.

Planned public contracts в существующем controls.tsx/index export:

- `ControlDensity = 'comfortable' | 'compact'`; compact36 только явно выбранный staff
  desktop с fine pointer. Touch44, student primary48 остаются минимальными.
- `ButtonProps`: native ButtonHTMLAttributes + прежние variants/pending, density и
  `disabledReason?: ReactNode` (видимое объяснение + merged describedby). Default button
  type остаётся button; pending disabled/busy, декоративный clock без смены бизнес-статуса.
- `IconButtonProps`: ButtonProps + обязательный label, forwardRef<HTMLButtonElement>.
- `FieldProps`: native input attrs/ref + label/hint/error/pending/density/containerClassName.
  `className` остаётся на input. Прежний primary description id `${id}-description`
  сохраняется; если hint и error вместе, hint получает `${id}-hint`; external IDs deduped.
- `SelectProps`: native select attrs/ref и тот же field contract; options/optgroup/children,
  value/defaultValue/onChange/name/autocomplete/multiple сохраняют native смысл.
- `StatusChipProps`: native span attrs + known tone/children; runtime unknown tone даёт
  только явно нейтральный localized unknown text (или supplied unknownLabel), никогда success.
- `AvatarProps`: native span attrs/ref + name/optional unknownLabel, initials/full-name
  без фото, neutral fallback пустого имени. `CardProps`: native section/ref + headingLevel,
  description/actions, существующий title/children контракт сохраняется.

`packages/ui/stories/controls.stories.tsx`: CSF-compatible render/args без установки
Storybook до TASK-013; реальные stories импортируются локальным consumer fixture.
Fixtures RU/RO×4 widths, native refs/labels/keyboard/long validation/controlled/uncontrolled/
pending/value retention, relevant VIS11 states. Никаких реальных credentials/детей/провайдеров.

Безопасный consumer: только K8K-ветка Student Profile (Field/Button/Card), прежняя
legacy ветка и useCommand/save/FormData/SDK functions сохраняются. Error summary app-level.
Реальный профиль проверяется с локальными fixtures/mock network, включая failure/pending.
Точечные UI build/test/lint + consumer typecheck; fresh font-inclusive v2 route budgets.
Новых dependencies не требуется. React18 forwardRef/useId/native props проверены по
первичной v18 документации через Context7; React19 ref API не вводится.

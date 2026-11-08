import { forwardRef, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { Card, IconButton } from './controls.js';
import { Icon } from './icon.js';
import { useLocale } from './locale.js';
import type { BoundaryState } from './state.js';

export type TabItem = {
  value: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
  disabledReason?: string;
};
export type TabsProps = {
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  items: readonly TabItem[];
  activationMode?: 'manual' | 'automatic';
  orientation?: 'horizontal' | 'vertical';
  /** Unmounting must be guarded by the caller before it accepts onValueChange. */
  mountPolicy?: 'keep-mounted' | 'unmount-inactive';
};
export const Tabs = /* @__PURE__ */ forwardRef<HTMLDivElement, TabsProps>(function Tabs(
  {
    value,
    onValueChange,
    label,
    items,
    activationMode = 'manual',
    orientation = 'horizontal',
    mountPolicy = 'keep-mounted',
  },
  ref,
) {
  const id = useId();
  return (
    <TabsPrimitive.Root
      ref={ref}
      value={value}
      onValueChange={onValueChange}
      activationMode={activationMode}
      orientation={orientation}
      className="k8k-tabs"
    >
      <TabsPrimitive.List aria-label={label} className="k8k-tab-list">
        {items.map((item) => (
          <div key={item.value} className="k8k-tab-option">
            <TabsPrimitive.Trigger
              value={item.value}
              disabled={item.disabled || false}
              className="k8k-tab-trigger"
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                // A caller may open a confirmation and move focus during this key event.
                event.preventDefault();
                if (!event.repeat && !item.disabled && item.value !== value)
                  onValueChange(item.value);
              }}
              aria-describedby={
                item.disabledReason ? `${id}-${encodeURIComponent(item.value)}-reason` : undefined
              }
            >
              {item.label}
            </TabsPrimitive.Trigger>
            {item.disabledReason && (
              <small
                id={`${id}-${encodeURIComponent(item.value)}-reason`}
                className="k8k-control-reason"
              >
                {item.disabledReason}
              </small>
            )}
          </div>
        ))}
      </TabsPrimitive.List>
      {items.map((item) => (
        <TabsPrimitive.Content
          key={item.value}
          value={item.value}
          {...(mountPolicy === 'keep-mounted' ? { forceMount: true as const } : {})}
          hidden={value !== item.value}
          className="k8k-tab-panel"
        >
          {item.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
});

export type SegmentedOption = {
  value: string;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
};
export type SegmentedProps = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SegmentedOption[];
  name?: string;
};
export const Segmented = /* @__PURE__ */ forwardRef<HTMLFieldSetElement, SegmentedProps>(
  function Segmented({ label, value, onValueChange, options, name }, ref) {
    const generated = useId();
    return (
      <fieldset ref={ref} className="k8k-segmented">
        <legend>{label}</legend>
        <div className="k8k-segment-options">
          {options.map((option) => {
            const id = `${generated}-${encodeURIComponent(option.value)}`;
            return (
              <label
                key={option.value}
                className="k8k-segment-option"
                data-selected={value === option.value}
              >
                <input
                  type="radio"
                  name={name ?? generated}
                  value={option.value}
                  checked={value === option.value}
                  disabled={option.disabled || false}
                  aria-labelledby={`${id}-label`}
                  aria-describedby={option.disabledReason ? `${id}-reason` : undefined}
                  onChange={() => onValueChange(option.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Home' && event.key !== 'End') return;
                    event.preventDefault();
                    const candidates = [
                      ...(event.currentTarget
                        .closest('fieldset')
                        ?.querySelectorAll<HTMLInputElement>(
                          'input[type="radio"]:not(:disabled)',
                        ) ?? []),
                    ];
                    const target = event.key === 'Home' ? candidates[0] : candidates.at(-1);
                    if (target) {
                      target.focus();
                      if (target.value !== value) onValueChange(target.value);
                    }
                  }}
                />
                <span id={`${id}-label`}>{option.label}</span>
                {option.disabledReason && (
                  <small id={`${id}-reason`} className="k8k-control-reason">
                    {option.disabledReason}
                  </small>
                )}
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  },
);

export type TooltipProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  content: string;
};
export const Tooltip = /* @__PURE__ */ forwardRef<HTMLButtonElement, TooltipProps>(function Tooltip(
  { open, onOpenChange, label, content },
  ref,
) {
  const pointerStart = useRef<boolean | null>(null);
  return (
    <TooltipPrimitive.Provider delayDuration={350}>
      <TooltipPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <TooltipPrimitive.Trigger
          asChild
          onPointerDown={() => {
            pointerStart.current = open;
          }}
          onPointerCancel={() => {
            pointerStart.current = null;
          }}
          onKeyDown={() => {
            pointerStart.current = null;
          }}
          onClick={(event) => {
            event.preventDefault();
            onOpenChange(!(pointerStart.current ?? open));
            pointerStart.current = null;
          }}
        >
          <IconButton ref={ref} label={label} variant="ghost">
            <Icon name="info" />
          </IconButton>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content className="k8k-tooltip" sideOffset={8} collisionPadding={16}>
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
});

export type InformationCardProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  title: ReactNode;
  value?: ReactNode;
  unit?: ReactNode;
  source: ReactNode;
  period: ReactNode;
  action?: ReactNode;
  state: BoundaryState;
  stateText: string;
};
function InformationCard({
  title,
  value,
  unit,
  source,
  period,
  action,
  state,
  stateText,
  className = '',
  ...props
}: InformationCardProps) {
  const denied = state.status === 'forbidden' || state.status === 'session-expired';
  const showValue = ['ready', 'stale', 'pending', 'subscription-limited'].includes(state.status);
  return (
    <Card
      {...props}
      title={title}
      className={`k8k-information-card ${className}`}
      actions={denied ? undefined : action}
      data-state={state.status}
    >
      {state.status !== 'ready' && (
        <p className="k8k-information-state">
          <Icon name={state.status === 'error' ? 'warning' : 'info'} size={18} />
          {stateText}
        </p>
      )}
      {showValue && value !== undefined && value !== null && (
        <p className="k8k-information-value">
          {value}
          {unit && <span className="k8k-information-unit">{unit}</span>}
        </p>
      )}
      {!denied && (
        <div className="k8k-information-meta">
          <span>{source}</span>
          <span>{period}</span>
        </div>
      )}
    </Card>
  );
}
export function HeroCard(props: InformationCardProps) {
  return <InformationCard {...props} className={`k8k-hero-card ${props.className ?? ''}`} />;
}
export function StatTile(props: InformationCardProps) {
  return <InformationCard {...props} className={`k8k-stat-tile ${props.className ?? ''}`} />;
}

type ToastBase = { id: string; message: string };
export type ToastMessage = ToastBase &
  (
    | { outcome: 'confirmed'; tone: 'success' | 'info' }
    | { outcome: 'queued'; tone: 'info' }
    | { outcome: 'unknown'; tone: 'warning' }
    | { outcome: 'error'; tone: 'error' }
  );
export type ToastProps = {
  items: readonly ToastMessage[];
  onDismiss: (id: string) => void;
  label: string;
};
type Announcement = { id: string; text: string };
type LiveMessages = { polite: Announcement[]; assertive: Announcement[] };
const outcomeKeys = {
  confirmed: 'toastConfirmed',
  queued: 'toastQueued',
  error: 'toastError',
  unknown: 'toastUnknown',
} as const;
function retainLive(previous: Announcement[], fresh: Announcement[], active: Set<string>) {
  if (fresh.length) return fresh;
  return previous.every((item) => active.has(item.id))
    ? previous
    : previous.filter((item) => active.has(item.id));
}
function toastTone(item: ToastMessage) {
  return item.outcome === 'error'
    ? 'error'
    : item.outcome === 'unknown'
      ? 'warning'
      : item.outcome === 'confirmed' && item.tone === 'success'
        ? 'success'
        : 'info';
}
/** Actor-scoped controlled presentation. IDs are immutable events, never read/claim/resolve commands. */
export function Toast({ items, onDismiss, label }: ToastProps) {
  const { t } = useLocale();
  const seen = useRef(new Set<string>());
  const [live, setLive] = useState<LiveMessages>({ polite: [], assertive: [] });
  const unique = useMemo(() => {
    const byId = new Map<string, ToastMessage>();
    for (const item of items) if (item.id && !byId.has(item.id)) byId.set(item.id, item);
    return [...byId.values()];
  }, [items]);
  useEffect(() => {
    const active = new Set(unique.map((item) => item.id));
    const fresh: LiveMessages = { polite: [], assertive: [] };
    for (const item of unique) {
      if (seen.current.has(item.id)) continue;
      seen.current.add(item.id);
      fresh[item.outcome === 'error' ? 'assertive' : 'polite'].push({
        id: item.id,
        text: `${t(outcomeKeys[item.outcome])}. ${item.message}`,
      });
    }
    setLive((previous) => {
      const polite = retainLive(previous.polite, fresh.polite, active);
      const assertive = retainLive(previous.assertive, fresh.assertive, active);
      return polite === previous.polite && assertive === previous.assertive
        ? previous
        : { polite, assertive };
    });
  }, [unique, t]);
  return (
    <section className="k8k-toasts" aria-label={label}>
      <div className="k8k-sr-only" aria-live="polite" aria-atomic="true" data-toast-live="polite">
        {live.polite.map((item) => (
          <span key={item.id}>{item.text} </span>
        ))}
      </div>
      <div
        className="k8k-sr-only"
        aria-live="assertive"
        aria-atomic="true"
        data-toast-live="assertive"
      >
        {live.assertive.map((item) => (
          <span key={item.id}>{item.text} </span>
        ))}
      </div>
      <ul className="k8k-toast-list">
        {unique.map((item) => (
          <li
            key={item.id}
            className={`k8k-toast k8k-toast-${toastTone(item)}`}
            data-toast-id={item.id}
            data-outcome={item.outcome}
            data-tone={toastTone(item)}
          >
            <Icon
              name={
                toastTone(item) === 'success'
                  ? 'check'
                  : toastTone(item) === 'info'
                    ? 'info'
                    : 'warning'
              }
            />
            <div>
              <strong>{t(outcomeKeys[item.outcome])}</strong>
              <p>{item.message}</p>
            </div>
            <IconButton
              variant="ghost"
              label={`${t('dismissToast')}: ${t(outcomeKeys[item.outcome])}`}
              onClick={() => onDismiss(item.id)}
            >
              <Icon name="close" />
            </IconButton>
          </li>
        ))}
      </ul>
    </section>
  );
}

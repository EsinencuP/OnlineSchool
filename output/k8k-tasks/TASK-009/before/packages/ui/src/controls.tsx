import { forwardRef, useId } from 'react';
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';
import { Icon } from './icon.js';
import { useLocale } from './locale.js';
export type ControlDensity = 'comfortable' | 'compact';
function descriptionIds(...values: (string | undefined)[]) {
  return (
    [...new Set(values.flatMap((value) => value?.trim().split(/\s+/u) ?? []).filter(Boolean))].join(
      ' ',
    ) || undefined
  );
}
export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  pending?: boolean;
  density?: ControlDensity;
  disabledReason?: ReactNode;
};
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    pending = false,
    density = 'comfortable',
    disabledReason,
    disabled,
    children,
    className = '',
    type = 'button',
    'aria-describedby': describedBy,
    ...props
  },
  ref,
) {
  const generated = useId();
  const reasonId = `${generated}-reason`;
  const showReason = !!(disabled || pending) && !!disabledReason;
  return (
    <>
      <button
        {...props}
        ref={ref}
        type={type}
        className={`k8k-button k8k-button-${variant} k8k-control-${density} ${className}`}
        disabled={disabled || pending}
        aria-busy={pending || props['aria-busy']}
        aria-describedby={descriptionIds(describedBy, showReason ? reasonId : undefined)}
      >
        {pending && <Icon name="clock" size={18} />}
        {children}
      </button>
      {showReason && (
        <span className="k8k-control-reason" id={reasonId}>
          {disabledReason}
        </span>
      )}
    </>
  );
});
export type IconButtonProps = Omit<ButtonProps, 'aria-label'> & { label: string };
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, children, className = '', ...props },
  ref,
) {
  return (
    <Button {...props} ref={ref} className={`k8k-icon-button ${className}`} aria-label={label}>
      {children}
    </Button>
  );
});
type FieldPresentation = {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  pending?: boolean;
  density?: ControlDensity;
  containerClassName?: string;
};
function FieldMessages({
  id,
  hint,
  error,
}: {
  id: string;
  hint: string | undefined;
  error: string | undefined;
}) {
  return (
    <>
      {hint && (
        <p className="k8k-field-hint" id={error ? `${id}-hint` : `${id}-description`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="k8k-field-error" id={`${id}-description`} role="alert">
          <Icon name="warning" size={18} />
          {error}
        </p>
      )}
    </>
  );
}
function fieldDescriptions(
  id: string,
  hint: string | undefined,
  error: string | undefined,
  external: string | undefined,
) {
  return descriptionIds(
    external,
    hint ? (error ? `${id}-hint` : `${id}-description`) : undefined,
    error ? `${id}-description` : undefined,
  );
}
export type FieldProps = InputHTMLAttributes<HTMLInputElement> & FieldPresentation;
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  {
    label,
    error,
    hint,
    id,
    pending = false,
    density = 'comfortable',
    containerClassName = '',
    disabled,
    ...props
  },
  ref,
) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <div className={`k8k-field k8k-control-${density} ${containerClassName}`}>
      <label htmlFor={fieldId}>{label}</label>
      <input
        {...props}
        ref={ref}
        id={fieldId}
        disabled={disabled || pending}
        aria-busy={pending || props['aria-busy']}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={fieldDescriptions(fieldId, hint, error, props['aria-describedby'])}
      />
      <FieldMessages id={fieldId} hint={hint} error={error} />
    </div>
  );
});
export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & FieldPresentation;
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  {
    label,
    error,
    hint,
    id,
    pending = false,
    density = 'comfortable',
    containerClassName = '',
    disabled,
    children,
    ...props
  },
  ref,
) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <div className={`k8k-field k8k-control-${density} ${containerClassName}`}>
      <label htmlFor={fieldId}>{label}</label>
      <select
        {...props}
        ref={ref}
        id={fieldId}
        disabled={disabled || pending}
        aria-busy={pending || props['aria-busy']}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={fieldDescriptions(fieldId, hint, error, props['aria-describedby'])}
      >
        {children}
      </select>
      <FieldMessages id={fieldId} hint={hint} error={error} />
    </div>
  );
});
export type StatusTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral';
export type StatusChipProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: StatusTone;
  children: ReactNode;
  unknownLabel?: string;
};
const knownTones = new Set<StatusTone>(['info', 'success', 'warning', 'danger', 'neutral']);
export function StatusChip({
  tone = 'info',
  children,
  unknownLabel,
  className = '',
  ...props
}: StatusChipProps) {
  const { t } = useLocale();
  const known =
    knownTones.has(tone) &&
    children !== undefined &&
    children !== null &&
    children !== false &&
    !(typeof children === 'string' && !children.trim());
  const safeTone = known ? tone : 'neutral';
  return (
    <span {...props} className={`k8k-status-chip k8k-status-${safeTone} ${className}`}>
      <Icon
        name={
          safeTone === 'success'
            ? 'check'
            : safeTone === 'warning' || safeTone === 'danger'
              ? 'warning'
              : 'info'
        }
      />
      {known ? children : unknownLabel?.trim() || t('unknownStatus')}
    </span>
  );
}
export type AvatarProps = Omit<
  HTMLAttributes<HTMLSpanElement>,
  'children' | 'aria-label' | 'role'
> & { name: string; unknownLabel?: string };
export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(function Avatar(
  { name, unknownLabel, className = '', ...props },
  ref,
) {
  const { t } = useLocale();
  const segments = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const initials = name
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => segments.segment(part)[Symbol.iterator]().next().value?.segment ?? '')
    .join('');
  return (
    <span
      {...props}
      ref={ref}
      className={`k8k-avatar ${className}`}
      role="img"
      aria-label={name.trim() || unknownLabel?.trim() || t('unknownPerson')}
    >
      {initials || '—'}
    </span>
  );
});
export type CardProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  title: ReactNode;
  children: ReactNode;
  headingLevel?: 2 | 3 | 4;
  description?: ReactNode;
  actions?: ReactNode;
};
export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  { title, children, headingLevel = 2, description, actions, className = '', id, ...props },
  ref,
) {
  const generated = useId();
  const headingId = `${id ?? generated}-title`;
  const Heading = headingLevel === 2 ? 'h2' : headingLevel === 3 ? 'h3' : 'h4';
  return (
    <section
      {...props}
      ref={ref}
      id={id}
      className={`k8k-card ${className}`}
      aria-labelledby={props['aria-labelledby'] ?? (props['aria-label'] ? undefined : headingId)}
    >
      <div className="k8k-card-heading">
        <Heading id={headingId}>{title}</Heading>
        {actions && <div className="k8k-card-actions">{actions}</div>}
      </div>
      {description && <p className="k8k-card-description">{description}</p>}
      {children}
    </section>
  );
});

import { forwardRef, useId } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { Icon } from './icon.js';
export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    pending?: boolean;
  }
>(function Button(
  {
    variant = 'primary',
    pending = false,
    disabled,
    children,
    className = '',
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={`k8k-button k8k-button-${variant} ${className}`}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
    >
      {children}
    </button>
  );
});
export function IconButton({
  label,
  children,
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & { label: string }) {
  return (
    <Button {...props} aria-label={label}>
      {children}
    </Button>
  );
}
export const Field = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }
>(function Field({ label, error, hint, id, ...props }, ref) {
  const generated = useId();
  const fieldId = id ?? generated;
  const descriptionId = `${fieldId}-description`;
  return (
    <div className="k8k-field">
      <label htmlFor={fieldId}>{label}</label>
      <input
        {...props}
        ref={ref}
        id={fieldId}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={
          [props['aria-describedby'], error || hint ? descriptionId : undefined]
            .filter(Boolean)
            .join(' ') || undefined
        }
      />
      {(error || hint) && (
        <p id={descriptionId} role={error ? 'alert' : undefined}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
});
export function StatusChip({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  children: ReactNode;
}) {
  return (
    <span className={`k8k-status-chip k8k-status-${tone}`}>
      <Icon name={tone === 'success' ? 'check' : 'info'} />
      {children}
    </span>
  );
}
export function Avatar({ name }: { name: string }) {
  const initials = name
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => Array.from(part)[0])
    .join('');
  return (
    <span className="k8k-avatar" aria-label={name}>
      {initials}
    </span>
  );
}
export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="k8k-card">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

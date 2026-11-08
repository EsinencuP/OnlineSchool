import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { FormHTMLAttributes, FormEvent, ReactNode } from 'react';
import { describeError, errorText } from './errors.js';
import { useLocale } from './locale.js';
import type { PlainMessageKey } from './messages.js';
import { formatMoneyAmount } from './money-format.js';
import { Icon } from './icon.js';

export function ErrorFeedback({
  error,
  retryRead,
  amount,
}: {
  error: unknown;
  retryRead?: () => void;
  amount?: { value: string; currency: string } | undefined;
}) {
  const { locale, t } = useLocale();
  if (!error) return null;
  const view = describeError(error);
  const money = amount && formatMoneyAmount(amount.value, amount.currency, locale);
  return (
    <div role="alert" data-outcome={view.outcome} className="k8k-error-feedback">
      <p>
        <Icon name="warning" size={18} /> {errorText(error, locale)}
      </p>
      {money && <p>{t('errors.submittedAmount', { amount: money })}</p>}
      {view.nextAction === 'reconcile' && view.outcome !== 'unknown' && (
        <p>{t('errors.reconcile')}</p>
      )}
      {retryRead && view.nextAction === 'retry-read' && (
        <button type="button" onClick={retryRead}>
          {t('retry')}
        </button>
      )}
    </div>
  );
}

const Feedback = createContext<(name: string | undefined) => string | undefined>(() => undefined);
export function useFieldError(name: string | undefined) {
  return useContext(Feedback)(name);
}
function nativeMessage(
  input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
): PlainMessageKey {
  if (input.validity.valueMissing) return 'errors.required';
  if (
    input.validity.typeMismatch &&
    input instanceof globalThis.HTMLInputElement &&
    input.type === 'email'
  )
    return 'errors.email';
  return 'errors.field';
}

export function ErrorForm({
  error,
  busy = false,
  children,
  onSubmit,
  onInvalidCapture,
  onChange,
  ...props
}: FormHTMLAttributes<HTMLFormElement> & { error: unknown; children: ReactNode; busy?: boolean }) {
  const { locale, t } = useLocale();
  const form = useRef<HTMLFormElement>(null);
  const [invalid, setInvalid] = useState<Record<string, PlainMessageKey>>({});
  const [edited, setEdited] = useState<ReadonlySet<string>>(new Set());
  const view = describeError(error);
  useEffect(() => {
    if (busy) return;
    setEdited(new Set());
    if (!error) return;
    const controls = form.current?.querySelectorAll<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >('[name]');
    [...(controls ?? [])]
      .find((input) => describeError(error).fields.includes(input.name))
      ?.focus();
  }, [error, busy]);
  function input(event: FormEvent<HTMLFormElement>) {
    onChange?.(event);
    const target = event.target;
    if (!(
      target instanceof globalThis.HTMLInputElement ||
      target instanceof globalThis.HTMLTextAreaElement ||
      target instanceof globalThis.HTMLSelectElement
    ))
      return;
    setEdited((current) => new Set([...current, target.name]));
    setInvalid((current) => {
      const next = { ...current };
      delete next[target.name];
      return next;
    });
  }
  const fieldMessage = (name: string | undefined) => {
    if (!name) return undefined;
    const local = invalid[name];
    if (local) return t(local);
    return error && !edited.has(name) && view.fields.includes(name)
      ? errorText(error, locale)
      : undefined;
  };
  return (
    <Feedback.Provider value={fieldMessage}>
      <form
        {...props}
        ref={form}
        onChange={input}
        onInvalidCapture={(event) => {
          onInvalidCapture?.(event);
          const target = event.target;
          if (!(
            target instanceof globalThis.HTMLInputElement ||
            target instanceof globalThis.HTMLTextAreaElement ||
            target instanceof globalThis.HTMLSelectElement
          ))
            return;
          event.preventDefault();
          setInvalid((current) => ({ ...current, [target.name]: nativeMessage(target) }));
          form.current
            ?.querySelector<HTMLElement>('input:invalid, select:invalid, textarea:invalid')
            ?.focus();
        }}
        onSubmit={(event) => {
          if (error && describeError(error, 'write').outcome === 'unknown') {
            event.preventDefault();
            return;
          }
          onSubmit?.(event);
        }}
      >
        {children}
      </form>
    </Feedback.Provider>
  );
}

import { useEffect, useId, useRef } from 'react';
import type { ReactNode, FormEvent } from 'react';
import type { ApiErrorView } from '../api/error-view.js';
import { label, ru } from '../i18n/ru.js';
import {
  k8kEnabled,
  queryBoundaryState,
  StateBoundary,
  useDataAge,
  useLocale,
  ErrorFeedback,
  ErrorForm,
  describeError,
  errorText,
  useFieldError,
} from '@online-school/ui';

export type ScreenState<T> =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error'; error: ApiErrorView }
  | { status: 'ready'; data: T };
export function ErrorBox({ error, retry }: { error: ApiErrorView | null; retry?: () => void }) {
  return <ErrorFeedback error={error} {...(retry ? { retryRead: retry } : {})} />;
}

export function State<T>({
  query,
  asOf,
  empty = false,
  operational = false,
  children,
}: {
  query: {
    isPending: boolean;
    error: Error | ApiErrorView | null;
    refetch: () => unknown;
    data: T | undefined;
    dataUpdatedAt?: number;
    isFetching?: boolean;
  };
  empty?: boolean;
  asOf?: string | undefined;
  operational?: boolean;
  children: (data: T) => ReactNode;
}) {
  const tooOld = useDataAge(query.dataUpdatedAt, operational ? 120_000 : false);
  const { locale, t } = useLocale();
  const errorStatus =
    query.error && 'status' in query.error && typeof query.error.status === 'number'
      ? query.error.status
      : undefined;
  if (k8kEnabled) {
    const error = query.error && 'code' in query.error ? query.error : null;
    const state = queryBoundaryState({
      isPending: query.isPending,
      hasData: query.data !== undefined,
      error: !!query.error,
      errorStatus,
      empty,
      tooOld,
    });
    return (
      <StateBoundary
        state={
          state.status === 'error' && error
            ? { status: 'error', message: errorText(error, locale) }
            : state
        }
        asOf={asOf}
        receivedAt={query.dataUpdatedAt}
        refreshing={query.isFetching ?? false}
        retryRead={() => void query.refetch()}
      >
        {query.data !== undefined ? children(query.data) : null}
      </StateBoundary>
    );
  }
  if (query.isPending)
    return (
      <p role="status" className="state">
        {t('loading')}
      </p>
    );
  const error = query.error
    ? 'code' in query.error
      ? query.error
      : { code: 'UNKNOWN', status: 0, message: ru.error }
    : null;
  if (errorStatus === 401 || errorStatus === 403)
    return (
      <StateBoundary state={{ status: errorStatus === 401 ? 'session-expired' : 'forbidden' }} />
    );
  if (error && !query.data)
    return (
      <ErrorBox
        error={error}
        retry={() => {
          void query.refetch();
        }}
      />
    );
  if (!query.data || empty) return <p className="state">{t('empty')}</p>;
  return (
    <>
      <ErrorBox
        error={error}
        retry={() => {
          void query.refetch();
        }}
      />
      {children(query.data)}
    </>
  );
}
export function Badge({ value }: { value: string }) {
  return <span className={`badge status-${value.toLowerCase()}`}>{label(value)}</span>;
}
export function Field({
  label: text,
  children,
  hint,
}: {
  label: string;
  children: (id: string, hintId: string | undefined) => ReactNode;
  hint?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{text}</label>
      {children(id, hintId)}
      {hint && <small id={hintId}>{hint}</small>}
    </div>
  );
}
function errorIds(...values: (string | undefined)[]) {
  return values.filter(Boolean).join(' ') || undefined;
}
export function Input({
  name,
  label: text,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { name: string; label: string; hint?: string }) {
  const error = useFieldError(name);
  return (
    <Field label={text} {...(hint ? { hint } : {})}>
      {(id, hintId) => (
        <>
          <input
            id={id}
            name={name}
            {...props}
            aria-invalid={!!error || props['aria-invalid']}
            aria-describedby={errorIds(
              hintId,
              props['aria-describedby'],
              error ? `${id}-error` : undefined,
            )}
          />
          {error && (
            <p role="alert" id={`${id}-error`}>
              {error}
            </p>
          )}
        </>
      )}
    </Field>
  );
}
export function TextArea({
  name,
  label: text,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { name: string; label: string }) {
  const error = useFieldError(name);
  return (
    <Field label={text}>
      {(id) => (
        <>
          <textarea
            id={id}
            name={name}
            {...props}
            aria-invalid={!!error || props['aria-invalid']}
            aria-describedby={errorIds(
              props['aria-describedby'],
              error ? `${id}-error` : undefined,
            )}
          />
          {error && (
            <p role="alert" id={`${id}-error`}>
              {error}
            </p>
          )}
        </>
      )}
    </Field>
  );
}
export function Select({
  name,
  label: text,
  options,
  placeholder = true,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  name: string;
  label: string;
  options: ReadonlyArray<{ id: string; label: string }>;
  placeholder?: boolean;
}) {
  const error = useFieldError(name);
  const { t } = useLocale();
  return (
    <Field label={text}>
      {(id) => (
        <>
          <select
            id={id}
            name={name}
            {...props}
            aria-invalid={!!error || props['aria-invalid']}
            aria-describedby={errorIds(
              props['aria-describedby'],
              error ? `${id}-error` : undefined,
            )}
          >
            {placeholder && <option value="">{t('errors.choose')}</option>}
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          {error && (
            <p role="alert" id={`${id}-error`}>
              {error}
            </p>
          )}
        </>
      )}
    </Field>
  );
}
export function Check({
  name,
  label: text,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { name: string; label: string }) {
  const id = useId();
  const error = useFieldError(name);
  return (
    <div>
      <label className="check" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          name={name}
          {...props}
          aria-invalid={!!error || props['aria-invalid']}
          aria-describedby={errorIds(props['aria-describedby'], error ? `${id}-error` : undefined)}
        />
        <span>{text}</span>
      </label>
      {error && (
        <p role="alert" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
export function Dialog({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const { t } = useLocale();
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.showModal();
    return () => {
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === ref.current) close();
      }}
    >
      <div className="dialog-head">
        <h2 id={id}>{title}</h2>
        <button type="button" onClick={close} aria-label={t('closeOverlay')}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Conflict({
  error,
  reload,
}: {
  error: ApiErrorView | null;
  reload?: () => Promise<unknown>;
}) {
  const { t } = useLocale();
  const visible =
    error?.status === 409 && ['VERSION_CONFLICT', 'TASK_VERSION_CONFLICT'].includes(error.code);
  return visible && reload ? (
    <Dialog
      title={t('errors.conflict')}
      close={() => {
        void reload();
      }}
    >
      <p>{t('errors.conflict')}</p>
      <button
        type="button"
        onClick={() => {
          void reload();
        }}
      >
        {t('errors.reload')}
      </button>
    </Dialog>
  ) : null;
}
export function FormShell({
  children,
  busy,
  error,
  submit,
  button,
  reload,
  amount,
}: {
  children: ReactNode;
  busy: boolean;
  error: ApiErrorView | null;
  submit: (data: FormData) => Promise<unknown>;
  button?: string;
  reload?: () => Promise<unknown>;
  amount?: { value: string; currency: string } | undefined;
}) {
  const { t } = useLocale();
  const unresolved = !!error && describeError(error, 'write').outcome === 'unknown';
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!busy && !unresolved) await submit(new FormData(event.currentTarget));
  }
  return (
    <ErrorForm
      error={error}
      busy={busy}
      onSubmit={(event) => {
        void onSubmit(event);
      }}
    >
      <fieldset disabled={busy}>
        {children}
        <ErrorFeedback error={error} amount={amount} />
        <div className="actions">
          <button className="primary" type="submit" disabled={busy || unresolved}>
            {busy ? t('loading') : (button ?? t('errors.save'))}
          </button>
        </div>
      </fieldset>
      <Conflict error={error} {...(reload ? { reload } : {})} />
    </ErrorForm>
  );
}
export const text = (data: FormData, name: string) => String(data.get(name) ?? '').trim();
export const enumOptions = (values: ReadonlyArray<string>) =>
  values.map((id) => ({ id, label: label(id) }));

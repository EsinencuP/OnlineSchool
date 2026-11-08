import { useEffect, useId, useRef } from 'react';
import type { ReactNode, FormEvent } from 'react';
import type { ApiErrorView } from '../api/error-view.js';
import { label, ru } from '../i18n/ru.js';
import { k8kEnabled, queryBoundaryState, StateBoundary, useDataAge } from '@online-school/ui';

export type ScreenState<T> =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error'; error: ApiErrorView }
  | { status: 'ready'; data: T };
export function ErrorBox({ error, retry }: { error: ApiErrorView | null; retry?: () => void }) {
  return error ? (
    <div className="error-box" role="alert">
      <p>{error.message}</p>
      {error.requestId && (
        <small>
          {ru.requestId}: {error.requestId}
        </small>
      )}
      {retry && (
        <button type="button" onClick={retry}>
          {ru.retry}
        </button>
      )}
    </div>
  ) : null;
}
export function State<T>({
  query,
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
  operational?: boolean;
  children: (data: T) => ReactNode;
}) {
  const tooOld = useDataAge(query.dataUpdatedAt, operational ? 120_000 : false);
  if (k8kEnabled) {
    const error = query.error && 'code' in query.error ? query.error : null;
    const state = queryBoundaryState({
      isPending: query.isPending,
      hasData: query.data !== undefined,
      error: !!query.error,
      errorStatus: error?.status,
      empty,
      tooOld,
    });
    return (
      <StateBoundary
        state={
          state.status === 'error' && error ? { status: 'error', message: error.message } : state
        }
        at={query.dataUpdatedAt}
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
        {ru.loading}
      </p>
    );
  const error = query.error
    ? 'code' in query.error
      ? query.error
      : { code: 'UNKNOWN', status: 0, message: ru.error }
    : null;
  if (error && !query.data)
    return (
      <ErrorBox
        error={error}
        retry={() => {
          void query.refetch();
        }}
      />
    );
  if (!query.data || empty) return <p className="state">{ru.empty}</p>;
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
export function Input({
  name,
  label: text,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { name: string; label: string; hint?: string }) {
  return (
    <Field label={text} {...(hint ? { hint } : {})}>
      {(id, hintId) => <input id={id} name={name} aria-describedby={hintId} {...props} />}
    </Field>
  );
}
export function TextArea({
  name,
  label: text,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { name: string; label: string }) {
  return <Field label={text}>{(id) => <textarea id={id} name={name} {...props} />}</Field>;
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
  return (
    <Field label={text}>
      {(id) => (
        <select id={id} name={name} {...props}>
          {placeholder && <option value="">{ru.choose}</option>}
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
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
  return (
    <label className="check" htmlFor={id}>
      <input id={id} type="checkbox" name={name} {...props} />
      <span>{text}</span>
    </label>
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
        <button type="button" onClick={close} aria-label={ru.close}>
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
  const visible =
    error?.status === 409 && ['VERSION_CONFLICT', 'TASK_VERSION_CONFLICT'].includes(error.code);
  return visible && reload ? (
    <Dialog
      title={ru.conflictTitle}
      close={() => {
        void reload();
      }}
    >
      <p>{ru.conflictHelp}</p>
      <button
        type="button"
        onClick={() => {
          void reload();
        }}
      >
        {ru.reloadVersion}
      </button>
    </Dialog>
  ) : null;
}
export function FormShell({
  children,
  busy,
  error,
  submit,
  button = ru.save,
  reload,
}: {
  children: ReactNode;
  busy: boolean;
  error: ApiErrorView | null;
  submit: (data: FormData) => Promise<unknown>;
  button?: string;
  reload?: () => Promise<unknown>;
}) {
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!busy) await submit(new FormData(event.currentTarget));
  }
  return (
    <form
      onSubmit={(event) => {
        void onSubmit(event);
      }}
    >
      <fieldset disabled={busy}>
        {children}
        <ErrorBox error={error} />
        <div className="actions">
          <button className="primary" type="submit" disabled={busy}>
            {busy ? ru.loading : button}
          </button>
        </div>
      </fieldset>
      <Conflict error={error} {...(reload ? { reload } : {})} />
    </form>
  );
}
export const text = (data: FormData, name: string) => String(data.get(name) ?? '').trim();
export const enumOptions = (values: ReadonlyArray<string>) =>
  values.map((id) => ({ id, label: label(id) }));

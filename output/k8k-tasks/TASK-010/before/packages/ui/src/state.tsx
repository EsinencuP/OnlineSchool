import { useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { FreshnessLabel } from './freshness.js';

export type BoundaryState =
  | { status: 'loading' }
  | { status: 'empty'; message?: string }
  | { status: 'ready' }
  | { status: 'stale'; message?: string }
  | { status: 'error'; message?: string }
  | { status: 'pending'; outcome: 'pending' | 'unknown' }
  | { status: 'forbidden' }
  | { status: 'subscription-limited'; message: string }
  | { status: 'session-expired' };

// Render-only classification. Existing API/session handling retains ownership of redirects.
export function queryBoundaryState({
  isPending,
  hasData,
  errorStatus,
  error,
  empty = false,
  tooOld = false,
}: {
  isPending: boolean;
  hasData: boolean;
  error?: boolean;
  errorStatus?: number | undefined;
  empty?: boolean;
  tooOld?: boolean;
}): BoundaryState {
  if (errorStatus === 401) return { status: 'session-expired' };
  if (errorStatus === 403) return { status: 'forbidden' };
  if (isPending && !hasData) return { status: 'loading' };
  if (error && !hasData) return { status: 'error' };
  if (hasData && (error || tooOld)) return { status: 'stale' };
  if (!hasData || empty) return { status: 'empty' };
  return { status: 'ready' };
}

const networkSubscribers = new Set<() => void>();
function notifyNetwork() {
  networkSubscribers.forEach((notify) => notify());
}
function subscribeNetwork(notify: () => void) {
  if (networkSubscribers.size === 0) {
    globalThis.addEventListener('online', notifyNetwork);
    globalThis.addEventListener('offline', notifyNetwork);
  }
  networkSubscribers.add(notify);
  return () => {
    networkSubscribers.delete(notify);
    if (networkSubscribers.size === 0) {
      globalThis.removeEventListener('online', notifyNetwork);
      globalThis.removeEventListener('offline', notifyNetwork);
    }
  };
}
const getOffline = () => globalThis.navigator?.onLine === false;
export function useDataAge(at: number | undefined, maxAgeMs: number | false = false) {
  const [now, setNow] = useState(Date.now);
  const offline = useSyncExternalStore(subscribeNetwork, getOffline, () => false);
  useEffect(() => {
    const delay = at && maxAgeMs !== false ? Math.max(0, at + maxAgeMs - Date.now()) : undefined;
    const timer =
      delay !== undefined ? globalThis.setTimeout(() => setNow(Date.now()), delay + 1) : undefined;
    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [at, maxAgeMs]);
  return offline || !!(at && maxAgeMs !== false && Math.max(now, Date.now()) - at >= maxAgeMs);
}

export function StateBoundary({
  state,
  children,
  at,
  timeZone,
  refreshing = false,
  retryRead,
  action,
}: {
  state: BoundaryState;
  children?: ReactNode;
  at?: number | undefined;
  timeZone?: string | undefined;
  refreshing?: boolean;
  retryRead?: (() => void) | undefined;
  action?: ReactNode;
}) {
  const { status } = state;
  const showData =
    status === 'ready' ||
    status === 'stale' ||
    status === 'pending' ||
    status === 'subscription-limited';
  const text =
    status === 'loading'
      ? 'Загружаем данные…'
      : status === 'empty'
        ? (state.message ?? 'Пока нет данных для этого раздела.')
        : status === 'stale'
          ? (state.message ??
            'Данные могли устареть. Проверяйте актуальный статус перед действием.')
          : status === 'error'
            ? (state.message ??
              'Не удалось загрузить данные. Проверьте соединение и повторите чтение.')
            : status === 'pending'
              ? state.outcome === 'unknown'
                ? 'Результат действия пока неизвестен. Проверьте его в исходном объекте, прежде чем повторять.'
                : 'Ожидаем ответ сервера. Действие ещё не подтверждено.'
              : status === 'forbidden'
                ? 'Этот раздел недоступен для текущего аккаунта.'
                : status === 'subscription-limited'
                  ? state.message
                  : status === 'session-expired'
                    ? 'Сессия завершена. Войдите снова, чтобы продолжить.'
                    : '';
  return (
    <div className="k8k-state" data-state={status}>
      <div
        className="k8k-state-message"
        role={
          status === 'error' || status === 'forbidden' || status === 'session-expired'
            ? 'alert'
            : 'status'
        }
      >
        {text && <p>{text}</p>}
        {(status === 'stale' || status === 'error') && retryRead && (
          <button type="button" onClick={retryRead}>
            Повторить загрузку
          </button>
        )}
        {status !== 'ready' && status !== 'loading' && action}
      </div>
      <div className="k8k-state-meta">
        {showData && (
          <FreshnessLabel at={at} {...(timeZone ? { timeZone } : {})} refreshing={refreshing} />
        )}
      </div>
      <div
        className="k8k-state-data"
        aria-busy={
          status === 'loading' ||
          (status === 'pending' && state.outcome === 'pending') ||
          refreshing
        }
      >
        {showData ? children : null}
      </div>
    </div>
  );
}

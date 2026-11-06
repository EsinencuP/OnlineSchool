import { useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { FreshnessLabel } from './freshness.js';
import type { FreshnessSourceProps } from './freshness.js';
import { Icon } from './icon.js';
import type { IconName } from './icon.js';
import { useLocale } from './locale.js';

export type BoundaryState =
  | { status: 'loading' }
  | { status: 'empty'; message?: string }
  | { status: 'ready' }
  | { status: 'stale'; message?: string; empty?: true }
  | { status: 'error'; message?: string }
  | { status: 'pending'; outcome: 'pending' | 'unknown' }
  | { status: 'forbidden' }
  | { status: 'subscription-limited'; message?: string }
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
  if (hasData && (error || tooOld))
    return empty ? { status: 'stale', empty: true } : { status: 'stale' };
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

type NoticeProps = { message?: string | undefined };
type ReadNoticeProps = NoticeProps & { retryRead?: (() => void) | undefined; refreshing?: boolean };

function Notice({
  text,
  icon,
  urgent = false,
}: {
  text: string;
  icon: IconName;
  urgent?: boolean;
}) {
  return (
    <p className="k8k-state-notice" role={urgent ? 'alert' : 'status'}>
      <Icon name={icon} size={18} />
      {text}
    </p>
  );
}
function ReadRetry({ retryRead, refreshing }: ReadNoticeProps) {
  const { t } = useLocale();
  return retryRead ? (
    <button
      type="button"
      aria-disabled={refreshing || undefined}
      onClick={() => {
        if (!refreshing) retryRead();
      }}
    >
      {t('retry')}
    </button>
  ) : null;
}
export function Skeleton({ lines = 3 }: { lines?: 1 | 2 | 3 }) {
  return (
    <div className="k8k-skeleton" aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} />
      ))}
    </div>
  );
}
export function EmptyState({ message }: NoticeProps) {
  const { t } = useLocale();
  return <Notice icon="info" text={message ?? t('empty')} />;
}
export function ErrorState({ message, retryRead, refreshing = false }: ReadNoticeProps) {
  const { t } = useLocale();
  return (
    <>
      <Notice icon="warning" text={message ?? t('error')} urgent />
      <ReadRetry retryRead={retryRead} refreshing={refreshing} />
    </>
  );
}
export function StaleBanner({
  message,
  empty,
  retryRead,
  refreshing = false,
}: ReadNoticeProps & { empty?: boolean | undefined }) {
  const { t } = useLocale();
  return (
    <>
      <Notice icon="warning" text={message ?? t(empty ? 'staleEmpty' : 'stale')} />
      <ReadRetry retryRead={retryRead} refreshing={refreshing} />
    </>
  );
}

export function StateBoundary({
  state,
  children,
  at,
  asOf,
  receivedAt,
  timeZone,
  refreshing = false,
  retryRead,
  action,
}: FreshnessSourceProps & {
  state: BoundaryState;
  children?: ReactNode;
  timeZone?: string | undefined;
  refreshing?: boolean;
  retryRead?: (() => void) | undefined;
  action?: ReactNode;
}) {
  const { t } = useLocale();
  const { status } = state;
  const showData =
    status === 'ready' ||
    status === 'stale' ||
    status === 'pending' ||
    status === 'subscription-limited';
  let notice: ReactNode = null;
  switch (state.status) {
    case 'loading':
      notice = (
        <>
          <Notice icon="clock" text={t('loading')} />
          <Skeleton />
        </>
      );
      break;
    case 'empty':
      notice = <EmptyState message={state.message} />;
      break;
    case 'error':
      notice = <ErrorState message={state.message} retryRead={retryRead} refreshing={refreshing} />;
      break;
    case 'stale':
      notice = (
        <StaleBanner
          message={state.message}
          empty={state.empty}
          retryRead={retryRead}
          refreshing={refreshing}
        />
      );
      break;
    case 'pending':
      notice = (
        <Notice
          icon="clock"
          text={t(state.outcome === 'unknown' ? 'boundaryUnknown' : 'boundaryPending')}
        />
      );
      break;
    case 'forbidden':
      notice = <Notice icon="warning" text={t('forbidden')} urgent />;
      break;
    case 'session-expired':
      notice = <Notice icon="warning" text={t('session')} urgent />;
      break;
    case 'subscription-limited':
      notice = <Notice icon="info" text={state.message ?? t('boundaryLimited')} />;
      break;
  }
  const showAction =
    status === 'empty' ||
    status === 'error' ||
    status === 'stale' ||
    status === 'subscription-limited';
  return (
    <div className="k8k-state" data-state={status}>
      <div className="k8k-state-message">
        {notice}
        {showAction && action}
      </div>
      <div className="k8k-state-meta">
        {(showData || status === 'empty') && (
          <FreshnessLabel
            asOf={asOf}
            receivedAt={receivedAt}
            at={at}
            {...(timeZone ? { timeZone } : {})}
            refreshing={refreshing}
          />
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

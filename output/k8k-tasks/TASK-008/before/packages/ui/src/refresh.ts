import { useEffect, useRef, useState } from 'react';

export type RefreshContext = 'operational' | 'live-lesson' | 'financial' | 'published' | 'history';
// Provisional engineering recommendation behind ui.k8k; these are not domain timers or SLAs.
export const refreshPolicies: Record<RefreshContext, number | false> = {
  operational: 60_000,
  'live-lesson': 15_000,
  financial: false,
  published: false,
  history: false,
};
export function isEditing() {
  if (typeof document === 'undefined') return false;
  return !!(
    globalThis.document.activeElement?.matches(
      'input, textarea, select, [contenteditable="true"]',
    ) || globalThis.document.querySelector('dialog[open], .account-menu[open]')
  );
}
export function operationalQueryInterval(key: readonly unknown[]): number | false {
  const scope = key[0],
    kind = key[1];
  if (scope === 'student' && kind === 'lessons' && key[2] === 'archive' && key[3] !== 'calendar')
    return false;
  const operational =
    scope === 'manager'
      ? ['dashboard', 'tasks', 'leads', 'lead-summary', 'schedule']
      : scope === 'student'
        ? ['dashboard', 'upcoming', 'lessons', 'unread', 'calendar']
        : [];
  return typeof kind === 'string' && operational.includes(kind)
    ? refreshPolicies.operational
    : false;
}

// Used by the staff workspace, which has no QueryClient. Only read callbacks belong here.
export function useContextRefresh({
  enabled,
  context,
  refresh,
}: {
  enabled: boolean;
  context: RefreshContext;
  refresh: () => Promise<unknown>;
}) {
  const callback = useRef(refresh);
  callback.current = refresh;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let disposed = false,
      running = false,
      deferred = false,
      lastStarted = 0;
    const run = () => {
      if (
        disposed ||
        globalThis.document.visibilityState === 'hidden' ||
        !globalThis.navigator.onLine ||
        running
      )
        return;
      if (isEditing()) {
        deferred = true;
        return;
      }
      if (Date.now() - lastStarted < 1000) return;
      lastStarted = Date.now();
      running = true;
      deferred = false;
      void Promise.resolve()
        .then(() => callback.current())
        .then(
          () => {
            if (!disposed) setFailed(false);
          },
          () => {
            if (!disposed) setFailed(true);
          },
        )
        .finally(() => {
          running = false;
        });
    };
    const resumeInput = () => {
      if (deferred) globalThis.queueMicrotask(run);
    };
    const interval = refreshPolicies[context];
    const timer = interval === false ? undefined : globalThis.setInterval(run, interval);
    globalThis.document.addEventListener('visibilitychange', run);
    globalThis.addEventListener('focus', run);
    globalThis.addEventListener('online', run);
    globalThis.document.addEventListener('focusout', resumeInput);
    return () => {
      disposed = true;
      globalThis.clearInterval(timer);
      globalThis.document.removeEventListener('visibilitychange', run);
      globalThis.removeEventListener('focus', run);
      globalThis.removeEventListener('online', run);
      globalThis.document.removeEventListener('focusout', resumeInput);
    };
  }, [enabled, context]);
  return { failed };
}

import { useCallback, useEffect, useRef, useState } from 'react';

export type RefreshContext = 'operational' | 'live-lesson' | 'financial' | 'published' | 'history';
export type RefreshReason = 'background' | 'deadline';
// Provisional K8K defaults, independent of business deadlines.
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
    document.activeElement?.closest(
      'input:not([type="button"]):not([type="submit"]), textarea, select, [contenteditable]:not([contenteditable="false"])',
    ) ||
    document.querySelector(
      'dialog[open], [role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], .account-menu[open], .k8k-notification-menu[open]',
    )
  );
}

const managerReads = ['dashboard', 'tasks', 'leads', 'lead-summary', 'schedule'];
const studentReads = [
  'dashboard',
  'upcoming',
  'lessons',
  'unread',
  'calendar',
  'notifications-preview',
  'notifications',
];
export function operationalQueryInterval(key: readonly unknown[]): number | false {
  const [scope, kind] = key;
  if (typeof kind !== 'string') return false;
  if (scope === 'manager') return managerReads.includes(kind) ? refreshPolicies.operational : false;
  if (scope !== 'student') return false;
  if (kind === 'lesson') return refreshPolicies['live-lesson'];
  if (kind === 'lessons' && key[2] === 'archive' && key[3] !== 'calendar') return false;
  return studentReads.includes(kind) ? refreshPolicies.operational : false;
}

export function isAuthRead(key: readonly unknown[]): boolean {
  return (
    (key[0] === 'manager' || key[0] === 'student') && (key[1] === 'me' || key[1] === 'suspended-me')
  );
}

/** Single owner of automatic reads for a group of disjoint keys. */
export function useContextRefresh({
  enabled,
  context,
  paused = false,
  refresh,
}: {
  enabled: boolean;
  context: RefreshContext;
  paused?: boolean;
  refresh: (reason: RefreshReason) => Promise<unknown>;
}) {
  const latest = useRef({ refresh, paused });
  latest.current = { refresh, paused };
  const requestRef = useRef<(reason: RefreshReason, dueAt?: number) => void>();
  const resumeRef = useRef<() => void>();
  const request = useCallback(
    (reason: RefreshReason = 'background', dueAt?: number) => requestRef.current?.(reason, dueAt),
    [],
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let running = false;
    let deferred: RefreshReason | undefined;
    let deadline: number | undefined;
    let lastStarted = -Infinity;
    let wake: ReturnType<typeof setTimeout> | undefined;

    const run = (reason: RefreshReason, dueAt = performance.now()) => {
      if (disposed) return;
      if (reason === 'deadline' && lastStarted >= dueAt) return;
      if (running || latest.current.paused) {
        if (reason === 'deadline') {
          deferred = reason;
          deadline = dueAt;
        }
        return;
      }
      const editing = isEditing();
      if (editing && !watching) {
        observer.observe(document.body, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['open', 'data-state'],
        });
        watching = true;
      }
      if (document.visibilityState === 'hidden' || navigator.onLine === false || editing) {
        deferred ??= reason;
        if (reason === 'deadline') {
          deferred = reason;
          deadline = dueAt;
        }
        return;
      }
      const intent = deferred === 'deadline' ? deferred : reason;
      const cooldown = 1000 - (performance.now() - lastStarted);
      if (intent !== 'deadline' && cooldown > 0) {
        if (deferred && wake === undefined) {
          wake = globalThis.setTimeout(() => {
            wake = undefined;
            if (deferred) run(deferred);
          }, cooldown);
        }
        return;
      }
      deferred = undefined;
      deadline = undefined;
      observer.disconnect();
      watching = false;
      lastStarted = performance.now();
      running = true;
      void Promise.resolve()
        .then(() => {
          if (!disposed) return latest.current.refresh(intent);
        })
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
          resume();
        });
    };
    const background = () => run('background');
    const resume = () => {
      if (deferred && !disposed)
        globalThis.queueMicrotask(() => {
          if (deferred) run(deferred, deadline);
        });
    };
    requestRef.current = run;
    resumeRef.current = resume;
    const interval = refreshPolicies[context];
    const timer = interval === false ? undefined : globalThis.setInterval(background, interval);
    const observer = new MutationObserver(resume);
    let watching = false;
    document.addEventListener('visibilitychange', background);
    globalThis.addEventListener('focus', background);
    globalThis.addEventListener('online', background);
    document.addEventListener('focusout', resume);
    return () => {
      disposed = true;
      requestRef.current = undefined;
      resumeRef.current = undefined;
      observer.disconnect();
      globalThis.clearInterval(timer);
      globalThis.clearTimeout(wake);
      document.removeEventListener('visibilitychange', background);
      globalThis.removeEventListener('focus', background);
      globalThis.removeEventListener('online', background);
      document.removeEventListener('focusout', resume);
    };
  }, [enabled, context]);
  useEffect(() => {
    if (!paused) resumeRef.current?.();
  }, [paused]);
  return { failed, request };
}

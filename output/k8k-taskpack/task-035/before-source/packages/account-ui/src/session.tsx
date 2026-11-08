import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { useLocale } from '@online-school/ui';

type SessionExit = 'navigating' | 'verify';
const event = 'session-replaced';
const storageEvent = 'school-account:session-replaced';
let controller = new AbortController();
let exit: SessionExit | null = null;
let destination: string | undefined;
let channel: BroadcastChannel | undefined;
const listeners = new Set<() => void>();

export const sessionSignal = () => controller.signal;
export const subscribeSession = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function clearPrivateSession() {
  const previous = controller;
  controller = new AbortController();
  if (exit) controller.abort();
  previous.abort();
  for (const listener of listeners) listener();
}

function seal(next: SessionExit) {
  if (exit) return false;
  exit = next;
  clearPrivateSession();
  return true;
}

export function leaveSession(path: string, announce = true) {
  if (exit) return;
  destination = path;
  seal('navigating');
  if (announce) announceSessionChange();
}

export function verifySessionOutcome() {
  if (seal('verify')) announceSessionChange();
}

export function announceSessionChange() {
  if (channel) channel.postMessage(event);
  else {
    try {
      window.localStorage.setItem(storageEvent, crypto.randomUUID());
      window.localStorage.removeItem(storageEvent);
    } catch {
      /* Storage can be disabled. Local retirement has already happened. */
    }
  }
}

function getExit() {
  return exit;
}

export function SessionExitBoundary({ children }: { children: ReactNode }) {
  const status = useSyncExternalStore(subscribeSession, getExit, getExit);
  const { t } = useLocale();
  const verifyLink = useRef<HTMLAnchorElement>(null);
  useLayoutEffect(() => {
    if (status === 'verify') verifyLink.current?.focus();
    if (status === 'navigating' && destination) window.location.replace(destination);
  }, [status]);
  useLayoutEffect(() => {
    const connection =
      typeof window.BroadcastChannel === 'function'
        ? new window.BroadcastChannel('school-account')
        : undefined;
    channel = connection;
    if (connection)
      connection.onmessage = ({ data }) => {
        if (data === event) leaveSession('/', false);
      };
    const storage = (e: StorageEvent) => {
      if (e.key === storageEvent && e.newValue) leaveSession('/', false);
    };
    const hide = (e: PageTransitionEvent) => {
      if (e.persisted) seal('navigating');
    };
    const show = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener('pagehide', hide);
    window.addEventListener('pageshow', show);
    window.addEventListener('storage', storage);
    return () => {
      connection?.close();
      if (channel === connection) channel = undefined;
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', show);
      window.removeEventListener('storage', storage);
    };
  }, []);
  if (!status) return children;
  return (
    <main className="account-session-status">
      {status === 'verify' ? (
        <>
          <p role="alert">{t('account.unknownOutcome')}</p>
          <a ref={verifyLink} href="/">
            {t('account.verifySession')}
          </a>
        </>
      ) : (
        <p role="status">{t('auth.opening')}</p>
      )}
    </main>
  );
}

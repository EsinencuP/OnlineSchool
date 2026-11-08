import { useSyncExternalStore } from 'react';
import { intlLocaleFor, translate } from './messages.js';
import type { Locale, MessageCall } from './messages.js';
export * from './messages.js';

const key = 'k8k.locale';
let selected: Locale = 'ru';
let initialized = false;
let memoryOnly = false;
const listeners = new Set<() => void>();

function apply(locale: Locale) {
  const changed = selected !== locale;
  selected = locale;
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
  if (changed) listeners.forEach((listener) => listener());
}
function readStorage() {
  if (memoryOnly) return;
  try {
    apply(globalThis.localStorage?.getItem(key) === 'ro' ? 'ro' : 'ru');
  } catch {
    // Keep the active in-memory preference if storage is unavailable.
    apply(selected);
  }
}
export function initializeLocale(): Locale {
  if (!initialized) {
    initialized = true;
    readStorage();
  }
  return selected;
}
function onStorage(event: StorageEvent) {
  if (event.key !== key && event.key !== null) return;
  try {
    if (event.storageArea !== globalThis.localStorage) return;
  } catch {
    return;
  }
  memoryOnly = false;
  apply(event.newValue === 'ro' ? 'ro' : 'ru');
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    globalThis.addEventListener?.('storage', onStorage);
    // Storage events can occur while every consumer is unmounted.
    readStorage();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) globalThis.removeEventListener?.('storage', onStorage);
  };
}
export function setLocale(locale: Locale) {
  const next = locale === 'ro' ? 'ro' : 'ru';
  initialized = true;
  try {
    const storage = globalThis.localStorage;
    storage?.setItem(key, next);
    memoryOnly = !storage;
  } catch {
    memoryOnly = true;
  }
  apply(next);
}
export function useLocale() {
  const locale = useSyncExternalStore(subscribe, initializeLocale, () => 'ru' as const);
  return {
    locale,
    intlLocale: intlLocaleFor(locale),
    t: (...args: MessageCall) => translate(locale, ...args),
  };
}
export function LanguageSelector() {
  const { locale, t } = useLocale();
  return (
    <label className="k8k-language">
      <span>{t('language')}</span>
      <select value={locale} onChange={(e) => setLocale(e.target.value === 'ro' ? 'ro' : 'ru')}>
        <option value="ru">Русский</option>
        <option value="ro">Română</option>
      </select>
    </label>
  );
}

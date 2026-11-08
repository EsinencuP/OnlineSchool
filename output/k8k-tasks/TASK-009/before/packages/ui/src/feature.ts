// Presentation flag only. It never participates in access decisions.
export function initializeK8KTheme(): boolean {
  if (typeof window === 'undefined') return false;
  const requested = new URLSearchParams(globalThis.window.location.search).get('ui.k8k');
  let enabled = requested === '1';
  try {
    if (requested === '1' || requested === '0')
      globalThis.window.sessionStorage.setItem('ui.k8k', requested);
    enabled =
      (requested === '1' || requested === '0'
        ? requested
        : globalThis.window.sessionStorage.getItem('ui.k8k')) === '1';
  } catch {
    // Explicit URLs work even with unavailable session storage.
  }
  if (enabled) globalThis.window.document.documentElement.dataset.k8k = 'provisional';
  else delete globalThis.window.document.documentElement.dataset.k8k;
  return enabled;
}
export const k8kEnabled = initializeK8KTheme();

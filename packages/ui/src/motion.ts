/** Measure before the overlay moves focus. Keep the same origin for its exit. */
export function setOverlayOrigin(target: EventTarget | null, trigger?: HTMLElement | null) {
  if (!(target instanceof HTMLElement)) return;
  const source = trigger ?? target.ownerDocument.activeElement;
  if (
    !(source instanceof HTMLElement) ||
    source === target.ownerDocument.body ||
    target.contains(source)
  )
    return;
  const anchor = source.getBoundingClientRect();
  const box = target.getBoundingClientRect();
  // Dialog placement uses translate(-50%, -50%); independent scale leaves it intact.
  const left = target.classList.contains('k8k-dialog')
    ? (target.ownerDocument.documentElement.clientWidth - target.offsetWidth) / 2
    : box.left;
  const top = target.classList.contains('k8k-dialog')
    ? (globalThis.innerHeight - target.offsetHeight) / 2
    : box.top;
  target.style.transformOrigin = `${anchor.x + anchor.width / 2 - left}px ${anchor.y + anchor.height / 2 - top}px`;
}

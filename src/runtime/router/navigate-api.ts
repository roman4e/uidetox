import type { NavigateController } from './navigate.js';

let active: NavigateController | null = null;
let activeState: unknown = null;
let navLinksInstalled = false;

/** Registers the controller used by the module-level `navigate()`. Set on router start. */
export function setActiveController(controller: NavigateController | null): void {
  active = controller;
}

/** Registers the reactive route-state store exposed by `routeState()`. */
export function setActiveRouteState(routeState: unknown): void {
  activeState = routeState;
}

/**
 * The active router's reactive route state — `{ path, params, meta }`. Read its
 * fields inside an effect to react to navigation (e.g. start/stop per-route work).
 */
export function routeState<T = { path: string; params: Record<string, unknown>; meta: Record<string, unknown> }>(): T {
  if (!activeState) {
    throw new Error('routeState(): no router is active. Call router.start() first.');
  }
  return activeState as T;
}

/** Client-side navigation to `url` via the active router (SPA transition, no reload). */
export function navigate(url: string, opts?: { replace?: boolean }): void {
  if (!active) {
    throw new Error('navigate(): no router is active. Call router.start() first.');
  }
  active.goto(url, opts);
}

function isPlainLeftClick(e: MouseEvent): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

/**
 * Intercepts clicks on `<a data-nav href="/…">` for SPA navigation. Ignores
 * modifier/middle clicks, `target="_blank"`, `download`, and cross-origin hrefs
 * so normal browser behavior is preserved. Idempotent.
 */
export function installNavLinks(): void {
  if (navLinksInstalled || typeof document === 'undefined') return;
  navLinksInstalled = true;
  document.addEventListener('click', (e) => {
    if (!isPlainLeftClick(e)) return;
    const anchor = (e.target as Element | null)?.closest?.('a[data-nav]') as HTMLAnchorElement | null;
    if (!anchor) return;
    if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;
    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('//') || href.startsWith('mailto:')) return;
    if (anchor.origin && anchor.origin !== location.origin) return;
    e.preventDefault();
    navigate(anchor.getAttribute('href')!);
  });
}

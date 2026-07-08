// Off-tick scheduling primitives. Architectural rule: heavy computations must be
// moved OUT of the current tick (via a macrotask) so the synchronous frame stays
// free for business logic and input handling.

/** Runs `fn` in a fresh macrotask — yields the current tick immediately. */
export function defer(fn: () => void): void {
  setTimeout(fn, 0);
}

/** Runs `fn` when the browser is idle (`requestIdleCallback`), else next macrotask. */
export function idle(fn: () => void): void {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
  if (typeof ric === 'function') { ric(fn); return; }
  setTimeout(fn, 0);
}

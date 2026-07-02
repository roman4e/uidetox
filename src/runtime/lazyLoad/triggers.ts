export type TriggerName = 'visible' | 'eager' | 'interaction' | 'manual';

export interface TriggerHandle {
  start(): void;
  stop(): void;
}

export function attachTrigger(
  name: TriggerName,
  target: Element,
  fire: () => void,
): TriggerHandle {
  let fired = false;
  const once = () => { if (!fired) { fired = true; fire(); } };
  const disposals: Array<() => void> = [];

  return {
    start() {
      if (name === 'eager' || name === 'manual') {
        setTimeout(once, 0);
        return;
      }
      if (name === 'interaction') {
        const handler = () => once();
        target.addEventListener('pointerenter', handler, { once: true });
        target.addEventListener('focusin', handler, { once: true });
        disposals.push(() => target.removeEventListener('pointerenter', handler));
        disposals.push(() => target.removeEventListener('focusin', handler));
        return;
      }
      if (typeof IntersectionObserver === 'function') {
        const io = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) { once(); io.disconnect(); break; }
          }
        });
        io.observe(target);
        disposals.push(() => io.disconnect());
      } else {
        setTimeout(once, 0);
      }
    },
    stop() {
      for (const d of disposals) d();
    },
  };
}

export function schedulePrefetch(fn: () => void): void {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
  if (typeof ric === 'function') { ric(fn); return; }
  setTimeout(fn, 0);
}

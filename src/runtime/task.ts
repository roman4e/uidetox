import { runWithObserver } from './observer.js';

export interface TaskOptions {
  idle?: boolean;
}

function scheduleIdle(fn: () => void): void {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
  if (typeof ric === 'function') { ric(fn); return; }
  setTimeout(fn, 0);
}

/**
 * A detached, async, reactive side-effect. Runs off the render frame:
 *  - initial run is scheduled asynchronously (microtask by default);
 *  - signals read synchronously (before the first `await`) are tracked;
 *  - a tracked change schedules one coalesced re-run;
 *  - each re-run aborts the previous AbortController and passes a fresh signal.
 */
export function task(
  fn: (signal: AbortSignal) => void | Promise<void>,
  opts: TaskOptions = {},
): () => void {
  let disposed = false;
  let scheduled = false;
  let controller: AbortController | null = null;

  const run = () => {
    scheduled = false;
    if (disposed) return;
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    runWithObserver(schedule, () => {
      void fn(signal);
    });
  };

  function schedule(): void {
    if (disposed || scheduled) return;
    scheduled = true;
    if (opts.idle) scheduleIdle(run);
    else queueMicrotask(run);
  }

  schedule(); // initial async run

  return () => {
    disposed = true;
    controller?.abort();
  };
}

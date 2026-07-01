import { runWithObserver } from './observer.js';
import { scheduleFlush } from './scheduler.js';

export function effect(fn: () => void | (() => void)): () => void {
  let cleanup: void | (() => void);
  let disposed = false;
  let firstRun = true;
  const run = () => {
    if (disposed) return;
    cleanup?.();
    cleanup = runWithObserver(scheduled, fn) ?? undefined;
  };
  const scheduled = () => {
    if (firstRun) {
      firstRun = false;
      run();
    } else {
      scheduleFlush(run);
    }
  };
  scheduled();
  return () => {
    disposed = true;
    cleanup?.();
    cleanup = undefined;
  };
}

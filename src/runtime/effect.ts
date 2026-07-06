import { runWithObserver } from './observer.js';
import { scheduleEffect } from './scheduler.js';
import { onDispose } from './scope.js';

export interface EffectOptions {
  scheduler?: (job: () => void) => void;
}

export function effect(fn: () => void | (() => void), opts: EffectOptions = {}): () => void {
  const schedule = opts.scheduler ?? scheduleEffect;
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
      schedule(run);
    }
  };
  scheduled();
  const dispose = () => {
    disposed = true;
    cleanup?.();
    cleanup = undefined;
  };
  // Auto-dispose with the active control-flow scope (if any).
  onDispose(dispose);
  return dispose;
}

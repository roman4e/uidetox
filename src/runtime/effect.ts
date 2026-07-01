import { runWithObserver } from './observer.js';

export function effect(fn: () => void | (() => void)): () => void {
  let cleanup: void | (() => void);
  let disposed = false;
  const run = () => {
    if (disposed) return;
    cleanup?.();
    cleanup = runWithObserver(run, fn) ?? undefined;
  };
  run();
  return () => {
    disposed = true;
    cleanup?.();
    cleanup = undefined;
  };
}

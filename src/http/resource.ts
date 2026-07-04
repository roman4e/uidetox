import { state } from '../runtime/state.js';
import { effect } from '../runtime/effect.js';
import { untrack } from '../runtime/observer.js';
import { onCleanup } from '../runtime/lifecycle.js';

export type ResourceStatus = 'idle' | 'loading' | 'success' | 'error';

export interface Resource<T> {
  readonly status: ResourceStatus;
  readonly loading: boolean;
  readonly data: T | undefined;
  readonly error: unknown;
  /** Force a re-fetch (aborts any in-flight request first). */
  reload(): void;
  /** Abort the in-flight request without starting a new one. */
  abort(): void;
}

export interface ResourceOptions {
  /**
   * Reactive dependency selector. When its tracked reads change, the resource
   * re-fetches. Omit for a one-shot fetch.
   */
  key?: () => unknown;
}

/**
 * A reactive async resource. Re-runs when `opts.key`'s reactive reads change,
 * cancels the previous request on each run, and auto-aborts on component unmount.
 */
export function resource<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  opts: ResourceOptions = {},
): Resource<T> {
  const store = state<{ status: ResourceStatus; data: T | undefined; error: unknown }>({
    status: 'idle',
    data: undefined,
    error: undefined,
  });
  let controller: AbortController | null = null;

  function run(): void {
    controller?.abort();
    const ctrl = new AbortController();
    controller = ctrl;
    store.status = 'loading';
    store.error = undefined;
    // Don't subscribe the fetcher's reactive reads to the tracking effect —
    // dependencies are declared explicitly via `opts.key`.
    untrack(() => fetcher(ctrl.signal)).then(
      (data) => {
        if (ctrl.signal.aborted) return;
        store.data = data;
        store.status = 'success';
      },
      (err) => {
        if (ctrl.signal.aborted || (err as { name?: string })?.name === 'AbortError') return;
        store.error = err;
        store.status = 'error';
      },
    );
  }

  let disposeEffect: (() => void) | undefined;
  if (opts.key) {
    disposeEffect = effect(() => {
      opts.key!(); // track deps
      run();
    });
  } else {
    run();
  }

  const abort = (): void => { controller?.abort(); };
  onCleanup(() => { abort(); disposeEffect?.(); });

  return {
    get status() { return store.status; },
    get loading() { return store.status === 'loading'; },
    get data() { return store.data; },
    get error() { return store.error; },
    reload: run,
    abort,
  };
}

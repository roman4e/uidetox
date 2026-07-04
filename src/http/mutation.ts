import { state } from '../runtime/state.js';

export interface MutationOptions<A extends unknown[], R> {
  /** Runs before the request; return a snapshot passed to `onRollback`. */
  onOptimistic?: (...args: A) => unknown;
  /** Runs if the request throws; receives the `onOptimistic` snapshot. */
  onRollback?: (snapshot: unknown, ...args: A) => void;
  onSuccess?: (result: R, ...args: A) => void;
  onError?: (error: unknown, ...args: A) => void;
}

export interface Mutation<A extends unknown[], R> {
  (...args: A): Promise<R>;
  readonly pending: boolean;
  readonly error: unknown;
}

/**
 * Wraps an async operation with optimistic-update + rollback + reactive
 * pending/error state.
 */
export function mutation<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  opts: MutationOptions<A, R> = {},
): Mutation<A, R> {
  const store = state<{ pending: boolean; error: unknown }>({ pending: false, error: undefined });

  const run = async (...args: A): Promise<R> => {
    const snapshot = opts.onOptimistic?.(...args);
    store.pending = true;
    store.error = undefined;
    try {
      const result = await fn(...args);
      opts.onSuccess?.(result, ...args);
      return result;
    } catch (err) {
      opts.onRollback?.(snapshot, ...args);
      opts.onError?.(err, ...args);
      store.error = err;
      throw err;
    } finally {
      store.pending = false;
    }
  };

  Object.defineProperties(run, {
    pending: { get: () => store.pending },
    error: { get: () => store.error },
  });
  return run as Mutation<A, R>;
}

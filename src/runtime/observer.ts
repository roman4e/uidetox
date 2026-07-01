export type Observer = () => void;

let current: Observer | null = null;

export function getCurrentObserver(): Observer | null {
  return current;
}

export function runWithObserver<T>(observer: Observer, fn: () => T): T {
  const prev = current;
  current = observer;
  try {
    return fn();
  } finally {
    current = prev;
  }
}

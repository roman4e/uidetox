import { getCurrentObserver, type Observer } from './observer.js';

const subs = new WeakMap<object, Map<PropertyKey, Set<Observer>>>();
const proxies = new WeakMap<object, object>();

function track(target: object, key: PropertyKey) {
  const observer = getCurrentObserver();
  if (!observer) return;
  let byTarget = subs.get(target);
  if (!byTarget) {
    byTarget = new Map();
    subs.set(target, byTarget);
  }
  let byKey = byTarget.get(key);
  if (!byKey) {
    byKey = new Set();
    byTarget.set(key, byKey);
  }
  byKey.add(observer);
}

let batchDepth = 0;
const pending = new Set<Observer>();

export function notify(target: object, key: PropertyKey): void {
  const observers = subs.get(target)?.get(key);
  if (!observers) return;
  if (batchDepth > 0) {
    for (const obs of observers) pending.add(obs);
    return;
  }
  for (const obs of [...observers]) obs();
}

/**
 * Groups mutations so subscribers are notified once, after all writes complete.
 * Nested batches flatten; the outermost frame owns the flush. Flushes even if
 * `fn` throws. Reads inside see current (post-write) values.
 */
export function batch<T>(fn: () => T): T {
  batchDepth++;
  try {
    return fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0) {
      const observers = [...pending];
      pending.clear();
      for (const obs of observers) obs();
    }
  }
}

// Only plain objects and arrays are deep-wrapped. Native/exotic objects
// (DOMRect, Map, Set, Date, DOM nodes, class instances) are returned as-is —
// wrapping them in a Proxy breaks internal-slot getters (`rect.left` → undefined)
// and identity (REQ-07).
function isReactiveTarget(v: object): boolean {
  if (Array.isArray(v)) return true;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

export function state<T extends object>(obj: T): T {
  const existing = proxies.get(obj);
  if (existing) return existing as T;
  const proxy = new Proxy(obj, {
    get(target, key, receiver) {
      track(target, key);
      const value = Reflect.get(target, key, receiver);
      return value !== null && typeof value === 'object' && isReactiveTarget(value as object)
        ? state(value as object)
        : value;
    },
    set(target, key, value, receiver) {
      const prev = Reflect.get(target, key, receiver);
      const prevLength = Array.isArray(target) ? (target as unknown[]).length : -1;
      const ok = Reflect.set(target, key, value, receiver);
      if (!ok) return ok;
      if (!Object.is(prev, value)) notify(target, key);
      if (Array.isArray(target) && (target as unknown[]).length !== prevLength) {
        notify(target, 'length');
      }
      return ok;
    },
    deleteProperty(target, key) {
      const had = key in target;
      const ok = Reflect.deleteProperty(target, key);
      if (ok && had) notify(target, key);
      return ok;
    },
  }) as T;
  proxies.set(obj, proxy);
  return proxy;
}

const shallowProxies = new WeakMap<object, object>();

/**
 * Reactive container that tracks only top-level keys. Nested values are
 * returned as-is (not re-wrapped), so mutating inside a value does NOT notify —
 * replace the reference to trigger subscribers. Cheap for large, read-mostly
 * payloads that are swapped wholesale.
 */
export function shallow<T extends object>(obj: T): T {
  const existing = shallowProxies.get(obj);
  if (existing) return existing as T;
  const proxy = new Proxy(obj, {
    get(target, key, receiver) {
      track(target, key);
      return Reflect.get(target, key, receiver);
    },
    set(target, key, value, receiver) {
      const prev = Reflect.get(target, key, receiver);
      const ok = Reflect.set(target, key, value, receiver);
      if (ok && !Object.is(prev, value)) notify(target, key);
      return ok;
    },
    deleteProperty(target, key) {
      const had = key in target;
      const ok = Reflect.deleteProperty(target, key);
      if (ok && had) notify(target, key);
      return ok;
    },
  }) as T;
  shallowProxies.set(obj, proxy);
  return proxy;
}

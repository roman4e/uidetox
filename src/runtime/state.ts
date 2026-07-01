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

export function notify(target: object, key: PropertyKey): void {
  const observers = subs.get(target)?.get(key);
  if (!observers) return;
  for (const obs of [...observers]) obs();
}

export function state<T extends object>(obj: T): T {
  const existing = proxies.get(obj);
  if (existing) return existing as T;
  const proxy = new Proxy(obj, {
    get(target, key, receiver) {
      track(target, key);
      const value = Reflect.get(target, key, receiver);
      return value !== null && typeof value === 'object'
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

import { effect } from './effect.js';
import { scheduleDerivation } from './scheduler.js';
import { state } from './state.js';

export interface Derived<T> {
  readonly value: T;
}

export function derived<T>(fn: () => T): Derived<T> {
  const holder = state({ value: undefined as T });
  effect(() => { holder.value = fn(); }, { scheduler: scheduleDerivation });
  return holder;
}

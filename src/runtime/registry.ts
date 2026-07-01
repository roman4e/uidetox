import { derived, type Derived } from './derived.js';
import { state } from './state.js';

export interface Token<T> {
  readonly id: symbol;
  readonly name: string;
  readonly __t?: T;
}

export function createToken<T>(name: string): Token<T> {
  return { id: Symbol(name), name };
}

type Provider<T> = T | (() => T);
interface Slot {
  provider: Provider<unknown>;
}

const globalProviders = state<Record<string, Slot>>({});

let activeScope: InternalScope | null = null;

export interface RegistryScope {
  provide<T>(token: Token<T>, value: Provider<T>): void;
  override<T>(token: Token<T>, value: Provider<T>): void;
  enter<R>(fn: () => R): R;
}

interface InternalScope extends RegistryScope {
  readonly slots: Record<string, Slot>;
}

function keyOf(sym: symbol): string {
  return sym.toString();
}

function readSlot(id: symbol): Slot | undefined {
  const k = keyOf(id);
  if (activeScope) {
    const scoped = activeScope.slots[k];
    if (scoped) return scoped;
  }
  return globalProviders[k];
}

function resolveValue<T>(slot: Slot | undefined): T | undefined {
  if (!slot) return undefined;
  const p = slot.provider as Provider<T>;
  return typeof p === 'function' ? (p as () => T)() : p;
}

function createScope(): RegistryScope {
  const slots = state<Record<string, Slot>>({});
  const scope: InternalScope = {
    slots,
    provide<T>(token: Token<T>, value: Provider<T>) {
      slots[keyOf(token.id)] = { provider: value as Provider<unknown> };
    },
    override<T>(token: Token<T>, value: Provider<T>) {
      slots[keyOf(token.id)] = { provider: value as Provider<unknown> };
    },
    enter<R>(fn: () => R): R {
      const prev = activeScope;
      activeScope = scope;
      try {
        return fn();
      } finally {
        activeScope = prev;
      }
    },
  };
  return scope;
}

export const registry = {
  provide<T>(token: Token<T>, value: Provider<T>): void {
    globalProviders[keyOf(token.id)] = { provider: value as Provider<unknown> };
  },
  override<T>(token: Token<T>, value: Provider<T>): void {
    if (!activeScope) {
      throw new Error(
        'registry.override() requires an active scope; call registry.createScope() and enter() around your test.',
      );
    }
    activeScope.override(token, value);
  },
  get<T>(token: Token<T>): Derived<T> {
    return derived<T>(() => {
      const slot = readSlot(token.id);
      return resolveValue<T>(slot) as T;
    });
  },
  createScope,
};

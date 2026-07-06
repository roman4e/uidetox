// Disposal scopes for control-flow directives. Effects created while a scope is
// active register their disposer here, so tearing down an `<if>`/`<case>` branch
// disposes every nested effect (including deferred `<for>`/`<if>` renders) — not
// just the statically-captured DOM.

export interface Scope {
  disposers: Array<() => void>;
}

let currentScope: Scope | null = null;

export function getCurrentScope(): Scope | null {
  return currentScope;
}

export function runInScope<T>(scope: Scope | null, fn: () => T): T {
  const prev = currentScope;
  currentScope = scope;
  try {
    return fn();
  } finally {
    currentScope = prev;
  }
}

export function createScope(): Scope {
  return { disposers: [] };
}

/** Registers a teardown callback with the active scope (no-op outside one). */
export function onDispose(fn: () => void): void {
  currentScope?.disposers.push(fn);
}

export function disposeScope(scope: Scope): void {
  const d = scope.disposers.splice(0);
  for (let i = d.length - 1; i >= 0; i--) d[i]();
}

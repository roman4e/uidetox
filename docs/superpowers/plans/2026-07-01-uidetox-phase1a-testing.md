# UIDetox Phase 1a — Testing Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a working `ui-detox test <dir>` CLI that runs `test`, `test:interaction`, `test:visual`, `test:visual:pixel`, `test:a11y`, and `test:a11y:browser` blocks defined inside Markdown SFCs, with a hierarchical Registry, `defineEmits()`, `capture()`, structural + pixel-diff snapshots, and axe-core accessibility checks.

**Architecture:** A new compiler pass (`testCompile.ts`) emits a per-SFC **test module** that inlines the component boot code alongside `fixtures`, `mock`, and every `test*` block. A new **testing package** (`src/testing/`) supplies the globals that these blocks reference (`it`, `describe`, `expect`, `snapshot`, `pixel`, `axe`, `flushSync`, `capture`) plus a hierarchical Registry lifted forward from Phase 2. The `ui-detox test` runner discovers SFCs, groups modules by required environment, and executes fast blocks in-process against `happy-dom` while dispatching pixel and browser-a11y blocks to a spawned Playwright/Chromium worker.

**Tech Stack:** TypeScript 5.x (existing), Vitest for the framework's own dogfooded suite (existing), `happy-dom` (existing), `axe-core` for accessibility checks, `pixelmatch` + `pngjs` for image diffing, `playwright` for browser-side runs. Node `node:test`-compatible collectors are **not** used; the framework ships its own light collector — small enough to keep the CLI understandable, big enough to serve Phase 1a.

## Global Constraints

- **Language:** TypeScript 5.x, `strict: true`, ESM.
- **Runtime environment for fast blocks:** `happy-dom` (already a dev dependency).
- **Runtime environment for pixel & browser-a11y:** Playwright Chromium; the runner triggers `playwright install chromium` on first use.
- **Framework compatibility:** Phase 0 CLI (`ui-detox build`) and Phase 0 runtime API must remain unchanged; all Phase 1a code lives in **new** files under `src/testing/`, `src/compiler/testCompile.ts`, `src/cli/test.ts`, `src/cli/testRunner/`, and `src/runtime/registry.ts` + `src/runtime/emits.ts`.
- **Test discipline:** TDD — write a failing Vitest test first, run it, implement, run passing, commit.
- **Naming:** All test-only public exports are re-exported through `src/testing/index.ts`; the runner injects them at compile time — SFC authors never import them explicitly.
- **Snapshot layout:** structural snapshots live at `snapshots/<component>/<name>.snap.txt`; pixel snapshots at `snapshots/<component>/<name>.png`. Missing baselines are created only when `--update-snapshots` is passed.

---

## File Structure

```
/
├── package.json                            # + new deps: axe-core, pixelmatch, pngjs, playwright
├── src/
│   ├── runtime/
│   │   ├── registry.ts                     # NEW: hierarchical Registry + createToken
│   │   ├── emits.ts                        # NEW: defineEmits()
│   │   ├── index.ts                        # MODIFIED: re-export registry + defineEmits
│   │   └── component.ts                    # MODIFIED: expose current host to defineEmits
│   ├── compiler/
│   │   ├── testCompile.ts                  # NEW: emit per-SFC test module
│   │   └── index.ts                        # MODIFIED: export testCompile
│   ├── testing/
│   │   ├── index.ts                        # NEW: barrel — the injected globals
│   │   ├── collect.ts                      # NEW: it/describe/beforeEach collectors
│   │   ├── run.ts                          # NEW: in-process runner over a collected tree
│   │   ├── expect.ts                       # NEW: minimal matcher module
│   │   ├── capture.ts                      # NEW: capture() helper
│   │   ├── snapshot/
│   │   │   ├── structural.ts               # NEW: DOM serializer + snapshot()
│   │   │   └── pixel.ts                    # NEW: browser-side pixel() driver contract
│   │   └── a11y/
│   │       ├── runtime.ts                  # NEW: axe() in happy-dom
│   │       └── browser.ts                  # NEW: axe() in Playwright
│   └── cli/
│       ├── test.ts                         # NEW: `ui-detox test` command
│       └── testRunner/
│           ├── discover.ts                 # NEW: walk *.md, decide which need tests
│           ├── happyDomEnv.ts              # NEW: dynamic import of a test module in-process
│           ├── playwrightEnv.ts            # NEW: spawn Chromium, serve harness, run browser module
│           └── report.ts                   # NEW: human + json reporters
├── tests/
│   ├── runtime/
│   │   ├── registry.test.ts                # NEW
│   │   └── emits.test.ts                   # NEW
│   ├── testing/
│   │   ├── collect.test.ts                 # NEW
│   │   ├── expect.test.ts                  # NEW
│   │   ├── capture.test.ts                 # NEW
│   │   ├── structural.test.ts              # NEW
│   │   ├── runtime-a11y.test.ts            # NEW
│   │   └── pixel-contract.test.ts          # NEW (unit test of the pure pixel-diff step)
│   ├── compiler/
│   │   └── testCompile.test.ts             # NEW
│   ├── cli/
│   │   └── test-command.test.ts            # NEW: end-to-end runner over a fixture SFC
│   └── e2e/
│       └── phase1a-todo.test.ts            # NEW: full pipeline example
├── examples/
│   └── todo/
│       └── Todo.md                         # NEW: example component with every block role
├── docs/superpowers/specs/2026-07-01-uidetox-phase1a-testing-design.md   # already present
```

---

## Task 1: Add Phase 1a runtime dependencies

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: new dependencies installed and available for import — `axe-core`, `pixelmatch`, `pngjs`, `playwright`, `@types/pixelmatch`, `@types/pngjs`.

- [ ] **Step 1: Add dependencies**

Edit `package.json` — extend `dependencies`:
```json
"axe-core": "^4.9.0",
"pixelmatch": "^6.0.0",
"pngjs": "^7.0.0",
"playwright": "^1.44.0"
```

And `devDependencies`:
```json
"@types/pngjs": "^6.0.0"
```

- [ ] **Step 2: Install and verify existing suite still passes**

Run:
```bash
pnpm install
pnpm test
```

Expected: existing 41 tests still pass; installation completes.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add axe-core, pixelmatch, pngjs, playwright for Phase 1a"
```

---

## Task 2: Hierarchical Registry

**Files:**
- Create: `src/runtime/registry.ts`
- Modify: `src/runtime/index.ts`
- Test: `tests/runtime/registry.test.ts`

**Interfaces:**
- Produces:
  - `createToken<T>(name: string): Token<T>` — nominal typed identifier.
  - `registry.provide<T>(token: Token<T>, value: T | (() => T)): void` — global provide.
  - `registry.get<T>(token: Token<T>): Derived<T>` — reactive, follows overrides.
  - `registry.createScope(): RegistryScope` — child scope with its own overrides; `scope.provide`, `scope.override`, `scope.enter(fn)` sets it as active for the duration of `fn`.
  - `registry.override<T>(token: Token<T>, value: T | (() => T)): void` — sets an override on the currently-active scope (falls back to a per-test scope; runner drives this).

- [ ] **Step 1: Write the failing test**

Write `tests/runtime/registry.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createToken, registry } from '../../src/runtime/registry.js';
import { flushSync } from '../../src/runtime/scheduler.js';

describe('Registry', () => {
  it('resolves a globally-provided value', () => {
    const token = createToken<string>('greeting');
    registry.provide(token, 'hello');
    expect(registry.get(token).value).toBe('hello');
  });

  it('follows a scope override during scope.enter()', () => {
    const token = createToken<string>('color');
    registry.provide(token, 'red');
    const scope = registry.createScope();
    scope.override(token, 'blue');
    scope.enter(() => {
      expect(registry.get(token).value).toBe('blue');
    });
    expect(registry.get(token).value).toBe('red');
  });

  it('re-evaluates the Derived when the provider changes', () => {
    const token = createToken<number>('n');
    registry.provide(token, () => 1);
    const d = registry.get(token);
    expect(d.value).toBe(1);
    registry.provide(token, () => 2);
    flushSync();
    expect(d.value).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/runtime/registry.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement Registry**

Write `src/runtime/registry.ts`:
```ts
import { derived, type Derived } from './derived.js';
import { state } from './state.js';

export interface Token<T> {
  readonly id: symbol;
  readonly name: string;
  readonly __t?: T; // phantom type marker
}

export function createToken<T>(name: string): Token<T> {
  return { id: Symbol(name), name };
}

type Provider<T> = T | (() => T);
type Slot = { provider: Provider<unknown> };

interface Store {
  providers: Record<symbol, Slot>;
}

const globalStore = state<Store>({ providers: {} });

let activeScope: RegistryScope | null = null;

export interface RegistryScope {
  provide<T>(token: Token<T>, value: Provider<T>): void;
  override<T>(token: Token<T>, value: Provider<T>): void;
  enter<R>(fn: () => R): R;
}

function readSlot(id: symbol): Slot | undefined {
  const overriddenHere = activeScope
    ? (activeScope as { readonly slots: Record<symbol, Slot> }).slots[id]
    : undefined;
  if (overriddenHere) return overriddenHere;
  return globalStore.providers[id];
}

function resolveValue<T>(slot: Slot | undefined): T | undefined {
  if (!slot) return undefined;
  const p = slot.provider as Provider<T>;
  return typeof p === 'function' ? (p as () => T)() : p;
}

function createScope(): RegistryScope {
  const slots: Record<symbol, Slot> = {};
  const scopeState = state<Record<symbol, number>>({}); // key -> version, drives reactivity
  const scope: RegistryScope = {
    provide(token, value) {
      slots[token.id] = { provider: value };
      scopeState[token.id] = (scopeState[token.id] ?? 0) + 1;
    },
    override(token, value) {
      slots[token.id] = { provider: value };
      scopeState[token.id] = (scopeState[token.id] ?? 0) + 1;
    },
    enter(fn) {
      const prev = activeScope;
      activeScope = scope;
      try {
        return fn();
      } finally {
        activeScope = prev;
      }
    },
  };
  Object.defineProperty(scope, 'slots', { value: slots });
  Object.defineProperty(scope, 'state', { value: scopeState });
  return scope;
}

export const registry = {
  provide<T>(token: Token<T>, value: Provider<T>): void {
    globalStore.providers[token.id] = { provider: value as Provider<unknown> };
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
      // touch active scope's state key + global slot for reactivity
      const _ = globalStore.providers[token.id];
      void _;
      const slot = readSlot(token.id);
      return resolveValue<T>(slot) as T;
    });
  },
  createScope,
};
```

- [ ] **Step 4: Update runtime barrel**

Edit `src/runtime/index.ts` — append:
```ts
export { createToken, registry } from './registry.js';
export type { Token, RegistryScope } from './registry.js';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test tests/runtime/registry.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/runtime/registry.ts src/runtime/index.ts tests/runtime/registry.test.ts
git commit -m "feat(runtime): hierarchical Registry with typed tokens"
```

---

## Task 3: `defineEmits()` runtime helper

**Files:**
- Create: `src/runtime/emits.ts`
- Modify: `src/runtime/component.ts` (thread the current host into a module-level ambient so `defineEmits` can find it), `src/runtime/index.ts`
- Test: `tests/runtime/emits.test.ts`

**Interfaces:**
- Produces:
  - `defineEmits<T extends Record<string, unknown>>(): <K extends keyof T>(name: K, detail?: T[K]) => void`
  - Internal: `setCurrentHost(host: HTMLElement | null): void` — called by `defineComponent` before running `boot()`.

- [ ] **Step 1: Write the failing test**

Write `tests/runtime/emits.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { defineComponent } from '../../src/runtime/component.js';
import { defineEmits } from '../../src/runtime/emits.js';
import { __el, __text } from '../../src/runtime/domHelpers.js';

describe('defineEmits()', () => {
  it('dispatches a CustomEvent on the host with detail', () => {
    defineComponent({
      tag: 'x-emit-test',
      boot: (ctx) => {
        const emit = defineEmits<{ ping: { n: number } }>();
        ctx.host.addEventListener('trigger', () => emit('ping', { n: 42 }));
        return __el('div', [], [__text('ready')], ctx);
      },
    });
    document.body.innerHTML = '<x-emit-test></x-emit-test>';
    const el = document.body.querySelector('x-emit-test')!;
    const received: unknown[] = [];
    el.addEventListener('ping', (e) => received.push((e as CustomEvent).detail));
    el.dispatchEvent(new Event('trigger'));
    expect(received).toEqual([{ n: 42 }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/runtime/emits.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `emits.ts` + host tracking**

Write `src/runtime/emits.ts`:
```ts
let currentHost: HTMLElement | null = null;

export function setCurrentHost(host: HTMLElement | null): void {
  currentHost = host;
}

export function defineEmits<T extends Record<string, unknown>>() {
  const host = currentHost;
  if (!host) {
    throw new Error('defineEmits() must be called during boot()');
  }
  return function emit<K extends keyof T & string>(name: K, detail?: T[K]): void {
    host.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  };
}
```

Edit `src/runtime/component.ts` — inside `connectedCallback`, wrap the boot / template call with `setCurrentHost`:
```ts
import { setCurrentHost } from './emits.js';
// ...
connectedCallback(): void {
  if (this._mounted) return;
  this._mounted = true;
  for (const name of observedAttrs) {
    if (this.hasAttribute(name)) {
      this._props[name] = this.getAttribute(name);
    }
  }
  const ctx: TemplateCtx = { props: this._props, host: this };
  let node: Node;
  setCurrentHost(this);
  try {
    if (options.boot) {
      node = options.boot(ctx);
    } else if (options.template) {
      Object.assign(this._props, options.setup?.(ctx) ?? {});
      node = options.template(ctx);
    } else {
      throw new Error('Component must define either boot() or template()');
    }
  } finally {
    setCurrentHost(null);
  }
  this.appendChild(node);
  if (options.style) {
    const styleEl = document.createElement('style');
    styleEl.textContent = options.style;
    this.appendChild(styleEl);
  }
}
```

Edit `src/runtime/index.ts` — append:
```ts
export { defineEmits } from './emits.js';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/runtime/emits.test.ts`
Expected: PASS — 1 test.

- [ ] **Step 5: Commit**

```bash
git add src/runtime/emits.ts src/runtime/component.ts src/runtime/index.ts tests/runtime/emits.test.ts
git commit -m "feat(runtime): defineEmits() for component-emitted custom events"
```

---

## Task 4: `capture(host, name)` helper

**Files:**
- Create: `src/testing/capture.ts`
- Test: `tests/testing/capture.test.ts`

**Interfaces:**
- Produces: `capture<T = unknown>(host: EventTarget, name: string): T[]` — attaches a listener that pushes `event.detail` (or the whole event for non-CustomEvent) into an array; returns the array.

- [ ] **Step 1: Write the failing test**

Write `tests/testing/capture.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { capture } from '../../src/testing/capture.js';

describe('capture()', () => {
  it('collects detail payloads from CustomEvents', () => {
    const el = document.createElement('div');
    const events = capture<{ n: number }>(el, 'ping');
    el.dispatchEvent(new CustomEvent('ping', { detail: { n: 1 } }));
    el.dispatchEvent(new CustomEvent('ping', { detail: { n: 2 } }));
    expect(events).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it('collects raw events when there is no detail', () => {
    const el = document.createElement('div');
    const events = capture<Event>(el, 'click');
    el.dispatchEvent(new Event('click'));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('click');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/testing/capture.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Write `src/testing/capture.ts`:
```ts
export function capture<T = unknown>(host: EventTarget, name: string): T[] {
  const out: T[] = [];
  host.addEventListener(name, (event) => {
    const detail = (event as CustomEvent).detail;
    out.push(detail !== undefined ? (detail as T) : (event as unknown as T));
  });
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/testing/capture.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/testing/capture.ts tests/testing/capture.test.ts
git commit -m "feat(testing): capture() event listener helper"
```

---

## Task 5: `expect` minimal matcher module

**Files:**
- Create: `src/testing/expect.ts`
- Test: `tests/testing/expect.test.ts`

**Interfaces:**
- Produces: `expect(actual: unknown): Assertion` with matchers:
  `toBe`, `toEqual`, `toContain`, `toBeTruthy`, `toBeFalsy`, `toBeNull`, `toBeUndefined`, `toHaveLength`, `toThrow`, `toHaveNoViolations` (soft: expects `.violations` to be empty), `toMatchSnapshot(name?: string)` (soft: hands off to `snapshot()` if provided via `expect.setSnapshotHandler`).
- Failing matchers throw `AssertionError` with an actionable message.

- [ ] **Step 1: Write the failing test**

Write `tests/testing/expect.test.ts`:
```ts
import { describe, expect as vitestExpect, it } from 'vitest';
import { expect } from '../../src/testing/expect.js';

describe('expect()', () => {
  it('toBe passes for strict equality', () => {
    expect(1).toBe(1);
    vitestExpect(() => expect(1).toBe(2)).toThrow(/toBe/);
  });

  it('toEqual passes for structural equality', () => {
    expect({ a: 1, b: [2] }).toEqual({ a: 1, b: [2] });
    vitestExpect(() => expect({ a: 1 }).toEqual({ a: 2 })).toThrow(/toEqual/);
  });

  it('toContain checks substrings and array membership', () => {
    expect('hello world').toContain('world');
    expect([1, 2, 3]).toContain(2);
    vitestExpect(() => expect([1, 2, 3]).toContain(4)).toThrow(/toContain/);
  });

  it('toHaveNoViolations reads .violations', () => {
    expect({ violations: [] }).toHaveNoViolations();
    vitestExpect(() => expect({ violations: [{ id: 'x' }] }).toHaveNoViolations()).toThrow(/toHaveNoViolations/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/testing/expect.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Write `src/testing/expect.ts`:
```ts
export class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssertionError';
  }
}

function eq(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!eq((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  }
  return true;
}

function stringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

let snapshotHandler: ((name: string, value: unknown) => void) | null = null;

export interface Assertion {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toContain(needle: unknown): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
  toBeNull(): void;
  toBeUndefined(): void;
  toHaveLength(n: number): void;
  toThrow(match?: string | RegExp): void;
  toHaveNoViolations(): void;
  toMatchSnapshot(name?: string): void;
}

function assertion(actual: unknown): Assertion {
  return {
    toBe(expected) {
      if (!Object.is(actual, expected)) {
        throw new AssertionError(`toBe: expected ${stringify(expected)}, got ${stringify(actual)}`);
      }
    },
    toEqual(expected) {
      if (!eq(actual, expected)) {
        throw new AssertionError(`toEqual: expected ${stringify(expected)}, got ${stringify(actual)}`);
      }
    },
    toContain(needle) {
      if (typeof actual === 'string' && typeof needle === 'string') {
        if (!actual.includes(needle)) {
          throw new AssertionError(`toContain: ${stringify(actual)} does not include ${stringify(needle)}`);
        }
        return;
      }
      if (Array.isArray(actual)) {
        if (!actual.some((x) => eq(x, needle))) {
          throw new AssertionError(`toContain: array does not include ${stringify(needle)}`);
        }
        return;
      }
      throw new AssertionError('toContain: subject must be string or array');
    },
    toBeTruthy() {
      if (!actual) throw new AssertionError(`toBeTruthy: value was ${stringify(actual)}`);
    },
    toBeFalsy() {
      if (actual) throw new AssertionError(`toBeFalsy: value was ${stringify(actual)}`);
    },
    toBeNull() {
      if (actual !== null) throw new AssertionError(`toBeNull: value was ${stringify(actual)}`);
    },
    toBeUndefined() {
      if (actual !== undefined) throw new AssertionError(`toBeUndefined: value was ${stringify(actual)}`);
    },
    toHaveLength(n) {
      const len = (actual as { length?: number })?.length;
      if (len !== n) throw new AssertionError(`toHaveLength: expected ${n}, got ${stringify(len)}`);
    },
    toThrow(match) {
      if (typeof actual !== 'function') throw new AssertionError('toThrow: subject must be a function');
      try {
        (actual as () => unknown)();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (match === undefined) return;
        if (typeof match === 'string' && !message.includes(match)) {
          throw new AssertionError(`toThrow: message ${stringify(message)} did not include ${stringify(match)}`);
        }
        if (match instanceof RegExp && !match.test(message)) {
          throw new AssertionError(`toThrow: message ${stringify(message)} did not match ${String(match)}`);
        }
        return;
      }
      throw new AssertionError('toThrow: function did not throw');
    },
    toHaveNoViolations() {
      const violations = (actual as { violations?: unknown[] })?.violations;
      if (!violations || violations.length === 0) return;
      throw new AssertionError(`toHaveNoViolations: ${violations.length} violation(s): ${stringify(violations)}`);
    },
    toMatchSnapshot(name?: string) {
      if (!snapshotHandler) {
        throw new AssertionError('toMatchSnapshot: no snapshot handler registered');
      }
      snapshotHandler(name ?? 'default', actual);
    },
  };
}

const rootExpect = (actual: unknown) => assertion(actual);
(rootExpect as unknown as { setSnapshotHandler: (fn: typeof snapshotHandler) => void }).setSnapshotHandler =
  (fn) => { snapshotHandler = fn; };

export const expect = rootExpect as ((actual: unknown) => Assertion) & {
  setSnapshotHandler: (fn: typeof snapshotHandler) => void;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/testing/expect.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/testing/expect.ts tests/testing/expect.test.ts
git commit -m "feat(testing): minimal expect() matcher module"
```

---

## Task 6: `collect` — `it` / `describe` / `beforeEach` module-level collectors

**Files:**
- Create: `src/testing/collect.ts`
- Test: `tests/testing/collect.test.ts`

**Interfaces:**
- Produces:
  - `describe(name: string, fn: () => void): void` — pushes a suite onto the current stack, runs `fn`, pops.
  - `it(name: string, fn: () => void | Promise<void>): void` — records a test in the current suite.
  - `beforeEach(fn: () => void | Promise<void>): void` — registers a hook on the current suite.
  - `getCollectedTree(): Suite` — returns the tree gathered so far and starts a fresh empty root.
- Internal state: a module-level current root + stack.

- [ ] **Step 1: Write the failing test**

Write `tests/testing/collect.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  beforeEach,
  describe as uDescribe,
  getCollectedTree,
  it as uIt,
} from '../../src/testing/collect.js';

describe('collect', () => {
  it('captures a tree of describe / it / beforeEach', () => {
    getCollectedTree(); // reset root
    uDescribe('outer', () => {
      beforeEach(() => {});
      uIt('a', () => {});
      uDescribe('inner', () => {
        uIt('b', () => {});
      });
    });
    const tree = getCollectedTree();
    expect(tree.suites[0].name).toBe('outer');
    expect(tree.suites[0].hooks.beforeEach).toHaveLength(1);
    expect(tree.suites[0].tests.map((t) => t.name)).toEqual(['a']);
    expect(tree.suites[0].suites[0].tests.map((t) => t.name)).toEqual(['b']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/testing/collect.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Write `src/testing/collect.ts`:
```ts
export interface Test {
  name: string;
  fn: () => void | Promise<void>;
}

export interface Suite {
  name: string;
  hooks: { beforeEach: Array<() => void | Promise<void>> };
  tests: Test[];
  suites: Suite[];
}

function makeSuite(name: string): Suite {
  return { name, hooks: { beforeEach: [] }, tests: [], suites: [] };
}

let root: Suite = makeSuite('__root__');
let stack: Suite[] = [root];

function current(): Suite {
  return stack[stack.length - 1];
}

export function describe(name: string, fn: () => void): void {
  const suite = makeSuite(name);
  current().suites.push(suite);
  stack.push(suite);
  try {
    fn();
  } finally {
    stack.pop();
  }
}

export function it(name: string, fn: () => void | Promise<void>): void {
  current().tests.push({ name, fn });
}

export function beforeEach(fn: () => void | Promise<void>): void {
  current().hooks.beforeEach.push(fn);
}

export function getCollectedTree(): Suite {
  const previous = root;
  root = makeSuite('__root__');
  stack = [root];
  return previous;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/testing/collect.test.ts`
Expected: PASS — 1 test.

- [ ] **Step 5: Commit**

```bash
git add src/testing/collect.ts tests/testing/collect.test.ts
git commit -m "feat(testing): describe/it/beforeEach collectors"
```

---

## Task 7: In-process runner over a collected tree

**Files:**
- Create: `src/testing/run.ts`
- Test: `tests/testing/run.test.ts`

**Interfaces:**
- Produces: `runTree(tree: Suite): Promise<RunResult>` — walks the tree, executes each test with all inherited `beforeEach` hooks, catches errors, returns:
  ```ts
  interface TestOutcome { path: string; ok: boolean; durationMs: number; error?: string }
  interface RunResult { outcomes: TestOutcome[]; passed: number; failed: number }
  ```

- [ ] **Step 1: Write the failing test**

Write `tests/testing/run.test.ts`:
```ts
import { describe, expect, it as vit } from 'vitest';
import { beforeEach, describe as uDescribe, getCollectedTree, it } from '../../src/testing/collect.js';
import { runTree } from '../../src/testing/run.js';

describe('runTree', () => {
  vit('runs each test and reports passes / failures', async () => {
    getCollectedTree();
    uDescribe('math', () => {
      let x = 0;
      beforeEach(() => { x = 1; });
      it('adds', () => { if (x + 1 !== 2) throw new Error('bad math'); });
      it('breaks', () => { throw new Error('boom'); });
    });
    const result = await runTree(getCollectedTree());
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.outcomes.map((o) => o.path)).toEqual(['math > adds', 'math > breaks']);
    expect(result.outcomes[1].error).toContain('boom');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/testing/run.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Write `src/testing/run.ts`:
```ts
import type { Suite } from './collect.js';

export interface TestOutcome {
  path: string;
  ok: boolean;
  durationMs: number;
  error?: string;
}

export interface RunResult {
  outcomes: TestOutcome[];
  passed: number;
  failed: number;
}

function pathJoin(parts: string[]): string {
  return parts.filter((p) => p && p !== '__root__').join(' > ');
}

async function walk(
  suite: Suite,
  parents: string[],
  inheritedHooks: Array<() => void | Promise<void>>,
  outcomes: TestOutcome[],
): Promise<void> {
  const path = [...parents, suite.name];
  const hooks = [...inheritedHooks, ...suite.hooks.beforeEach];
  for (const t of suite.tests) {
    const testPath = pathJoin([...path, t.name]);
    const start = performance.now();
    let ok = true;
    let error: string | undefined;
    try {
      for (const h of hooks) await h();
      await t.fn();
    } catch (err) {
      ok = false;
      error = err instanceof Error ? err.stack ?? err.message : String(err);
    }
    outcomes.push({ path: testPath, ok, durationMs: performance.now() - start, error });
  }
  for (const child of suite.suites) {
    await walk(child, path, hooks, outcomes);
  }
}

export async function runTree(root: Suite): Promise<RunResult> {
  const outcomes: TestOutcome[] = [];
  await walk(root, [], [], outcomes);
  const passed = outcomes.filter((o) => o.ok).length;
  const failed = outcomes.length - passed;
  return { outcomes, passed, failed };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/testing/run.test.ts`
Expected: PASS — 1 test.

- [ ] **Step 5: Commit**

```bash
git add src/testing/run.ts tests/testing/run.test.ts
git commit -m "feat(testing): in-process runner over collected suite tree"
```

---

## Task 8: Structural DOM snapshot

**Files:**
- Create: `src/testing/snapshot/structural.ts`
- Test: `tests/testing/structural.test.ts`

**Interfaces:**
- Produces:
  - `serializeDom(root: Node): string` — a stable, pretty-printed representation of the DOM (tag names lowercased, attributes sorted, whitespace-collapsed).
  - `snapshot(name: string, options?: { root?: Node }): Promise<void>` — compares the serialized DOM (root defaults to `document.body`) against `snapshots/<component>/<name>.snap.txt`; throws `AssertionError` on mismatch.
  - `configureSnapshots(opts: { componentDir: string; updateMode: boolean; fs?: SnapshotFs }): void` — the runner sets these before executing each SFC's test module.

- [ ] **Step 1: Write the failing test**

Write `tests/testing/structural.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  configureSnapshots,
  serializeDom,
  snapshot,
} from '../../src/testing/snapshot/structural.js';

describe('structural snapshots', () => {
  it('serializes DOM into a stable form', () => {
    document.body.innerHTML = '<section class="a" id="x"><span>hi</span></section>';
    const out = serializeDom(document.body);
    expect(out).toContain('<section class="a" id="x">');
    expect(out).toContain('<span>hi</span>');
  });

  it('creates a baseline in update mode and matches next run', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'snap-'));
    mkdirSync(dir, { recursive: true });
    configureSnapshots({ componentDir: dir, updateMode: true });

    document.body.innerHTML = '<div>hello</div>';
    await snapshot('default');
    const written = readFileSync(join(dir, 'default.snap.txt'), 'utf8');
    expect(written).toContain('<div>hello</div>');

    // second run, non-update, must pass because baseline exists
    configureSnapshots({ componentDir: dir, updateMode: false });
    await snapshot('default');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/testing/structural.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Write `src/testing/snapshot/structural.ts`:
```ts
import { AssertionError } from '../expect.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

interface SnapshotConfig {
  componentDir: string;
  updateMode: boolean;
}

let config: SnapshotConfig | null = null;

export function configureSnapshots(opts: SnapshotConfig): void {
  config = opts;
}

function attrString(attrs: NamedNodeMap): string {
  const pairs = [...attrs].map((a) => [a.name, a.value] as const);
  pairs.sort(([a], [b]) => a.localeCompare(b));
  return pairs.map(([n, v]) => ` ${n}="${v.replace(/"/g, '&quot;')}"`).join('');
}

function serializeNode(node: Node, depth: number, out: string[]): void {
  const indent = '  '.repeat(depth);
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent ?? '').trim();
    if (text) out.push(`${indent}${text}`);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  const attrs = attrString(el.attributes);
  if (el.childNodes.length === 0) {
    out.push(`${indent}<${tag}${attrs}/>`);
    return;
  }
  out.push(`${indent}<${tag}${attrs}>`);
  for (const child of el.childNodes) serializeNode(child, depth + 1, out);
  out.push(`${indent}</${tag}>`);
}

export function serializeDom(root: Node): string {
  const out: string[] = [];
  for (const child of root.childNodes) serializeNode(child, 0, out);
  return out.join('\n');
}

async function readBaseline(path: string): Promise<string | null> {
  try {
    return await fs.readFile(path, 'utf8');
  } catch {
    return null;
  }
}

export async function snapshot(name: string, options?: { root?: Node }): Promise<void> {
  if (!config) throw new AssertionError('snapshot(): no config set; runner must call configureSnapshots()');
  const root = options?.root ?? document.body;
  const serialized = serializeDom(root);
  const path = join(config.componentDir, `${name}.snap.txt`);
  const baseline = await readBaseline(path);
  if (baseline === null) {
    if (!config.updateMode) {
      throw new AssertionError(
        `snapshot(${name}): no baseline. Rerun with --update-snapshots to create ${path}.`,
      );
    }
    await fs.mkdir(config.componentDir, { recursive: true });
    await fs.writeFile(path, serialized, 'utf8');
    return;
  }
  if (baseline !== serialized) {
    if (config.updateMode) {
      await fs.writeFile(path, serialized, 'utf8');
      return;
    }
    throw new AssertionError(
      `snapshot(${name}): mismatch\n---baseline---\n${baseline}\n---actual---\n${serialized}`,
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/testing/structural.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/testing/snapshot/structural.ts tests/testing/structural.test.ts
git commit -m "feat(testing): structural DOM snapshots"
```

---

## Task 9: Runtime accessibility check via axe-core

**Files:**
- Create: `src/testing/a11y/runtime.ts`
- Test: `tests/testing/runtime-a11y.test.ts`

**Interfaces:**
- Produces: `axe(root?: Node): Promise<AxeResult>` where `AxeResult = { violations: Array<{ id: string; description: string }> }`. In happy-dom, uses `axe-core`'s Node-friendly path.

- [ ] **Step 1: Write the failing test**

Write `tests/testing/runtime-a11y.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { axe } from '../../src/testing/a11y/runtime.js';

describe('runtime axe()', () => {
  it('returns an empty violation list for accessible markup', async () => {
    document.body.innerHTML = '<main><h1>Hello</h1><p>ok</p></main>';
    const result = await axe(document.body);
    expect(result.violations).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/testing/runtime-a11y.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Write `src/testing/a11y/runtime.ts`:
```ts
// axe-core is UMD-shaped; import its default export and coerce.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import axeCore from 'axe-core';

export interface AxeResult {
  violations: Array<{ id: string; description: string; nodes: unknown[] }>;
}

interface AxeAdapter {
  run: (
    context: Node | Document | undefined,
    options: Record<string, unknown>,
  ) => Promise<AxeResult>;
}

const adapter = axeCore as unknown as AxeAdapter;

export async function axe(root?: Node): Promise<AxeResult> {
  const target = root ?? document;
  const result = await adapter.run(target, { resultTypes: ['violations'] });
  return { violations: result.violations };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/testing/runtime-a11y.test.ts`
Expected: PASS — 1 test. If axe emits warnings in happy-dom, they are tolerated as long as violations is empty.

- [ ] **Step 5: Commit**

```bash
git add src/testing/a11y/runtime.ts tests/testing/runtime-a11y.test.ts
git commit -m "feat(testing): runtime axe() accessibility check"
```

---

## Task 10: Pixel-diff pure contract (no browser)

**Files:**
- Create: `src/testing/snapshot/pixel.ts`
- Test: `tests/testing/pixel-contract.test.ts`

**Interfaces:**
- Produces the pure diff step of pixel snapshots, without a browser:
  - `diffPngs(baseline: Buffer, actual: Buffer, threshold: number): { equal: boolean; diffPixels: number; diffPng: Buffer }`
  - `pixel(name: string, opts?: { threshold?: number }): Promise<void>` — placeholder that requires a browser driver injected via `configurePixelDriver({ takeScreenshot, componentDir, updateMode })`. Task 15 wires the Playwright driver.

- [ ] **Step 1: Write the failing test**

Write `tests/testing/pixel-contract.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { diffPngs } from '../../src/testing/snapshot/pixel.js';

function solidPng(w: number, h: number, r: number, g: number, b: number): Buffer {
  const png = new PNG({ width: w, height: h });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = b; png.data[i + 3] = 255;
  }
  return PNG.sync.write(png);
}

describe('diffPngs()', () => {
  it('reports 0 diff for identical images', () => {
    const a = solidPng(4, 4, 255, 0, 0);
    const b = solidPng(4, 4, 255, 0, 0);
    const result = diffPngs(a, b, 0.1);
    expect(result.equal).toBeTruthy();
    expect(result.diffPixels).toBe(0);
  });

  it('reports mismatch on different images', () => {
    const a = solidPng(4, 4, 255, 0, 0);
    const b = solidPng(4, 4, 0, 0, 255);
    const result = diffPngs(a, b, 0.1);
    expect(result.equal).toBeFalsy();
    expect(result.diffPixels).toBeGreaterThan(0);
  });
});
```

Change the assertion helpers if needed — my minimal expect() does not have `toBeGreaterThan`. Extend `expect.ts` from Task 5 to add `toBeGreaterThan(n: number)` before running this task's test:

Edit `src/testing/expect.ts` interface `Assertion` and implementation to add:
```ts
toBeGreaterThan(n: number): void;
```
Implementation:
```ts
toBeGreaterThan(n) {
  if (typeof actual !== 'number' || !(actual > n)) {
    throw new AssertionError(`toBeGreaterThan: ${stringify(actual)} is not > ${n}`);
  }
},
```

(This is a legitimate additive change; the earlier expect test still passes.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/testing/pixel-contract.test.ts`
Expected: FAIL — `diffPngs` not found.

- [ ] **Step 3: Implement**

Write `src/testing/snapshot/pixel.ts`:
```ts
import { AssertionError } from '../expect.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

export interface DiffResult {
  equal: boolean;
  diffPixels: number;
  diffPng: Buffer;
}

export function diffPngs(baselineBuf: Buffer, actualBuf: Buffer, threshold: number): DiffResult {
  const base = PNG.sync.read(baselineBuf);
  const act = PNG.sync.read(actualBuf);
  if (base.width !== act.width || base.height !== act.height) {
    return { equal: false, diffPixels: base.width * base.height + act.width * act.height, diffPng: actualBuf };
  }
  const diff = new PNG({ width: base.width, height: base.height });
  const count = pixelmatch(base.data, act.data, diff.data, base.width, base.height, { threshold });
  return { equal: count === 0, diffPixels: count, diffPng: PNG.sync.write(diff) };
}

interface PixelConfig {
  componentDir: string;
  updateMode: boolean;
  takeScreenshot: (name: string) => Promise<Buffer>;
}

let config: PixelConfig | null = null;

export function configurePixelDriver(opts: PixelConfig): void {
  config = opts;
}

export async function pixel(name: string, opts?: { threshold?: number }): Promise<void> {
  if (!config) throw new AssertionError('pixel(): no driver configured; the runner sets one for the browser environment');
  const path = join(config.componentDir, `${name}.png`);
  const actual = await config.takeScreenshot(name);
  let baseline: Buffer | null = null;
  try {
    baseline = await fs.readFile(path);
  } catch {
    baseline = null;
  }
  if (!baseline) {
    if (!config.updateMode) {
      throw new AssertionError(`pixel(${name}): no baseline. Rerun with --update-snapshots to create ${path}.`);
    }
    await fs.mkdir(config.componentDir, { recursive: true });
    await fs.writeFile(path, actual);
    return;
  }
  const result = diffPngs(baseline, actual, opts?.threshold ?? 0.1);
  if (!result.equal) {
    if (config.updateMode) {
      await fs.writeFile(path, actual);
      return;
    }
    throw new AssertionError(`pixel(${name}): mismatch, ${result.diffPixels} pixels differ.`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/testing/pixel-contract.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/testing/snapshot/pixel.ts src/testing/expect.ts tests/testing/pixel-contract.test.ts
git commit -m "feat(testing): pixel-diff pure contract + expect.toBeGreaterThan"
```

---

## Task 11: `src/testing/index.ts` — public re-exports for injected globals

**Files:**
- Create: `src/testing/index.ts`

**Interfaces:**
- Produces: barrel that re-exports every symbol the test-module skeleton injects: `it`, `describe`, `beforeEach`, `expect`, `snapshot`, `pixel`, `axe`, `flushSync`, `capture`, `fixtures` (see runner note), plus setup/config helpers (`configureSnapshots`, `configurePixelDriver`, `runTree`, `getCollectedTree`).

- [ ] **Step 1: Write the barrel**

Write `src/testing/index.ts`:
```ts
export { beforeEach, describe, getCollectedTree, it } from './collect.js';
export { runTree } from './run.js';
export type { RunResult, TestOutcome } from './run.js';
export { expect, AssertionError } from './expect.js';
export { capture } from './capture.js';
export { configureSnapshots, snapshot, serializeDom } from './snapshot/structural.js';
export { configurePixelDriver, diffPngs, pixel } from './snapshot/pixel.js';
export { axe } from './a11y/runtime.js';
export { flushSync } from '../runtime/scheduler.js';
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `pnpm build`
Expected: no compilation errors (any leftover imports resolve).

- [ ] **Step 3: Commit**

```bash
git add src/testing/index.ts
git commit -m "feat(testing): public barrel for injected globals"
```

---

## Task 12: Compiler — `testCompile()` emits a per-SFC test module

**Files:**
- Create: `src/compiler/testCompile.ts`
- Modify: `src/compiler/index.ts`
- Test: `tests/compiler/testCompile.test.ts`

**Interfaces:**
- Produces:
  - `testCompile(source: string): { modules: Array<{ kind: 'happy-dom' | 'browser'; js: string }> } | null` — returns `null` when the SFC has no `test*` blocks.
  - Modules emitted are stand-alone ESM strings that:
    1. Import runtime + testing globals.
    2. Inline the component boot (identical shape as Phase 0 `compile()`).
    3. Declare a top-level `const fixtures = { ... }` from the `json fixtures` block.
    4. Declare a `function __applyMocks() { ... }` from the `ts mock` block.
    5. Wrap every `test*` block in a `describe('<file>:<role>', () => { beforeEach(__applyMocks); ... })`.
    6. Export `default async function () { return runTree(getCollectedTree()); }`.

Grouping rule: `test`, `test:interaction`, `test:visual`, `test:a11y` → `happy-dom` module. `test:visual:pixel`, `test:a11y:browser` → `browser` module.

- [ ] **Step 1: Write the failing test**

Write `tests/compiler/testCompile.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { testCompile } from '../../src/compiler/testCompile.js';

const SFC = `---
name: Todo
tag: app-todo
---

\`\`\`html template
<span>hi</span>
\`\`\`

\`\`\`json fixtures
{ "one": { "id": "1" } }
\`\`\`

\`\`\`ts mock
// noop
\`\`\`

\`\`\`ts test
it('passes', () => { expect(1).toBe(1); });
\`\`\`

\`\`\`ts test:visual:pixel
pixel('default', fixtures.one);
\`\`\`
`;

describe('testCompile()', () => {
  it('returns null when no test* blocks are present', () => {
    const noTests = SFC.replace(/```ts test[\s\S]*?```/g, '');
    expect(testCompile(noTests)).toBeNull();
  });

  it('emits a happy-dom module for fast blocks and a browser module for pixel blocks', () => {
    const result = testCompile(SFC)!;
    expect(result.modules).toHaveLength(2);
    const happyDom = result.modules.find((m) => m.kind === 'happy-dom')!;
    const browser = result.modules.find((m) => m.kind === 'browser')!;
    expect(happyDom.js).toContain('const fixtures = { "one": { "id": "1" } };');
    expect(happyDom.js).toContain('function __applyMocks()');
    expect(happyDom.js).toContain(`describe('todo.md:test'`);
    expect(happyDom.js).toContain('runTree(getCollectedTree())');
    expect(browser.js).toContain(`describe('todo.md:test:visual:pixel'`);
    expect(browser.js).not.toContain(`describe('todo.md:test'`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/compiler/testCompile.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Write `src/compiler/testCompile.ts`:
```ts
import { parseSfc } from './sfc.js';
import { parseTemplate } from './template/parse.js';
import { transformDirectives } from './template/transform.js';
import { codegen } from './template/codegen.js';

const RUNTIME_IMPORTS =
  'import { defineComponent, defineEmits, registry, createToken, __el, __text, __bind, __if, __for, __case, __fragment, CASE_DEFAULT } from "ui-detox";';
const TESTING_IMPORTS =
  'import { it, describe, beforeEach, expect, capture, snapshot, pixel, axe, flushSync, getCollectedTree, runTree } from "ui-detox/testing";';

const HAPPY_DOM_ROLES = new Set(['test', 'test:interaction', 'test:visual', 'test:a11y']);
const BROWSER_ROLES = new Set(['test:visual:pixel', 'test:a11y:browser']);

const PROP_LINE = /^\s*(\w+)\s*[?:]/;

function extractPropNames(propsBlock: string | undefined): string[] {
  if (!propsBlock) return [];
  const inTypeBlock = /Props\s*=\s*\{([\s\S]*?)\}/m.exec(propsBlock);
  if (!inTypeBlock) return [];
  const names: string[] = [];
  for (const line of inTypeBlock[1].split('\n')) {
    const m = PROP_LINE.exec(line);
    if (m) names.push(m[1]);
  }
  return names;
}

function readTag(fm: Record<string, unknown>): string {
  const tag = fm.tag;
  if (typeof tag !== 'string' || !tag.includes('-')) {
    throw new Error('SFC frontmatter must define a "tag" containing at least one hyphen');
  }
  return tag;
}

export interface TestCompileResult {
  modules: Array<{ kind: 'happy-dom' | 'browser'; js: string }>;
}

export function testCompile(source: string, fileLabel = 'component.md'): TestCompileResult | null {
  const sfc = parseSfc(source);
  const testBlocks = sfc.blocks.filter((b) => b.role.startsWith('test'));
  if (testBlocks.length === 0) return null;

  const tag = readTag(sfc.frontmatter);
  const template = sfc.blocks.find((b) => b.role === 'template');
  if (!template) throw new Error('SFC must contain an `html template` block');
  const script = sfc.blocks.find((b) => b.role === 'script');
  const style = sfc.blocks.find((b) => b.role === 'style');
  const props = sfc.blocks.find((b) => b.role === 'props');
  const fixtures = sfc.blocks.find((b) => b.role === 'fixtures');
  const mock = sfc.blocks.find((b) => b.role === 'mock');

  const ast = transformDirectives(parseTemplate(template.content));
  const templateBody = codegen(ast);
  const propNames = extractPropNames(props?.content);
  const styleField = style ? `,\n  style: ${JSON.stringify(style.content)}` : '';

  const preamble = `${RUNTIME_IMPORTS}
${TESTING_IMPORTS}

function boot(ctx) {
  const { props, host } = ctx;
${script?.content ?? ''}
  return ${templateBody};
}

defineComponent({
  tag: ${JSON.stringify(tag)},
  props: ${JSON.stringify(propNames)},
  boot${styleField}
});

const fixtures = ${fixtures ? fixtures.content : '{}'};

function __applyMocks() {
${mock?.content ?? '// no mocks'}
}
`;

  function wrap(role: string, body: string): string {
    return `describe(${JSON.stringify(`${fileLabel}:${role}`)}, () => {\n  beforeEach(__applyMocks);\n${body}\n});\n`;
  }

  const happyBlocks = testBlocks.filter((b) => HAPPY_DOM_ROLES.has(b.role));
  const browserBlocks = testBlocks.filter((b) => BROWSER_ROLES.has(b.role));

  const modules: TestCompileResult['modules'] = [];
  if (happyBlocks.length > 0) {
    const wrapped = happyBlocks.map((b) => wrap(b.role, b.content)).join('\n');
    modules.push({
      kind: 'happy-dom',
      js: `${preamble}
${wrapped}
export default async function () { return runTree(getCollectedTree()); }
`,
    });
  }
  if (browserBlocks.length > 0) {
    const wrapped = browserBlocks.map((b) => wrap(b.role, b.content)).join('\n');
    modules.push({
      kind: 'browser',
      js: `${preamble}
${wrapped}
export default async function () { return runTree(getCollectedTree()); }
`,
    });
  }
  return { modules };
}
```

Edit `src/compiler/index.ts`:
```ts
export { testCompile } from './testCompile.js';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/compiler/testCompile.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/compiler/testCompile.ts src/compiler/index.ts tests/compiler/testCompile.test.ts
git commit -m "feat(compiler): testCompile emits per-SFC test modules"
```

---

## Task 13: Runner discovery — walk `<dir>` and emit test modules to cache

**Files:**
- Create: `src/cli/testRunner/discover.ts`
- Test: `tests/cli/discover.test.ts`

**Interfaces:**
- Produces:
  - `discover(inputDir: string, cacheDir: string): Promise<Discovered>` where
    ```ts
    interface DiscoveredModule { sfcPath: string; kind: 'happy-dom' | 'browser'; cachePath: string; }
    interface Discovered { modules: DiscoveredModule[]; }
    ```
  - Walks `.md` files, calls `testCompile()`, writes each module string to `<cacheDir>/<rel>.<kind>.test.mjs`, returns the discovered list. Files without test blocks are skipped.

- [ ] **Step 1: Write the failing test**

Write `tests/cli/discover.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discover } from '../../src/cli/testRunner/discover.js';

const SFC = `---
name: Todo
tag: app-todo
---

\`\`\`html template
<span>hi</span>
\`\`\`

\`\`\`ts test
it('ok', () => { expect(1).toBe(1); });
\`\`\`
`;

describe('discover()', () => {
  it('writes test modules for SFCs that contain test blocks', async () => {
    const root = mkdtempSync(join(tmpdir(), 'uidetox-disco-'));
    const src = join(root, 'src');
    const cache = join(root, 'cache');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'Todo.md'), SFC);
    writeFileSync(join(src, 'Other.md'), '---\nname: Other\ntag: app-other\n---\n\n```html template\n<i/>\n```\n');
    const result = await discover(src, cache);
    expect(result.modules).toHaveLength(1);
    expect(result.modules[0].kind).toBe('happy-dom');
    expect(result.modules[0].sfcPath).toContain('Todo.md');
    expect(result.modules[0].cachePath).toContain('.happy-dom.test.mjs');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/cli/discover.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Write `src/cli/testRunner/discover.ts`:
```ts
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';
import { testCompile } from '../../compiler/testCompile.js';

export interface DiscoveredModule {
  sfcPath: string;
  kind: 'happy-dom' | 'browser';
  cachePath: string;
}

export interface Discovered {
  modules: DiscoveredModule[];
}

async function walk(dir: string, root = dir): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir)) {
    const full = join(dir, entry);
    const info = await stat(full);
    if (info.isDirectory()) out.push(...(await walk(full, root)));
    else if (extname(full) === '.md') out.push(relative(root, full));
  }
  return out;
}

export async function discover(inputDir: string, cacheDir: string): Promise<Discovered> {
  const rels = await walk(inputDir);
  await mkdir(cacheDir, { recursive: true });
  const modules: DiscoveredModule[] = [];
  for (const rel of rels) {
    const sfcPath = join(inputDir, rel);
    const source = await readFile(sfcPath, 'utf8');
    const compiled = testCompile(source, rel);
    if (!compiled) continue;
    for (const mod of compiled.modules) {
      const cacheRel = rel.replace(/\.md$/, `.${mod.kind}.test.mjs`);
      const cachePath = join(cacheDir, cacheRel);
      await mkdir(dirname(cachePath), { recursive: true });
      await writeFile(cachePath, mod.js, 'utf8');
      modules.push({ sfcPath, kind: mod.kind, cachePath });
    }
  }
  return { modules };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/cli/discover.test.ts`
Expected: PASS — 1 test.

- [ ] **Step 5: Commit**

```bash
git add src/cli/testRunner/discover.ts tests/cli/discover.test.ts
git commit -m "feat(cli): discover + emit test modules to a cache dir"
```

---

## Task 14: happy-dom in-process environment

**Files:**
- Create: `src/cli/testRunner/happyDomEnv.ts`
- Test: `tests/cli/happyDomEnv.test.ts`

**Interfaces:**
- Produces:
  - `runInHappyDom(cachePath: string, componentSnapshotDir: string, updateMode: boolean): Promise<RunResult>` — spins up a fresh `Window` from happy-dom, seeds `document`/`window` globals, calls `configureSnapshots` for structural snapshots (pixel is not configured in this env), dynamic-imports the module, awaits its default export.
- Rewrites `import { … } from 'ui-detox'` and `'ui-detox/testing'` in the module string to the local runtime paths (so the module runs without needing the package published).

- [ ] **Step 1: Write the failing test**

Write `tests/cli/happyDomEnv.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discover } from '../../src/cli/testRunner/discover.js';
import { runInHappyDom } from '../../src/cli/testRunner/happyDomEnv.js';

const SFC = `---
name: Todo
tag: app-todo
---

\`\`\`html template
<span>hi \${props.title ?? "x"}</span>
\`\`\`

\`\`\`ts test
it('renders title', () => {
  document.body.innerHTML = '<app-todo title="Y"></app-todo>';
  const el = document.body.querySelector('app-todo');
  expect(el?.querySelector('span')?.textContent).toBe('hi Y');
});
\`\`\`
`;

describe('runInHappyDom()', () => {
  it('executes an emitted test module and reports pass/fail', async () => {
    const root = mkdtempSync(join(tmpdir(), 'uidetox-hd-'));
    const src = join(root, 'src');
    const cache = join(root, 'cache');
    const snapDir = join(root, 'snap');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'Todo.md'), SFC);
    const { modules } = await discover(src, cache);
    const result = await runInHappyDom(modules[0].cachePath, snapDir, false);
    expect(result.failed).toBe(0);
    expect(result.passed).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/cli/happyDomEnv.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Write `src/cli/testRunner/happyDomEnv.ts`:
```ts
import { Window } from 'happy-dom';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { configureSnapshots } from '../../testing/snapshot/structural.js';
import type { RunResult } from '../../testing/run.js';

const RUNTIME_PATH = new URL('../../runtime/index.ts', import.meta.url).pathname;
const TESTING_PATH = new URL('../../testing/index.ts', import.meta.url).pathname;

function rewriteImports(src: string): string {
  return src
    .replace(/from ["']uidetox\/testing["']/g, `from "${TESTING_PATH}"`)
    .replace(/from ["']uidetox["']/g, `from "${RUNTIME_PATH}"`);
}

async function stageModule(cachePath: string): Promise<string> {
  const original = await readFile(cachePath, 'utf8');
  const staged = rewriteImports(original);
  const stagedPath = cachePath.replace(/\.mjs$/, '.staged.mjs');
  await mkdir(dirname(stagedPath), { recursive: true });
  await writeFile(stagedPath, staged, 'utf8');
  return stagedPath;
}

function seedGlobals(window: Window): () => void {
  const prev = new Map<string, unknown>();
  const keys = ['window', 'document', 'HTMLElement', 'Element', 'Node', 'CustomEvent', 'Event', 'customElements'];
  for (const k of keys) {
    prev.set(k, (globalThis as Record<string, unknown>)[k]);
    (globalThis as Record<string, unknown>)[k] = (window as unknown as Record<string, unknown>)[k];
  }
  return () => {
    for (const k of keys) (globalThis as Record<string, unknown>)[k] = prev.get(k);
  };
}

export async function runInHappyDom(
  cachePath: string,
  componentSnapshotDir: string,
  updateMode: boolean,
): Promise<RunResult> {
  const window = new Window({ url: 'http://uidetox.local/' });
  const restore = seedGlobals(window);
  try {
    configureSnapshots({ componentDir: componentSnapshotDir, updateMode });
    const stagedPath = await stageModule(cachePath);
    const url = pathToFileURL(stagedPath).href + `?v=${Math.random().toString(36).slice(2)}`;
    const mod = (await import(url)) as { default: () => Promise<RunResult> };
    return await mod.default();
  } finally {
    restore();
  }
}

void join; // keep import
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/cli/happyDomEnv.test.ts`
Expected: PASS — 1 test.

- [ ] **Step 5: Commit**

```bash
git add src/cli/testRunner/happyDomEnv.ts tests/cli/happyDomEnv.test.ts
git commit -m "feat(cli): run test modules in an in-process happy-dom env"
```

---

## Task 15: Playwright environment for pixel + browser-a11y

**Files:**
- Create: `src/cli/testRunner/playwrightEnv.ts`, `src/testing/a11y/browser.ts`
- Test: `tests/cli/playwrightEnv.test.ts`

**Interfaces:**
- Produces:
  - `runInPlaywright(cachePath, snapDir, updateMode): Promise<RunResult>` — launches Chromium, opens a blank page, exposes `takeScreenshot` and `axeBrowser` bindings, imports the emitted browser module via a data URL, awaits its default.
  - `axeBrowser(root?: Node)` — in-page runner; loaded from `axe-core/axe.min.js`.

- [ ] **Step 1: Skip network install in unit tests**

Playwright expects Chromium to be installed. For CI/dev the plan documents that. The unit test **does not** launch a browser — it verifies the module compiles and reports a helpful error if Playwright is not installed.

Write `tests/cli/playwrightEnv.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { runInPlaywright } from '../../src/cli/testRunner/playwrightEnv.js';

describe('runInPlaywright()', () => {
  it('exposes a runner function that gracefully reports a missing browser', async () => {
    const originalEnv = process.env.PLAYWRIGHT_SKIP;
    process.env.PLAYWRIGHT_SKIP = '1';
    try {
      const result = await runInPlaywright('/nonexistent.mjs', '/tmp', false);
      expect(result.failed).toBe(1);
      expect(result.outcomes[0].error).toContain('PLAYWRIGHT_SKIP');
    } finally {
      process.env.PLAYWRIGHT_SKIP = originalEnv;
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/cli/playwrightEnv.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Write `src/testing/a11y/browser.ts`:
```ts
export const axeBrowserBootstrapCdn =
  'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.1/axe.min.js';
```

Write `src/cli/testRunner/playwrightEnv.ts`:
```ts
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { basename } from 'node:path';
import type { RunResult } from '../../testing/run.js';

interface PlaywrightModule {
  chromium: {
    launch: (opts?: { headless?: boolean }) => Promise<PlaywrightBrowser>;
  };
}
interface PlaywrightBrowser {
  newContext: () => Promise<PlaywrightContext>;
  close: () => Promise<void>;
}
interface PlaywrightContext {
  newPage: () => Promise<PlaywrightPage>;
  close: () => Promise<void>;
}
interface PlaywrightPage {
  goto: (url: string) => Promise<unknown>;
  addScriptTag: (opts: { url?: string; content?: string }) => Promise<unknown>;
  evaluate: <T>(fn: string | (() => T)) => Promise<T>;
  screenshot: (opts?: { fullPage?: boolean }) => Promise<Buffer>;
}

async function loadPlaywright(): Promise<PlaywrightModule | null> {
  try {
    return (await import('playwright')) as unknown as PlaywrightModule;
  } catch {
    return null;
  }
}

export async function runInPlaywright(
  cachePath: string,
  componentSnapshotDir: string,
  updateMode: boolean,
): Promise<RunResult> {
  if (process.env.PLAYWRIGHT_SKIP === '1') {
    return {
      outcomes: [
        {
          path: basename(cachePath),
          ok: false,
          durationMs: 0,
          error: 'PLAYWRIGHT_SKIP=1 was set; skipping browser tests',
        },
      ],
      passed: 0,
      failed: 1,
    };
  }
  const pw = await loadPlaywright();
  if (!pw) {
    return {
      outcomes: [
        {
          path: basename(cachePath),
          ok: false,
          durationMs: 0,
          error: 'playwright package could not be loaded. Run `pnpm playwright install chromium`.',
        },
      ],
      passed: 0,
      failed: 1,
    };
  }
  const browser = await pw.chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto('about:blank');
    await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.1/axe.min.js' });
    const moduleSource = await readFile(cachePath, 'utf8');
    // For MVP the runner evaluates the module via inline script tag.
    void componentSnapshotDir; void updateMode; void pathToFileURL;
    await page.addScriptTag({ content: `${moduleSource}\nwindow.__runTests = default_1;` });
    const raw = await page.evaluate<string>('JSON.stringify(await window.__runTests())');
    return JSON.parse(raw) as RunResult;
  } finally {
    await context.close();
    await browser.close();
  }
}
```

The MVP path evaluates the emitted browser module inside a `<script>` tag. Real pixel/a11y support requires the browser module to import runtime helpers too — for Phase 1a MVP the emitted browser module is expected to be **self-contained** (imports are stripped by a follow-up step, out of MVP scope). The `PLAYWRIGHT_SKIP` fast path lets the CLI still exit cleanly in environments where Chromium is unavailable, and unit tests use it.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/cli/playwrightEnv.test.ts`
Expected: PASS — 1 test (via `PLAYWRIGHT_SKIP=1` code path).

- [ ] **Step 5: Commit**

```bash
git add src/cli/testRunner/playwrightEnv.ts src/testing/a11y/browser.ts tests/cli/playwrightEnv.test.ts
git commit -m "feat(cli): Playwright environment with graceful skip"
```

---

## Task 16: Reporter

**Files:**
- Create: `src/cli/testRunner/report.ts`
- Test: `tests/cli/report.test.ts`

**Interfaces:**
- Produces:
  - `renderHuman(byFile: Record<string, RunResult>): string`
  - `renderJson(byFile: Record<string, RunResult>): string`
  - Human render mirrors the sample layout from the spec, without ANSI codes when `NO_COLOR` is set or `process.stdout.isTTY` is false.

- [ ] **Step 1: Write the failing test**

Write `tests/cli/report.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { renderHuman, renderJson } from '../../src/cli/testRunner/report.js';

const results = {
  'todo.md:happy-dom': {
    outcomes: [
      { path: 'todo.md:test > renders', ok: true, durationMs: 12 },
      { path: 'todo.md:test:a11y > has no violations', ok: false, durationMs: 5, error: 'boom' },
    ],
    passed: 1,
    failed: 1,
  },
};

describe('reporters', () => {
  it('human reporter includes file, block, count and failing message', () => {
    process.env.NO_COLOR = '1';
    const text = renderHuman(results);
    expect(text).toContain('todo.md');
    expect(text).toContain('happy-dom');
    expect(text).toContain('boom');
    expect(text).toContain('2 tests, 1 passed, 1 failed');
  });

  it('json reporter emits parseable JSON', () => {
    const parsed = JSON.parse(renderJson(results));
    expect(parsed['todo.md:happy-dom'].failed).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/cli/report.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Write `src/cli/testRunner/report.ts`:
```ts
import type { RunResult } from '../../testing/run.js';

const ANSI_OFF = process.env.NO_COLOR || !process.stdout.isTTY;

function color(code: string, text: string): string {
  return ANSI_OFF ? text : `\x1b[${code}m${text}\x1b[0m`;
}

const green = (t: string) => color('32', t);
const red = (t: string) => color('31', t);
const dim = (t: string) => color('2', t);

export function renderHuman(byFile: Record<string, RunResult>): string {
  const lines: string[] = [];
  let total = 0, passed = 0, failed = 0;
  for (const [file, result] of Object.entries(byFile)) {
    total += result.outcomes.length;
    passed += result.passed;
    failed += result.failed;
    const mark = result.failed === 0 ? green('✔') : red('✖');
    lines.push(`${mark} ${file}  ${dim(`(${result.outcomes.length} tests)`)}`);
    for (const o of result.outcomes) {
      if (!o.ok) lines.push(`  · ${red(o.path)}: ${o.error?.split('\n')[0] ?? ''}`);
    }
  }
  lines.push('');
  lines.push(`${total} tests, ${passed} passed, ${failed} failed`);
  return lines.join('\n');
}

export function renderJson(byFile: Record<string, RunResult>): string {
  return JSON.stringify(byFile, null, 2);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/cli/report.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/cli/testRunner/report.ts tests/cli/report.test.ts
git commit -m "feat(cli): human + json reporters"
```

---

## Task 17: `ui-detox test` CLI command

**Files:**
- Create: `src/cli/test.ts`
- Modify: `package.json` (`bin` entry unchanged; the CLI just exposes an additional command name)
- Test: `tests/cli/test-command.test.ts`

**Interfaces:**
- Produces: `runTest(options: { inputDir: string; cacheDir?: string; snapshotsDir?: string; updateSnapshots?: boolean; filter?: string; only?: string; reporter?: 'human' | 'json'; }): Promise<{ passed: number; failed: number; report: string }>`.
- CLI: `ui-detox test <inputDir> [--out <cacheDir>] [--snapshots <dir>] [--update-snapshots] [--filter <glob>] [--only <role>] [--reporter <human|json>]`.

- [ ] **Step 1: Write the failing test**

Write `tests/cli/test-command.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runTest } from '../../src/cli/test.js';

const PASS = `---
name: Ok
tag: x-ok
---

\`\`\`html template
<span>hi</span>
\`\`\`

\`\`\`ts test
it('passes', () => { expect(1).toBe(1); });
\`\`\`
`;

const FAIL = `---
name: Fail
tag: x-fail
---

\`\`\`html template
<span>hi</span>
\`\`\`

\`\`\`ts test
it('fails', () => { expect(1).toBe(2); });
\`\`\`
`;

describe('runTest()', () => {
  it('runs happy-dom test blocks across an input directory', async () => {
    const root = mkdtempSync(join(tmpdir(), 'uidetox-cli-'));
    const src = join(root, 'src');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'Ok.md'), PASS);
    writeFileSync(join(src, 'Fail.md'), FAIL);
    const result = await runTest({ inputDir: src, cacheDir: join(root, 'cache'), snapshotsDir: join(root, 'snap') });
    expect(result.passed).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.report).toContain('Ok.md');
    expect(result.report).toContain('Fail.md');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/cli/test-command.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Write `src/cli/test.ts`:
```ts
#!/usr/bin/env node
import { Command } from 'commander';
import { join } from 'node:path';
import { discover } from './testRunner/discover.js';
import { runInHappyDom } from './testRunner/happyDomEnv.js';
import { runInPlaywright } from './testRunner/playwrightEnv.js';
import { renderHuman, renderJson } from './testRunner/report.js';
import type { RunResult } from '../testing/run.js';

export interface TestOptions {
  inputDir: string;
  cacheDir?: string;
  snapshotsDir?: string;
  updateSnapshots?: boolean;
  filter?: string;
  only?: string;
  reporter?: 'human' | 'json';
}

export async function runTest(options: TestOptions): Promise<{ passed: number; failed: number; report: string }> {
  const cacheDir = options.cacheDir ?? join(options.inputDir, '..', '.uidetox', 'test-cache');
  const snapshotsDir = options.snapshotsDir ?? join(options.inputDir, '..', 'snapshots');
  const filter = options.filter ? new RegExp(options.filter) : null;
  const discovered = await discover(options.inputDir, cacheDir);

  const byFile: Record<string, RunResult> = {};
  for (const mod of discovered.modules) {
    if (filter && !filter.test(mod.sfcPath)) continue;
    const componentName = mod.sfcPath.replace(/^.*\//, '').replace(/\.md$/, '');
    const componentSnapDir = join(snapshotsDir, componentName);
    const key = `${mod.sfcPath}:${mod.kind}`;
    if (mod.kind === 'happy-dom') {
      byFile[key] = await runInHappyDom(mod.cachePath, componentSnapDir, !!options.updateSnapshots);
    } else {
      byFile[key] = await runInPlaywright(mod.cachePath, componentSnapDir, !!options.updateSnapshots);
    }
  }
  const passed = Object.values(byFile).reduce((a, r) => a + r.passed, 0);
  const failed = Object.values(byFile).reduce((a, r) => a + r.failed, 0);
  const report = options.reporter === 'json' ? renderJson(byFile) : renderHuman(byFile);
  return { passed, failed, report };
}

const program = new Command();
program
  .name('ui-detox')
  .command('test <inputDir>')
  .option('-o, --out <dir>', 'Cache directory for compiled test modules')
  .option('-s, --snapshots <dir>', 'Directory to read/write baselines')
  .option('-u, --update-snapshots', 'Write missing / mismatched baselines')
  .option('-f, --filter <regex>', 'Only run SFCs whose path matches')
  .option('--only <role>', 'Run only blocks of this role')
  .option('--reporter <format>', 'Reporter (human|json)', 'human')
  .action(async (inputDir: string, opts: { out?: string; snapshots?: string; updateSnapshots?: boolean; filter?: string; only?: string; reporter?: 'human' | 'json' }) => {
    const result = await runTest({
      inputDir,
      cacheDir: opts.out,
      snapshotsDir: opts.snapshots,
      updateSnapshots: opts.updateSnapshots,
      filter: opts.filter,
      only: opts.only,
      reporter: opts.reporter,
    });
    process.stdout.write(result.report + '\n');
    process.exit(result.failed === 0 ? 0 : 1);
  });

if (process.argv[1]?.endsWith('test.ts') || process.argv[1]?.endsWith('test.js')) {
  program.parseAsync(process.argv);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/cli/test-command.test.ts`
Expected: PASS — 1 test.

- [ ] **Step 5: Commit**

```bash
git add src/cli/test.ts tests/cli/test-command.test.ts
git commit -m "feat(cli): ui-detox test command"
```

---

## Task 18: Example — `examples/todo/Todo.md` with every block role that runs in happy-dom

**Files:**
- Create: `examples/todo/Todo.md`
- Test: `tests/e2e/phase1a-todo.test.ts`

**Interfaces:**
- Produces: an end-to-end demonstration that a component authored with `fixtures`, `mock`, `test`, `test:visual`, `test:a11y` runs green through `runTest()`.

Pixel and browser-a11y blocks are excluded from this example — they require a live Chromium install and are covered by Task 15's dedicated skip test.

- [ ] **Step 1: Create the example**

Write `examples/todo/Todo.md`:
````md
---
name: Todo
tag: app-todo
---

# Todo

Displays a single todo item with checkbox and text.

```ts props
export type Props = { id: string; title: string; done: boolean };
```

```html template
<li class="todo" data-done=${props.done}>
  <span>${props.title}</span>
</li>
```

```ts script
// no dynamic behaviour in this example
```

```json fixtures
{ "default": { "id": "1", "title": "Buy milk", "done": false } }
```

```ts mock
// no external deps to mock
```

```ts test
it('renders the title', () => {
  document.body.innerHTML = '<app-todo id="1" title="Buy milk" done="false"></app-todo>';
  const el = document.body.querySelector('app-todo');
  expect(el?.querySelector('span')?.textContent).toBe('Buy milk');
});
```

```ts test:visual
document.body.innerHTML = '<app-todo id="1" title="Buy milk" done="false"></app-todo>';
await snapshot('default');
```

```ts test:a11y
document.body.innerHTML = '<main><ul><app-todo id="1" title="Buy milk" done="false"></app-todo></ul></main>';
expect(await axe(document.body)).toHaveNoViolations();
```
````

- [ ] **Step 2: Write the failing E2E test**

Write `tests/e2e/phase1a-todo.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runTest } from '../../src/cli/test.js';

describe('phase 1a e2e — todo', () => {
  it('runs green through the CLI', async () => {
    const root = mkdtempSync(join(tmpdir(), 'uidetox-p1a-'));
    const cache = join(root, 'cache');
    const snap = join(root, 'snap');
    const result = await runTest({
      inputDir: join(process.cwd(), 'examples/todo'),
      cacheDir: cache,
      snapshotsDir: snap,
      updateSnapshots: true,   // create baseline on first run
    });
    expect(result.failed).toBe(0);
    expect(result.passed).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test tests/e2e/phase1a-todo.test.ts`
Expected: FAIL — expected count doesn't match, or missing snapshot baseline; iterate on the earlier tasks if needed. This test proves the whole pipeline is glued correctly.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/e2e/phase1a-todo.test.ts`
Expected: PASS — 1 test.

- [ ] **Step 5: Run the full framework suite**

Run: `pnpm test`
Expected: PASS — every runtime, compiler, testing, cli and e2e test.

- [ ] **Step 6: Commit**

```bash
git add examples/todo/Todo.md tests/e2e/phase1a-todo.test.ts
git commit -m "test(e2e): phase 1a example — todo runs green through ui-detox test"
```

---

## Self-Review Notes

- **Spec coverage:**
  - §3 block roles → Tasks 12 (compiler routing), 18 (example uses `test`, `test:visual`, `test:a11y`, plus `fixtures` and `mock`).
  - §5 architecture → Tasks 12 (test-module skeleton), 13 (cache write), 14 (happy-dom env), 15 (Playwright env).
  - §6 runtime additions → Tasks 2 (Registry), 3 (defineEmits), 4 (capture).
  - §7 utilities → Tasks 5 (expect), 6 (collect), 7 (run), 8 (snapshot), 9 (a11y runtime), 10 (pixel).
  - §8 CLI → Tasks 16 (reporter), 17 (`ui-detox test`).
  - §9 file layout matches Tasks 2–17.
  - §11 rendering interaction — explicitly deferred; no task needed.
  - §12 open questions — runner choice resolved (hand-rolled), Playwright install policy documented in Task 15, threshold fixed at 0.1 in Task 10.
- **Placeholder scan:** every step has real code / commands. No "TODO" text. The Playwright unit test uses `PLAYWRIGHT_SKIP=1` to avoid installing Chromium during CI of the framework itself.
- **Type consistency:** `RunResult` shape defined in Task 7, consumed by Tasks 14, 15, 16, 17. `Token`, `RegistryScope`, `Derived` types reused across Tasks 2, 12. `AssertionError` re-exported through the testing barrel in Task 11.

## Deferred to Later Plans

- `test:interaction` block gets no dedicated runtime helpers in Phase 1a beyond direct DOM APIs; a `user`-style helper is Phase 2.
- Full browser-side test module (proper module-import path via a served harness page) is Phase 2; Phase 1a's Playwright env uses inline script eval and a graceful skip.
- Watch mode (`ui-detox test --watch`) is Phase 2.
- Pixel tolerance per-test-role config, and cross-platform baseline handling, are Phase 2.

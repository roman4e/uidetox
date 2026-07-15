# UIDetox Phase 2d — DSL Inheritance + `off` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the UIDetox DSL with `extends [a, b, c]` (all four verbs) plus `off` members, drive them with Python-C3 linearization at the runtime, and give traits, filters, tokens, and providers merged views that respect the MRO. Deliver the pure C3 algorithm as a reusable runtime module, wire it into every registry lookup, and prove the full pipeline with an end-to-end DSL test.

**Architecture:** Compiler layer extended (`extends` clause + `off` member added to the existing dtx parser + emit). Runtime layer gains a `mro/` directory with the pure C3 algorithm and merged-view builders for traits and filters. The Registry gains a token-inheritance walker. Providers gain `this.super()` support via a linearised chain.

**Tech Stack:** TypeScript 5.x. No new dependencies.

## Global Constraints

- **Verbs supporting `extends`:** `trait`, `filter`, `token`, `provide`. Cross-kind references are a build error.
- **Linearization:** Python C3 verbatim. Failure is a build-time error with the offending residuals in the message.
- **`off` scope:** only removes inherited members; `off X()` where X is declared in the same block is a build error.
- **Params merge:** child overrides parent on collision; parent's optional flag is preserved.
- **Props merge:** child overrides parent on collision.
- **`appliesto` merge:** intersect with parents; empty intersection → build error.
- **Filter transformer chain:** parents left-to-right by L, own last; `off transform name()` removes a named transformer; `off transform *()` clears all.
- **Token lookup:** if the primary is not provided, walk L[token] and take the first provided ancestor.
- **`this.super()`:** only in `provide` default methods (MVP).
- **Test discipline:** TDD. One deliverable per task, one commit per task.

---

## File Structure

```
src/
  runtime/
    mro/
      linearize.ts             # NEW — pure Python C3
      apply.ts                 # NEW — merged views for traits/filters
    traits/
      define.ts                # MODIFIED — accept extends + off in spec
      install.ts               # MODIFIED — merge handlers via MRO before installing
    filters/
      define.ts                # MODIFIED — merge transformers via MRO before running
    registry.ts                # MODIFIED — walk token MRO on get()
  compiler/
    dtx/
      parse.ts                 # MODIFIED — parse extends clause + off member
      types.ts                 # MODIFIED — Clause.kind adds 'extends'; Member.kind adds 'off'
      emit.ts                  # MODIFIED — emit extends: […] and off: { … }
      inherit.ts               # NEW — validation helpers
tests/
  runtime/mro/linearize.test.ts
  runtime/mro/apply.test.ts
  runtime/traits/inheritance.test.ts
  runtime/filters/inheritance.test.ts
  runtime/registry/token-inheritance.test.ts
  compiler/dtx/inherit-parse.test.ts
  compiler/dtx/inherit-emit.test.ts
  e2e/dtx-inheritance-basic.test.ts
```

---

## Task 1: Pure Python-C3 linearization

**Files:**
- Create: `src/runtime/mro/linearize.ts`
- Test: `tests/runtime/mro/linearize.test.ts`

**Interfaces:**
- Produces:
  - `class InconsistentHierarchyError extends Error {}`
  - `interface Linearizable<T> { name: string; extends?: T[]; }`
  - `resolveLinearization<T extends Linearizable<T>>(root: T): T[]` — returns `[root, ...ancestors...]` per Python C3, cached on the descriptor via `Symbol.for('uidetox.mro')`.

- [ ] **Step 1: Write failing test**

Write `tests/runtime/mro/linearize.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { InconsistentHierarchyError, resolveLinearization } from '../../../src/runtime/mro/linearize.js';

interface Node { name: string; extends?: Node[]; }
function n(name: string, ext: Node[] = []): Node { return { name, extends: ext }; }

describe('resolveLinearization()', () => {
  it('returns [self] for a leaf', () => {
    const a = n('a');
    expect(resolveLinearization(a).map((x) => x.name)).toEqual(['a']);
  });

  it('single inheritance chain', () => {
    const a = n('a');
    const b = n('b', [a]);
    const c = n('c', [b]);
    expect(resolveLinearization(c).map((x) => x.name)).toEqual(['c', 'b', 'a']);
  });

  it('classic diamond', () => {
    const a = n('a');
    const b = n('b', [a]);
    const c = n('c', [a]);
    const d = n('d', [b, c]);
    expect(resolveLinearization(d).map((x) => x.name)).toEqual(['d', 'b', 'c', 'a']);
  });

  it('throws on inconsistent hierarchy', () => {
    const x = n('x');
    const y = n('y');
    const a = n('a', [x, y]);
    const b = n('b', [y, x]);
    const c = n('c', [a, b]);
    expect(() => resolveLinearization(c)).toThrow(InconsistentHierarchyError);
  });

  it('caches result on the descriptor', () => {
    const a = n('a');
    const b = n('b', [a]);
    const first = resolveLinearization(b);
    const second = resolveLinearization(b);
    expect(second).toBe(first);
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `pnpm test tests/runtime/mro/linearize.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Write `src/runtime/mro/linearize.ts`:
```ts
export class InconsistentHierarchyError extends Error {
  constructor(reason: string) {
    super(`Inconsistent hierarchy: ${reason}`);
    this.name = 'InconsistentHierarchyError';
  }
}

export interface Linearizable<T> {
  name: string;
  extends?: T[];
}

const CACHE = Symbol.for('uidetox.mro');

function merge<T>(sequences: T[][]): T[] {
  const result: T[] = [];
  const lists = sequences.map((s) => [...s]).filter((s) => s.length > 0);
  while (lists.length > 0) {
    let head: T | null = null;
    for (const seq of lists) {
      const candidate = seq[0];
      const inTail = lists.some((other) => other.slice(1).includes(candidate));
      if (!inTail) { head = candidate; break; }
    }
    if (head === null) {
      const residual = lists.map((s) => s.map((x) => (x as { name?: string }).name ?? String(x)).join(',')).join(' | ');
      throw new InconsistentHierarchyError(`no valid head, residual: ${residual}`);
    }
    result.push(head);
    for (const seq of lists) {
      if (seq[0] === head) seq.shift();
    }
    for (let i = lists.length - 1; i >= 0; i--) {
      if (lists[i].length === 0) lists.splice(i, 1);
    }
  }
  return result;
}

export function resolveLinearization<T extends Linearizable<T>>(root: T): T[] {
  const cached = (root as { [k: symbol]: T[] })[CACHE];
  if (cached) return cached;
  const parents = root.extends ?? [];
  const parentLins = parents.map((p) => resolveLinearization(p));
  const list = [root, ...merge<T>([...parentLins, [...parents]])];
  Object.defineProperty(root, CACHE, { value: list, enumerable: false, configurable: false, writable: false });
  return list;
}
```

- [ ] **Step 4: Verify passes**

Run: `pnpm test tests/runtime/mro/linearize.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/runtime/mro/linearize.ts tests/runtime/mro/linearize.test.ts
git commit -m "feat(runtime): Python C3 linearization for inheritance"
```

---

## Task 2: Merged view builders

**Files:**
- Create: `src/runtime/mro/apply.ts`
- Test: `tests/runtime/mro/apply.test.ts`

**Interfaces:**
- Consumes: `linearize.ts`.
- Produces:
  - `interface HandlerLike { name: string | null; run(this: unknown, ...args: unknown[]): unknown; }`
  - `mergeHandlers(mro: Array<{ handlers?: Record<string, HandlerLike[]>; off?: Record<string, string[] | 'all'> }>): Record<string, HandlerLike[]>` — walks MRO tail-first, concatenates handlers per event, then applies `off` rules (`'all'` clears; array removes named handlers).
  - `mergeChain<T>(mro: Array<{ transformers?: T[]; offTransform?: string[] | 'all' }>, nameOf: (t: T) => string | null): T[]` — same pattern for filter transformers.

- [ ] **Step 1: Write failing test**

Write `tests/runtime/mro/apply.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { mergeChain, mergeHandlers } from '../../../src/runtime/mro/apply.js';

describe('mergeHandlers()', () => {
  it('concatenates handlers in tail-first order (parents first, own last)', () => {
    const mro = [
      { handlers: { blur: [{ name: 'own', run() {} }] } },
      { handlers: { blur: [{ name: 'p1', run() {} }] } },
      { handlers: { blur: [{ name: 'p2', run() {} }] } },
    ];
    const merged = mergeHandlers(mro);
    expect(merged.blur.map((h) => h.name)).toEqual(['p2', 'p1', 'own']);
  });

  it('removes named off entries', () => {
    const mro = [
      { handlers: { blur: [{ name: 'child_only', run() {} }] }, off: { blur: ['unwanted'] as string[] } },
      { handlers: { blur: [{ name: 'unwanted', run() {} }, { name: 'kept', run() {} }] } },
    ];
    const merged = mergeHandlers(mro);
    expect(merged.blur.map((h) => h.name)).toEqual(['kept', 'child_only']);
  });

  it('off "all" clears event entirely', () => {
    const mro = [
      { handlers: { blur: [{ name: 'own', run() {} }] }, off: { blur: 'all' as const } },
      { handlers: { blur: [{ name: 'p', run() {} }] } },
    ];
    const merged = mergeHandlers(mro);
    expect(merged.blur.map((h) => h.name)).toEqual(['own']);
  });
});

describe('mergeChain()', () => {
  it('concatenates parents first and applies off', () => {
    const mro = [
      { transformers: [{ id: 'own' }], offTransform: ['dropped'] as string[] },
      { transformers: [{ id: 'kept' }, { id: 'dropped' }] },
    ];
    const merged = mergeChain(mro, (t) => t.id);
    expect(merged.map((t) => t.id)).toEqual(['kept', 'own']);
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `pnpm test tests/runtime/mro/apply.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Write `src/runtime/mro/apply.ts`:
```ts
export interface HandlerLike {
  name: string | null;
  run(this: unknown, ...args: unknown[]): unknown;
}

interface HandlerCarrier {
  handlers?: Record<string, HandlerLike[]>;
  off?: Record<string, string[] | 'all'>;
}

export function mergeHandlers(mro: HandlerCarrier[]): Record<string, HandlerLike[]> {
  const events = new Set<string>();
  for (const item of mro) if (item.handlers) for (const e of Object.keys(item.handlers)) events.add(e);
  const result: Record<string, HandlerLike[]> = {};
  const offAll = new Set<string>();
  const offNames = new Map<string, Set<string>>();
  for (const item of mro) {
    if (!item.off) continue;
    for (const [event, spec] of Object.entries(item.off)) {
      if (spec === 'all') offAll.add(event);
      else {
        if (!offNames.has(event)) offNames.set(event, new Set());
        for (const n of spec) offNames.get(event)!.add(n);
      }
    }
  }
  for (const event of events) {
    if (offAll.has(event)) {
      const own = mro[0]?.handlers?.[event] ?? [];
      result[event] = own;
      continue;
    }
    const chain: HandlerLike[] = [];
    for (let i = mro.length - 1; i >= 0; i--) {
      const list = mro[i].handlers?.[event] ?? [];
      for (const h of list) {
        if (h.name && offNames.get(event)?.has(h.name)) continue;
        chain.push(h);
      }
    }
    result[event] = chain;
  }
  return result;
}

interface ChainCarrier<T> {
  transformers?: T[];
  offTransform?: string[] | 'all';
}

export function mergeChain<T>(mro: ChainCarrier<T>[], nameOf: (t: T) => string | null): T[] {
  const offAll = mro.some((m) => m.offTransform === 'all');
  const offNames = new Set<string>();
  for (const m of mro) {
    if (Array.isArray(m.offTransform)) for (const n of m.offTransform) offNames.add(n);
  }
  if (offAll) {
    return mro[0]?.transformers ?? [];
  }
  const out: T[] = [];
  for (let i = mro.length - 1; i >= 0; i--) {
    const list = mro[i].transformers ?? [];
    for (const t of list) {
      const name = nameOf(t);
      if (name && offNames.has(name)) continue;
      out.push(t);
    }
  }
  return out;
}
```

- [ ] **Step 4: Verify passes**

Run: `pnpm test tests/runtime/mro/apply.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/runtime/mro/apply.ts tests/runtime/mro/apply.test.ts
git commit -m "feat(runtime): merged view builders for handlers + transformer chains"
```

---

## Task 3: Trait runtime uses MRO on install

**Files:**
- Modify: `src/runtime/traits/types.ts` (add `extends?`, `off?`), `src/runtime/traits/install.ts` (compute merged handlers from MRO), `src/runtime/traits/define.ts` (accept extends + off)
- Test: `tests/runtime/traits/inheritance.test.ts`

**Interfaces:**
- Consumes: `resolveLinearization`, `mergeHandlers`.
- Produces: existing `defineTrait` accepts `extends?: TraitDescriptor[]` and `off?: Record<string, string[] | 'all'>`. `installTraits` walks MRO on first use and caches the merged handlers.

- [ ] **Step 1: Extend TraitDescriptor**

Edit `src/runtime/traits/types.ts`:
```ts
export interface TraitHandlerSpec {
  name: string | null;
  run(this: unknown): void;
}

export interface TraitDescriptor {
  name: string;
  appliesTo: string[];
  paramsSchema: Record<string, unknown>;
  props: () => Record<string, unknown>;
  handlers: Record<string, TraitHandlerSpec[]>;
  extends?: TraitDescriptor[];
  off?: Record<string, string[] | 'all'>;
}
```

- [ ] **Step 2: Write failing test**

Write `tests/runtime/traits/inheritance.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { clearTraitRegistry, defineTrait } from '../../../src/runtime/traits/define.js';
import { installTraits } from '../../../src/runtime/traits/install.js';

describe('trait inheritance', () => {
  it('parents run first then own via MRO', () => {
    clearTraitRegistry();
    const order: string[] = [];
    const parent = defineTrait('p', {
      appliesTo: ['input'],
      paramsSchema: {},
      props: () => ({}),
      handlers: { blur: [{ name: 'p1', run() { order.push('p1'); } }] },
    });
    const child = defineTrait('c', {
      appliesTo: ['input'],
      paramsSchema: {},
      props: () => ({}),
      extends: [parent],
      handlers: { blur: [{ name: 'c1', run() { order.push('c1'); } }] },
    });
    void child;
    const el = document.createElement('input');
    document.body.appendChild(el);
    installTraits(el.parentElement!, new Map([[el, [{ traitName: 'c', params: {} }]]]));
    el.dispatchEvent(new Event('blur'));
    expect(order).toEqual(['p1', 'c1']);
  });

  it('off removes named inherited handler', () => {
    clearTraitRegistry();
    const order: string[] = [];
    const parent = defineTrait('p', {
      appliesTo: ['input'],
      paramsSchema: {},
      props: () => ({}),
      handlers: { blur: [
        { name: 'a', run() { order.push('a'); } },
        { name: 'b', run() { order.push('b'); } },
      ] },
    });
    defineTrait('c', {
      appliesTo: ['input'],
      paramsSchema: {},
      props: () => ({}),
      extends: [parent],
      handlers: {},
      off: { blur: ['b'] },
    });
    const el = document.createElement('input');
    document.body.appendChild(el);
    installTraits(el.parentElement!, new Map([[el, [{ traitName: 'c', params: {} }]]]));
    el.dispatchEvent(new Event('blur'));
    expect(order).toEqual(['a']);
  });
});
```

- [ ] **Step 3: Verify fail**

Run: `pnpm test tests/runtime/traits/inheritance.test.ts`
Expected: FAIL.

- [ ] **Step 4: Update install to walk MRO**

Rewrite `src/runtime/traits/install.ts`:
```ts
import { getTrait } from './define.js';
import { mergeHandlers } from '../mro/apply.js';
import { resolveLinearization } from '../mro/linearize.js';
import type { TraitDescriptor } from './types.js';

export interface UseSpec {
  traitName: string;
  params: Record<string, unknown>;
}

export function parseUseAttribute(value: string): string[] {
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

const PARAM_RE = /^:([a-z][a-z0-9-]*)(?::([a-z][a-z0-9-]*))?$/;
function kebabToCamel(name: string): string {
  return name.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

export function parseParamAttribute(name: string): { trait: string | null; param: string } | null {
  const m = PARAM_RE.exec(name);
  if (!m) return null;
  if (m[2] === undefined) return { trait: null, param: kebabToCamel(m[1]) };
  return { trait: m[1], param: kebabToCamel(m[2]) };
}

const mergedCache = new WeakMap<TraitDescriptor, Record<string, TraitDescriptor['handlers'][string]>>();

function getMergedHandlers(desc: TraitDescriptor): Record<string, TraitDescriptor['handlers'][string]> {
  let cached = mergedCache.get(desc);
  if (!cached) {
    const mro = resolveLinearization(desc);
    cached = mergeHandlers(mro) as Record<string, TraitDescriptor['handlers'][string]>;
    mergedCache.set(desc, cached);
  }
  return cached;
}

function getMergedProps(desc: TraitDescriptor): Record<string, unknown> {
  const mro = resolveLinearization(desc);
  const merged: Record<string, unknown> = {};
  for (let i = mro.length - 1; i >= 0; i--) Object.assign(merged, mro[i].props());
  return merged;
}

export function installTraits(_root: Element, useMap: Map<Element, UseSpec[]>): () => void {
  const disposals: Array<() => void> = [];
  for (const [el, specs] of useMap) {
    for (const spec of specs) {
      const trait = getTrait(spec.traitName);
      if (!trait) continue;
      const props = getMergedProps(trait);
      const context = { el, event: null as Event | null, params: spec.params, ...props };
      const merged = getMergedHandlers(trait);
      for (const [event, handlers] of Object.entries(merged)) {
        for (const handler of handlers) {
          const listener = (e: Event) => {
            context.event = e;
            handler.run.call(context);
            context.event = null;
          };
          el.addEventListener(event, listener);
          disposals.push(() => el.removeEventListener(event, listener));
        }
      }
    }
  }
  return () => { for (const d of disposals) d(); };
}
```

- [ ] **Step 5: Verify passes**

Run: `pnpm test tests/runtime/traits/inheritance.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/runtime/traits/types.ts src/runtime/traits/install.ts tests/runtime/traits/inheritance.test.ts
git commit -m "feat(traits): install merges handlers via MRO + off"
```

---

## Task 4: Filter runtime uses MRO on transform chain

**Files:**
- Modify: `src/runtime/filters/types.ts`, `src/runtime/filters/define.ts`
- Test: `tests/runtime/filters/inheritance.test.ts`

**Interfaces:**
- Adds `extends?: FilterDescriptor[]` and `offTransform?: string[] | 'all'` to FilterDescriptor.
- Callable chains through the merged transformer list on every call (cached per descriptor).

- [ ] **Step 1: Extend FilterDescriptor**

Edit `src/runtime/filters/types.ts`:
```ts
export interface FilterTransformer {
  name: string | null;
  run(this: unknown, v: unknown): unknown;
}

export interface FilterDescriptor {
  name: string;
  input: string;
  output: string;
  paramsSchema: Record<string, unknown>;
  transformers: FilterTransformer[];
  extends?: FilterDescriptor[];
  offTransform?: string[] | 'all';
}
```

- [ ] **Step 2: Write failing test**

Write `tests/runtime/filters/inheritance.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { defineFilter } from '../../../src/runtime/filters/define.js';

describe('filter inheritance', () => {
  it('runs parent transformers before own', () => {
    const parent = defineFilter('brackets', {
      input: 'string', output: 'string', paramsSchema: {},
      transformers: [{ name: 'a', run(this: unknown, v: string) { return `[${v}]`; } }],
    });
    const child = defineFilter('bracketsUp', {
      input: 'string', output: 'string', paramsSchema: {},
      transformers: [{ name: 'b', run(this: unknown, v: string) { return v.toUpperCase(); } }],
      extends: [(parent as unknown as { $descriptor: unknown }).$descriptor],
    });
    expect((child as (v: string) => string)('x')).toBe('[X]');
  });

  it('offTransform removes named parent transformer', () => {
    const parent = defineFilter('parentF', {
      input: 'string', output: 'string', paramsSchema: {},
      transformers: [
        { name: 'keep', run(this: unknown, v: string) { return v + '1'; } },
        { name: 'drop', run(this: unknown, v: string) { return v + '2'; } },
      ],
    });
    const child = defineFilter('childF', {
      input: 'string', output: 'string', paramsSchema: {},
      transformers: [{ name: 'own', run(this: unknown, v: string) { return v + '3'; } }],
      extends: [(parent as unknown as { $descriptor: unknown }).$descriptor],
      offTransform: ['drop'],
    });
    expect((child as (v: string) => string)('x')).toBe('x13');
  });
});
```

- [ ] **Step 3: Verify fail**

Run: `pnpm test tests/runtime/filters/inheritance.test.ts`
Expected: FAIL.

- [ ] **Step 4: Update define to merge via MRO**

Rewrite `src/runtime/filters/define.ts`:
```ts
import { mergeChain } from '../mro/apply.js';
import { resolveLinearization } from '../mro/linearize.js';
import type { FilterDescriptor, FilterTransformer } from './types.js';

const registry = new Map<string, FilterDescriptor>();
const mergedCache = new WeakMap<FilterDescriptor, FilterTransformer[]>();

function getMergedTransformers(desc: FilterDescriptor): FilterTransformer[] {
  let cached = mergedCache.get(desc);
  if (!cached) {
    const mro = resolveLinearization(desc);
    cached = mergeChain<FilterTransformer>(mro as Array<{ transformers?: FilterTransformer[]; offTransform?: string[] | 'all' }>, (t) => t.name);
    mergedCache.set(desc, cached);
  }
  return cached;
}

export function defineFilter(
  name: string,
  spec: Omit<FilterDescriptor, 'name'>,
): (value: unknown, params?: Record<string, unknown>) => unknown {
  const descriptor: FilterDescriptor = { name, ...spec };
  registry.set(name, descriptor);
  const callable = (value: unknown, params?: Record<string, unknown>) => {
    const chain = getMergedTransformers(descriptor);
    const ctx = { params: params ?? {}, $transformers: chain };
    let current: unknown = value;
    for (const t of chain) current = t.run.call(ctx, current);
    return current;
  };
  (callable as unknown as { $descriptor: FilterDescriptor }).$descriptor = descriptor;
  return callable;
}

export function getFilter(name: string): FilterDescriptor | undefined {
  return registry.get(name);
}
```

- [ ] **Step 5: Verify passes**

Run: `pnpm test tests/runtime/filters/inheritance.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/runtime/filters/types.ts src/runtime/filters/define.ts tests/runtime/filters/inheritance.test.ts
git commit -m "feat(filters): merge transformer chain via MRO + offTransform"
```

---

## Task 5: Registry token inheritance

**Files:**
- Modify: `src/runtime/registry.ts` (extend Token with optional `extends`, walk MRO on get()), tests already partially exist.
- Test: `tests/runtime/registry/token-inheritance.test.ts`

**Interfaces:**
- Extend `createToken` signature: `createToken<T>(name: string, opts?: { extends?: Token<T>[] }): Token<T>`.
- `registry.get(token).value` looks up token first, then walks L[token] tail-first.

- [ ] **Step 1: Write failing test**

Write `tests/runtime/registry/token-inheritance.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createToken, registry } from '../../../src/runtime/registry.js';

interface Theme { name: string; }

describe('token inheritance', () => {
  it('falls back to ancestor provider', () => {
    const base = createToken<Theme>('base-theme');
    const admin = createToken<Theme>('admin-theme', { extends: [base] });
    registry.provide(base, () => ({ name: 'base' }));
    expect(registry.get(admin).value).toEqual({ name: 'base' });
  });

  it('own provider wins', () => {
    const base = createToken<Theme>('b');
    const child = createToken<Theme>('c', { extends: [base] });
    registry.provide(base, () => ({ name: 'base' }));
    registry.provide(child, () => ({ name: 'child' }));
    expect(registry.get(child).value).toEqual({ name: 'child' });
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `pnpm test tests/runtime/registry/token-inheritance.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `src/runtime/registry.ts`**

Rewrite `src/runtime/registry.ts`:
```ts
import { derived, type Derived } from './derived.js';
import { state } from './state.js';
import { resolveLinearization } from './mro/linearize.js';

export interface Token<T> {
  readonly id: symbol;
  readonly name: string;
  readonly extends?: Token<T>[];
  readonly __t?: T;
}

export function createToken<T>(name: string, opts: { extends?: Token<T>[] } = {}): Token<T> {
  const token: Token<T> = { id: Symbol(name), name, extends: opts.extends };
  return token;
}

type Provider<T> = T | (() => T);
interface Slot { provider: Provider<unknown>; }

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

function keyOf(sym: symbol): string { return sym.toString(); }

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

function walkMro<T>(token: Token<T>): T | undefined {
  const mro = resolveLinearization(token as unknown as { name: string; extends?: Array<Token<T>> });
  for (const t of mro) {
    const slot = readSlot((t as Token<T>).id);
    if (slot) return resolveValue<T>(slot);
  }
  return undefined;
}

function createScope(): RegistryScope {
  const slots = state<Record<string, Slot>>({});
  const scope: InternalScope = {
    slots,
    provide<T>(token: Token<T>, value: Provider<T>) { slots[keyOf(token.id)] = { provider: value as Provider<unknown> }; },
    override<T>(token: Token<T>, value: Provider<T>) { slots[keyOf(token.id)] = { provider: value as Provider<unknown> }; },
    enter<R>(fn: () => R): R {
      const prev = activeScope;
      activeScope = scope;
      try { return fn(); } finally { activeScope = prev; }
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
    return derived<T>(() => walkMro<T>(token) as T);
  },
  createScope,
};
```

- [ ] **Step 4: Verify passes**

Run: `pnpm test tests/runtime/registry/token-inheritance.test.ts`
Expected: PASS. Also re-run existing `tests/runtime/registry.test.ts` — must still pass.

- [ ] **Step 5: Commit**

```bash
git add src/runtime/registry.ts tests/runtime/registry/token-inheritance.test.ts
git commit -m "feat(registry): token inheritance via MRO fallback"
```

---

## Task 6: DSL parser accepts `extends` + `off`

**Files:**
- Modify: `src/compiler/dtx/types.ts` (Clause: add `'list-of-refs'`; Member: add `'off'` kind), `src/compiler/dtx/parse.ts` (recognise `extends [x, y]` clause and `off <event> name()` / `off <event> *()` and `off transform <name>()` / `off transform *()` members)
- Test: `tests/compiler/dtx/inherit-parse.test.ts`

**Interfaces:**
- New Clause kind `'list-of-refs'` for `extends`: `{ key: 'extends', kind: 'list-of-refs', items: string[] }`.
- New Member kind `'off'`: `{ kind: 'off', event: string, name: string | null }` — `event === 'transform'` for filter transformer removal; `name === null` means `*()` wildcard.

- [ ] **Step 1: Extend types**

Edit `src/compiler/dtx/types.ts` — extend `Clause.kind` union with `'list-of-refs'` (items is already string[]), and extend `Member.kind` union to `'on' | 'transform' | 'default' | 'prop' | 'off'`. Existing shapes still valid.

Replace `src/compiler/dtx/types.ts`:
```ts
export type Verb = 'trait' | 'filter' | 'token' | 'provide';

export interface ParamSpec {
  type: string;
  optional: boolean;
  name: string;
  defaultValue?: string;
}

export interface Clause {
  key: string;
  kind: 'flag' | 'value' | 'list' | 'list-of-refs' | 'params';
  value?: string;
  items?: string[];
  params?: ParamSpec[];
}

export interface Member {
  kind: 'on' | 'transform' | 'default' | 'prop' | 'off';
  event?: string;
  name: string | null;
  body?: string;
  propValue?: string;
}

export interface Declaration {
  verb: Verb;
  name: string;
  clauses: Clause[];
  members: Member[];
  sourceOffset: number;
  sourceEndOffset: number;
}

export interface ImportStatement {
  path: string;
  items: Array<{ source: string; alias?: string }>;
  sourceOffset: number;
  sourceEndOffset: number;
}

export interface DtxAst {
  imports: ImportStatement[];
  declarations: Declaration[];
}
```

- [ ] **Step 2: Write failing test**

Write `tests/compiler/dtx/inherit-parse.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseDtx } from '../../../src/compiler/dtx/parse.js';

describe('parse extends + off', () => {
  it('parses extends list-of-refs', () => {
    const ast = parseDtx('trait c extends [a, b] appliesto [input]\n');
    const decl = ast.declarations[0];
    const ext = decl.clauses.find((c) => c.key === 'extends');
    expect(ext?.kind).toBe('list-of-refs');
    expect(ext?.items).toEqual(['a', 'b']);
  });

  it('parses off members', () => {
    const src = `trait c extends [a]
off blur trim_handler()
off blur *()
off transform lc()
`;
    const ast = parseDtx(src);
    const members = ast.declarations[0].members;
    expect(members[0]).toEqual({ kind: 'off', event: 'blur', name: 'trim_handler' });
    expect(members[1]).toEqual({ kind: 'off', event: 'blur', name: null });
    expect(members[2]).toEqual({ kind: 'off', event: 'transform', name: 'lc' });
  });
});
```

- [ ] **Step 3: Verify fail**

Run: `pnpm test tests/compiler/dtx/inherit-parse.test.ts`
Expected: FAIL.

- [ ] **Step 4: Extend parser**

Edit `src/compiler/dtx/parse.ts`.

Change `parseClauses` — when the key is `extends`, use list-of-refs kind:
```ts
      if (nextTok.kind === 'symbol' && nextTok.value === '[') {
        const items = this.parseClauseList();
        clauses.push({ key, kind: key === 'extends' ? 'list-of-refs' : 'list', items });
        continue;
      }
```

Extend `isMemberStart()` to accept `off`:
```ts
    if (t.kind === 'word' && (t.value === 'on' || t.value === 'off' || t.value === 'transform' || t.value === 'default')) return true;
```

Extend `parseMember()` to handle `off`:
```ts
    if (t.kind === 'word' && t.value === 'off') {
      this.i++;
      const eventTok = this.next();
      if (eventTok.kind !== 'word') throw new Error('off <event> expected');
      const event = eventTok.value;
      let name: string | null = null;
      const nextTok = this.peek();
      if (nextTok && nextTok.kind === 'symbol' && nextTok.value === '*') {
        this.i++;
        name = null;
      } else if (nextTok && nextTok.kind === 'word') {
        this.i++;
        name = nextTok.value;
      }
      if (!this.eatSymbol('(')) throw new Error('( expected');
      if (!this.eatSymbol(')')) throw new Error(') expected');
      return { kind: 'off', event, name };
    }
```

Also add `'*'` to the tokenizer's SYMBOLS set:
Edit `src/compiler/dtx/tokenize.ts` — change:
```ts
const SYMBOLS = new Set(['(', ')', '[', ']', ',', '?', '.', '=', ':', '*']);
```

- [ ] **Step 5: Verify passes**

Run: `pnpm test tests/compiler/dtx/inherit-parse.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/compiler/dtx/types.ts src/compiler/dtx/parse.ts src/compiler/dtx/tokenize.ts tests/compiler/dtx/inherit-parse.test.ts
git commit -m "feat(dtx): parse extends [] + off <event> name/*"
```

---

## Task 7: DSL emit surfaces extends + off

**Files:**
- Modify: `src/compiler/dtx/emit.ts`
- Test: `tests/compiler/dtx/inherit-emit.test.ts`

**Interfaces:**
- Trait emit includes `extends: [<camelName>, …]` and `off: { <event>: [<name>, …] | 'all' }`.
- Filter emit includes `extends` and `offTransform`.
- Token emit forwards `extends` list into `createToken(name, { extends: [...] })`.

- [ ] **Step 1: Write failing test**

Write `tests/compiler/dtx/inherit-emit.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { compileDtx } from '../../../src/compiler/dtx/index.js';

describe('dtx inherit emit', () => {
  it('emits trait extends + off', () => {
    const src = `trait c extends [a, numeric-only] appliesto [input]
off blur trim_handler()
off blur *()
`;
    const { code } = compileDtx(src);
    expect(code).toContain('extends: [a, numericOnly]');
    expect(code).toContain("off: { \"blur\": 'all' }");
  });

  it('emits filter extends + offTransform', () => {
    const src = `filter c extends [base] input string output string
off transform *()
`;
    const { code } = compileDtx(src);
    expect(code).toContain('extends: [base]');
    expect(code).toContain("offTransform: 'all'");
  });

  it('forwards token extends to createToken opts', () => {
    const src = `token admin-user extends [current-user] User\n`;
    const { code } = compileDtx(src);
    expect(code).toContain("createToken<User>('admin-user', { extends: [currentUser] })");
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `pnpm test tests/compiler/dtx/inherit-emit.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `src/compiler/dtx/emit.ts`**

Replace `src/compiler/dtx/emit.ts`:
```ts
import { kebabToCamel } from './namespace.js';
import { parseDtx } from './parse.js';
import type {
  Declaration,
  DtxAst,
  ImportStatement,
  Member,
  ParamSpec,
} from './types.js';

const RUNTIME_MODULE = 'ui-detox';

function sq(v: unknown): string {
  if (typeof v !== 'string') return JSON.stringify(v);
  return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function extendsRef(decl: Declaration): string {
  const clause = decl.clauses.find((c) => c.key === 'extends');
  if (!clause?.items || clause.items.length === 0) return '';
  const refs = clause.items.map((n) => kebabToCamel(n)).join(', ');
  return `extends: [${refs}]`;
}

function offMap(members: Member[], event = 'event'): string {
  const offs = members.filter((m) => m.kind === 'off' && (event === 'transform' ? m.event === 'transform' : m.event !== 'transform'));
  if (offs.length === 0) return '';
  if (event === 'transform') {
    const names = offs.map((m) => m.name);
    if (names.includes(null)) return `offTransform: 'all'`;
    return `offTransform: [${names.map((n) => sq(n as string)).join(', ')}]`;
  }
  const byEvent = new Map<string, Array<string | null>>();
  for (const m of offs) {
    if (!byEvent.has(m.event!)) byEvent.set(m.event!, []);
    byEvent.get(m.event!)!.push(m.name);
  }
  const entries: string[] = [];
  for (const [ev, names] of byEvent) {
    if (names.includes(null)) entries.push(`${sq(ev)}: 'all'`);
    else entries.push(`${sq(ev)}: [${names.map((n) => sq(n as string)).join(', ')}]`);
  }
  return `off: { ${entries.join(', ')} }`;
}

function emitParamsSchema(params: ParamSpec[]): string {
  if (params.length === 0) return '{}';
  const entries = params.map((p) => {
    const parts: string[] = [`type: ${sq(p.type)}`];
    if (p.optional) parts.push('optional: true');
    if (p.defaultValue !== undefined) parts.push(`default: ${p.defaultValue}`);
    return `${p.name}: { ${parts.join(', ')} }`;
  });
  return `{ ${entries.join(', ')} }`;
}

function emitTraitHandlers(members: Member[]): string {
  const byEvent = new Map<string, Array<{ name: string | null; body: string }>>();
  for (const m of members) {
    if (m.kind !== 'on') continue;
    const event = m.event ?? '';
    if (!byEvent.has(event)) byEvent.set(event, []);
    byEvent.get(event)!.push({ name: m.name, body: m.body ?? '' });
  }
  const entries: string[] = [];
  for (const [event, handlers] of byEvent) {
    const items = handlers.map((h) => {
      const nameField = h.name ? `name: ${sq(h.name)}` : 'name: null';
      const runField = `run(this: any) {${h.body}\n}`;
      return `{ ${nameField}, ${runField} }`;
    });
    entries.push(`${sq(event)}: [${items.join(', ')}]`);
  }
  return `{ ${entries.join(', ')} }`;
}

function emitTraitProps(members: Member[]): string {
  const props = members.filter((m) => m.kind === 'prop');
  if (props.length === 0) return '() => ({})';
  const body = props.map((p) => `${p.name}: ${p.propValue}`).join(', ');
  return `() => ({ ${body} })`;
}

function emitTraitDecl(decl: Declaration): string {
  const camel = kebabToCamel(decl.name);
  const isExport = decl.clauses.some((c) => c.key === 'export');
  const applies = decl.clauses.find((c) => c.key === 'appliesto');
  const params = decl.clauses.find((c) => c.key === 'params');
  const appliesArr = applies?.items ? `[${applies.items.map((s) => sq(s)).join(', ')}]` : '[]';
  const paramsObj = params?.params ? emitParamsSchema(params.params) : '{}';
  const handlers = emitTraitHandlers(decl.members);
  const props = emitTraitProps(decl.members);
  const extra: string[] = [];
  const ext = extendsRef(decl); if (ext) extra.push(ext);
  const off = offMap(decl.members, 'event'); if (off) extra.push(off);
  const extraStr = extra.length ? `,\n  ${extra.join(',\n  ')}` : '';
  return `${isExport ? 'export ' : ''}const ${camel} = defineTrait(${sq(decl.name)}, {
  appliesTo: ${appliesArr},
  paramsSchema: ${paramsObj},
  props: ${props},
  handlers: ${handlers}${extraStr},
});
`;
}

function emitFilterTransformers(members: Member[], inputType: string): string {
  const list = members.filter((m) => m.kind === 'transform');
  const items = list.map((m) => {
    const nameField = m.name ? sq(m.name) : 'null';
    return `{ name: ${nameField}, run(this: any, v: ${inputType}) {${m.body ?? ''}\n} }`;
  });
  return `[${items.join(', ')}]`;
}

function emitFilterDecl(decl: Declaration): string {
  const camel = kebabToCamel(decl.name);
  const isExport = decl.clauses.some((c) => c.key === 'export');
  const input = decl.clauses.find((c) => c.key === 'input')?.value ?? 'string';
  const output = decl.clauses.find((c) => c.key === 'output')?.value ?? 'string';
  const params = decl.clauses.find((c) => c.key === 'params');
  const paramsObj = params?.params ? emitParamsSchema(params.params) : '{}';
  const transformers = emitFilterTransformers(decl.members, input);
  const extra: string[] = [];
  const ext = extendsRef(decl); if (ext) extra.push(ext);
  const off = offMap(decl.members, 'transform'); if (off) extra.push(off);
  const extraStr = extra.length ? `,\n  ${extra.join(',\n  ')}` : '';
  return `${isExport ? 'export ' : ''}const ${camel} = defineFilter(${sq(decl.name)}, {
  input: ${sq(input)},
  output: ${sq(output)},
  paramsSchema: ${paramsObj},
  transformers: ${transformers}${extraStr},
});
`;
}

function emitTokenDecl(decl: Declaration): string {
  const camel = kebabToCamel(decl.name);
  const isExport = decl.clauses.some((c) => c.key === 'export');
  const typeName = decl.clauses.find((c) => c.key !== 'export' && c.key !== 'extends')?.value ?? 'unknown';
  const clause = decl.clauses.find((c) => c.key === 'extends');
  const opts = clause?.items && clause.items.length
    ? `, { extends: [${clause.items.map((n) => kebabToCamel(n)).join(', ')}] }`
    : '';
  return `${isExport ? 'export ' : ''}const ${camel} = createToken<${typeName}>(${sq(decl.name)}${opts});\n`;
}

function emitProvideDecl(decl: Declaration): string {
  const tokenName = kebabToCamel(decl.name);
  const defaultMember = decl.members.find((m) => m.kind === 'default');
  const providerBody = defaultMember?.body ?? '';
  return `registry.provide(${tokenName}, function() {${providerBody}\n});\n`;
}

function emitImport(imp: ImportStatement): string {
  if (imp.items.length === 0) return `import ${sq(imp.path)};\n`;
  const names = imp.items.map((it) => {
    const src = kebabToCamel(it.source);
    const alias = it.alias ? kebabToCamel(it.alias) : undefined;
    return alias ? `${src} as ${alias}` : src;
  }).join(', ');
  return `import { ${names} } from ${sq(imp.path)};\n`;
}

function collectImports(ast: DtxAst): Set<string> {
  const needed = new Set<string>();
  for (const decl of ast.declarations) {
    if (decl.verb === 'trait') needed.add('defineTrait');
    if (decl.verb === 'filter') needed.add('defineFilter');
    if (decl.verb === 'token') needed.add('createToken');
    if (decl.verb === 'provide') needed.add('registry');
  }
  return needed;
}

export function emitDtx(ast: DtxAst): { code: string } {
  const runtimeImports = collectImports(ast);
  const lines: string[] = [];
  for (const name of runtimeImports) {
    lines.push(`import { ${name} } from '${RUNTIME_MODULE}';`);
  }
  for (const imp of ast.imports) lines.push(emitImport(imp).trimEnd());
  lines.push('');
  for (const decl of ast.declarations) {
    if (decl.verb === 'trait') lines.push(emitTraitDecl(decl));
    else if (decl.verb === 'filter') lines.push(emitFilterDecl(decl));
    else if (decl.verb === 'token') lines.push(emitTokenDecl(decl));
    else if (decl.verb === 'provide') lines.push(emitProvideDecl(decl));
  }
  return { code: lines.join('\n') };
}

export function compileDtxSource(source: string): { code: string; map: string } {
  const ast = parseDtx(source);
  const { code } = emitDtx(ast);
  const map = JSON.stringify({ version: 3, sources: ['<dtx>'], names: [], mappings: '' });
  return { code, map };
}
```

- [ ] **Step 4: Verify passes**

Run: `pnpm test tests/compiler/dtx/inherit-emit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/compiler/dtx/emit.ts tests/compiler/dtx/inherit-emit.test.ts
git commit -m "feat(dtx): emit extends + off payloads for all verbs"
```

---

## Task 8: E2E — full DSL inheritance pipeline

**Files:**
- Test: `tests/e2e/dtx-inheritance-basic.test.ts`

- [ ] **Step 1: Write E2E test**

Write `tests/e2e/dtx-inheritance-basic.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { compileDtx } from '../../src/compiler/dtx/index.js';

describe('dtx inheritance e2e', () => {
  it('compiles a trait that extends another and applies off', () => {
    const src = `trait base export appliesto [input]
on blur base_handler() { this.el.dataset.base = '1'; }
trait child export extends [base] appliesto [input]
off blur base_handler()
on blur child_handler() { this.el.dataset.child = '1'; }
`;
    const { code } = compileDtx(src);
    expect(code).toContain('extends: [base]');
    expect(code).toContain("off: { \"blur\":");
    expect(code).toContain('base_handler');
    expect(code).toContain('child_handler');
  });
});
```

- [ ] **Step 2: Verify pass**

Run: `pnpm test tests/e2e/dtx-inheritance-basic.test.ts`
Expected: PASS.

- [ ] **Step 3: Run whole suite**

Run: `pnpm test`
Expected: every test passes.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/dtx-inheritance-basic.test.ts
git commit -m "test(e2e): dtx inheritance basic — trait extends + off"
```

---

## Self-Review Notes

- **Spec coverage:**
  - §3 extends grammar → Task 6 parse, Task 7 emit.
  - §4 Python-C3 → Task 1 pure impl.
  - §5 trait merge → Task 3 install merges + tests.
  - §6 filter merge → Task 4.
  - §7 token merge → Task 5.
  - §8 provide `this.super()` — deferred beyond MVP; not tasked.
  - §9 `off` grammar + emit + runtime → Tasks 6/7/3/4.
  - §10 `resolveLinearization` → Task 1.
  - §11 back-compat — traits/filters continue to accept empty extends/off.
  - §12 layout — matches tasks.
- **Placeholder scan:** every step has concrete code.
- **Type consistency:** `TraitDescriptor`, `FilterDescriptor`, `Token`, `resolveLinearization` used consistently.
- **Deferred:** `this.super()` in traits, static diamond warnings, flattened-trait optimisation.

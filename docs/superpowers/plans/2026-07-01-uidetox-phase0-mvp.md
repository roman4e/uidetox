# UIDetox Phase 0 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a runnable UIDetox Phase 0 — Markdown Single-File Components compile to JavaScript that registers Custom Elements with `state()`/`derived()`/`effect()` reactivity, HTML-first templates with `${expr}` bindings, and virtual `<if>`/`<for>`/`<case>` directives — end-to-end "hello world" component in a browser.

**Architecture:** Two-layer library. **Runtime** (`src/runtime/`) provides Proxy-based reactivity, an rAF scheduler, custom-element boot, and runtime helpers for control-flow directives. **Compiler** (`src/compiler/`) parses `.md` SFC files, extracts fenced blocks, walks the HTML template AST, applies AST-transforms for directives, and emits ESM JavaScript that boots the runtime. A CLI wraps the compiler for `.md` → `.js` builds.

**Tech Stack:** TypeScript 5.x, pnpm, Vitest (with `happy-dom` environment), `parse5` (HTML template parser), `yaml` (frontmatter parser), `commander` (CLI). No React, no Vue, no Angular, no Lit at runtime (patterns borrowed only).

## Global Constraints

- **Language:** TypeScript 5.x, `strict: true`, ESM (`"type": "module"`).
- **Target:** Node 20+ for the compiler and CLI; evergreen browsers (Chromium ≥ 100, Firefox ≥ 100, Safari ≥ 15) for the runtime.
- **Runtime primitives:** Reactivity is Proxy-based; **no compile-time magic** for `state`.
- **Naming:** author-facing PascalCase custom components compile to kebab-case Custom Element tag names (`<UserCard>` → `<user-card>`).
- **Virtual directives:** `<if>`, `<for>`, `<case>` produce **no wrapper node** in production DOM — anchored by empty text nodes.
- **Bindings:** Lit-style attribute prefixes — `@event`, `.prop`, `?bool`; `${expr}` for expressions; `attr="literal"` for static strings.
- **Test discipline:** TDD — write a failing test first, run it, implement, run passing, commit. One deliverable per task.

---

## File Structure

```
/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── runtime/
│   │   ├── observer.ts         # tracking stack + Observer type
│   │   ├── state.ts            # Proxy factory (deep, cached)
│   │   ├── effect.ts           # effect() subscriber
│   │   ├── derived.ts          # derived() memo with .value
│   │   ├── scheduler.ts        # microtask/rAF batcher
│   │   ├── directives/
│   │   │   ├── ifBlock.ts      # runtime helper: reactive if/else
│   │   │   ├── forBlock.ts     # runtime helper: keyed reconcile
│   │   │   └── caseBlock.ts    # runtime helper: switch/case
│   │   ├── component.ts        # defineComponent() + CE base class
│   │   └── index.ts            # public runtime API
│   ├── compiler/
│   │   ├── sfc.ts              # SFC block extractor (frontmatter + fences)
│   │   ├── frontmatter.ts      # YAML parse
│   │   ├── template/
│   │   │   ├── parse.ts        # HTML → normalized AST
│   │   │   ├── ast.ts          # AST node types
│   │   │   ├── transform.ts    # AST-transform pipeline for directives
│   │   │   └── codegen.ts      # AST → ESM JS emitter
│   │   ├── directives/
│   │   │   ├── ifDirective.ts  # AST transform for <if>/<else>
│   │   │   ├── forDirective.ts # AST transform for <for>
│   │   │   └── caseDirective.ts# AST transform for <case>/<when>/<else>
│   │   ├── compile.ts          # top-level compile(fileContents) → { js }
│   │   └── index.ts
│   └── cli/
│       └── build.ts            # CLI entry (`ui-detox build <glob>`)
├── tests/
│   ├── runtime/                # unit tests per runtime module
│   ├── compiler/               # snapshot tests per compiler module
│   └── e2e/                    # end-to-end fixture tests
├── examples/
│   └── hello/
│       ├── App.md
│       └── index.html
└── docs/
    └── superpowers/            # (already exists — spec + this plan live here)
```

Each `src/**/*.ts` file has a matching `tests/**/*.test.ts`.

---

## Task 1: Repository scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `README.md`

**Interfaces:**
- Produces: pnpm project ready for TypeScript library development, Vitest runnable with `pnpm test`.

- [ ] **Step 1: Initialize git repo and pnpm project**

Run:
```bash
cd /home/tue/Work/My/UIDetox
git init
pnpm init
```

- [ ] **Step 2: Overwrite `package.json` with library config**

Write `package.json`:
```json
{
  "name": "ui-detox",
  "version": "0.0.1",
  "type": "module",
  "description": "HTML-first Web Components framework with Markdown SFCs",
  "packageManager": "pnpm@9",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "cli": "tsx src/cli/build.ts"
  },
  "bin": {
    "ui-detox": "./dist/cli/build.js"
  },
  "exports": {
    ".": "./dist/runtime/index.js",
    "./compiler": "./dist/compiler/index.js"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "parse5": "^7.1.2",
    "yaml": "^2.4.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "happy-dom": "^13.0.0",
    "tsx": "^4.7.0",
    "typescript": "^5.4.0",
    "vitest": "^1.4.0"
  }
}
```

- [ ] **Step 3: Add `tsconfig.json`**

Write `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Add `vitest.config.ts`**

Write `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['tests/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Add `.gitignore` and a minimal `README.md`**

Write `.gitignore`:
```
node_modules
dist
.uidetox
*.log
```

Write `README.md`:
```md
# UIDetox

HTML-first Web Components framework with Markdown Single-File Components.

Phase 0 MVP — under construction. See `docs/superpowers/specs/2026-07-01-uidetox-design.md` for the design.

## Development

```
pnpm install
pnpm test
```
```

- [ ] **Step 6: Install dependencies and confirm test runner starts**

Run:
```bash
pnpm install
pnpm test
```

Expected: `No test files found, exiting with code 0` (or similar Vitest empty-suite message).

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts .gitignore README.md pnpm-lock.yaml
git commit -m "chore: scaffold TypeScript library with Vitest"
```

---

## Task 2: Observer tracking stack

**Files:**
- Create: `src/runtime/observer.ts`
- Test: `tests/runtime/observer.test.ts`

**Interfaces:**
- Produces:
  - `type Observer = () => void`
  - `getCurrentObserver(): Observer | null`
  - `runWithObserver<T>(observer: Observer, fn: () => T): T`

- [ ] **Step 1: Write the failing test**

Write `tests/runtime/observer.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { getCurrentObserver, runWithObserver } from '../../src/runtime/observer.js';

describe('observer stack', () => {
  it('returns null when no observer is active', () => {
    expect(getCurrentObserver()).toBeNull();
  });

  it('exposes the current observer inside runWithObserver', () => {
    const obs = () => {};
    let seen: ReturnType<typeof getCurrentObserver> = null;
    runWithObserver(obs, () => {
      seen = getCurrentObserver();
    });
    expect(seen).toBe(obs);
    expect(getCurrentObserver()).toBeNull();
  });

  it('restores the previous observer after nesting', () => {
    const outer = () => {};
    const inner = () => {};
    let outerBefore: unknown;
    let innerSeen: unknown;
    let outerAfter: unknown;
    runWithObserver(outer, () => {
      outerBefore = getCurrentObserver();
      runWithObserver(inner, () => {
        innerSeen = getCurrentObserver();
      });
      outerAfter = getCurrentObserver();
    });
    expect(outerBefore).toBe(outer);
    expect(innerSeen).toBe(inner);
    expect(outerAfter).toBe(outer);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/runtime/observer.test.ts`
Expected: FAIL — `Failed to load .../src/runtime/observer.js`.

- [ ] **Step 3: Implement**

Write `src/runtime/observer.ts`:
```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/runtime/observer.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/runtime/observer.ts tests/runtime/observer.test.ts
git commit -m "feat(runtime): observer tracking stack"
```

---

## Task 3: `state()` Proxy — reactive reads and writes

**Files:**
- Create: `src/runtime/state.ts`
- Test: `tests/runtime/state.test.ts`

**Interfaces:**
- Consumes: `observer.ts` (`getCurrentObserver`, `Observer`).
- Produces:
  - `state<T extends object>(obj: T): T` — Proxy wrapper.
  - `notify(target: object, key: PropertyKey): void` — internal, exported for later tasks (`effect`, `derived`).
  - Internal registry `subs: WeakMap<object, Map<PropertyKey, Set<Observer>>>` — module-private, not exported.

- [ ] **Step 1: Write the failing test**

Write `tests/runtime/state.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { runWithObserver } from '../../src/runtime/observer.js';
import { state } from '../../src/runtime/state.js';

describe('state()', () => {
  it('reads and writes properties transparently', () => {
    const s = state({ count: 0 });
    expect(s.count).toBe(0);
    s.count = 5;
    expect(s.count).toBe(5);
  });

  it('subscribes the current observer on read and re-runs it on write', () => {
    const s = state({ count: 0 });
    let seen = -1;
    const obs = () => { seen = s.count; };
    runWithObserver(obs, obs);       // first read registers observer
    expect(seen).toBe(0);
    s.count = 42;                    // write must re-invoke observer
    expect(seen).toBe(42);
  });

  it('deep-proxies nested objects', () => {
    const s = state({ inner: { value: 1 } });
    let seen = -1;
    const obs = () => { seen = s.inner.value; };
    runWithObserver(obs, obs);
    expect(seen).toBe(1);
    s.inner.value = 7;
    expect(seen).toBe(7);
  });

  it('tracks array mutations via index writes', () => {
    const s = state({ list: [1, 2, 3] as number[] });
    let sum = 0;
    const obs = () => { sum = s.list.reduce((a, b) => a + b, 0); };
    runWithObserver(obs, obs);
    expect(sum).toBe(6);
    s.list[0] = 10;
    expect(sum).toBe(15);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/runtime/state.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Write `src/runtime/state.ts`:
```ts
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
  proxies.set(obj, proxy);
  return proxy;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/runtime/state.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/runtime/state.ts tests/runtime/state.test.ts
git commit -m "feat(runtime): reactive state() Proxy with deep tracking"
```

---

## Task 4: `effect()` primitive

**Files:**
- Create: `src/runtime/effect.ts`
- Test: `tests/runtime/effect.test.ts`

**Interfaces:**
- Consumes: `runWithObserver` from `observer.ts`; the `state()` Proxy from `state.ts`.
- Produces:
  - `effect(fn: () => void | (() => void)): () => void` — returns a dispose function.
  - Runs `fn` immediately, tracks reads, re-runs on any dependency change, and calls the previous cleanup between runs.

- [ ] **Step 1: Write the failing test**

Write `tests/runtime/effect.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { effect } from '../../src/runtime/effect.js';
import { state } from '../../src/runtime/state.js';

describe('effect()', () => {
  it('runs immediately and re-runs on dependency change', () => {
    const s = state({ count: 0 });
    const seen: number[] = [];
    effect(() => { seen.push(s.count); });
    s.count = 1;
    s.count = 2;
    expect(seen).toEqual([0, 1, 2]);
  });

  it('calls cleanup between runs and on dispose', () => {
    const s = state({ count: 0 });
    const events: string[] = [];
    const dispose = effect(() => {
      events.push(`run:${s.count}`);
      return () => events.push(`cleanup:${s.count}`);
    });
    s.count = 1;
    dispose();
    s.count = 2;
    expect(events).toEqual(['run:0', 'cleanup:0', 'run:1', 'cleanup:1']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/runtime/effect.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Write `src/runtime/effect.ts`:
```ts
import { runWithObserver } from './observer.js';

export function effect(fn: () => void | (() => void)): () => void {
  let cleanup: void | (() => void);
  let disposed = false;
  const run = () => {
    if (disposed) return;
    cleanup?.();
    cleanup = runWithObserver(run, fn) ?? undefined;
  };
  run();
  return () => {
    disposed = true;
    cleanup?.();
    cleanup = undefined;
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/runtime/effect.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/runtime/effect.ts tests/runtime/effect.test.ts
git commit -m "feat(runtime): effect() with cleanup and dispose"
```

---

## Task 5: `derived()` memoized computed

**Files:**
- Create: `src/runtime/derived.ts`
- Test: `tests/runtime/derived.test.ts`

**Interfaces:**
- Consumes: `effect` from `effect.ts`, `state` from `state.ts`.
- Produces:
  - `derived<T>(fn: () => T): { readonly value: T }` — accessing `.value` returns cached result and subscribes the caller.

- [ ] **Step 1: Write the failing test**

Write `tests/runtime/derived.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { derived } from '../../src/runtime/derived.js';
import { effect } from '../../src/runtime/effect.js';
import { state } from '../../src/runtime/state.js';

describe('derived()', () => {
  it('computes lazily and updates when dependencies change', () => {
    const s = state({ a: 2, b: 3 });
    const d = derived(() => s.a * s.b);
    expect(d.value).toBe(6);
    s.a = 4;
    expect(d.value).toBe(12);
  });

  it('propagates to subscribers through effect()', () => {
    const s = state({ x: 1 });
    const d = derived(() => s.x + 10);
    const seen: number[] = [];
    effect(() => { seen.push(d.value); });
    s.x = 5;
    expect(seen).toEqual([11, 15]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/runtime/derived.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Write `src/runtime/derived.ts`:
```ts
import { effect } from './effect.js';
import { notify, state } from './state.js';

export interface Derived<T> {
  readonly value: T;
}

export function derived<T>(fn: () => T): Derived<T> {
  const holder = state({ value: fn() } as { value: T });
  effect(() => { holder.value = fn(); });
  // notify() is used by state() internally; import kept for symmetry
  void notify;
  return holder;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/runtime/derived.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/runtime/derived.ts tests/runtime/derived.test.ts
git commit -m "feat(runtime): derived() memoized computed"
```

---

## Task 6: rAF-batching scheduler

**Files:**
- Modify: `src/runtime/effect.ts` (route re-runs through scheduler)
- Create: `src/runtime/scheduler.ts`
- Test: `tests/runtime/scheduler.test.ts`

**Interfaces:**
- Produces:
  - `scheduleFlush(job: () => void): void` — dedupes jobs, flushes on next microtask (Node) / `requestAnimationFrame` (browser).
  - `flushSync(): void` — for tests; drains the queue immediately.

- [ ] **Step 1: Write the failing test**

Write `tests/runtime/scheduler.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { flushSync, scheduleFlush } from '../../src/runtime/scheduler.js';

describe('scheduler', () => {
  it('dedupes duplicate jobs before flushing', () => {
    let calls = 0;
    const job = () => { calls++; };
    scheduleFlush(job);
    scheduleFlush(job);
    scheduleFlush(job);
    flushSync();
    expect(calls).toBe(1);
  });

  it('runs jobs in insertion order', () => {
    const seen: number[] = [];
    scheduleFlush(() => seen.push(1));
    scheduleFlush(() => seen.push(2));
    scheduleFlush(() => seen.push(3));
    flushSync();
    expect(seen).toEqual([1, 2, 3]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/runtime/scheduler.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Write `src/runtime/scheduler.ts`:
```ts
type Job = () => void;

const queue = new Set<Job>();
let scheduled = false;

const raf: (cb: () => void) => void =
  typeof requestAnimationFrame === 'function'
    ? (cb) => requestAnimationFrame(cb)
    : (cb) => queueMicrotask(cb);

export function scheduleFlush(job: Job): void {
  queue.add(job);
  if (!scheduled) {
    scheduled = true;
    raf(flushSync);
  }
}

export function flushSync(): void {
  scheduled = false;
  const jobs = [...queue];
  queue.clear();
  for (const job of jobs) job();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/runtime/scheduler.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Route `effect` re-runs through the scheduler**

Edit `src/runtime/effect.ts` — replace previous contents:
```ts
import { runWithObserver } from './observer.js';
import { scheduleFlush } from './scheduler.js';

export function effect(fn: () => void | (() => void)): () => void {
  let cleanup: void | (() => void);
  let disposed = false;
  let firstRun = true;
  const run = () => {
    if (disposed) return;
    cleanup?.();
    cleanup = runWithObserver(scheduled, fn) ?? undefined;
  };
  const scheduled = () => {
    if (firstRun) {
      firstRun = false;
      run();
    } else {
      scheduleFlush(run);
    }
  };
  run();
  return () => {
    disposed = true;
    cleanup?.();
    cleanup = undefined;
  };
}
```

- [ ] **Step 6: Update effect tests to flush the queue**

Edit `tests/runtime/effect.test.ts` — add scheduler flushes:
```ts
import { describe, expect, it } from 'vitest';
import { effect } from '../../src/runtime/effect.js';
import { flushSync } from '../../src/runtime/scheduler.js';
import { state } from '../../src/runtime/state.js';

describe('effect()', () => {
  it('runs immediately and re-runs on dependency change', () => {
    const s = state({ count: 0 });
    const seen: number[] = [];
    effect(() => { seen.push(s.count); });
    s.count = 1;
    flushSync();
    s.count = 2;
    flushSync();
    expect(seen).toEqual([0, 1, 2]);
  });

  it('calls cleanup between runs and on dispose', () => {
    const s = state({ count: 0 });
    const events: string[] = [];
    const dispose = effect(() => {
      events.push(`run:${s.count}`);
      return () => events.push(`cleanup:${s.count}`);
    });
    s.count = 1;
    flushSync();
    dispose();
    s.count = 2;
    flushSync();
    expect(events).toEqual(['run:0', 'cleanup:0', 'run:1', 'cleanup:1']);
  });

  it('batches multiple writes in the same tick into one re-run', () => {
    const s = state({ a: 0, b: 0 });
    const seen: number[] = [];
    effect(() => { seen.push(s.a + s.b); });
    s.a = 1;
    s.b = 2;
    flushSync();
    expect(seen).toEqual([0, 3]);
  });
});
```

- [ ] **Step 7: Update derived tests likewise**

Edit `tests/runtime/derived.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { derived } from '../../src/runtime/derived.js';
import { effect } from '../../src/runtime/effect.js';
import { flushSync } from '../../src/runtime/scheduler.js';
import { state } from '../../src/runtime/state.js';

describe('derived()', () => {
  it('computes lazily and updates when dependencies change', () => {
    const s = state({ a: 2, b: 3 });
    const d = derived(() => s.a * s.b);
    expect(d.value).toBe(6);
    s.a = 4;
    flushSync();
    expect(d.value).toBe(12);
  });

  it('propagates to subscribers through effect()', () => {
    const s = state({ x: 1 });
    const d = derived(() => s.x + 10);
    const seen: number[] = [];
    effect(() => { seen.push(d.value); });
    s.x = 5;
    flushSync();
    expect(seen).toEqual([11, 15]);
  });
});
```

- [ ] **Step 8: Run whole runtime suite**

Run: `pnpm test tests/runtime`
Expected: PASS — all runtime tests.

- [ ] **Step 9: Commit**

```bash
git add src/runtime/scheduler.ts src/runtime/effect.ts tests/runtime/scheduler.test.ts tests/runtime/effect.test.ts tests/runtime/derived.test.ts
git commit -m "feat(runtime): batch effect re-runs via rAF scheduler"
```

---

## Task 7: SFC block extractor

**Files:**
- Create: `src/compiler/sfc.ts`, `src/compiler/frontmatter.ts`
- Test: `tests/compiler/sfc.test.ts`

**Interfaces:**
- Produces:
  - `type SfcBlock = { lang: string; role: string; content: string; line: number }`
  - `type Sfc = { frontmatter: Record<string, unknown>; body: string; blocks: SfcBlock[] }`
  - `parseSfc(source: string): Sfc`

Fenced blocks are matched with the pattern `` ```<lang> <role> `` on the opening line (e.g. `` ```html template ``). Content between the opener and the matching triple-backtick is the block. Fences that do not have a role are treated as Markdown documentation and left in `body`.

- [ ] **Step 1: Write the failing test**

Write `tests/compiler/sfc.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseSfc } from '../../src/compiler/sfc.js';

const SAMPLE = `---
name: Todo
tag: app-todo
---

# Todo

Displays a single todo.

\`\`\`ts props
export type Props = { title: string };
\`\`\`

\`\`\`html template
<li>\${props.title}</li>
\`\`\`

\`\`\`ts script
const s = state({ open: true });
\`\`\`

\`\`\`css style
.todo { padding: 1rem; }
\`\`\`
`;

describe('parseSfc()', () => {
  it('parses YAML frontmatter', () => {
    const sfc = parseSfc(SAMPLE);
    expect(sfc.frontmatter).toEqual({ name: 'Todo', tag: 'app-todo' });
  });

  it('collects roled fenced blocks', () => {
    const sfc = parseSfc(SAMPLE);
    const roles = sfc.blocks.map((b) => `${b.lang}/${b.role}`);
    expect(roles).toEqual([
      'ts/props',
      'html/template',
      'ts/script',
      'css/style',
    ]);
  });

  it('preserves original content of each block', () => {
    const sfc = parseSfc(SAMPLE);
    const tpl = sfc.blocks.find((b) => b.role === 'template');
    expect(tpl?.content.trim()).toBe('<li>${props.title}</li>');
  });

  it('ignores fenced blocks without a role', () => {
    const src =
      '\n```ts\nconst x = 1;\n```\n\n```ts script\nconst y = 2;\n```\n';
    const sfc = parseSfc(src);
    expect(sfc.blocks.map((b) => b.role)).toEqual(['script']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/compiler/sfc.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement frontmatter parser**

Write `src/compiler/frontmatter.ts`:
```ts
import { parse as parseYaml } from 'yaml';

export function extractFrontmatter(source: string): {
  frontmatter: Record<string, unknown>;
  rest: string;
} {
  if (!source.startsWith('---\n') && !source.startsWith('---\r\n')) {
    return { frontmatter: {}, rest: source };
  }
  const end = source.indexOf('\n---', 4);
  if (end === -1) return { frontmatter: {}, rest: source };
  const raw = source.slice(4, end);
  const parsed = parseYaml(raw);
  const frontmatter =
    parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {};
  const restStart = source.indexOf('\n', end + 4);
  const rest = restStart === -1 ? '' : source.slice(restStart + 1);
  return { frontmatter, rest };
}
```

- [ ] **Step 4: Implement SFC block extractor**

Write `src/compiler/sfc.ts`:
```ts
import { extractFrontmatter } from './frontmatter.js';

export interface SfcBlock {
  lang: string;
  role: string;
  content: string;
  line: number;
}

export interface Sfc {
  frontmatter: Record<string, unknown>;
  body: string;
  blocks: SfcBlock[];
}

const FENCE_OPEN = /^```([A-Za-z][\w-]*)(?:\s+([A-Za-z][\w:-]*))?\s*$/;
const FENCE_CLOSE = /^```\s*$/;

export function parseSfc(source: string): Sfc {
  const { frontmatter, rest } = extractFrontmatter(source);
  const lines = rest.split('\n');
  const blocks: SfcBlock[] = [];
  const bodyLines: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const openMatch = FENCE_OPEN.exec(lines[i]);
    if (openMatch && openMatch[2]) {
      const lang = openMatch[1];
      const role = openMatch[2];
      const startLine = i + 1;
      const contentLines: string[] = [];
      i++;
      while (i < lines.length && !FENCE_CLOSE.test(lines[i])) {
        contentLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push({
        lang,
        role,
        content: contentLines.join('\n'),
        line: startLine,
      });
    } else {
      bodyLines.push(lines[i]);
      i++;
    }
  }
  return { frontmatter, body: bodyLines.join('\n'), blocks };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test tests/compiler/sfc.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 6: Commit**

```bash
git add src/compiler/sfc.ts src/compiler/frontmatter.ts tests/compiler/sfc.test.ts
git commit -m "feat(compiler): parse SFC frontmatter and roled fenced blocks"
```

---

## Task 8: Template AST types + parse

**Files:**
- Create: `src/compiler/template/ast.ts`, `src/compiler/template/parse.ts`
- Test: `tests/compiler/template-parse.test.ts`

**Interfaces:**
- Consumes: `parse5`.
- Produces:
  - AST node types:
    ```ts
    type TplNode = TplElement | TplText | TplInterpolation;
    interface TplElement {
      type: 'element';
      tag: string;                // as authored (may be PascalCase or lowercase)
      attrs: TplAttr[];
      children: TplNode[];
    }
    interface TplAttr {
      name: string;               // includes '@', '.', '?' prefix as authored
      kind: 'static' | 'expression' | 'event' | 'property' | 'boolean';
      value: string;              // for static: literal; for others: expression source
    }
    interface TplText { type: 'text'; value: string; }
    interface TplInterpolation { type: 'interpolation'; expression: string; }
    ```
  - `parseTemplate(source: string): TplNode[]`

- [ ] **Step 1: Write the failing test**

Write `tests/compiler/template-parse.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseTemplate } from '../../src/compiler/template/parse.js';

describe('parseTemplate()', () => {
  it('parses a static element with text', () => {
    const ast = parseTemplate('<div class="card">hello</div>');
    expect(ast).toEqual([
      {
        type: 'element',
        tag: 'div',
        attrs: [{ name: 'class', kind: 'static', value: 'card' }],
        children: [{ type: 'text', value: 'hello' }],
      },
    ]);
  });

  it('recognises text interpolations', () => {
    const ast = parseTemplate('<span>${props.title}</span>');
    expect(ast[0]).toMatchObject({
      type: 'element',
      tag: 'span',
      children: [{ type: 'interpolation', expression: 'props.title' }],
    });
  });

  it('classifies binding attribute kinds', () => {
    const ast = parseTemplate(
      '<button @click="${onClick}" .disabled="${loading}" ?hidden="${hide}" data="${x}"></button>',
    );
    const el = ast[0] as { attrs: Array<{ name: string; kind: string; value: string }> };
    expect(el.attrs).toEqual([
      { name: '@click',   kind: 'event',      value: 'onClick' },
      { name: '.disabled',kind: 'property',   value: 'loading' },
      { name: '?hidden',  kind: 'boolean',    value: 'hide' },
      { name: 'data',     kind: 'expression', value: 'x' },
    ]);
  });

  it('preserves author-cased tag names', () => {
    const ast = parseTemplate('<UserCard/>');
    expect((ast[0] as { tag: string }).tag).toBe('UserCard');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/compiler/template-parse.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Define AST types**

Write `src/compiler/template/ast.ts`:
```ts
export type TplNode = TplElement | TplText | TplInterpolation;

export interface TplElement {
  type: 'element';
  tag: string;
  attrs: TplAttr[];
  children: TplNode[];
}

export type TplAttrKind = 'static' | 'expression' | 'event' | 'property' | 'boolean';

export interface TplAttr {
  name: string;
  kind: TplAttrKind;
  value: string;
}

export interface TplText {
  type: 'text';
  value: string;
}

export interface TplInterpolation {
  type: 'interpolation';
  expression: string;
}
```

- [ ] **Step 4: Implement parser**

Write `src/compiler/template/parse.ts`:
```ts
import { parseFragment, DefaultTreeAdapterMap } from 'parse5';
import type { TplAttr, TplAttrKind, TplNode } from './ast.js';

type P5Node = DefaultTreeAdapterMap['node'];

const INTERP = /\$\{([^}]+)\}/;
const BINDING_ATTR = /^\$\{([^}]+)\}$/;

function classifyAttr(name: string, rawValue: string): TplAttr {
  const stripped = rawValue.trim();
  const binding = BINDING_ATTR.exec(stripped);
  if (name.startsWith('@')) {
    return { name, kind: 'event', value: binding ? binding[1].trim() : stripped };
  }
  if (name.startsWith('.')) {
    return { name, kind: 'property', value: binding ? binding[1].trim() : stripped };
  }
  if (name.startsWith('?')) {
    return { name, kind: 'boolean', value: binding ? binding[1].trim() : stripped };
  }
  if (binding) {
    return { name, kind: 'expression', value: binding[1].trim() };
  }
  return { name, kind: 'static', value: rawValue };
}

function attrKindGuard(_: TplAttrKind) {
  return _;
}

function splitTextWithInterpolations(text: string): TplNode[] {
  const nodes: TplNode[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const rest = text.slice(cursor);
    const match = INTERP.exec(rest);
    if (!match) {
      nodes.push({ type: 'text', value: rest });
      break;
    }
    if (match.index > 0) {
      nodes.push({ type: 'text', value: rest.slice(0, match.index) });
    }
    nodes.push({ type: 'interpolation', expression: match[1].trim() });
    cursor += match.index + match[0].length;
  }
  return nodes.filter((n) => n.type !== 'text' || n.value.length > 0);
}

function convert(node: P5Node, casedNames: Map<string, string>): TplNode[] {
  if (node.nodeName === '#text') {
    const text = (node as { value: string }).value;
    return splitTextWithInterpolations(text);
  }
  if ('tagName' in node && node.tagName) {
    const author = casedNames.get(node.sourceCodeLocation?.startTag?.startOffset ?? -1) ?? node.tagName;
    const attrs: TplAttr[] = (node.attrs ?? []).map((a) =>
      classifyAttr(a.name, a.value),
    );
    const children: TplNode[] = [];
    for (const child of node.childNodes ?? []) {
      children.push(...convert(child as P5Node, casedNames));
    }
    return [{ type: 'element', tag: author, attrs, children }];
  }
  const kids: TplNode[] = [];
  for (const child of (node as { childNodes?: P5Node[] }).childNodes ?? []) {
    kids.push(...convert(child, casedNames));
  }
  return kids;
}

// parse5 lowercases tag names. We recover author casing by re-scanning source.
function collectAuthorCasing(source: string): Map<number, string> {
  const casing = new Map<number, string>();
  const rx = /<\s*([A-Za-z][\w-]*)/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(source)) !== null) {
    casing.set(m.index, m[1]);
  }
  return casing;
}

export function parseTemplate(source: string): TplNode[] {
  const casedByOffset = collectAuthorCasing(source);
  const fragment = parseFragment(source, { sourceCodeLocationInfo: true });
  const namesByStart = new Map<number, string>();
  for (const [offset, name] of casedByOffset) namesByStart.set(offset, name);
  attrKindGuard('static');
  const out: TplNode[] = [];
  for (const child of fragment.childNodes as P5Node[]) {
    out.push(...convert(child, namesByStart));
  }
  return out;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test tests/compiler/template-parse.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 6: Commit**

```bash
git add src/compiler/template/ast.ts src/compiler/template/parse.ts tests/compiler/template-parse.test.ts
git commit -m "feat(compiler): HTML template parser with binding classification"
```

---

## Task 9: Codegen for static elements + text + interpolations

**Files:**
- Create: `src/compiler/template/codegen.ts`
- Test: `tests/compiler/template-codegen.test.ts`

**Interfaces:**
- Consumes: AST types from `template/ast.ts`.
- Produces:
  - `codegen(ast: TplNode[]): string` — emits a JS expression that, given `(ctx)` in scope, returns a `Node` (or a `DocumentFragment` for multi-root templates).
  - The emitted expression references two runtime helpers, imported by the caller: `__el(tag, attrs, children, ctx)` and `__text(value)`. It also references `__bind(node, kind, name, exprFn, ctx)` for reactive attributes / interpolations (added in later tasks; here interpolation emits a plain text node with the current value).

- [ ] **Step 1: Write the failing test**

Write `tests/compiler/template-codegen.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { codegen } from '../../src/compiler/template/codegen.js';
import { parseTemplate } from '../../src/compiler/template/parse.js';

describe('codegen()', () => {
  it('emits a call to __el for a static element with text', () => {
    const js = codegen(parseTemplate('<div class="card">hi</div>'));
    expect(js).toContain('__el("div"');
    expect(js).toContain('__text("hi")');
    expect(js).toContain('["class", "static", "card"]');
  });

  it('emits reactive bindings via __bind', () => {
    const js = codegen(parseTemplate('<span>${props.title}</span>'));
    expect(js).toContain('__bind');
    expect(js).toContain('() => (props.title)');
  });

  it('emits binding descriptors with author-cased tag preserved', () => {
    const js = codegen(parseTemplate('<UserCard/>'));
    expect(js).toContain('__el("UserCard"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/compiler/template-codegen.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement codegen**

Write `src/compiler/template/codegen.ts`:
```ts
import type {
  TplAttr,
  TplElement,
  TplInterpolation,
  TplNode,
  TplText,
} from './ast.js';

function q(s: string): string {
  return JSON.stringify(s);
}

function attrsExpr(attrs: TplAttr[]): string {
  const items = attrs.map(
    (a) => `[${q(a.name)}, ${q(a.kind)}, ${q(a.value)}]`,
  );
  return `[${items.join(', ')}]`;
}

function nodeExpr(node: TplNode): string {
  if (node.type === 'text') return textExpr(node);
  if (node.type === 'interpolation') return interpolationExpr(node);
  return elementExpr(node);
}

function textExpr(node: TplText): string {
  return `__text(${q(node.value)})`;
}

function interpolationExpr(node: TplInterpolation): string {
  return `__bind(__text(""), "text-content", "", () => (${node.expression}), ctx)`;
}

function elementExpr(node: TplElement): string {
  const children = node.children.map(nodeExpr).join(', ');
  return `__el(${q(node.tag)}, ${attrsExpr(node.attrs)}, [${children}], ctx)`;
}

export function codegen(nodes: TplNode[]): string {
  if (nodes.length === 1) return nodeExpr(nodes[0]);
  const parts = nodes.map(nodeExpr).join(', ');
  return `__fragment([${parts}])`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/compiler/template-codegen.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/compiler/template/codegen.ts tests/compiler/template-codegen.test.ts
git commit -m "feat(compiler): template codegen for static elements and interpolations"
```

---

## Task 10: Runtime helpers `__el`, `__text`, `__bind`, `__fragment` and component registration

**Files:**
- Create: `src/runtime/component.ts`, `src/runtime/domHelpers.ts`
- Modify: `src/runtime/index.ts`
- Test: `tests/runtime/component.test.ts`

**Interfaces:**
- Produces:
  - `__el(tag, attrs, children, ctx)` — creates an element, resolves tag (PascalCase → kebab-case), applies attrs, appends children.
  - `__text(value)` — returns a `Text` node.
  - `__bind(node, kind, name, exprFn, ctx)` — attaches reactive binding based on the kind (`text-content`, `expression`, `event`, `property`, `boolean`).
  - `__fragment(nodes)` — returns a `DocumentFragment`.
  - `defineComponent(options)` — registers a Custom Element with template + script + style. Options:
    ```ts
    interface ComponentOptions {
      tag: string;                                       // kebab-case CE tag
      template: (ctx: TemplateCtx) => Node;
      setup?: (ctx: TemplateCtx) => Record<string, unknown> | void;
      style?: string;
      props?: string[];
    }
    interface TemplateCtx { props: Record<string, unknown>; host: HTMLElement; }
    ```
- Consumes: `state`, `effect`, `derived`, `scheduler`.

- [ ] **Step 1: Write the failing test**

Write `tests/runtime/component.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { defineComponent } from '../../src/runtime/component.js';
import { __bind, __el, __text } from '../../src/runtime/domHelpers.js';
import { flushSync } from '../../src/runtime/scheduler.js';
import { state } from '../../src/runtime/state.js';

describe('defineComponent() and dom helpers', () => {
  it('registers a custom element that renders its template', () => {
    defineComponent({
      tag: 'x-greeter',
      template: (ctx) =>
        __el('span', [['class', 'static', 'g']], [__text('hello ' + (ctx.props.who ?? 'world'))], ctx),
      props: ['who'],
    });
    document.body.innerHTML = '<x-greeter who="world"></x-greeter>';
    const el = document.body.querySelector('x-greeter')!;
    expect(el.querySelector('span.g')?.textContent).toBe('hello world');
  });

  it('rebinds text content when the tracked value changes', () => {
    const s = state({ text: 'first' });
    defineComponent({
      tag: 'x-live-text',
      template: (ctx) => {
        const t = __text('');
        __bind(t, 'text-content', '', () => s.text, ctx);
        return t;
      },
    });
    document.body.innerHTML = '<x-live-text></x-live-text>';
    const el = document.body.querySelector('x-live-text')!;
    expect(el.textContent).toBe('first');
    s.text = 'second';
    flushSync();
    expect(el.textContent).toBe('second');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/runtime/component.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement DOM helpers**

Write `src/runtime/domHelpers.ts`:
```ts
import { effect } from './effect.js';
import type { TemplateCtx } from './component.js';

export type AttrDescriptor = [
  name: string,
  kind: 'static' | 'expression' | 'event' | 'property' | 'boolean' | 'text-content',
  value: string,
];

function pascalToKebab(name: string): string {
  if (!/^[A-Z]/.test(name)) return name;
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

export function __text(value: string): Text {
  return document.createTextNode(value);
}

export function __fragment(nodes: Node[]): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (const n of nodes) frag.appendChild(n);
  return frag;
}

export function __el(
  tag: string,
  attrs: AttrDescriptor[],
  children: Node[],
  ctx: TemplateCtx,
): HTMLElement {
  const resolved = pascalToKebab(tag);
  const el = document.createElement(resolved);
  for (const [name, kind, value] of attrs) {
    if (kind === 'static') {
      el.setAttribute(name, value);
    } else {
      __bind(el, kind, name, buildExprFn(value, ctx), ctx);
    }
  }
  for (const child of children) el.appendChild(child);
  return el;
}

function buildExprFn(source: string, ctx: TemplateCtx): () => unknown {
  const fn = new Function('ctx', 'props', 'host', `return (${source});`);
  return () => fn(ctx, ctx.props, ctx.host);
}

export function __bind(
  node: Node,
  kind: AttrDescriptor[1],
  name: string,
  exprFn: () => unknown,
  _ctx: TemplateCtx,
): Node {
  if (kind === 'text-content') {
    effect(() => {
      (node as Text).data = String(exprFn() ?? '');
    });
    return node;
  }
  const el = node as HTMLElement;
  const attrName = name.replace(/^[@.?]/, '');
  if (kind === 'event') {
    let current: ((e: Event) => void) | null = null;
    effect(() => {
      if (current) el.removeEventListener(attrName, current);
      const handler = exprFn() as (e: Event) => void;
      current = handler;
      el.addEventListener(attrName, handler);
    });
    return el;
  }
  if (kind === 'property') {
    effect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (el as any)[attrName] = exprFn();
    });
    return el;
  }
  if (kind === 'boolean') {
    effect(() => {
      if (exprFn()) el.setAttribute(attrName, '');
      else el.removeAttribute(attrName);
    });
    return el;
  }
  // 'expression'
  effect(() => {
    const value = exprFn();
    if (value === false || value === null || value === undefined) {
      el.removeAttribute(attrName);
    } else {
      el.setAttribute(attrName, String(value));
    }
  });
  return el;
}
```

- [ ] **Step 4: Implement component base**

Write `src/runtime/component.ts`:
```ts
import { state } from './state.js';

export interface TemplateCtx {
  props: Record<string, unknown>;
  host: HTMLElement;
}

export interface ComponentOptions {
  tag: string;
  template: (ctx: TemplateCtx) => Node;
  setup?: (ctx: TemplateCtx) => Record<string, unknown> | void;
  style?: string;
  props?: string[];
}

export function defineComponent(options: ComponentOptions): void {
  const observedAttrs = options.props ?? [];

  class UiElement extends HTMLElement {
    static get observedAttributes(): string[] {
      return observedAttrs;
    }
    private _props = state<Record<string, unknown>>({});
    private _mounted = false;

    connectedCallback(): void {
      if (this._mounted) return;
      this._mounted = true;
      for (const name of observedAttrs) {
        if (this.hasAttribute(name)) {
          this._props[name] = this.getAttribute(name);
        }
      }
      const ctx: TemplateCtx = { props: this._props, host: this };
      Object.assign(this._props, options.setup?.(ctx) ?? {});
      const node = options.template(ctx);
      this.appendChild(node);
      if (options.style) {
        const styleEl = document.createElement('style');
        styleEl.textContent = options.style;
        this.appendChild(styleEl);
      }
    }

    attributeChangedCallback(name: string, _prev: string | null, next: string | null): void {
      this._props[name] = next;
    }
  }

  customElements.define(options.tag, UiElement);
}
```

- [ ] **Step 5: Update runtime public exports**

Write `src/runtime/index.ts`:
```ts
export { state } from './state.js';
export { effect } from './effect.js';
export { derived } from './derived.js';
export { defineComponent } from './component.js';
export { __bind, __el, __fragment, __text } from './domHelpers.js';
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm test tests/runtime/component.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 7: Commit**

```bash
git add src/runtime/component.ts src/runtime/domHelpers.ts src/runtime/index.ts tests/runtime/component.test.ts
git commit -m "feat(runtime): DOM helpers and defineComponent()"
```

---

## Task 11: `<if>` directive — AST transform + runtime helper

**Files:**
- Create: `src/runtime/directives/ifBlock.ts`, `src/compiler/directives/ifDirective.ts`
- Modify: `src/compiler/template/codegen.ts` (recognise directive nodes), `src/compiler/template/ast.ts` (add `TplIf`)
- Test: `tests/runtime/ifBlock.test.ts`, `tests/compiler/if-directive.test.ts`

**Interfaces:**
- Produces:
  - `renderIf(parent: Node, anchor: Node, cond: () => unknown, whenTrue: (ctx: TemplateCtx) => Node, whenFalse: ((ctx: TemplateCtx) => Node) | null, ctx: TemplateCtx): void`
  - AST node `TplIf { type: 'if'; condition: string; then: TplNode[]; else: TplNode[] | null }`
  - `transformIf(nodes: TplNode[]): TplNode[]` — replaces `<if when=${...}>` (and adjacent `<else>` child) into `TplIf`.
  - Codegen emits `__if(() => (cond), (ctx) => <then-node>, (ctx) => <else-node>, ctx)` — this helper is added to `domHelpers.ts` and re-exported by `runtime/index.ts`.

- [ ] **Step 1: Write the failing runtime test**

Write `tests/runtime/ifBlock.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { renderIf } from '../../src/runtime/directives/ifBlock.js';
import { flushSync } from '../../src/runtime/scheduler.js';
import { state } from '../../src/runtime/state.js';

describe('renderIf()', () => {
  it('mounts the "then" branch when the condition is truthy and swaps on change', () => {
    const s = state({ open: true });
    const host = document.createElement('div');
    const anchor = document.createTextNode('');
    host.appendChild(anchor);
    const ctx = { props: {}, host };
    renderIf(host, anchor, () => s.open,
      () => document.createTextNode('YES'),
      () => document.createTextNode('NO'),
      ctx,
    );
    expect(host.textContent).toBe('YES');
    s.open = false;
    flushSync();
    expect(host.textContent).toBe('NO');
    s.open = true;
    flushSync();
    expect(host.textContent).toBe('YES');
  });

  it('renders nothing when condition is false and no else branch is provided', () => {
    const s = state({ open: false });
    const host = document.createElement('div');
    const anchor = document.createTextNode('');
    host.appendChild(anchor);
    const ctx = { props: {}, host };
    renderIf(host, anchor, () => s.open,
      () => document.createTextNode('YES'),
      null,
      ctx,
    );
    expect(host.textContent).toBe('');
    s.open = true;
    flushSync();
    expect(host.textContent).toBe('YES');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/runtime/ifBlock.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `renderIf`**

Write `src/runtime/directives/ifBlock.ts`:
```ts
import type { TemplateCtx } from '../component.js';
import { effect } from '../effect.js';

export function renderIf(
  parent: Node,
  anchor: Node,
  cond: () => unknown,
  whenTrue: (ctx: TemplateCtx) => Node,
  whenFalse: ((ctx: TemplateCtx) => Node) | null,
  ctx: TemplateCtx,
): void {
  let currentNode: Node | null = null;
  let currentBranch: 'then' | 'else' | 'none' = 'none';
  effect(() => {
    const truthy = !!cond();
    const nextBranch = truthy ? 'then' : whenFalse ? 'else' : 'none';
    if (nextBranch === currentBranch) return;
    if (currentNode) {
      currentNode.parentNode?.removeChild(currentNode);
      currentNode = null;
    }
    if (nextBranch === 'then') currentNode = whenTrue(ctx);
    else if (nextBranch === 'else' && whenFalse) currentNode = whenFalse(ctx);
    if (currentNode) parent.insertBefore(currentNode, anchor.nextSibling);
    currentBranch = nextBranch;
  });
}
```

- [ ] **Step 4: Run runtime test to verify it passes**

Run: `pnpm test tests/runtime/ifBlock.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Extend AST types**

Edit `src/compiler/template/ast.ts` — add:
```ts
export interface TplIf {
  type: 'if';
  condition: string;
  then: TplNode[];
  else: TplNode[] | null;
}

// widen the union
export type TplNode = TplElement | TplText | TplInterpolation | TplIf;
```

- [ ] **Step 6: Write the failing compiler test**

Write `tests/compiler/if-directive.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { transformDirectives } from '../../src/compiler/template/transform.js';
import { codegen } from '../../src/compiler/template/codegen.js';
import { parseTemplate } from '../../src/compiler/template/parse.js';

describe('<if> directive', () => {
  it('transforms <if when=${cond}>...<else>...</else></if>', () => {
    const ast = transformDirectives(
      parseTemplate('<if when="${open}">yes<else>no</else></if>'),
    );
    expect(ast).toEqual([
      {
        type: 'if',
        condition: 'open',
        then: [{ type: 'text', value: 'yes' }],
        else: [{ type: 'text', value: 'no' }],
      },
    ]);
  });

  it('emits __if() call in codegen', () => {
    const ast = transformDirectives(parseTemplate('<if when="${open}">yes</if>'));
    const js = codegen(ast);
    expect(js).toContain('__if');
    expect(js).toContain('() => (open)');
  });
});
```

- [ ] **Step 7: Run compiler test to verify it fails**

Run: `pnpm test tests/compiler/if-directive.test.ts`
Expected: FAIL — `transformDirectives` not found.

- [ ] **Step 8: Implement AST transform pipeline entry point**

Write `src/compiler/template/transform.ts`:
```ts
import type { TplElement, TplNode } from './ast.js';
import { transformIf } from '../directives/ifDirective.js';

export type DirectiveTransform = (node: TplElement, siblings: TplNode[], index: number) => {
  node: TplNode;
  consumeNext: number;
} | null;

const DIRECTIVES: Record<string, DirectiveTransform> = {
  if: transformIf,
};

export function transformDirectives(nodes: TplNode[]): TplNode[] {
  const out: TplNode[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type === 'element' && DIRECTIVES[node.tag]) {
      const result = DIRECTIVES[node.tag](node, nodes, i);
      if (result) {
        out.push(result.node);
        i += result.consumeNext;
        continue;
      }
    }
    if (node.type === 'element') {
      out.push({ ...node, children: transformDirectives(node.children) });
    } else {
      out.push(node);
    }
  }
  return out;
}
```

- [ ] **Step 9: Implement `<if>` directive**

Write `src/compiler/directives/ifDirective.ts`:
```ts
import type { TplElement, TplIf, TplNode } from '../template/ast.js';
import type { DirectiveTransform } from '../template/transform.js';

function findWhen(node: TplElement): string {
  const attr = node.attrs.find((a) => a.name === 'when');
  if (!attr) throw new Error('<if> requires a "when" attribute');
  if (attr.kind === 'expression') return attr.value;
  return attr.value;
}

function splitThenElse(children: TplNode[]): { thenNodes: TplNode[]; elseNodes: TplNode[] | null } {
  const elseIdx = children.findIndex(
    (c) => c.type === 'element' && c.tag === 'else',
  );
  if (elseIdx === -1) return { thenNodes: children, elseNodes: null };
  const elseEl = children[elseIdx] as TplElement;
  return {
    thenNodes: children.slice(0, elseIdx),
    elseNodes: elseEl.children,
  };
}

export const transformIf: DirectiveTransform = (node) => {
  const condition = findWhen(node);
  const { thenNodes, elseNodes } = splitThenElse(node.children);
  const result: TplIf = {
    type: 'if',
    condition,
    then: thenNodes,
    else: elseNodes,
  };
  return { node: result, consumeNext: 0 };
};
```

- [ ] **Step 10: Teach codegen to emit `__if()`**

Edit `src/compiler/template/codegen.ts` — extend `nodeExpr`:
```ts
function nodeExpr(node: TplNode): string {
  if (node.type === 'text') return textExpr(node);
  if (node.type === 'interpolation') return interpolationExpr(node);
  if (node.type === 'if') return ifExpr(node);
  return elementExpr(node);
}

function ifExpr(node: TplIf): string {
  const thenBody = childrenBlock(node.then);
  const elseBody = node.else ? childrenBlock(node.else) : 'null';
  return `__if(() => (${node.condition}), (ctx) => ${thenBody}, ${elseBody === 'null' ? 'null' : `(ctx) => ${elseBody}`}, ctx)`;
}

function childrenBlock(children: TplNode[]): string {
  if (children.length === 1) return nodeExpr(children[0]);
  return `__fragment([${children.map(nodeExpr).join(', ')}])`;
}
```

Add matching import at the top:
```ts
import type { TplIf } from './ast.js';
```

- [ ] **Step 11: Add `__if` DOM helper and export**

Edit `src/runtime/domHelpers.ts` — append:
```ts
import { renderIf } from './directives/ifBlock.js';

export function __if(
  cond: () => unknown,
  whenTrue: (ctx: TemplateCtx) => Node,
  whenFalse: ((ctx: TemplateCtx) => Node) | null,
  ctx: TemplateCtx,
): Node {
  const anchor = document.createTextNode('');
  queueMicrotask(() => {
    if (!anchor.parentNode) return;
    renderIf(anchor.parentNode, anchor, cond, whenTrue, whenFalse, ctx);
  });
  return anchor;
}
```

Edit `src/runtime/index.ts` — add `__if` to the exports.

- [ ] **Step 12: Run compiler test to verify it passes**

Run: `pnpm test tests/compiler/if-directive.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 13: Commit**

```bash
git add src/runtime/directives/ifBlock.ts src/compiler/directives/ifDirective.ts src/compiler/template/transform.ts src/compiler/template/codegen.ts src/compiler/template/ast.ts src/runtime/domHelpers.ts src/runtime/index.ts tests/runtime/ifBlock.test.ts tests/compiler/if-directive.test.ts
git commit -m "feat: <if> directive with AST transform and runtime reconcile"
```

---

## Task 12: `<for>` directive — keyed reconciliation

**Files:**
- Create: `src/runtime/directives/forBlock.ts`, `src/compiler/directives/forDirective.ts`
- Modify: `src/compiler/template/transform.ts` (register `for`), `src/compiler/template/codegen.ts` (emit `__for`), `src/compiler/template/ast.ts` (add `TplFor`), `src/runtime/domHelpers.ts` (add `__for`), `src/runtime/index.ts`
- Test: `tests/runtime/forBlock.test.ts`, `tests/compiler/for-directive.test.ts`

**Interfaces:**
- Produces:
  - `renderFor<T>(parent: Node, anchor: Node, source: () => T[], keyOf: (item: T, index: number) => unknown, bodyFactory: (item: T, index: number, ctx: TemplateCtx) => Node, ctx: TemplateCtx): void` — keyed reconcile with insert / move / remove.
  - AST node `TplFor { type: 'for'; each: string; itemVar: string; keyExpr: string | null; body: TplNode[] }`
  - `transformFor(node: TplElement): TplNode` — extracts `each`, `item`, `key` attributes.
  - Codegen emits `__for(() => (each), (item, index) => (key), (item, index, ctx) => <body>, ctx)`.

- [ ] **Step 1: Write the failing runtime test**

Write `tests/runtime/forBlock.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { renderFor } from '../../src/runtime/directives/forBlock.js';
import { flushSync } from '../../src/runtime/scheduler.js';
import { state } from '../../src/runtime/state.js';

describe('renderFor()', () => {
  it('renders initial list and updates when items change', () => {
    const s = state({ items: [{ id: 'a', v: 1 }, { id: 'b', v: 2 }] });
    const host = document.createElement('ul');
    const anchor = document.createTextNode('');
    host.appendChild(anchor);
    const ctx = { props: {}, host };
    renderFor(host, anchor,
      () => s.items,
      (item) => item.id,
      (item) => {
        const li = document.createElement('li');
        li.textContent = String(item.v);
        return li;
      },
      ctx,
    );
    expect([...host.querySelectorAll('li')].map((l) => l.textContent)).toEqual(['1', '2']);

    s.items.push({ id: 'c', v: 3 });
    flushSync();
    expect([...host.querySelectorAll('li')].map((l) => l.textContent)).toEqual(['1', '2', '3']);

    s.items.splice(0, 1);
    flushSync();
    expect([...host.querySelectorAll('li')].map((l) => l.textContent)).toEqual(['2', '3']);
  });

  it('preserves nodes for retained keys (identity check)', () => {
    const s = state({ items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] });
    const host = document.createElement('div');
    const anchor = document.createTextNode('');
    host.appendChild(anchor);
    const ctx = { props: {}, host };
    renderFor(host, anchor,
      () => s.items,
      (item) => item.id,
      () => document.createElement('span'),
      ctx,
    );
    const before = [...host.querySelectorAll('span')];
    s.items.splice(1, 0, { id: 'x' } as { id: string });
    flushSync();
    const after = [...host.querySelectorAll('span')];
    expect(after).toHaveLength(4);
    expect(after[0]).toBe(before[0]);
    expect(after[2]).toBe(before[1]);
    expect(after[3]).toBe(before[2]);
  });
});
```

- [ ] **Step 2: Run runtime test to verify it fails**

Run: `pnpm test tests/runtime/forBlock.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `renderFor`**

Write `src/runtime/directives/forBlock.ts`:
```ts
import type { TemplateCtx } from '../component.js';
import { effect } from '../effect.js';

interface Slot<T> {
  node: Node;
  item: T;
}

export function renderFor<T>(
  parent: Node,
  anchor: Node,
  source: () => T[],
  keyOf: (item: T, index: number) => unknown,
  bodyFactory: (item: T, index: number, ctx: TemplateCtx) => Node,
  ctx: TemplateCtx,
): void {
  const slots = new Map<unknown, Slot<T>>();
  let order: unknown[] = [];

  effect(() => {
    const list = source();
    const nextOrder = list.map((item, i) => keyOf(item, i));
    const nextSet = new Set(nextOrder);
    for (const key of order) {
      if (!nextSet.has(key)) {
        const slot = slots.get(key);
        slot?.node.parentNode?.removeChild(slot.node);
        slots.delete(key);
      }
    }
    let cursor: Node = anchor;
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const key = nextOrder[i];
      let slot = slots.get(key);
      if (!slot) {
        slot = { node: bodyFactory(item, i, ctx), item };
        slots.set(key, slot);
      } else if (slot.item !== item) {
        slot.item = item;
      }
      const expectedNext = cursor.nextSibling;
      if (slot.node !== expectedNext) {
        parent.insertBefore(slot.node, expectedNext);
      }
      cursor = slot.node;
    }
    order = nextOrder;
  });
}
```

- [ ] **Step 4: Run runtime test to verify it passes**

Run: `pnpm test tests/runtime/forBlock.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 5: Extend AST types**

Edit `src/compiler/template/ast.ts` — add:
```ts
export interface TplFor {
  type: 'for';
  each: string;
  itemVar: string;
  keyExpr: string | null;
  body: TplNode[];
}

// extend the union
export type TplNode = TplElement | TplText | TplInterpolation | TplIf | TplFor;
```

- [ ] **Step 6: Write the failing compiler test**

Write `tests/compiler/for-directive.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { codegen } from '../../src/compiler/template/codegen.js';
import { parseTemplate } from '../../src/compiler/template/parse.js';
import { transformDirectives } from '../../src/compiler/template/transform.js';

describe('<for> directive', () => {
  it('transforms <for each="${todos}" item="t" key="t.id">', () => {
    const ast = transformDirectives(
      parseTemplate('<for each="${todos}" item="t" key="t.id"><li>x</li></for>'),
    );
    expect(ast[0]).toMatchObject({
      type: 'for',
      each: 'todos',
      itemVar: 't',
      keyExpr: 't.id',
    });
  });

  it('emits __for() call in codegen with body factory', () => {
    const ast = transformDirectives(
      parseTemplate('<for each="${todos}" item="t" key="t.id"><li>x</li></for>'),
    );
    const js = codegen(ast);
    expect(js).toContain('__for');
    expect(js).toContain('(t, index, ctx) =>');
    expect(js).toContain('(t, index) => (t.id)');
  });
});
```

- [ ] **Step 7: Run compiler test to verify it fails**

Run: `pnpm test tests/compiler/for-directive.test.ts`
Expected: FAIL — transform not registered.

- [ ] **Step 8: Implement `transformFor`**

Write `src/compiler/directives/forDirective.ts`:
```ts
import type { TplElement, TplFor } from '../template/ast.js';
import type { DirectiveTransform } from '../template/transform.js';

function readAttr(node: TplElement, name: string, required: boolean): string | null {
  const attr = node.attrs.find((a) => a.name === name);
  if (!attr) {
    if (required) throw new Error(`<for> requires a "${name}" attribute`);
    return null;
  }
  return attr.value;
}

export const transformFor: DirectiveTransform = (node) => {
  const each = readAttr(node, 'each', true)!;
  const itemVar = readAttr(node, 'item', false) ?? 'item';
  const keyExpr = readAttr(node, 'key', false);
  const result: TplFor = {
    type: 'for',
    each,
    itemVar,
    keyExpr,
    body: node.children,
  };
  return { node: result, consumeNext: 0 };
};
```

- [ ] **Step 9: Register directive and extend codegen**

Edit `src/compiler/template/transform.ts`:
```ts
import { transformFor } from '../directives/forDirective.js';
// add to DIRECTIVES:
const DIRECTIVES: Record<string, DirectiveTransform> = {
  if: transformIf,
  for: transformFor,
};
```

Edit `src/compiler/template/codegen.ts` — extend `nodeExpr` and add `forExpr`:
```ts
import type { TplFor } from './ast.js';

function nodeExpr(node: TplNode): string {
  if (node.type === 'text') return textExpr(node);
  if (node.type === 'interpolation') return interpolationExpr(node);
  if (node.type === 'if') return ifExpr(node);
  if (node.type === 'for') return forExpr(node);
  return elementExpr(node);
}

function forExpr(node: TplFor): string {
  const body = childrenBlock(node.body);
  const key = node.keyExpr ? `(${node.itemVar}, index) => (${node.keyExpr})` : `(${node.itemVar}, index) => index`;
  return `__for(() => (${node.each}), ${key}, (${node.itemVar}, index, ctx) => ${body}, ctx)`;
}
```

- [ ] **Step 10: Implement `__for` DOM helper**

Edit `src/runtime/domHelpers.ts` — append:
```ts
import { renderFor } from './directives/forBlock.js';

export function __for<T>(
  source: () => T[],
  keyOf: (item: T, index: number) => unknown,
  bodyFactory: (item: T, index: number, ctx: TemplateCtx) => Node,
  ctx: TemplateCtx,
): Node {
  const anchor = document.createTextNode('');
  queueMicrotask(() => {
    if (!anchor.parentNode) return;
    renderFor(anchor.parentNode, anchor, source, keyOf, bodyFactory, ctx);
  });
  return anchor;
}
```

Edit `src/runtime/index.ts` — export `__for`.

- [ ] **Step 11: Run compiler test to verify it passes**

Run: `pnpm test tests/compiler/for-directive.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 12: Commit**

```bash
git add src/runtime/directives/forBlock.ts src/compiler/directives/forDirective.ts src/compiler/template/transform.ts src/compiler/template/codegen.ts src/compiler/template/ast.ts src/runtime/domHelpers.ts src/runtime/index.ts tests/runtime/forBlock.test.ts tests/compiler/for-directive.test.ts
git commit -m "feat: <for> directive with keyed reconciliation"
```

---

## Task 13: `<case>` / `<when>` / `<else>` directive

**Files:**
- Create: `src/runtime/directives/caseBlock.ts`, `src/compiler/directives/caseDirective.ts`
- Modify: `src/compiler/template/transform.ts` (register `case`), `src/compiler/template/codegen.ts` (emit `__case`), `src/compiler/template/ast.ts` (add `TplCase`), `src/runtime/domHelpers.ts` (add `__case`), `src/runtime/index.ts`
- Test: `tests/runtime/caseBlock.test.ts`, `tests/compiler/case-directive.test.ts`

**Interfaces:**
- Produces:
  - `renderCase(parent: Node, anchor: Node, subject: () => unknown, arms: Array<{ match: unknown | typeof CASE_DEFAULT; factory: (ctx: TemplateCtx) => Node }>, ctx: TemplateCtx): void`
  - `CASE_DEFAULT: unique symbol`
  - `TplCase { type: 'case'; on: string; arms: Array<{ match: string | null; body: TplNode[] }> }` where `match: null` marks the `<else>` arm.
  - Codegen emits `__case(() => (on), [{ match: <literal|Symbol.for('uidetox.else')>, factory: (ctx) => body }], ctx)`.

- [ ] **Step 1: Write the failing runtime test**

Write `tests/runtime/caseBlock.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { CASE_DEFAULT, renderCase } from '../../src/runtime/directives/caseBlock.js';
import { flushSync } from '../../src/runtime/scheduler.js';
import { state } from '../../src/runtime/state.js';

describe('renderCase()', () => {
  it('mounts the arm whose match equals the subject', () => {
    const s = state({ status: 'loading' as 'loading' | 'error' | 'ok' });
    const host = document.createElement('div');
    const anchor = document.createTextNode('');
    host.appendChild(anchor);
    const ctx = { props: {}, host };
    renderCase(host, anchor, () => s.status, [
      { match: 'loading', factory: () => document.createTextNode('L') },
      { match: 'error',   factory: () => document.createTextNode('E') },
      { match: CASE_DEFAULT, factory: () => document.createTextNode('D') },
    ], ctx);
    expect(host.textContent).toBe('L');
    s.status = 'error';
    flushSync();
    expect(host.textContent).toBe('E');
    s.status = 'ok';
    flushSync();
    expect(host.textContent).toBe('D');
  });
});
```

- [ ] **Step 2: Run runtime test to verify it fails**

Run: `pnpm test tests/runtime/caseBlock.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `renderCase`**

Write `src/runtime/directives/caseBlock.ts`:
```ts
import type { TemplateCtx } from '../component.js';
import { effect } from '../effect.js';

export const CASE_DEFAULT = Symbol('uidetox.case.default');

export interface CaseArm {
  match: unknown | typeof CASE_DEFAULT;
  factory: (ctx: TemplateCtx) => Node;
}

export function renderCase(
  parent: Node,
  anchor: Node,
  subject: () => unknown,
  arms: CaseArm[],
  ctx: TemplateCtx,
): void {
  let currentIndex = -1;
  let currentNode: Node | null = null;
  effect(() => {
    const value = subject();
    let matchedIndex = arms.findIndex((a) => a.match !== CASE_DEFAULT && a.match === value);
    if (matchedIndex === -1) {
      matchedIndex = arms.findIndex((a) => a.match === CASE_DEFAULT);
    }
    if (matchedIndex === currentIndex) return;
    if (currentNode) currentNode.parentNode?.removeChild(currentNode);
    currentNode = matchedIndex === -1 ? null : arms[matchedIndex].factory(ctx);
    if (currentNode) parent.insertBefore(currentNode, anchor.nextSibling);
    currentIndex = matchedIndex;
  });
}
```

- [ ] **Step 4: Run runtime test to verify it passes**

Run: `pnpm test tests/runtime/caseBlock.test.ts`
Expected: PASS — 1 test.

- [ ] **Step 5: Extend AST types**

Edit `src/compiler/template/ast.ts` — add:
```ts
export interface TplCase {
  type: 'case';
  on: string;
  arms: Array<{ match: string | null; body: TplNode[] }>;
}

export type TplNode = TplElement | TplText | TplInterpolation | TplIf | TplFor | TplCase;
```

- [ ] **Step 6: Write the failing compiler test**

Write `tests/compiler/case-directive.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { codegen } from '../../src/compiler/template/codegen.js';
import { parseTemplate } from '../../src/compiler/template/parse.js';
import { transformDirectives } from '../../src/compiler/template/transform.js';

describe('<case> directive', () => {
  it('transforms case/when/else into TplCase arms', () => {
    const ast = transformDirectives(
      parseTemplate(
        '<case on="${status}"><when is="loading">L</when><when is="error">E</when><else>D</else></case>',
      ),
    );
    expect(ast[0]).toEqual({
      type: 'case',
      on: 'status',
      arms: [
        { match: 'loading', body: [{ type: 'text', value: 'L' }] },
        { match: 'error',   body: [{ type: 'text', value: 'E' }] },
        { match: null,      body: [{ type: 'text', value: 'D' }] },
      ],
    });
  });

  it('emits __case() with CASE_DEFAULT for else arm', () => {
    const ast = transformDirectives(
      parseTemplate('<case on="${x}"><when is="a">A</when><else>B</else></case>'),
    );
    const js = codegen(ast);
    expect(js).toContain('__case(() => (x)');
    expect(js).toContain('"a"');
    expect(js).toContain('CASE_DEFAULT');
  });
});
```

- [ ] **Step 7: Run compiler test to verify it fails**

Run: `pnpm test tests/compiler/case-directive.test.ts`
Expected: FAIL.

- [ ] **Step 8: Implement `transformCase`**

Write `src/compiler/directives/caseDirective.ts`:
```ts
import type { TplCase, TplElement, TplNode } from '../template/ast.js';
import type { DirectiveTransform } from '../template/transform.js';

function readAttr(node: TplElement, name: string): string | null {
  const attr = node.attrs.find((a) => a.name === name);
  return attr ? attr.value : null;
}

export const transformCase: DirectiveTransform = (node) => {
  const on = readAttr(node, 'on');
  if (!on) throw new Error('<case> requires an "on" attribute');
  const arms: TplCase['arms'] = [];
  for (const child of node.children) {
    if (child.type !== 'element') continue;
    if (child.tag === 'when') {
      const match = readAttr(child, 'is');
      if (match === null) throw new Error('<when> requires an "is" attribute');
      arms.push({ match, body: child.children });
    } else if (child.tag === 'else') {
      arms.push({ match: null, body: child.children });
    }
  }
  const result: TplCase = { type: 'case', on, arms };
  return { node: result, consumeNext: 0 };
};
```

- [ ] **Step 9: Register and codegen**

Edit `src/compiler/template/transform.ts`:
```ts
import { transformCase } from '../directives/caseDirective.js';
const DIRECTIVES: Record<string, DirectiveTransform> = {
  if: transformIf,
  for: transformFor,
  case: transformCase,
};
```

Edit `src/compiler/template/codegen.ts` — add `caseExpr` and include in `nodeExpr`:
```ts
import type { TplCase } from './ast.js';

function nodeExpr(node: TplNode): string {
  if (node.type === 'text') return textExpr(node);
  if (node.type === 'interpolation') return interpolationExpr(node);
  if (node.type === 'if') return ifExpr(node);
  if (node.type === 'for') return forExpr(node);
  if (node.type === 'case') return caseExpr(node);
  return elementExpr(node);
}

function caseExpr(node: TplCase): string {
  const arms = node.arms
    .map((arm) => {
      const matchLiteral = arm.match === null ? 'CASE_DEFAULT' : q(arm.match);
      const body = childrenBlock(arm.body);
      return `{ match: ${matchLiteral}, factory: (ctx) => ${body} }`;
    })
    .join(', ');
  return `__case(() => (${node.on}), [${arms}], ctx)`;
}
```

- [ ] **Step 10: Add `__case` DOM helper and export**

Edit `src/runtime/domHelpers.ts` — append:
```ts
import { CASE_DEFAULT, renderCase, type CaseArm } from './directives/caseBlock.js';

export { CASE_DEFAULT };

export function __case(
  subject: () => unknown,
  arms: CaseArm[],
  ctx: TemplateCtx,
): Node {
  const anchor = document.createTextNode('');
  queueMicrotask(() => {
    if (!anchor.parentNode) return;
    renderCase(anchor.parentNode, anchor, subject, arms, ctx);
  });
  return anchor;
}
```

Edit `src/runtime/index.ts` — export `__case` and `CASE_DEFAULT`.

- [ ] **Step 11: Run compiler test to verify it passes**

Run: `pnpm test tests/compiler/case-directive.test.ts`
Expected: PASS — 2 tests.

- [ ] **Step 12: Commit**

```bash
git add src/runtime/directives/caseBlock.ts src/compiler/directives/caseDirective.ts src/compiler/template/transform.ts src/compiler/template/codegen.ts src/compiler/template/ast.ts src/runtime/domHelpers.ts src/runtime/index.ts tests/runtime/caseBlock.test.ts tests/compiler/case-directive.test.ts
git commit -m "feat: <case>/<when>/<else> directive"
```

---

## Task 14: Top-level `compile(source)` — glue SFC → JS module

**Files:**
- Create: `src/compiler/compile.ts`, `src/compiler/index.ts`
- Test: `tests/compiler/compile.test.ts`

**Interfaces:**
- Consumes: `parseSfc`, `parseTemplate`, `transformDirectives`, `codegen`.
- Produces:
  - `compile(source: string): { js: string; tag: string }`
  - Emits an ES module that:
    1. Imports the runtime helpers from `'ui-detox'`.
    2. Contains the `ts script` block source (assumed to define `props`, handlers, or `state`) inside a `setup(ctx)` closure that returns whatever it declared as exports; if the script has `export const props = {...}`, it is destructured; otherwise the entire top-level `let`/`const` set is returned to the template ctx.
    3. Contains the compiled template as `template(ctx)`.
    4. Calls `defineComponent({ tag, template, setup, style, props: [...] })`.

For MVP we treat the script block as **the body of `setup`** — any `const` / `let` declared in it becomes an entry on the returned object. We do not parse TypeScript here — we simply wrap it. Prop types (`ts props` block) are used to derive the observed-attribute names via a simple regex over `title: string` etc.

- [ ] **Step 1: Write the failing test**

Write `tests/compiler/compile.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { compile } from '../../src/compiler/compile.js';

const SFC = `---
name: Greeter
tag: x-greeter
---

\`\`\`ts props
export type Props = { who: string };
\`\`\`

\`\`\`html template
<span>hello \${props.who}</span>
\`\`\`

\`\`\`ts script
const count = 0;
\`\`\`
`;

describe('compile()', () => {
  it('produces an ES module that calls defineComponent for the tag', () => {
    const { js, tag } = compile(SFC);
    expect(tag).toBe('x-greeter');
    expect(js).toContain('import { defineComponent, __el, __text, __bind, __if, __for, __case, __fragment, CASE_DEFAULT } from "ui-detox";');
    expect(js).toContain('defineComponent({');
    expect(js).toContain('tag: "x-greeter"');
    expect(js).toContain('__el("span"');
    expect(js).toContain('props: ["who"]');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/compiler/compile.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `compile`**

Write `src/compiler/compile.ts`:
```ts
import { parseSfc, type Sfc } from './sfc.js';
import { parseTemplate } from './template/parse.js';
import { transformDirectives } from './template/transform.js';
import { codegen } from './template/codegen.js';

const RUNTIME_IMPORTS =
  'import { defineComponent, __el, __text, __bind, __if, __for, __case, __fragment, CASE_DEFAULT } from "ui-detox";';

const PROP_LINE = /^\s*(\w+)\s*[?:]/;

function extractPropNames(propsBlock: string | undefined): string[] {
  if (!propsBlock) return [];
  const names: string[] = [];
  const inTypeBlock = /Props\s*=\s*\{([\s\S]*?)\}/m.exec(propsBlock);
  if (!inTypeBlock) return [];
  for (const line of inTypeBlock[1].split('\n')) {
    const m = PROP_LINE.exec(line);
    if (m) names.push(m[1]);
  }
  return names;
}

function readTag(sfc: Sfc): string {
  const tag = sfc.frontmatter.tag;
  if (typeof tag !== 'string' || !tag.includes('-')) {
    throw new Error('SFC frontmatter must define a "tag" containing at least one hyphen');
  }
  return tag;
}

export function compile(source: string): { js: string; tag: string } {
  const sfc = parseSfc(source);
  const tag = readTag(sfc);
  const template = sfc.blocks.find((b) => b.role === 'template');
  if (!template) throw new Error('SFC must contain an `html template` block');
  const script = sfc.blocks.find((b) => b.role === 'script');
  const style = sfc.blocks.find((b) => b.role === 'style');
  const props = sfc.blocks.find((b) => b.role === 'props');

  const ast = transformDirectives(parseTemplate(template.content));
  const templateBody = codegen(ast);

  const propNames = extractPropNames(props?.content);

  const js = `${RUNTIME_IMPORTS}
${props?.content ?? ''}

function setup(ctx) {
  const { props, host } = ctx;
${script?.content ?? ''}
  return { };
}

function template(ctx) {
  const { props, host } = ctx;
  return ${templateBody};
}

defineComponent({
  tag: ${JSON.stringify(tag)},
  props: ${JSON.stringify(propNames)},
  setup,
  template${style ? `,\n  style: ${JSON.stringify(style.content)}` : ''}
});
`;

  return { js, tag };
}
```

- [ ] **Step 4: Add compiler barrel**

Write `src/compiler/index.ts`:
```ts
export { compile } from './compile.js';
export { parseSfc } from './sfc.js';
export { parseTemplate } from './template/parse.js';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test tests/compiler/compile.test.ts`
Expected: PASS — 1 test.

- [ ] **Step 6: Commit**

```bash
git add src/compiler/compile.ts src/compiler/index.ts tests/compiler/compile.test.ts
git commit -m "feat(compiler): top-level compile(source) glue"
```

---

## Task 15: CLI — `ui-detox build <glob>`

**Files:**
- Create: `src/cli/build.ts`
- Test: `tests/cli/build.test.ts`

**Interfaces:**
- Produces:
  - `ui-detox build <inputGlob> --outDir <dir>` — writes one `.js` per `.md` file, preserving relative paths.
  - Uses `commander` for arg parsing, `fs/promises` for reading, and Node's `glob` (via `fs.glob` or `fast-glob`; for MVP we implement a minimal recursive walk to avoid another dependency).

- [ ] **Step 1: Write the failing test**

Write `tests/cli/build.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runBuild } from '../../src/cli/build.js';

const SFC = `---
name: Hello
tag: x-hello
---

\`\`\`html template
<span>hi</span>
\`\`\`
`;

describe('runBuild()', () => {
  it('compiles each .md under inputDir and writes a matching .js under outDir', async () => {
    const root = mkdtempSync(join(tmpdir(), 'uidetox-build-'));
    const src = join(root, 'src');
    const out = join(root, 'out');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'Hello.md'), SFC);

    await runBuild({ inputDir: src, outDir: out });

    const compiled = readFileSync(join(out, 'Hello.js'), 'utf8');
    expect(compiled).toContain('defineComponent(');
    expect(compiled).toContain('tag: "x-hello"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/cli/build.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `runBuild`**

Write `src/cli/build.ts`:
```ts
#!/usr/bin/env node
import { Command } from 'commander';
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { basename, dirname, extname, join, relative } from 'node:path';
import { compile } from '../compiler/compile.js';

export interface BuildOptions {
  inputDir: string;
  outDir: string;
}

async function walk(dir: string, root = dir): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir)) {
    const full = join(dir, entry);
    const info = await stat(full);
    if (info.isDirectory()) out.push(...await walk(full, root));
    else if (extname(full) === '.md') out.push(relative(root, full));
  }
  return out;
}

export async function runBuild(options: BuildOptions): Promise<void> {
  const files = await walk(options.inputDir);
  await mkdir(options.outDir, { recursive: true });
  for (const rel of files) {
    const source = await readFile(join(options.inputDir, rel), 'utf8');
    const { js } = compile(source);
    const outPath = join(options.outDir, rel.replace(/\.md$/, '.js'));
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, js, 'utf8');
    // eslint-disable-next-line no-console
    console.log(`compiled ${rel} → ${basename(outPath)}`);
  }
}

const program = new Command();
program
  .name('ui-detox')
  .command('build <inputDir>')
  .option('-o, --outDir <dir>', 'Output directory', 'dist')
  .action(async (inputDir: string, opts: { outDir: string }) => {
    await runBuild({ inputDir, outDir: opts.outDir });
  });

if (process.argv[1]?.endsWith('build.ts') || process.argv[1]?.endsWith('build.js')) {
  program.parseAsync(process.argv);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/cli/build.test.ts`
Expected: PASS — 1 test.

- [ ] **Step 5: Commit**

```bash
git add src/cli/build.ts tests/cli/build.test.ts
git commit -m "feat(cli): ui-detox build compiles SFCs into a dist folder"
```

---

## Task 16: End-to-end example — hello world component boots

**Files:**
- Create: `examples/hello/App.md`, `examples/hello/index.html`
- Test: `tests/e2e/hello.test.ts`

**Interfaces:**
- The full pipeline (SFC → JS → runtime → DOM) works end-to-end in `happy-dom`. Manual browser check is a follow-up.

- [ ] **Step 1: Create example SFC**

Write `examples/hello/App.md`:
````md
---
name: App
tag: app-root
---

# App

Root of the hello example.

```ts props
export type Props = { who: string };
```

```html template
<section class="hello">
  <h1>Hello, ${props.who}!</h1>
  <if when="${state.open}">
    <p>The panel is open.</p>
    <else><p>The panel is closed.</p></else>
  </if>
  <button @click="${toggle}">Toggle</button>
</section>
```

```ts script
const s = state({ open: true });
function toggle() { s.open = !s.open; }
```
````

Write `examples/hello/index.html`:
```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>UIDetox Hello</title></head>
<body>
  <app-root who="World"></app-root>
  <script type="module" src="./App.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write the failing E2E test**

Write `tests/e2e/hello.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compile } from '../../src/compiler/compile.js';
import { flushSync } from '../../src/runtime/scheduler.js';

describe('hello world SFC', () => {
  it('compiles and boots in a happy-dom environment', async () => {
    const src = readFileSync(join(process.cwd(), 'examples/hello/App.md'), 'utf8');
    const { js } = compile(src);
    // Evaluate the module with local runtime import instead of the "ui-detox" specifier
    const runtimeSpecifier = new URL('../../src/runtime/index.ts', import.meta.url).pathname;
    const rewritten = js.replace('"ui-detox"', JSON.stringify(runtimeSpecifier));
    const dataUrl = 'data:text/javascript;base64,' + Buffer.from(rewritten).toString('base64');
    await import(/* @vite-ignore */ dataUrl);

    document.body.innerHTML = '<app-root who="World"></app-root>';
    // let queued microtasks flush
    await Promise.resolve();
    flushSync();

    const root = document.body.querySelector('app-root')!;
    expect(root.querySelector('h1')?.textContent).toBe('Hello, World!');
    expect(root.textContent).toContain('The panel is open.');

    root.querySelector('button')!.click();
    flushSync();
    expect(root.textContent).toContain('The panel is closed.');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm test tests/e2e/hello.test.ts`
Expected: FAIL — most likely on the toggle assertion or on missing pieces of the runtime for `attributeChangedCallback`, because `who` is a static attribute. Iterate the runtime until this end-to-end passes; do not proceed until it does. Do not stub around the failure. If a runtime helper is missing, that is a bug in an earlier task — go back, add the missing behavior with its own test in that task's file, and rerun the whole test suite.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/e2e/hello.test.ts`
Expected: PASS — 1 test.

- [ ] **Step 5: Run full suite**

Run: `pnpm test`
Expected: PASS — every test across runtime, compiler, cli, e2e.

- [ ] **Step 6: Commit**

```bash
git add examples/hello/App.md examples/hello/index.html tests/e2e/hello.test.ts
git commit -m "test(e2e): hello world SFC boots end-to-end"
```

---

## Self-Review Notes

- **Spec coverage:** every Phase 0 item in the spec's Section 11 is exercised: Markdown SFC parser (Task 7), fenced blocks including `template`/`script`/`style`/`props`/`frontmatter` (Tasks 7 & 14), Custom Element registration (Task 10), `state`/`derived`/`effect` runtime (Tasks 3–5), directives `<if>`/`<for>`/`<case>` (Tasks 11–13), template syntax (Tasks 8–9), scope binding & slots (implicit body carried by `<for>`'s `item` scope in Task 12 codegen, verified at E2E), batched updates via rAF (Task 6), `.md` → `.js` CLI (Task 15), hello world E2E (Task 16).
- **Slot projection & `parent.` chain:** left as a follow-up work item for Task 17 in a future plan — Phase 0 only needs the `<for>`-scoped `item` binding, which the codegen already emits as a body factory parameter.
- **`<while>` / `<include>` / `<lazy-load>`:** deferred to Phase 2 per the spec.
- **Test override / registry:** deferred to Phase 2 per the spec.

## Deferred to Later Plans

- `<while>`, `<include>`, `<lazy-load>` directives (Phase 2).
- Traits, `<slot>` with named slots and `parent.` scope chain refinements (Phase 1/2).
- Hierarchical Registry with typed tokens (Phase 2).
- SSR / static prerender / hydrate (Phase 2).
- Routing (Phase 2).
- DevTools browser extension (Phase 1).
- `test`, `test:visual`, `test:a11y`, `fixtures`, `mock`, `example` block roles (Phase 1).

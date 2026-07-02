# UIDetox Phase 2a — `<include>` and `<lazy-load>` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `<include src="…"/>` for compile-time template inlining (with cycle detection, `.html` and `.md` sources) and `<lazy-load src="…" trigger="…" placeholder="…" prefetch/>` for runtime dynamic component chunking with the four triggers `visible`, `eager`, `interaction`, `manual`.

**Architecture:** Compiler layer resolves `<include>` at build time — reads the referenced file, parses its template block (raw `.html` or `.md` `html template` fence), splices resulting AST into the caller. Runtime layer implements `<lazy-load>` as a real Custom Element with a placeholder slot; a small `triggers.ts` module owns the four fetch strategies and cache-deduped dynamic imports.

**Tech Stack:** TypeScript 5.x, existing parse5, existing SFC parser (`parseSfc`), happy-dom for tests. No new dependencies.

## Global Constraints

- **Include:** `src` must be a build-time literal string; cyclic chains fail the build; max include depth 10.
- **Include source formats:** `.html` (raw fragment) and `.md` (only the `html template` block is inlined).
- **Include scope:** included nodes see the caller's scope; `<include>` does not introduce a new scope.
- **Lazy-load:** a real Custom Element tag `<lazy-load>` in DOM; `src` is a build-time literal.
- **Lazy-load triggers:** `visible` (IntersectionObserver on the placeholder), `eager` (fetch on connect), `interaction` (first `pointerenter` / `focusin` on the placeholder), `manual` (`element.load()`).
- **Placeholder:** `placeholder="skeleton"` renders `<Skeleton/>` if registered globally, otherwise `<div class="uidetox-skeleton"/>`; any other value is treated as a Custom Element tag name.
- **Prefetch:** `requestIdleCallback` schedule; dedupes with in-flight loader cache.
- **On-load / on-error:** attribute expressions `${fn}` fire when the component mounts / when fetch fails.
- **Test discipline:** TDD. One deliverable per task, one commit per task.

---

## File Structure

```
src/
  compiler/
    template/
      include.ts             # NEW — resolve <include>, splice AST
      fs.ts                  # NEW — build-time file reader with cycle detection
    template/transform.ts    # MODIFIED — call include resolver
  runtime/
    lazyLoad/
      loader.ts              # NEW — dynamic import cache (dedupe by URL)
      triggers.ts            # NEW — visible / eager / interaction / manual + prefetch
      element.ts             # NEW — <lazy-load> Custom Element
    index.ts                 # MODIFIED — export registerLazyLoad
tests/
  compiler/template/include.test.ts
  runtime/lazyLoad/loader.test.ts
  runtime/lazyLoad/triggers.test.ts
  runtime/lazyLoad/element.test.ts
  e2e/include-basic.test.ts
  e2e/lazyload-basic.test.ts
examples/
  include/pages/Home.md
  include/partials/header.html
  lazyload/App.md
  lazyload/Heavy.md
```

---

## Task 1: `fs.ts` — build-time file reader with cycle detection

**Files:**
- Create: `src/compiler/template/fs.ts`
- Test: `tests/compiler/template/fs.test.ts`

**Interfaces:**
- Produces:
  - `class IncludeCycleError extends Error { readonly chain: string[]; }`
  - `class IncludeResolver { readonly maxDepth: number; enter(absPath: string): void; leave(absPath: string): void; read(absPath: string): string; }`
  - Simple in-memory content cache keyed by absolute path.

- [ ] **Step 1: Write the failing test**

Write `tests/compiler/template/fs.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IncludeCycleError, IncludeResolver } from '../../../src/compiler/template/fs.js';

describe('IncludeResolver', () => {
  it('reads and caches file contents', () => {
    const dir = mkdtempSync(join(tmpdir(), 'inc-'));
    const p = join(dir, 'a.html');
    writeFileSync(p, '<div>a</div>');
    const r = new IncludeResolver();
    expect(r.read(p)).toBe('<div>a</div>');
    // rewrite the file — cached content should still be returned
    writeFileSync(p, '<div>b</div>');
    expect(r.read(p)).toBe('<div>a</div>');
  });

  it('throws on cycle', () => {
    const r = new IncludeResolver();
    r.enter('/a');
    r.enter('/b');
    expect(() => r.enter('/a')).toThrow(IncludeCycleError);
  });

  it('leaves lets the same path enter again later', () => {
    const r = new IncludeResolver();
    r.enter('/a');
    r.leave('/a');
    expect(() => r.enter('/a')).not.toThrow();
  });

  it('caps depth at max', () => {
    const r = new IncludeResolver({ maxDepth: 2 });
    r.enter('/a');
    r.enter('/b');
    expect(() => r.enter('/c')).toThrow(/max include depth/i);
  });
});
```

- [ ] **Step 2: Verify test fails**

Run: `pnpm test tests/compiler/template/fs.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Write `src/compiler/template/fs.ts`:
```ts
import { readFileSync } from 'node:fs';

export class IncludeCycleError extends Error {
  constructor(public readonly chain: string[]) {
    super(`Include cycle detected: ${chain.join(' → ')}`);
    this.name = 'IncludeCycleError';
  }
}

export class IncludeResolver {
  readonly maxDepth: number;
  private stack: string[] = [];
  private cache = new Map<string, string>();

  constructor(opts: { maxDepth?: number } = {}) {
    this.maxDepth = opts.maxDepth ?? 10;
  }

  enter(absPath: string): void {
    if (this.stack.includes(absPath)) {
      throw new IncludeCycleError([...this.stack, absPath]);
    }
    if (this.stack.length >= this.maxDepth) {
      throw new Error(`Max include depth (${this.maxDepth}) exceeded`);
    }
    this.stack.push(absPath);
  }

  leave(absPath: string): void {
    const top = this.stack.pop();
    if (top !== absPath) {
      throw new Error(`leave() mismatch: ${absPath} vs ${top}`);
    }
  }

  read(absPath: string): string {
    let content = this.cache.get(absPath);
    if (content === undefined) {
      content = readFileSync(absPath, 'utf8');
      this.cache.set(absPath, content);
    }
    return content;
  }
}
```

- [ ] **Step 4: Verify test passes**

Run: `pnpm test tests/compiler/template/fs.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/compiler/template/fs.ts tests/compiler/template/fs.test.ts
git commit -m "feat(include): IncludeResolver with cache + cycle detection"
```

---

## Task 2: `include.ts` — resolve `<include>` in template AST

**Files:**
- Create: `src/compiler/template/include.ts`
- Test: `tests/compiler/template/include.test.ts`

**Interfaces:**
- Consumes: `fs.ts`, `parseTemplate`, `parseSfc`.
- Produces:
  - `resolveIncludes(ast: TplNode[], baseDir: string, resolver?: IncludeResolver): TplNode[]`
  - Rules:
    - `<include src="./file.html"/>` — read the file, `parseTemplate` on its content, splice.
    - `<include src="./file.md"/>` — read the file, `parseSfc`, extract `html template` block, `parseTemplate` on its content, splice.
    - Non-static `src` (kind !== 'static') → build error.
    - Missing file → build error with clear message.
    - Recursion — call `resolveIncludes` on the newly parsed nodes with `baseDir` set to the included file's directory.

- [ ] **Step 1: Write the failing test**

Write `tests/compiler/template/include.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseTemplate } from '../../../src/compiler/template/parse.js';
import { resolveIncludes } from '../../../src/compiler/template/include.js';

describe('resolveIncludes()', () => {
  it('inlines an .html partial', () => {
    const dir = mkdtempSync(join(tmpdir(), 'inc-'));
    writeFileSync(join(dir, 'header.html'), '<header><h1>Site</h1></header>');
    const ast = parseTemplate('<main><include src="./header.html"/><p>body</p></main>');
    const resolved = resolveIncludes(ast, dir);
    const main = resolved[0] as { children: Array<{ tag?: string; children?: Array<{ tag?: string }> }> };
    expect(main.children[0].tag).toBe('header');
    expect(main.children[1].tag).toBe('p');
  });

  it('inlines an .md template block', () => {
    const dir = mkdtempSync(join(tmpdir(), 'inc-'));
    const sfc = `---
name: Nav
tag: app-nav
---

\`\`\`html template
<nav><a href="/">Home</a></nav>
\`\`\`
`;
    writeFileSync(join(dir, 'nav.md'), sfc);
    const ast = parseTemplate('<div><include src="./nav.md"/></div>');
    const resolved = resolveIncludes(ast, dir);
    const div = resolved[0] as { children: Array<{ tag?: string }> };
    expect(div.children[0].tag).toBe('nav');
  });

  it('throws on cycle', () => {
    const dir = mkdtempSync(join(tmpdir(), 'inc-'));
    writeFileSync(join(dir, 'a.html'), '<include src="./b.html"/>');
    writeFileSync(join(dir, 'b.html'), '<include src="./a.html"/>');
    const ast = parseTemplate('<include src="./a.html"/>');
    expect(() => resolveIncludes(ast, dir)).toThrow(/cycle/i);
  });

  it('errors on missing file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'inc-'));
    const ast = parseTemplate('<include src="./nope.html"/>');
    expect(() => resolveIncludes(ast, dir)).toThrow();
  });
});
```

- [ ] **Step 2: Verify test fails**

Run: `pnpm test tests/compiler/template/include.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Write `src/compiler/template/include.ts`:
```ts
import { dirname, resolve as resolvePath } from 'node:path';
import { parseSfc } from '../sfc.js';
import { parseTemplate } from './parse.js';
import { IncludeResolver } from './fs.js';
import type { TplAttr, TplElement, TplNode } from './ast.js';

function attrOf(node: TplElement, name: string): TplAttr | undefined {
  return node.attrs.find((a) => a.name === name);
}

function resolveOne(node: TplElement, baseDir: string, resolver: IncludeResolver): TplNode[] {
  const src = attrOf(node, 'src');
  if (!src) throw new Error('<include> requires src=');
  if (src.kind !== 'static') throw new Error('<include src> must be a static string literal');
  const absPath = resolvePath(baseDir, src.value);
  resolver.enter(absPath);
  try {
    const raw = resolver.read(absPath);
    const nodes = absPath.endsWith('.md') ? sfcTemplateNodes(raw) : parseTemplate(raw);
    return resolveIncludes(nodes, dirname(absPath), resolver);
  } finally {
    resolver.leave(absPath);
  }
}

function sfcTemplateNodes(raw: string): TplNode[] {
  const sfc = parseSfc(raw);
  const template = sfc.blocks.find((b) => b.role === 'template');
  if (!template) throw new Error('included .md has no `html template` block');
  return parseTemplate(template.content);
}

export function resolveIncludes(
  ast: TplNode[],
  baseDir: string,
  resolver: IncludeResolver = new IncludeResolver(),
): TplNode[] {
  const out: TplNode[] = [];
  for (const node of ast) {
    if (node.type === 'element' && node.tag === 'include') {
      out.push(...resolveOne(node, baseDir, resolver));
      continue;
    }
    if (node.type === 'element') {
      out.push({ ...node, children: resolveIncludes(node.children, baseDir, resolver) });
      continue;
    }
    out.push(node);
  }
  return out;
}
```

- [ ] **Step 4: Verify passes**

Run: `pnpm test tests/compiler/template/include.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/compiler/template/include.ts tests/compiler/template/include.test.ts
git commit -m "feat(include): resolveIncludes() splices .html and .md partials"
```

---

## Task 3: `<lazy-load>` loader cache

**Files:**
- Create: `src/runtime/lazyLoad/loader.ts`
- Test: `tests/runtime/lazyLoad/loader.test.ts`

**Interfaces:**
- Produces:
  - `interface LoaderCache { load(url: string): Promise<unknown>; clear(): void; }`
  - `createLoaderCache(importer?: (url: string) => Promise<unknown>): LoaderCache` — deduplicates by URL; subsequent calls with the same URL return the same promise.

- [ ] **Step 1: Write failing test**

Write `tests/runtime/lazyLoad/loader.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { createLoaderCache } from '../../../src/runtime/lazyLoad/loader.js';

describe('createLoaderCache()', () => {
  it('dedupes concurrent loads', async () => {
    const importer = vi.fn(async (url: string) => ({ url }));
    const cache = createLoaderCache(importer);
    const [a, b] = await Promise.all([cache.load('/x'), cache.load('/x')]);
    expect(a).toBe(b);
    expect(importer).toHaveBeenCalledTimes(1);
  });

  it('retries after clear()', async () => {
    const importer = vi.fn(async () => ({}));
    const cache = createLoaderCache(importer);
    await cache.load('/y');
    cache.clear();
    await cache.load('/y');
    expect(importer).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `pnpm test tests/runtime/lazyLoad/loader.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Write `src/runtime/lazyLoad/loader.ts`:
```ts
export interface LoaderCache {
  load(url: string): Promise<unknown>;
  clear(): void;
}

export function createLoaderCache(
  importer: (url: string) => Promise<unknown> = (u) => import(/* @vite-ignore */ u),
): LoaderCache {
  const inflight = new Map<string, Promise<unknown>>();
  return {
    load(url) {
      let p = inflight.get(url);
      if (!p) {
        p = importer(url);
        inflight.set(url, p);
      }
      return p;
    },
    clear() {
      inflight.clear();
    },
  };
}
```

- [ ] **Step 4: Verify passes**

Run: `pnpm test tests/runtime/lazyLoad/loader.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/runtime/lazyLoad/loader.ts tests/runtime/lazyLoad/loader.test.ts
git commit -m "feat(lazy-load): loader cache with URL dedupe"
```

---

## Task 4: `<lazy-load>` triggers

**Files:**
- Create: `src/runtime/lazyLoad/triggers.ts`
- Test: `tests/runtime/lazyLoad/triggers.test.ts`

**Interfaces:**
- Produces:
  - `type TriggerName = 'visible' | 'eager' | 'interaction' | 'manual';`
  - `interface TriggerHandle { start(): void; stop(): void; }`
  - `attachTrigger(name: TriggerName, target: Element, fire: () => void): TriggerHandle`
    - `visible` → IntersectionObserver (falls back to immediate fire in test env when the observer is missing).
    - `eager` → `setTimeout(fire, 0)`.
    - `interaction` → single-shot listeners on `pointerenter` and `focusin`.
    - `manual` → no-op; fires only when consumer calls the returned handle's `start()` explicitly.
  - `schedulePrefetch(fn: () => void): void` — uses `requestIdleCallback` when present, else `setTimeout(fn, 0)`.

- [ ] **Step 1: Write failing test**

Write `tests/runtime/lazyLoad/triggers.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { attachTrigger, schedulePrefetch } from '../../../src/runtime/lazyLoad/triggers.js';

describe('attachTrigger()', () => {
  it('eager fires on start', async () => {
    const el = document.createElement('div');
    let fired = 0;
    const handle = attachTrigger('eager', el, () => { fired++; });
    handle.start();
    await new Promise((r) => setTimeout(r, 5));
    expect(fired).toBe(1);
    handle.stop();
  });

  it('interaction fires on pointerenter', () => {
    const el = document.createElement('div');
    let fired = 0;
    const handle = attachTrigger('interaction', el, () => { fired++; });
    handle.start();
    el.dispatchEvent(new Event('pointerenter'));
    el.dispatchEvent(new Event('pointerenter'));
    expect(fired).toBe(1);
    handle.stop();
  });

  it('manual only fires when start explicitly triggered', () => {
    const el = document.createElement('div');
    let fired = 0;
    const handle = attachTrigger('manual', el, () => { fired++; });
    expect(fired).toBe(0);
    handle.start();
    expect(fired).toBe(1);
    handle.stop();
  });

  it('schedulePrefetch runs task asynchronously', async () => {
    let ran = false;
    schedulePrefetch(() => { ran = true; });
    await new Promise((r) => setTimeout(r, 10));
    expect(ran).toBe(true);
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `pnpm test tests/runtime/lazyLoad/triggers.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Write `src/runtime/lazyLoad/triggers.ts`:
```ts
export type TriggerName = 'visible' | 'eager' | 'interaction' | 'manual';

export interface TriggerHandle {
  start(): void;
  stop(): void;
}

export function attachTrigger(
  name: TriggerName,
  target: Element,
  fire: () => void,
): TriggerHandle {
  let fired = false;
  const once = () => { if (!fired) { fired = true; fire(); } };
  const disposals: Array<() => void> = [];

  return {
    start() {
      if (name === 'eager' || name === 'manual') {
        setTimeout(once, 0);
        return;
      }
      if (name === 'interaction') {
        const handler = () => once();
        target.addEventListener('pointerenter', handler, { once: true });
        target.addEventListener('focusin', handler, { once: true });
        disposals.push(() => target.removeEventListener('pointerenter', handler));
        disposals.push(() => target.removeEventListener('focusin', handler));
        return;
      }
      // visible
      if (typeof IntersectionObserver === 'function') {
        const io = new IntersectionObserver((entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) { once(); io.disconnect(); break; }
          }
        });
        io.observe(target);
        disposals.push(() => io.disconnect());
      } else {
        setTimeout(once, 0);
      }
    },
    stop() {
      for (const d of disposals) d();
    },
  };
}

export function schedulePrefetch(fn: () => void): void {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
  if (typeof ric === 'function') { ric(fn); return; }
  setTimeout(fn, 0);
}
```

- [ ] **Step 4: Verify passes**

Run: `pnpm test tests/runtime/lazyLoad/triggers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/runtime/lazyLoad/triggers.ts tests/runtime/lazyLoad/triggers.test.ts
git commit -m "feat(lazy-load): 4 triggers + prefetch scheduler"
```

---

## Task 5: `<lazy-load>` Custom Element

**Files:**
- Create: `src/runtime/lazyLoad/element.ts`
- Modify: `src/runtime/index.ts`
- Test: `tests/runtime/lazyLoad/element.test.ts`

**Interfaces:**
- Consumes: `createLoaderCache`, `attachTrigger`, `schedulePrefetch`.
- Produces:
  - `registerLazyLoad(opts?: { importer?: (url: string) => Promise<unknown> }): void` — idempotent; defines `<lazy-load>` Custom Element.
  - Attributes read on connect: `src`, `trigger` (default `visible`), `placeholder`, `prefetch` (flag). `on-load` / `on-error` fired via `dispatchEvent` custom events (`load`, `error`).
  - After the chunk is loaded, the runtime instantiates the component:
    - If the module has a `__tag: string` export, an element with that tag is created and appended.
    - Otherwise the default export is treated as a factory `(ctx: {}) => Node` and its returned Node is appended.
  - Placeholder rendering:
    - `placeholder="skeleton"` → `<uidetox-skeleton/>` element or, if that CE is not registered, `<div class="uidetox-skeleton"></div>`.
    - Custom Element tag name → `document.createElement(tag)`.

- [ ] **Step 1: Write failing test**

Write `tests/runtime/lazyLoad/element.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { registerLazyLoad } from '../../../src/runtime/lazyLoad/element.js';

describe('<lazy-load>', () => {
  it('renders placeholder, then swaps to loaded factory output', async () => {
    const importer = async () => ({ default: () => {
      const el = document.createElement('span');
      el.textContent = 'loaded';
      return el;
    } });
    registerLazyLoad({ importer });

    document.body.innerHTML = '<lazy-load src="/heavy.js" trigger="eager" placeholder="skeleton"></lazy-load>';
    const host = document.body.querySelector('lazy-load')!;
    // give trigger + microtask a beat
    await new Promise((r) => setTimeout(r, 20));
    expect(host.querySelector('span')?.textContent).toBe('loaded');
  });

  it('fires load event on success', async () => {
    const importer = async () => ({ default: () => document.createTextNode('ok') });
    registerLazyLoad({ importer });
    document.body.innerHTML = '<lazy-load src="/ok.js" trigger="eager"></lazy-load>';
    const host = document.body.querySelector('lazy-load')!;
    let fired = false;
    host.addEventListener('load', () => { fired = true; });
    await new Promise((r) => setTimeout(r, 20));
    expect(fired).toBe(true);
  });

  it('fires error event on failure', async () => {
    const importer = async () => { throw new Error('boom'); };
    registerLazyLoad({ importer });
    document.body.innerHTML = '<lazy-load src="/bad.js" trigger="eager"></lazy-load>';
    const host = document.body.querySelector('lazy-load')!;
    let msg = '';
    host.addEventListener('error', (e) => { msg = (e as CustomEvent).detail?.message ?? ''; });
    await new Promise((r) => setTimeout(r, 20));
    expect(msg).toContain('boom');
  });
});
```

- [ ] **Step 2: Verify fail**

Run: `pnpm test tests/runtime/lazyLoad/element.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Write `src/runtime/lazyLoad/element.ts`:
```ts
import { createLoaderCache } from './loader.js';
import { attachTrigger, schedulePrefetch, type TriggerName } from './triggers.js';

let currentImporter: ((url: string) => Promise<unknown>) | undefined;

function makePlaceholder(value: string | null): Node {
  if (!value) return document.createDocumentFragment();
  if (value === 'skeleton') {
    if (typeof customElements !== 'undefined' && customElements.get('uidetox-skeleton')) {
      return document.createElement('uidetox-skeleton');
    }
    const div = document.createElement('div');
    div.className = 'uidetox-skeleton';
    return div;
  }
  return document.createElement(value);
}

interface LoadedModule {
  __tag?: string;
  default?: unknown;
}

function instantiate(mod: LoadedModule): Node {
  if (mod.__tag) return document.createElement(mod.__tag);
  const factory = mod.default;
  if (typeof factory === 'function') {
    const result = (factory as (ctx: unknown) => Node)({});
    return result;
  }
  const fallback = document.createElement('div');
  fallback.textContent = '(empty lazy chunk)';
  return fallback;
}

export function registerLazyLoad(opts: { importer?: (url: string) => Promise<unknown> } = {}): void {
  if (opts.importer) currentImporter = opts.importer;
  const cache = createLoaderCache((url) => (currentImporter ?? ((u) => import(/* @vite-ignore */ u)))(url));

  if (customElements.get('lazy-load')) return;

  class LazyLoad extends HTMLElement {
    private handle: ReturnType<typeof attachTrigger> | null = null;
    private mounted = false;

    connectedCallback(): void {
      if (this.mounted) return;
      this.mounted = true;

      const src = this.getAttribute('src');
      if (!src) return;
      const trigger = (this.getAttribute('trigger') ?? 'visible') as TriggerName;
      const placeholderAttr = this.getAttribute('placeholder');
      const prefetch = this.hasAttribute('prefetch');

      const placeholderNode = makePlaceholder(placeholderAttr);
      if (placeholderNode) this.appendChild(placeholderNode);

      if (prefetch) schedulePrefetch(() => { void cache.load(src); });

      const fire = () => { void this.doLoad(cache, src); };
      this.handle = attachTrigger(trigger, this, fire);
      this.handle.start();
    }

    disconnectedCallback(): void {
      this.handle?.stop();
      this.handle = null;
    }

    async doLoad(cache: ReturnType<typeof createLoaderCache>, src: string): Promise<void> {
      try {
        const mod = (await cache.load(src)) as LoadedModule;
        while (this.firstChild) this.removeChild(this.firstChild);
        this.appendChild(instantiate(mod));
        this.dispatchEvent(new CustomEvent('load'));
      } catch (err) {
        this.dispatchEvent(new CustomEvent('error', { detail: err }));
      }
    }

    load(): void {
      const src = this.getAttribute('src');
      if (!src) return;
      const c = createLoaderCache((url) => (currentImporter ?? ((u) => import(/* @vite-ignore */ u)))(url));
      void this.doLoad(c, src);
    }
  }

  customElements.define('lazy-load', LazyLoad);
}
```

Edit `src/runtime/index.ts` — append:
```ts
export { registerLazyLoad } from './lazyLoad/element.js';
export { createLoaderCache } from './lazyLoad/loader.js';
export { attachTrigger, schedulePrefetch } from './lazyLoad/triggers.js';
export type { TriggerName, TriggerHandle } from './lazyLoad/triggers.js';
```

- [ ] **Step 4: Verify passes**

Run: `pnpm test tests/runtime/lazyLoad/element.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/runtime/lazyLoad/element.ts src/runtime/index.ts tests/runtime/lazyLoad/element.test.ts
git commit -m "feat(lazy-load): <lazy-load> Custom Element with 4 triggers"
```

---

## Task 6: E2E `<include>` — end-to-end templates

**Files:**
- Create: `examples/include/pages/Home.md`, `examples/include/partials/header.html`
- Test: `tests/e2e/include-basic.test.ts`

- [ ] **Step 1: Create example partial + page**

Write `examples/include/partials/header.html`:
```html
<header><h1>Included Site</h1></header>
```

Write `examples/include/pages/Home.md`:
````md
---
name: Home
tag: page-home
---

```html template
<main>
  <include src="../partials/header.html"/>
  <p>Home body</p>
</main>
```
````

- [ ] **Step 2: Write failing E2E test**

Write `tests/e2e/include-basic.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseSfc } from '../../src/compiler/sfc.js';
import { parseTemplate } from '../../src/compiler/template/parse.js';
import { resolveIncludes } from '../../src/compiler/template/include.js';

describe('include-basic e2e', () => {
  it('resolves include partial into the AST', () => {
    const filePath = join(process.cwd(), 'examples/include/pages/Home.md');
    const source = readFileSync(filePath, 'utf8');
    const sfc = parseSfc(source);
    const tpl = sfc.blocks.find((b) => b.role === 'template')!;
    const ast = parseTemplate(tpl.content);
    const resolved = resolveIncludes(ast, dirname(filePath));

    // main > header > h1 with text
    const main = resolved[0] as { children: Array<{ tag?: string; children?: Array<{ tag?: string; children?: Array<{ value?: string }> }> }> };
    const header = main.children.find((c) => c.tag === 'header')!;
    const h1 = header.children!.find((c) => c.tag === 'h1')!;
    expect(h1.children?.[0]?.value).toContain('Included Site');
  });
});
```

- [ ] **Step 3: Verify passes**

Run: `pnpm test tests/e2e/include-basic.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add examples/include tests/e2e/include-basic.test.ts
git commit -m "test(e2e): include-basic resolves .html partial via AST splice"
```

---

## Task 7: E2E `<lazy-load>` — component swap on trigger

**Files:**
- Test: `tests/e2e/lazyload-basic.test.ts`

- [ ] **Step 1: Write failing E2E test**

Write `tests/e2e/lazyload-basic.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { registerLazyLoad } from '../../src/runtime/index.js';

describe('lazyload-basic e2e', () => {
  it('renders placeholder, then loaded content on interaction', async () => {
    const importer = async () => ({ default: () => {
      const el = document.createElement('section');
      el.dataset.role = 'heavy';
      el.textContent = 'Heavy content';
      return el;
    } });
    registerLazyLoad({ importer });

    document.body.innerHTML =
      '<lazy-load src="/Heavy.js" trigger="interaction" placeholder="my-skel"></lazy-load>';
    const host = document.body.querySelector('lazy-load') as HTMLElement;

    // before trigger: only placeholder
    expect(host.querySelector('my-skel')).not.toBeNull();
    expect(host.querySelector('section[data-role="heavy"]')).toBeNull();

    host.dispatchEvent(new Event('pointerenter'));
    await new Promise((r) => setTimeout(r, 20));

    expect(host.querySelector('section[data-role="heavy"]')).not.toBeNull();
    expect(host.querySelector('my-skel')).toBeNull();
  });
});
```

- [ ] **Step 2: Run and iterate**

Run: `pnpm test tests/e2e/lazyload-basic.test.ts`
Expected: PASS. If FAIL — iterate on tasks 3–5 until green.

- [ ] **Step 3: Run whole suite**

Run: `pnpm test`
Expected: PASS everywhere.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/lazyload-basic.test.ts
git commit -m "test(e2e): lazyload-basic loads chunk on interaction trigger"
```

---

## Self-Review Notes

- **Spec coverage:**
  - §3 include grammar + rules → Tasks 1, 2.
  - §3.3 .html and .md sources → Task 2 tests.
  - §3.5 errors (missing, cycle) → Task 2 tests.
  - §4 lazy-load grammar → Task 5.
  - §4.2 4 triggers → Task 4.
  - §4.3 real Custom Element → Task 5.
  - §4.4 placeholder resolution → Task 5.
  - §4.5 prefetch → Task 5 (uses `schedulePrefetch` from Task 4).
  - §4.6 error surface (`on-error`, event, `load()` retry) → Task 5.
  - §4.7 component instantiation (`__tag` or factory) → Task 5.
- **Placeholder scan:** every step has concrete code. No TODOs.
- **Type consistency:** `TriggerName`, `TriggerHandle`, `LoaderCache`, `IncludeResolver` used consistently.
- **Deferred (spec §8):** query-string cache-busting, priority hints, streaming — flagged in spec, not tasked.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-02-uidetox-phase2a-include-lazyload.md`.

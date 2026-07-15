# UIDetox — Framework Design Spec

**Status:** Draft (v0.1)
**Date:** 2026-07-01
**Owner:** roman4e@gmail.com

## 1. Purpose

UIDetox is a TypeScript-first UI framework that keeps the component tree **visible in the HTML document, in View Source, and in DevTools** — not hidden behind a `<div id="root">`.

It borrows ideas from React (functional composition, JSX-adjacent readability), Angular (structured application layering), Lit (Web Components + tagged-template style), Vue (single-file components, `reactive()`), Svelte (compile-time efficiency), and Solid (fine-grained signals) — but is not a copy of any of them.

## 2. Core Design Bets

1. **Visible structure.** The application's component tree is authored as a nested HTML/XML-like structure and stays visible in the produced document (both cached HTML and live DOM).
2. **Web Components as the runtime substrate.** Every visible component compiles to a native Custom Element. `<AppRoot>`, `<Card>`, `<Menu>` show up in DevTools by their names, not as `div` soup.
3. **Virtual directives, invisible in prod.** Control-flow tags (`<if>`, `<for>`, `<while>`, `<case>`, `<include>`) exist only in the author's template. They are AST-transformed at build time and produce no wrapper node in the runtime DOM.
4. **Markdown Single-File Components.** Each component is one `.md` file with fenced blocks — each block interpreted by its role.
5. **Zero-magic reactivity via `state()` Proxy.** No compile-time transform for state. No `useEffect`/`useCallback`/`useMemo`. No dependency arrays.
6. **Isomorphic runtime.** The same code renders on the server (as HTML string) and on the client (as DOM). Hydration attaches reactivity; it does not re-render.
7. **Test-and-doc adjacency (Phase 1).** Components can carry their tests, fixtures, examples and translations in the same file — one component = one document.

## 3. File Format — Markdown SFC

### 3.1 Structure

A component lives in a `.md` file. The file has:

- **YAML frontmatter** — metadata: name, tag, extends, base path (for `routes.md`), render mode, etc.
- **Markdown body** — human documentation (rendered on the component's docs page).
- **Fenced code blocks** with **language + role** header, where the role determines how the block is processed.

### 3.2 Phase-0 Block Set

| Fence header | Role | Required? |
|---|---|---|
| `yaml frontmatter` (top of file) | Metadata | Yes |
| `html template` | Component's DOM template | Yes |
| `ts script` | State, handlers, lifecycle | Yes (may be empty) |
| `ts props` | Prop type declarations | Optional (can inline in `script`) |
| `css style` | Scoped styles | Optional |

Markdown body between blocks is treated as documentation.

### 3.3 Phase-1 Block Set (added later)

`ts test`, `json fixtures`, `ts mock`, `html example`, `ts example:setup`, `ts test:visual`, `ts test:a11y`.

### 3.4 Example — `todo.md`

````md
---
name: Todo
tag: app-todo
---

# Todo

Displays a single todo item with checkbox and text.

```ts props
export type Props = {
  id: string;
  text: string;
  done: boolean;
};
```

```html template
<li class="todo" data-done=${props.done}>
  <input type="checkbox" checked=${props.done} @change=${toggle}/>
  <span>${props.text}</span>
</li>
```

```ts script
const emit = defineEmits<{ toggle: { id: string } }>();
function toggle() {
  emit('toggle', { id: props.id });
}
```

```css style
.todo { display: flex; gap: 0.5rem; }
.todo[data-done="true"] span { text-decoration: line-through; }
```
````

## 4. Reactivity — `state()` Proxy Model

### 4.1 Primitives

- `state(obj)` — returns a reactive Proxy over `obj`. Property reads track the current observer; property writes notify subscribers. Nested objects and arrays are proxied on access.
- `derived(fn)` — a computed value; automatically re-evaluates when its dependencies change. Access via `.value`.
- `effect(fn)` — a side-effect callback; re-runs when its dependencies change. May return a cleanup function.

### 4.2 Author-facing usage

```ts script
const app = state({ count: 0, todos: [] as Todo[] });

app.count++;               // triggers subscribers via Proxy set
app.todos.push(item);      // deep proxy — array mutations tracked

const doubled = derived(() => app.count * 2);
const isEmpty = derived(() => app.todos.length === 0);

effect(() => log(app.count, doubled.value, isEmpty.value));

effect(() => {
  const id = setInterval(() => app.count++, 1000);
  return () => clearInterval(id);
});
```

### 4.3 Key rules

- **No dependency arrays.** Reading `app.count` inside `derived`/`effect` implicitly subscribes.
- **No `useCallback` / `useMemo` equivalents.** The component function is called **once per instance**; there is no whole-component re-render. Fine-grained DOM updates only.
- **No hook-order rules.** `state()`, `derived()`, `effect()` may be called anywhere.
- **Batching.** Multiple writes in the same microtask are flushed on `requestAnimationFrame`, so animations do not flicker.

### 4.4 Implementation sketch

```ts
let currentObserver: (() => void) | null = null;

export function state<T extends object>(obj: T): T {
  const subs = new Map<keyof T, Set<() => void>>();
  return new Proxy(obj, {
    get(target, key) {
      if (currentObserver) {
        if (!subs.has(key)) subs.set(key, new Set());
        subs.get(key)!.add(currentObserver);
      }
      const v = Reflect.get(target, key);
      return typeof v === 'object' && v !== null ? state(v) : v; // deep proxy
    },
    set(target, key, value) {
      const ok = Reflect.set(target, key, value);
      subs.get(key)?.forEach(scheduleFlush);
      return ok;
    },
  });
}

export function effect(fn: () => void | (() => void)) {
  let cleanup: void | (() => void);
  const run = () => {
    cleanup?.();
    const prev = currentObserver;
    currentObserver = run;
    try { cleanup = fn(); } finally { currentObserver = prev; }
  };
  run();
}
```

## 5. Template Language

### 5.1 Tags — two categories

| Category | Examples | DOM presence | DevTools | Registration |
|---|---|---|---|---|
| **Visible components** | `<AppRoot>`, `<Card>`, `<Menu>` | Native Custom Element | Always visible | Global CE registry |
| **Virtual directives** | `<if>`, `<for>`, `<while>`, `<case>`, `<include>` | None in prod (text-node anchor); `<u-*>` in debug build | Prod: hidden; Debug: `<u-if>` | Compile-time AST transform |

### 5.2 Naming conventions

- Author writes PascalCase for components: `<AppRoot>`, `<UserCard>`.
- Compiler renames to kebab-case for the Custom Element registry: `<app-root>`, `<user-card>`.
- Native HTML tags: unchanged.
- Virtual directives: lowercase reserved names — `if`, `for`, `while`, `case`, `else`, `when`, `include`, `lazy-load`.

### 5.3 Attribute / binding syntax

| Form | Meaning |
|---|---|
| `attr="literal"` | Static string attribute |
| `attr=${expr}` | Reactive binding — expression re-runs when its dependencies change |
| `@event=${handler}` | Event listener (Lit-style) |
| `.prop=${value}` | DOM property (bypasses attribute string conversion) |
| `?bool=${cond}` | Boolean attribute — present iff truthy |
| `<span>${expr}</span>` | Text interpolation in child position |

### 5.4 Control-flow directives

```html
<if when=${state.open}>
  <p>Open</p>
  <else><p>Closed</p></else>
</if>

<for each=${state.todos} item="t" key="t.id">
  <Todo data=${t}/>
</for>

<case on=${state.status}>
  <when is="loading"><Spinner/></when>
  <when is="error"><ErrorBox msg=${state.err}/></when>
  <else><Content/></else>
</case>

<while truthy=${state.queue.length}>
  <Task next=${state.queue.shift()}/>
</while>

<include src="./partials/footer.html"/>
<lazy-load src="./Heavy.md" trigger="visible" placeholder="skeleton"/>
```

`<insert>`, `<update>`, `<delete>`, `<select>` are reserved for future animation-hook semantics (undecided in v0.1).

### 5.5 Scope binding in directives

- Every iterating directive can declare a scope variable via `item="t"`. If omitted, the default name is `item`.
- Auto-populated scope variables inside `<for>`: `index`, `first`, `last`, `size`.
- Nested loops access an outer scope via `parent.<name>`; unlimited depth (`parent.parent.item`).

```html
<for each=${state.users} item="u">
  <for each=${u.tasks} item="t">
    <Task data=${t} user=${u} outer-index=${parent.index}/>
  </for>
</for>
```

### 5.6 Implicit body & slot projection

- All children of a component are its **implicit default slot**.
- A component that iterates via `<for>` uses `<slot/>` inside the loop body; the caller's children become the per-iteration content.
- Multiple named slots use `<template slot="name">` on the caller side and `<slot name="name"/>` on the component side.

Example — `display-list.md`:

````md
```html template
<ul role="list">
  <for each=${props.from} item="item" key="item.id">
    <li><slot/></li>
  </for>
</ul>
```
````

Usage:

```html
<display-list from=${state.todos} item="t">
  <Todo data=${t}/>
</display-list>
```

### 5.7 Anchor for conditional rendering

`<if>`, `<case>` and `<lazy-load>` insert an empty text node as their DOM position anchor in production builds. Debug builds keep the `<u-if>` / `<u-case>` wrapper for inspection.

## 6. Two Kinds of Extension

### 6.1 Custom Element extends — for visible components with runtime logic

Author writes a class that extends `HTMLElement`, registers it under a tag. The framework provides a `defineComponent()` helper that wires the class into UIDetox's lifecycle and reactivity plumbing.

### 6.2 AST-transform directives — for compile-time-only control flow

Author declares a directive whose `transform(node, ctx)` function is called by the compiler and returns a replacement AST node the compiler already knows how to codegen (e.g. `ReactiveBlock`, `KeyedList`, `TextInterpolation`). No runtime tag is emitted.

### 6.3 Traits — for augmenting native HTML elements

Traits attach behavior (event listeners, filters, mandatory attributes) to native elements. They cannot replace the element's DOM structure or remove default behavior.

```html
<input use="trim, numeric-only" model=${state.age}/>
```

Traits may be applied at three scopes:

- Per-tag via `use="..."` attribute.
- Per-scope via `<scope require-on="input" trait="trim">...</scope>`.
- Globally via `uidetox.config.ts` mandatoryTraits map.

Traits on native HTML elements are limited (add listeners, add attributes, filter values). Custom Element extends is required for anything that reshapes the element.

## 7. Registry — Hierarchical DI

### 7.1 Model

The Registry is not a Provider tree in the HTML. It is a **hierarchical, reactive registry** accessible programmatically from any `ts script` block. Values are resolved lazily and reactively — when the registry value changes, all subscribers re-run.

### 7.2 Tokens

```ts
// tokens.ts
export const themeToken = registryKey<Theme>('theme');
export const userToken  = registryKey<User>('user');
export const apiToken   = registryKey<ApiClient>('api');
```

### 7.3 Provide (bootstrap)

```ts
import { registry } from 'ui-detox';

registry.provide(themeToken, () => currentTheme);
registry.provide(userToken,  () => authService.user);
registry.provide(apiToken,   apiClient);
```

### 7.4 Consume

```ts script
const theme = registry.get(themeToken);   // reactive: State<Theme>
effect(() => document.body.dataset.theme = theme.value);
```

### 7.5 Scoping

- **Global scope** — application-wide. Registered at bootstrap.
- **Module scope** — registered per plugin/module; visible only to its own components (and children if mounted).
- **Local override** — `registry.override(token, value)` in a `ts mock` or test block replaces the value for tests.

Resolution order: local → module → global. First match wins.

## 8. Routing

### 8.1 Model

Each module or plugin owns a `routes.md` file. Routes are declared explicitly using `<Router>` and `<Route>` tags. The compiler aggregates all `routes.md` files at build time into a single generated route table cached under `.uidetox/cache/routes.gen.ts`.

### 8.2 `routes.md` example

````md
---
name: GalleryRoutes
basePath: /gallery
priority: 100
---

```html template
<Router>
  <Route path="/"           handler=${GalleryHome}/>
  <Route path="/image/:id"  handler=${ImageDetail}/>
  <Route path="/manage"     handler=${ManagePage} guard=${requireAdmin}/>
  <Route path="/album/:id"  handler=${AlbumPage}  guards=${[requireAuth, canViewAlbum]}/>
</Router>
```
````

### 8.3 basePath — module mount

- `basePath` prefixes all routes in this file.
- Non-empty basePath means the module mounts at a sub-path; empty means it contributes to the root.
- Multiple modules may declare overlapping base paths. Conflict resolution:
  1. **Longest match wins** by default (`/gallery/manage` beats `/gallery/:rest`).
  2. **Explicit `priority`** on the `routes.md` breaks ties (higher priority wins).

### 8.4 Guards

- `guard=${fn}` — single guard function.
- `guards=${[a, b]}` — array; all must pass. Fails on first false / thrown.

### 8.5 Layouts

`<Route layout=${GalleryLayout}>` attaches a layout component that wraps the route's handler. Layout compositions cascade — a nested route inherits its parent's layout unless it declares its own.

### 8.6 Build-time aggregation

The compiler scans every `routes.md` under `pages/`, `plugins/*/`, and the top-level project. It emits `.uidetox/cache/routes.gen.ts`. Hot-reload regenerates on change.

## 9. Rendering Strategy

### 9.1 Three forms of every component

1. **Author source** — what the developer writes (`.md` file).
2. **Cached / prerendered HTML** — the build's static output. Directives are expanded where inputs are known at build time; custom-element wrappers are preserved for the component tree to remain visible.
3. **Live DOM** — the client-side hydrated result. Reactive bindings are attached to the existing DOM nodes from form 2.

### 9.2 Prerender example

Author source:

```html
<gallery images=${imgs}>
  <image-item/>
</gallery>
```

Cached HTML (when `imgs` is build-known):

```html
<gallery>
  <ul>
    <li><image-item><image src="1.jpg" class="foo"/></image-item></li>
    <li><image-item><image src="2.jpg" class="foo"/></image-item></li>
    <li><image-item><image src="3.jpg" class="foo"/></image-item></li>
  </ul>
</gallery>
```

The `<gallery>` custom-element tag is retained (for styling, lifecycle, hydration handle). `<for>` is expanded. `<image-item>` is retained but its inner `<image>` is materialized.

Live DOM: identical structure, with reactive bindings on `<image src=…>` and event listeners on any interactive descendants.

### 9.3 Frontmatter declares render mode

```yaml
render:
  static: whenPropsKnown  # 'always' | 'whenPropsKnown' | 'never'
  hydrate: eager           # 'eager' | 'lazy'
```

- `static: whenPropsKnown` — the compiler prerenders if all props are statically known; otherwise emits skeleton.
- `hydrate: lazy` — this component's reactive bindings are attached on first viewport visibility.

### 9.4 Isomorphic runtime

- `renderToString(component, props, ctx) → string` — server / build path. No DOM API.
- `hydrate(rootElement, ctx)` — client path. Walks existing DOM, attaches bindings, does not re-render.
- `mount(component, container, props, ctx)` — client-only path when no cached HTML exists.

## 10. DevTools

A dedicated browser extension will surface UIDetox-specific state:

- Component tree with Registry values in scope.
- Signal graph: which `state()` properties are read/written by which component.
- Effect / derived dependencies (reactive DAG).
- Directive markers visible in the debug build (`<u-if>`, `<u-for>`, etc.).

## 11. Phase Plan

- **Phase 0 (MVP).** Format parser (Markdown SFC), fenced blocks (`template`, `script`, `style`, `props`, `frontmatter`), Custom Element registration, `state`/`derived`/`effect` runtime, directives `<if>`/`<for>`/`<case>`, template syntax (attributes, `${expr}`, text), scope binding & slots, batched updates via rAF, build tool `.md` → `.js`.
- **Phase 1.** Test blocks (`test`, `test:visual`, `test:a11y`), `fixtures`, `mock`, `example`; traits mechanism; DevTools extension MVP.
- **Phase 2.** Registry hierarchical scoping + full test override; SSR with prerender + hydrate; routing (`routes.md` aggregation, guards, layouts); `<while>`, `<include>`, `<lazy-load>`.
- **Phase 3.** `<insert>/<update>/<delete>` animation directives; islands architecture; i18n block; server actions.
- **Phase 4.** Formal contracts (`schema`, `spec`, `contract`), `migrate` codemods, feature flags, permissions.

## 12. Open Questions (deferred)

- `<select>`, `<insert>`, `<update>`, `<delete>` directive semantics.
- Debug build format for `<u-if>` etc. (data attributes vs custom tag names).
- Whether `derived` values should be pushed into a `state` container so they can be read without `.value` (self-reference cycle problem).
- Proxy caching strategy — nested-object access should not allocate a fresh Proxy on every read; cache via WeakMap.
- Style scoping algorithm (shadow DOM vs attribute-selector rewrite).
- Lifetime of module-scope Registry entries during route transitions.

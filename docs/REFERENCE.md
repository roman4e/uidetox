# UIDetox — Reference Manual

UIDetox is a TypeScript UI framework built on native Web Components. Its guiding
idea: **the component tree is visible in the HTML** — View Source and DevTools
show real custom-element tags (`<ingredient-row>`), not a single `<div id="root">`.

Reactivity is signal-based (`state` / `derived` / `effect`) with no dependency
arrays and no compile magic. Authoring is either a Markdown single-file component
or the `.dtx` DSL. Rendering targets real Custom Elements; virtual directives
(`<if>`, `<for>`, `<case>`…) leave no wrapper nodes in production.

This manual is a feature-and-syntax reference with a runnable example for each
capability.

## Table of contents

1. [Concepts & mental model](#1-concepts--mental-model)
2. [Reactivity](#2-reactivity) — `state`, `shallow`, `derived`, `effect`, `batch`, `untrack`
3. [Scheduler & DOM staging](#3-scheduler--dom-staging)
4. [Animations](#4-animations)
5. [Components](#5-components) — `defineComponent`, `TemplateCtx`, lifecycle
6. [Authoring: Markdown SFC](#6-authoring-markdown-sfc)
7. [Authoring: the `.dtx` DSL](#7-authoring-the-dtx-dsl)
8. [Template syntax](#8-template-syntax) — interpolation, bindings, refs
9. [Virtual directives](#9-virtual-directives) — `if` / `for` / `case` / virtual list / include / lazy-load
10. [`task` — detached async work](#10-task--detached-async-work)
11. [Emits & events](#11-emits--events)
12. [Registry (dependency injection)](#12-registry-dependency-injection)
13. [Router](#13-router)
14. [Traits](#14-traits) & [Filters](#15-filters)
15. [Drag & drop](#16-drag--drop)
16. [Forms](#17-forms)
17. [HTTP client & OpenAPI codegen](#18-http-client--openapi-codegen)
18. [i18n formatting](#19-i18n-formatting)
19. [SSR, hydration & islands](#20-ssr-hydration--islands)
20. [DevTools](#21-devtools)
21. [Package entry points](#22-package-entry-points)

---

## 1. Concepts & mental model

- **Web Components substrate.** Author names are PascalCase (`IngredientRow`);
  they compile to kebab-case custom-element tags (`<ingredient-row>`). The tree
  is real DOM — visible in View Source and DevTools.
- **Signals, not dependency arrays.** `state()` returns a reactive Proxy;
  `derived()` computes; `effect()` re-runs when what it *read* changes. No
  `useMemo`, no deps lists, no compiler tracking magic.
- **Frame-batched.** Reactive re-runs and DOM writes are coalesced into one paint
  per animation frame through a 4-phase scheduler (derivations → effects → reads
  → renders) and a staged DOM commit.
- **Virtual directives.** `<if>` / `<for>` / `<case>` / windowed lists leave **no
  wrapper element** in production — they anchor on text nodes.
- **Two authoring formats.** A Markdown single-file component, or the
  section-based `.dtx` DSL. Both compile to the same runtime calls.

---

## 2. Reactivity

Import from `uidetox`.

### `state(obj)` — deep reactive Proxy

Recursively reactive: nested objects/arrays become reactive lazily on read.
Reads track the exact `(object, key)` pair; writes notify only when the value
actually changes (`Object.is` skip). Array writes that change `length` also
notify `'length'` (so `push`/`splice` are reactive). Proxy identity is cached —
`state(o) === state(o)`. **Always pass raw objects, never a proxy back in.**

```ts
import { state, effect } from 'uidetox';
const s = state({ count: 0, items: [1, 2] });
effect(() => console.log(s.count, s.items.length));
s.count = 1;      // re-runs
s.count = 1;      // no re-run (unchanged)
s.items.push(3);  // re-runs (length notified)
delete s.count;   // re-runs
```

### `shallow(obj)` — top-level-only

Tracks/notifies only direct keys; nested values are returned **raw** (not
re-wrapped). Cheap for large, read-mostly payloads swapped wholesale. Mutating
inside a value does not notify — replace the reference.

```ts
const g = shallow({ nodes: [] });
effect(() => render(g.nodes.length));
g.nodes.push(x);      // ⚠️ no re-run (nested)
g.nodes = fresh;      // ✅ re-runs (reference replaced)
```

### `derived(fn)` → `{ readonly value }`

Computed value recomputed on the scheduler's derivations phase (before effects)
whenever its tracked dependencies change. Reading `.value` in another
effect/derived subscribes transitively.

```ts
const s = state({ a: 2, b: 3 });
const sum = derived(() => s.a + s.b);
effect(() => console.log(sum.value)); // re-runs when a or b changes
```

### `effect(fn, opts?)` → disposer

Runs `fn` immediately (**first run is synchronous**), auto-tracks reads, re-runs
on change (via the effects phase). If `fn` returns a function it is the cleanup —
called before each re-run and on dispose. Dependencies are re-collected every
run. `opts.scheduler` overrides *when* re-runs happen.

```ts
const dispose = effect(() => {
  const u = s.url;
  const ctl = new AbortController();
  fetch(u, { signal: ctl.signal });
  return () => ctl.abort();   // cleanup before next run / on dispose
});
dispose();
```

Inside a component prefer `ctx.effect` (auto-disposed on unmount) — see §5.

### `batch(fn)` — collapse notifications

Groups mutations so each affected observer is notified **once**, after all
writes. Nested batches flatten (outermost flushes). Flushes even if `fn` throws.
Reads inside see current post-write values.

```ts
batch(() => { s.x = 1; s.y = 2; }); // observer runs once, not twice
```

### `untrack(fn)` / `untracked(fn)` — read without subscribing

`untracked` is an alias of `untrack`.

```ts
effect(() => {
  console.log(s.a);                  // tracked
  const b = untrack(() => s.b);      // read, NOT tracked
});
```

---

## 3. Scheduler & DOM staging

### Frame model

A single rAF-armed flush drains four phase queues in fixed order —
**derivations → effects → reads → renders** — looping until empty (guard: 20
turns, then logs a possible-infinite-loop warning). This is how child updates
coalesce into one paint.

Public (package root):

| Fn | Purpose |
|---|---|
| `scheduleRead(job)` | run `job` in the reads phase (after effects, before renders) |
| `readFrame(fn)` → `Promise<T>` | resolve with `fn()`'s result after current mutations settle |

Module-level (not on root; used by the runtime, available if you import from
`runtime/scheduler`): `scheduleEffect`, `scheduleDerivation`, `scheduleRender`,
`flushSync` (drain everything now — the rAF callback and a test helper),
`onFrameEnd(job)→unregister`, `nextFrame()→Promise`. `scheduleFlush` is
**deprecated** (delegates to `scheduleEffect`).

```ts
import { scheduleRead, readFrame } from 'uidetox';
scheduleRead(() => { /* read DOM after mutations flushed */ });
const width = await readFrame(() => el.getBoundingClientRect().width);
```

### DOM staging

Mutations are staged and committed together on the render phase, coalesced so at
most one commit is scheduled.

| Fn | Purpose |
|---|---|
| `mutate(node, kind, name, value)` | stage one prop/attr/text/style op; `kind` = `'text'\|'attr'\|'prop'\|'boolean'\|'style'`; keyed by `(node,kind,name)` (last write wins) |
| `mutateStructural(op)` | stage ordered `insert`/`remove`/`move` (applied after prop ops) |
| `readStaged(node, kind, name)` | read the pending staged value (read-your-writes) |
| `commitStage()` | apply + clear all staged ops now |
| `commitSync()` | test helper: `commitStage()` + `flushSync()` |
| `measure(fn)` | flush staged ops, then run `fn` (layout read reflects latest state) |
| `measureOffscreen(build, read)` | build a node in a hidden offscreen container, read it, remove |

```ts
import { mutate, mutateStructural, readStaged, measure } from 'uidetox';
mutate(el, 'attr', 'title', 'hi');
mutateStructural({ kind: 'insert', parent, node: el, before: null });
readStaged(el, 'attr', 'title');                         // 'hi' (pre-commit)
const w = measure(() => el.getBoundingClientRect().width); // flushes staged first
```

Bindings emitted by the compiler already stage through `mutate`; you rarely call
these directly — they're for custom low-level widgets.

---

## 4. Animations

| API | Signature / meaning |
|---|---|
| `prefersReducedMotion()` | `(prefers-reduced-motion: reduce)` matches; `false` when `matchMedia` absent (SSR-safe) |
| `computeFlipDelta(first, last)` | pure `{ dx, dy, sx, sy }` between two `Rect`s (scale `1` on zero-size) |
| `flip(elements, mutateFn, opts?)` | First-Last-Invert-Play: measure, run `mutateFn`, re-measure, animate reflow. Skips trivial deltas and all motion under reduced-motion |
| `animate(el, keyframes, opts?)` | WAAPI wrapper → `Animation \| null`; on no-WAAPI/reduced-motion applies the final keyframe instantly |
| `viewTransition(mutateFn)` | run `mutateFn` inside `document.startViewTransition` (awaits `.finished`); falls back to awaiting `mutateFn()` |

`FlipOptions { duration=200, easing='ease' }`,
`AnimateOptions { duration=200, easing='ease', delay?, fill? }`,
`Rect { x, y, width, height }`, `FlipDelta { dx, dy, sx, sy }`.

```ts
import { flip, animate, viewTransition } from 'uidetox';
flip(items, () => list.append(newItem), { duration: 250 });          // animate reflow
animate(box, [{ opacity: 0 }, { opacity: 1 }], { fill: 'forwards' });
await viewTransition(() => { view.textContent = 'next'; });          // crossfade + fallback
```

### `task(fn, opts?)` — see §10.

---

## 5. Components

`defineComponent(options)` defines and registers a Custom Element. You rarely
write this by hand — the compiler emits it from a Markdown/`.dtx` component — but
it's the substrate, and hand-written "islands" use it directly.

```ts
interface ComponentOptions {
  tag: string;                                     // must contain a hyphen
  boot?: (ctx) => Node;                            // build the subtree imperatively
  template?: (ctx) => Node;                        // build subtree; setup() merged into props first
  setup?: (ctx) => Record<string, unknown> | void;
  onMount?: (ctx) => void | (() => void);          // after DOM built + connected; may return cleanup
  style?: string;                                  // appended as a <style> child
  props?: string[];                                // observedAttributes → ctx.props
  render?: 'always' | 'whenPropsKnown' | 'never';  // SSR behaviour (see §20)
}
```

Define either `boot` or `template`. `ctx` (the `TemplateCtx`):

| Member | Meaning |
|---|---|
| `props` | reactive proxy of attributes + `setup()` output |
| `host` | the element instance |
| `refs` / `ref(name)` | named element refs (see §8) |
| `find(sel)` / `findAll(sel)` | `host.querySelector` / `querySelectorAll` |
| `effect(fn)` | instance-scoped effect, **auto-disposed on unmount** |
| `task(fn, opts?)` | instance-scoped task, auto-disposed (see §10) |
| `onCleanup(fn)` | teardown run on disconnect (also importable from `uidetox`) |
| `emit(name, detail?)` | dispatch a bubbling+composed `CustomEvent` from the host |
| `registry` | the global DI registry (§12) |

**Lifecycle.** On connect: props reflected, `ctx` built, `boot`/`template` run
(with the cleanup sink + current host set), node appended, `style` appended, then
`onMount` (a returned function becomes the mount cleanup). On disconnect: every
instance disposer runs (`ctx.effect`, `ctx.task`, `onCleanup`), then the mount
cleanup, then children cleared.

```ts
import { defineComponent } from 'uidetox';
defineComponent({
  tag: 'live-clock',
  boot: (ctx) => {
    const el = document.createElement('time');
    ctx.effect(() => { el.textContent = new Date().toISOString(); });
    return el;
  },
  onMount: (ctx) => {
    const id = setInterval(() => ctx.host.dispatchEvent(new Event('tick')), 1000);
    return () => clearInterval(id);  // runs on unmount
  },
});
```

**`onCleanup(fn)`** (from `uidetox`) registers unmount teardown from a free
function called during boot — this is how `resource()`/`mutation()` auto-clean.

---

## 6. Authoring: Markdown SFC

A component is a Markdown file: YAML frontmatter + fenced blocks. Only `tag` is
required (must contain a hyphen).

````markdown
---
name: App
tag: app-root
---

# App  ← prose/headings are ignored by the compiler

```ts props
export type Props = { who: string };
```

```html template
<section class="hello">
  <h1>Hello, ${props.who}!</h1>
  <if when=${s.open}>
    <p>The panel is open.</p>
    <else><p>The panel is closed.</p></else>
  </if>
  <button @click=${toggle}>Toggle</button>
</section>
```

```ts script
const s = state({ open: true });
function toggle() { s.open = !s.open; }
```
````

Fence syntax is ` ```<lang> <role> ` — a fence with only a lang is plain prose.
Roles the compiler consumes:

| Fence | Role |
|---|---|
| ` ```html template ` | the template (**required**) |
| ` ```ts script ` | boot-scope statements (shares scope with template) |
| ` ```ts props ` | prop names from `export type Props = { … }` |
| ` ```css style ` / ` ```style ` | component styles |

Other roles (` ```ts test `, ` ```json fixtures `, ` ```html example:basic `…) are
read by tooling/testing pipelines and ignored by `compile()`. `script` and the
template share one scope, so `script` declarations are visible in `${…}`.
Frontmatter may also carry `extends: [A, B]`, `render:` (island/SSR hints),
`title`, `meta:`.

---

## 7. Authoring: the `.dtx` DSL

A section-based grammar. Top-level verbs: `component`, `trait`, `filter`, `token`,
`provide`, `router`. Header: `<verb> <Name> <clauses…>` — clauses include flags
`export`/`disabled`, `tag <name>`, `extends [A, B]`, `appliesto [input]`,
`input`/`output` (filters), `params (type name, type? name default)`.

Two member kinds:

- **Section members** — `props`, `tpl`/`template`, `script`, `actions`,
  `effects`, `style`, `task`. Body is captured until the next keyword or `end`.
  `end <block>` is optional (the next keyword auto-closes); `end <verb>` closes
  the whole declaration.
- **Signature members** (brace-delimited) — `on <event> <name>() { }`,
  `off <event> <name>()` / `off <event> *()`, `transform <name>() { }`,
  `default() { }`.

```
component Counter export tag app-counter

props
number start
end props

script
const s = state({ count: props.start ?? 0 });
end script

actions
function inc() { s.count++; }        ← attached as host.inc (public method)
function dec() { s.count--; }
end actions

template
<div class="counter">
  <button #dec @click=${dec}>-</button>
  <span class="value">${s.count}</span>
  <button #inc @click=${inc}>+</button>
</div>
end template

style scoped
.counter { display: flex; gap: 1rem; }
end style

end component
```

Section semantics: `script` = private boot statements; `actions` = each
`function foo(){}` becomes a `host.foo` public method; `effects` runs after the
template is built (refs populated); `style scoped` detects `scoped` on the header;
`task` / `task idle` wraps the body as `task(async (signal) => { … })`.

`effect(…)` inside `effects` (or `script`) **creates a reactive subscription** —
it re-runs whenever a signal or prop it read changes. Use it to react to a prop
that arrives *after* boot (e.g. measure + position against a `.prop`-bound
`anchor` set by the parent later):

```
effects
effect(() => {
  if (props.anchor && refs.pop) readFrame(() => place(props.anchor));
});
end effects
```

The effect re-runs when `props.anchor` is set, and `readFrame(fn)` runs `fn`
after the next DOM commit — no `requestAnimationFrame` retry loop needed. Pass
**plain data** through `.prop` (numbers/objects), not platform objects whose
getters rely on internal slots — a `DOMRect` passes through fine now, but a plain
`{ left, top, width, height }` is the safest contract.

`declare <kind> <name> … end <kind>` defines a reusable fragment (`tpl`, `style`,
`props`, `script`, `actions`, `effects`).

**Imports.** `import <name> from "path"` — `<name>` is a named import (≡ TS
`{ name }`); several with commas, optional `… as alias`. Namespace form:
`import * as Ns from "path"`. Bare `import name` is a side-effect import.

Module paths resolve Python-style, **dotted**:

- `"a.b"` → `./a/b.dtx`, else the package form `./a/b/module.dtx`, searched
  first beside the importer then in each configured `includes` root.
- A specifier containing `/` (`"uidetox/forms"`, `"./x.dtx"`) is an npm/explicit
  path — passed through verbatim.

```
import Card from "components.card"        → import { Card } from "./components/card.js"
import * as Utils from "lib.util"         → import * as Utils from "./lib/util.js"
import form, f from "uidetox/forms"       → import { form, f } from "uidetox/forms"
```

All emitted string literals use **double quotes**.

**Trait** with inheritance + `off`:

```
trait trim export appliesto [input, textarea]
on blur trim_handler() { this.el.value = this.el.value.trim(); }

trait uppercase export appliesto [input] extends [trim]
off blur trim_handler()
on blur upper_handler() { this.el.value = this.el.value.toUpperCase(); }
```

**Filter** (`v` = input value):

```
filter lowercase export input string output string
transform lc() { return v.toLowerCase(); }

filter title-case export input string output string extends [lowercase]
transform tc() { return v.charAt(0).toUpperCase() + v.slice(1); }
```

**Task** section:

```
task
const res = await fetch(`/api/products?q=${filter.q}`, { signal });
if (!signal.aborted) items.list = await res.json();
end task
```

`token` / `provide` verbs exist (emit `createToken` / `registry.provide`); prefer
the runtime API in §12 until the DSL forms are exercised by examples.

**`router` verb** compiles to a default-exported `RouteEntry[]` (the runtime
`defineRouter`'s `routes` param — mode/guards stay in `main.ts`):

```
import Login from "pages.Login"
import Dashboard from "pages.Dashboard"
import NotFound from "pages.NotFound"
import AppShell from "layouts.AppShell"
import requireAuth from "lib.auth-guard"

router AppRoutes export
routes
"/login" -> Login

group layout=AppShell guard=requireAuth
"/"                -> Dashboard
"/recipes/:id"     -> RecipeCard  { id: string }
"/moderation"      -> Moderation  guard=require-chef-admin
end group

"/kitchen/:id" layout=KitchenShell -> KitchenMode { id: string }
"**" -> NotFound status=404
end routes
end router
```

Each `routes` line is `"<path>" [clauses] -> <Handler> [clauses] [{ params }]`:

- **Clauses** (before or after `->`): `layout=X`, `guard=fn`, `guards=[a,b]`,
  `status=N`, `priority=N`. `layout` lands in `meta.layout`.
- **`group … end group`** applies its clauses to every route inside; per-route
  clauses add/override (guards accumulate).
- **Params** `{ id: string, page: int? default(1) }` → `paramsSchema` (`?` =
  optional, `default(v)` = default). Types: `string`/`number`/`int`/`boolean`.
- **Catch-all** `"**"`.

Consume it:

```ts
import routes from "routes";                 // dotted → routes.dtx
const router = defineRouter({ routes, mode: "history" });
router.start();
```

Handlers are the imported component modules — each compiled component
**default-exports** a factory `() => document.createElement("<tag>")`, and
importing it registers the custom element. See `examples/culinary-lite/`.

---

## 8. Template syntax

Shared by both authoring formats. Expressions are protected before HTML parsing,
so interior spaces / `/` / `||` / nested template-literal braces are all safe.

**Text interpolation** — `${expr}` becomes a reactive text binding:

```html
<span>${s.count}</span>
```

**Attribute bindings** — the prefix picks the kind. A value binds reactively only
when it is exactly one `${…}` token; a plain attribute with mixed text stays
static. Quotes around the expression are optional (`@click=${fn}` ≡
`@click="${fn}"`).

| Author syntax | Kind | Effect |
|---|---|---|
| `x=${e}` | expression | `setAttribute('x', e)` (removed when `false`/`null`/`undefined`) |
| `@click=${fn}` | event | `addEventListener('click', fn)` |
| `.prop=${e}` | property | assigns DOM property → child's reactive `ctx.props` |
| `?disabled=${e}` | boolean | toggles boolean attribute |
| `class="x"` | static | literal |

**Passing object/array props.** Attributes stringify (`x=${obj}` → `"[object
Object]"`) — for structured data use the **property** binding `.prop=${obj}`. A
declared prop (`props: [...]` / a `props` section) gets a generated accessor that
writes the value into the child's reactive `_props`, so the child reads it as
`ctx.props.<prop>` and re-renders when the parent updates it:

```html
<!-- parent -->
<lad-single .item=${s.item} .palette=${s.palette}></lad-single>
```
```
component LadSingle tag lad-single
props
object item
object palette
end props
template
<span>${props.item.word}</span>     <!-- reactive: updates when s.item changes -->
end template
end component
```

Object identity, `DOMRect`, and functions all survive (no JSON round-trip).

**Element refs** → `ctx.refs` / `ctx.ref(name)` (also `ctx.find` / `ctx.findAll`).
Keys are camel-cased. Resolution:

1. `#name` → `refs.<camel>` — `<button #submit-btn>` → `refs.submitBtn`.
2. `#${expr}` → computed ref key.
3. else static `name="…"`, else static `id="…"` — `<input name="email"/>` →
   `refs.email`. (Dynamic `name=${…}` does not auto-bind; `#marker` wins.)

**Traits** — `use="trait"` (static; `use="a, b"` for several). Params: `:param=`
(shared) or `:trait:param=` (scoped); kebab→camel:

```html
<li use="draggable" data-payload=${JSON.stringify(p)}>${p.name}</li>
<div use="droppable" :accept=${'ingredient'} @drop-payload=${onDrop}>drop</div>
```

**`bind=${field}`** — two-way form binding (§17).

---

## 9. Virtual directives

Compile-time transforms that leave no wrapper element in production (text-node
anchors; `<u-*>` markers only in debug). Recognized tags: `if`, `for`,
`virtual-for`, `case`, plus compile-time `include` and the runtime `lazy-load`.

**`<if>` / `<else>`** — `when` required; an `<else>` child splits the branches:

```html
<if when=${s.open}>
  <p>open</p>
  <else><p>closed</p></else>
</if>
```

**`<for each= item= key=>`** — `each` required; `item` default `"item"`; `key`
optional (defaults to index):

```html
<for each=${props.items} item="ing" key="ing.id">
  <li>${ing.name}</li>
</for>
```

**`<case on=>` / `<when is=>` / `<else>`** — `on` required; arms match string
literals; `<else>` is the default:

```html
<case on=${list.status}>
  <when is="loading"><spinner-el></spinner-el></when>
  <when is="error"><p>Failed</p></when>
  <else><p>Ready</p></else>
</case>
```

**Windowed list** — `<for … viewport="virtual">` (alias `<virtual-for>`). Extra
attributes: `row-height` (required), `overscan`, `scroll-parent`, `debug`.
Renders only the visible slice + overscan; keyed reconcile preserves row DOM
identity across scroll. Full detail in [`docs/patterns/virtual-for.md`](./patterns/virtual-for.md).

```html
<for each=${rows} item="r" key="r.id" viewport="virtual" row-height="48" overscan="6">
  <ingredient-row data=${r}/>
</for>
```

`ref` on the element exposes `scrollToIndex(i)` / `scrollToKey(k)`; `debug` emits
`data-virtual-window="start,end,total"`.

**`<include src="…"/>`** — compile-time inline of another fragment (`src` is a
static string; `.md` targets pull their `html template` block):

```html
<main>
  <include src="../partials/header.html"/>
  <p>Home body</p>
</main>
```

**`<lazy-load>`** — a runtime element (not a compile transform). Attributes:
`src` (required), `trigger` (`visible` default, `interaction`, `eager`, `manual`),
`placeholder` (tag name, or `skeleton`), `prefetch`. Emits `load` / `error`.
Register with `registerLazyLoad()`.

```html
<lazy-load src="/Heavy.js" trigger="interaction" placeholder="skeleton"></lazy-load>
```

---

## 10. `task` — detached async work

A detached, async, reactive side-effect that runs **off** the render frame — for
fetches, websockets, timers, analytics. Each run gets a fresh `AbortSignal`; a
reactive change re-runs it and aborts the previous run.

```ts
task(fn: (signal: AbortSignal) => void | Promise<void>, opts?: { idle?: boolean }): () => void
```

- Scheduled asynchronously (default `queueMicrotask`; `{ idle: true }` →
  `requestIdleCallback`). No synchronous first run (unlike `effect`).
- Only signals read **synchronously before the first `await`** are tracked.
- Re-runs coalesce; disposal aborts the in-flight run.
- Inside a component use `ctx.task` (auto-disposed on unmount). In the `.dtx` DSL
  it's a `task` section (`task idle` for the idle variant).

```ts
import { state, task } from 'uidetox';
const s = state({ q: '' });
const dispose = task(async (signal) => {
  const q = s.q;                                    // tracked
  const r = await fetch(`/search?q=${q}`, { signal });
  if (!signal.aborted) render(await r.json());
});
dispose(); // aborts in-flight request
```

---

## 11. Emits & events

Components communicate upward with DOM `CustomEvent`s (bubbling + composed), so
parents listen with plain `@event=${…}` bindings.

- `ctx.emit(name, detail?)` — dispatch from the host.
- `defineEmits<T>()` (call during `boot`) → a typed `emit(name, detail)`.

```ts
import { defineEmits } from 'uidetox';
defineComponent({
  tag: 'rating-stars',
  boot: (ctx) => {
    const emit = defineEmits<{ rate: { value: number } }>();
    const el = document.createElement('div');
    el.onclick = () => emit('rate', { value: 5 });
    return el;
  },
});
```

```html
<rating-stars @rate=${(e) => save(e.detail.value)}></rating-stars>
```

---

## 12. Registry (dependency injection)

Typed tokens with hierarchical, reactive resolution.

```ts
import { createToken, registry } from 'uidetox';

const apiToken = createToken<ApiClient>('api');
registry.provide(apiToken, apiClient);          // value or thunk

const api = registry.get(apiToken);             // reactive Derived<T>
api.value.ingredients.list(/* … */);
```

- `createToken<T>(name, { extends? })` — tokens may `extends` parents for MRO
  fallback.
- `registry.provide(token, value | () => value)` — global provider (thunks run
  per resolution).
- `registry.get(token)` → **reactive** `Derived<T>`; `.value` re-resolves when the
  provider changes.
- Scopes: `const s = registry.createScope(); s.override(token, v); s.enter(() => …)`.
  `override` requires an active scope; resolution walks scope → global over the
  token's C3 linearization.

Inside a component, `ctx.registry` is this same registry.

---

## 13. Router

Typed params, guards, lazy handlers, history or hash mode. Route source is
normally file-based (compiled to `RouteEntry[]`), but the runtime accepts the
array directly.

```ts
import { defineRouter, registerOutlet, lazy, Redirect } from 'uidetox';

const routes = [
  { path: '/',          handler: Home,        paramsSchema: {}, priority: 50, guards: [], status: null, meta: {} },
  { path: '/users/:id', handler: UserProfile, paramsSchema: { id: { type: 'number', optional: false } },
    priority: 50, guards: [], status: null, meta: {} },
  { path: '/admin',     handler: lazy(() => import('./Admin.js')), paramsSchema: {}, priority: 50,
    guards: [(ctx) => isAuthed() ? true : new Redirect('/login')], status: null, meta: {} },
];

registerOutlet();                                  // defines <router-outlet>
const router = defineRouter({ routes, mode: 'history' /* or 'hash' */ });
const outlet = document.querySelector('router-outlet');
outlet.__attach(router);
router.start();
router.controller.goto('/users/42');
```

- **Path patterns**: `:param`, optional `:param?`, `**` catch-all.
- **Param types**: `'string' | 'number' | 'int' | 'boolean'`, with `filter`
  (RegExp/predicate), `default`, `optional`. Coercion failure skips the match.
- **Guards** `(ctx) => boolean | Redirect | Promise<…>` — `false` aborts, a
  `Redirect` navigates.
- **Lazy**: `lazy(() => import('./X.js'))` (unwraps `.default`).
- **Match order**: specificity `[segments, staticSegs, catchAll]` then `priority`.
- **`applyMetadata(payload)`** upserts `<title>`, meta/OG tags, and append-once
  `link`/`script`/JSON-LD into `<head>`.
- **Layouts**: when a matched route carries `meta.layout` (a handler — from the
  router DSL `layout=` clause), `<router-outlet>` renders the layout and projects
  the page into the layout's default `<slot>`: `<app-shell><…page…></app-shell>`.
  One level for now; nested layouts are a follow-up.

### Slot projection

A component's template `<slot>` receives the light-DOM children present when the
element connects. `<app-card>content</app-card>` places `content` where the
`<slot>` sits in `AppCard`'s template. No `<slot>` → children append at the end.

---

## 14. Traits

Reusable behavior attached to elements via `use="name"`, with C3 inheritance.
Two flavors:

**Declarative** (event handlers) — authored in the `.dtx` DSL `trait` block, or
`defineTrait`:

```ts
import { defineTrait } from 'uidetox';
defineTrait('trim', {
  appliesTo: ['input'], paramsSchema: {}, props: () => ({}),
  handlers: { blur: [{ name: 'trim', run() { this.el.value = this.el.value.trim(); } }] },
});
```

**Imperative** (behavior lifecycle) — `defineBehaviorTrait(name, appliesTo,
attach)`; `attach(el, params)` runs on install and returns a cleanup. This is how
drag & drop is built (§16).

```ts
import { defineBehaviorTrait } from 'uidetox';
defineBehaviorTrait('autofocus', ['*'], (el) => {
  (el as HTMLElement).focus();
});
```

In templates: `use="trim"`, multiple with `use="trim, uppercase"`, params via
`:param=${…}` (shared) or `:trait:param=${…}` (per-trait). `TraitDescriptor`
supports `extends` (MRO parents) and `off` (suppress inherited handlers by name
or `'all'`). `installTraits(root, useMap)` / `getTrait(name)` /
`clearTraitRegistry()` are the runtime hooks.

---

## 15. Filters

Value transformers usable as a pipe in interpolation. Authored in the `.dtx`
`filter` block or `defineFilter`:

```ts
import { defineFilter } from 'uidetox';
const money = defineFilter('money', {
  input: 'number', output: 'string',
  paramsSchema: { currency: { type: 'string', default: 'USD' } },
  transformers: [{ name: null, run(v) { return `${v} ${this.params.currency}`; } }],
});
money(5, { currency: 'EUR' });   // "5 EUR"
```

```html
<span>${price | money:'EUR'}</span>
```

Transformers run left→right (MRO-merged, `offTransform` suppresses inherited
ones); each sees `this.params`. The i18n module registers `number`, `percent`,
`delta`, `qty`, `date`, `dateTime`, `relative` this way (§19).

---

## 16. Drag & drop

Pointer-Event based traits — mouse and touch behave the same, and canvas drops
get real coordinates. Register once:

```ts
import { registerDnd } from 'uidetox';
registerDnd(); // draggable, droppable, sortable, sortable-item
```

**draggable** — payload from `data-payload` (JSON) or a `.dragPayload` property.

```html
<li use="draggable" data-payload=${JSON.stringify({ kind: 'ingredient', id: ing.id })}>
  ${ing.name}
</li>
```

Params: `:handle` (selector), `:threshold` (px, default 4), `:axis` (`'x'|'y'`),
`:ghost` (`'clone'|'none'|selector`), `:long-press` (touch hold ms, default 300).
Fires `drag:start` / `drag:move` / `drag:end` / `drag:cancel` on the source **and**
on `document.body`, detail `{ payload, clientX, clientY, source }`. Sets
`document.body[data-dragging]` while active. Escape / pointer-cancel / tab-hide
cancel and remove the ghost.

**droppable**

```html
<div use="droppable" :accept=${'ingredient,operation'} @drop-payload=${(e) => place(e.detail)}>…</div>
```

`accept` = comma list of payload `kind`s (empty = all). Sets `[data-drop-active]`
while an accepted payload hovers within bounds. On drop fires `drop-payload` with
`{ payload, clientX, clientY, offsetX, offsetY }` (offsets relative to the target).
`:autoScroll=${true}` scrolls an `overflow:auto` target near its edges.

**sortable** + **sortable-item**

```html
<ol use="sortable" @reorder=${(e) => arr.moveTo(e.detail.from, e.detail.to)}>
  <for each=${arr} item="x" key="x.id">
    <li use="sortable-item" data-sort-id=${x.id}>${x.label}</li>
  </for>
</ol>
```

`reorder` detail: `{ from, to, id }`. Foreign payloads can't drop in.

Programmatic API (also usable without the trait): `attachDraggable(el, params)`,
`attachDroppable(el, params)`, `attachSortable(el)`, `attachSortableItem(el)` —
each returns a cleanup function.

---

## 17. Forms

Reactive value store + schema validation + two-way template binding. Import:

```ts
import { f, form, registerFormComponents } from 'uidetox/forms';
```

### Schema DSL

```ts
const schema = f.object({
  name: f.string().min(2).max(200),
  densityGml: f.number().positive().optional(),
  category: f.enum(['vegetable', 'meat', 'dairy']),
  nutrients: f.array(f.object({
    code: f.string().min(1),
    amountPer100g: f.number().min(0),
  })).min(1),
});
```

Types: `string` (`.min`/`.max`), `number` (`.min`/`.max`/`.positive`/`.int`),
`boolean`, `enum`, `object`, `array` (`.min`). Any schema: `.optional()`,
`.refine(pred, msg)`, `.asyncCheck(fn, { debounceMs })`.

### `form()` store

```ts
const fm = form({
  schema,
  initial: { name: '', densityGml: undefined, nutrients: [] },
  onSubmit: async (value) => { await api.ingredients.create(value); },
});
```

Reactive surface (track in templates/effects): `fm.values`, `fm.errors`
(`map<path, string[]>`), `fm.dirty`, `fm.valid`, `fm.submitting`, `fm.touched`.

Field handle `fm.field(path)` — dotted/bracketed paths (`'taste.saltiness'`,
`'nutrients.0.code'`): getters `value`, `error`, `errors`, `dirty`, `touched`,
`pending`; mutators `setValue`, `setTouched`, `reset`, and for arrays `append`,
`removeAt`, `moveTo`.

Cross-field: `fm.rule(v => v.neto <= v.brutto, 'msg', ['neto'])`.
Side effect: `fm.watch('name', (v) => …)` → disposer.
Server errors: `fm.applyServerErrors(apiError)` merges `fieldErrors`, cleared on
edit. Async validators expose `field.pending`; `fm.valid` is false while pending.

### Template binding

```html
<form @submit=${fm.submit}>
  <input bind=${fm.field('name')} placeholder="Назва"/>
  <field-error .of=${fm.field('name')}></field-error>

  <for each=${fm.values.nutrients} item="row" key="index">
    <input bind=${fm.field(`nutrients.${index}.code`)}/>
    <button type="button" @click=${() => fm.field('nutrients').removeAt(index)}>×</button>
  </for>
  <button type="button" @click=${() => fm.field('nutrients').append({ code: '', amountPer100g: 0 })}>+</button>

  <button type="submit" ?disabled=${!fm.valid || fm.submitting}>Зберегти</button>
</form>
```

`bind=${field}` is two-way (kind-detected: text/number/range/checkbox/select).
`<field-error>` renders the field's first error reactively (call
`registerFormComponents()` once at startup); it gets a `visible` attribute while
an error shows. Array rows = `<for>` + field `append`/`removeAt`/`moveTo`.

---

## 18. HTTP client & OpenAPI codegen

```ts
import { createHttpClient, resource, mutation, ApiError } from 'uidetox/http';
```

### Codegen

```
uidetox openapi --input ./openapi.json --output ./src/generated/api.ts
```

Emits named types from `components.schemas`, an `ApiClient` interface with
tag-grouped typed methods, and a `createClient(baseUrl, opts)` factory.

### Client

```ts
const api = createHttpClient('/api/v1', {
  auth: { getAccessToken: () => store.access, onRefresh: async () => refreshAccess() },
  interceptors: [{ onRequest: (ctx) => { ctx.headers['X-Trace'] = id; } }],
  onAuthExpired: () => location.assign('/login'),
});
await api.get('/ingredients', { query: { q: 'salt', limit: 50 } });
await api.post('/dish/{id}/rename', { path: { id: 7 }, body: { name: 'Borsch' } });
```

Query serialization: primitives; arrays → repeat-key (`?tag=a&tag=b`); nested
objects → dot-notation (`?filter.min=0`); `null`/`undefined` omitted. Non-2xx
throws `ApiError` (`status`, `code?`, `message`, `fieldErrors?`); FastAPI
`detail[]` folds into `fieldErrors`. **401 refresh**: single in-flight refresh,
concurrent 401s queue behind it, the original retries once; a second failure
fires `onAuthExpired`.

### Reactive resource

```ts
const list = resource(
  (signal) => api.ingredients.list({ query, signal }),
  { key: () => JSON.stringify(query) },
);
// list.status ('idle'|'loading'|'success'|'error'), list.loading, list.data,
// list.error, list.reload(), list.abort()
```

Re-runs when `key`'s reactive reads change, aborts the previous request each run,
and **auto-aborts when the host component unmounts**.

### Mutation (optimistic + rollback)

```ts
const patch = mutation(
  (id, body) => api.ingredients.update({ path: { id }, body }),
  {
    onOptimistic: (id, body) => snapshotAndApply(id, body), // returns snapshot
    onRollback: (snapshot, id) => restore(snapshot),
    onSuccess: () => list.reload(),
  },
);
// patch.pending, patch.error
```

Feeds forms: `catch (e) { if (e instanceof ApiError) fm.applyServerErrors(e); }`.

---

## 19. i18n formatting

Locale-aware number/date/unit formatting on `Intl` (formatting only — no message
catalogs in MVP).

```ts
import { setLocale, registerUnit, fmt } from 'uidetox/i18n';
setLocale('uk-UA');
registerUnit('g',   { symbol: 'г',   base: 1,    dimension: 'mass' });
registerUnit('mg',  { symbol: 'мг',  base: 1e-3, dimension: 'mass' });
registerUnit('mcg', { symbol: 'мкг', base: 1e-6, dimension: 'mass' });
```

```ts
fmt.number(1234.5)                    // "1 234,5"
fmt.number(1234.5, { decimals: 0 })   // "1 235"
fmt.percent(0.82)                     // "82 %"
fmt.delta(12.3)                       // "+12,3"
fmt.qty(1234.5, 'mg')                 // "1 234,5 мг"
fmt.qty(1234.5, 'mg', { to: 'g' })    // "1,2 г"
fmt.qty(1234.5, 'mg', { auto: true }) // "1,2 г"  (best unit, value in [0.5,999])
fmt.date(iso)                         // "26 черв. 2026"
fmt.dateTime(iso)                     // "26 черв. 2026, 14:32"
fmt.relative(iso)                     // "2 години тому"
```

Units of a shared `dimension` are inter-convertible (`convert(v, from, to)`) and
auto-scale together (`bestUnit`). Register template filters with
`registerI18nFilters()` (`number`, `percent`, `delta`, `qty`, `date`, `dateTime`,
`relative`) → `${node.mass | qty:'g'}`. String stub: `t(key)` echoes the key until
`setCatalog({...})` is provided.

---

## 20. SSR, hydration & islands

```ts
import { renderToString, hydrate } from 'uidetox';
```

- `renderToString(tag, { attrs?, childrenHTML? })` → the element's `outerHTML`.
  Runs in a DOM environment (happy-dom/jsdom/browser); toggles SSR mode around the
  render.
- `hydrate(root)` — walks `root` and `customElements.upgrade`s every custom
  element so their boot runs and bindings attach to the pre-rendered nodes (no
  re-render).

**Islands.** A component with `render: 'never'` skips its boot during
`renderToString`, emitting only `<!--uidetox:island-->`; it boots on the client
during `hydrate`. Use it to wrap imperative libraries (canvas, maps, editors).
See [`docs/patterns/island-wrapper.md`](./patterns/island-wrapper.md).

```ts
const html = renderToString('my-widget', { attrs: { title: 'Hi' } });
// … ship html to the client …
hydrate(document.body);
```

Lazy chunks: `registerLazyLoad({ importer })`, plus the `<lazy-load>` element
(§9). Prefetch/trigger primitives: `attachTrigger`, `schedulePrefetch`,
`createLoaderCache`.

---

## 21. DevTools

```ts
import { inspectComponentTree } from 'uidetox';
const tree = inspectComponentTree(document.body);
// [{ tag, attrs, children: [...] }] — the real custom-element tree, ready for a panel
```

Because the component tree is real DOM, standard browser DevTools already show it
as first-class elements — `inspectComponentTree` gives a serialisable snapshot
for a custom inspector.

---

## 22. Package entry points

| Import | Provides |
|---|---|
| `uidetox` | runtime: reactivity, `defineComponent`, directives helpers, registry, router, traits, filters, dnd, anim, DOM staging, SSR, devtools |
| `uidetox/forms` | `f`, `form`, `registerFormComponents` |
| `uidetox/http` | `createHttpClient`, `resource`, `mutation`, `ApiError` |
| `uidetox/i18n` | `setLocale`, `fmt`, `registerUnit`, filters, `t` |
| `uidetox/compiler` | compile Markdown SFC / `.dtx` → JS (build-time) |

CLI: `uidetox build <dir>`, `uidetox openapi --input --output`, `uidetox test <dir>`.

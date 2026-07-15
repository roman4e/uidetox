# UIDetox

![UIDetox](uidetox_logo.png)

**An HTML-first UI framework where the component tree is real DOM.** Built on
native Web Components, signal reactivity, and a section-based authoring language
— no virtual DOM, no `<div id="root">`, no class soup.

```html
<!-- View Source shows your components, not a black box -->
<app-shell>
  <ingredient-list>
    <ingredient-row>…</ingredient-row>
  </ingredient-list>
</app-shell>
```

---

## Why

- **Visible tree.** Every component is a real custom element. View Source and
  DevTools show `<ingredient-row>`, not an opaque render root. You style by tag,
  inspect by tag, test by tag.
- **Signals, not dependency arrays.** `state()` is a reactive Proxy; `derived()`
  computes; `effect()` re-runs when what it *read* changes. No `useMemo`, no deps
  lists, no compiler tracking magic.
- **Frame-batched.** Reactive re-runs and DOM writes coalesce into one paint per
  frame via a 4-phase scheduler; heavy work is deferred off the tick.
- **Two ways to author, one runtime.** A Markdown single-file component or the
  `.dtx` DSL — both compile to the same custom elements.
- **Batteries included.** Forms, typed HTTP + OpenAPI codegen, a file-based
  router, i18n, drag & drop, windowed lists, a Semantic-UI kit, and a Vite plugin.

---

## Reactivity in 5 lines

```ts
import { state, derived, effect } from 'ui-detox';

const s = state({ count: 0, items: [1, 2] });
const doubled = derived(() => s.count * 2);
effect(() => console.log(s.count, doubled.value));  // re-runs on change
s.count++;            // ▶ 1 2  → effect fires
s.items.push(3);      // arrays are reactive too
```

`batch(fn)` coalesces writes; `shallow()` skips deep tracking for big payloads;
`untrack(fn)` reads without subscribing.

---

## A component

**Markdown SFC** (`Counter.md`):

````markdown
---
name: Counter
tag: app-counter
---

```html template
<div class="counter">
  <button @click=${dec}>–</button>
  <span>${s.count}</span>
  <button @click=${inc}>+</button>
</div>
```

```ts script
const s = state({ count: props.start ?? 0 });
function inc() { s.count++; }
function dec() { s.count--; }
```
````

**`.dtx` DSL** — the same component:

```
component Counter export tag app-counter

props
number start
end props

script
const s = state({ count: props.start ?? 0 });
end script

actions
function inc() { s.count++; }
function dec() { s.count--; }
end actions

template
<div class="counter">
  <button #dec @click=${dec}>–</button>
  <span>${s.count}</span>
  <button #inc @click=${inc}>+</button>
</div>
end template

end component
```

Bindings by prefix: `${x}` text, `@click=${fn}` event, `.prop=${v}` property,
`?disabled=${v}` boolean. `#name` / `name="…"` auto-bind element refs into
`ctx.refs`.

---

## Virtual directives — no wrapper nodes

`<if>`, `<for>`, `<case>` compile away; in production they anchor on text nodes,
leaving no `<div>` scaffolding.

```html
<case on=${list.status}>
  <when is="loading"><spinner-el/></when>
  <when is="error"><p>Failed</p></when>
  <else>
    <for each=${list.data.items} item="ing" key="ing.id">
      <ingredient-row data=${ing}/>
    </for>
  </else>
</case>
```

---

## Windowed lists — 10 000 rows, ~15 DOM nodes

Rendering a long list kills scrolling. UIDetox virtualizes it by flipping **one
attribute** on `<for>` — same loop, same `key`, now it renders only the visible
slice plus a small overscan and recycles rows as you scroll. DOM node count stays
bounded no matter how long the array grows.

```html
<for each=${ingredients}          <!-- 8 000 items -->
     item="ing" key="ing.id"
     viewport="virtual"           <!-- ← turns on windowing -->
     row-height="48"
     overscan="6">
  <ingredient-row data=${ing}/>
</for>
```

```
plain <for>          →  8 000 <ingredient-row> in the DOM, janky scroll
<for viewport=…>     →  ~15 in the DOM, smooth at any length
```

- **Keyed reconcile** — a row with the same `key` keeps its DOM node across scroll,
  so focus, inputs and selection survive.
- **Bounded**: `(visible + 2·overscan)` rows, whatever `each.length` is; total
  scroll height is preserved via a spacer.
- **Scroll API**: grab the element with a `#ref` → `el.scrollToKey('ing-42')`,
  `el.scrollToIndex(1000)`.
- Works when the element itself scrolls or an ancestor does (`scroll-parent`), and
  inside `<select>` / `<table>`. `<virtual-for>` is an alias for the same thing.

Full guide: **[docs/patterns/virtual-for.md](docs/patterns/virtual-for.md)** ·
example: **[examples/virtual/IngredientList.dtx](examples/virtual/IngredientList.dtx)**.

---

## Forms — reactive, schema-validated, two-way bound

```ts
const fm = form({
  schema: f.object({
    name: f.string().min(2),
    nutrients: f.array(f.object({ code: f.string().min(1) })).min(1),
  }),
  initial: { name: '', nutrients: [] },
  onSubmit: async (v) => api.ingredients.create(v),
});
```

```html
<form @submit=${fm.submit}>
  <input bind=${fm.field('name')} placeholder="Назва"/>
  <field-error .of=${fm.field('name')}></field-error>
  <button ?disabled=${!fm.valid || fm.submitting}>Зберегти</button>
</form>
```

Validation runs off-tick and coalesced; server errors flow in with
`fm.applyServerErrors(err)`.

---

## Typed HTTP + OpenAPI

```
uidetox openapi --input ./openapi.json --output ./src/api.ts
```

```ts
const list = resource(
  (signal) => api.ingredients.list({ query, signal }),
  { key: () => JSON.stringify(query) },       // re-fetches on change, auto-aborts on unmount
);
// list.status · list.data · list.error · list.reload()
```

Auth with single-flight 401 refresh, `mutation()` with optimistic rollback, and
`command()` for CQRS writes — all in `ui-detox/http`.

---

## File-based router

`routes.dtx` compiles to a `RouteEntry[]`:

```
import Login from "pages.Login"
import Dashboard from "pages.Dashboard"
import requireAuth from "lib.auth-guard"

router AppRoutes export
routes
"/login" -> Login
group layout=AppShell guard=requireAuth
"/"              -> Dashboard
"/recipes/:id"   -> RecipeCard  { id: string }
end group
"**" -> NotFound status=404
end routes
end router
```

`navigate('/x')` and `<a data-nav href="/x">` for SPA transitions; `routeState()`
exposes the reactive current match (params, layout).

---

## More in the box

| Import | What |
|---|---|
| `ui-detox` | reactivity, components, directives, registry (DI), router, traits, filters, dnd, animations, SSR/islands, DevTools |
| `ui-detox/forms` | schema DSL, `form()`, `bind=`, `<field-error>` |
| `ui-detox/http` | `createHttpClient`, `resource`, `mutation`, `command`, OpenAPI codegen |
| `ui-detox/i18n` | `setLocale`, `fmt.{number,percent,qty,date,relative}`, unit conversion |
| `ui-detox/ui` | Semantic-UI primitive kit (`ui-button`, `ui-card`, `ui-modal`, …) |
| `ui-detox/vite` | Vite plugin — load `.dtx`/`.md`, dotted-module resolve, HMR, TS shims |

Also: reusable **traits** (`use="draggable"`), **filters** (`${v | qty:'g'}`),
hierarchical **registry** DI, **islands** (`render: 'never'` + `hydrate`), FLIP
**animations**, and `<lazy-load>`.

---

## Install & run

```bash
pnpm install
pnpm test        # 540+ tests
pnpm build       # tsc → dist/
```

```ts
// vite.config.ts
import uidetox from 'ui-detox/vite';
export default { plugins: [uidetox()] };
```

## Documentation

- **[REFERENCE.md](docs/REFERENCE.md)** — the full manual, every feature with examples.

Deep-dive guides in [`docs/patterns/`](docs/patterns/):

| Guide | Topic |
|---|---|
| [forms.md](docs/patterns/forms.md) | schema DSL, `form()`, `bind=`, validation |
| [http.md](docs/patterns/http.md) | HTTP client, `resource`, `mutation`, `command`, OpenAPI |
| [navigation.md](docs/patterns/navigation.md) | router, `navigate()`, `<a data-nav>`, `routeState()` |
| [virtual-for.md](docs/patterns/virtual-for.md) | windowed list rendering |
| [drag-and-drop.md](docs/patterns/drag-and-drop.md) | draggable / droppable / sortable traits |
| [i18n.md](docs/patterns/i18n.md) | locale-aware number / date / unit formatting |
| [ui-kit.md](docs/patterns/ui-kit.md) | Semantic-UI primitive components |
| [shallow-batch.md](docs/patterns/shallow-batch.md) | `shallow()`, `batch()`, `untrack()` |
| [island-wrapper.md](docs/patterns/island-wrapper.md) | wrapping imperative libraries (canvas, maps) |
| [vite-plugin.md](docs/patterns/vite-plugin.md) | `ui-detox/vite` — load `.dtx`/`.md`, HMR, TS shims |

## Examples

Runnable examples in [`examples/`](examples/):

| Example | Shows |
|---|---|
| [hello/](examples/hello/) | minimal Markdown SFC (`App.md`) |
| [todo/](examples/todo/) | SFC with colocated test blocks (`Todo.md`) |
| [dsl/](examples/dsl/) | `.dtx` components, traits, filters |
| [forms/](examples/forms/) | `IngredientForm.dtx` — schema + `bind=` + arrays |
| [virtual/](examples/virtual/) | `IngredientList.dtx` — `viewport="virtual"` |
| [dnd/](examples/dnd/) | `Palette.dtx` — draggable → droppable canvas |
| [island/](examples/island/) | `CanvasClock` — imperative canvas island |
| [island-cytoscape/](examples/island-cytoscape/) | `GraphEditor` — canvas-graph island (props↔lib, emits, drop) |
| [routing/](examples/routing/) | file-based routes |
| [include/](examples/include/) | `<include>` partials |
| [showcase/](examples/showcase/) | traits + filters + docs page |
| [culinary-lite/](examples/culinary-lite/) | full Vite app: router, layout, pages, `detox.toml` |
| [vitest-setup/](examples/vitest-setup/) | Vitest recipe with `uidetoxEsbuild` |

# REQ-11 — Additional Bugs + Next-Batch Culinary FE Needs

**Requested by:** Culinary frontend
**Priority:** mixed (see per-item table)
**Follows:** REQ-08/09/10 landed. This is the follow-on batch surfaced while
authoring the full route table, forms, island wrapper and starting to write
the remaining nine MVP screens.

## Part 1 — Additional bugs

### 11.1 — `router` verb DSL missing layouts, guards, nested routes, catch-all, params (P0)

**Symptom:** Current `router` verb (per `culinary-lite` smoke) accepts only:

```
router AppRoutes export
routes
"/login" -> Login
"/" -> Dashboard
end routes
end router
```

`RouteEntry` in `uidetox` supports `guards`, `layout` (via `meta.layout`),
`paramsSchema`, `priority`, catch-all `**`, and nested definitions. The DSL
currently exposes none of it. Culinary's MVP (per `frontend-architecture.md`)
needs all five for its 10 screens:

- `/login` (no layout, no guard)
- `/` (`layout=AppShell`, `guard=requireAuth`)
- `/recipes/:id` (`:id: string`)
- `/recipes/:id/edit`
- `/recipes/:id/compare`
- `/ingredients`
- `/ingredients/new`
- `/ingredients/:id`
- `/forks/:id/conflict`
- `/moderation` (`guard=requireChefAdmin`)
- `/kitchen/:recipeId` (`layout=KitchenShell`)
- catch-all `**` for 404

**Proposed syntax:**

```
import Login from "pages.Login"
import Dashboard from "pages.Dashboard"
import RecipeCard from "pages.RecipeCard"
import AppShell from "layouts.AppShell"
import KitchenShell from "layouts.KitchenShell"
import NotFound from "pages.NotFound"
import requireAuth from "lib.auth-guard"
import requireChefAdmin from "lib.auth-guard"

router AppRoutes export
routes
"/login" -> Login

group layout=AppShell guard=requireAuth
"/"                       -> Dashboard
"/recipes/:id"            -> RecipeCard             { id: string }
"/recipes/:id/edit"       -> RecipeEditor           { id: string }
"/recipes/:id/compare"    -> RecipeCompare          { id: string }
"/ingredients"            -> IngredientLibrary
"/ingredients/new"        -> IngredientForm
"/ingredients/:id"        -> IngredientForm         { id: string }
"/forks/:id/conflict"     -> ForkConflict           { id: string }
"/moderation"             -> ModerationQueue        guard=requireChefAdmin
end group

"/kitchen/:recipeId" layout=KitchenShell guard=requireAuth -> KitchenMode { recipeId: string }

"**" -> NotFound status=404
end routes
end router
```

Key features:

- **`group … end group`** applies clauses (`layout=`, `guard=`) to every
  route inside; per-route clauses override.
- Per-route clauses on one line: `layout=`, `guard=`, `guards=[a,b]`, `status=`,
  `priority=`.
- Param types in `{ }` at end of line: `{ id: string, page: int? default(1) }`.
- Catch-all `"**"` supported.

**Acceptance:**

- [ ] The syntax above compiles to a `RouteEntry[]` default export whose
      entries carry `guards`, `meta.layout`, `paramsSchema`, `status`,
      `priority`.
- [ ] `examples/culinary-lite/src/routes.dtx` extended to demonstrate at least
      one group + one param + one catch-all.
- [ ] Docs updated in REFERENCE §13 and `docs/patterns/vite-plugin.md`.

### 11.2 — No client-side navigation helper (P1)

**Symptom:** Culinary code today uses `location.assign('/x')` in `actions` —
which triggers a full page reload, defeating SPA behavior. The runtime
router owns a controller with `goto(url)` (per REFERENCE §13), but it is
accessible only in `main.ts` where it's created.

**Proposed API:**

- `import { navigate } from 'uidetox'` — resolves to the active router's
  controller `goto`. If no router is attached, throws with a helpful
  message.
- Template sugar: an `<a href="/x">` inside a UIDetox component intercepts
  the click if the URL matches a mounted route (opt-in via
  `<a href="/x" data-nav>` or by default — pick one and document).

Culinary preference: **explicit `<a data-nav href="/x">`** — no magic,
predictable interop with `mailto:` / `target="_blank"`.

**Acceptance:**

- [ ] `navigate('/x')` from a component's `actions` transitions without a
      full reload.
- [ ] `<a data-nav href="/x">` is intercepted by the router (works for
      middle-click, cmd-click, etc.).
- [ ] Docs snippet in `docs/patterns/`.

### 11.3 — `props` block: no `boolean`, no default value, no enum type (P1)

**Symptom:** `src/vite/shim.ts:4-10` maps `number|string|boolean|array|object`.
Missing:

- `boolean?` with a literal default — `boolean? disabled false`.
- Enums — Culinary passes `category: "first" | "second" | "dessert" | "special"`
  to `RecipeCard`. Today all we can write is `string`.
- Optional string with default — `string? placeholder "Type here"`.
- Object of a named TS type — for typed islands (`GraphEditor` needs
  `nodes: Node[]`, not `unknown[]`).

**Proposed extension:**

```
props
number start default 0
boolean? open false
string? placeholder "Type here"
"first"|"second"|"dessert"|"special" category
Node[] nodes
end props
```

**Acceptance:**

- [ ] Shim emits accurate `Props` type with defaults preserved as literal
      types (`open?: boolean`).
- [ ] Union type parses.
- [ ] Named-type reference (`Node[]`) compiles if the type is in scope via a
      preceding `import type` line at the top of the `.dtx`.

### 11.4 — `actions` argument types not extracted for host method typing (blocks 9.4) (P1)

**Symptom:** REQ-09.4 asked for `HTMLElementTagNameMap` entries for actions.
Even once shipped, the arg types need to survive: `function
selectNode(id: string) {…}` should yield `selectNode(id: string): unknown`
on the CE interface, not `selectNode(...args: unknown[]): unknown`.

**Requested:** shim should preserve TS-annotated parameter and return
types from `actions` `function` declarations. If unannotated → `unknown`.

**Acceptance:**

- [ ] `function selectNode(id: string): void {}` → CE interface has
      `selectNode(id: string): void`.

### 11.5 — Compiler treats `bind=${fm.field(...)}` correctly? (P1, needs verification)

**Symptom:** Culinary's `Login.dtx` uses:

```html
<input bind=${fm.field("email")}/>
```

REFERENCE §17 documents this as two-way binding wired by
`registerFormComponents`. Please verify the DTX compiler emits the correct
runtime call — specifically that `bind` is not treated as a plain attribute
expression setting the string result of `fm.field(...)` on the DOM node.
A short test in `tests/vite/` would cover this.

**Acceptance:**

- [ ] E2E test showing an `<input bind=${fm.field("x")}/>` in a `.dtx`
      component two-ways with a `form()` store.

### 11.6 — OpenAPI codegen: method names auto-derived from FastAPI operation IDs are ugly (P2)

**Symptom:** FastAPI operation IDs look like
`login_v1_auth_login_post`. Codegen produces:

```ts
api.auth.loginV1AuthLoginPost({ body });
```

**Requested:** when a FastAPI route has a distinct `summary` or a `name`
attribute, use that (camel-cased) as the method name; fall back to the
current auto-derived name otherwise. Alternatively, strip the
`_v[0-9]+_<path>_<verb>` suffix always. Culinary can and does set names,
but nice-to-have on the codegen side.

**Acceptance:**

- [ ] `api.auth.login({body})` works when the FastAPI operation has
      `name="login"` or `summary="Login"`.

### 11.7 — Test-block filtering (REQ-09.6): confirm before Culinary ships colocated tests (P2)

Just a nudge — this was in REQ-09.6. Culinary intends to colocate every
component with its `ts test` / `ts test:visual` / `ts test:a11y` blocks per
REFERENCE §6. Waiting on the plugin `mode: 'test'` switch and the docs
snippet.

## Part 2 — Next-batch capabilities Culinary needs but has not yet requested

These are on the horizon; opening as visible so both sides can plan.

### 11.8 — Cytoscape.js island: DTX island example that mounts a canvas library (P1)

Culinary's graph editor is the whole system's centerpiece. It needs a
proven pattern (working `.dtx` with `render: never` frontmatter or the
equivalent DTX clause) that:

- Boots Cytoscape in `onMount` targeting a `#refs.root` div.
- Bridges reactive props (`nodes`, `edges`, `selection`) via `ctx.effect`.
- Bridges Cytoscape events via `ctx.emit`.
- Handles drag&drop from a palette via `use="droppable"` on the host.
- Tears down cleanly in the returned cleanup.

`examples/island/CanvasClock.md` covers a lot but skips the drag&drop and
the reactive-prop bridge. Ship a Cytoscape (or another canvas-graph)
example so Culinary has a copy-paste starting point.

**Acceptance:**

- [ ] `examples/island-cytoscape/` — MIT-only deps, runs under Vite via
      the plugin, demonstrates props → cy bridge + drag&drop + emits.

### 11.9 — Vitest wiring recipe (P1)

Culinary tests should live in `.dtx` `ts test` blocks per REFERENCE §6.
Once REQ-09.6 lands the plugin has a `mode: 'test'` toggle. Missing: a
one-page recipe showing:

- `vitest.config.ts` with `uidetoxEsbuild({ mode: 'test' })` in
  `esbuild.plugins`.
- happy-dom setup.
- A sample `.dtx` file with `ts test`, `ts fixtures`, `ts mock` blocks that
  runs green under `pnpm test`.

**Acceptance:**

- [ ] `examples/vitest-setup/` with `pnpm test` returning green.

### 11.10 — LSP for `.dtx` in the shipped `packages/uidetox-lsp` (P2)

`packages/uidetox-lsp` and `packages/uidetox-vscode` exist in the repo.
Culinary would benefit from at minimum:

- Syntax highlighting in VS Code (probably already works).
- Autocomplete in `${…}` bindings — surface component's `state`, `props`,
  `derived`, `actions` names.
- Hover-type for `props` block entries.

Not blocking MVP; nice-to-have once the plugin bugs settle.

### 11.11 — Router visibility hooks (P2)

Culinary's `KitchenMode` needs to know when it's active (start the current
step's timer) and when it's leaving (abort in-flight tasks). Router should
expose:

- `onEnter(ctx)` / `onLeave(ctx)` lifecycle hooks per route, receiving the
  matched params.
- OR a runtime API: `router.controller.state()` returning a reactive
  `state()` container the components can subscribe to.

Culinary preference: reactive `state()` — plays cleanly with UIDetox's
signals model.

### 11.12 — Component fixture / stories for the CulinaryGraph frontend (P3)

Storybook-style playground of every component in isolation. Would help
design iteration once real UI work starts. Existing UIDetox
`docs/patterns/` docs plus REFERENCE cover authoring; a playground pattern
would help Culinary avoid rebuilding it.

## Priority table

| # | Item | Priority | Blocks |
|---|---|---|---|
| 11.1 | Router DSL: layouts/guards/nested/params/catch-all | **P0** | 10 of 11 Culinary routes |
| 11.2 | `navigate()` + `<a data-nav>` client-side transitions | P1 | Every screen with a link |
| 11.3 | Props block: boolean, default, enum, named types | P1 | Typed islands, tight components |
| 11.4 | Actions arg types on host interface | P1 | GraphEditor DX |
| 11.5 | Verify `bind=${field}` compiles correctly | P1 | Every form |
| 11.6 | Codegen method-name cleanup | P2 | DX only |
| 11.7 | Test-block mode confirmation | P2 | Colocated tests |
| 11.8 | Cytoscape island example | P1 | Graph editor start |
| 11.9 | Vitest recipe | P1 | Test workflow |
| 11.10 | LSP polish | P2 | DX |
| 11.11 | Router lifecycle hooks | P2 | KitchenMode |
| 11.12 | Component playground pattern | P3 | Design iteration |

Suggested order for the UIDetox side:
**11.1 → 11.2 → 11.3 → 11.4 → 11.5 → 11.8 → 11.9 → 11.6 → 11.11 → 11.7 → 11.10 → 11.12**.

## Culinary side plan while these are queued

- Continue backend hardening (rate-limits, structured errors, integration
  tests around fork+recompute edge cases).
- Draft component-level static designs for each MVP screen in Markdown so
  the moment the plugin dev-serves cleanly the frontend can move fast.
- Prep seed data for the design demo — one real dish with a graph, ~20
  ingredients, moderation entries.

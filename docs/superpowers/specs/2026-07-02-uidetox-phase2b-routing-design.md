# UIDetox Phase 2b — Client Routing

**Status:** Draft (v0.1)
**Date:** 2026-07-02
**Depends on:** `2026-07-01-uidetox-design.md`, `2026-07-02-uidetox-phase1c-dsl-design.md` (DSL grammar for routes).
**Owner:** roman4e@gmail.com

## 1. Purpose

Give UIDetox a first-class client-side router that authors describe declaratively in `.dtx` (primary DSL surface) or in `routes.md` HTML (for layout-heavy trees), with typed route parameters, guards, per-route status codes, multi-module aggregation, and a page-metadata system whose fields are gated by explicit component inheritance.

## 2. Non-Goals (Phase 2b)

- **Server-side rendering / hydration** — Phase 2c.
- **Data loaders (Remix-style `load()` before render)** — Phase 2 later slot.
- **`route <path>` as a standalone DSL verb** — this phase uses `router` verb (multiple `path` members) instead; a leaner alternative can be added later without breaking anything shipped here.

## 3. Navigation Model

- **Default:** History API (`/users/123`, clean URLs). Requires host to serve `index.html` for unknown paths (standard SPA fallback).
- **Opt-in:** `<Router mode="hash">` or `router mode hash` — `/#/users/123`; works on any static host without server config.
- Programmatic navigation via `router.goto(url, opts?)`, `router.replace(url)`, `router.back()`, `router.forward()`.
- Router surfaces the current location via a reactive Registry token (`currentLocationToken`).

## 4. Path Grammar

### 4.1 Absolute vs relative

```
path := absolute | parent-relative
absolute       := '/' segment ('/' segment)* ['/']
parent-relative:= '...' segment ('/' segment)* ['/']
segment        := literal | ':' <name> | ':' <name> '?' | '**'
literal        := [A-Za-z0-9._-]+
```

- **Absolute (`/foo/bar`)** — from root regardless of enclosing `<Router>`.
- **Parent-relative (`.../:id`)** — parent's mount path + `/:id`. The `...` token substitutes the enclosing `<Router from="…">` (or the enclosing `<Route path="...">` if nested).
- **Bare (`foo`) inside `<Router from="…">`** — equivalent to `.../foo`.

### 4.2 Trailing slash semantics

Trailing `/` is meaningful:

- `users` and `users/` are two **distinct** routes.
- `users/` is treated as "the `index` inside `users`" — a hint to the collector, not a magic rewrite.
- **Root exception:** `/` and `/index` are aliases — one route mounts at both URLs. Nothing else pretends to be an alias.

### 4.3 Slash-mismatch behaviour (configurable)

If a URL comes in and no route matches directly:

```dtx
router export slashPolicy strict
```

- `strict` (default) — no match → 404.
- `narrowing` — `users/` → tries `users` if the strict form 404s. Emits redirect to the canonical form.
- `expanding` — `users` → tries `users/` if the strict form 404s. Emits redirect.

Global config; overridable per-`router`.

### 4.4 Catch-all

- `**` — matches any remaining segments (0 or more). Always last within its scope.
- Local `**` inside a nested `<Router from="/admin">` catches only unmatched `/admin/*` URLs.
- Global `**` (at the top-level router) catches everything else.
- **Precedence:** deeper `**` wins over shallower `**`.

## 5. Params

### 5.1 In HTML (`<Route>`)

```html
<Route path="/users/:id/posts/:postId?" to=${UserPost}>
  <param :id="number" filter=${is_positive}/>
  <param :postId="string" filter=[[Alphabet+Numbers]]/>
</Route>
```

- `<param :<name>="<type>" filter=<filter> default=<value> optional/>`
- Reserved attribute names: `name`, `type`, `filter`, `default`, `optional`. Anything else must use the `:<name>` prefix.
- Types (MVP): `string`, `number`, `int`, `boolean`, `<CustomTypeName>`.

### 5.2 In DSL (`router`)

Inline:
```dtx
path /users/:id/posts/:postId to UserPost where
  :id is number filter is is_positive
  :postId is string filter is [[Alphabet+Numbers]]
```

Multiple params can also be inlined:
```dtx
path /users/:id to UserProfile where :id is number filter is is_positive
```

### 5.3 Filter forms

All four accepted anywhere a filter is expected:

| Form | Syntax | Emits |
|---|---|---|
| Expression | `filter=${fn}` / `filter is fn` | `filter: fn` — arbitrary predicate |
| Character class | `filter=[[Alphabet+Numbers]]` / `filter is [[…]]` | `filter: /^…+$/` — regex from class alphabet |
| Regex literal | `filter=/^[a-z]+$/` / `filter is /…/` | `filter: /…/` |
| Bare identifier / import | `filter is is_positive` | resolved via imports; must be `(v: string) => boolean` |

### 5.4 Character class DSL

Built-in classes (fixed set for MVP):

- `Alphabet` → `[a-zA-Z]`
- `Numbers` → `[0-9]`
- `Alphanum` → `[a-zA-Z0-9]`
- `Dash` → `[-]`
- `Underscore` → `[_]`
- `Dot` → `[.]`
- `Slug` → `[a-z0-9-]`
- `Hex` → `[0-9a-fA-F]`
- `UUID` → `[0-9a-f-]{36}` with the RFC-4122 shape check

Compose with `+`: `[[Alphabet+Numbers+Dash]]` → `/^[a-zA-Z0-9-]+$/`.

Unknown class → build error.

### 5.5 Coercion

At match time, the runtime:

1. Applies the pattern.
2. For each declared param: run `filter`. If it fails → treat as no match, continue.
3. Coerce value to declared type. If coercion fails → no match, continue.
4. Emit typed `params: { id: number; postId?: string }` object to the handler.

## 6. Handlers

- **Bare identifier** — must be imported from a component `.md` (default export) or a route-handler `.dtx` module:
  ```dtx
  from "./pages/UserProfile.md" import UserProfile
  path /users/:id to UserProfile
  ```
- **Lazy loading** — the `lazy` modifier:
  ```dtx
  path /admin to lazy Admin
  ```
  Compiler emits `handler: () => import('./…').then(m => m.default)`.
- **HTML equivalent**:
  ```html
  <Route path="/admin" to=${lazy(Admin)}/>
  ```

## 7. Guards

### 7.1 DSL

```dtx
router export
path / to Home
path /admin to AdminHome before requireAdmin
path /users/:id/edit to UserEdit before requireAuth, canEditUser
```

Router-level (applies to every child):

```dtx
router from "/admin" before requireAdmin
path .../ to AdminHome
path .../users to AdminUsers
path .../public to AdminPublic before none         # opt-out
```

### 7.2 HTML

```html
<Router from="/admin" before=${requireAdmin}>
  <Route path=".../" to=${AdminHome}/>
  <Route path=".../users" to=${AdminUsers}/>
  <Route path=".../public" to=${AdminPublic} before=${[]}/>    <!-- opt-out -->
</Router>
```

### 7.3 Semantics

- Each guard: `(ctx: { params, route, location }) => boolean | Redirect | Promise<boolean | Redirect>`.
- Execute left-to-right, short-circuit on `false` / `Redirect`.
- `false` → global fallback (defaults to 403 route, configurable).
- `Redirect(url)` → replace navigation with `url`.
- `before none` / `before=${[]}` — opt out of every inherited guard.
- Inheritance order: router-level guards first (outermost → innermost), then route-level.

## 8. Status codes

```dtx
path /gone to Gone status 410
path ** to NotFound status 404
```

```html
<Route path="/gone" to=${Gone} status="410"/>
<Route path="**" to=${NotFound} status="404"/>
```

- Client-side: informational; used for `history.state.__uidetox_status` and hooks (`onStatusChange`).
- Server-side (Phase 2c hook-in): the SSR renderer respects it in the HTTP response.

## 9. Page Metadata

Fields are gated by **explicit inheritance** — a component declares which surfaces it can touch.

### 9.1 Interfaces

| Interface | Allowed fields |
|---|---|
| `PageTitle` | `title` |
| `PageMetadata` | `meta`, `og`, `rel` |
| `PageAssets` | `scripts`, `styles`, `preloads` |
| `PageStructuredData` | `structuredData` (JSON-LD) |

A component can extend any combination.

### 9.2 Declaration in `.md` frontmatter

```md
---
name: Home
tag: page-home
extends: [PageTitle, PageMetadata, PageAssets]
title: "Home | UIDetox"
meta:
  description: "HTML-first Web Components framework"
og:
  title: "Welcome to UIDetox"
  image: "/assets/og.png"
scripts:
  - "https://analytics.example.com/tag.js"
styles:
  - "https://cdn.example.com/theme.css"
---
```

### 9.3 Declaration in `.dtx` component (Phase 2e, but syntax fixed here)

```dtx
component AppHome tag "page-home" extends [PageTitle, PageMetadata]
title "Home | UIDetox"
meta name "description" content "HTML-first Web Components framework"
og title "Welcome to UIDetox"
og image "/assets/og.png"
```

### 9.4 Enforcement

Build-time:
- If any gated field is set but its interface is missing from `extends` → **build error** with the exact interface required.
- Duplicate interface entries → warning, kept.
- Unknown interfaces → error.

Runtime:
- On route mount, the router resolves metadata from the component, updates `<head>` (title, meta tags, JSON-LD), lazy-loads any declared scripts/styles.
- On route unmount, script/style handles are optionally released (per-config).

## 10. Multi-Module Aggregation

Build steps:

1. **Discover.** Walk the project tree for:
   - `routes.md` files anywhere under `pages/`, `plugins/*/`, or the user-configured `routeSources`.
   - `.dtx` files containing a `router` declaration.
2. **Resolve priorities.** Each `router` may declare `priority <n>` (default 50). Higher wins on identical patterns.
3. **Compose.** For each source, apply its `from "…"` mount prefix. Nested `<Router>` inside a `routes.md` composes with its parent by concatenation.
4. **Emit.** Write the merged routes table to `.uidetox/cache/routes.gen.ts` as:
   ```ts
   export const routes: RouteEntry[] = [
     { path: '/',          handler: Home,       paramsSchema: {},                 priority: 50, guards: [],                     status: null, meta: { title: 'Home' } },
     { path: '/users/',    handler: UsersList,  paramsSchema: {},                 priority: 50, guards: [],                     status: null, meta: {} },
     { path: '/users/:id', handler: UserProfile,paramsSchema: { id: {…} },        priority: 50, guards: [],                     status: null, meta: {} },
     { path: '/admin',     handler: lazy(Admin),paramsSchema: {},                 priority: 60, guards: [requireAdmin],         status: null, meta: {} },
     { path: '/gone',      handler: Gone,       paramsSchema: {},                 priority: 50, guards: [],                     status: 410,  meta: {} },
     { path: '/**',        handler: NotFound,   paramsSchema: {},                 priority: 0,  guards: [],                     status: 404,  meta: {} },
   ];
   ```
5. **Watch.** In dev mode, regenerate on change; hot-reload the router.

Match order: sort by (specificity DESC, priority DESC). Specificity is a tuple (segment count DESC, static-segment count DESC, catch-all count ASC).

**Disable** a router without deleting it:
```dtx
router disabled
path / to Wip
```

Skipped by the collector.

## 11. Router API

```ts
interface Router {
  goto(url: string, opts?: { replace?: boolean; state?: unknown }): Promise<void>;
  replace(url: string): Promise<void>;
  back(): void;
  forward(): void;
  currentLocation(): Location;                   // reactive via Registry
  onBeforeNavigate(fn: NavigationHook): Unsubscribe;
  onNavigated(fn: NavigationHook): Unsubscribe;
  onError(fn: (err: NavigationError) => void): Unsubscribe;
}
```

Global instance provided via `registry.provide(routerToken, router)` at bootstrap.

## 12. Renderer

Router owns a **mount point** in the DOM — a `<router-outlet>` custom element that the runtime injects into the page. On navigation:

1. Match URL → route entry.
2. Run guards.
3. If component is `lazy` → fetch chunk.
4. Instantiate the component (Custom Element), pass `params` as attributes / properties, insert into `<router-outlet>` (replacing prior content).
5. Apply metadata (title, `<head>` mutations).
6. Fire `onNavigated`.

Transitions between routes: default is instant swap. View Transitions API (`document.startViewTransition`) is enabled behind `router transitions on` (opt-in) — Phase 2 nice-to-have, MVP ships without.

Nested routes: nested `<Route>` inside a `<Router>` inject their child components into the parent's `<slot/>` (parent component acts as layout).

## 13. Full Example — DSL

`app/router.dtx`:

```dtx
from "./pages/Home.md" import Home
from "./pages/UsersList.md" import UsersList
from "./pages/UserProfile.md" import UserProfile
from "./pages/UserEdit.md" import UserEdit
from "./pages/admin/AdminHome.md" import Admin
from "./pages/Gone.md" import Gone
from "./pages/NotFound.md" import NotFound
from "./guards.dtx" import requireAuth, requireAdmin, canEditUser
from "./filters.dtx" import is_positive

router export slashPolicy narrowing
path / to Home
path /index to Home                                                # explicit alias
path /users/ to UsersList
path /users/:id to UserProfile where :id is number filter is is_positive
path /users/:id/edit to UserEdit before requireAuth, canEditUser where
  :id is number filter is is_positive
path /admin to lazy Admin before requireAdmin
path /gone to Gone status 410
path ** to NotFound status 404
```

## 14. Full Example — HTML

`app/routes.md`:

```md
---
name: AppRoutes
---

```html template
<Router mode="history" slashPolicy="narrowing">
  <Route path="/"       to=${Home}/>
  <Route path="/index"  to=${Home}/>

  <Route path="/users" to=${UsersLayout}>
    <Route path=".../" to=${UsersList}/>
    <Route path=".../:id" to=${UserProfile}>
      <param :id="number" filter=${is_positive}/>
    </Route>
    <Route path=".../:id/edit" to=${UserEdit} before=${[requireAuth, canEditUser]}>
      <param :id="number" filter=${is_positive}/>
    </Route>
  </Route>

  <Route path="/admin" to=${lazy(Admin)} before=${requireAdmin}/>

  <Route path="/gone" to=${Gone} status="410"/>
  <Route path="**"    to=${NotFound} status="404"/>
</Router>
```
```

## 15. File Layout Additions

```
src/
  compiler/
    dtx/
      router.ts             # NEW — router-verb parser (extends dtx grammar from Phase 1c)
    routes/
      html.ts               # NEW — <Router>/<Route>/<param> transform for routes.md
      collect.ts            # NEW — discover + merge multi-module route tables
      codegen.ts            # NEW — emit routes.gen.ts
    metadata/
      collect.ts            # NEW — read component frontmatter + validate PageMetadata inheritance
  runtime/
    router/
      define.ts             # NEW — defineRouter, table storage
      match.ts              # NEW — pattern → params engine (path-to-regexp fork or hand-rolled)
      navigate.ts           # NEW — goto/replace/back/forward
      guards.ts             # NEW — guard chain executor
      outlet.ts             # NEW — <router-outlet> Custom Element
      metadata.ts           # NEW — apply <head> mutations per route
    index.ts                # MODIFIED — re-export router primitives + tokens
  cli/
    build.ts                # MODIFIED — invoke routes/collect + metadata/collect
tests/
  compiler/routes/…
  runtime/router/…
  e2e/router-basics.test.ts
```

## 16. Phase Plan Interaction

- **Phase 2c (SSR)** — hooks into router: `renderRoute(url, req)` → HTML + status. Same route table.
- **Phase 2a (`<while>`/`<include>`/`<lazy-load>`)** — independent; can proceed in parallel.
- **Phase 2d (DSL inheritance / `off` / C3)** — required by Phase 2e (`component` DSL) but only tangentially by routes (no route inheritance yet).
- **Phase 2e (`component` DSL)** — the `component AppHome extends [PageTitle, PageMetadata]` shape is fixed here; Phase 2e implements the DSL runtime.

## 17. Open Questions (deferred)

- **Loaders** (`load()` per route running before render) — Phase 2 later.
- **Query-string** and hash-fragment param typing — Phase 2 later; MVP exposes raw `location.search` / `location.hash` from `currentLocation()`.
- **Route transitions animation** (`View Transitions`) — after MVP, opt-in.
- **`route` verb** (per-route `.dtx` declaration outside a `router` block) — deferred, not needed for parity.
- **`disabled` router precedence** with feature flags — Phase 3+ feature-flag mechanism.

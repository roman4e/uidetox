# UIDetox Phase 2a — `<include>` and `<lazy-load>` Directives

**Status:** Draft (v0.1)
**Date:** 2026-07-02
**Depends on:** `2026-07-01-uidetox-design.md`, Phase 0 (template compiler), Phase 2b (router runtime for `<lazy-load>` component resolution).
**Owner:** roman4e@gmail.com

## 1. Purpose

Add two new virtual directives to the template language: `<include>` for compile-time inlining of partial templates and `<lazy-load>` for runtime dynamic loading of components. `<while>` and `<until>` are explicitly out of scope — no realistic UI use case surfaced.

## 2. Non-Goals

- `<while>` / `<until>` directives — dropped.
- SSR integration for `<lazy-load>` — Phase 2c.
- Streaming rendering — future.

## 3. `<include>` Directive

### 3.1 Grammar

```html
<include src="./partials/header.html"/>
```

- Self-closing virtual directive; no runtime tag.
- `src` is a **build-time literal string** — no expressions, no dynamic paths.
- Path resolution: relative to the enclosing `.md` file's directory.

### 3.2 Compile-time behaviour

1. Compiler reads the target file.
2. Content is parsed as if it were part of the outer template — same rules, same expressions, same scope.
3. Included nodes replace the `<include>` element in the AST.
4. Cyclic includes → build error with a chain trace.

### 3.3 Supported source formats

| Extension | Semantics |
|---|---|
| `.html` | Raw HTML fragment; parsed with the template parser. |
| `.md` (SFC) | The `html template` block is extracted and inlined. `ts script`, `css style`, and other blocks are **ignored** — an include is a template splice, not a component instantiation. Use `<TagName/>` (Custom Element) if you want the component. |

### 3.4 Scope

- Included nodes see the **caller's** scope (`item`, `index`, `props`).
- No new scope introduced by `<include>`.

### 3.5 Errors

- Missing file → build error.
- Cyclic include chain → build error with chain listing.
- Included template contains its own `<include>` — recursive resolution up to depth 10 (config).

## 4. `<lazy-load>` Component

### 4.1 Grammar

```html
<lazy-load src="./Heavy.md" trigger="visible" placeholder="skeleton" prefetch/>
```

Attributes:

| Attribute | Type | Meaning |
|---|---|---|
| `src` | string literal | Path to a `.md` component (default export). |
| `trigger` | `'visible' \| 'eager' \| 'interaction' \| 'manual'` | When the chunk is fetched. Default: `'visible'`. |
| `placeholder` | string \| tag name | What to render before the chunk resolves (skeleton, spinner, custom tag). |
| `prefetch` | flag | Fetch the chunk on browser-idle, but wait for `trigger` before mounting. |
| `on-load` | expression `${fn}` | Callback fired when the component mounts. |
| `on-error` | expression `${fn}` | Callback when fetch fails. |

### 4.2 Trigger semantics

- **`visible`** — IntersectionObserver on the placeholder element; chunk fetched when it enters the viewport.
- **`eager`** — Fetch on `connectedCallback` immediately.
- **`interaction`** — Fetch on first `pointerenter` / `focusin` on the placeholder.
- **`manual`** — Consumer calls `element.load()` explicitly (imperative escape hatch).

### 4.3 Runtime tag

`<lazy-load>` **is** a real Custom Element — unlike `<if>`/`<for>`/`<include>`, it remains in the DOM because it owns its placeholder slot and needs an anchor for the IntersectionObserver.

### 4.4 Placeholder resolution

- `placeholder="skeleton"` → renders `<Skeleton/>` if a Skeleton component is globally registered; otherwise a bare `<div class="uidetox-skeleton"/>`.
- `placeholder="my-loader"` → renders that Custom Element tag.
- Slot fallback: any children inside `<lazy-load>` before the chunk resolves are shown as placeholder content.

### 4.5 Prefetch

If `prefetch` is set:
- On `connectedCallback`, schedule `requestIdleCallback(() => import(src))`.
- The Promise is cached; `trigger` awaits the same Promise instead of firing a second fetch.

### 4.6 Error surface

On fetch failure:
1. Fire `on-error` callback (if any).
2. Render error placeholder if declared (`<lazy-load>` inner `<template slot="error">…</template>`), else keep placeholder.
3. Expose retry via `element.load()`.

### 4.7 Component instantiation

Fetched module's default export is expected to be either:
- A `defineComponent` side-effecting module — its Custom Element tag is read from the component's descriptor (declared in the SFC frontmatter's `tag:` field, embedded in the emitted module as a `__tag` export).
- A `defineRouter`-style handler — same shape as a route handler; instantiated identically.

The runtime prefers the `__tag` field for Custom-Element instantiation, falls back to calling the exported handler as a factory.

## 5. Interaction with Phase 2b Routing

- Route handlers can be `lazy(...)` (already implemented in Phase 2b) — that's a separate mechanism (per-route chunk).
- `<lazy-load>` is scoped to a template, not a route. A single page may have multiple `<lazy-load>` islands.
- If `<lazy-load>` chunks a route-component and the same component is later matched by the router, the module is deduped by URL.

## 6. File Layout Additions

```
src/
  compiler/
    template/
      include.ts             # NEW — resolve <include src=…>, splice AST
    fs.ts                    # NEW — build-time file reader with cache + cycle detection
  runtime/
    lazyLoad/
      element.ts             # NEW — <lazy-load> Custom Element
      triggers.ts            # NEW — visible / eager / interaction / manual + prefetch
      loader.ts              # NEW — dynamic import cache
    index.ts                 # MODIFIED — export registerLazyLoad()
tests/
  compiler/template/include.test.ts
  runtime/lazyLoad/element.test.ts
  runtime/lazyLoad/triggers.test.ts
examples/
  include/
    routes.md
    partials/header.html
    pages/Home.md
  lazyload/
    App.md
    Heavy.md
```

## 7. Implementation Notes

### 7.1 Include cycle detection

Track an in-progress set keyed by absolute file path. On enter push; on exit pop. If a path is already in the set → error with the chain.

### 7.2 `<include>` inside `<lazy-load>`?

Allowed. `<include>` resolves during the initial compile of the parent template; the resulting inlined nodes travel with the chunk when the parent module is bundled.

### 7.3 Debug builds

Debug renders `<u-include src="…"/>` markers (comment-attribute variant) around the spliced region for DevTools inspection.

## 8. Open Questions (deferred)

- Query-string / hash on `src` for cache-busting — Phase 2c.
- Priority hints for `prefetch` (`importance="low"`) — future.
- Streaming component (progressive hydration inside lazy chunks) — Phase 3.

# UIDetox Phase 2c — SSR + Hydration

**Status:** Draft (v0.1)
**Date:** 2026-07-03
**Depends on:** Phase 0 (runtime), Phase 2b (routing).

## 1. Purpose

Add `renderToString(node, ctx)` for server-side HTML output and `hydrate(root, ctx)` for client-side reactivity attachment to existing DOM.

## 2. Non-Goals

- Streaming rendering — future.
- Islands / partial hydration — future.
- Server-only components — future.

## 3. API

- `renderToString(componentTag: string, attrs: Record<string, string>): string` — renders a Custom Element and its subtree to serialised HTML. Runs component `boot` synchronously in a jsdom-like fake DOM to produce the HTML.
- `hydrate(root: Element, ctx?: HydrationContext): void` — walks existing DOM, boots each Custom Element in place (does not re-render).

## 4. Design

- Server: a tiny fake-DOM module (`src/runtime/ssr/fake-dom.ts`) implements just enough Element/Text/HTMLElement to run `defineComponent` boot code. `renderToString` mounts the CE via `document.createElement` semantics on this fake DOM and serialises to HTML.
- Client: `hydrate` iterates existing custom elements bottom-up and calls their `connectedCallback` (which triggers boot). Reactive bindings attach to existing text/element nodes rather than replacing them.

## 5. File Layout

```
src/runtime/ssr/
  fake-dom.ts               # minimal Element/Text
  render.ts                 # renderToString
  hydrate.ts                # hydrate
tests/runtime/ssr/
  render.test.ts
  hydrate.test.ts
```

## 6. Open Questions

- Exact fake-DOM completeness — MVP: enough for the Phase 0 helpers (`__el`, `__text`, `__bind`, `__if`, `__for`).

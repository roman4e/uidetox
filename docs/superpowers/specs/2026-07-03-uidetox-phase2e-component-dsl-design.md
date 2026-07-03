# UIDetox Phase 2e — `component` DSL Verb

**Status:** Draft (v0.1)
**Date:** 2026-07-03
**Depends on:** Phase 1c-a (DSL preprocessor), Phase 2d (inheritance + off).
**Owner:** roman4e@gmail.com

## 1. Purpose

Extend the DSL with `component <Name>` — authors can write components in `.dtx` files instead of Markdown SFCs, keeping the same runtime (`defineComponent`). Markdown SFC remains supported; the two co-exist.

## 2. Non-Goals

- Auto-migrating existing `.md` components to `.dtx` — manual.
- Removing Markdown SFC — kept alongside.
- Full DevTools support for `.dtx` components — Phase 1d.

## 3. Grammar

```dtx
component AppCard export tag "app-card" extends [PageTitle, PageMetadata]
props (string title, boolean? highlighted)
state (boolean hover = false)
title "AppCard | UIDetox"

template {
  <div class="card" @click=${onClick}>
    <h2>${props.title}</h2>
    <slot/>
  </div>
}

style scoped {
  .card { padding: 1rem; }
  .card:hover { background: var(--surface-hover); }
}

actions {
  function onClick() {
    console.log('clicked', props.title);
  }
}
```

### 3.1 Clauses

| Clause | Shape | Meaning |
|---|---|---|
| `tag` | `tag "<kebab>"` | Custom Element tag |
| `extends [A, B]` | list-of-refs | Multi-inheritance (Phase 2d) |
| `export` | flag | Emit as `export const` |
| `props` | `props (<type> <name>, …)` | Typed props declaration |
| `state` | `state (<type> <name> = <default>, …)` | Initial reactive state |
| `title` | `title "<literal>"` | PageTitle (only valid when `extends [PageTitle]`) |
| `emits` | `emits (<name>: <type>, …)` | Typed custom events |

### 3.2 Members (sub-blocks)

| Member | Shape | Body kind |
|---|---|---|
| `template { <html> }` | template body | HTML — parsed via existing template compiler |
| `style [scoped] { <css> }` | style body | CSS |
| `actions { <ts> }` | actions body | TS — declares handlers accessible in template |
| `effects { <ts> }` | effects body | TS — `effect()` calls, `state()` extra |

Only one of each sub-block per component.

## 4. Emit Shape

The preprocessor emits a call to `defineComponent`:

```ts
export const AppCard = defineComponent({
  tag: 'app-card',
  props: ['title', 'highlighted'],
  boot: (ctx) => {
    const { props, host } = ctx;
    const s = state({ hover: false });
    function onClick() { console.log('clicked', props.title); }
    return __el('div', [['class', 'static', 'card'], ['@click', 'event', () => (onClick)]], [
      __el('h2', [], [__bind(__text(''), 'text-content', '', () => (props.title), ctx)], ctx),
      __el('slot', [], [], ctx),
    ], ctx);
  },
  style: '.card { padding: 1rem; } .card:hover { background: var(--surface-hover); }',
});
```

## 5. File Layout Additions

```
src/compiler/dtx/
  component.ts             # NEW — component-specific emitter (uses template compiler)
  parse.ts                 # MODIFIED — recognise `component` verb + sub-block members
  types.ts                 # MODIFIED — Verb widened to 'component'
  emit.ts                  # MODIFIED — dispatch to component.ts for `component` verb
tests/compiler/dtx/component-parse.test.ts
tests/compiler/dtx/component-emit.test.ts
tests/e2e/dtx-component-basic.test.ts
examples/dsl/components/AppCard.dtx
```

## 6. Non-goals expanded

- Metadata `title/meta/og` in DSL — extends `PageTitle`/`PageMetadata` semantics fixed in Phase 2b spec §9; DSL emits validated at build time. This spec fixes the DSL surface; Phase 1b wires the doc site.
- Nested slots, named slots — inherited from Phase 0.

## 7. Open Questions (deferred)

- Sub-block `test { … }` for embedded tests — Phase 1a Markdown SFC handles it; DSL variant is Phase 1b.
- Emit of PageTitle/PageMetadata fields — same validator as Phase 2b, wired via emit.
- Whether to preserve source-map offsets for sub-block bodies — future.

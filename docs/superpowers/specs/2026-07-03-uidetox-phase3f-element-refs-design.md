# UIDetox Phase 3f — Element Refs & Component DOM Access

**Status:** Draft (v0.1)
**Date:** 2026-07-03
**Depends on:** Phase 0 (template compiler, defineComponent), Phase 3b (DOM).

## 1. Purpose

Give components handles to their own rendered elements (auto-bound), a way to query their subtree, and functional access to named refs — without React-style `ref` ceremony.

## 2. Auto-Binding (hybrid)

- **`name` / `id` static attributes auto-bind.** `<input name="email"/>` → `refs.email`. `<div id="panel">` → `refs.panel`. The attribute VALUE is the ref key, camel-cased (`user-email` → `userEmail`).
- **`#name` explicit marker.** `<button #submit-btn>` → `refs.submitBtn`. Camel-cased. Use when the element has no meaningful `name`/`id`.
- **`#${expr}` computed marker.** `<li #${'row-' + i}>` → `refs['row-' + i]` — ref key computed at build time from the expression.
- **Precedence:** explicit `#` wins over `name`/`id`. If both `name` and `id` are present and no `#`, `name` wins.

## 3. Boot Scope

`boot(ctx)` — and therefore `actions` / `effects` / `script` blocks — see these injected names:

| Name | Type | Meaning |
|---|---|---|
| `refs` | `Record<string, Element>` | populated during template construction |
| `ref(name)` | `(name: string) => Element \| undefined` | functional lookup (handy for computed keys) |
| `find(sel)` | `(sel: string) => Element \| null` | `host.querySelector` |
| `findAll(sel)` | `(sel: string) => Element[]` | `host.querySelectorAll` as array |

`refs` is populated synchronously while the template expression evaluates. In `component` DSL emit the template is built before `effects` run, so effects observe refs. Event handlers (`actions`) always observe them (they run post-mount).

## 4. Runtime

- `TemplateCtx` gains `refs`, `ref`, `find`, `findAll`.
- `__ref(ctx, nameOrExpr, el)` — registers `el` into `ctx.refs[key]` and returns `el`.
- `defineComponent` constructs `ctx.refs = {}` and binds `ref`/`find`/`findAll` to the host.

## 5. Compiler

- Template parser extracts, per element: a static ref key (from `#name`, else static `name`, else static `id`) or a computed ref expression (from `#${expr}`), preserving author casing via a start-tag source rescan.
- Codegen wraps the element's `__el(...)` in `__ref(ctx, <key-or-expr>, __el(...))` when a ref is present.

## 6. Non-Goals

- Cross-component ref access (reaching into another component's refs) — future.
- Ref lifecycle callbacks (`onMount`/`onUnmount` per element) — future.

## 7. File Layout

```
src/runtime/component.ts     # ctx.refs/ref/find/findAll
src/runtime/domHelpers.ts    # __ref
src/compiler/template/ast.ts # TplElement.refKey / refExpr
src/compiler/template/parse.ts   # extract # markers + name/id
src/compiler/template/codegen.ts # wrap __el with __ref
src/compiler/dtx/component.ts    # destructure refs/find in boot; build template before effects
tests/...
```

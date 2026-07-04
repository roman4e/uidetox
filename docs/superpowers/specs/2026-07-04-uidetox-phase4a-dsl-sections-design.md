# UIDetox Phase 4a — Section-Based DSL Grammar

**Status:** Draft (v0.1)
**Date:** 2026-07-04
**Depends on:** Phase 1c (dtx parser/emitter), Phase 2d (inheritance), Phase 2e (component DSL).
**Migration:** This replaces the brace-based `component`/section syntax. The build is alpha; existing `.dtx` sources and tests are migrated in-place.

## 1. Purpose

Move large DSL bodies (`tpl`, `script`, `actions`, `effects`, `style`, `props`) from brace-delimited `{ }` blocks to line-based **section** members with optional `end <name>` closing. Add top-level `declare` for shared reusable members, unify imports to JS style, distinguish `script` (private boot) from `actions` (public host methods), and read config from `detox.toml`.

## 2. Two Member Kinds

- **Section member** — `<keyword> [modifiers]` on its own line, followed by a raw body (HTML/CSS/TS), terminated by the next member/verb keyword line, an explicit `end <keyword>`, or EOF. No brace counting — robust against `}`/`{` in the body.
- **Signature member** — `<keyword> <args> <name>() { <ts> }` inline. The `{ }` is a TypeScript function body (brace-balanced). Used by `on`/`off`/`transform`/`default`.
- **Property member** — `.<name> = <expr>` on one line.

## 3. Structure Levels

### Level 0 (top-level)
- `import <names> [from <path>]`
- `declare <member-kind> <name>` … (named reusable member)
- `component` / `trait` / `filter` / `token` / `provide` / `router`

Declarations end implicitly at the next Level-0 keyword or EOF; `end <verb>` is optional.

### Level 1 (declaration members)
- **Section:** `props`, `tpl` (alias `template`), `script`, `actions`, `effects`, `style [scoped]`
- **Signature:** `on <event> <name>() { }`, `off <event> <name>()`, `transform [<name>]() { }`, `default <name>() { }`
- **Property:** `.<name> = <expr>`

### Both levels
- `import`

## 4. Keyword Sets (auto-close triggers)

A section body terminates when a line's first word is one of:
`component trait filter token provide router declare import props tpl template script actions effects style on off transform default end`

`tpl` == `template` (both accepted). A member keyword only triggers termination when it is the first word of a line; body lines whose first token is not a keyword (HTML `<…>`, CSS `.…`, most TS) do not terminate. Use explicit `end <name>` to disambiguate rare collisions.

## 5. `declare`

Promotes a Level-1 member to a named Level-0 reusable:

```
declare tpl card-header
<header><slot/></header>
end tpl

declare style surface
.surface { border-radius: 8px; }
end style

declare props pagination
number page
number? perPage 20
end props

declare script analytics-mixin
function track(ev) { window.analytics?.(ev); }
end script
```

Consumption inside a declaration:
- `props use <name>` — reuse a declared props schema.
- `style use <name>` — apply a declared style.
- `<include tpl <name>/>` — splice a declared template.

## 6. `script` vs `actions`

- **`script`** — private boot logic. Executed top-to-bottom on mount (state init, effect setup). Not exposed.
- **`actions`** — public methods. Named functions that are (a) callable from the template and (b) attached to the host Custom Element instance, forming the imperative API:

```ts
document.querySelector('app-counter').inc();
```

The emitter collects `function <name>(…)` declarations from the `actions` body and, after building the template, assigns each to `host[name]`.

## 7. Import Unification

- `import Home from "./pages/Home.md"` — explicit path.
- `import trim, numeric-only from "./traits.dtx"` — multiple named.
- `import big-number` — no `from`: the resolver searches by name.

`from X import Y` is removed. Emitter lowers to standard `import { … } from "…"` (names camel-cased).

## 8. Resolver (`detox.toml`)

Search order for `import big-number` (no `from`):
1. Current file's directory.
2. Current working directory.
3. Each path in `resolve.includes` from `detox.toml`.

By filename: `app-counter` → `app-counter.dtx`, then `app-counter.md`. Extensions from `resolve.extensions` (default `.dtx`, `.md`).

Config file: `detox.toml` (primary), `detox.json` (fallback). Parsed with `smol-toml`.

```toml
[resolve]
includes = ["src/components", "shared"]
extensions = [".dtx", ".md"]

[build]
outDir = "dist"
```

## 9. Full Example

```
component Counter export tag app-counter

props
number start
end props

import big-number

script
const s = state({ count: props.start ?? 0 });
effect(() => document.title = "Count: " + s.count);
end script

actions
function inc() { s.count++; }
function dec() { s.count--; }
end actions

tpl
<div class="counter">
  <button #dec @click=${dec}>-</button>
  <big-number>${s.count}</big-number>
  <button #inc @click=${inc}>+</button>
</div>
end tpl

style scoped
.counter { display: flex; gap: 1rem; }
end style

end component
```

## 10. Migration Plan

- `component` DSL parser/emitter (Phase 2e) rewritten for sections.
- `import` syntax flipped across the codebase; existing `.dtx` examples + tests updated.
- Trait/filter/token/provide keep signature members + clauses; only their `import`/`end` handling gains the new rules.

## 11. Non-Goals

- Cross-file `declare` resolution (declared members imported from another file) — a follow-up; MVP resolves declares within the same file.
- Config-driven build pipeline beyond resolve — later.
- `props use` merge with local props conflict resolution rules beyond last-wins — later.

## 12. File Layout

```
src/compiler/dtx/
  lines.ts          # NEW — line scanner: declarations, members, section bodies
  parse.ts          # MODIFIED — section-aware; header + signature via tokenizer
  types.ts          # MODIFIED — Member.kind adds section kinds; Declaration adds `declare`
  emit.ts           # MODIFIED — import flip; actions→host methods; declare
  component.ts      # MODIFIED — build from section members
  resolve.ts        # NEW — name resolver + detox.toml/json loader
tests/compiler/dtx/
  sections-parse.test.ts
  sections-emit.test.ts
  resolve.test.ts
```

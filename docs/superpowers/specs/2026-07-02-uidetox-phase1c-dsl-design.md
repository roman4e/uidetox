# UIDetox Phase 1c — DSL for Traits, Filters, Tokens, and Providers

**Status:** Draft (v0.1)
**Date:** 2026-07-02
**Depends on:** `2026-07-01-uidetox-design.md`, `2026-07-01-uidetox-phase1a-testing-design.md` (Registry).
**Owner:** roman4e@gmail.com

## 1. Purpose

Give UIDetox its own declarative language — `.dtx` — for authoring traits, filters, tokens, and providers. The language is SQL-like at the surface (`verb name clause* members*`) and TypeScript-native in bodies. A preprocessor lowers `.dtx` to standard TypeScript with matching source maps, so `import`, type checking, breakpoints, and stack traces all work against the author's original source. The DSL replaces the earlier fenced-block trait discussion — traits (and their siblings) live in `.dtx` files or in fenced `dtx` blocks inside SFC files, never as ad-hoc `defineTrait({...})` calls.

## 2. Non-Goals (Phase 1c)

- **`off <event> name()` / handler removal** — Phase 2.
- **`extends [a, b]` inheritance + Python-C3 linearization** — Phase 2.
- **`component <Name> ...` DSL** — Phase 2 (components remain Markdown SFC).
- **`route <path>` DSL** — Phase 2.
- **LSP server + VSCode / JetBrains editor extensions** — Phase 1d.

## 3. File Format

- **`.dtx` file** — a text file whose whole content is UIDetox DSL. Can hold any number of top-level declarations.
- **Fenced `` ```dtx `` block** — inside a Markdown SFC file, treated identically to a `.dtx` source. Multiple declarations per block allowed.

Both formats share the same grammar. The fenced form lets a component ship its own private traits without introducing a new file.

## 4. Grammar

### 4.1 Top-level structure

```
<file> := (<import> | <declaration>)*
<declaration> := <verb> <name> <clause>* <member>*
```

Verbs (Phase 1c): `trait`, `filter`, `token`, `provide`.

A declaration ends when the next verb keyword appears, when the end of the file (or fenced block) is reached. No explicit terminator.

### 4.2 Identifiers

- **Declaration names** are **kebab-case** (`numeric-only`, `to-lowercase`, `theme-token`). This is the surface name in templates (`use="numeric-only"`) and imports (`from "..." import numeric-only`).
- **TypeScript identifiers** in emitted output are **camelCase** (`numericOnly`, `toLowercase`, `themeToken`). The preprocessor performs the mapping.
- **Parameter names, property names, and method names** inside declaration bodies are camelCase JavaScript identifiers.

### 4.3 Clauses

Each clause is atomic — either fully parameterized or bare. Clauses can appear inline on the header line or on separate continuation lines; order is free.

Forms:

| Shape | Example | Meaning |
|---|---|---|
| `<key>` | `export` | Boolean flag |
| `<key> <type>` | `input string`, `output number` | Single typed value (C-style: type first) |
| `<key> [<item>, <item>, ...]` | `appliesto [input, textarea]` | List |
| `<key> (<param>, <param>, ...)` | `params (string savedKey?, boolean allowNegative false)` | Parameter list |
| `<key> <target>` | `from system-theme` | Free single token |

Parameter form inside `params (...)`:

```
<type>[?] <name> [<default-value>]
```

- `type` — TypeScript type name (e.g., `string`, `number`, `boolean`, `MyType`).
- `?` after the type marks optional (compiles to `type | undefined`).
- Default value — string literal, number literal, boolean, or `null`/`undefined`. Anything richer is a compile-time error in v0.1 — declare a property (`.foo = ...`) instead.

### 4.4 Members

Members are the "body" of a declaration. Each member is one of:

| Shape | Example | Applies to |
|---|---|---|
| `on <event> <name>() { <ts> }` | `on blur trim_handler() {...}` | `trait` |
| `on <event> () { <ts> }` | `on blur () {...}` | `trait` (anonymous handler) |
| `transform <name>() { <ts> }` | `transform lc() {...}` | `filter` |
| `transform () { <ts> }` | `transform () {...}` | `filter` (anonymous) |
| `default <name>() { <ts> }` | `default resolveTheme() {...}` | `provide` |
| `.<prop> = <ts-expr>` | `.saved_at = 0` | `trait`, `filter` |

TS bodies are handed to the TypeScript compiler unchanged. The preprocessor only wraps them in the correct method / callback shape and applies a matching `this` type.

### 4.5 The `this` scope inside bodies

Every method body sees a strongly typed `this`:

| Expression | Type | Available on |
|---|---|---|
| `this.el` | element type derived from `appliesto` | `trait` handlers |
| `this.event` | matching DOM event type for the current `on <event>` | `trait` handlers |
| `this.params.<name>` | typed from `params (...)` | all bodies |
| `this.<propName>` | typed from `.<propName> = ...` (inferred) | all bodies |
| `this.<methodName>()` | as declared | `trait` / `filter` / `provide` |
| `this.$transformers` | `Array<(v: <input>) => <output>>` | `filter` bodies only |

For `filter transform`, an implicit `v: <input>` parameter is injected — the body is a function of the input value.

### 4.6 Imports

```
<import> := 'from' <string-path> ['import' <import-list>]
<import-list> := <item> (',' <item>)*
<item> := <name> ['as' <alias>]
```

Examples:

```dtx
from "../traits/inputs.dtx" import trim, numeric-only
from "../traits/inputs.dtx" import trim as input-trim
from "../filters/text.dtx" import money
from "../traits/registered-globals.dtx"        # side-effect (register globally, no local binding)
```

Preprocessor emits standard TypeScript imports:

```ts
import { trim, numericOnly } from '../traits/inputs.dtx';
import { trim as inputTrim } from '../traits/inputs.dtx';
import { money } from '../filters/text.dtx';
import '../traits/registered-globals.dtx';
```

### 4.7 Exports

Every declaration is module-private by default. Prefix with the `export` clause (any position among clauses) to expose it:

```dtx
trait trim export appliesto [input, textarea]
on blur trim_handler() { ... }

trait _helper appliesto [input]           # no export → module-private
on click () { ... }
```

Both forms produce top-level `const`s in the emitted TS; `export` becomes `export const`.

## 5. Full Example — `traits/inputs.dtx`

```dtx
trait trim export appliesto [input, textarea] params (string? savedKey)
.saved_at = 0
on blur trim_handler() {
  this.el.value = this.el.value.trim();
  this.saved_at = Date.now();
  if (this.params.savedKey) {
    localStorage.setItem(this.params.savedKey, this.el.value);
  }
}
on focusout log_handler() {
  console.log('focusout at', this.saved_at);
}

trait numeric-only export appliesto [input] params (boolean allowNegative false)
on beforeinput validate() {
  const e = this.event as InputEvent;
  const pattern = this.params.allowNegative ? /^-?[0-9]*$/ : /^[0-9]*$/;
  if (e.data && !pattern.test(e.data)) e.preventDefault();
}

trait _log-focus appliesto [input, textarea, select]
on focus log-focus() { console.log('focus', this.el.tagName); }
```

## 6. Full Example — `filters/text.dtx`

```dtx
filter lowercase export input string output string
transform lc() {
  return v.toLowerCase();
}

filter money export input number output string params (string currency "USD", string locale "en-US")
transform () {
  return new Intl.NumberFormat(this.params.locale, {
    style: 'currency', currency: this.params.currency,
  }).format(v);
}
```

## 7. Full Example — `providers/theme.dtx`

```dtx
token theme-token export Theme

provide theme-token from system
default resolveTheme() {
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
```

## 8. Preprocessor — `.dtx` → `.ts`

### 8.1 Pipeline

1. **Tokenize** — split into keyword tokens, identifiers, clause values, method bodies (bodies pass through raw with brace matching).
2. **Parse** — build AST of imports and declarations.
3. **Emit TypeScript** through `magic-string`, preserving byte-for-byte position mapping.
4. **Generate source map** — one `.dtx.map` per output.

`magic-string` (used by Svelte, Vite, Rollup) tracks every rewrite as offset math. Downstream tools (Chrome DevTools, VSCode debug adapter, JetBrains) read the map without extra work.

### 8.2 Emit shape

For a trait:

```ts
export const trim = defineTrait('trim', {
  appliesTo: ['input', 'textarea'] as const,
  paramsSchema: { savedKey: { type: 'string', optional: true } },
  props: () => ({ saved_at: 0 }),
  handlers: {
    blur: [{
      name: 'trim_handler',
      run(this: TraitContext<HTMLInputElement | HTMLTextAreaElement, { savedKey?: string }, { saved_at: number }, 'blur'>) {
        this.el.value = this.el.value.trim();
        this.saved_at = Date.now();
        if (this.params.savedKey) {
          localStorage.setItem(this.params.savedKey, this.el.value);
        }
      },
    }],
    focusout: [{
      name: 'log_handler',
      run(this: TraitContext<HTMLInputElement | HTMLTextAreaElement, { savedKey?: string }, { saved_at: number }, 'focusout'>) {
        console.log('focusout at', this.saved_at);
      },
    }],
  },
});
```

Where `TraitContext<El, Params, Props, Ev>` gives:
- `this.el: El`
- `this.event: HTMLElementEventMap[Ev]` (per-event narrowing)
- `this.params: Params`
- `this.<prop>: Props[<prop>]` — spread on this
- Trait methods available as `this.<methodName>`.

For a filter:

```ts
export const money = defineFilter('money', {
  input: 'number',
  output: 'string',
  paramsSchema: { currency: { type: 'string', default: 'USD' }, locale: { type: 'string', default: 'en-US' } },
  transformers: [
    {
      name: null,
      run(this: FilterContext<{ currency: string; locale: string }, {}>, v: number): string {
        return new Intl.NumberFormat(this.params.locale, {
          style: 'currency', currency: this.params.currency,
        }).format(v);
      },
    },
  ],
});
```

Consumers call it as a plain function: `money(price, { currency: 'EUR' })`.

For a token / provide:

```ts
export const themeToken = createToken<Theme>('theme-token');
registry.provide(themeToken, () => {
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
});
```

## 9. Runtime API

New public exports from `ui-detox`:

- `defineTrait(name, spec)` — returns a `TraitDescriptor` plus registers with the global trait registry.
- `defineFilter(name, spec)` — returns a callable filter function plus registers.
- `TraitContext<El, Params, Props, Ev>` — type used by preprocessor for `this`.
- `FilterContext<Params, Props>` — same, for filters.
- `installTraits(root: Node, config?: InstallConfig)` — walks `root`, finds `use="..."` attributes, attaches trait handlers. Called automatically by `defineComponent` on connect.
- `applyMandatoryTraits(config: MandatoryConfig)` — sets globally applied traits by tag/selector.

Registry (already implemented in Phase 1a) — reused unchanged.

## 10. Template Integration

### 10.1 Applying a trait

```html
<input use="trim, numeric-only" type="text"/>
```

- `use="a, b"` — comma-separated list of trait names (kebab-case).
- Runtime attaches every handler in each trait to the element on mount; removes them on disconnect.
- Order — left-to-right in `use=`, then declaration order within the trait.

### 10.2 Passing params

Single trait (unambiguous):

```html
<input use="trim" :saved-key=${state.username}/>
```

Multiple traits with same-named param (disambiguation):

```html
<input use="trim, numeric-only"
       :trim:saved-key=${state.username}
       :numeric-only:allow-negative=${true}/>
```

Compiler accepts both kebab (`allow-negative`) and camelCase (`allowNegative`) forms in the template and normalizes to camelCase in the emitted setup for `params`.

### 10.3 Using filters

Filters are ordinary function calls inside `${...}`:

```html
<p>Total: ${money(total, { currency: 'EUR' })}</p>
<input .value=${lowercase(state.email)}/>
```

The imported filter is a callable — no template magic.

### 10.4 Mandatory traits

Global config:

```ts
applyMandatoryTraits({
  input: ['trim'],
  'form': ['prevent-default-submit'],
  'a[href^="http"]': ['external-link-warn'],
});
```

Scoped in a template:

```html
<scope require-on="input" trait="trim">
  <input .../>              <!-- gets trim automatically -->
  <input .../>
</scope>
```

`<scope>` is a virtual directive: no DOM presence in prod, `<u-scope>` marker in debug.

## 11. Prefix Cheat-Sheet (unchanged from Phase 0, plus `:`)

| Prefix | Semantics | Example |
|---|---|---|
| `attr="lit"` | Static string attribute | `class="card"` |
| `attr=${expr}` | Expression-valued attribute | `class=${state.cls}` |
| `@event=${fn}` | `addEventListener('event', fn)` | `@click=${handler}` |
| `.prop=${expr}` | DOM property write | `.disabled=${loading}` |
| `?bool=${expr}` | Boolean attribute (set/remove) | `?hidden=${!visible}` |
| `:param=${expr}` | Trait param (single trait) | `:saved-key=${username}` |
| `:trait:param=${expr}` | Trait param (multi-trait disambiguation) | `:trim:saved-key=${x}` |

## 12. Namespace Collisions

Two `.dtx` files may each declare `trait trim`. Rules:

1. **Local scope required.** Templates only see traits explicitly imported (via TS import in the SFC's `ts script`, or transitively via `import`s from another `.dtx`).
2. **Explicit rename on collision.** If two imports would bind the same local name, the author renames using `as`:

   ```ts script
   import { trim } from '../traits/inputs.dtx';
   import { trim as textareaTrim } from '../traits/text.dtx';
   ```

3. **Build-time diagnostic.** The preprocessor emits an error if two traits register the same **canonical registry name** without either explicit `as` alias or side-effect global import from the same source.

## 13. Debug Builds

The compiler has a `mode: 'prod' | 'debug'` option. In debug:

- Text interpolations `${expr}` produce a `<u-eval expr="...">` wrapper around the reactive text node.
- Trait application emits `<u-trait name="trim">` marker attributes on the element (`data-*` attribute variant to remain valid HTML).
- Every directive (`<u-if>`, `<u-for>`, `<u-case>`, `<u-scope>`) is present as a real element.

Prod builds strip all `<u-*>` markers — behaviour identical to Phase 0.

## 14. File Layout Additions

```
src/
  compiler/
    dtx/
      tokenize.ts             # NEW
      parse.ts                # NEW
      emit.ts                 # NEW — magic-string-based
      grammar.ts              # NEW — declaration/clause/member shapes
    testCompile.ts            # MODIFIED — recognise fenced `dtx` blocks
    compile.ts                # MODIFIED — invoke dtx pipeline for `.dtx` files and fenced blocks
    template/
      transform.ts            # MODIFIED — recognise `use=` and `:param=` on elements
      codegen.ts              # MODIFIED — wire trait attachment + filter calls
  runtime/
    traits/
      define.ts               # NEW — defineTrait, register, install
      context.ts              # NEW — TraitContext type
      install.ts              # NEW — walk element tree on mount, attach handlers
      mandatory.ts            # NEW — applyMandatoryTraits + selector matching
    filters/
      define.ts               # NEW — defineFilter, transformer chain
      context.ts              # NEW — FilterContext type
    index.ts                  # MODIFIED — re-export new APIs
  cli/
    build.ts                  # MODIFIED — accept `.dtx` files
```

## 15. Phase Plan

- **Phase 1c-a (this spec):** DSL grammar + preprocessor + runtime `defineTrait`/`defineFilter` + template `use=`/`:param=` + mandatory + `<scope>` + tests.
- **Phase 1d:** LSP server (Volar-based) + VSCode extension (TextMate grammar) + JetBrains descriptor.
- **Phase 2 (later):** `off`, `extends`, Python-C3 linearization, `component <Name>` DSL, `route <path>` DSL, browser-side test-module import path.

## 16. Open Questions (deferred)

- Should `use=` support **wildcard globs** for mandatory-like local application (`use="input-cleanup:*"`)? Not v0.1.
- **Selector-scoped mandatory** (Sass-like) beyond simple tag selectors? Not v0.1.
- Runtime perf of registering 100+ traits — acceptable via `Map`, revisit only if profiled bottleneck.
- Interaction between mandatory traits and `<scope>` — precedence? Current pick: scope wins; mandatory augments.
- Whether `params` allow object / array default values without ceremony. Not v0.1 — use `.<prop>` for structured defaults.

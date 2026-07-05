# REQ-09 — REQ-08 Vite Plugin Gaps + DSL Follow-ups

**Requested by:** Culinary frontend
**Priority:** mixed (see per-item tables)
**Follows:** REQ-08 shipped as `src/vite/*`, `docs/patterns/vite-plugin.md`,
`examples/culinary-lite/`.

## Verification of REQ-08

Reviewed against REQ-08's acceptance criteria — status per item:

| Criterion | Status |
|---|---|
| `import uidetox from 'uidetox/vite'` resolves | ✅ shipped |
| `.dtx` compiled + loaded in dev + build | ✅ shipped |
| `.md` SFCs load the same way | ✅ shipped |
| Dotted-module refs via `detox.toml` | ✅ shipped (`isDottedSpecifier`, `resolveDottedModule`) |
| File edit triggers HMR (v1: full route reload) | ✅ shipped (via `handleHotUpdate` → `full-reload`) |
| Duplicate `tag` across files is a hard error | ✅ shipped (`createTagRegistry`) |
| Source maps back to `.dtx` line numbers | ⚠️ **partial** — `.dtx` yes, `.md` returns `map: null` (`compile.ts:28`) |
| TS virtual shims allow `tsc --noEmit` | ⚠️ **partial** — `generateTsShim()` exists but is not wired into the plugin lifecycle. `tsc --noEmit` still cannot resolve `import from "pages.Login"`. See gap 9.5. |
| CSS `style scoped` through Vite CSS pipeline | ❌ **deferred** — docs explicitly say scoped-CSS extraction is a follow-up. See gap 9.1. |
| `examples/culinary-lite/` smoke project | ✅ shipped |

Everything else described in REQ-08 (esbuild plugin factory, resolver diagnostic
listing every path tried, HMR v1 = full reload) is present.

Also raised in REQ-08 §"Open questions":

| # | Question | Answer / status |
|---|---|---|
| 1 | HMR strategy | Full-route reload picked for v1 (documented) — ✅ |
| 2 | Custom Element idempotency helper | not needed under full-reload HMR — deferred, ok |
| 3 | `.md` role coverage — test blocks excluded from build | **not confirmed anywhere.** See gap 9.6. |
| 4 | Multi-config vs single `detox.toml` | single is enough — ✅ (matches impl) |
| 5 | `routes.dtx` shape — default export = `RouteEntry[]` | **not confirmed.** Smoke example uses `defineRouter` imperatively in `main.ts` and does not import a compiled `routes.dtx`. See gap 9.4. |

## Gaps to close in REQ-09

### 9.1 — `style scoped` through Vite's CSS pipeline (P0)

**Symptom:** Culinary's design tokens live in `src/theme/tokens.css` (imported
by `main.ts`). Individual component `style scoped` blocks currently ship as raw
strings appended as `<style>` under the custom element (per REFERENCE §5),
which means:

- No PostCSS (autoprefixer, nesting flatten, custom-media).
- No `@import` resolution.
- No CSS Modules integration, no hash-scoped class names.
- Prod build cannot bundle scoped CSS into `dist/assets/*.css`.

**Requested behavior:**

- The plugin extracts each `style [scoped]` body during `transform` and emits a
  `?vue-style-like` virtual CSS import from the same module: `import
  "virtual:uidetox-css/<hash>.css"`.
- Vite's built-in CSS pipeline processes that virtual file exactly like any
  imported `.css` (PostCSS, HMR).
- Scoping model:
  - `scoped`: rewrite selectors by prefixing the host tag (`app-login .btn` →
    `app-login.hydrated .btn` or similar). The exact rewrite is UIDetox's
    call; Culinary just needs consistent isolation without leakage.
  - Non-scoped: emit as-is; treated as global.
- Author-facing behavior unchanged: `.dtx` still has a `style scoped` section,
  `<style>` still ends up in the custom element (or in an authored global sheet
  — decide).

**Acceptance criteria:**

- [ ] A `.dtx` file with `style scoped` triggers PostCSS processing of that
      body when a PostCSS plugin is registered in `vite.config.ts`.
- [ ] `var(--fg)` written in `style scoped` inherits from the app's global
      `:root { --fg: … }` (i.e. the scoping algorithm does not strip
      custom-property inheritance).
- [ ] Prod build emits one CSS bundle containing every component's scoped
      styles (or per-chunk — either works).
- [ ] HMR: editing only the `style scoped` body reloads the styles without
      rerunning `script`/`onMount`. (Optional in v1 — a full-route reload is
      acceptable if scoped-CSS-only HMR is expensive.)

### 9.2 — `router` verb output shape + docs (P0)

**Symptom:** Culinary's `src/routes.dtx` uses the `router` verb declared in
REFERENCE §7 as a Level-0 top-level verb (`router AppRoutes export mode
"history" template … end template end router`), expecting to `import routes
from "routes"` in `main.ts` and hand it to `defineRouter`.

Investigation:
- REFERENCE §7 lists `router` among the top-level verbs but doesn't specify
  its emit shape.
- `examples/culinary-lite/src/main.ts` builds routes imperatively via
  `defineRouter({ routes: [...] })` in TypeScript — does **not** import a
  compiled `routes.dtx`.
- Culinary has already authored `src/routes.dtx` per REFERENCE §7 syntax.

**Requested behavior:** decide + document one of:

1. **`router` verb compiles into a `RouteEntry[]` default export** matching the
   runtime `defineRouter`'s `routes` param. Consumer writes:

   ```ts
   import routes from "routes";                // dotted, resolves to routes.dtx
   const r = defineRouter({ routes, mode: "history" });
   ```

2. **`router` verb compiles into a fully constructed `RouterInstance`** ready
   to `router.start()`. Consumer writes:

   ```ts
   import router from "routes";
   router.start();
   ```

Culinary side preference: **option 1** — keeps `mode`/guards/config in
`main.ts` where env vars are already loaded, and matches the REFERENCE snippet
in §13 that builds routes as an array.

**Acceptance criteria:**

- [ ] `router` verb is a supported compile target (either shape).
- [ ] The chosen shape is documented in REFERENCE §7 with a full example
      matching `docs/patterns/vite-plugin.md`.
- [ ] `examples/culinary-lite/` gains a `routes.dtx` (in addition to or replacing
      the current imperative wiring) — smoke test proves it works end-to-end.
- [ ] Culinary's existing `culinary-frontend/src/routes.dtx` compiles without
      change (it uses option 1 syntax).

### 9.3 — TS shim auto-integration (P1)

**Symptom:** `generateTsShim(id, source)` exists but the plugin never calls it.
Running `tsc --noEmit` on `culinary-frontend/` fails on every dotted import:

```
error TS2307: Cannot find module 'pages.Login' or its corresponding type declarations.
```

**Requested behavior:** pick ONE and ship it end-to-end:

- **A. Ambient module declarations file** written at plugin init:
  `<root>/.uidetox/dtx-shims.d.ts` contains
  ```ts
  declare module "pages.Login" { export * from "…absolute path/pages/Login.dtx"; }
  ```
  for every dotted specifier found in the source tree. User adds
  `.uidetox/dtx-shims.d.ts` to `tsconfig.json`'s `include`.

- **B. On-compile per-file emit:** every time `.dtx`/`.md` is loaded, the
  plugin writes `<root>/.uidetox/tsvirtual/<slug>.d.ts` for its dotted spec.
  Same tsconfig addition.

- **C. Vite virtual module** consumed by `vite-plugin-checker` or similar (out
  of scope for the plugin itself, but document the recipe).

Culinary preference: **A** — cheapest to consume, deterministic, works with
plain `tsc`.

**Acceptance criteria:**

- [ ] `pnpm exec tsc --noEmit` in `examples/culinary-lite/` succeeds after
      running the plugin at least once (dev or build).
- [ ] `Props` type declared in `props` section is visible on the component's
      default export.
- [ ] Docs snippet in `docs/patterns/vite-plugin.md` shows the required
      tsconfig line.

### 9.4 — Actions → host method typing (P2)

**Symptom:** REFERENCE §7 says `actions` `function foo(){}` becomes
`host.foo()`. Culinary writes `<GraphEditor>` as an island component and
external code (dev tools, tests) needs to call `host.fit()`, `host.undo()`.
Right now the shim's default export type is `(props?: Props) => HTMLElement` —
no way to reach `host.fit()` types.

**Requested behavior:** the shim also declares a per-component custom-element
interface + registers it with the global `HTMLElementTagNameMap`. Example
shim addition:

```ts
export interface GraphEditorElement extends HTMLElement {
  fit(): void;
  undo(): void;
}

declare global {
  interface HTMLElementTagNameMap {
    "graph-editor": GraphEditorElement;
  }
}
```

Names discovered by scanning `actions` section for `function <name>(...args)`
declarations; arg types → `unknown` unless annotated with TS.

**Acceptance criteria:**

- [ ] Given `actions\nfunction inc(){} end actions`, the shim exposes
      `inc(): void` on the element interface.
- [ ] `document.querySelector("app-counter")?.inc()` type-checks without an
      `as any` cast in `culinary-frontend`.

### 9.5 — `.md` source map (P2)

**Symptom:** `compile.ts:28` returns `map: null` for `.md`. Editor DevTools
show generated JS, not the authored Markdown.

**Requested behavior:** the Markdown SFC compiler emits a source map (even a
simple line-anchor one — precision on within-fence offsets is nice but not
required).

**Acceptance criteria:**

- [ ] `compileModule('X.md', src).map` is a non-null v3 sourcemap.
- [ ] Chrome DevTools "Sources" tab shows the original `.md` under the
      component's compiled file.

### 9.6 — Test-block filtering (P1)

**Symptom:** REFERENCE §6 lists `ts test`, `ts test:visual`, `ts test:a11y`,
`json fixtures`, `ts mock` as roles the compiler skips. Not confirmed by any
test or doc in the Vite plugin. Culinary needs a promise that:

- Prod builds do NOT ship test/visual/a11y/mock code (dead-code and dep
  bloat).
- Vitest builds under `uidetoxEsbuild()` DO run those blocks.

**Requested behavior:**

- Plugin has a `mode: 'dev' | 'build' | 'test'` option (or reads Vite's
  `command`/`env.MODE`).
- In `test` mode, test/fixtures/mock blocks are emitted alongside the
  component (as separate exports) so the test runner can import them.
- In `dev` and `build` modes, those blocks are stripped.

**Acceptance criteria:**

- [ ] Compiling a `.dtx` with a `ts test` block under prod build produces JS
      that does not reference the test body.
- [ ] Compiling the same file under `test` mode produces an additional
      exported `__tests` array/callable the runner can execute.
- [ ] Docs snippet showing how to wire Vitest.

### 9.7 — `uidetox dev` / `uidetox test` CLI wrappers (P3)

**Symptom:** Nice-to-have from REQ-08. Not blocking; user can hand-write
`vite.config.ts` and `vitest.config.ts`.

**Requested behavior:** ship thin wrappers so `culinary-frontend/package.json`
scripts become:

```json
"scripts": { "dev": "uidetox dev", "test": "uidetox test", "build": "uidetox build" }
```

**Acceptance criteria:**

- [ ] `uidetox dev` under a directory containing `detox.toml` launches Vite
      with the plugin pre-configured.
- [ ] `uidetox test` runs Vitest under happy-dom with `uidetoxEsbuild()` and
      `mode: 'test'`.

## Priority summary + suggested order

| # | Priority | Blocks |
|---|---|---|
| 9.1 | P0 | Culinary prod build (scoped styles need PostCSS + hashed bundle) |
| 9.2 | P0 | Culinary router — MVP has 10 screens on one `routes.dtx` |
| 9.3 | P1 | `pnpm lint` in Culinary CI |
| 9.6 | P1 | Vitest colocated with components |
| 9.4 | P2 | Better DX around island wrappers (Cytoscape) |
| 9.5 | P2 | DevTools source polish |
| 9.7 | P3 | Nice-to-have |

Suggested order: **9.2 → 9.1 → 9.6 → 9.3 → 9.4 → 9.5 → 9.7**.

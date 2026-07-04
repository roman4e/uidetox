# REQ-08 — Vite Plugin (`uidetox/vite`)

**Requested by:** Culinary frontend (`~/Work/My/Culinary/culinary-frontend`)
**Priority:** P0 (blocker — dev cannot start without it)
**Estimated effort:** medium (1 week)

## Purpose

Ship an official Vite plugin so a Vite project can `import` `.dtx` and `.md`
component sources directly, get HMR on edit, and resolve dotted-module refs
(`import Login from "pages.Login"`) via `detox.toml`. Today the compiler exists
(`uidetox build`) but there is no Vite/esbuild bridge — dev workflow relies on
pre-build steps and HMR is missing.

## Motivating use cases from Culinary

1. **Dev workflow.** `pnpm dev` should serve the app, watch `.dtx` files, and
   swap components in place without a full reload.
2. **Dotted module refs.** `culinary-frontend/src/routes.dtx` uses
   `import Dashboard from "pages.Dashboard"` — resolver must translate to
   `src/pages/Dashboard.dtx` via `detox.toml`'s `resolve.includes`.
3. **TypeScript inside `.dtx` sections.** `script`/`actions`/`effects`/`task`
   bodies are TypeScript. They need type-checking via `pnpm lint` (`tsc --noEmit`)
   too — the plugin must emit virtual TS shims.
4. **CSS with scoped styles.** `style scoped` bodies must reach Vite's CSS
   pipeline (postcss, autoprefixer, etc.), not be inlined as raw strings.
5. **Production build.** Same import graph as dev, tree-shaken, plain ESM output.

## Proposed API

### Package layout

- New export subpath: `uidetox/vite` → default export `uidetox()`.
- Works with Vite 5+.
- Also exposes an esbuild plugin factory (`uidetoxEsbuild()`) so non-Vite
  toolchains (Vitest under happy-dom, Storybook, custom bundlers) work too. Vite
  plugin uses it under the hood.

### Import

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import uidetox from 'uidetox/vite';

export default defineConfig({
  plugins: [
    uidetox({
      // all fields optional
      config: './detox.toml',           // default: nearest detox.toml walking up
      include: ['**/*.dtx', '**/*.md'], // extra globs (defaults cover both)
      exclude: [],                       // globs to skip (docs, tests)
      hmr: true,                         // enable component-preserving HMR
      sourceMaps: true,                  // default true in dev
      injectRuntime: 'auto',             // 'auto' | 'runtime' | 'compiler' | false
    }),
  ],
});
```

### Behavior

**Load `.dtx` / `.md` as ESM modules.**
The plugin's `load` hook compiles the source into JS using the existing
`uidetox/compiler` API and returns:

- Default export → component/router/trait/filter registration handle
  (whatever `defineComponent`/`defineRouter`/`defineTrait`/`defineFilter`
  currently returns — e.g. the tag name string, the router instance, or a
  registration function; nail this down as part of the request).
- Named exports for `declare`d reusables in that file (`export const cardHeader = …`
  matching each `declare tpl card-header … end tpl`).
- Side-effect registration: importing the file registers its Custom Element with
  the browser exactly once (idempotent — HMR must not double-register).

**Dotted-module resolution.**
When an import specifier matches `<segment>(.<segment>)+` (no slashes, no dots
inside segments, no relative prefix) — e.g. `pages.Login`, `lib.auth-guard`,
`components.NumericInput` — the plugin's `resolveId` hook:

1. Parses `detox.toml` (already cached).
2. For each `resolve.includes` entry, try `<include>/<segment1>/<segment2>/…<lastSegment>.{ext}`
   for every `resolve.extensions`, then `<lastSegment>.{ext}` under the joined path.
3. First hit wins. Miss → throw a helpful error listing the paths tried.

Kebab in segments (`lib.auth-guard`) resolves as-is (`lib/auth-guard.ts`).
Casing is preserved (`pages.Login` → `pages/Login.dtx`).

**HMR.**
On file change the plugin recompiles, sends `vite:custom` with the new module,
and the runtime:

- Unregisters the old Custom Element definition — or, since `customElements.define`
  is one-shot, generates a versioned tag (`app-login-v2`) and rewrites live
  instances. Simpler v1 alternative: **full route reload for `.dtx` changes.**
  Ship v1 first, refine later. Document the choice.
- Preserves route state (URL, scroll position) across the reload.

**TypeScript.**
The plugin writes a virtual `<file>.dtx.ts` shim into `.uidetox/tsvirtual/` (or
returns it through Vite's `virtual:` scheme) so `tsc --noEmit` sees the same
symbols. Shim contents: exported types from `props` block, plus a default-export
signature for the component. Documented pattern for editors: users add a single
line to `tsconfig.json` — `"types": [".uidetox/tsvirtual"]` — or the plugin
writes a `dtx-shims.d.ts` root file automatically.

**CSS pipeline.**
`style` / `style scoped` bodies are extracted and emitted as a virtual CSS
module the component's JS output imports. Vite handles postcss/autoprefixer on
them just like normal CSS. `scoped` triggers the existing scoping algorithm
(shadow DOM or attribute selectors — whichever UIDetox already ships).

**Source maps.**
Each generated JS chunk carries a source map back to the original `.dtx` file
with correct line offsets so browser DevTools show the author's source in the
Sources panel.

### CLI

- `uidetox dev` (nice-to-have) — a thin wrapper that launches Vite with the
  plugin pre-configured, useful for `culinary-frontend/package.json` scripts. If
  cost is high, skip.
- `uidetox build --vite` — same idea for production; optional if `vite build`
  already works with the plugin registered.

### Diagnostics

- Resolver miss error message must include:
  - The specifier the user wrote.
  - Every candidate path checked.
  - The `detox.toml` file the resolver used (path + resolved `resolve.includes`).
- Compiler errors must include source line + column that resolve to the
  authored `.dtx` file (not the intermediate JS).
- Duplicate `tag` across files → error (tags must be unique globally). Report
  both file paths.

### Interop with existing `uidetox build`

- `uidetox build` remains for pre-build in non-Vite environments (Storybook, CI
  publishing, e.g. bundling the design system for reuse).
- Both entry points share `uidetox/compiler` internals — no duplicate logic.

## Acceptance criteria

- [ ] `import uidetox from 'uidetox/vite'` resolves and the plugin registers.
- [ ] `.dtx` files are compiled and loaded as ESM by Vite in dev and build.
- [ ] `.md` SFCs (frontmatter + fenced blocks) load the same way.
- [ ] Dotted-module refs resolve via `detox.toml` (`resolve.includes` +
      `resolve.extensions`).
- [ ] File edit triggers HMR (v1: full route reload with preserved URL is OK).
- [ ] Duplicate Custom Element `tag` across files is a hard error at build time.
- [ ] Source maps make browser DevTools point at `.dtx` line numbers.
- [ ] TypeScript virtual shims allow `tsc --noEmit` to type-check imports of
      `.dtx` files.
- [ ] CSS `style scoped` bodies run through Vite's CSS pipeline.
- [ ] `examples/culinary-lite/` — a smoke-test Vite project with a router,
      login, dashboard using `.dtx` + `detox.toml` — builds and dev-serves.

## Culinary side integration (once shipped)

`culinary-frontend/vite.config.ts` becomes:

```ts
import { defineConfig } from 'vite';
import uidetox from 'uidetox/vite';

export default defineConfig({
  plugins: [uidetox()],
  server: { port: 5173 },
});
```

The alias/paths hack in the current `vite.config.ts` and `tsconfig.json` will go
away.

## Open questions

1. **HMR strategy** — versioned tags vs full-route reload. Pick one for v1.
2. **Custom Element idempotency** — is there already a runtime helper to
   register-or-replace? If not, add one.
3. **`.md` role coverage** — does the plugin re-run all roles the compiler
   handles (template, script, style, props, test blocks)? Test blocks should be
   excluded from the dev/build graph and picked up by the test runner instead.
4. **Multi-config** — is a single `detox.toml` per project enough (Culinary
   assumes yes), or do we need per-directory overrides? Culinary side says one
   is enough.
5. **Route `.dtx` file** — `routes.dtx` uses the `router` verb (Phase 4a §3
   Level-0). Confirm the plugin emits its output such that a plain `import
   routes from "./routes.dtx"` gives an array of `RouteEntry` (or a factory),
   so `defineRouter({ routes })` in `main.ts` just works.

# Pattern: Vite plugin (`ui-detox/vite`)

Load `.dtx` and `.md` components directly, resolve dotted-module imports via
`detox.toml`, and get HMR — no pre-build step.

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import uidetox from 'ui-detox/vite';

export default defineConfig({
  plugins: [uidetox()],   // all options optional
});
```

Options: `root`, `config` (path to `detox.toml`, default `<root>/detox.toml`),
`hmr` (default `true`), `sourceMaps` (default `true`).

## What it does

- **Loads components.** `transform` compiles any `.dtx` / `.md` source to ESM
  through `ui-detox/compiler`. A default `import` of the file registers its Custom
  Element.
- **Dotted-module resolution.** An import matching `segment(.segment)+` (no
  slashes, no relative prefix) — `pages.Login`, `lib.auth-guard` — resolves via
  `resolve.includes` × `resolve.extensions` in `detox.toml`, trying
  `<inc>/pages/Login.dtx` then the package form `<inc>/pages/Login/module.dtx`.
  Casing and kebab are preserved. A miss throws an error listing every path tried.
- **Unique tags.** Two files declaring the same custom-element `tag` is a hard
  error naming both files.
- **HMR (v1).** Editing a component triggers a full route reload (URL preserved
  by the browser). Versioned-tag hot-swap is a planned refinement.

```toml
# detox.toml
[resolve]
includes = ["src"]
extensions = [".dtx", ".md"]
```

```ts
// src/main.ts — dotted refs resolved by the plugin
import Login from 'pages.Login';        // → src/pages/Login.dtx
import Dashboard from 'pages.Dashboard';
```

## Scoped CSS through Vite's pipeline

By default (`extractCss: true`) each `style [scoped]` body is pulled out of the
component and imported as a virtual CSS module
(`import "virtual:uidetox-css/<hash>.css"`), so Vite runs PostCSS / `@import` /
CSS-HMR on it and bundles it into `dist/assets/*.css` for production.

- `scoped` selectors are prefixed with the component tag (`.btn` →
  `app-login .btn`). `:root` and at-rules (`@media`, `@keyframes`) stay global,
  so `var(--fg)` still inherits from the app's `:root`.
- Non-scoped `style` is emitted global, as-is.
- Set `extractCss: false` to keep the old behavior (raw `<style>` under the
  element). The esbuild plugin defaults to `false` (Vitest has no CSS resolver).

## Non-Vite toolchains

`uidetoxEsbuild()` is an esbuild plugin factory (`onResolve` + `onLoad`) for
Vitest/Storybook/custom bundlers; the Vite plugin uses the same core.

```ts
import { uidetoxEsbuild } from 'ui-detox/vite';
esbuild.build({ plugins: [uidetoxEsbuild()] });
```

## Colocated tests

`.md` SFCs may carry `ts test` / `ts test:visual` / `ts test:a11y` / `json
fixtures` / `ts mock` blocks. dev/build **strip** them (no test code or deps ship
to production). In `test` mode the plugin re-emits them as
`export function __tests()` (and `export const __fixtures`), so a runner can
execute them. The esbuild plugin defaults to `mode: 'test'`.

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { uidetoxEsbuild } from 'ui-detox/vite';

export default defineConfig({
  test: { environment: 'happy-dom' },
  esbuild: false,
  optimizeDeps: { esbuildOptions: { plugins: [uidetoxEsbuild()] } },
});
```

Then import and run a component's tests: `import { __tests } from './Widget.md';
describe('Widget', __tests)`.

## TypeScript

On `buildStart` the plugin writes `<root>/.ui-detox/dtx-shims.d.ts` — ambient
`declare module` blocks for every dotted spec under the include roots, each with
its `Props` type and default-export signature. Add it to your tsconfig so
`tsc --noEmit` resolves dotted imports:

```jsonc
// tsconfig.json
{ "include": ["src", ".ui-detox/dtx-shims.d.ts"] }
```

```ts
import Login from 'pages.Login';   // ✅ typed: (props?: Props) => HTMLElement
```

Run the plugin once (dev or build) to (re)generate the file.

A `router`-verb `.dtx` is typed as `RouteEntry[]` (not a component factory), so
`defineRouter({ routes })` needs no cast. Route patterns (`**`, `:id`) never leak
into the generated element interfaces, and a handler reused across routes yields
one interface — the `.d.ts` is always valid TypeScript.

## CLI wrappers

Thin launchers so a project's `package.json` needs no hand-written config:

```json
{ "scripts": { "dev": "ui-detox dev", "test": "ui-detox test", "build": "ui-detox build" } }
```

- `ui-detox dev` — starts Vite with `uidetox()` pre-registered (needs `vite`).
- `ui-detox test` — runs Vitest under happy-dom with `uidetoxEsbuild()` in
  `mode: 'test'` (needs `vitest`).

Both error with an install hint if the tool isn't present.

## Status (REQ-08 + REQ-09)

Shipped: `.dtx`/`.md` loading, dotted + single-segment resolution, duplicate-tag
guard, esbuild factory, `router` verb → `RouteEntry[]`, scoped-CSS through Vite's
pipeline, mode-gated colocated tests, auto-written TS shims (`tsc --noEmit`
resolves dotted imports), element-interface host-method typing, `.md` source
maps, `ui-detox dev` / `ui-detox test` CLI wrappers, the `examples/culinary-lite/`
smoke project.

Still v1-simplified: HMR is a full route reload (not versioned-tag hot-swap).

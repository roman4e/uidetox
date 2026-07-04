# Pattern: Vite plugin (`uidetox/vite`)

Load `.dtx` and `.md` components directly, resolve dotted-module imports via
`detox.toml`, and get HMR — no pre-build step.

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import uidetox from 'uidetox/vite';

export default defineConfig({
  plugins: [uidetox()],   // all options optional
});
```

Options: `root`, `config` (path to `detox.toml`, default `<root>/detox.toml`),
`hmr` (default `true`), `sourceMaps` (default `true`).

## What it does

- **Loads components.** `transform` compiles any `.dtx` / `.md` source to ESM
  through `uidetox/compiler`. A default `import` of the file registers its Custom
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

## Non-Vite toolchains

`uidetoxEsbuild()` is an esbuild plugin factory (`onResolve` + `onLoad`) for
Vitest/Storybook/custom bundlers; the Vite plugin uses the same core.

```ts
import { uidetoxEsbuild } from 'uidetox/vite';
esbuild.build({ plugins: [uidetoxEsbuild()] });
```

## TypeScript

`generateTsShim(id, source)` produces virtual `.ts` declarations (the `Props`
type + a default-export signature) so `tsc --noEmit` type-checks `.dtx`/`.md`
imports.

## Status vs the request (REQ-08)

Shipped: `.dtx`/`.md` loading, dotted resolution, duplicate-tag guard, esbuild
factory, TS shim generation, source-map passthrough (dtx), the
`examples/culinary-lite/` smoke project.

Deferred / v1-simplified: HMR is a full route reload (not versioned-tag
hot-swap); scoped-CSS extraction into Vite's CSS pipeline and the `uidetox dev`
wrapper are follow-ups. See `examples/culinary-lite/`.

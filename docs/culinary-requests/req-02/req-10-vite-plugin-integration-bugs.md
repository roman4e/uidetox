# REQ-10 — Vite Plugin: Integration Bugs Found in Real Consumer

**Requested by:** Culinary frontend
**Priority:** P0 — blocker (dev server does not serve `.dtx` files)
**Follows:** REQ-08 + REQ-09 shipped. This is bugs surfaced while wiring
`~/Work/My/Culinary/culinary-frontend` end-to-end against the real
backend (FastAPI, 30 endpoints, live OpenAPI).

## Reproduction

`~/Work/My/Culinary/culinary-frontend/` uses:

- `pnpm@10.33.0`, `vite@5.4.21`
- `uidetox` linked as `file:../../UIDetox`
- `vite.config.ts`:
  ```ts
  import { defineConfig } from 'vite';
  import uidetox, { uidetoxEsbuild } from 'uidetox/vite';

  export default defineConfig({
    plugins: [uidetox()],
    optimizeDeps: { esbuildOptions: { plugins: [uidetoxEsbuild()] } },
  });
  ```
- `detox.toml`:
  ```toml
  [resolve]
  includes = ["src/components", "src/pages", "src/layouts", "src/islands"]
  extensions = [".dtx", ".md"]
  ```
- `src/main.ts` → `import routes from './routes.dtx'` (also tried
  `'routes'` and `'./routes'` — see bug #3).

`pnpm dev` starts, Vite reports ready. Fetching `/src/routes.dtx` or
`/src/pages/Login.dtx` returns **raw DSL source**, not compiled JS. Vite
logs pre-transform errors when other modules import the `.dtx` files:

```
Pre-transform error: Failed to resolve import "./uidetox.js"
  from "src/pages/Login.dtx". Does the file exist?
```

## Bug 10.1 — `transform` never fires for `.dtx` / `.md` in dev serve (P0)

**Cause:** the plugin registers `transform(code, id)` but does not register a
`load(id)` hook. Vite's dev pipeline for arbitrary file extensions is:

1. `resolveId` decides the id maps to a file.
2. `load(id)` produces the module source.
3. `transform(code, id)` post-processes.

For non-JS/TS extensions Vite's default `load` refuses to load them as
modules — it treats them as static assets. Without a plugin `load` hook,
`transform` is never called.

**Requested fix:** add a `load(id)` hook to `uidetox/vite`:

```ts
load(id) {
  if (!isComponentSource(id)) return null;
  const src = readFileSync(cleanQuery(id), 'utf8');
  const compiled = compileModule(id, src);
  tags.register(compiled.tag, id);
  return { code: compiled.code, map: opts.sourceMaps === false ? null : compiled.map };
}
```

`transform` can stay as a no-op or be dropped for component sources — the
compile happens in `load`, not `transform`. Alternatively keep `transform`
and add `load` that just returns `readFileSync` so `transform` gets to
compile — either works.

**Acceptance:**

- [ ] `curl http://localhost:5173/src/pages/Login.dtx` returns
      compiled JS (starts with `import`), not raw DSL source.
- [ ] No "Pre-transform error" when a `.ts` file imports `./x.dtx`.

## Bug 10.2 — Vite's dep pre-scanner sees raw DTX as JS (P0)

**Cause:** Vite's `optimizeDeps` scanner runs esbuild across every file it
reaches from the entry to find bare imports to pre-bundle. When it hits a
`.dtx` file, esbuild tries to parse it as JS. The DSL header (`component
Foo export tag foo`) is not valid JS but esbuild is lenient and still
extracts `import` lines. Those bare imports (`import registry from
"uidetox"`) go into dep pre-bundling.

The registered `uidetoxEsbuild()` factory does not currently register an
`onLoad` filter for `.dtx`/`.md` during the scan phase — it only registers
via `optimizeDeps.esbuildOptions.plugins`, which esbuild honours, but the
`isComponentSource` check must trigger BEFORE the JS-parse pass.

**Requested fix:** in `uidetoxEsbuild.setup`:

- `onLoad({ filter: /\.(dtx|md)$/ })` must fire in the SCAN phase, not
  just the transform phase.
- Returned `contents` must be the compiled JS, `loader: 'js'`.
- Ensure the `onResolve` filter for dotted specifiers ALSO fires during
  scan (so `import "pages.Login"` inside a DTX doesn't leak as an
  unresolved dep).

Verify with:

```bash
DEBUG=vite:deps pnpm dev
```

Should see esbuild plugin `onLoad` firing for every `.dtx` under the entry
graph.

**Acceptance:**

- [ ] No pre-transform errors about `./uidetox.js` (a mangled artefact of
      raw-DTX scanning) when a `.dtx` file imports `uidetox` bare.
- [ ] `.dtx` imports of `uidetox` and `uidetox/forms` resolve to the linked
      package, not `./uidetox.js`.

## Bug 10.3 — dotted resolver requires ≥2 segments; smoke uses 1 (P1)

**Cause:** `resolve.ts:6` uses regex
`^[A-Za-z][\w-]*(?:\.[A-Za-z][\w-]*)+$` — requires at least one dot. But
the shipped `examples/culinary-lite/src/main.ts` uses:

```ts
import routes from 'routes';
```

`routes` has zero dots — regex fails, plugin returns null, Vite's own
resolver falls through to node_modules and errors.

**Requested fix:** either

- **A.** Relax the regex to also match single segments if the specifier
  is a bare-name that resolves under one of `resolve.includes` (fall back
  to a filename match).
- **B.** Document that single-segment refs are NOT supported and update
  the smoke example to `import routes from "./routes.dtx"` (explicit
  path).

Culinary preference: **A** — nicer DX, matches the documented example.

**Acceptance:**

- [ ] `import routes from 'routes'` in `examples/culinary-lite/` works
      out of the box.
- [ ] A test in `tests/vite/resolve.test.ts` covers the single-segment case.

## Bug 10.4 — HMR "full-reload" is issued but plugin bug means dev never runs (blocked by 10.1/10.2)

Not a separate fix — surfacing this so acceptance for 10.1 covers HMR too.
After 10.1 lands, verify: edit `Dashboard.dtx` → Vite sends `full-reload` →
browser refreshes and the compiled version replaces the running one.

## Also: `separate_input_output_schemas` gotcha in codegen (P2)

Independent from the plugin — noted while wiring.

**Symptom:** FastAPI ≥ 0.106 defaults to
`separate_input_output_schemas=True`, which emits component names like
`NutrientAmount-Input` and `NutrientAmount-Output` for models used in both
directions. UIDetox's `uidetox openapi` codegen created interfaces
`NutrientAmountInput` / `NutrientAmountOutput` (strips the hyphen) but left
the `$ref` names with hyphens intact:

```ts
export interface IngredientIn {
  nutrients?: NutrientAmount-Input[];   // invalid TS identifier
}
```

**Workaround (already applied on the Culinary backend):**

```py
app = FastAPI(..., separate_input_output_schemas=False)
```

**Requested fix in codegen (small, P2):** sanitise `$ref` component names
to strip `-` and match the interface name. Regex:
`name.replace(/-/g, '')` when both emitting the interface and when
consuming a `$ref`.

**Acceptance:**

- [ ] `uidetox openapi` on a FastAPI 0.115 schema with default
      `separate_input_output_schemas=True` produces valid TypeScript.

## Priority order

1. **10.1** — `load` hook (P0, blocks all dev).
2. **10.2** — esbuild scan phase (P0, blocks dep optimizer).
3. **10.3** — single-segment resolver (P1, matches shipped smoke example).
4. **Codegen hyphen sanitiser** (P2).

## Verification recipe (once landed)

Culinary side will re-run:

```bash
cd ~/Work/My/Culinary/culinary-frontend
pnpm install
pnpm run gen:api
pnpm dev
```

Success = `curl http://localhost:5173/src/pages/Login.dtx` returns
compiled JS starting with `import` (not `component LoginPage export tag …`).

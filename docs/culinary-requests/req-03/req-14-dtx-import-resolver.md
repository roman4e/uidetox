# REQ-14 — DTX import resolver rewrites bare npm specifiers as broken relative paths

**Requested by:** Culinary frontend
**Priority:** **P0** — every `.dtx` file that imports `uidetox`,
`uidetox/forms`, `uidetox/http` etc. crashes at Vite import-analysis.
**Follows:** REQ-13 unblocked the build. `dist/` now ships the fixed
plugin, but every `.dtx` module fails at browser load.

## Symptom

Fetching a compiled `.dtx` module in dev returns HTTP 500:

```
[vite] Failed to resolve import "./uidetox.js" from "src/pages/Login.dtx".
Does the file exist?
```

Inspecting the compiled JS Vite tries to serve:

```js
import { defineComponent } from "uidetox";        // ← plugin-injected, correct
import { __el } from "uidetox";                    // ← correct
…
import { registry } from "./uidetox.js";           // ← USER import — broken
import { form, f } from "uidetox/forms";           // ← correct
import { authToken, apiToken } from "./tokens.js"; // ← USER import — wrong path
```

The user-authored `.dtx` had:

```
import registry from "uidetox"
import form, f from "uidetox/forms"
import authToken, apiToken from "tokens"
```

The framework's own imports (`defineComponent`, `__el`, `form`, `f`) come
out correct. USER imports the compiler rewrites hit the buggy path.

## Root cause

`src/compiler/dtx/resolve.ts:84 resolveSpecifier(spec)`:

```ts
export function resolveSpecifier(spec: string, opts: SpecifierOptions = {}): string {
  if (spec.includes('/')) return spec;              // #1 — path-like → verbatim
  const slash = spec.replace(/\./g, '/');
  if (opts.baseDir) {                                // #2 — dotted refs
    const roots = [opts.baseDir, ...(opts.includes ?? [])];
    for (const root of roots) {
      const direct = join(root, `${slash}.dtx`);
      if (existsSync(direct)) return toRelative(opts.baseDir, direct);
      const pkg = join(root, slash, 'module.dtx');
      if (existsSync(pkg)) return toRelative(opts.baseDir, pkg);
    }
  }
  return `./${slash}.js`;                            // #3 — fallback
}
```

Cases:

- `"uidetox/forms"` → contains `/` → verbatim. **Correct.**
- `"pages.Login"` → dotted → resolves via `baseDir` + `includes`. **Correct.**
- `"uidetox"` → no `/`, no `.`, `baseDir` search fails (no such file) →
  fallback `./uidetox.js`. **Wrong** — this is an npm package that
  should stay `"uidetox"`.
- `"tokens"` (a local `.ts` module, not `.dtx`) → same path as above →
  `./tokens.js`. Even worse: the emit does not know whether the importer
  is 6 levels deep — `./tokens.js` from `src/pages/Login.dtx` resolves
  to `src/pages/tokens.js` which does not exist; the correct answer is
  `../tokens.js`.

Two independent bugs:

1. Bare identifiers that are neither `.dtx` files nor packages under
   `resolve.includes` are silently rewritten as broken relative `.js`
   paths.
2. The compiler is likely not being handed the `baseDir` of the importing
   source at all — otherwise the `.ts` fallback would relativise
   correctly.

## Requested fixes

### 14.1 — Recognise bare identifiers as npm specifiers (P0)

When `spec` has no `/` and no `.`, and no `.dtx` was found by the dotted
resolver, **return the specifier verbatim** (treat as npm bare specifier).
Vite / node resolution then handles it.

Suggested diff to `resolve.ts:96`:

```diff
- return `./${slash}.js`;
+ // No `.dtx` matched. Treat as a bare npm specifier — let the bundler
+ // resolve it (npm package, tsconfig `paths`, importmap, etc.).
+ return spec;
```

### 14.2 — Pass importer `baseDir` into `compileModule` (P0)

The Vite plugin's `transform(code, id)` currently calls `compileModule(id,
code)` in `src/vite/compile.ts:21`. `compileModule` calls `compileDtx(source)`
without an `opts.baseDir`. That's why `resolveSpecifier` never enters the
`opts.baseDir` branch.

Suggested: propagate `baseDir` through:

```ts
// compile.ts
export function compileModule(id: string, source: string): CompiledModule {
  const baseDir = dirname(id);
  if (id.endsWith('.dtx')) {
    const { code, map } = compileDtx(source, { baseDir, includes: config.resolve.includes });
    return { code, map, tag: extractTag(code) };
  }
  …
}
```

`config.resolve.includes` needs to flow in from the plugin core. The
plugin's `createUidetoxCore` already loads the config — pass it through
to `compileModule` as an argument.

### 14.3 — After 14.2, dotted refs must resolve to project-relative paths, not compiler-relative (P0)

With `baseDir` present, `toRelative(baseDir, target)` should emit a path
starting from the importing `.dtx` file. Existing `toRelative` already
does this at `resolve.ts:72` — verify it works end-to-end.

Example: `src/pages/Login.dtx` imports `authToken from "tokens"`. There is
no `src/pages/tokens.dtx`, but there IS `src/tokens.ts`. Expected output:

```js
import { authToken } from "../tokens";
```

Bundler-resolution (Vite, esbuild) then finds `src/tokens.ts`.

Currently the resolver only searches for `.dtx`, not `.ts`. **Optional
enhancement:** allow `resolve.extensions` in `detox.toml` to include
`.ts`/`.js`, then extend the dotted resolver to try those too:

```toml
[resolve]
includes = ["src", "src/components", "src/pages"]
extensions = [".dtx", ".md", ".ts", ".js"]
```

Alternatively (simpler): the resolver leaves non-matching bare identifiers
verbatim and lets Vite's own resolver handle them (this + 14.1 already does
the job).

Culinary preference: **combine 14.1 + verify 14.2's `baseDir` reaches the
`.dtx` search** — that closes both root causes without expanding the
extension list.

## Acceptance criteria

- [ ] `import registry from "uidetox"` in a `.dtx` compiles to `import
      { registry } from "uidetox"` in the emitted JS (bare, no `./` prefix,
      no `.js` suffix).
- [ ] `import authToken from "tokens"` in a `.dtx` located at
      `src/pages/Login.dtx` (with `src/tokens.ts` existing) compiles to
      a specifier Vite can resolve — the plugin should not rewrite it to
      a path that references a non-existent file.
- [ ] `curl http://localhost:5173/src/pages/Login.dtx` in the Culinary
      frontend returns compiled JS and NO 500 from
      `vite:import-analysis`.
- [ ] Regression test in `tests/compiler/dtx/resolve.test.ts`:
      `resolveSpecifier('uidetox')` returns `'uidetox'` — verbatim.

## Culinary-side workaround (until landed)

None clean. Options tried:

- Replace `from "uidetox"` with `from "uidetox/index"` — has `/`, passes
  through verbatim, but exposes an internal path that may not be
  documented as stable.
- Move user code out of `.dtx` `script` block and into a companion `.ts`
  file — defeats the whole SFC pattern.

Culinary is holding on this fix.

## Meta

Suggested unit test to prevent regression:

```ts
// tests/compiler/dtx/resolve.test.ts
it('leaves bare npm specifiers verbatim', () => {
  expect(resolveSpecifier('uidetox')).toBe('uidetox');
  expect(resolveSpecifier('lodash-es')).toBe('lodash-es');
});

it('leaves `/`-containing specifiers verbatim', () => {
  expect(resolveSpecifier('uidetox/forms')).toBe('uidetox/forms');
  expect(resolveSpecifier('./sibling.js')).toBe('./sibling.js');
});

it('resolves dotted refs via baseDir + includes', () => {
  // in-repo fixture
});
```

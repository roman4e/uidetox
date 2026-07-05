# REQ-15 — DTX compiler emits `.js` for local `.dtx` imports, Vite cannot resolve

**Requested by:** Culinary frontend
**Priority:** **P0** — every dotted local import in `.dtx` now fails at
Vite's `import-analysis` after REQ-13/14 landed.
**Follows:** REQ-14 fixed bare npm specifiers. REQ-15 is the twin bug for
in-project `.dtx` refs.

## Symptom

Culinary's `src/routes.dtx`:

```
import Login from "pages.Login"
```

`src/pages/Login.dtx` exists. `detox.toml` has `resolve.includes = ["src",
"src/pages", ...]` and `resolve.extensions = [".dtx", ".md", ".ts"]`.

Direct call to `createUidetoxCore(...).transform(routesSrc, routesId)`
returns:

```js
import { Login } from "./pages/Login.js";       // ← NO SUCH FILE
import { Dashboard } from "./pages/Dashboard.js";
…
```

Vite errors:

```
[vite] Internal server error: Failed to resolve import "./pages/Login.js"
  from "src/routes.dtx". Does the file exist?
```

## Root cause

`src/compiler/dtx/resolve.ts` — the `toRelative` helper rewrites `.dtx` to
`.js` in the emitted specifier:

```ts
function toRelative(from: string, to: string): string {
  const rel = ...;
  return rel.replace(/\.dtx$/, '.js');
}
```

Historical rationale: at build time (pre-Vite) the compiler wrote `.js`
files next to `.dtx` sources, so imports had to reference the compiled
output. Under Vite that assumption no longer holds — Vite's dev server
compiles on demand and expects the import to reference the SOURCE `.dtx`
so its load hook fires.

## Requested fix

**Emit the source specifier (`.dtx`, `.md`, `.ts`) verbatim in the
compiled output.** Vite / esbuild resolve the specifier via the plugin's
`load`/`transform` chain, which already knows how to compile `.dtx`/`.md`
and how to hand `.ts` back to Vite's own TypeScript pipeline.

Suggested change in `resolve.ts:toRelative`:

```diff
- return rel.replace(/\.dtx$/, '.js');
+ return rel;
```

Also verify `.md` isn't rewritten anywhere (probably fine since resolver
searches `.dtx` first, but audit).

## Acceptance criteria

- [ ] `resolveSpecifier('pages.Login', { baseDir: '/proj/src', includes:
      ['/proj/src'], extensions: ['.dtx', '.md', '.ts'] })` with
      `/proj/src/pages/Login.dtx` on disk returns `'./pages/Login.dtx'`,
      not `'./pages/Login.js'`.
- [ ] Same call resolving to `/proj/src/lib/foo.ts` returns
      `'./lib/foo.ts'`.
- [ ] Regression test:

  ```ts
  // tests/compiler/dtx/resolve.test.ts
  it('preserves the source extension in the emitted specifier', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ux-'));
    writeFileSync(join(dir, 'Foo.dtx'), 'component Foo tag foo\nend component\n');
    expect(resolveSpecifier('Foo', {
      baseDir: dir, includes: [dir], extensions: ['.dtx'],
    })).toBe('./Foo.dtx');
  });
  ```

- [ ] After landing, `curl http://localhost:5173/src/routes.dtx?import` in
      `culinary-frontend` returns compiled JS whose imports point at
      `./pages/Login.dtx` (or absolute `/src/pages/Login.dtx`), not
      `./pages/Login.js`.

## Interaction with the standalone `uidetox build` CLI

The old `.dtx → .js` next-to-source pipeline (if still used by
`uidetox build`) can keep the rewrite locally at that call site. Suggested
scoping:

- `resolveSpecifier` returns SOURCE ext (this fix).
- `uidetox build` CLI, if it still emits sibling `.js` files, does its own
  post-processing (or the plugin's build step targets `.js` explicitly).

Either way the emitted SOURCE specifier should mirror what's on disk so
tooling (Vite, esbuild, tsc under REQ-09.3 shims) can find it.

## Notes

Combined with REQ-14, this closes the whole dev-serve bug chain. Culinary
side has 11 screens + island + full `routes.dtx` waiting to compile the
moment REQ-15 lands.

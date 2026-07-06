# REQ-16 — `router` verb emits named imports for page handlers; page defaults are what's needed

**Requested by:** Culinary frontend
**Priority:** **P0** — production `routes.dtx` produces a broken bundle;
every route resolves to `handler: undefined`, router crashes with
`TypeError: Cannot read properties of undefined (reading 'load')`.
**Follows:** REQ-13/14/15 landed. Dev serve + prod build both work
mechanically. This is a semantic emit bug on top.

## Repro

`culinary-frontend/src/routes.dtx`:

```
import Login from "pages.Login"
import Dashboard from "pages.Dashboard"

router AppRoutes export
routes
"/login" -> Login

group layout=AppShell guard=requireAuth
"/" -> Dashboard
end group
end routes
end router
```

`culinary-frontend/src/pages/Login.dtx` (per REFERENCE §7):

```
component Login export tag page-login
...
end component
```

The dtx compiler emits (per `dist/compiler/dtx/`):

- `pages/Login.dtx` → `export const Login = defineComponent({...});
  export default () => document.createElement("page-login");`
- `routes.dtx` → `import { Login } from "./pages/Login.dtx";` **← named**
  → `export default [{ path: "/login", handler: Login, ... }, ...];`

At runtime `Login` (the named export) is what `defineComponent(...)`
returns. Per REFERENCE §5 `defineComponent(options): void`. So
`Login === undefined` at runtime. Route entry becomes
`{ handler: undefined, ... }` and the router's outlet crashes:

```
TypeError: Cannot read properties of undefined (reading 'load')
  at resolveHandler (outlet.js)
```

Culinary's live console showed exactly this.

## What routes need

Router entries expect `handler: (ctx) => Node | Promise<Node> | LazyHandler`.
Each `.dtx` component's **default export** is the factory
`() => document.createElement("page-login")`. So the `router` verb should
emit **default** imports of page handlers, not named:

```diff
- import { Login } from "./pages/Login.dtx";
- import { Dashboard } from "./pages/Dashboard.dtx";
+ import Login from "./pages/Login.dtx";
+ import Dashboard from "./pages/Dashboard.dtx";
```

Then `handler: Login` binds to the factory function → matches router
`Handler` type → outlet renders correctly.

Alternative fix that's equally valid: keep named imports but make the
`component` verb emit its default export as the factory AND assign the
named `Login` constant to that same factory (so both work). Whichever is
cheaper — Culinary side has no preference.

## Requested fix

In the dtx compiler's `router` verb code path:

- Each `import <Name> from "path"` inside a `router` block should compile
  to `import <Name> from "path"` (default) **in the emitted JS**, NOT to
  `import { <Name> } from "path"` (named).
- Regression test:

  ```ts
  // tests/compiler/dtx/router-verb.test.ts
  it('emits default imports for handlers referenced in routes', () => {
    const src = `
      import Login from "pages.Login"

      router AppRoutes export
      routes
      "/login" -> Login
      end routes
      end router
    `;
    const out = compileDtx(src, { baseDir, includes, extensions: ['.dtx'] });
    expect(out.code).toMatch(/import\s+Login\s+from\s+"\.\/pages\/Login\.dtx"/);
    expect(out.code).not.toMatch(/import\s*{\s*Login\s*}\s*from/);
    expect(out.code).toContain('handler: Login');
  });
  ```

- E2E smoke: `examples/culinary-lite/` (post REQ-15) should render its
  Login route with actual content, not an empty outlet.

## Acceptance criteria

- [ ] `import <Name> from "path"` in a `router` block emits as JS default
      import.
- [ ] The regression test above passes.
- [ ] `examples/culinary-lite/` route table entries carry function-typed
      handlers at runtime (`typeof route.handler === 'function'`).
- [ ] After landing, Culinary can re-enable `src/routes.dtx` and drop the
      hand-crafted route table in `main.ts`.

## Culinary side workaround already applied

`culinary-frontend/src/main.ts` now hand-crafts the `routes` array with
plain TS `import X from "./pages/X.dtx"` (defaults). This unblocks prod.
`src/routes.dtx` is left in place but unused; will be swapped back in the
moment REQ-16 lands.

## Meta — root cause pattern

REQ-15 fixed `.dtx` extension in emitted specifiers. REQ-16 is the twin
default-vs-named twist. Suggested audit: run a grep across the dtx
emitter for `import { ${'{'}...${'}'} from` and verify every path where
that named-import shape is emitted matches an actual named export in the
target module. A default-import path is the safer choice for
`router` verb + component `.dtx` files because `defineComponent()`
returns void, so no named binding surfaces the handler.

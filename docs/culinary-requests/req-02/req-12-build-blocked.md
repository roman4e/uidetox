# REQ-12 — Build Blocker: `pnpm build` fails with pre-existing type errors

**Requested by:** Culinary frontend
**Priority:** **P0** (blocks distribution of REQ-10/11 fixes)

## Symptom

`pnpm build` in the UIDetox repo fails:

```
$ cd ~/Work/My/UIDetox && pnpm build
src/runtime/mro/linearize.ts(41,19): error TS2352: Conversion of type 'T'
  to type '{ [k: symbol]: T[]; }' may be a mistake …
src/runtime/router/outlet.ts(8,3): error TS2322: Type 'Handler' is not
  assignable to type '(ctx: NavigationContext) => Node | Promise<Node>' …
ELIFECYCLE Command failed with exit code 2.
```

Result: `dist/` is stale. In particular, `dist/vite/plugin.js` still ships
the pre-REQ-10 version whose `load(id)` hook only handles virtual CSS —
`isComponentSource(id)` branch is missing.

Since `culinary-frontend`'s `package.json` uses `"uidetox":
"link:../../UIDetox"` and UIDetox's `package.json` `exports` map points at
`./dist/...`, Culinary sees the stale plugin regardless of what
`src/vite/plugin.ts` looks like today.

## Verification

```bash
grep -A5 "load(id" ~/Work/My/UIDetox/src/vite/plugin.ts
# src/ shows the full load hook that reads .dtx source via readFileSync — correct.

grep -A5 "load(id" ~/Work/My/UIDetox/dist/vite/plugin.js
# dist/ shows only the isVirtualCssId branch — stale.
```

## Impact on Culinary

Every REQ-10 and REQ-11 fix is inaccessible from `culinary-frontend`. The
symptom user sees:

```
$ pnpm dev
Pre-transform error: Failed to resolve import "./uidetox.js"
  from "src/pages/Login.dtx". Does the file exist?
```

Same failure I reported in REQ-10.

## Requested fix

- [ ] Resolve `src/runtime/mro/linearize.ts:41` cast (`as unknown as X` if
      genuinely intentional, otherwise narrow the type).
- [ ] Resolve `src/runtime/router/outlet.ts:8` `Handler` vs
      `(ctx) => Node | Promise<Node>` mismatch — probably needs to inline
      unwrapping of `LazyHandler` before assignment, or widen the outlet
      handler type to accept `Handler`.
- [ ] `pnpm build` exits 0.
- [ ] `dist/vite/plugin.js` contains the `isComponentSource(file)` branch
      in its `load` hook.

## After the fix — Culinary side verification

Culinary will re-run:

```bash
cd ~/Work/My/UIDetox && pnpm build
cd ~/Work/My/Culinary/culinary-frontend && pnpm dev
curl http://localhost:5173/src/pages/Login.dtx
# Expected: compiled JS starting with `import` (not raw DSL).
```

## Meta

Prevention: add a `dist-freshness` check to CI (or a `prepare` script) so
`pnpm build` runs on install / before publish. Consuming projects link to
`dist/`, so any build failure silently strands them until noticed by hand.

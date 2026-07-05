# REQ-13 — Unblock `pnpm build` (REQ-10/11 stranded in `src/`)

**Requested by:** Culinary frontend
**Priority:** **P0** — everything shipped in REQ-08..11 is unreachable by
consumers until this lands. Culinary's `culinary-frontend` cannot run
`pnpm dev`, cannot type-check, cannot build.

## Symptom

```
$ cd ~/Work/My/UIDetox && pnpm build

> uidetox@0.0.1 build /home/tue/Work/My/UIDetox
> tsc -p tsconfig.json

src/runtime/mro/linearize.ts(41,19): error TS2352: Conversion of type 'T' to type
  '{ [k: symbol]: T[]; }' may be a mistake because neither type sufficiently overlaps
  with the other. If this was intentional, convert the expression to 'unknown' first.
    Type 'Linearizable<T>' is not comparable to type '{ [k: symbol]: T[]; }'.
      Index signature for type 'symbol' is missing in type 'Linearizable<T>'.

src/runtime/router/outlet.ts(8,3): error TS2322: Type 'Handler' is not assignable
  to type '(ctx: NavigationContext) => Node | Promise<Node>'.
    Type 'LazyHandler' is not assignable to type
      '(ctx: NavigationContext) => Node | Promise<Node>'.
      Type 'LazyHandler' provides no match for the signature
        '(ctx: NavigationContext): Node | Promise<Node>'.

 ELIFECYCLE Command failed with exit code 2.
```

`dist/` is not regenerated. Since `culinary-frontend/package.json` uses
`"uidetox": "link:../../UIDetox"` and `UIDetox/package.json` `exports` map
points at `./dist/*`, every consumer sees the STALE pre-REQ-10 code paths.

Verifiable — the `load(id)` hook shipped in `src/vite/plugin.ts` is missing
from `dist/vite/plugin.js`:

```
$ grep -A5 "load(id" src/vite/plugin.ts
    load(id: string): string | null {
      if (isVirtualCssId(id)) return core.getCss(id) ?? null;
      // …
      const file = cleanId(id);
      if (isComponentSource(file)) return readFileSync(file, 'utf8');
      return null;
    },

$ grep -A5 "load(id" dist/vite/plugin.js
        load(id) {
            if (isVirtualCssId(id))
                return core.getCss(id) ?? null;
            return null;                              # ← misses .dtx/.md branch
```

## Root causes

### 13.1 — `src/runtime/mro/linearize.ts:41` unsafe cast (P0)

```ts
export function resolveLinearization<T extends Linearizable<T>>(root: T): T[] {
  const cached = (root as { [k: symbol]: T[] })[CACHE];   // ← TS2352
  …
}
```

TypeScript's `Object.defineProperty` cache pattern needs an `as unknown`
bridge cast when the target type has no matching index signature. `T` and
`{ [k: symbol]: T[] }` do not overlap.

**Fix:** insert an `unknown` bridge:

```ts
const cached = (root as unknown as { [k: symbol]: T[] })[CACHE];
```

Or better, cache in a `WeakMap<T, T[]>` external to the target — avoids the
symbol-indexed cast entirely. Either is fine.

### 13.2 — `src/runtime/router/outlet.ts:8` `resolveHandler` return type (P0)

```ts
async function resolveHandler(handler: Handler): Promise<Exclude<Handler, LazyHandler>> {
  if (typeof handler === 'function') return handler;    // ← TS2322
  return handler.load();
}
```

`Handler = ((ctx) => Node | Promise<Node>) | LazyHandler`. The `typeof
handler === 'function'` narrow rejects `LazyHandler` (an object with a
`.load` method) but TypeScript keeps `LazyHandler` alive in the union at
the return position because `LazyHandler.load` is also a function-typed
property (structural narrowing gotcha).

**Fix (one of):**

- Use a runtime tag on the narrow:
  ```ts
  if (!('load' in handler)) return handler;
  return (await handler.load()) as Exclude<Handler, LazyHandler>;
  ```

- Or cast at the narrow boundary:
  ```ts
  if (typeof handler === 'function') return handler as Exclude<Handler, LazyHandler>;
  return handler.load();
  ```

Recommend the `'load' in handler` guard — no cast needed.

## Requested actions

- [ ] Fix 13.1 (`linearize.ts`).
- [ ] Fix 13.2 (`outlet.ts`).
- [ ] `pnpm build` exits 0.
- [ ] `dist/vite/plugin.js` contains `isComponentSource(file)` branch.
- [ ] `dist/vite/plugin.js` contains `readFileSync(file, 'utf8')` load logic.
- [ ] Optionally add a CI check: `pnpm build && ! git diff --exit-code dist/` —
      guarantees `dist/` is regenerated on every PR merge, so future
      pre-existing TS errors cannot silently strand consumers again.

## Verification recipe (Culinary side)

Immediately after this ships:

```bash
cd ~/Work/My/UIDetox
pnpm build                                     # expect exit 0

grep -A2 "load(id" dist/vite/plugin.js         # expect the .dtx branch

cd ~/Work/My/Culinary/culinary-frontend
pnpm dev &
sleep 5
curl -sf http://localhost:5173/src/pages/Login.dtx | head -3
# Expected: compiled JS starting with `import` — NOT the raw DSL "component LoginPage export tag …".
```

## Related

- REQ-10 (Vite plugin dev-serve bugs) — its fixes are the primary victim
  of this build failure.
- REQ-11.1..11.11 — router DSL, navigate(), etc. — same fate.
- REQ-12 (my earlier note in `req-02/`) — same finding as this REQ, kept
  for cross-reference. This REQ-13 is the standalone tracked version.

## Meta

Culinary side has drafted the remaining ten screens
(`src/pages/{RecipeCard,RecipeEditor,RecipeCompare,IngredientLibrary,
IngredientForm,ForkConflict,ModerationQueue,KitchenMode,NotFound}.dtx` +
`src/islands/GraphEditor.md,ts` + `src/layouts/KitchenShell.dtx` + full
`src/routes.dtx`) against the REQ-11 syntax. All 11 screens sit ready and
compile the moment `dist/` is regenerated.

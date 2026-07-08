# REQ-25 — `router`-verb `.dtx` shim should type as `RouteEntry[]`

**Requested by:** SOPP / ALM frontend
**Priority:** **P2** — one-line consumer cast works around it, but every app
that uses the file-based router hits it.

## Symptom

The Vite plugin generates `.uidetox/dtx-shims.d.ts`. For a `router`-verb SFC
(`routes.dtx`) it emits the **generic component** signature:

```ts
declare module "routes" {
  export type Props = Record<string, unknown>;
  const _default: (props?: Props) => HTMLElement;   // ← wrong for a router
  export default _default;
}
```

But `routes.dtx` compiles to a `RouteEntry[]` default export (consumed by
`defineRouter({ routes })`). So the correct usage fails type-check:

```
src/main.ts: Type '(props?: Props) => HTMLElement' is not assignable to type 'RouteEntry[]'.
```

Consumers must cast: `defineRouter({ routes: routes as unknown as RouteEntry[] })`.

## Request

When the shim generator sees a top-level `router` verb in a `.dtx`, emit the
route-array type instead of the component factory:

```ts
declare module "routes" {
  import type { RouteEntry } from "uidetox";
  const _default: RouteEntry[];
  export default _default;
}
```

(Symmetrically, a `filter`/`trait`/`token`/`provide` verb likely each want their
own shim shape rather than the component default — `router` is the one that
actively breaks a correct program.)

## Acceptance

- A project whose `routes.dtx` uses the `router` verb type-checks
  `defineRouter({ routes })` with no cast.
- The generated shim imports `RouteEntry` from `uidetox` and types the default
  as `RouteEntry[]`.

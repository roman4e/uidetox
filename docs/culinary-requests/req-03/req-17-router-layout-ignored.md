# REQ-17 — Router outlet ignores `meta.layout`

**Priority:** P1 — every screen loses its layout in prod.
**Follows:** REQ-16 landed. `router` verb correctly emits routes with
`meta: { layout: AppShell }`, but the runtime outlet renders the page
handler directly, without wrapping it in the layout.

## Repro (Culinary live)

routes.dtx:
```
group layout=AppShell guard=requireAuth
"/" -> Dashboard
end group
```

Compiled entry (verified in browser via `router.onMatched`):
```json
{
  "entry": {
    "path": "/",
    "handler": "fn:Dashboard",
    "guards": ["fn:requireAuth"],
    "meta": { "layout": "fn:AppShell" }
  }
}
```

Rendered DOM under `<router-outlet>`:
```html
<router-outlet>
  <page-dashboard>...</page-dashboard>       <!-- layout skipped -->
</router-outlet>
```

Expected:
```html
<router-outlet>
  <app-shell>
    <page-dashboard>...</page-dashboard>     <!-- slotted into layout -->
  </app-shell>
</router-outlet>
```

## Root cause

`src/runtime/router/outlet.ts render(m)` calls:
```ts
const fn = await resolveHandler(m.entry.handler);
const node = await fn({ params, route, location });
```
It never consults `m.entry.meta.layout`.

## Requested fix

Extend `render(m)`:

```ts
const fn = await resolveHandler(m.entry.handler);
const pageNode = await fn({ params: m.params, route: m.entry, location: m.location });

const layout = m.entry.meta?.layout as Handler | undefined;
if (layout) {
  const layoutFn = await resolveHandler(layout);
  const layoutNode = await layoutFn({ params: m.params, route: m.entry, location: m.location });
  // layout's default slot receives the page
  layoutNode.appendChild(pageNode);
  return layoutNode;
}
return pageNode;
```

Nested layout composition (REFERENCE §13.5 says "compositions cascade"):
if the layout's own entry declares its own layout via `meta.parentLayout`,
walk that chain. MVP can ship one-level layout support first.

## Acceptance criteria

- [ ] A route with `meta: { layout: X }` renders `<x-layout-tag><page-tag/></x-layout-tag>`.
- [ ] Layout's default `<slot/>` projects the page.
- [ ] `examples/culinary-lite/` gains a layout demo verifying the DOM tree.
- [ ] Regression test in `tests/runtime/router/`.

## Culinary side workaround

Pages self-wrap: template becomes `<app-shell><section class="page">…</section></app-shell>`.
Ugly but immediate. Will unwind once REQ-17 lands.

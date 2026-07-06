# REQ-18 — Router matched params never reach the page component

**Priority:** P0 — every parameterised route (`/recipes/:id`, `/kitchen/:recipeId`, …)
sees `props.id === undefined` at runtime.
**Follows:** REQ-17 landed. Layouts render. Params still lost.

## Repro (Culinary live)

routes.dtx:
```
group layout=AppShell guard=requireAuth
"/recipes/:id/edit" -> RecipeEditor { id: string }
end group
```

RecipeEditor.dtx:
```
component RecipeEditor export tag page-recipe-editor
props
string id
end props
script
const dish = resource(
  (signal) => api.value.dishes.getEndpoint({ path: { dish_id: props.id }, signal }),
  ...
);
end script
```

Navigation to `/recipes/9b028f38-fd2a-471c-ac48-b9d4c98b1e17/edit` — router
matches, entry.handler runs, page-recipe-editor mounts, but the fetch
fails with:

```
Missing path param: dish_id
```

Because `props.id === undefined`.

## Root cause

The DTX compiler emits the page module's default export as:

```ts
export default () => document.createElement("page-recipe-editor");
```

The router runtime calls the handler with `ctx = { params, route, location }`,
but this default handler ignores `ctx.params`. The Custom Element
initialises from `observedAttributes`; nothing has set them, so
`props.id` is undefined at the moment the reactive scripts read it.

## Requested fix

Change the DTX compiler's default-export shape for `component` files
consumed as route handlers to accept `ctx` and reflect params onto the
element BEFORE returning it:

```ts
export default (ctx) => {
  const el = document.createElement("page-recipe-editor");
  if (ctx && ctx.params) {
    for (const [k, v] of Object.entries(ctx.params)) {
      if (v !== undefined && v !== null) el.setAttribute(k, String(v));
    }
  }
  return el;
};
```

This is safe: `observedAttributes` triggers `attributeChangedCallback`,
which populates `_props` before `connectedCallback` boots the template.
Reactive scripts then read the correct `props.id` on first evaluation.

Equivalent alternative: emit a small runtime helper that the router
outlet applies uniformly (mount hook: set every ctx.param as an
attribute). Either approach is fine; Culinary just needs `props.<paramName>`
to be populated at boot.

## Acceptance criteria

- [ ] For a route `/x/:id` matched with `id="42"`, the mounted CE has
      `getAttribute("id") === "42"` before boot script runs.
- [ ] `props.id` inside the component's `script` reads `"42"` on first
      evaluation.
- [ ] All types declared in `paramsSchema` coerce (a `{ id: 'number' }`
      route puts a number-typed value into `props.id` at boot).
- [ ] Regression tests in `tests/compiler/dtx/component-emit.test.ts` and
      `tests/runtime/router/outlet.test.ts`.

## Culinary workaround

Same as REQ-16 fallback — hand-craft the `routes` array in `main.ts` and
wrap each handler so it applies params:

```ts
function withParams(Factory) {
  return (ctx) => {
    const el = Factory(ctx);
    for (const [k, v] of Object.entries(ctx.params || {})) {
      if (v != null) el.setAttribute(k, String(v));
    }
    return el;
  };
}
```

Removes the routes.dtx nicety but unblocks. Will unwind on landing.

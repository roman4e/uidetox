# Pattern: Client-side navigation

SPA transitions without a full page reload. Available once a router has
`start()`ed (which registers it as the active router and installs the link
interceptor).

## `navigate(url)`

Programmatic navigation from anywhere — e.g. a component's `actions`:

```ts
import { navigate } from 'ui-detox';

function openRecipe(id: string) {
  navigate(`/recipes/${id}`);        // SPA transition, no reload
}
```

Throws if no router is active. Pass `{ replace: true }` to replace history.

## `<a data-nav>`

Opt-in link interception — add `data-nav` to an anchor and same-origin clicks
route through the router instead of reloading:

```html
<a data-nav href="/ingredients">Ingredients</a>
```

Preserved browser behavior (not intercepted): modifier clicks (cmd/ctrl/shift/
alt), middle-click, `target="_blank"`, `download`, `mailto:`, and cross-origin
hrefs — so new-tab and external links work as usual.

`installNavLinks()` is called automatically by `router.start()`; call it
manually only if you navigate before starting a router.

## Reactive route state

`routeState()` returns the active router's reactive `{ path, params, meta }`.
Read its fields in an effect to react to navigation — e.g. a `KitchenMode`
island starting/stopping work as it becomes active:

```ts
import { routeState } from 'ui-detox';

ctx.effect(() => {
  const active = routeState().path === '/kitchen/:id';
  if (active) startTimer(); else stopTimer();
});
```

Also available directly on the instance as `router.state`. `meta.layout` (from
the router DSL `layout=` clause) rides along here too.

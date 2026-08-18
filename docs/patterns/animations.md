# Pattern: mount / route-transition animations

On top of the low-level `animate()` (WAAPI wrapper, reduced-motion aware) and the
FLIP list-reorder helpers, `ui-detox` ships enter/exit primitives that mirror the
framer/`motion` patterns the ApiKraft port came from.

```ts
import { enter, exit, stagger, presence } from 'ui-detox';
```

All primitives no-op into an instant final-state apply under
`prefers-reduced-motion: reduce` or where WAAPI is unavailable.

## Enter on mount

Fade + slide a node in on first paint (`initial={{opacity:0,y:12}}` equivalent):

```ts
// in a component's boot, after the node exists
enter(el);                       // default: opacity 0→1, translateY(12px)→0, 300ms
enter(el, { y: 40, duration: 500, easing: 'ease-out' });
```

### Staggered `<for>` children

```ts
stagger(listEl.children, { y: 20 }, 60);   // 60ms per item on top of opts.delay
```

Matches `transition={{ delay: 0.3 + i*0.1 }}` — pass `{ delay: 300 }` and step `100`.

## Exit before enter (route transitions)

`presence()` is the `AnimatePresence mode="wait"` equivalent: play the outgoing
node's exit, run the DOM swap, then enter the incoming node.

```ts
await presence(currentEl, () => {
  const next = renderNextView();
  container.replaceChildren(next);
  return next;
});
```

`exit()` on its own returns a promise you can await before removing a node:

```ts
await exit(el);
el.remove();
```

### Router integration

Add the `transition` attribute to opt the outlet into exit-before-enter — the
outgoing route plays its exit before the incoming route mounts and enters:

```html
<router-outlet transition></router-outlet>
```

Without the attribute the outlet swaps synchronously (unchanged default).

## Conditional enter/exit on `<if>`

`<if>`-toggled nodes mount/unmount synchronously. For a blur/fade out **before**
removal, gate the toggle behind `exit()`:

```ts
async function hide() {
  await exit(panelEl, { opacity: 0, scale: 0.98, duration: 150 });
  show.value = false;            // now let <if> remove it
}
```

For enter, call `enter(node)` when the `<if>` branch mounts (in the branch
component's boot).

## Reference

- `animate(el, keyframes, opts)` — raw WAAPI wrapper.
- `flip(...)` — list-reorder (FLIP), documented separately.
- `viewTransition(fn)` — browser View Transitions crossfade around a mutation.

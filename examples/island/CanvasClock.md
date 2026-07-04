---
name: CanvasClock
tag: canvas-clock
render:
  static: never
  hydrate: eager
---

# CanvasClock

An island component wrapping an imperative `<canvas>` animation loop — the same
pattern used to wrap Cytoscape.js, Monaco, or D3. The framework guarantees:

- `onMount` runs after the template DOM exists and the host is connected.
- The cleanup returned from `onMount` runs on `disconnectedCallback`.
- `ctx.effect(...)` disposes automatically on unmount.

```ts props
export type Props = { size: number };
```

```html template
<canvas #face></canvas>
```

```ts script
// no reactive body — the canvas is driven imperatively in onMount
```

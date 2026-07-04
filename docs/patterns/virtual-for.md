# Pattern: virtualized `<for>` (windowed list rendering)

Windowing is a **mode of `<for>`**, opted into with `viewport="virtual"`. It
renders only the visible slice of a long list plus a small overscan, mounting
and unmounting rows as the user scrolls, so the DOM node count stays bounded no
matter how long the list is.

```html
<for
  each=${ingredients}
  item="ing"
  key="ing.id"
  viewport="virtual"
  row-height="48"
  overscan="6">
  <ingredient-row data=${ing}/>
</for>
```

A plain `<for>` (no `viewport`) renders every row, as before — same `each` /
`item` / `key`. `<virtual-for>` remains as an alias for the windowed form.

## Attributes

| Attribute | Meaning |
|---|---|
| `viewport` | `"virtual"` (or `"windowed"`) turns on windowing; omit for a plain list |
| `each` | reactive array (required) |
| `item` | row scope variable (default `item`) |
| `key` | expression yielding a stable id per row |
| `row-height` | fixed row height in px (required) |
| `overscan` | extra rows above/below the window (default 4) |
| `scroll-parent` | `"self"` (default, the element scrolls) or an ancestor selector |
| `debug` | emit `data-virtual-window="start,end,total"` on the host |

## Behaviour

- Renders `(visible + 2·overscan)` rows regardless of `each.length`.
- Total scroll height = `row-height × each.length`; a spacer preserves scroll
  position. The windowed rows sit in a layer translated by the window offset.
- **Keyed reconcile** — a row with the same `key` keeps its DOM node identity
  across window shifts, so form state (checkbox focus, inputs) survives scroll.
- Mutating the array outside the window rebuilds the window next tick without
  remounting unchanged keys.
- By default the element is its own scroll container (`overflow: auto`,
  `contain: strict`). Set `scroll-parent="<selector>"` when an ancestor scrolls.

## Programmatic scroll

The element (grab it with a `#ref`) exposes:

```ts
listRef.scrollToIndex(1000);   // align row 1000 into view
listRef.scrollToKey('ing-42'); // resolve key → index → scroll
```

## Sorting / filtering

Pass an already sorted/filtered array — the directive never reorders. Changing
the array reference re-windows on the next tick.

## Not yet supported (design leaves room)

- Variable row height (`row-height="auto"` via `ResizeObserver`) — planned.
- Horizontal / grid virtualization, sticky group headers.

See `examples/virtual/IngredientList.dtx`.

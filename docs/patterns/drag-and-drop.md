# Pattern: Drag & Drop traits

Pointer-Event based traits that turn plain elements into drag sources, drop
targets, and reorderable lists — no HTML5 DnD, so mouse and touch behave the
same and canvas drops get real coordinates.

Register once at startup:

```ts
import { registerDnd } from 'ui-detox';
registerDnd();
```

## draggable

```html
<li use="draggable" data-payload=${JSON.stringify({ kind: 'ingredient', id: ing.id })}>
  ${ing.name}
</li>
```

Payload comes from `data-payload` (JSON) or a `.dragPayload=${obj}` property.

Params (`:handle`, `:threshold`, `:axis`, `:ghost`, `:long-press`):

| Param | Default | Meaning |
|---|---|---|
| `handle` | — | CSS selector; drag only when the pointer starts inside it |
| `threshold` | 4 | px of movement before a drag starts |
| `axis` | — | `'x'` or `'y'` to constrain the ghost |
| `ghost` | `'clone'` | `'clone'`, `'none'`, or a selector to clone |
| `longPress` | 300 | ms hold before a **touch** drag arms (mouse arms instantly) |

Lifecycle CustomEvents fire on the source **and** on `document.body`:
`drag:start`, `drag:move`, `drag:end`, `drag:cancel` — detail
`{ payload, clientX, clientY, source }`. While dragging,
`document.body[data-dragging]` is set (for a global grabbing cursor). Escape,
pointer-cancel, and tab-hide all cancel the drag and remove the ghost.

## droppable

```html
<div use="droppable" :accept=${'ingredient,operation'} @drop-payload=${(e) => place(e.detail)}>
  …
</div>
```

- `accept` — comma list of payload `kind`s (empty = accept all).
- While an accepted payload hovers within bounds, `[data-drop-active]` is set.
- On drop, fires `drop-payload` with
  `{ payload, clientX, clientY, offsetX, offsetY }` — offsets are relative to the
  target, ready for canvas node placement.
- `:autoScroll=${true}` scrolls an `overflow:auto` target when the pointer nears
  its edge.

## sortable

```html
<ol use="sortable" @reorder=${(e) => arr.moveTo(e.detail.from, e.detail.to)}>
  <for each=${arr} item="x" key="x.id">
    <li use="sortable-item" data-sort-id=${x.id}>${x.label}</li>
  </for>
</ol>
```

`reorder` detail: `{ from: number, to: number, id: unknown }`. Foreign payloads
can't drop into the list. Pairs naturally with a forms array field
(`field.moveTo(from, to)`).

### Grouped (cross-list) sortable

Give lists a `:group` (and a `data-list` id) so items drag **between** them — a
Kanban board move:

```html
<board-column use="sortable" :group=${'board'} data-list="todo" @sort-move=${(e) => move(e.detail)}>
  <for each=${col.cards} item="card" key="card.id">
    <artifact-card use="sortable-item" data-sort-id=${card.id}>…</artifact-card>
  </for>
</board-column>
```

- Same-list drop → `reorder` `{ from, to, id }` (unchanged).
- Drop into another list of the same group → `sort-move`
  `{ id, fromList, toList, fromIndex, toIndex }` on the **source** list;
  `toIndex` is the insertion index in the destination.
- A list without a group stays isolated (reorder-only).

> Animated reflow (FLIP) on reorder is not wired yet — `anim`'s `flip` can be
> layered on in a follow-up.

See `examples/dnd/Palette.dtx`.

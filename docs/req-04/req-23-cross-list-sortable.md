# REQ-23 — Cross-list sortable (Kanban board moves)

**Requested by:** SOPP / ALM frontend
**Priority:** **P1** — the SOPP Kanban board is the flagship view and needs
precise drag & drop between columns.

## Symptom / gap

The board uses `draggable` + `droppable` traits today. That works, but a drop
only lands at the **end** of the destination column — the `droppable` trait
reports `{ payload, clientX, clientY, offsetX, offsetY }` but not an **insertion
index** among the destination's items, so we can't drop *between* two cards.

`sortable` + `sortable-item` give a precise `@reorder { from, to, id }` — but
only **within one list** ("Foreign payloads can't drop in", per REFERENCE §16).
A Kanban needs both: reorder within a column *and* move a card into another
column at a chosen index.

## Request

A grouped-sortable mode so items can be dragged **between** sortable lists that
share a group, reporting the source list, destination list and destination
index — the SortableJS `group` model.

Proposed shape:

```html
<board-column use="sortable" :group=${'board'} data-list="todo"
  @sort-move=${(e) => onMove(e.detail)}>
  <for each=${col.cards} item="card" key="card.id">
    <artifact-card use="sortable-item" data-sort-id=${card.id}>…</artifact-card>
  </for>
</board-column>
```

`sort-move` detail:

```ts
{ id: string;
  fromList: string;   // data-list of the source column
  toList: string;     // data-list of the destination column
  fromIndex: number;
  toIndex: number;    // insertion index within the destination
}
```

Same-list moves keep firing `@reorder` (back-compat); cross-list moves fire
`@sort-move`. `:group` gates which lists accept each other (a list with no group
stays isolated, as today).

## Why it matters to the consumer

With `toIndex` we compute the Lexorank between the two destination neighbours
(`rankBetween(cards[toIndex-1], cards[toIndex])`) and issue exactly one
`artifact.reorder` command — a single-row write. Without it we can only append,
which forces a coarser UX and extra re-rank round-trips.

## Acceptance

- Two `use="sortable" :group="board"` lists; dragging an item from one into the
  other at a mid position fires `@sort-move` with correct `toIndex`.
- Escape / pointer-cancel aborts cleanly (as the existing traits do).
- Touch + mouse parity; `test:visual` covers a cross-column move.

# REQ-05 — Drag & Drop Traits

**Requested by:** Culinary frontend
**Priority:** P1 (Graph editor palette needs it; can start with hand-rolled Pointer events)
**Estimated effort:** small (3-5 days)

## Purpose

Provide reusable traits that turn native HTML elements into draggable sources and drop targets, without wrapping them in a custom element. Uses Pointer Events (not HTML5 drag-and-drop) so we get consistent behavior across desktop and touch, and can drop onto a canvas element with computed coordinates.

## Motivating use cases from Culinary

1. **Ingredient palette → graph canvas**: drag a `<PaletteItem>` (ingredient) onto the DAG editor. On drop, create a leaf node at the pointer coordinates.
2. **Operation palette → graph edge**: drag an operation onto an existing edge to replace its operation type.
3. **Reorder steps in cooking-mode preview** (post-MVP but same primitive).
4. **Reorder nutrients in ingredient form**: drag rows in an array field.

## Proposed API

### Draggable source

```html
<li use="draggable" data-payload=${JSON.stringify({ kind: 'ingredient', id: ing.id })}>
  ${ing.name}
</li>
```

Or with expression payload:

```html
<li use="draggable" .drag-payload=${{ kind: 'ingredient', id: ing.id }}>...</li>
```

Trait attaches:
- Pointer-down starts a drag after threshold (default 4 px movement).
- Creates a ghost element (clone of the source with `.dragging` class) positioned under the pointer.
- Dispatches lifecycle CustomEvents on the source: `drag:start`, `drag:move`, `drag:end`, `drag:cancel`.
- Sets `document.body.dataset.dragging = 'true'` while active (for global cursor / cursor override CSS).

### Drop target

```html
<div use="droppable"
     accept="ingredient,operation"
     @drop-payload=${(e) => handleDrop(e.detail)}>
  ...
</div>
```

Trait attaches:
- Listens to `drag:move` on `document.body`; when pointer is within bounds and `payload.kind` matches `accept`, sets `[data-drop-active]="true"`.
- On drop, fires `drop-payload` CustomEvent with `detail = { payload, clientX, clientY, offsetX, offsetY }`.

### Canvas drop (for Cytoscape)

The graph editor's canvas doesn't want CSS pseudo-states; it wants coordinates. Use the same trait but consume the raw event:

```html
<GraphEditor use="droppable" accept="ingredient" @drop-payload=${(e) => graph.addNode(e.detail)}>
```

The canvas wrapper (custom element) forwards `drop-payload` up.

### Reorderable list

Composite trait or a helper directive:

```html
<ol use="sortable" @reorder=${(e) => arr.moveItem(e.detail.from, e.detail.to)}>
  <for each=${arr} item="x" key="x.id">
    <li use="sortable-item">${x.label}</li>
  </for>
</ol>
```

`reorder` event: `{ from: number, to: number, id: unknown }`.

### Options

`use="draggable"` accepts inline params:

```html
<li use="draggable(handle='.grip', threshold=6, axis='y')">...</li>
```

Options:
- `handle` — CSS selector for the grip area (drag only when pointer starts inside).
- `threshold` — px to move before drag starts (default 4).
- `axis` — `'x' | 'y' | null` (constrain axis).
- `ghost` — `'clone' | 'none' | selector` (default `'clone'`).

### Touch behavior

- Long-press (default 300 ms) required to start drag on touch; suppresses page scroll during drag via `touch-action: none`.
- Auto-cancel on visibility change or pointer-cancel.

### Auto-scroll on edge

When a drop target has `overflow: auto` and pointer is within 40 px of its edge, scroll it. Off by default; enabled via `use="droppable(autoScroll=true)"`.

## Acceptance criteria

- [ ] `draggable` trait works with mouse and touch (Pointer Events).
- [ ] `droppable` trait fires `drop-payload` with computed coordinates relative to itself.
- [ ] `accept` filtering works.
- [ ] `sortable` trait fires `reorder` and prevents drops of foreign payloads.
- [ ] Escape key cancels active drag.
- [ ] Ghost element is removed on end/cancel.
- [ ] Works across Chromium, Firefox, WebKit (Playwright test).
- [ ] Example: `examples/dnd/` — palette + list + canvas drop demo.

## Out of scope

- Multi-select drag (drag N items at once).
- File drop from OS (needs HTML5 DnD API; not needed for Culinary MVP).
- Draggable between different windows / iframes.

## Open questions

1. Where to keep global drag state — module singleton or on `registry`? Registry avoids leaks across test isolation.
2. Should `sortable` handle animated reflow (FLIP)? Nice-to-have; UIDetox already has `flip` in `anim`. Wire it if trivial.

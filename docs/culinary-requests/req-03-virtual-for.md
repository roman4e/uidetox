# REQ-03 — `<virtual-for>` Directive (windowed list rendering)

**Requested by:** Culinary frontend
**Priority:** P1 (needed for USDA ingredient list; can start with plain `<for>` and swap in)
**Estimated effort:** medium (5-8 days)

## Purpose

Render only the visible slice of a long list plus a small overscan, mount/unmount items as the user scrolls. Keeps DOM node count bounded regardless of list length.

## Motivating use cases from Culinary

1. **Ingredient library** — USDA seed contains ~8000 foundation foods. Rendering all rows kills scrolling.
2. **Similar-ingredients dropdown** — up to a few hundred candidates during live search.
3. **Nutrient table on the recipe card** — ~150 nutrient rows; not huge, but the same directive should handle it.
4. **Comparison view — nutrient delta table** — 150 rows × 3 columns; sortable by |delta|.

## Proposed API

### Fixed row height

```html
<virtual-for
  each=${ingredients}
  item="ing"
  key="ing.id"
  row-height="48"
  overscan="6">
  <IngredientRow data=${ing}/>
</virtual-for>
```

Attributes:
- `each` — reactive array.
- `item` — scope variable (default `item`).
- `key` — expression yielding stable id per row.
- `row-height` — px (fixed).
- `overscan` — extra rows above/below visible window (default 4).

Emits a spacer top/bottom sized to preserve scroll position.

### Variable row height (Phase 2 — mark TODO)

Later: `row-height="auto"` measures rows via `ResizeObserver`, caches per-key, falls back to estimated height until measured. Not required for MVP but design must not preclude.

### Scroll container

By default the `<virtual-for>` element itself is `overflow: auto`. Prop `scroll-parent="host"` (or a selector) reads scroll from an ancestor — needed when the outer layout provides scrolling.

### Sorted / filtered inputs

Consumer passes an already sorted/filtered array. Directive does not sort. Changing the reference array (or its length) rebuilds the window in the next tick without full remount of unchanged keys.

### Keyed reconcile

Row DOM nodes with the same `key` are re-used across window shifts. New keys mount, exited keys unmount. Important for form state inside rows (checkboxes retain focus).

### Programmatic scroll

```ts
const listRef = ref<HTMLElement>();
listRef.value?.scrollToKey('ing-42');       // aligns row into view
listRef.value?.scrollToIndex(1000);
```

Exposed via `ref` on the element (see phase 3f element refs).

### Debug output

In debug builds: expose `data-virtual-window="start,end,total"` on the host element.

## Acceptance criteria

- [ ] Renders only `(end - start + 2 * overscan)` DOM rows regardless of `each.length`.
- [ ] Correct scroll height computed from `row-height * each.length + margins`.
- [ ] Scroll position preserved when the array is mutated at indices outside the window.
- [ ] Keyed reconcile: same-key row's DOM node identity is preserved across scroll.
- [ ] Works inside custom-element (both when the CE host is the scroll container and when an ancestor is).
- [ ] Playwright test: scroll a 10 000-item list, assert live DOM node count < 40.
- [ ] Unit tests: window math for edge cases (empty, one item, exact multiple of row height).

## Out of scope for this request

- Horizontal virtualization.
- Grid / two-dimensional virtualization.
- Sticky headers per group.

## Open questions

1. New directive name (`<virtual-for>`) or attribute on existing `<for>` (`<for virtual row-height=...>`)? Attribute is nicer but changes `<for>` codegen. Prefer new directive.
2. Should the directive own the CSS for scrolling or leave it to the consumer? Suggest: apply `contain: strict` and `overflow: auto` by default; consumer opts out with `scroll-parent`.

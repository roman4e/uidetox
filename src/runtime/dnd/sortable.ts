interface PointerLike {
  clientX?: number;
  clientY?: number;
  target?: EventTarget | null;
}

/** Marks an element as a sortable row (discovered by the parent `sortable` trait). */
export function attachSortableItem(el: Element): () => void {
  (el as HTMLElement).dataset.sortableItem = '';
  (el as HTMLElement).style.touchAction = 'none';
  return () => { delete (el as HTMLElement).dataset.sortableItem; };
}

// Grouped sortable lists that accept each other's items (SortableJS `group`).
const groups = new Map<string, Set<HTMLElement>>();

function itemsOf(c: Element): HTMLElement[] {
  return Array.from(c.querySelectorAll<HTMLElement>('[data-sortable-item]'));
}

/** Insertion index within `c` for a pointer at `y`. */
function targetIndex(c: Element, y: number): number {
  const list = itemsOf(c);
  for (let i = 0; i < list.length; i++) {
    const r = list[i].getBoundingClientRect();
    if (y < r.top + r.height / 2) return i;
  }
  return list.length;
}

/**
 * List-reorder behavior. Same-list moves emit `reorder` `{ from, to, id }`.
 * With a `group` (`:group=`), an item dragged into another list of the same
 * group emits `sort-move` `{ id, fromList, toList, fromIndex, toIndex }` on the
 * source list. A list without a group stays isolated (reorder-only).
 */
export function attachSortable(container: Element, params: Record<string, unknown> = {}): () => void {
  const host = container as HTMLElement;
  const group = (params.group as string | undefined) ?? host.dataset.group ?? undefined;
  if (group) {
    if (!groups.has(group)) groups.set(group, new Set());
    groups.get(group)!.add(host);
  }
  const listId = (): string | null => host.dataset.list ?? null;

  let fromIndex = -1;
  let pressedId: unknown = null;
  let dragging = false;

  const destUnder = (x: number, y: number): HTMLElement => {
    if (group) {
      for (const c of groups.get(group)!) {
        const r = c.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return c;
      }
    }
    return host;
  };

  const onMove = (): void => { dragging = true; };

  const onUp = (e: Event): void => {
    const p = e as unknown as PointerLike;
    teardown();
    if (!dragging || fromIndex < 0) { fromIndex = -1; dragging = false; return; }
    const y = p.clientY ?? 0;
    const dest = destUnder(p.clientX ?? 0, y);
    const to = targetIndex(dest, y);

    if (dest === host) {
      let adj = to;
      if (adj > fromIndex) adj -= 1; // removing the dragged row shifts trailing indices
      if (adj !== fromIndex) {
        host.dispatchEvent(new CustomEvent('reorder', { detail: { from: fromIndex, to: adj, id: pressedId } }));
      }
    } else {
      host.dispatchEvent(new CustomEvent('sort-move', {
        detail: {
          id: pressedId,
          fromList: listId(),
          toList: (dest.dataset.list ?? null),
          fromIndex,
          toIndex: to,
        },
      }));
    }
    fromIndex = -1;
    dragging = false;
  };

  function teardown(): void {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
  }

  const onDown = (e: Event): void => {
    const target = (e as unknown as PointerLike).target as Element | null;
    const item = target?.closest('[data-sortable-item]');
    if (!item || !container.contains(item)) return;
    fromIndex = itemsOf(container).indexOf(item as HTMLElement);
    pressedId = (item as HTMLElement).dataset.sortId ?? fromIndex;
    dragging = false;
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  container.addEventListener('pointerdown', onDown);
  return () => {
    container.removeEventListener('pointerdown', onDown);
    teardown();
    if (group) groups.get(group)?.delete(host);
  };
}

interface PointerLike {
  clientY?: number;
  target?: EventTarget | null;
}

/** Marks an element as a sortable row (discovered by the parent `sortable` trait). */
export function attachSortableItem(el: Element): () => void {
  (el as HTMLElement).dataset.sortableItem = '';
  (el as HTMLElement).style.touchAction = 'none';
  return () => { delete (el as HTMLElement).dataset.sortableItem; };
}

/** Attaches list-reorder behavior; emits a `reorder` event with `{ from, to, id }`. */
export function attachSortable(container: Element, _params: Record<string, unknown> = {}): () => void {
  const items = (): HTMLElement[] =>
    Array.from(container.querySelectorAll<HTMLElement>('[data-sortable-item]'));

  let fromIndex = -1;
  let pressedId: unknown = null;
  let dragging = false;

  const targetIndex = (y: number): number => {
    const list = items();
    for (let i = 0; i < list.length; i++) {
      const r = list[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) return i;
    }
    return Math.max(0, list.length - 1);
  };

  const onMove = (): void => { dragging = true; };

  const onUp = (e: Event): void => {
    const y = (e as unknown as PointerLike).clientY ?? 0;
    teardown();
    if (!dragging || fromIndex < 0) return;
    let to = targetIndex(y);
    // Removing the dragged row before re-inserting shifts indices after it.
    if (to > fromIndex) to -= 1;
    if (to !== fromIndex) {
      container.dispatchEvent(new CustomEvent('reorder', {
        detail: { from: fromIndex, to, id: pressedId },
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
    const list = items();
    fromIndex = list.indexOf(item as HTMLElement);
    pressedId = (item as HTMLElement).dataset.sortId ?? fromIndex;
    dragging = false;
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  container.addEventListener('pointerdown', onDown);
  return () => {
    container.removeEventListener('pointerdown', onDown);
    teardown();
  };
}

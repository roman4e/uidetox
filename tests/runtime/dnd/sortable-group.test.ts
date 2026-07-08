import { describe, expect, it, afterEach } from 'vitest';
import { attachSortable, attachSortableItem } from '../../../src/runtime/dnd/sortable.js';

function pev(type: string, opts: { x?: number; y?: number; target?: EventTarget } = {}): Event {
  const e = new Event(type, { bubbles: true });
  Object.assign(e, { clientX: opts.x ?? 0, clientY: opts.y ?? 0 });
  if (opts.target) Object.defineProperty(e, 'target', { value: opts.target });
  return e;
}

let cleanups: Array<() => void> = [];
afterEach(() => { cleanups.forEach((c) => c()); cleanups = []; document.body.innerHTML = ''; });

function rect(el: HTMLElement, r: { left: number; top: number; right: number; bottom: number }): void {
  el.getBoundingClientRect = () => ({
    left: r.left, top: r.top, right: r.right, bottom: r.bottom,
    width: r.right - r.left, height: r.bottom - r.top, x: r.left, y: r.top, toJSON() {},
  }) as DOMRect;
}

function column(list: string, ids: string[], colRect: { left: number; top: number; right: number; bottom: number }): { el: HTMLElement; items: HTMLElement[] } {
  const el = document.createElement('div');
  el.dataset.list = list;
  document.body.appendChild(el);
  rect(el, colRect);
  const items = ids.map((id, i) => {
    const li = document.createElement('div');
    li.dataset.sortId = id;
    el.appendChild(li);
    cleanups.push(attachSortableItem(li));
    rect(li, { left: colRect.left, top: colRect.top + i * 40, right: colRect.right, bottom: colRect.top + i * 40 + 40 });
    return li;
  });
  cleanups.push(attachSortable(el, { group: 'board' }));
  return { el, items };
}

describe('grouped sortable / cross-list moves (REQ-23)', () => {
  it('fires sort-move with fromList/toList/indices when dropping into another list', () => {
    const A = column('todo', ['a1', 'a2'], { left: 0, top: 0, right: 100, bottom: 200 });
    const B = column('doing', ['b1'], { left: 100, top: 0, right: 200, bottom: 200 });
    const moves: CustomEvent[] = [];
    A.el.addEventListener('sort-move', (e) => moves.push(e as CustomEvent));

    // drag a1 (in A) to the top of B (x in B, y in B's first slot)
    A.el.dispatchEvent(pev('pointerdown', { target: A.items[0] }));
    document.dispatchEvent(pev('pointermove', { x: 150, y: 10 }));
    document.dispatchEvent(pev('pointerup', { x: 150, y: 10 }));

    expect(moves).toHaveLength(1);
    expect(moves[0].detail).toEqual({ id: 'a1', fromList: 'todo', toList: 'doing', fromIndex: 0, toIndex: 0 });
    void B;
  });

  it('same-list drop still fires reorder (back-compat)', () => {
    const A = column('todo', ['a1', 'a2', 'a3'], { left: 0, top: 0, right: 100, bottom: 200 });
    column('doing', ['b1'], { left: 100, top: 0, right: 200, bottom: 200 });
    const reorders: CustomEvent[] = [];
    const moves: CustomEvent[] = [];
    A.el.addEventListener('reorder', (e) => reorders.push(e as CustomEvent));
    A.el.addEventListener('sort-move', (e) => moves.push(e as CustomEvent));

    // drag a1 down within A (pointer stays in A)
    A.el.dispatchEvent(pev('pointerdown', { target: A.items[0] }));
    document.dispatchEvent(pev('pointermove', { x: 50, y: 90 }));
    document.dispatchEvent(pev('pointerup', { x: 50, y: 90 }));

    expect(moves).toHaveLength(0);
    expect(reorders).toHaveLength(1);
    expect(reorders[0].detail).toMatchObject({ from: 0, id: 'a1' });
  });

  it('a list without a group stays isolated (no cross-list)', () => {
    const el = document.createElement('div');
    el.dataset.list = 'solo';
    document.body.appendChild(el);
    rect(el, { left: 0, top: 0, right: 100, bottom: 100 });
    const li = document.createElement('div'); li.dataset.sortId = 's1'; el.appendChild(li);
    rect(li, { left: 0, top: 0, right: 100, bottom: 40 });
    cleanups.push(attachSortableItem(li));
    cleanups.push(attachSortable(el)); // no group
    const moves: CustomEvent[] = [];
    el.addEventListener('sort-move', (e) => moves.push(e as CustomEvent));
    el.dispatchEvent(pev('pointerdown', { target: li }));
    document.dispatchEvent(pev('pointermove', { x: 999, y: 999 }));
    document.dispatchEvent(pev('pointerup', { x: 999, y: 999 }));
    expect(moves).toHaveLength(0); // isolated → never sort-move
  });
});

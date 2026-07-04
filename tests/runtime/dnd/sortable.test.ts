import { describe, expect, it, afterEach } from 'vitest';
import { attachSortable, attachSortableItem } from '../../../src/runtime/dnd/sortable.js';

function pev(type: string, opts: { y?: number; target?: EventTarget } = {}): Event {
  const e = new Event(type, { bubbles: true });
  Object.assign(e, { clientY: opts.y ?? 0 });
  if (opts.target) Object.defineProperty(e, 'target', { value: opts.target });
  return e;
}

let cleanups: Array<() => void> = [];
afterEach(() => { cleanups.forEach((c) => c()); cleanups = []; document.body.innerHTML = ''; });

function buildList(ids: string[]): { ol: HTMLElement; lis: HTMLElement[] } {
  const ol = document.createElement('ol');
  document.body.appendChild(ol);
  const lis = ids.map((id, i) => {
    const li = document.createElement('li');
    li.dataset.sortId = id;
    ol.appendChild(li);
    cleanups.push(attachSortableItem(li));
    li.getBoundingClientRect = () => ({
      top: i * 40, bottom: i * 40 + 40, height: 40, left: 0, right: 100, width: 100, x: 0, y: i * 40, toJSON() {},
    }) as DOMRect;
    return li;
  });
  cleanups.push(attachSortable(ol));
  return { ol, lis };
}

describe('sortable trait', () => {
  it('emits reorder with from/to/id when a row is moved down', () => {
    const { ol, lis } = buildList(['a', 'b', 'c', 'd']);
    const events: CustomEvent[] = [];
    ol.addEventListener('reorder', (e) => events.push(e as CustomEvent));

    // press row 0 ('a'), release over the 3rd slot (y in row 2)
    ol.dispatchEvent(pev('pointerdown', { target: lis[0] }));
    document.dispatchEvent(pev('pointermove', { y: 90 }));
    document.dispatchEvent(pev('pointerup', { y: 90 })); // over index 2 → adjusted to 1? no: to=2, from=0 → to-1=1
    expect(events).toHaveLength(1);
    expect(events[0].detail).toMatchObject({ from: 0, id: 'a' });
    expect(events[0].detail.to).toBe(1);
  });

  it('does not emit when dropped in the same position', () => {
    const { ol, lis } = buildList(['a', 'b', 'c']);
    const events: CustomEvent[] = [];
    ol.addEventListener('reorder', (e) => events.push(e as CustomEvent));
    ol.dispatchEvent(pev('pointerdown', { target: lis[1] }));
    document.dispatchEvent(pev('pointermove', { y: 50 })); // still within row 1
    document.dispatchEvent(pev('pointerup', { y: 50 }));
    expect(events).toHaveLength(0);
  });

  it('ignores pointerdown outside any sortable item', () => {
    const { ol } = buildList(['a', 'b']);
    const events: CustomEvent[] = [];
    ol.addEventListener('reorder', (e) => events.push(e as CustomEvent));
    ol.dispatchEvent(pev('pointerdown', { target: ol }));
    document.dispatchEvent(pev('pointermove', { y: 80 }));
    document.dispatchEvent(pev('pointerup', { y: 80 }));
    expect(events).toHaveLength(0);
  });
});

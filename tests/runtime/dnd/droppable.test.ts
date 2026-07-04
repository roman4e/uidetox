import { describe, expect, it, afterEach } from 'vitest';
import { attachDroppable } from '../../../src/runtime/dnd/droppable.js';
import { emitDrag } from '../../../src/runtime/dnd/bus.js';

let cleanup: (() => void) | null = null;
afterEach(() => { cleanup?.(); cleanup = null; document.body.innerHTML = ''; });

function makeZone(rect: { left: number; top: number; right: number; bottom: number }): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  el.getBoundingClientRect = () => ({
    left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
    width: rect.right - rect.left, height: rect.bottom - rect.top, x: rect.left, y: rect.top, toJSON() {},
  }) as DOMRect;
  return el;
}

const source = document.createElement('div');

describe('droppable trait', () => {
  it('activates when an accepted payload hovers within bounds', () => {
    const el = makeZone({ left: 0, top: 0, right: 100, bottom: 100 });
    cleanup = attachDroppable(el, { accept: 'ingredient' });
    emitDrag('drag:move', { payload: { kind: 'ingredient' }, clientX: 50, clientY: 50, source });
    expect(el.dataset.dropActive).toBe('true');
    emitDrag('drag:move', { payload: { kind: 'ingredient' }, clientX: 500, clientY: 500, source });
    expect(el.dataset.dropActive).toBeUndefined();
  });

  it('rejects a payload whose kind is not accepted', () => {
    const el = makeZone({ left: 0, top: 0, right: 100, bottom: 100 });
    cleanup = attachDroppable(el, { accept: 'operation' });
    emitDrag('drag:move', { payload: { kind: 'ingredient' }, clientX: 50, clientY: 50, source });
    expect(el.dataset.dropActive).toBeUndefined();
  });

  it('fires drop-payload with coordinates relative to itself', () => {
    const el = makeZone({ left: 20, top: 10, right: 120, bottom: 110 });
    const drops: CustomEvent[] = [];
    el.addEventListener('drop-payload', (e) => drops.push(e as CustomEvent));
    cleanup = attachDroppable(el, { accept: 'ingredient' });
    emitDrag('drag:move', { payload: { kind: 'ingredient' }, clientX: 60, clientY: 40, source });
    emitDrag('drag:end', { payload: { kind: 'ingredient', id: 3 }, clientX: 60, clientY: 40, source });
    expect(drops).toHaveLength(1);
    expect(drops[0].detail).toMatchObject({ offsetX: 40, offsetY: 30 });
    expect((drops[0].detail.payload as { id: number }).id).toBe(3);
    expect(el.dataset.dropActive).toBeUndefined();
  });

  it('does not drop when the pointer is outside on end', () => {
    const el = makeZone({ left: 0, top: 0, right: 100, bottom: 100 });
    const drops: CustomEvent[] = [];
    el.addEventListener('drop-payload', (e) => drops.push(e as CustomEvent));
    cleanup = attachDroppable(el, { accept: 'ingredient' });
    emitDrag('drag:end', { payload: { kind: 'ingredient' }, clientX: 999, clientY: 999, source });
    expect(drops).toHaveLength(0);
  });

  it('accepts any payload when accept is empty', () => {
    const el = makeZone({ left: 0, top: 0, right: 100, bottom: 100 });
    cleanup = attachDroppable(el);
    emitDrag('drag:move', { payload: { kind: 'anything' }, clientX: 10, clientY: 10, source });
    expect(el.dataset.dropActive).toBe('true');
  });
});

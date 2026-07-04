import { describe, expect, it, afterEach } from 'vitest';
import { attachDraggable } from '../../../src/runtime/dnd/draggable.js';

function pev(type: string, opts: { x?: number; y?: number; pointerType?: string; key?: string } = {}): Event {
  const e = new Event(type, { bubbles: true });
  Object.assign(e, { clientX: opts.x ?? 0, clientY: opts.y ?? 0, pointerType: opts.pointerType ?? 'mouse', key: opts.key });
  return e;
}

let cleanup: (() => void) | null = null;
afterEach(() => {
  cleanup?.();
  cleanup = null;
  document.body.innerHTML = '';
  delete document.body.dataset.dragging;
});

function makeSource(payload: unknown): HTMLElement {
  const el = document.createElement('li');
  el.dataset.payload = JSON.stringify(payload);
  el.textContent = 'item';
  document.body.appendChild(el);
  return el;
}

describe('draggable trait', () => {
  it('starts a drag after the movement threshold and creates a ghost', () => {
    const el = makeSource({ kind: 'ingredient', id: 7 });
    const starts: CustomEvent[] = [];
    document.body.addEventListener('drag:start', (e) => starts.push(e as CustomEvent));
    cleanup = attachDraggable(el, { threshold: 4 });

    el.dispatchEvent(pev('pointerdown', { x: 0, y: 0 }));
    document.dispatchEvent(pev('pointermove', { x: 2, y: 0 })); // below threshold
    expect(starts).toHaveLength(0);
    document.dispatchEvent(pev('pointermove', { x: 10, y: 0 })); // crosses threshold
    expect(starts).toHaveLength(1);
    expect(starts[0].detail.payload).toEqual({ kind: 'ingredient', id: 7 });
    expect(document.body.dataset.dragging).toBe('true');
    expect(document.querySelector('.dragging')).toBeTruthy();
  });

  it('emits drag:move while dragging and drag:end + removes ghost on pointerup', () => {
    const el = makeSource({ id: 1 });
    const moves: CustomEvent[] = [];
    const ends: CustomEvent[] = [];
    document.body.addEventListener('drag:move', (e) => moves.push(e as CustomEvent));
    document.body.addEventListener('drag:end', (e) => ends.push(e as CustomEvent));
    cleanup = attachDraggable(el);

    el.dispatchEvent(pev('pointerdown', { x: 0, y: 0 }));
    document.dispatchEvent(pev('pointermove', { x: 20, y: 0 }));
    document.dispatchEvent(pev('pointermove', { x: 30, y: 5 }));
    expect(moves.length).toBeGreaterThanOrEqual(1);
    document.dispatchEvent(pev('pointerup', { x: 30, y: 5 }));
    expect(ends).toHaveLength(1);
    expect(ends[0].detail.clientX).toBe(30);
    expect(document.querySelector('.dragging')).toBeNull();
    expect(document.body.dataset.dragging).toBeUndefined();
  });

  it('cancels the drag on Escape', () => {
    const el = makeSource({ id: 1 });
    const cancels: CustomEvent[] = [];
    document.body.addEventListener('drag:cancel', (e) => cancels.push(e as CustomEvent));
    cleanup = attachDraggable(el);
    el.dispatchEvent(pev('pointerdown', { x: 0, y: 0 }));
    document.dispatchEvent(pev('pointermove', { x: 20, y: 0 }));
    document.dispatchEvent(pev('keydown', { key: 'Escape' }));
    expect(cancels).toHaveLength(1);
    expect(document.querySelector('.dragging')).toBeNull();
  });

  it('does not arm a touch drag before the long-press elapses', () => {
    const el = makeSource({ id: 1 });
    const starts: CustomEvent[] = [];
    document.body.addEventListener('drag:start', (e) => starts.push(e as CustomEvent));
    cleanup = attachDraggable(el, { longPress: 300 });
    el.dispatchEvent(pev('pointerdown', { x: 0, y: 0, pointerType: 'touch' }));
    document.dispatchEvent(pev('pointermove', { x: 40, y: 0, pointerType: 'touch' }));
    expect(starts).toHaveLength(0); // long-press timer not fired
  });

  it('respects a handle selector', () => {
    const el = document.createElement('li');
    el.dataset.payload = '{}';
    const grip = document.createElement('span');
    grip.className = 'grip';
    el.appendChild(grip);
    const body = document.createElement('span');
    el.appendChild(body);
    document.body.appendChild(el);
    const starts: CustomEvent[] = [];
    document.body.addEventListener('drag:start', (e) => starts.push(e as CustomEvent));
    cleanup = attachDraggable(el, { handle: '.grip' });

    // pointerdown not on the grip → ignored
    const downOnBody = pev('pointerdown', { x: 0, y: 0 });
    Object.defineProperty(downOnBody, 'target', { value: body });
    el.dispatchEvent(downOnBody);
    document.dispatchEvent(pev('pointermove', { x: 20, y: 0 }));
    expect(starts).toHaveLength(0);
  });
});

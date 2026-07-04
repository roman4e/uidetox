import { describe, expect, it } from 'vitest';
import { renderVirtualFor } from '../../../src/runtime/directives/virtualForBlock.js';
import { state } from '../../../src/runtime/state.js';
import { flushSync } from '../../../src/runtime/scheduler.js';

interface Row { id: number; label: string }

function makeList(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({ id: i, label: `row-${i}` }));
}

const ctx = {} as never;

function rows(container: HTMLElement): HTMLElement[] {
  const layer = container.firstChild!.firstChild as HTMLElement; // sizer > layer
  return Array.from(layer.children) as HTMLElement[];
}

describe('renderVirtualFor', () => {
  it('renders only the windowed slice, not the whole list', () => {
    const s = state({ items: makeList(10_000) });
    let scrollTop = 0;
    const el = renderVirtualFor<Row>(
      () => s.items,
      (r) => r.id,
      (r) => { const d = document.createElement('div'); d.textContent = r.label; return d; },
      ctx,
      { rowHeight: 48, overscan: 4, metrics: () => ({ scrollTop, viewportHeight: 480 }) },
    );
    // window at top: 10 visible + 4 overscan + 1 = 15 rows
    expect(rows(el).length).toBe(15);
    expect(rows(el).length).toBeLessThan(40);
  });

  it('sets total scroll height from row-height * count', () => {
    const s = state({ items: makeList(100) });
    const el = renderVirtualFor<Row>(
      () => s.items, (r) => r.id,
      (r) => { const d = document.createElement('div'); d.textContent = r.label; return d; },
      ctx, { rowHeight: 48, metrics: () => ({ scrollTop: 0, viewportHeight: 480 }) },
    );
    const sizer = el.firstChild as HTMLElement;
    expect(sizer.style.height).toBe(`${100 * 48}px`);
  });

  it('shifts the window and preserves same-key node identity on scroll', () => {
    const s = state({ items: makeList(1000) });
    let scrollTop = 0;
    const el = renderVirtualFor<Row>(
      () => s.items, (r) => r.id,
      (r) => { const d = document.createElement('div'); d.dataset.id = String(r.id); return d; },
      ctx, { rowHeight: 48, overscan: 2, metrics: () => ({ scrollTop, viewportHeight: 480 }) },
    );
    const before = rows(el).find((n) => n.dataset.id === '12');
    expect(before).toBeDefined();
    // scroll down a little so row 12 stays within the window
    scrollTop = 5 * 48;
    el.dispatchEvent(new Event('scroll'));
    const after = rows(el).find((n) => n.dataset.id === '12');
    expect(after).toBe(before); // same DOM node reused
  });

  it('translates the row layer by the window offset', () => {
    const s = state({ items: makeList(1000) });
    let scrollTop = 20 * 48;
    const el = renderVirtualFor<Row>(
      () => s.items, (r) => r.id,
      (r) => { const d = document.createElement('div'); d.dataset.id = String(r.id); return d; },
      ctx, { rowHeight: 48, overscan: 4, metrics: () => ({ scrollTop, viewportHeight: 480 }) },
    );
    const layer = el.firstChild!.firstChild as HTMLElement;
    expect(layer.style.transform).toBe(`translateY(${16 * 48}px)`); // start 16
  });

  it('reacts to list changes outside the window without full remount', () => {
    const s = state({ items: makeList(1000) });
    const el = renderVirtualFor<Row>(
      () => s.items, (r) => r.id,
      (r) => { const d = document.createElement('div'); d.dataset.id = String(r.id); return d; },
      ctx, { rowHeight: 48, metrics: () => ({ scrollTop: 0, viewportHeight: 480 }) },
    );
    const row0 = rows(el).find((n) => n.dataset.id === '0');
    // append at the end (outside window) — row 0 node must be preserved
    s.items = [...s.items, { id: 9999, label: 'new' }];
    flushSync();
    expect(rows(el).find((n) => n.dataset.id === '0')).toBe(row0);
  });

  it('scrollToIndex moves the scroll position and re-windows; scrollToKey resolves index', () => {
    const s = state({ items: makeList(1000) });
    let scrollTop = 0;
    const el = renderVirtualFor<Row>(
      () => s.items, (r) => r.id,
      (r) => { const d = document.createElement('div'); d.dataset.id = String(r.id); return d; },
      ctx,
      {
        rowHeight: 48, overscan: 2,
        metrics: () => ({ scrollTop, viewportHeight: 480 }),
      },
    );
    // patch scrollTop through the element's scroll property for scrollToIndex
    Object.defineProperty(el, 'scrollTop', { get: () => scrollTop, set: (v: number) => { scrollTop = v; } });
    el.scrollToKey(500);
    expect(scrollTop).toBe(500 * 48);
    expect(rows(el).some((n) => n.dataset.id === '500')).toBe(true);
  });

  it('emits the debug window attribute when debug is on', () => {
    const s = state({ items: makeList(100) });
    const el = renderVirtualFor<Row>(
      () => s.items, (r) => r.id,
      (r) => document.createElement('div'),
      ctx, { rowHeight: 48, overscan: 4, debug: true, metrics: () => ({ scrollTop: 0, viewportHeight: 480 }) },
    );
    expect(el.getAttribute('data-virtual-window')).toBe('0,15,100');
  });
});

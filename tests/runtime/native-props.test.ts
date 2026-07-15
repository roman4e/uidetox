import { describe, expect, it } from 'vitest';
import { state } from '../../src/runtime/state.js';
import { defineComponent } from '../../src/runtime/component.js';
import { __el } from '../../src/runtime/domHelpers.js';
import { flushSync } from '../../src/runtime/scheduler.js';

describe('native objects survive state / prop bridge (REQ-07)', () => {
  it('does not wrap a class instance whose getters use internal slots', () => {
    class Rectish {
      constructor(private _l: number, private _w: number) {}
      get left() { return this._l; }
      get width() { return this._w; }
    }
    const s = state({ anchor: new Rectish(12, 340) as { left: number; width: number } | null });
    // reading through the reactive proxy must return the real values, not undefined
    expect(s.anchor!.left).toBe(12);
    expect(s.anchor!.width).toBe(340);
    // identity preserved (same instance, not a wrapper)
    const a = s.anchor;
    expect(a instanceof Rectish).toBe(true);
  });

  it('still deep-wraps plain nested objects (reactive)', () => {
    const s = state({ o: { n: 1 } });
    let seen = 0;
    // reading o.n tracks; mutating notifies
    const read = () => s.o.n;
    expect(read()).toBe(1);
    s.o.n = 2;
    expect(read()).toBe(2);
    void seen;
  });

  it('delivers a DOMRect-like prop intact through .prop bridge', () => {
    let left: unknown;
    defineComponent({
      tag: 'anchored-el',
      props: ['anchor'],
      boot: (ctx) => {
        left = (ctx.props.anchor as { left: number }).left; // read at boot
        return __el('div', [], [], ctx);
      },
    });
    const rect = { left: 100, top: 5, width: 20, height: 8, right: 120, bottom: 13 };
    Object.setPrototypeOf(rect, { get x() { return 100; } }); // exotic proto → not wrapped
    const el = document.createElement('anchored-el') as HTMLElement & { anchor?: unknown };
    el.anchor = rect;
    document.body.appendChild(el);
    flushSync();
    expect(left).toBe(100);
    el.remove();
  });
});

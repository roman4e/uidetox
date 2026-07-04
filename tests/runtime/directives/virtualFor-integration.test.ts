import { describe, expect, it } from 'vitest';
import { defineComponent } from '../../../src/runtime/component.js';
import { __virtualFor, __el, __text } from '../../../src/runtime/domHelpers.js';
import { state } from '../../../src/runtime/state.js';

interface Row { id: number }

describe('virtual-for end-to-end via a component', () => {
  it('mounts only a bounded number of rows for a huge list', () => {
    const s = state({ items: Array.from({ length: 5000 }, (_, i) => ({ id: i })) });
    defineComponent({
      tag: 'vf-host',
      boot: (ctx) =>
        __virtualFor<Row>(
          () => s.items,
          (r) => r.id,
          (r, _i, c) => __el('div', [['class', 'static', 'row']], [__text(String(r.id))], c),
          ctx,
          { rowHeight: 48, overscan: 4 },
        ),
    });
    const el = document.createElement('vf-host');
    document.body.appendChild(el);
    // happy-dom reports clientHeight 0 → only overscan+1 rows render, far below 40.
    const rendered = el.querySelectorAll('.row');
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered.length).toBeLessThan(40);
    el.remove();
  });
});

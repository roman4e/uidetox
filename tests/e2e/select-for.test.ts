import { describe, expect, it } from 'vitest';
import { defineComponent } from '../../src/runtime/component.js';
import { __el, __text, __bind, __for } from '../../src/runtime/domHelpers.js';
import { state } from '../../src/runtime/state.js';
import { flushSync } from '../../src/runtime/scheduler.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('<for> renders <option>s into a real <select> (REQ-20b)', () => {
  it('mounts loop options alongside the placeholder and re-diffs', async () => {
    const s = state({ items: [{ id: 1, label: 'a' }, { id: 2, label: 'b' }] });
    defineComponent({
      tag: 'ver-picker',
      boot: (ctx) => __el('select', [], [
        __el('option', [['value', 'static', '']], [__text('--')], ctx),
        __for(
          () => s.items,
          (x) => x.id,
          (x) => __el('option', [['value', 'expression', () => x.id]], [
            __bind(__text(''), 'text-content', '', () => x.label, ctx),
          ], ctx),
          ctx,
        ),
      ], ctx),
    });

    const el = document.createElement('ver-picker');
    document.body.appendChild(el);
    await tick(); await tick(); flushSync();
    expect(el.querySelectorAll('select > option').length).toBe(3); // placeholder + a + b

    s.items = [{ id: 3, label: 'c' }];
    flushSync();
    expect(el.querySelectorAll('select > option').length).toBe(2); // placeholder + c
    expect([...el.querySelectorAll('select > option')].map((o) => o.textContent)).toEqual(['--', 'c']);

    el.remove();
  });
});

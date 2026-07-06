import { describe, expect, it } from 'vitest';
import { defineComponent } from '../../../src/runtime/component.js';
import { __el, __text, __if, __for, __case, CASE_DEFAULT } from '../../../src/runtime/domHelpers.js';
import { state } from '../../../src/runtime/state.js';
import { flushSync } from '../../../src/runtime/scheduler.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('nested control-flow teardown (REQ-21)', () => {
  it('<case> wrapping <for>: rows removed + effect disposed on branch change', async () => {
    // status: 'loading' | 'success'; items list rendered in the success arm
    const s = state({ status: 'success' as string, items: [{ id: 1, n: 'a' }, { id: 2, n: 'b' }, { id: 3, n: 'c' }] });

    defineComponent({
      tag: 'list-page',
      boot: (ctx) => __el('ul', [], [
        __case(
          () => s.status,
          [
            { match: 'loading', factory: (c) => __el('li', [['class', 'static', 'loading']], [__text('…')], c) },
            {
              match: CASE_DEFAULT,
              factory: (c) => __for(
                () => s.items,
                (x) => x.id,
                (x) => __el('li', [['class', 'static', 'row']], [__text(x.n)], c),
                c,
              ),
            },
          ],
          ctx,
        ),
      ], ctx),
    });

    const el = document.createElement('list-page');
    document.body.appendChild(el);
    await tick(); await tick(); flushSync();
    expect(el.querySelectorAll('li.row').length).toBe(3);

    // simulate reload: status → loading (case swaps arm) → success with fewer items
    s.status = 'loading';
    flushSync(); await tick(); flushSync();
    expect(el.querySelectorAll('li.row').length).toBe(0);   // for rows removed with the arm
    expect(el.querySelectorAll('li.loading').length).toBe(1);

    s.items = [{ id: 2, n: 'b' }];      // fresh (shorter) data
    s.status = 'success';
    flushSync(); await tick(); flushSync();
    // exactly one fresh row — no stale rows from the previous mount
    expect(el.querySelectorAll('li.row').length).toBe(1);
    expect(el.querySelector('li.row')?.textContent).toBe('b');

    el.remove();
  });

  it('<if> wrapping <for>: no accumulation across show/hide cycles', async () => {
    const s = state({ show: true, items: [{ id: 1, n: 'a' }, { id: 2, n: 'b' }] });
    defineComponent({
      tag: 'if-list',
      boot: (ctx) => __el('div', [], [
        __if(
          () => s.show,
          (c) => __for(() => s.items, (x) => x.id, (x) => __el('span', [], [__text(x.n)], c), c),
          null,
          ctx,
        ),
      ], ctx),
    });
    const el = document.createElement('if-list');
    document.body.appendChild(el);
    await tick(); await tick(); flushSync();
    expect(el.querySelectorAll('span').length).toBe(2);

    for (let i = 0; i < 3; i++) {
      s.show = false; flushSync(); await tick(); flushSync();
      expect(el.querySelectorAll('span').length).toBe(0);
      s.show = true; flushSync(); await tick(); flushSync();
      expect(el.querySelectorAll('span').length).toBe(2);   // exactly 2, never stacking
    }
    el.remove();
  });
});

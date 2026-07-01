import { describe, expect, it } from 'vitest';
import { renderFor } from '../../src/runtime/directives/forBlock.js';
import { flushSync } from '../../src/runtime/scheduler.js';
import { state } from '../../src/runtime/state.js';

describe('renderFor()', () => {
  it('renders initial list and updates when items change', () => {
    const s = state({ items: [{ id: 'a', v: 1 }, { id: 'b', v: 2 }] });
    const host = document.createElement('ul');
    const anchor = document.createTextNode('');
    host.appendChild(anchor);
    const ctx = { props: {}, host };
    renderFor(host, anchor,
      () => s.items,
      (item) => item.id,
      (item) => {
        const li = document.createElement('li');
        li.textContent = String(item.v);
        return li;
      },
      ctx,
    );
    expect([...host.querySelectorAll('li')].map((l) => l.textContent)).toEqual(['1', '2']);

    s.items.push({ id: 'c', v: 3 });
    flushSync();
    expect([...host.querySelectorAll('li')].map((l) => l.textContent)).toEqual(['1', '2', '3']);

    s.items.splice(0, 1);
    flushSync();
    expect([...host.querySelectorAll('li')].map((l) => l.textContent)).toEqual(['2', '3']);
  });

  it('preserves nodes for retained keys (identity check)', () => {
    const s = state({ items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] });
    const host = document.createElement('div');
    const anchor = document.createTextNode('');
    host.appendChild(anchor);
    const ctx = { props: {}, host };
    renderFor(host, anchor,
      () => s.items,
      (item) => item.id,
      () => document.createElement('span'),
      ctx,
    );
    const before = [...host.querySelectorAll('span')];
    s.items.splice(1, 0, { id: 'x' } as { id: string });
    flushSync();
    const after = [...host.querySelectorAll('span')];
    expect(after).toHaveLength(4);
    expect(after[0]).toBe(before[0]);
    expect(after[2]).toBe(before[1]);
    expect(after[3]).toBe(before[2]);
  });
});

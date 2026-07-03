import { describe, expect, it } from 'vitest';
import { renderFor } from '../../src/runtime/directives/forBlock.js';
import { flushSync } from '../../src/runtime/scheduler.js';
import { state } from '../../src/runtime/state.js';

describe('renderFor animation hooks', () => {
  it('calls onInsert for new nodes', () => {
    const s = state({ items: [{ id: 'a' }] });
    const host = document.createElement('ul');
    const anchor = document.createTextNode('');
    host.appendChild(anchor);
    const ctx = { props: {}, host };
    const inserted: Node[] = [];
    renderFor(host, anchor, () => s.items, (i) => i.id,
      () => document.createElement('li'), ctx,
      { onInsert: (n) => inserted.push(n) });
    expect(inserted).toHaveLength(1);
    s.items.push({ id: 'b' });
    flushSync();
    expect(inserted).toHaveLength(2);
  });

  it('defers removal until done() is called', () => {
    const s = state({ items: [{ id: 'a' }, { id: 'b' }] });
    const host = document.createElement('ul');
    const anchor = document.createTextNode('');
    host.appendChild(anchor);
    const ctx = { props: {}, host };
    const pending: Array<() => void> = [];
    renderFor(host, anchor, () => s.items, (i) => i.id,
      () => document.createElement('li'), ctx,
      { onRemove: (_n, done) => pending.push(done) });
    expect(host.querySelectorAll('li')).toHaveLength(2);
    s.items.splice(0, 1);
    flushSync();
    // still present — removal deferred
    expect(host.querySelectorAll('li')).toHaveLength(2);
    pending.forEach((d) => d());
    expect(host.querySelectorAll('li')).toHaveLength(1);
  });
});

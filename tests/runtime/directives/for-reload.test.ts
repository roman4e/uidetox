import { describe, expect, it } from 'vitest';
import { renderFor } from '../../../src/runtime/directives/forBlock.js';
import { state } from '../../../src/runtime/state.js';
import { flushSync } from '../../../src/runtime/scheduler.js';

const ctx = {} as never;

describe('<for> keyed re-diff on mutating array (REQ-21)', () => {
  it('shrink/grow with partial key overlap keeps DOM == new array', () => {
    const s = state({ items: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }, { id: 3, name: 'c' }] });
    const parent = document.createElement('ul');
    const anchor = document.createTextNode('');
    parent.appendChild(anchor);
    document.body.appendChild(parent);

    renderFor(
      parent, anchor,
      () => s.items,
      (x) => x.id,
      (x) => { const el = document.createElement('span'); el.textContent = x.name; return el; },
      ctx,
    );
    flushSync();
    expect([...parent.querySelectorAll('span')].map((n) => n.textContent)).toEqual(['a', 'b', 'c']);

    s.items = [{ id: 2, name: 'b' }, { id: 3, name: 'c' }]; // drop id=1
    flushSync();
    expect([...parent.querySelectorAll('span')].map((n) => n.textContent)).toEqual(['b', 'c']);

    s.items = [{ id: 2, name: 'b' }]; // drop id=3
    flushSync();
    expect([...parent.querySelectorAll('span')].map((n) => n.textContent)).toEqual(['b']);

    s.items = [{ id: 4, name: 'd' }, { id: 2, name: 'b' }]; // add id=4, keep id=2
    flushSync();
    expect([...parent.querySelectorAll('span')].map((n) => n.textContent)).toEqual(['d', 'b']);
  });
});

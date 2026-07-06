import { describe, expect, it } from 'vitest';
import { renderFor } from '../../../src/runtime/directives/forBlock.js';
import { renderIf } from '../../../src/runtime/directives/ifBlock.js';
import { state } from '../../../src/runtime/state.js';
import { flushSync } from '../../../src/runtime/scheduler.js';

const ctx = {} as never;

function host(): { parent: HTMLElement; anchor: Text } {
  const parent = document.createElement('div');
  const anchor = document.createTextNode('');
  parent.appendChild(anchor);
  document.body.appendChild(parent);
  return { parent, anchor };
}

describe('<for> keyed diff (REQ-19b)', () => {
  it('removes stale keys when the source array is replaced', () => {
    const s = state({ items: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }] });
    const { parent, anchor } = host();
    renderFor(
      parent, anchor,
      () => s.items,
      (x) => x.id,
      (x) => { const el = document.createElement('span'); el.textContent = x.name; return el; },
      ctx,
    );
    flushSync();
    expect([...parent.querySelectorAll('span')].map((n) => n.textContent)).toEqual(['a', 'b']);

    s.items = [{ id: 3, name: 'c' }];
    flushSync();
    // b and a removed — only c remains
    expect([...parent.querySelectorAll('span')].map((n) => n.textContent)).toEqual(['c']);
  });

  it('removes stale rows for multi-element item bodies (fragment)', () => {
    const s = state({ items: [{ id: 1 }] as Array<{ id: number }> });
    const { parent, anchor } = host();
    renderFor(
      parent, anchor,
      () => s.items,
      (x) => x.id,
      (x) => {
        const frag = document.createDocumentFragment();
        const a = document.createElement('label'); a.dataset.id = String(x.id);
        const b = document.createElement('input'); b.dataset.id = String(x.id);
        frag.append(a, b);
        return frag;
      },
      ctx,
    );
    flushSync();
    expect(parent.querySelectorAll('label').length).toBe(1);
    expect(parent.querySelectorAll('input').length).toBe(1);

    s.items = [];         // deselect → empty
    flushSync();
    expect(parent.querySelectorAll('label').length).toBe(0);
    expect(parent.querySelectorAll('input').length).toBe(0);

    s.items = [{ id: 1 }]; // reselect → exactly one copy, not stacked
    flushSync();
    expect(parent.querySelectorAll('label').length).toBe(1);
  });
});

describe('<if> mount/unmount (REQ-19c)', () => {
  it('removes the branch on false and re-mounts one copy on true', () => {
    const s = state({ show: true, text: 'a' });
    const { parent, anchor } = host();
    renderIf(
      parent, anchor,
      () => s.show,
      () => { const el = document.createElement('span'); el.textContent = s.text; return el; },
      null,
      ctx,
    );
    flushSync();
    expect(parent.querySelectorAll('span').length).toBe(1);

    s.show = false;
    flushSync();
    expect(parent.querySelectorAll('span').length).toBe(0);

    s.show = true;
    flushSync();
    expect(parent.querySelectorAll('span').length).toBe(1); // one, not two, not zero
  });

  it('tears down a multi-element (fragment) branch fully', () => {
    const s = state({ show: true });
    const { parent, anchor } = host();
    renderIf(
      parent, anchor,
      () => s.show,
      () => {
        const frag = document.createDocumentFragment();
        frag.append(document.createElement('h3'), document.createElement('label'), document.createElement('div'));
        return frag;
      },
      null,
      ctx,
    );
    flushSync();
    expect(parent.querySelectorAll('h3, label, div').length).toBe(3);
    s.show = false;
    flushSync();
    expect(parent.querySelectorAll('h3, label, div').length).toBe(0);
    s.show = true;
    flushSync();
    expect(parent.querySelectorAll('h3').length).toBe(1); // single copy
  });
});

import { describe, expect, it } from 'vitest';
import { renderIf } from '../../src/runtime/directives/ifBlock.js';
import { flushSync } from '../../src/runtime/scheduler.js';
import { state } from '../../src/runtime/state.js';

describe('renderIf()', () => {
  it('mounts the "then" branch when the condition is truthy and swaps on change', () => {
    const s = state({ open: true });
    const host = document.createElement('div');
    const anchor = document.createTextNode('');
    host.appendChild(anchor);
    const ctx = { props: {}, host };
    renderIf(host, anchor, () => s.open,
      () => document.createTextNode('YES'),
      () => document.createTextNode('NO'),
      ctx,
    );
    expect(host.textContent).toBe('YES');
    s.open = false;
    flushSync();
    expect(host.textContent).toBe('NO');
    s.open = true;
    flushSync();
    expect(host.textContent).toBe('YES');
  });

  it('renders nothing when condition is false and no else branch is provided', () => {
    const s = state({ open: false });
    const host = document.createElement('div');
    const anchor = document.createTextNode('');
    host.appendChild(anchor);
    const ctx = { props: {}, host };
    renderIf(host, anchor, () => s.open,
      () => document.createTextNode('YES'),
      null,
      ctx,
    );
    expect(host.textContent).toBe('');
    s.open = true;
    flushSync();
    expect(host.textContent).toBe('YES');
  });
});

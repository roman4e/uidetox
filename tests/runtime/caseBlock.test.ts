import { describe, expect, it } from 'vitest';
import { CASE_DEFAULT, renderCase } from '../../src/runtime/directives/caseBlock.js';
import { flushSync } from '../../src/runtime/scheduler.js';
import { state } from '../../src/runtime/state.js';

describe('renderCase()', () => {
  it('mounts the arm whose match equals the subject', () => {
    const s = state({ status: 'loading' as 'loading' | 'error' | 'ok' });
    const host = document.createElement('div');
    const anchor = document.createTextNode('');
    host.appendChild(anchor);
    const ctx = { props: {}, host };
    renderCase(host, anchor, () => s.status, [
      { match: 'loading', factory: () => document.createTextNode('L') },
      { match: 'error',   factory: () => document.createTextNode('E') },
      { match: CASE_DEFAULT, factory: () => document.createTextNode('D') },
    ], ctx);
    expect(host.textContent).toBe('L');
    s.status = 'error';
    flushSync();
    expect(host.textContent).toBe('E');
    s.status = 'ok';
    flushSync();
    expect(host.textContent).toBe('D');
  });
});

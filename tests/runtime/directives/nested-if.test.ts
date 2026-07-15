import { describe, expect, it } from 'vitest';
import { renderIf } from '../../../src/runtime/directives/ifBlock.js';
import { __fragment } from '../../../src/runtime/domHelpers.js';
import { state } from '../../../src/runtime/state.js';
import { flushSync } from '../../../src/runtime/scheduler.js';

const ctx = {} as never;
const tick = () => new Promise((r) => setTimeout(r, 0));

function host(): { parent: HTMLElement; anchor: Text } {
  const parent = document.createElement('div');
  const anchor = document.createTextNode('');
  parent.appendChild(anchor);
  document.body.appendChild(parent);
  return { parent, anchor };
}

describe('nested <if> reactivity (REQ-06)', () => {
  it('inner <if> in an <else> branch reacts to a later signal change', async () => {
    // outer: when=authed → then <auth>, else → inner <if when=sel> popover
    const s = state({ authed: true, sel: null as unknown });
    const { parent, anchor } = host();

    renderIf(
      parent, anchor,
      () => !s.authed,
      () => { const a = document.createElement('lad-auth'); return a; },      // then
      (c) => {
        // else branch contains a nested <if when=${s.sel}>
        const wrap = document.createElement('div');
        const innerAnchor = document.createTextNode('');
        wrap.appendChild(innerAnchor);
        renderIf(
          wrap, innerAnchor,
          () => s.sel,
          () => document.createElement('popover-el'),
          null,
          c,
        );
        return wrap;
      },
      ctx,
    );
    flushSync();
    await tick();          // let the deferred inner renderIf (if any) settle

    // authed=true → else branch mounted, inner if false → no popover yet
    expect(parent.querySelector('lad-auth')).toBeNull();
    expect(parent.querySelector('popover-el')).toBeNull();

    // signal flips AFTER the branch was built
    s.sel = { id: 1 };
    flushSync();
    await tick();
    flushSync();
    expect(parent.querySelector('popover-el')).not.toBeNull(); // inner <if> reacted

    s.sel = null;
    flushSync();
    expect(parent.querySelector('popover-el')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { defineComponent } from '../../../src/runtime/component.js';
import { __el, __if, __fragment, __text } from '../../../src/runtime/domHelpers.js';
import { state } from '../../../src/runtime/state.js';
import { flushSync } from '../../../src/runtime/scheduler.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('nested <if> via __if (compiled path, REQ-06)', () => {
  it('deeply nested <if> in <else> reacts to a later signal', async () => {
    const s = state({ authed: true, ready: true, sel: null as unknown });

    defineComponent({
      tag: 'app-root6',
      boot: (ctx) =>
        // <if when=${!authed}> auth <else> <if when=${!ready}> loading <else> <div><if when=${sel}>popover</if></div>
        __if(
          () => !s.authed,
          (c) => __el('lad-auth', [], [], c),
          (c) => __if(
            () => !s.ready,
            (c2) => __el('p', [], [__text('loading')], c2),
            (c2) => __el('div', [], [
              __if(() => s.sel, (c3) => __el('popover-el', [], [], c3), null, c2),
            ], c2),
            c,
          ),
          ctx,
        ),
    });

    const el = document.createElement('app-root6');
    document.body.appendChild(el);
    await tick(); await tick(); flushSync();

    expect(el.querySelector('lad-auth')).toBeNull();
    expect(el.querySelector('p')?.textContent).toBeUndefined();
    expect(el.querySelector('popover-el')).toBeNull(); // sel null → no popover

    s.sel = { id: 1 };            // flip the deeply-nested condition
    flushSync(); await tick(); flushSync();
    expect(el.querySelector('popover-el')).not.toBeNull(); // must mount

    s.sel = null;
    flushSync(); await tick(); flushSync();
    expect(el.querySelector('popover-el')).toBeNull();
    el.remove();
  });

  it('reacts when the nested <if> branch was built during an outer re-run', async () => {
    const s = state({ authed: false, sel: null as unknown });
    defineComponent({
      tag: 'app-root6b',
      boot: (ctx) =>
        __if(
          () => !s.authed,
          (c) => __el('lad-auth', [], [], c),                 // shown while not authed
          (c) => __el('div', [], [                             // else — built later, on re-run
            __if(() => s.sel, (c2) => __el('popover-el', [], [], c2), null, c),
          ], c),
          ctx,
        ),
    });
    const el = document.createElement('app-root6b');
    document.body.appendChild(el);
    await tick(); await tick(); flushSync();
    expect(el.querySelector('lad-auth')).not.toBeNull();      // starts on the then branch

    s.authed = true;               // outer re-run → else branch (with nested if) built NOW
    flushSync(); await tick(); flushSync();
    expect(el.querySelector('lad-auth')).toBeNull();
    expect(el.querySelector('popover-el')).toBeNull();

    s.sel = { id: 1 };             // flip the nested condition built during the re-run
    flushSync(); await tick(); flushSync();
    expect(el.querySelector('popover-el')).not.toBeNull();
    el.remove();
  });
});

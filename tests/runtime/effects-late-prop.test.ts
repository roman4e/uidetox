import { describe, expect, it } from 'vitest';
import { defineComponent } from '../../src/runtime/component.js';
import { __el } from '../../src/runtime/domHelpers.js';
import { readFrame } from '../../src/runtime/scheduler.js';
import { flushSync } from '../../src/runtime/scheduler.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('effects react to a prop that arrives after boot (REQ-08)', () => {
  it('ctx.effect re-runs when a late .prop is set; readFrame fires the callback', async () => {
    const placed: unknown[] = [];
    defineComponent({
      tag: 'popover-x',
      props: ['anchor'],
      boot: (ctx) => {
        const node = __el('div', [], [], ctx);
        ctx.refs.pop = node;
        // the `effects`-section pattern: react when the anchor prop becomes available
        ctx.effect(() => {
          const anchor = ctx.props.anchor as { left: number } | undefined;
          if (anchor && ctx.refs.pop) {
            void readFrame(() => { placed.push(anchor.left); });
          }
        });
        return node;
      },
    });

    const el = document.createElement('popover-x') as HTMLElement & { anchor?: unknown };
    document.body.appendChild(el);           // no anchor yet
    flushSync();
    expect(placed).toEqual([]);              // effect ran once, condition false → nothing

    el.anchor = { left: 42 };                // anchor arrives after boot (parent measured)
    flushSync();
    await tick();                            // readFrame resolves on the next flush
    flushSync();
    expect(placed).toEqual([42]);            // effect re-ran, readFrame placed once

    el.anchor = { left: 99 };                // moves → re-place
    flushSync();
    await tick();
    flushSync();
    expect(placed).toEqual([42, 99]);
    el.remove();
  });
});

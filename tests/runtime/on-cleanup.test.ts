import { describe, expect, it } from 'vitest';
import { defineComponent } from '../../src/runtime/component.js';
import { onCleanup } from '../../src/runtime/lifecycle.js';
import { __el, __text } from '../../src/runtime/domHelpers.js';

describe('onCleanup (REQ-27)', () => {
  it('runs registered teardown on disconnect, in registration order', () => {
    const order: string[] = [];
    defineComponent({
      tag: 'cleanup-host',
      boot: (ctx) => {
        onCleanup(() => order.push('a'));       // free import
        ctx.onCleanup(() => order.push('b'));   // via ctx
        onCleanup(() => order.push('c'));
        return __el('div', [], [__text('x')], ctx);
      },
    });
    const el = document.createElement('cleanup-host');
    document.body.appendChild(el);
    expect(order).toEqual([]);
    el.remove();
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('warns and no-ops outside a component boot', () => {
    let warned = false;
    const orig = console.warn;
    console.warn = () => { warned = true; };
    try {
      expect(() => onCleanup(() => {})).not.toThrow();
      expect(warned).toBe(true);
    } finally {
      console.warn = orig;
    }
  });
});

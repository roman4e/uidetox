import { describe, expect, it } from 'vitest';
import { defineComponent } from '../../src/runtime/component.js';
import { defineEmits } from '../../src/runtime/emits.js';
import { __el, __text } from '../../src/runtime/domHelpers.js';

describe('defineEmits()', () => {
  it('dispatches a CustomEvent on the host with detail', () => {
    defineComponent({
      tag: 'x-emit-test',
      boot: (ctx) => {
        const emit = defineEmits<{ ping: { n: number } }>();
        ctx.host.addEventListener('trigger', () => emit('ping', { n: 42 }));
        return __el('div', [], [__text('ready')], ctx);
      },
    });
    document.body.innerHTML = '<x-emit-test></x-emit-test>';
    const el = document.body.querySelector('x-emit-test')!;
    const received: unknown[] = [];
    el.addEventListener('ping', (e) => received.push((e as CustomEvent).detail));
    el.dispatchEvent(new Event('trigger'));
    expect(received).toEqual([{ n: 42 }]);
  });
});

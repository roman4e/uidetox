import { describe, expect, it } from 'vitest';
import { defineComponent } from '../../src/runtime/component.js';
import { __bind, __el, __text } from '../../src/runtime/domHelpers.js';
import { flushSync } from '../../src/runtime/scheduler.js';
import { state } from '../../src/runtime/state.js';

describe('defineComponent() and dom helpers', () => {
  it('registers a custom element that renders its template', () => {
    defineComponent({
      tag: 'x-greeter',
      template: (ctx) =>
        __el('span', [['class', 'static', 'g']], [__text('hello ' + (ctx.props.who ?? 'world'))], ctx),
      props: ['who'],
    });
    document.body.innerHTML = '<x-greeter who="world"></x-greeter>';
    const el = document.body.querySelector('x-greeter')!;
    expect(el.querySelector('span.g')?.textContent).toBe('hello world');
  });

  it('rebinds text content when the tracked value changes', () => {
    const s = state({ text: 'first' });
    defineComponent({
      tag: 'x-live-text',
      template: (ctx) => {
        const t = __text('');
        __bind(t, 'text-content', '', () => s.text, ctx);
        return t;
      },
    });
    document.body.innerHTML = '<x-live-text></x-live-text>';
    const el = document.body.querySelector('x-live-text')!;
    expect(el.textContent).toBe('first');
    s.text = 'second';
    flushSync();
    expect(el.textContent).toBe('second');
  });
});

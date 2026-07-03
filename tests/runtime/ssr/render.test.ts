import { describe, expect, it } from 'vitest';
import { defineComponent } from '../../../src/runtime/component.js';
import { __el, __text } from '../../../src/runtime/domHelpers.js';
import { renderToString } from '../../../src/runtime/ssr/render.js';

describe('renderToString()', () => {
  it('serialises a component to HTML', () => {
    defineComponent({
      tag: 'ssr-hello',
      boot: (ctx) => __el('span', [['class', 'static', 'g']], [__text('hi ssr')], ctx),
    });
    const html = renderToString('ssr-hello');
    expect(html).toContain('<ssr-hello');
    expect(html).toContain('<span class="g">hi ssr</span>');
    expect(html).toContain('</ssr-hello>');
  });

  it('applies attributes', () => {
    defineComponent({
      tag: 'ssr-greet',
      props: ['who'],
      boot: (ctx) => __el('span', [], [__text('hello ' + (ctx.props.who ?? 'x'))], ctx),
    });
    const html = renderToString('ssr-greet', { attrs: { who: 'world' } });
    expect(html).toContain('who="world"');
    expect(html).toContain('hello world');
  });
});

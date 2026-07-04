import { describe, expect, it } from 'vitest';
import { defineComponent } from '../../../src/runtime/component.js';
import { __el, __text } from '../../../src/runtime/domHelpers.js';
import { renderToString } from '../../../src/runtime/ssr/render.js';

describe('SSR island opt-out', () => {
  it('skips boot for render:never and emits a placeholder', () => {
    let booted = false;
    defineComponent({
      tag: 'ssr-island',
      render: 'never',
      boot: (ctx) => { booted = true; return __el('canvas', [], [], ctx); },
    });
    const html = renderToString('ssr-island');
    expect(booted).toBe(false);
    expect(html).toContain('<ssr-island');
    expect(html).toContain('uidetox:island');
    expect(html).not.toContain('<canvas');
  });

  it('still renders normal components', () => {
    defineComponent({
      tag: 'ssr-normal',
      boot: (ctx) => __el('span', [], [__text('hello')], ctx),
    });
    const html = renderToString('ssr-normal');
    expect(html).toContain('<span>hello</span>');
  });
});

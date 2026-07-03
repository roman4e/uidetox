import { describe, expect, it } from 'vitest';
import { defineComponent } from '../../src/runtime/component.js';
import { __el, __ref, __text } from '../../src/runtime/domHelpers.js';

describe('component refs', () => {
  it('populates ctx.refs via __ref and exposes find', () => {
    let captured: { refs: Record<string, Element>; find: (s: string) => Element | null } | null = null;
    defineComponent({
      tag: 'ref-test',
      boot: (ctx) => {
        captured = ctx;
        const input = __ref(ctx, 'email', __el('input', [['name', 'static', 'email']], [], ctx));
        return __el('form', [], [input, __el('span', [], [__text('x')], ctx)], ctx);
      },
    });
    document.body.innerHTML = '<ref-test></ref-test>';
    const el = document.body.querySelector('ref-test')!;
    expect(captured).not.toBeNull();
    expect(captured!.refs.email.tagName.toLowerCase()).toBe('input');
    expect(captured!.find('span')?.textContent).toBe('x');
    void el;
  });

  it('ref(name) returns the same element', () => {
    let seen: Element | undefined;
    defineComponent({
      tag: 'ref-test-2',
      boot: (ctx) => {
        const btn = __ref(ctx, 'submitBtn', __el('button', [], [], ctx));
        seen = ctx.ref('submitBtn');
        return btn;
      },
    });
    document.body.innerHTML = '<ref-test-2></ref-test-2>';
    expect(seen?.tagName.toLowerCase()).toBe('button');
  });
});

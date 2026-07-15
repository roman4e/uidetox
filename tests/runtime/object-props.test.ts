import { describe, expect, it } from 'vitest';
import { defineComponent } from '../../src/runtime/component.js';
import { __el, __bind, __text } from '../../src/runtime/domHelpers.js';
import { state } from '../../src/runtime/state.js';
import { flushSync } from '../../src/runtime/scheduler.js';

describe('object props via .prop binding (REQ-05 / REQ-28)', () => {
  it('delivers an object property into reactive ctx.props', () => {
    let seen: unknown;
    defineComponent({
      tag: 'obj-child',
      props: ['token'],
      boot: (ctx) => {
        seen = ctx.props.token;                      // read at boot
        return __el('span', [], [__bind(__text(''), 'text-content', '', () => String((ctx.props.token as { label?: string })?.label ?? ''), ctx)], ctx);
      },
    });

    const el = document.createElement('obj-child') as HTMLElement & { token?: unknown };
    el.token = { label: 'salt', id: 7 };            // property, not attribute
    document.body.appendChild(el);
    flushSync();
    expect(seen).toEqual({ label: 'salt', id: 7 }); // object identity preserved, not "[object Object]"
    expect(el.querySelector('span')?.textContent).toBe('salt');
    el.remove();
  });

  it('is reactive — updating the property re-renders the child', () => {
    defineComponent({
      tag: 'obj-reactive',
      props: ['data'],
      boot: (ctx) => {
        return __el('span', [], [__bind(__text(''), 'text-content', '', () => String((ctx.props.data as { n?: number })?.n ?? '?'), ctx)], ctx);
      },
    });
    const el = document.createElement('obj-reactive') as HTMLElement & { data?: unknown };
    el.data = { n: 1 };
    document.body.appendChild(el);
    flushSync();
    expect(el.querySelector('span')?.textContent).toBe('1');

    el.data = { n: 2 };                              // reassign → effect re-runs
    flushSync();
    expect(el.querySelector('span')?.textContent).toBe('2');
    el.remove();
  });

  it('a parent template passing .prop=${obj} reaches the child reactively', () => {
    defineComponent({
      tag: 'lad-leaf',
      props: ['item'],
      boot: (ctx) => {
        return __el('span', [], [__bind(__text(''), 'text-content', '', () => String((ctx.props.item as { word?: string })?.word ?? ''), ctx)], ctx);
      },
    });
    const s = state({ item: { word: 'дім' } });
    defineComponent({
      tag: 'lad-root',
      boot: (ctx) => __el('lad-leaf', [['.item', 'property', () => s.item]], [], ctx),
    });

    const root = document.createElement('lad-root');
    document.body.appendChild(root);
    flushSync();
    expect(root.querySelector('lad-leaf span')?.textContent).toBe('дім');

    s.item = { word: 'ліс' };                         // parent state changes → child updates
    flushSync();
    expect(root.querySelector('lad-leaf span')?.textContent).toBe('ліс');
    root.remove();
  });
});

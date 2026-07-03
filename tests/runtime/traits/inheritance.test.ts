import { describe, expect, it } from 'vitest';
import { clearTraitRegistry, defineTrait } from '../../../src/runtime/traits/define.js';
import { installTraits } from '../../../src/runtime/traits/install.js';

describe('trait inheritance', () => {
  it('parents run first then own via MRO', () => {
    clearTraitRegistry();
    const order: string[] = [];
    const parent = defineTrait('p', {
      appliesTo: ['input'],
      paramsSchema: {},
      props: () => ({}),
      handlers: { blur: [{ name: 'p1', run() { order.push('p1'); } }] },
    });
    const child = defineTrait('c', {
      appliesTo: ['input'],
      paramsSchema: {},
      props: () => ({}),
      extends: [parent],
      handlers: { blur: [{ name: 'c1', run() { order.push('c1'); } }] },
    });
    void child;
    const el = document.createElement('input');
    document.body.appendChild(el);
    installTraits(el.parentElement!, new Map([[el, [{ traitName: 'c', params: {} }]]]));
    el.dispatchEvent(new Event('blur'));
    expect(order).toEqual(['p1', 'c1']);
  });

  it('off removes named inherited handler', () => {
    clearTraitRegistry();
    const order: string[] = [];
    const parent = defineTrait('p', {
      appliesTo: ['input'],
      paramsSchema: {},
      props: () => ({}),
      handlers: { blur: [
        { name: 'a', run() { order.push('a'); } },
        { name: 'b', run() { order.push('b'); } },
      ] },
    });
    defineTrait('c', {
      appliesTo: ['input'],
      paramsSchema: {},
      props: () => ({}),
      extends: [parent],
      handlers: {},
      off: { blur: ['b'] },
    });
    const el = document.createElement('input');
    document.body.appendChild(el);
    installTraits(el.parentElement!, new Map([[el, [{ traitName: 'c', params: {} }]]]));
    el.dispatchEvent(new Event('blur'));
    expect(order).toEqual(['a']);
  });
});

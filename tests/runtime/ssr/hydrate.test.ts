import { describe, expect, it } from 'vitest';
import { defineComponent } from '../../../src/runtime/component.js';
import { __el, __text } from '../../../src/runtime/domHelpers.js';
import { hydrate } from '../../../src/runtime/ssr/hydrate.js';

describe('hydrate()', () => {
  it('upgrades pre-rendered custom elements', () => {
    let bootCalls = 0;
    defineComponent({
      tag: 'hyd-test',
      boot: (ctx) => { bootCalls++; return __el('span', [], [__text('h')], ctx); },
    });
    const wrapper = document.createElement('div');
    wrapper.innerHTML = '<hyd-test></hyd-test>';
    hydrate(wrapper);
    document.body.appendChild(wrapper);
    expect(bootCalls).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from 'vitest';
import { defineTrait, clearTraitRegistry } from '../../../src/runtime/traits/define.js';
import { installTraits, parseParamAttribute, parseUseAttribute } from '../../../src/runtime/traits/install.js';

describe('installTraits()', () => {
  it('parses use attribute list', () => {
    expect(parseUseAttribute('trim, numeric-only')).toEqual(['trim', 'numeric-only']);
  });
  it('parses param attribute names', () => {
    expect(parseParamAttribute(':saved-key')).toEqual({ trait: null, param: 'savedKey' });
    expect(parseParamAttribute(':trim:saved-key')).toEqual({ trait: 'trim', param: 'savedKey' });
    expect(parseParamAttribute('class')).toBeNull();
  });

  it('attaches handler on matching event', () => {
    clearTraitRegistry();
    let fired = 0;
    defineTrait('mark', {
      appliesTo: ['input'],
      paramsSchema: {},
      props: () => ({}),
      handlers: { blur: [{ name: 'run', run() { fired++; } }] },
    });
    const el = document.createElement('input');
    document.body.appendChild(el);
    const dispose = installTraits(el.parentElement!, new Map([[el, [{ traitName: 'mark', params: {} }]]]));
    el.dispatchEvent(new Event('blur'));
    expect(fired).toBe(1);
    dispose();
    el.dispatchEvent(new Event('blur'));
    expect(fired).toBe(1);
  });
});

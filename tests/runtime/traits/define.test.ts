import { describe, expect, it } from 'vitest';
import { defineTrait, getTrait } from '../../../src/runtime/traits/define.js';

describe('defineTrait()', () => {
  it('registers and returns descriptor', () => {
    const t = defineTrait('trim', {
      appliesTo: ['input'],
      paramsSchema: {},
      props: () => ({}),
      handlers: { blur: [{ name: 'trim_handler', run() { /*noop*/ } }] },
    });
    expect(t.name).toBe('trim');
    expect(getTrait('trim')).toBe(t);
  });
});

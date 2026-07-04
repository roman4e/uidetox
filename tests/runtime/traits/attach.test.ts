import { describe, expect, it, afterEach } from 'vitest';
import { defineBehaviorTrait, clearTraitRegistry } from '../../../src/runtime/traits/define.js';
import { installTraits } from '../../../src/runtime/traits/install.js';

afterEach(() => clearTraitRegistry());

describe('trait attach lifecycle', () => {
  it('runs attach on install and cleanup on teardown', () => {
    const log: string[] = [];
    defineBehaviorTrait('probe', ['*'], (el, params) => {
      log.push(`attach:${el.tagName}:${params.foo}`);
      return () => log.push('cleanup');
    });
    const el = document.createElement('div');
    const dispose = installTraits(el, new Map([[el, [{ traitName: 'probe', params: { foo: 1 } }]]]));
    expect(log).toEqual(['attach:DIV:1']);
    dispose();
    expect(log).toEqual(['attach:DIV:1', 'cleanup']);
  });
});

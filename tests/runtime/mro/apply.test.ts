import { describe, expect, it } from 'vitest';
import { mergeChain, mergeHandlers } from '../../../src/runtime/mro/apply.js';

describe('mergeHandlers()', () => {
  it('concatenates handlers in tail-first order (parents first, own last)', () => {
    const mro = [
      { handlers: { blur: [{ name: 'own', run() {} }] } },
      { handlers: { blur: [{ name: 'p1', run() {} }] } },
      { handlers: { blur: [{ name: 'p2', run() {} }] } },
    ];
    const merged = mergeHandlers(mro);
    expect(merged.blur.map((h) => h.name)).toEqual(['p2', 'p1', 'own']);
  });

  it('removes named off entries', () => {
    const mro = [
      { handlers: { blur: [{ name: 'child_only', run() {} }] }, off: { blur: ['unwanted'] as string[] } },
      { handlers: { blur: [{ name: 'unwanted', run() {} }, { name: 'kept', run() {} }] } },
    ];
    const merged = mergeHandlers(mro);
    expect(merged.blur.map((h) => h.name)).toEqual(['kept', 'child_only']);
  });

  it('off "all" clears event entirely', () => {
    const mro = [
      { handlers: { blur: [{ name: 'own', run() {} }] }, off: { blur: 'all' as const } },
      { handlers: { blur: [{ name: 'p', run() {} }] } },
    ];
    const merged = mergeHandlers(mro);
    expect(merged.blur.map((h) => h.name)).toEqual(['own']);
  });
});

describe('mergeChain()', () => {
  it('concatenates parents first and applies off', () => {
    const mro = [
      { transformers: [{ id: 'own' }], offTransform: ['dropped'] as string[] },
      { transformers: [{ id: 'kept' }, { id: 'dropped' }] },
    ];
    const merged = mergeChain(mro, (t) => t.id);
    expect(merged.map((t) => t.id)).toEqual(['kept', 'own']);
  });
});

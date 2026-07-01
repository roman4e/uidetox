import { describe, expect, it } from 'vitest';
import { derived } from '../../src/runtime/derived.js';
import { effect } from '../../src/runtime/effect.js';
import { state } from '../../src/runtime/state.js';

describe('derived()', () => {
  it('computes lazily and updates when dependencies change', () => {
    const s = state({ a: 2, b: 3 });
    const d = derived(() => s.a * s.b);
    expect(d.value).toBe(6);
    s.a = 4;
    expect(d.value).toBe(12);
  });

  it('propagates to subscribers through effect()', () => {
    const s = state({ x: 1 });
    const d = derived(() => s.x + 10);
    const seen: number[] = [];
    effect(() => { seen.push(d.value); });
    s.x = 5;
    expect(seen).toEqual([11, 15]);
  });
});

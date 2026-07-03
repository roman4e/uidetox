import { describe, expect, it } from 'vitest';
import { prefersReducedMotion } from '../../../src/runtime/anim/reducedMotion.js';

describe('prefersReducedMotion()', () => {
  it('returns a boolean and does not throw', () => {
    expect(typeof prefersReducedMotion()).toBe('boolean');
  });

  it('reads matchMedia when present', () => {
    const original = globalThis.matchMedia;
    (globalThis as { matchMedia?: unknown }).matchMedia = (q: string) => ({
      matches: q.includes('reduce'),
      media: q,
    });
    expect(prefersReducedMotion()).toBe(true);
    (globalThis as { matchMedia?: unknown }).matchMedia = original;
  });
});

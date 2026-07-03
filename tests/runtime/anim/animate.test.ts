import { describe, expect, it } from 'vitest';
import { animate } from '../../../src/runtime/anim/animate.js';

describe('animate()', () => {
  it('applies final keyframe instantly when WAAPI is unavailable', () => {
    const el = document.createElement('div');
    // ensure no animate method
    (el as unknown as { animate?: unknown }).animate = undefined;
    const result = animate(el, [{ opacity: '0' }, { opacity: '1' }]);
    expect(result).toBeNull();
    expect(el.style.opacity).toBe('1');
  });

  it('delegates to el.animate when available', () => {
    const el = document.createElement('div');
    let called = false;
    (el as unknown as { animate: unknown }).animate = () => {
      called = true;
      return { finished: Promise.resolve() } as unknown as Animation;
    };
    const original = globalThis.matchMedia;
    (globalThis as { matchMedia?: unknown }).matchMedia = () => ({ matches: false });
    const result = animate(el, [{ opacity: '0' }, { opacity: '1' }]);
    (globalThis as { matchMedia?: unknown }).matchMedia = original;
    expect(called).toBe(true);
    expect(result).not.toBeNull();
  });
});

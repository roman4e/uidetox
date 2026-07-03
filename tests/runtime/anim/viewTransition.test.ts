import { describe, expect, it } from 'vitest';
import { viewTransition } from '../../../src/runtime/anim/viewTransition.js';

describe('viewTransition()', () => {
  it('runs mutateFn directly when API is unavailable', async () => {
    let ran = false;
    await viewTransition(() => { ran = true; });
    expect(ran).toBe(true);
  });

  it('uses startViewTransition when present', async () => {
    let used = false;
    (document as unknown as { startViewTransition: unknown }).startViewTransition = (cb: () => void) => {
      used = true;
      cb();
      return { finished: Promise.resolve() };
    };
    let ran = false;
    await viewTransition(() => { ran = true; });
    delete (document as unknown as { startViewTransition?: unknown }).startViewTransition;
    expect(used).toBe(true);
    expect(ran).toBe(true);
  });
});

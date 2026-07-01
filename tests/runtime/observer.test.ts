import { describe, expect, it } from 'vitest';
import { getCurrentObserver, runWithObserver } from '../../src/runtime/observer.js';

describe('observer stack', () => {
  it('returns null when no observer is active', () => {
    expect(getCurrentObserver()).toBeNull();
  });

  it('exposes the current observer inside runWithObserver', () => {
    const obs = () => {};
    let seen: ReturnType<typeof getCurrentObserver> = null;
    runWithObserver(obs, () => {
      seen = getCurrentObserver();
    });
    expect(seen).toBe(obs);
    expect(getCurrentObserver()).toBeNull();
  });

  it('restores the previous observer after nesting', () => {
    const outer = () => {};
    const inner = () => {};
    let outerBefore: unknown;
    let innerSeen: unknown;
    let outerAfter: unknown;
    runWithObserver(outer, () => {
      outerBefore = getCurrentObserver();
      runWithObserver(inner, () => {
        innerSeen = getCurrentObserver();
      });
      outerAfter = getCurrentObserver();
    });
    expect(outerBefore).toBe(outer);
    expect(innerSeen).toBe(inner);
    expect(outerAfter).toBe(outer);
  });
});

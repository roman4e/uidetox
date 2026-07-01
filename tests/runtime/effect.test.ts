import { describe, expect, it } from 'vitest';
import { effect } from '../../src/runtime/effect.js';
import { state } from '../../src/runtime/state.js';

describe('effect()', () => {
  it('runs immediately and re-runs on dependency change', () => {
    const s = state({ count: 0 });
    const seen: number[] = [];
    effect(() => { seen.push(s.count); });
    s.count = 1;
    s.count = 2;
    expect(seen).toEqual([0, 1, 2]);
  });

  it('calls cleanup between runs and on dispose', () => {
    const s = state({ count: 0 });
    const events: string[] = [];
    const dispose = effect(() => {
      const c = s.count;
      events.push(`run:${c}`);
      return () => events.push(`cleanup:${c}`);
    });
    s.count = 1;
    dispose();
    s.count = 2;
    expect(events).toEqual(['run:0', 'cleanup:0', 'run:1', 'cleanup:1']);
  });
});

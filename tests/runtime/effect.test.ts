import { describe, expect, it } from 'vitest';
import { effect } from '../../src/runtime/effect.js';
import { flushSync } from '../../src/runtime/scheduler.js';
import { state } from '../../src/runtime/state.js';

describe('effect()', () => {
  it('runs immediately and re-runs on dependency change', () => {
    const s = state({ count: 0 });
    const seen: number[] = [];
    effect(() => { seen.push(s.count); });
    s.count = 1;
    flushSync();
    s.count = 2;
    flushSync();
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
    flushSync();
    dispose();
    s.count = 2;
    flushSync();
    expect(events).toEqual(['run:0', 'cleanup:0', 'run:1', 'cleanup:1']);
  });

  it('batches multiple writes in the same tick into one re-run', () => {
    const s = state({ a: 0, b: 0 });
    const seen: number[] = [];
    effect(() => { seen.push(s.a + s.b); });
    s.a = 1;
    s.b = 2;
    flushSync();
    expect(seen).toEqual([0, 3]);
  });
});

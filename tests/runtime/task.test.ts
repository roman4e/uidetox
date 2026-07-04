import { describe, expect, it } from 'vitest';
import { task } from '../../src/runtime/task.js';
import { state } from '../../src/runtime/state.js';

const tick = () => new Promise((r) => setTimeout(r, 5));

describe('task()', () => {
  it('runs asynchronously, not synchronously at creation', async () => {
    const log: string[] = [];
    task(() => { log.push('run'); });
    expect(log).toEqual([]); // not yet
    await tick();
    expect(log).toEqual(['run']);
  });

  it('re-runs when a tracked signal changes', async () => {
    const s = state({ q: 'a' });
    const seen: string[] = [];
    task(() => { seen.push(s.q); });
    await tick();
    expect(seen).toEqual(['a']);
    s.q = 'b';
    await tick();
    expect(seen).toEqual(['a', 'b']);
  });

  it('coalesces multiple changes in a tick into one re-run', async () => {
    const s = state({ a: 0, b: 0 });
    let runs = 0;
    task(() => { void s.a; void s.b; runs++; });
    await tick();
    expect(runs).toBe(1);
    s.a = 1;
    s.b = 1;
    await tick();
    expect(runs).toBe(2); // one re-run for both changes
  });

  it('aborts the previous run signal on re-run', async () => {
    const s = state({ q: 'a' });
    const signals: AbortSignal[] = [];
    task((signal) => { void s.q; signals.push(signal); });
    await tick();
    s.q = 'b';
    await tick();
    expect(signals).toHaveLength(2);
    expect(signals[0].aborted).toBe(true);  // previous aborted
    expect(signals[1].aborted).toBe(false); // current live
  });

  it('dispose stops re-runs and aborts', async () => {
    const s = state({ q: 'a' });
    let runs = 0;
    const dispose = task(() => { void s.q; runs++; });
    await tick();
    expect(runs).toBe(1);
    dispose();
    s.q = 'b';
    await tick();
    expect(runs).toBe(1); // no more runs
  });
});

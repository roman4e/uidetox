import { describe, expect, it, vi } from 'vitest';
import { resource } from '../../src/http/resource.js';
import { state } from '../../src/runtime/state.js';
import { flushSync } from '../../src/runtime/scheduler.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('resource()', () => {
  it('loads then exposes data + success status', async () => {
    const r = resource(async () => ({ items: [1, 2] }));
    expect(r.status).toBe('loading');
    expect(r.loading).toBe(true);
    await tick();
    expect(r.status).toBe('success');
    expect(r.data).toEqual({ items: [1, 2] });
  });

  it('captures errors', async () => {
    const r = resource(async () => { throw new Error('boom'); });
    await tick();
    expect(r.status).toBe('error');
    expect((r.error as Error).message).toBe('boom');
  });

  it('re-runs when the reactive key changes', async () => {
    const q = state({ text: 'a' });
    const fetcher = vi.fn(async () => q.text.toUpperCase());
    const r = resource(fetcher, { key: () => q.text });
    await tick();
    expect(r.data).toBe('A');
    q.text = 'b';
    flushSync();
    await tick();
    expect(r.data).toBe('B');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('aborts the previous request when the key changes rapidly', async () => {
    const q = state({ n: 1 });
    const signals: AbortSignal[] = [];
    const r = resource(async (signal) => {
      signals.push(signal);
      await tick();
      return q.n;
    }, { key: () => q.n });
    q.n = 2;
    flushSync();
    await tick();
    await tick();
    // first run's signal aborted, second resolved
    expect(signals[0].aborted).toBe(true);
    expect(r.data).toBe(2);
  });

  it('reload() re-fetches on demand', async () => {
    let calls = 0;
    const r = resource(async () => ++calls);
    await tick();
    expect(r.data).toBe(1);
    r.reload();
    await tick();
    expect(r.data).toBe(2);
  });

  it('abort() cancels an in-flight request', async () => {
    let captured: AbortSignal | undefined;
    const r = resource(async (signal) => { captured = signal; await tick(); return 5; });
    r.abort();
    await tick();
    expect(captured!.aborted).toBe(true);
    expect(r.status).toBe('loading'); // never resolved into success
  });
});

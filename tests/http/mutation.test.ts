import { describe, expect, it, vi } from 'vitest';
import { mutation } from '../../src/http/mutation.js';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('mutation()', () => {
  it('runs, returns result, calls onSuccess, toggles pending', async () => {
    const onSuccess = vi.fn();
    const m = mutation(async (n: number) => n * 2, { onSuccess });
    const p = m(3);
    expect(m.pending).toBe(true);
    const result = await p;
    expect(result).toBe(6);
    expect(m.pending).toBe(false);
    expect(onSuccess).toHaveBeenCalledWith(6, 3);
  });

  it('rolls back with the optimistic snapshot on error', async () => {
    const onRollback = vi.fn();
    const onError = vi.fn();
    const m = mutation(
      async () => { throw new Error('server said no'); },
      {
        onOptimistic: (id: string) => ({ prev: `snapshot-of-${id}` }),
        onRollback,
        onError,
      },
    );
    await expect(m('x')).rejects.toThrow('server said no');
    expect(onRollback).toHaveBeenCalledWith({ prev: 'snapshot-of-x' }, 'x');
    expect(onError).toHaveBeenCalled();
    expect((m.error as Error).message).toBe('server said no');
    expect(m.pending).toBe(false);
  });

  it('applies optimistic update immediately, before the request resolves', async () => {
    const store = { value: 1 };
    const m = mutation(
      async (v: number) => { await tick(); return v; },
      { onOptimistic: (v) => { const prev = store.value; store.value = v; return prev; } },
    );
    const p = m(9);
    expect(store.value).toBe(9); // applied synchronously
    await p;
    expect(store.value).toBe(9);
  });
});

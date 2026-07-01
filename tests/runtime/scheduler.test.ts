import { describe, expect, it } from 'vitest';
import { flushSync, scheduleFlush } from '../../src/runtime/scheduler.js';

describe('scheduler', () => {
  it('dedupes duplicate jobs before flushing', () => {
    let calls = 0;
    const job = () => { calls++; };
    scheduleFlush(job);
    scheduleFlush(job);
    scheduleFlush(job);
    flushSync();
    expect(calls).toBe(1);
  });

  it('runs jobs in insertion order', () => {
    const seen: number[] = [];
    scheduleFlush(() => seen.push(1));
    scheduleFlush(() => seen.push(2));
    scheduleFlush(() => seen.push(3));
    flushSync();
    expect(seen).toEqual([1, 2, 3]);
  });
});

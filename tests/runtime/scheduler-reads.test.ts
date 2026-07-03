import { describe, expect, it } from 'vitest';
import {
  flushSync,
  readFrame,
  scheduleRead,
  scheduleRender,
  scheduleEffect,
} from '../../src/runtime/scheduler.js';

describe('async measure queue', () => {
  it('reads run between effects and renders', () => {
    const order: string[] = [];
    scheduleRender(() => order.push('render'));
    scheduleRead(() => order.push('read'));
    scheduleEffect(() => order.push('effect'));
    flushSync();
    expect(order).toEqual(['effect', 'read', 'render']);
  });

  it('readFrame resolves with the read result', async () => {
    let ran = false;
    const p = readFrame(() => { ran = true; return 42; });
    flushSync();
    const result = await p;
    expect(ran).toBe(true);
    expect(result).toBe(42);
  });

  it('batches multiple readFrame calls into one read phase', () => {
    const order: string[] = [];
    scheduleRender(() => order.push('r'));
    void readFrame(() => order.push('read-a'));
    void readFrame(() => order.push('read-b'));
    flushSync();
    // both reads happen before render
    expect(order.indexOf('read-a')).toBeLessThan(order.indexOf('r'));
    expect(order.indexOf('read-b')).toBeLessThan(order.indexOf('r'));
  });
});

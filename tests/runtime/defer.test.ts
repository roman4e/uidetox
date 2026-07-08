import { describe, expect, it } from 'vitest';
import { defer, idle } from '../../src/runtime/defer.js';

describe('defer / idle', () => {
  it('defer runs the callback in a later macrotask (off the current tick)', async () => {
    const order: string[] = [];
    defer(() => order.push('deferred'));
    order.push('sync');
    expect(order).toEqual(['sync']);            // not run synchronously
    await new Promise((r) => setTimeout(r, 0));
    expect(order).toEqual(['sync', 'deferred']);
  });

  it('idle runs the callback (idle or macrotask fallback)', async () => {
    let ran = false;
    idle(() => { ran = true; });
    await new Promise((r) => setTimeout(r, 10));
    expect(ran).toBe(true);
  });
});

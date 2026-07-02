import { describe, expect, it } from 'vitest';
import { runGuards } from '../../../src/runtime/router/guards.js';
import { Redirect } from '../../../src/runtime/router/types.js';

const ctx = {} as never;

describe('runGuards()', () => {
  it('passes when all return true', async () => {
    const chain = [() => true, async () => true];
    expect(await runGuards(chain, ctx)).toBe(true);
  });

  it('short-circuits on false', async () => {
    const calls: number[] = [];
    const chain = [
      () => { calls.push(1); return true; },
      () => { calls.push(2); return false; },
      () => { calls.push(3); return true; },
    ];
    expect(await runGuards(chain, ctx)).toBe(false);
    expect(calls).toEqual([1, 2]);
  });

  it('returns redirect', async () => {
    const chain = [() => new Redirect('/login')];
    const result = await runGuards(chain, ctx);
    expect(result).toBeInstanceOf(Redirect);
    if (result instanceof Redirect) expect(result.url).toBe('/login');
  });
});

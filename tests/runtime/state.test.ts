import { describe, expect, it } from 'vitest';
import { runWithObserver } from '../../src/runtime/observer.js';
import { state } from '../../src/runtime/state.js';

describe('state()', () => {
  it('reads and writes properties transparently', () => {
    const s = state({ count: 0 });
    expect(s.count).toBe(0);
    s.count = 5;
    expect(s.count).toBe(5);
  });

  it('subscribes the current observer on read and re-runs it on write', () => {
    const s = state({ count: 0 });
    let seen = -1;
    const obs = () => { seen = s.count; };
    runWithObserver(obs, obs);       // first read registers observer
    expect(seen).toBe(0);
    s.count = 42;                    // write must re-invoke observer
    expect(seen).toBe(42);
  });

  it('deep-proxies nested objects', () => {
    const s = state({ inner: { value: 1 } });
    let seen = -1;
    const obs = () => { seen = s.inner.value; };
    runWithObserver(obs, obs);
    expect(seen).toBe(1);
    s.inner.value = 7;
    expect(seen).toBe(7);
  });

  it('tracks array mutations via index writes', () => {
    const s = state({ list: [1, 2, 3] as number[] });
    let sum = 0;
    const obs = () => { sum = s.list.reduce((a, b) => a + b, 0); };
    runWithObserver(obs, obs);
    expect(sum).toBe(6);
    s.list[0] = 10;
    expect(sum).toBe(15);
  });
});

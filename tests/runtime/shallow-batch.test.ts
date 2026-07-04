import { describe, expect, it } from 'vitest';
import { state, shallow, batch } from '../../src/runtime/state.js';
import { untracked } from '../../src/runtime/observer.js';
import { effect } from '../../src/runtime/effect.js';
import { flushSync } from '../../src/runtime/scheduler.js';

describe('shallow()', () => {
  it('re-runs an effect when a top-level slot is replaced', () => {
    const g = shallow({ nodes: [1, 2], edges: [] as number[] });
    let runs = 0;
    let seen = 0;
    effect(() => { runs++; seen = g.nodes.length; });
    expect(runs).toBe(1);
    g.nodes = [1, 2, 3];
    flushSync();
    expect(runs).toBe(2);
    expect(seen).toBe(3);
  });

  it('does NOT re-run when mutating inside a shallow value', () => {
    const g = shallow({ nodes: [1, 2] as number[] });
    let runs = 0;
    effect(() => { runs++; void g.nodes.length; });
    expect(runs).toBe(1);
    g.nodes.push(3); // nested mutation — not tracked
    flushSync();
    expect(runs).toBe(1);
  });

  it('returns nested values by identity (not re-wrapped)', () => {
    const arr = [1, 2];
    const g = shallow({ nodes: arr });
    expect(g.nodes).toBe(arr);
  });

  it('returns a stable proxy for the same object', () => {
    const obj = { a: 1 };
    expect(shallow(obj)).toBe(shallow(obj));
  });

  it('notifies on delete', () => {
    const g = shallow<{ a?: number }>({ a: 1 });
    let runs = 0;
    effect(() => { runs++; void g.a; });
    delete g.a;
    flushSync();
    expect(runs).toBe(2);
  });
});

describe('batch()', () => {
  it('collapses writes across containers into one flush', () => {
    const a = state({ x: 0 });
    const b = state({ y: 0 });
    let runs = 0;
    effect(() => { runs++; void a.x; void b.y; });
    expect(runs).toBe(1);
    batch(() => {
      a.x = 1;
      a.x = 2;
      b.y = 5;
    });
    flushSync();
    expect(runs).toBe(2); // exactly one re-run for all three writes
    expect(a.x).toBe(2);
    expect(b.y).toBe(5);
  });

  it('sees current post-write values inside the batch', () => {
    const s = state({ x: 1 });
    let inner = 0;
    batch(() => {
      s.x = 9;
      inner = s.x;
    });
    expect(inner).toBe(9);
  });

  it('flattens nested batches (single flush)', () => {
    const s = state({ x: 0 });
    let runs = 0;
    effect(() => { runs++; void s.x; });
    batch(() => {
      s.x = 1;
      batch(() => { s.x = 2; });
      s.x = 3;
    });
    flushSync();
    expect(runs).toBe(2);
    expect(s.x).toBe(3);
  });

  it('still flushes if the batch function throws', () => {
    const s = state({ x: 0 });
    let runs = 0;
    effect(() => { runs++; void s.x; });
    expect(() => batch(() => { s.x = 1; throw new Error('boom'); })).toThrow('boom');
    flushSync();
    expect(runs).toBe(2);
  });
});

describe('untracked()', () => {
  it('does not subscribe reads inside it', () => {
    const s = state({ a: 1, b: 1 });
    let runs = 0;
    effect(() => { runs++; void s.a; untracked(() => void s.b); });
    expect(runs).toBe(1);
    s.b = 2; // untracked → no re-run
    flushSync();
    expect(runs).toBe(1);
    s.a = 2; // tracked → re-run
    flushSync();
    expect(runs).toBe(2);
  });
});

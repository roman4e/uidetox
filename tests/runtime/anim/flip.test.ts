import { describe, expect, it } from 'vitest';
import { computeFlipDelta } from '../../../src/runtime/anim/flip.js';

describe('computeFlipDelta()', () => {
  it('computes translation delta', () => {
    const first = { x: 0, y: 0, width: 100, height: 50 };
    const last = { x: 30, y: 20, width: 100, height: 50 };
    expect(computeFlipDelta(first, last)).toEqual({ dx: -30, dy: -20, sx: 1, sy: 1 });
  });

  it('computes scale delta', () => {
    const first = { x: 0, y: 0, width: 200, height: 100 };
    const last = { x: 0, y: 0, width: 100, height: 50 };
    expect(computeFlipDelta(first, last)).toEqual({ dx: 0, dy: 0, sx: 2, sy: 2 });
  });

  it('guards zero-size last', () => {
    const first = { x: 0, y: 0, width: 100, height: 50 };
    const last = { x: 0, y: 0, width: 0, height: 0 };
    expect(computeFlipDelta(first, last)).toEqual({ dx: 0, dy: 0, sx: 1, sy: 1 });
  });
});

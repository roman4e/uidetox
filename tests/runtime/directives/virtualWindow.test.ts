import { describe, expect, it } from 'vitest';
import { computeWindow } from '../../../src/runtime/directives/virtualWindow.js';

describe('computeWindow', () => {
  it('computes the visible slice plus overscan', () => {
    // 100 rows × 48px, viewport 480px (10 rows), scrolled to row 20
    const w = computeWindow({ scrollTop: 20 * 48, viewportHeight: 480, rowHeight: 48, count: 100, overscan: 4 });
    expect(w.start).toBe(16); // 20 - 4
    expect(w.end).toBe(35); // (20 + 10) + 4 + 1
    expect(w.offsetTop).toBe(16 * 48);
    expect(w.totalHeight).toBe(100 * 48);
  });

  it('clamps start at 0 near the top', () => {
    const w = computeWindow({ scrollTop: 0, viewportHeight: 480, rowHeight: 48, count: 100, overscan: 4 });
    expect(w.start).toBe(0);
    expect(w.offsetTop).toBe(0);
    expect(w.end).toBe(15); // 10 visible + 4 overscan + 1
  });

  it('clamps end at count near the bottom', () => {
    const w = computeWindow({ scrollTop: 95 * 48, viewportHeight: 480, rowHeight: 48, count: 100, overscan: 4 });
    expect(w.end).toBe(100);
    expect(w.start).toBe(91);
  });

  it('handles an empty list', () => {
    const w = computeWindow({ scrollTop: 0, viewportHeight: 480, rowHeight: 48, count: 0, overscan: 4 });
    expect(w).toEqual({ start: 0, end: 0, offsetTop: 0, totalHeight: 0 });
  });

  it('handles a single item', () => {
    const w = computeWindow({ scrollTop: 0, viewportHeight: 480, rowHeight: 48, count: 1, overscan: 4 });
    expect(w.start).toBe(0);
    expect(w.end).toBe(1);
    expect(w.totalHeight).toBe(48);
  });

  it('handles an exact multiple of row height', () => {
    const w = computeWindow({ scrollTop: 48, viewportHeight: 96, rowHeight: 48, count: 10, overscan: 0 });
    expect(w.start).toBe(1);
    expect(w.end).toBe(4); // rows 1,2,3 visible → end exclusive 4 (row at 96 boundary + 1)
  });

  it('never returns start > end', () => {
    const w = computeWindow({ scrollTop: 10_000, viewportHeight: 480, rowHeight: 48, count: 5, overscan: 4 });
    expect(w.start).toBeLessThanOrEqual(w.end);
    expect(w.end).toBe(5);
  });
});

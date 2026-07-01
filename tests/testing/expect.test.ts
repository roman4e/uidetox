import { describe, expect as vitestExpect, it } from 'vitest';
import { expect } from '../../src/testing/expect.js';

describe('expect()', () => {
  it('toBe passes for strict equality', () => {
    expect(1).toBe(1);
    vitestExpect(() => expect(1).toBe(2)).toThrow(/toBe/);
  });

  it('toEqual passes for structural equality', () => {
    expect({ a: 1, b: [2] }).toEqual({ a: 1, b: [2] });
    vitestExpect(() => expect({ a: 1 }).toEqual({ a: 2 })).toThrow(/toEqual/);
  });

  it('toContain checks substrings and array membership', () => {
    expect('hello world').toContain('world');
    expect([1, 2, 3]).toContain(2);
    vitestExpect(() => expect([1, 2, 3]).toContain(4)).toThrow(/toContain/);
  });

  it('toHaveNoViolations reads .violations', () => {
    expect({ violations: [] }).toHaveNoViolations();
    vitestExpect(() => expect({ violations: [{ id: 'x' }] }).toHaveNoViolations()).toThrow(/toHaveNoViolations/);
  });
});

import { describe, expect, it } from 'vitest';
import { defineFilter } from '../../../src/runtime/filters/define.js';

describe('defineFilter()', () => {
  it('returns a callable that transforms values', () => {
    const lc = defineFilter('lc', {
      input: 'string',
      output: 'string',
      paramsSchema: {},
      transformers: [{ name: null, run(this: unknown, v: string) { return v.toLowerCase(); } }],
    });
    expect((lc as (v: string) => string)('HELLO')).toBe('hello');
  });

  it('applies chain in order', () => {
    const chain = defineFilter('chain', {
      input: 'string',
      output: 'string',
      paramsSchema: {},
      transformers: [
        { name: 'a', run(this: unknown, v: string) { return `[${v}]`; } },
        { name: 'b', run(this: unknown, v: string) { return v.toUpperCase(); } },
      ],
    });
    expect((chain as (v: string) => string)('x')).toBe('[X]');
  });

  it('exposes params via this', () => {
    const money = defineFilter('money', {
      input: 'number',
      output: 'string',
      paramsSchema: { currency: { type: 'string', default: 'USD' } },
      transformers: [{
        name: null,
        run(this: { params: { currency: string } }, v: number) {
          return `${v} ${this.params.currency}`;
        },
      }],
    });
    expect((money as (v: number, params: { currency: string }) => string)(5, { currency: 'EUR' })).toBe('5 EUR');
  });
});

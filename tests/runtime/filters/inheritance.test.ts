import { describe, expect, it } from 'vitest';
import { defineFilter } from '../../../src/runtime/filters/define.js';

describe('filter inheritance', () => {
  it('runs parent transformers before own', () => {
    const parent = defineFilter('brackets', {
      input: 'string', output: 'string', paramsSchema: {},
      transformers: [{ name: 'a', run(this: unknown, v: unknown) { return `[${v as string}]`; } }],
    });
    const child = defineFilter('bracketsUp', {
      input: 'string', output: 'string', paramsSchema: {},
      transformers: [{ name: 'b', run(this: unknown, v: unknown) { return (v as string).toUpperCase(); } }],
      extends: [(parent as unknown as { $descriptor: never }).$descriptor],
    });
    expect((child as (v: string) => string)('x')).toBe('[X]');
  });

  it('offTransform removes named parent transformer', () => {
    const parent = defineFilter('parentF', {
      input: 'string', output: 'string', paramsSchema: {},
      transformers: [
        { name: 'keep', run(this: unknown, v: unknown) { return (v as string) + '1'; } },
        { name: 'drop', run(this: unknown, v: unknown) { return (v as string) + '2'; } },
      ],
    });
    const child = defineFilter('childF', {
      input: 'string', output: 'string', paramsSchema: {},
      transformers: [{ name: 'own', run(this: unknown, v: unknown) { return (v as string) + '3'; } }],
      extends: [(parent as unknown as { $descriptor: never }).$descriptor],
      offTransform: ['drop'],
    });
    expect((child as (v: string) => string)('x')).toBe('x13');
  });
});

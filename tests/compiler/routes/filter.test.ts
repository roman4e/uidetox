import { describe, expect, it } from 'vitest';
import { emitFilter } from '../../../src/compiler/routes/filter.js';

describe('emitFilter()', () => {
  it('character class DSL', () => {
    expect(emitFilter('[[Alphabet+Numbers]]')).toBe('/^[a-zA-Z0-9]+$/');
  });
  it('regex literal', () => {
    expect(emitFilter('/^[a-z]+$/')).toBe('/^[a-z]+$/');
  });
  it('expression', () => {
    expect(emitFilter('${is_number}')).toBe('is_number');
  });
  it('bare identifier', () => {
    expect(emitFilter('is_positive')).toBe('is_positive');
  });
});

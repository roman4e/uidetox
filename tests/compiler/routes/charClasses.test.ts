import { describe, expect, it } from 'vitest';
import { classDslToRegex, expandClassExpression } from '../../../src/compiler/routes/charClasses.js';

describe('charClasses', () => {
  it('expands single classes', () => {
    expect(expandClassExpression('Alphabet')).toBe('[a-zA-Z]');
    expect(expandClassExpression('Numbers')).toBe('[0-9]');
    expect(expandClassExpression('Slug')).toBe('[a-z0-9-]');
    expect(expandClassExpression('UUID')).toBe('[0-9a-f-]{36}');
  });

  it('composes classes with +', () => {
    expect(expandClassExpression('Alphabet+Numbers+Dash')).toBe('[a-zA-Z0-9-]');
  });

  it('throws on unknown class', () => {
    expect(() => expandClassExpression('Unicorn')).toThrow(/unknown character class/i);
  });

  it('classDslToRegex wraps and anchors', () => {
    expect(classDslToRegex('[[Alphabet+Numbers]]').source).toBe('^[a-zA-Z0-9]+$');
    expect(classDslToRegex('[[UUID]]').source).toBe('^[0-9a-f-]{36}$');
  });
});

import { describe, expect, it } from 'vitest';
import { getPath, parsePath, setPath } from '../../src/forms/path.js';

describe('path utils', () => {
  it('parses dotted and bracketed paths', () => {
    expect(parsePath('taste.salt')).toEqual(['taste', 'salt']);
    expect(parsePath('nutrients.0.code')).toEqual(['nutrients', '0', 'code']);
    expect(parsePath('nutrients[0].code')).toEqual(['nutrients', '0', 'code']);
  });

  it('gets nested value', () => {
    const obj = { taste: { salt: 0.5 }, nutrients: [{ code: 'x' }] };
    expect(getPath(obj, 'taste.salt')).toBe(0.5);
    expect(getPath(obj, 'nutrients.0.code')).toBe('x');
    expect(getPath(obj, 'missing.deep')).toBeUndefined();
  });

  it('sets nested value, creating intermediates', () => {
    const obj: Record<string, unknown> = {};
    setPath(obj, 'taste.salt', 0.7);
    expect((obj.taste as { salt: number }).salt).toBe(0.7);
    setPath(obj, 'nutrients.0.code', 'abc');
    expect((obj.nutrients as Array<{ code: string }>)[0].code).toBe('abc');
  });
});

import { describe, expect, it } from 'vitest';
import { serializeQuery } from '../../src/http/serialize.js';

describe('serializeQuery', () => {
  it('serializes primitives', () => {
    expect(serializeQuery({ q: 'salt', limit: 50, active: true })).toBe('q=salt&limit=50&active=true');
  });

  it('repeats keys for arrays', () => {
    expect(serializeQuery({ tag: ['a', 'b'] })).toBe('tag=a&tag=b');
  });

  it('uses dot-notation for nested objects', () => {
    expect(serializeQuery({ filter: { min: 0, max: 5 } })).toBe('filter.min=0&filter.max=5');
  });

  it('omits null and undefined', () => {
    expect(serializeQuery({ a: 1, b: null, c: undefined, d: 2 })).toBe('a=1&d=2');
  });

  it('encodes special characters', () => {
    expect(serializeQuery({ q: 'a b&c' })).toBe('q=a%20b%26c');
  });

  it('returns empty string for no params', () => {
    expect(serializeQuery({})).toBe('');
    expect(serializeQuery({ a: null })).toBe('');
  });

  it('handles arrays of nested-object dot paths', () => {
    expect(serializeQuery({ f: { tags: ['x', 'y'] } })).toBe('f.tags=x&f.tags=y');
  });
});

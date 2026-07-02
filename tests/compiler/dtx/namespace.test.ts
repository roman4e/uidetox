import { describe, expect, it } from 'vitest';
import { isKebabName, kebabToCamel } from '../../../src/compiler/dtx/namespace.js';

describe('namespace', () => {
  it('kebabToCamel', () => {
    expect(kebabToCamel('trim')).toBe('trim');
    expect(kebabToCamel('numeric-only')).toBe('numericOnly');
    expect(kebabToCamel('to-lowercase-ext')).toBe('toLowercaseExt');
  });
  it('isKebabName', () => {
    expect(isKebabName('trim')).toBe(true);
    expect(isKebabName('numeric-only')).toBe(true);
    expect(isKebabName('bad Name')).toBe(false);
    expect(isKebabName('CamelCase')).toBe(false);
  });
});

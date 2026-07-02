import { describe, expect, it } from 'vitest';
import { emitParamSchema } from '../../../src/compiler/routes/paramTransform.js';

describe('emitParamSchema()', () => {
  it('emits schema literal for typed param', () => {
    const { name, source } = emitParamSchema([['id', 'number']]);
    expect(name).toBe('id');
    expect(source).toContain('type: "number"');
    expect(source).toContain('optional: false');
  });

  it('includes filter and default', () => {
    const { source } = emitParamSchema([
      ['slug', 'string'],
      ['filter', '[[Alphabet+Numbers+Dash]]'],
      ['default', 'unset'],
    ]);
    expect(source).toContain('filter: /^[a-zA-Z0-9-]+$/');
    expect(source).toContain('default: "unset"');
  });

  it('flags optional attribute', () => {
    const { source } = emitParamSchema([
      ['postId', 'string'],
      ['optional', ''],
    ]);
    expect(source).toContain('optional: true');
  });

  it('errors when no name binding is present', () => {
    expect(() => emitParamSchema([['filter', 'x']])).toThrow(/name binding/i);
  });
});

import { describe, expect, it } from 'vitest';
import { validateMetadata } from '../../../src/compiler/metadata/validate.js';

describe('validateMetadata()', () => {
  it('accepts title when PageTitle is extended', () => {
    const r = validateMetadata({ extends: ['PageTitle'], title: 'x' });
    expect(r.errors).toEqual([]);
    expect(r.declared).toEqual({ title: 'x' });
  });

  it('errors on title without PageTitle', () => {
    const r = validateMetadata({ title: 'x' });
    expect(r.errors[0]).toMatch(/PageTitle/);
  });

  it('errors on unknown interface', () => {
    const r = validateMetadata({ extends: ['Nope'] });
    expect(r.errors[0]).toMatch(/unknown interface/i);
  });

  it('warns on duplicate interface entries', () => {
    const r = validateMetadata({ extends: ['PageTitle', 'PageTitle'], title: 'x' });
    expect(r.warnings[0]).toMatch(/duplicate/i);
  });
});

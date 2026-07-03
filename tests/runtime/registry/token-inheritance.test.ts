import { describe, expect, it } from 'vitest';
import { createToken, registry } from '../../../src/runtime/registry.js';

interface Theme { name: string; }

describe('token inheritance', () => {
  it('falls back to ancestor provider', () => {
    const base = createToken<Theme>('base-theme');
    const admin = createToken<Theme>('admin-theme', { extends: [base] });
    registry.provide(base, () => ({ name: 'base' }));
    expect(registry.get(admin).value).toEqual({ name: 'base' });
  });

  it('own provider wins', () => {
    const base = createToken<Theme>('b');
    const child = createToken<Theme>('c', { extends: [base] });
    registry.provide(base, () => ({ name: 'base' }));
    registry.provide(child, () => ({ name: 'child' }));
    expect(registry.get(child).value).toEqual({ name: 'child' });
  });
});
